import { useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Canvas, useThree } from "@react-three/fiber";
import { UnitsUtils } from "geo-three";
import { TileMap } from "./TileMap";
import { MapControls } from "./MapControls";
import { Track } from "./Track";
import { INITIAL_COORDS } from "../../lib/constants";
import { parseGpx } from "../../lib/gpxParser";
import { computeGpxStats } from "../../lib/gpxStats";
import { DroneFlightProvider } from "../../contexts/DroneFlightContext";
import { DroneFlightControls } from "./DroneFlightControls";
import { DroneCamera } from "./DroneCamera";
import { GpxStatsOverlay } from "./GpxStatsOverlay";



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

function ControlsOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm p-4 rounded-md text-sm border border-border pointer-events-auto">
      <div 
        className="flex items-center justify-between cursor-pointer font-semibold gap-4 select-none text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Controls</span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </div>
      {isOpen && (
        <ul className="space-y-1 text-muted-foreground mt-3">
          <li><kbd className="bg-muted px-1 rounded">W</kbd> Forward</li>
          <li><kbd className="bg-muted px-1 rounded">S</kbd> Backward</li>
          <li><kbd className="bg-muted px-1 rounded">A</kbd> Left</li>
          <li><kbd className="bg-muted px-1 rounded">D</kbd> Right</li>
          <li><kbd className="bg-muted px-1 rounded">Q</kbd> Down</li>
          <li><kbd className="bg-muted px-1 rounded">E</kbd> Up</li>
          <li><kbd className="bg-muted px-1 rounded">Shift</kbd> Speed Boost</li>
          <li><kbd className="bg-muted px-1 rounded">Click + Drag</kbd> Look Around</li>
        </ul>
      )}
    </div>
  );
}

export function Map3D({ gpxContent }: { gpxContent?: string }) {
  const gpxStats = useMemo(() => {
    if (!gpxContent) return null;
    try {
      const parsed = parseGpx(gpxContent);
      return computeGpxStats(parsed.name, parsed.points);
    } catch {
      return null;
    }
  }, [gpxContent]);

  return (
    <DroneFlightProvider>
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
          <DroneCamera />
        </Canvas>

        {gpxStats && <GpxStatsOverlay stats={gpxStats} />}
        <ControlsOverlay />
        <DroneFlightControls />
      </div>
    </DroneFlightProvider>
  );
}
