import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'
import {
    DroneFlightProvider,
    useDroneFlight,
} from '../../contexts/DroneFlightContext'
import { INITIAL_COORDS } from '../../lib/constants'
import { prepareTrackData } from '../../lib/trackPreparation'
import { DroneCamera } from './DroneCamera'
import { DroneFlightControls } from './DroneFlightControls'
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay'
import { GpxStatsOverlay } from './GpxStatsOverlay'
import { MapControls } from './MapControls'
import {
    MapDebugOverlay,
    type MapDebugMetrics,
    type TrackSamplingStatus,
} from './MapDebugOverlay'
import { TileMap } from './TileMap'
import { Track } from './Track'

const INITIAL_CAMERA_BEHIND_METERS = 180
const INITIAL_CAMERA_ABOVE_METERS = 260
const INITIAL_CAMERA_LOOKAHEAD_METERS = 110

interface InitialCameraPose {
    position: Vector3
    target: Vector3
}

function findLookAheadPoint(
    points: Vector3[],
    minimumDistanceM: number
): Vector3 | null {
    if (points.length < 2) {
        return null
    }

    const startPoint = points[0]

    for (let i = 1; i < points.length; i++) {
        if (points[i].distanceTo(startPoint) >= minimumDistanceM) {
            return points[i]
        }
    }

    return points[points.length - 1] ?? null
}

function computeInitialCameraPose(
    alignedPathPoints: Vector3[]
): InitialCameraPose | null {
    const startPoint = alignedPathPoints[0]
    if (!startPoint) {
        return null
    }

    const trackOffset = new Vector3(-INITIAL_COORDS.x, 0, INITIAL_COORDS.y)
    const startWorld = startPoint.clone().add(trackOffset)
    const aheadPoint =
        findLookAheadPoint(alignedPathPoints, INITIAL_CAMERA_LOOKAHEAD_METERS) ??
        startPoint
    const aheadWorld = aheadPoint.clone().add(trackOffset)
    const forward = aheadWorld.clone().sub(startWorld)

    if (forward.lengthSq() < 1e-6) {
        return {
            position: startWorld.clone().add(new Vector3(0, 250, 250)),
            target: startWorld,
        }
    }

    forward.normalize()

    const position = startWorld
        .clone()
        .sub(forward.clone().multiplyScalar(INITIAL_CAMERA_BEHIND_METERS))
        .add(new Vector3(0, INITIAL_CAMERA_ABOVE_METERS, 0))

    const target = startWorld
        .clone()
        .add(forward.multiplyScalar(INITIAL_CAMERA_LOOKAHEAD_METERS))
        .add(new Vector3(0, 8, 0))

    return { position, target }
}

function CameraSetup({
    initialCameraPose,
    applyToken,
}: {
    initialCameraPose: InitialCameraPose | null
    applyToken: number
}) {
    const { camera } = useThree()

    useEffect(() => {
        if (!initialCameraPose || applyToken === 0) {
            return
        }

        camera.position.copy(initialCameraPose.position)
        camera.lookAt(initialCameraPose.target)
        camera.updateMatrixWorld()
    }, [applyToken, camera, initialCameraPose])

    return null
}

function ControlsOverlay() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="absolute top-0 left-0 pointer-events-auto">
            {isOpen ? (
                <div className="ml-3 mt-3 bg-background/75 backdrop-blur-sm p-4 rounded-md text-sm border border-border">
                    <div
                        className="flex items-center justify-between cursor-pointer font-semibold gap-4 select-none text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        <span>Controls</span>
                        <ChevronLeft size={16} />
                    </div>
                    <ul className="space-y-1 text-muted-foreground mt-3">
                        <li>
                            <kbd className="bg-muted px-1 rounded">W</kbd>{' '}
                            Forward
                        </li>
                        <li>
                            <kbd className="bg-muted px-1 rounded">S</kbd>{' '}
                            Backward
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
                            <kbd className="bg-muted px-1 rounded">Shift</kbd>{' '}
                            Speed Boost
                        </li>
                        <li>
                            <kbd className="bg-muted px-1 rounded">
                                Click + Drag
                            </kbd>{' '}
                            Look Around
                        </li>
                    </ul>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="flex h-10 w-5 items-center justify-center rounded-r-md border-y border-r border-border bg-background/75 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
                    aria-label="Expand controls"
                >
                    <ChevronRight size={16} />
                </button>
            )}
        </div>
    )
}

