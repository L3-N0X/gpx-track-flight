import { Canvas } from "@react-three/fiber";
import { TileMap } from "./TileMap";
import { MapControls } from "./MapControls";

export function Map3D() {
  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden">
      <Canvas
        camera={{
          position: [0, 4000, 0], // Start high up
          fov: 60,
          near: 10,
          far: 1e9, // Very far draw distance required for Earth-scale maps
        }}
      >
        {/* Basic lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[1000, 2000, 1000]}
          intensity={1.5}
          castShadow
        />

        {/* The terrain map */}
        <TileMap />

        {/* 
                  Using a custom WASD MapControls component or PointerLock.
                  For now we will implement simple WASD-like controls. 
                */}
        <MapControls />
      </Canvas>

      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-4 rounded-md text-sm border border-border">
        <p className="font-semibold mb-2">Controls</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>
            <kbd className="bg-muted px-1 rounded">W</kbd> Forward
          </li>
          <li>
            <kbd className="bg-muted px-1 rounded">S</kbd> Backward
          </li>
          <li>
            <kbd className="bg-muted px-1 rounded">A</kbd> Left
          </li>
          <li>
            <kbd className="bg-muted px-1 rounded">D</kbd> Right
          </li>
          <li>
            <kbd className="bg-muted px-1 rounded">Q</kbd> Down
          </li>
          <li>
            <kbd className="bg-muted px-1 rounded">E</kbd> Up
          </li>
          <li>
            <kbd className="bg-muted px-1 rounded">Shift</kbd> Speed Boost
          </li>
          <li>
            <kbd className="bg-muted px-1 rounded">Click + Drag</kbd> Look
            Around
          </li>
        </ul>
      </div>
    </div>
  );
}
