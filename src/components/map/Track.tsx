import { useState, useRef, useMemo } from "react";
import { UnitsUtils } from "geo-three";
import { parseGpx } from "../../lib/gpxParser";
import {
  Vector3,
  CatmullRomCurve3,
  Raycaster,
  Mesh,
  Group,
  type Intersection,
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { INITIAL_COORDS } from "../../lib/constants";

interface SnapPoint {
  x: number;
  y: number;
  z: number;
  resolved: boolean;
}

export function Track({ gpxContent }: { gpxContent: string }) {
  const { scene } = useThree();

  const initialData = useMemo(() => {
    try {
      const gpxData = parseGpx(gpxContent);
      const vecPoints: SnapPoint[] = [];
      let lastPoint: Vector3 | null = null;
      // Filter points to ensure minimum distance (e.g. 10 units = approx 10 meters in Web Mercator)
      // Reduced to 10 to preserve corners better, applying smoothing later instead
      const MIN_DISTANCE = 10;

      for (const pt of gpxData.points) {
        const spherical = UnitsUtils.datumsToSpherical(pt.lat, pt.lon);
        const currentVec = new Vector3(spherical.x, 0, -spherical.y);

        if (!lastPoint || lastPoint.distanceTo(currentVec) >= MIN_DISTANCE) {
          vecPoints.push({
            x: spherical.x,
            // Start the point way up in the sky so it's always visible before snapping
            y: Math.max(pt.ele + 1000, 4000),
            z: -spherical.y,
            resolved: false,
          });
          lastPoint = currentVec;
        }
      }

      // Ensure we always add the very last point so the track doesn't end abruptly
      const lastGpxPt = gpxData.points[gpxData.points.length - 1];
      if (lastGpxPt) {
        const spherical = UnitsUtils.datumsToSpherical(lastGpxPt.lat, lastGpxPt.lon);
        const lastVec = new Vector3(spherical.x, 0, -spherical.y);
        if (lastPoint && lastPoint.distanceTo(lastVec) > 0.1) {
          vecPoints.push({
            x: spherical.x,
            y: Math.max(lastGpxPt.ele + 1000, 4000),
            z: -spherical.y,
            resolved: false,
          });
        }
      }

      return {
        name: gpxData.name,
        points: vecPoints,
      };
    } catch (err) {
      console.error("Failed to parse GPX data", err);
      return { name: "", points: [] };
    }
  }, [gpxContent]);

  const [points, setPoints] = useState<SnapPoint[]>(initialData.points);
  const pointsRef = useRef<SnapPoint[]>(initialData.points);
  const checkIndex = useRef(0);

  // Create static objects for raycaster avoiding garbage collection
  const raycaster = useRef(new Raycaster());
  const downVector = useRef(new Vector3(0, -1, 0));
  const worldOrigin = useRef(new Vector3());

  // Raycasting loop to snap points to the dynamic terrain
  useFrame(() => {
    if (pointsRef.current.length === 0) return;

    // Find the terrain group by name (set in TileMap)
    const tileMapGroup = scene.getObjectByName("TileMapGroup") as
      | Group
      | undefined;
    if (!tileMapGroup) return;

    let pointsChanged = false;
    let checks = 0;

    // Check up to 10 points per frame to maintain 60FPS while loading fast
    while (checks < 10 && checkIndex.current < pointsRef.current.length) {
      const idx = checkIndex.current;
      const pt = pointsRef.current[idx];
      checks++;

      // Raycast down from high up in world coordinates
      // The track is inside a shifted group, so its world coordinate is (local.x - shift.x)
      const worldX = pt.x - INITIAL_COORDS.x;
      const worldZ = pt.z + INITIAL_COORDS.y;

      worldOrigin.current.set(worldX, 15000, worldZ);
      raycaster.current.set(worldOrigin.current, downVector.current);

      const intersects: Intersection[] = [];
      // Traverse geo-three tiles, ONLY visible nodes to avoid hidden LOD meshes
      tileMapGroup.traverseVisible((child) => {
        if ((child as Mesh).isMesh && (child as Mesh).geometry) {
          child.raycast(raycaster.current, intersects);
        }
      });

      if (intersects.length > 0) {
        intersects.sort((a, b) => a.distance - b.distance);
        const terrainY = intersects[0].point.y;
        const targetY = terrainY + 20; // Float 20m above terrain to clear the bumpy map meshes

        // Continually adapt to more accurate LOD levels loaded over time
        if (!pt.resolved || Math.abs(pt.y - targetY) > 2) {
          pointsRef.current[idx] = {
            ...pt,
            y: targetY,
            resolved: true,
          };
          pointsChanged = true;
        }
      }

      checkIndex.current++;
    }

    // Once we reach the end of the array, restart the loop to re-check points
    // that missed previously because their specific terrain tile wasn't loaded yet.
    if (checkIndex.current >= pointsRef.current.length) {
      checkIndex.current = 0;
    }

    if (pointsChanged) {
      setPoints([...pointsRef.current]);
    }
  });

  const { curve, firstPoint, isFullyResolved } = useMemo(() => {
    if (points.length < 2)
      return { curve: null, firstPoint: null, isFullyResolved: false };

    let vec3s = points.map((p) => new Vector3(p.x, p.y, p.z));
    const isFullyResolved = points.every((p) => p.resolved);

    // Apply Laplacian smoothing to the points to eliminate jagged corners and sudden Y-jumps.
    // This prevents the TubeGeometry from folding/pinching on itself at sharp turns while preserving the overall track shape.
    const SMOOTHING_PASSES = 1;
    for (let pass = 0; pass < SMOOTHING_PASSES; pass++) {
      const smoothed = [vec3s[0]]; // Keep first point fixed
      for (let i = 1; i < vec3s.length - 1; i++) {
        // Weighed moving average: original point keeps 50% weight, neighbors 25% each
        // This is less aggressive than a plain divideScalar(3) average
        const avg = new Vector3()
          .copy(vec3s[i])
          .multiplyScalar(0.5)
          .add(vec3s[i - 1].clone().multiplyScalar(0.25))
          .add(vec3s[i + 1].clone().multiplyScalar(0.25));
        smoothed.push(avg);
      }
      smoothed.push(vec3s[vec3s.length - 1]); // Keep last point fixed
      vec3s = smoothed;
    }

    return {
      curve: new CatmullRomCurve3(vec3s),
      firstPoint: vec3s[0],
      isFullyResolved,
    };
  }, [points]);

  if (!curve || !firstPoint) return null;

  return (
    <group>
      <mesh>
        {/* Adjusted radius to 8 to avoid self-intersection on corners, and increased segments for smoothness */}
        <tubeGeometry args={[curve, Math.max(points.length * 3, 200), 8, 8, false]} />
        <meshStandardMaterial
          color={isFullyResolved ? "#8bec7a" : "#faca84"} // yellow-600 while snapping, green when done
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