function DebugProbe({
    onMetricsChange,
}: {
    onMetricsChange: (metrics: MapDebugMetrics) => void
}) {
    const { camera, gl, scene } = useThree()
    const { curveRef, isPlaying, progressRef, speed } = useDroneFlight()
    const elapsedMsRef = useRef(0)
    const frameCountRef = useRef(0)

    useFrame((_, delta) => {
        const nextElapsedMs = elapsedMsRef.current + delta * 1000
        const nextFrameCount = frameCountRef.current + 1

        if (nextElapsedMs < 300) {
            elapsedMsRef.current = nextElapsedMs
            frameCountRef.current = nextFrameCount
            return
        }

        let visibleMapMeshes = 0
        let totalMapMeshes = 0
        let visibleSceneObjects = 0
        const tileMapGroup = scene.getObjectByName('TileMapGroup')

        scene.traverseVisible(() => {
            visibleSceneObjects++
        })

        if (tileMapGroup) {
            tileMapGroup.traverse((child) => {
                // @ts-expect-error three runtime flag
                if (child.isMesh) {
                    totalMapMeshes++
                    if (child.visible) {
                        visibleMapMeshes++
                    }
                }
            })
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
        })

        elapsedMsRef.current = 0
        frameCountRef.current = 0
    })

    return null
}

export function Map3D({ gpxContent }: { gpxContent?: string }) {
    const preparedTrack = useMemo(() => {
        if (!gpxContent) {
            return null
        }

        try {
            return prepareTrackData(gpxContent)
        } catch (error) {
            console.error('Failed to prepare GPX track', error)
            return null
        }
    }, [gpxContent])

    const [terrainReady, setTerrainReady] = useState(false)
    const [trackReady, setTrackReady] = useState(false)
    const [initialCameraPose, setInitialCameraPose] =
        useState<InitialCameraPose | null>(null)
    const [cameraApplyToken, setCameraApplyToken] = useState(0)
    const [isDebugOpen, setIsDebugOpen] = useState(false)
    const [debugMetrics, setDebugMetrics] = useState<MapDebugMetrics | null>(
        null
    )
    const [samplingStatus, setSamplingStatus] =
        useState<TrackSamplingStatus | null>(null)

    const [prevTrack, setPrevTrack] = useState(preparedTrack)

    if (preparedTrack !== prevTrack) {
        setPrevTrack(preparedTrack)
        setTerrainReady(false)
        setTrackReady(false)
        setInitialCameraPose(null)
        setCameraApplyToken(0)
        setSamplingStatus(null)
    }

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'KeyI' && !event.repeat) {
                setIsDebugOpen((current) => !current)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    return (
        <DroneFlightProvider>
            <div className="absolute inset-0 bg-slate-900 overflow-hidden">
                <Canvas
                    camera={{
                        position: [0, 6000, 0],
                        fov: 60,
                        near: 10,
                        far: 1e6,
                    }}
                >
                    <CameraSetup
                        initialCameraPose={initialCameraPose}
                        applyToken={cameraApplyToken}
                    />

                    <ambientLight intensity={0.5} />
                    <directionalLight
                        position={[1000, 2000, 1000]}
                        intensity={1.5}
                        castShadow
                    />

                    {preparedTrack && (
                        <>
                            <TileMap onWarmupChange={setTerrainReady} />
                            <group
                                position={[
                                    -INITIAL_COORDS.x,
                                    0,
                                    INITIAL_COORDS.y,
                                ]}
                            >
                                <Track
                                    preparedTrack={preparedTrack}
                                    onReadyChange={setTrackReady}
                                    onInitialCameraPoseReady={(points) => {
                                        const pose =
                                            computeInitialCameraPose(points)
                                        setInitialCameraPose(pose)
                                        if (pose) {
                                            setCameraApplyToken(
                                                (current) => current + 1
                                            )
                                        }
                                    }}
                                    onSamplingStatusChange={setSamplingStatus}
                                />
                            </group>
                        </>
                    )}

                    <MapControls cameraSyncToken={cameraApplyToken} />
                    <DroneCamera
                        preparedTrack={preparedTrack}
                        initialCameraPose={initialCameraPose}
                    />
                    <DebugProbe onMetricsChange={setDebugMetrics} />
                </Canvas>

                {preparedTrack && (
                    <>
                        <GpxStatsOverlay stats={preparedTrack.stats} />
                        {preparedTrack.points.length > 0 && (
                            <FlightTelemetryOverlay
                                preparedTrack={preparedTrack}
                            />
                        )}
                    </>
                )}
                <MapDebugOverlay
                    isOpen={isDebugOpen}
                    metrics={debugMetrics}
                    terrainReady={terrainReady}
                    trackReady={trackReady}
                    samplingStatus={samplingStatus}
                />
                <ControlsOverlay />
                <DroneFlightControls
                    canPlay={trackReady}
                    canReset={initialCameraPose !== null}
                    onResetCamera={() => {
                        if (initialCameraPose) {
                            setCameraApplyToken((current) => current + 1)
                        }
                    }}
                />
            </div>
        </DroneFlightProvider>
    )
}
