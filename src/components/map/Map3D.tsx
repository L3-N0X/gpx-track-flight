import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TileMap } from "./TileMap";
import { MapControls } from "./MapControls";
import { Track } from "./Track";
import { INITIAL_COORDS } from "../../lib/constants";
import { DroneFlightProvider, useDroneFlight } from "../../contexts/DroneFlightContext";
import { DroneFlightControls } from "./DroneFlightControls";
import { DroneCamera } from "./DroneCamera";
import { GpxStatsOverlay } from "./GpxStatsOverlay";
import { MapDebugOverlay, type MapDebugMetrics, type TrackSamplingStatus } from "./MapDebugOverlay";
import { prepareTrackData } from "../../lib/trackPreparation";

function CameraSetup({
  hasTrack,
  firstPoint,
}: {
  hasTrack: boolean;
  firstPoint?: { x: number; y: number; z: number };
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (!hasTrack || !firstPoint) {
      return;
    }

    camera.position.set(
      firstPoint.x - INITIAL_COORDS.x,
      firstPoint.y + 2000,
      firstPoint.z + INITIAL_COORDS.y,
    );
  }, [camera, firstPoint, hasTrack]);

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
            <kbd className="bg-muted px-1 rounded">Click + Drag</kbd> Look Around
          </li>
        </ul>
      )}
    </div>
  );
}

function DebugProbe({ onMetricsChange }: { onMetricsChange: (metrics: MapDebugMetrics) => void }) {
  const { camera, gl, scene } = useThree();
  const { curveRef, isPlaying, progressRef, speed } = useDroneFlight();
  const elapsedMsRef = useRef(0);
  const frameCountRef = useRef(0);

  useFrame((_, delta) => {
    const nextElapsedMs = elapsedMsRef.current + delta * 1000;
    const nextFrameCount = frameCountRef.current + 1;

    if (nextElapsedMs < 300) {
      elapsedMsRef.current = nextElapsedMs;
      frameCountRef.current = nextFrameCount;
      return;
    }

    let visibleMapMeshes = 0;
    let totalMapMeshes = 0;
    let visibleSceneObjects = 0;
    const tileMapGroup = scene.getObjectByName("TileMapGroup");

    scene.traverseVisible(() => {
      visibleSceneObjects++;
    });

    if (tileMapGroup) {
      tileMapGroup.traverse((child) => {
        // @ts-expect-error three runtime flag
        if (child.isMesh) {
          totalMapMeshes++;
          if (child.visible) {
            visibleMapMeshes++;
          }
        }
      });
    }

    onMetricsChange({
      fps: (nextFrameCount * 1000) / nextElapsedMs,
      frameTimeMs: nextElapsedMs / nextFrameCount,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      visibleMapMeshes,
      totalMapMeshes,
      visibleSceneObjects,
      cameraX: camera.position.x,
      cameraY: camera.position.y,
      cameraZ: camera.position.z,
      flightProgress: progressRef.current,
      isPlaying,
      speed,
      curveReady: curveRef.current !== null,
    });

    elapsedMsRef.current = 0;
    frameCountRef.current = 0;
  });

  return null;
}

export function Map3D({ gpxContent }: { gpxContent?: string }) {
  const preparedTrack = useMemo(() => {
    if (!gpxContent) {
      return null;
    }

    try {
      return prepareTrackData(gpxContent);
    } catch (error) {
      console.error("Failed to prepare GPX track", error);
      return null;
    }
  }, [gpxContent]);

  const [terrainReady, setTerrainReady] = useState(false);
  const [trackReady, setTrackReady] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugMetrics, setDebugMetrics] = useState<MapDebugMetrics | null>(null);
  const [samplingStatus, setSamplingStatus] = useState<TrackSamplingStatus | null>(null);

  const [prevTrack, setPrevTrack] = useState(preparedTrack);

  if (preparedTrack !== prevTrack) {
    setPrevTrack(preparedTrack);
    setTerrainReady(false);
    setTrackReady(false);
    setSamplingStatus(null);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyI" && !event.repeat) {
        setIsDebugOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <DroneFlightProvider>
      <div className="absolute inset-0 bg-slate-900 overflow-hidden">
        <Canvas
          camera={{
            position: [0, 6000, 0],
            fov: 60,
            near: 10,
            far: 1e9,
          }}
        >
          <CameraSetup hasTrack={preparedTrack !== null} firstPoint={preparedTrack?.points[0]} />

          <ambientLight intensity={0.5} />
          <directionalLight position={[1000, 2000, 1000]} intensity={1.5} castShadow />

          {preparedTrack && (
            <>
              <TileMap preparedTrack={preparedTrack} onWarmupChange={setTerrainReady} />
              <group position={[-INITIAL_COORDS.x, 0, INITIAL_COORDS.y]}>
                <Track
                  preparedTrack={preparedTrack}
                  onReadyChange={setTrackReady}
                  onSamplingStatusChange={setSamplingStatus}
                />
              </group>
            </>
          )}

          <MapControls />
          <DroneCamera />
          <DebugProbe onMetricsChange={setDebugMetrics} />
        </Canvas>

        {preparedTrack && <GpxStatsOverlay stats={preparedTrack.stats} />}
        <MapDebugOverlay
          isOpen={isDebugOpen}
          metrics={debugMetrics}
          terrainReady={terrainReady}
          trackReady={trackReady}
          samplingStatus={samplingStatus}
        />
        <ControlsOverlay />
        <DroneFlightControls canPlay={trackReady} />
      </div>
    </DroneFlightProvider>
  );
}
