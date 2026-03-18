import { useState, useRef, useMemo, useEffect } from "react";
import { UnitsUtils } from "geo-three";
import { parseGpx } from "../../lib/gpxParser";
import { computeGpxStats } from "../../lib/gpxStats";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Vector3, CatmullRomCurve3, Raycaster, Mesh, Group, type Intersection } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { INITIAL_COORDS } from "../../lib/constants";
import { useDroneFlight } from "../../contexts/DroneFlightContext";

interface SnapPoint {
  x: number;
  y: number;
  z: number;
  resolved: boolean;
  speed: number;
  originalIndex: number;
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
      const stats = computeGpxStats(gpxData.name, gpxData.points);
      const MIN_DISTANCE = 10;

      for (let i = 0; i < gpxData.points.length; i++) {
        const pt = gpxData.points[i];
        const spherical = UnitsUtils.datumsToSpherical(pt.lat, pt.lon);
        const currentVec = new Vector3(spherical.x, 0, -spherical.y);

        if (!lastPoint || lastPoint.distanceTo(currentVec) >= MIN_DISTANCE) {
          vecPoints.push({
            x: spherical.x,
            // Start the point way up in the sky so it's always visible before snapping
            y: Math.max(pt.ele + 1000, 4000),
            z: -spherical.y,
            resolved: false,
            speed: stats.pointSpeeds[i] || 0,
            originalIndex: i,
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
            speed: stats.pointSpeeds[stats.pointSpeeds.length - 1] || 0,
            originalIndex: gpxData.points.length - 1,
          });
        }
      }

