import { Canvas, useFrame } from "@react-three/fiber";
import { TileMap } from "./TileMap";
import { MapControls } from "./MapControls";

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

export function Map3D() {
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
        <CoordinateUpdater />
      </Canvas>

      <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm p-4 rounded-md text-sm border border-border font-mono whitespace-pre-line" id="coordinate-display">
        Camera XYZ: Loading...
      </div>

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
