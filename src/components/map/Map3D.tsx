import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { LocationLabels } from './LocationLabels'
import { computeCameraPose, type CameraPose } from '../../lib/cameraUtils'
import { FlightRecorder } from './FlightRecorder'



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
        <div className="hidden md:block absolute top-0 left-0 pointer-events-auto">
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
    const logElapsedMsRef = useRef(0)
    const frameCountRef = useRef(0)

    useFrame((_, delta) => {
        const deltaMs = delta * 1000
        const nextElapsedMs = elapsedMsRef.current + deltaMs
        const nextLogElapsedMs = logElapsedMsRef.current + deltaMs
        const nextFrameCount = frameCountRef.current + 1

        // 1. Regular metrics update (300ms)
        if (nextElapsedMs >= 300) {
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
        } else {
            elapsedMsRef.current = nextElapsedMs
            frameCountRef.current = nextFrameCount
        }

        // 2. Detailed debug logging (5 seconds)
        if (nextLogElapsedMs >= 5000) {
            const tileMapGroup = scene.getObjectByName('TileMapGroup')
            console.group('--- 5s Performance Debug ---')
            console.log('Renderer Memory:', {
                geometries: gl.info.memory.geometries,
                textures: gl.info.memory.textures,
                programs: gl.info.programs?.length,
            })
            console.log('Renderer Render:', {
                calls: gl.info.render.calls,
                triangles: gl.info.render.triangles,
                points: gl.info.render.points,
                lines: gl.info.render.lines,
            })

            if (tileMapGroup) {
                let mapNodes = 0
                let mapMeshes = 0
                const nodeLevels: Record<number, number> = {}
                const classNames = new Set<string>()

                tileMapGroup.traverse((child) => {
                    classNames.add(child.constructor.name)
                    
                    // Robust check for geo-three nodes
                    // @ts-expect-error level property
                    const isNode = child.level !== undefined || child.isMapNode || child.constructor.name.includes('Node')
                    
                    if (isNode) {
                        mapNodes++
                        // @ts-expect-error level property
                        const lvl = child.level || 0
                        nodeLevels[lvl] = (nodeLevels[lvl] || 0) + 1
                    }
                    // @ts-expect-error three Mesh detection
                    if (child.isMesh) {
                        mapMeshes++
                    }
                })

                console.log('TileMap Stats:', {
                    totalNodes: mapNodes,
                    totalMeshes: mapMeshes,
                    levels: nodeLevels,
                    classes: Array.from(classNames),
                })
            }

            // Check for potential leaking objects in the scene
            let totalSceneObjects = 0
            scene.traverse(() => {
                totalSceneObjects++
            })
            console.log('Scene Graph:', { totalObjects: totalSceneObjects })
            console.groupEnd()

            logElapsedMsRef.current = 0
        } else {
            logElapsedMsRef.current = nextLogElapsedMs
        }
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

    const handleWarmupChange = useMemo(() => setTerrainReady, [])

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
                    <FlightRecorder />


                    <ambientLight intensity={0.5} />
                    <directionalLight
                        position={[1000, 2000, 1000]}
                        intensity={1.5}
                        castShadow
                    />

                    {preparedTrack && (
                        <>
                            <TileMap
                                preparedTrack={preparedTrack}
                                onWarmupChange={handleWarmupChange}
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
                                <LocationLabels
                                    preparedTrack={preparedTrack}
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