      return {
        name: gpxData.name,
        points: vecPoints,
        stats,
      };
    } catch (err) {
      console.error("Failed to parse GPX data", err);
      return { name: "", points: [], stats: null };
    }
  }, [gpxContent]);

  const { curveRef } = useDroneFlight();
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
    const tileMapGroup = scene.getObjectByName("TileMapGroup") as Group | undefined;
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

  const trackData = useMemo(() => {
    if (points.length < 2)
      return {
        curve: null,
        firstPoint: null,
        isFullyResolved: false,
        highestPoint: null,
        fastestPoint: null,
        maxSpeed: null,
      };
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

    // Identify markers
    let highestPoint: Vector3 | null = null;
    let fastestPoint: Vector3 | null = null;
    let maxSpeed = -Infinity;

    if (initialData.stats) {
      const stats = initialData.stats;
      points.forEach((p, idx) => {
        // We use the smoothed position if possible, rough mapping
        const mappedIdx = Math.min(idx, vec3s.length - 1);
        const pos = vec3s[mappedIdx];

        if (p.originalIndex === stats.highestPointIndex) {
          highestPoint = pos;
        }
        if (p.originalIndex === stats.fastestPointIndex) {
          fastestPoint = pos;
          maxSpeed = stats.maxSpeedKmh || p.speed;
        }
      });
    }

    return {
      curve: new CatmullRomCurve3(vec3s),
      firstPoint: vec3s[0],
      isFullyResolved,
      highestPoint: highestPoint as Vector3 | null,
      fastestPoint: fastestPoint as Vector3 | null,
      maxSpeed,
    };
  }, [points, initialData.stats]);

  const { curve, firstPoint, isFullyResolved, highestPoint, fastestPoint, maxSpeed } = trackData;

  // Pass generated curve to global state only once resolved
  useEffect(() => {
    if (curve && isFullyResolved) {
      curveRef.current = curve;
    }
  }, [curve, isFullyResolved, curveRef]);

  // Update vertex colors
  const tubeRef = useRef<Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    if (
      !tubeRef.current ||
      !materialRef.current ||
      !curve ||
      !initialData.stats ||
      !isFullyResolved
    )
      return;

    const geometry = tubeRef.current.geometry;
    if (!geometry) return;

    // Get colors for each segment based on speed
    const colors: number[] = [];
    const colorObj = new THREE.Color();

    // The number of tubular segments we defined
    const tubularSegments = Math.max(points.length * 3, 200);
    // Add 1 to radialSegments because the vertices wrap around (8 segments = 9 vertices)
    const radialSegments = 8 + 1;

    // We use a small minimum speed so colors don't hit 0 division, but allow low speed coloring
    const trackMaxSpeed = initialData.stats.maxSpeedKmh || 30;

    for (let i = 0; i <= tubularSegments; i++) {
      // Map t (0 to 1) to our original points array
      const t = i / tubularSegments;
      const ptIndex = Math.min(Math.floor(t * points.length), points.length - 1);

      const speed = points[ptIndex].speed || 0;

      // Map speed to color (green to red)
      // Ratio: 0 = very slow (green), 1 = max speed (red)
      const ratio = Math.min(Math.max(speed / trackMaxSpeed, 0), 1);

      // HSL interpolation: Green hue is ~0.33, Red hue is 0.0
      // Calculate hue: 0.33 * (1 - ratio) gives Green->Red transition as speed increases
      colorObj.setHSL(0.33 * (1 - ratio), 0.8, 0.5, THREE.SRGBColorSpace);

      // For each radial segment at this tubular location, add the same color
      for (let j = 0; j < radialSegments; j++) {
        colors.push(colorObj.r, colorObj.g, colorObj.b);
      }
    }

    // Store colors in geometry
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    // Important: Tell Three.js the attributes need to be sent to GPU
    geometry.attributes.color.needsUpdate = true;
    if (materialRef.current) materialRef.current.needsUpdate = true; // Ensure material recompiles with vertex colors
  }, [curve, points, initialData.stats, isFullyResolved]);

  if (!curve || !firstPoint) return null;

  return (
    <group>
      <DroneShape />
      <mesh ref={tubeRef}>
        {/* Adjusted radius to 8 to avoid self-intersection on corners, and increased segments for smoothness */}
        <tubeGeometry args={[curve, Math.max(points.length * 3, 200), 8, 8, false]} />
        <meshStandardMaterial
          ref={materialRef}
          // Base color must be fully white (#ffffff) to show vertex colors correctly.
          // If this is set to anything else, the colors get mixed.
          color="#ffffff"
          vertexColors={isFullyResolved}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Markers */}
      {isFullyResolved && initialData.stats?.highestPointIndex !== null && highestPoint && (
        <group position={[highestPoint.x, highestPoint.y + 100, highestPoint.z]}>
          {/* Line down to track */}
          <mesh position={[0, -50, 0]}>
            <cylinderGeometry args={[2, 2, 100]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Html center className="pointer-events-none">
            <div className="flex flex-col items-center drop-shadow-md">
              <div className="bg-slate-900/80 font-bold text-white px-2 py-1 rounded border border-white/20 whitespace-nowrap mb-1">
                ⛰️ {initialData.stats?.highestElevationM ?? 0}m
              </div>
              <div className="w-3 h-3 bg-white rounded-full border-2 border-slate-500"></div>
            </div>
          </Html>
        </group>
      )}

      {isFullyResolved &&
        initialData.stats?.fastestPointIndex !== null &&
        fastestPoint &&
        maxSpeed !== null && (
          <group position={[fastestPoint.x, fastestPoint.y + 100, fastestPoint.z]}>
            {/* Line down to track */}
            <mesh position={[0, -50, 0]}>
              <cylinderGeometry args={[2, 2, 100]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <Html center className="pointer-events-none">
              <div className="flex flex-col items-center drop-shadow-md">
                <div className="bg-slate-900/80 font-bold text-white px-2 py-1 rounded border border-white/20 whitespace-nowrap mb-1">
                  🚀 {maxSpeed.toFixed(1)} km/h
                </div>
                <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
              </div>
            </Html>
          </group>
        )}
    </group>
  );
}

function DroneShape() {
  const { curveRef, progressRef } = useDroneFlight();
  const droneRef = useRef<Mesh>(null);

  useFrame(() => {
    if (!droneRef.current || !curveRef.current) return;
    curveRef.current.getPointAt(progressRef.current, droneRef.current.position);
  });

  return (
    <mesh ref={droneRef}>
      <sphereGeometry args={[20, 16, 16]} />
      <meshStandardMaterial color="#ffffff" emissive="#ff0000" emissiveIntensity={0.8} />
    </mesh>
  );
}
