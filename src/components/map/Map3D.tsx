import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MapView } from 'geo-three'
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
import { computeCameraPose, type CameraPose } from '../../lib/cameraUtils'

function MapLODUpdater({
    mapViewRef,
}: {
    mapViewRef: React.MutableRefObject<MapView | null>
}) {
    const { camera, gl, scene } = useThree()

    useFrame(() => {
        const mapView = mapViewRef.current
        if (mapView?.lod) {
            mapView.lod.updateLOD(mapView, camera, gl, scene)
        }
    })

    return null
}

function CameraSetup({
    initialCameraPose,
    applyToken,
}: {
    initialCameraPose: CameraPose | null
    applyToken: number
}) {
    const { camera } = useThree()

    useEffect(() => {
        if (!initialCameraPose) {
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

    const worldOrigin = useMemo(() => {
        if (preparedTrack && preparedTrack.points.length > 0) {
            const p = preparedTrack.points[0]
            return { x: p.mercatorX, y: p.mercatorY }
        }
        return INITIAL_COORDS
    }, [preparedTrack])

    const [terrainReady, setTerrainReady] = useState(false)
    const [trackReady, setTrackReady] = useState(false)
    const [initialCameraPose, setInitialCameraPose] =
        useState<CameraPose | null>(null)
    const [cameraApplyToken, setCameraApplyToken] = useState(0)
    const [isDebugOpen, setIsDebugOpen] = useState(false)
    const [debugMetrics, setDebugMetrics] = useState<MapDebugMetrics | null>(
        null
    )
    const [samplingStatus, setSamplingStatus] =
        useState<TrackSamplingStatus | null>(null)
    const mapViewRef = useRef<MapView | null>(null)

    const [prevTrack, setPrevTrack] = useState(preparedTrack)

    if (preparedTrack !== prevTrack) {
        setPrevTrack(preparedTrack)
        setTerrainReady(false)
        setTrackReady(false)
        setSamplingStatus(null)

        // Compute rough initial camera pose immediately from unprepared points
        if (preparedTrack) {
            const pose = computeCameraPose(preparedTrack.points, worldOrigin)
            setInitialCameraPose(pose)
            if (pose) {
                setCameraApplyToken((current) => current + 1)
            }
        } else {
            setInitialCameraPose(null)
            setCameraApplyToken(0)
        }
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

    const initialCanvasPosition: [number, number, number] = useMemo(() => {
        if (initialCameraPose) {
            return [
                initialCameraPose.position.x,
                initialCameraPose.position.y,
                initialCameraPose.position.z,
            ]
        }
        return [0, 6000, 0]
    }, [initialCameraPose])

    return (
        <DroneFlightProvider>
            <div className="absolute inset-0 bg-slate-900 overflow-hidden">
                <Canvas
                    camera={{
                        position: initialCanvasPosition,
                        fov: 60,
                        near: 10,
                        far: 1e6,
                    }}
                >
                    <CameraSetup
                        initialCameraPose={initialCameraPose}
                        applyToken={cameraApplyToken}
                    />
                    <MapLODUpdater mapViewRef={mapViewRef} />

                    <ambientLight intensity={0.5} />
                    <directionalLight
                        position={[1000, 2000, 1000]}
                        intensity={1.5}
                        castShadow
                    />

                    {preparedTrack && (
                        <>
                            <TileMap
                                onWarmupChange={setTerrainReady}
                                onMapViewReady={(mv) => {
                                    mapViewRef.current = mv
                                }}
                                worldOrigin={worldOrigin}
                            />
                            <group
                                position={[
                                    -worldOrigin.x,
                                    0,
                                    worldOrigin.y,
                                ]}
                            >
                                <Track
                                    preparedTrack={preparedTrack}
                                    onReadyChange={setTrackReady}
                                    onInitialCameraPoseReady={(points) => {
                                        const pose = computeCameraPose(
                                            points,
                                            worldOrigin
                                        )
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
                        worldOrigin={worldOrigin}
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
