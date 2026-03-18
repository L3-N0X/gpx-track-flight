import { useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { UnitsUtils } from "geo-three";
import { TileMap } from "./TileMap";
import { MapControls } from "./MapControls";
import { Track } from "./Track";
import { INITIAL_COORDS } from "../../lib/constants";
import { parseGpx } from "../../lib/gpxParser";

// Coordinate display removed to simplify components
function CoordinateUpdater() {
  useFrame(({ camera }) => {
    const el = document.getElementById("coordinate-display");
    if (el) {
      el.innerText = `Camera XYZ: ${Math.round(camera.position.x)}, ${Math.round(camera.position.y)}, ${Math.round(camera.position.z)}\nRot: ${(camera.rotation.x * 180 / Math.PI).toFixed(1)}°, ${(camera.rotation.y * 180 / Math.PI).toFixed(1)}°, ${(camera.rotation.z * 180 / Math.PI).toFixed(1)}°`;
    }
  });
  return null;
}

function CameraSetup({ gpxContent }: { gpxContent?: string }) {
  const { camera } = useThree();
  
  useEffect(() => {
    if (gpxContent) {
      try {
        const parsedData = parseGpx(gpxContent);
        const points = parsedData.points;
        if (points.length > 0) {
          const firstPt = points[0];
          const spherical = UnitsUtils.datumsToSpherical(firstPt.lat, firstPt.lon);
          // The visual map and track are shifted by [-INITIAL_COORDS.x, 0, INITIAL_COORDS.y]
          // In Three.js coordinates, North is -Z, so the true world Z is -spherical.y + INITIAL_COORDS.y
          const worldX = spherical.x - INITIAL_COORDS.x;
          const worldZ = -spherical.y + INITIAL_COORDS.y;
          const worldY = firstPt.ele + 2000; // start 2000m above the track point (a bit closer than 3000m)
          
          camera.position.set(worldX, worldY, worldZ);
        }
      } catch (e) {
        console.error("CameraSetup parse error", e);
      }
    }
  }, [gpxContent, camera]);
  
  return null;
}

export function Map3D({ gpxContent }: { gpxContent?: string }) {
  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden">
      <Canvas
        camera={{
          position: [0, 6000, 0], // Start high up above the mountains
          fov: 60,
          near: 10,
          far: 1e9, // Very far draw distance required for Earth-scale maps
        }}
      >
        <CameraSetup gpxContent={gpxContent} />
        
        {/* Basic lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[1000, 2000, 1000]}
          intensity={1.5}
          castShadow
        />

        {/* The terrain map */}
        <TileMap />
        
        {/* Render the Track shifted correctly relative to the world center */}
        {gpxContent && (
          <group position={[-INITIAL_COORDS.x, 0, INITIAL_COORDS.y]}>
            <Track key={gpxContent} gpxContent={gpxContent} />
          </group>
        )}

        {/* 
          Using a custom WASD MapControls component or PointerLock.
          For now we will implement simple WASD-like controls. 
        */}
        <MapControls />
        <CoordinateUpdater />
      </Canvas>

      <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm p-4 rounded-md text-sm border border-border font-mono whitespace-pre-line pointer-events-none" id="coordinate-display">
        Camera XYZ: Loading...
      </div>

      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-4 rounded-md text-sm border border-border pointer-events-none">
        <p className="font-semibold mb-2">Controls</p>
        <ul className="space-y-1 text-muted-foreground">
          <li><kbd className="bg-muted px-1 rounded">W</kbd> Forward</li>
          <li><kbd className="bg-muted px-1 rounded">S</kbd> Backward</li>
          <li><kbd className="bg-muted px-1 rounded">A</kbd> Left</li>
          <li><kbd className="bg-muted px-1 rounded">D</kbd> Right</li>
          <li><kbd className="bg-muted px-1 rounded">Q</kbd> Down</li>
          <li><kbd className="bg-muted px-1 rounded">E</kbd> Up</li>
          <li><kbd className="bg-muted px-1 rounded">Shift</kbd> Speed Boost</li>
          <li><kbd className="bg-muted px-1 rounded">Click + Drag</kbd> Look Around</li>
        </ul>
      </div>
    </div>
  );
}
