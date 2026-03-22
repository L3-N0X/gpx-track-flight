import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
    CatmullRomCurve3,
    Color,
    Mesh,
    MeshStandardMaterial,
    Quaternion,
    Vector3,
} from 'three'
import { useDroneFlight } from '../../contexts/DroneFlightContext'
import {
    applySampledTrackHeight,
    sampleTrackElevations,
} from '../../lib/demSampling'
import {
    buildSegmentedTrackGeometry,
    getTrackColorForSpeed,
} from '../../lib/trackGeometry'
import type {
    PreparedTrackData,
    PreparedTrackPoint,
} from '../../lib/trackPreparation'
import { interpolateSmoothedSpeedAtDistance } from '../../lib/trackTelemetry'

interface TrackProps {
    preparedTrack: PreparedTrackData
    onReadyChange: (ready: boolean) => void
    onSamplingStatusChange?: (status: {
        sampledPoints: number
        totalPoints: number
        isComplete: boolean
        error: string | null
    }) => void
}

const TRACK_RADIUS = 8
const TRACK_RADIAL_SEGMENTS = 12
const TRACK_CLEARANCE_M = 20
const TRACK_VERTICAL_OFFSET_M = -17
const HIGHLIGHT_POST_HEIGHT = 2
const HIGHLIGHT_ARM_RISE = 48
const HIGHLIGHT_ARM_REACH = 92
const OVERLAP_SPLIT_DISTANCE = 60
const tempWorldPosition = new Vector3()

interface SnappedTrackPoint extends PreparedTrackPoint {
    resolved: boolean
}

interface HighlightSpec {
    id: string
    title: string
    value: string
    accent: string
    glow: string
    distanceM: number
    totalDistanceM: number
    position: Vector3
    armOffset: Vector3
}

function blendVectors(a: Vector3 | null, b: Vector3 | null) {
    if (a && b) {
        return a.clone().add(b).normalize()
    }

    if (a) {
        return a.clone().normalize()
    }

    if (b) {
        return b.clone().normalize()
    }

    return new Vector3(1, 0, 0)
}

function buildLateralDirection(
    points: Vector3[],
    index: number,
    fallbackSign = 1
) {
    const current = points[index]
    const previous =
        index > 0 ? current.clone().sub(points[Math.max(0, index - 1)]) : null
    const next =
        index < points.length - 1
            ? points[Math.min(points.length - 1, index + 1)]
                  .clone()
                  .sub(current)
            : null

    const forward = blendVectors(previous, next)
    forward.y = 0

    if (forward.lengthSq() < 1e-6) {
        return new Vector3(fallbackSign, 0, 0)
    }

    forward.normalize()
    return new Vector3(-forward.z, 0, forward.x).normalize()
}

function buildArmOffset(direction: Vector3, side = 1, extraSpread = 0) {
    return direction
        .clone()
        .multiplyScalar(HIGHLIGHT_ARM_REACH * side + extraSpread)
        .add(new Vector3(0, HIGHLIGHT_ARM_RISE, 0))
}

function buildConnectorTransform(start: Vector3, end: Vector3) {
    const direction = end.clone().sub(start)
    const length = direction.length()
    const midpoint = start.clone().addScaledVector(direction, 0.5)
    const quaternion = new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction.normalize()
    )

    return { length, midpoint, quaternion }
}

function TrackHighlight({
    title,
    value,
    accent,
    glow,
    distanceM,
    totalDistanceM,
    position,
    armOffset,
}: HighlightSpec) {
    const { camera } = useThree()
    const { isPlaying, mode, progressRef, curveRef } = useDroneFlight()
    const groupRef = useRef<Mesh>(null)
    const labelRef = useRef<HTMLDivElement>(null)
    const armStart = useMemo(() => new Vector3(0, HIGHLIGHT_POST_HEIGHT, 0), [])
    const armEnd = useMemo(
        () =>
            new Vector3(
                armOffset.x,
                HIGHLIGHT_POST_HEIGHT + armOffset.y,
                armOffset.z
            ),
        [armOffset]
    )
    const connector = useMemo(
        () => buildConnectorTransform(armStart, armEnd),
        [armEnd, armStart]
    )
    const labelStyle = useMemo(
        () =>
            ({
                boxShadow: `0 18px 48px rgba(2, 6, 23, 0.24)`,
                background:
                    'linear-gradient(160deg, rgba(5, 8, 12, 0.7), rgba(5, 8, 12, 0.52))',
            }) as CSSProperties,
        []
    )

    useFrame(() => {
        if (!groupRef.current || !labelRef.current) {
            return
        }

        groupRef.current.getWorldPosition(tempWorldPosition)
        const distance = camera.position.distanceTo(tempWorldPosition)
        const normalized = Math.min(Math.max((distance - 500) / 3600, 0), 1)
        const scale = 1 - normalized * 0.72
        const isFlightWindowActive =
            mode === 'track-speed' && isPlaying && curveRef.current !== null
        const currentDistanceM = progressRef.current * totalDistanceM
        const isVisible =
            !isFlightWindowActive ||
            Math.abs(currentDistanceM - distanceM) <= 2000

        labelRef.current.style.display = isVisible ? 'block' : 'none'
        labelRef.current.style.transform = `translate(-50%, calc(-100% - 10px)) scale(${scale})`
    })

    return (
        <group position={position.toArray()}>
            <mesh
                ref={groupRef}
                position={connector.midpoint.toArray()}
                quaternion={connector.quaternion}
            >
                <cylinderGeometry args={[2.8, 2.8, connector.length, 18]} />
                <meshStandardMaterial
                    color={accent}
                    emissive={glow}
                    emissiveIntensity={0.1}
                    roughness={0.85}
                    metalness={0.08}
                    opacity={1}
                />
            </mesh>

            <Html
                transform={false}
                position={armEnd.toArray()}
                zIndexRange={[0, 0]}
                className="pointer-events-none select-none"
            >
                <div
                    ref={labelRef}
                    className="transition-transform duration-150 ease-out"
                    style={{ zIndex: 0, transformOrigin: 'bottom center' }}
                >
                    <div
                        className="min-w-30 rounded-md px-2 py-2 text-[10px] leading-none text-white/96 backdrop-blur-xl"
                        style={labelStyle}
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="h-7 w-0.75 rounded-full"
                                style={{
                                    background: `linear-gradient(180deg, ${glow}, ${accent})`,
                                    boxShadow: `0 0 18px ${accent}55`,
                                }}
                            />
                            <div className="min-w-0">
                                {title && (
                                    <div className="font-semibold tracking-[0.22em] text-white/55 uppercase mb-1">
                                        {title}
                                    </div>
                                )}
                                {value ? (
                                    <div className="font-heading text-[13px] font-semibold tracking-[0.03em] text-white">
                                        {value}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </Html>
        </group>
    )
}

function smoothPath(points: Vector3[]) {
    if (points.length < 3) {
        return points
    }

    const smoothed = [points[0].clone()]
    for (let i = 1; i < points.length - 1; i++) {
        smoothed.push(
            points[i]
                .clone()
                .multiplyScalar(0.5)
                .add(points[i - 1].clone().multiplyScalar(0.25))
                .add(points[i + 1].clone().multiplyScalar(0.25))
        )
    }
    smoothed.push(points[points.length - 1].clone())
    return smoothed
}

export function Track({
    preparedTrack,
    onReadyChange,
    onSamplingStatusChange,
}: TrackProps) {
    const { curveRef, progressRef } = useDroneFlight()

    const [snappedPoints, setSnappedPoints] = useState<SnappedTrackPoint[]>(
        () =>
            preparedTrack.points.map((point) => ({
                ...point,
                resolved: false,
            }))
    )
    const pointsRef = useRef<SnappedTrackPoint[]>(snappedPoints)
    const [samplingComplete, setSamplingComplete] = useState(false)

    // 1. Keep track of the previous track
    const [prevTrack, setPrevTrack] = useState(preparedTrack)

    // 2. Adjust STATE during render to avoid cascading re-renders
    if (preparedTrack !== prevTrack) {
        const nextPoints = preparedTrack.points.map((point) => ({
            ...point,
            resolved: false,
        }))

        setPrevTrack(preparedTrack)
        setSnappedPoints(nextPoints)
        setSamplingComplete(false)
    }

    // 3. Update REFS and fire CALLBACKS in useEffect
    // Mutating refs doesn't trigger renders, so this is safe and follows React's rules.
    useEffect(() => {
        const nextPoints = preparedTrack.points.map((point) => ({
            ...point,
            resolved: false,
        }))

        pointsRef.current = nextPoints
        curveRef.current = null
        progressRef.current = 0

        onSamplingStatusChange?.({
            sampledPoints: 0,
            totalPoints: nextPoints.length,
            isComplete: false,
            error: null,
        })
    }, [preparedTrack, onSamplingStatusChange, curveRef, progressRef])

    useEffect(() => {
        let cancelled = false

        void sampleTrackElevations(preparedTrack, (updates) => {
            if (cancelled || updates.length === 0) {
                return
            }

            const nextPoints = [...pointsRef.current]
            for (const update of updates) {
                const point = nextPoints[update.index]
                if (!point) {
                    continue
                }

                nextPoints[update.index] = {
                    ...point,
                    y: applySampledTrackHeight(
                        point,
                        update.height,
                        TRACK_CLEARANCE_M + TRACK_VERTICAL_OFFSET_M
                    ),
                    resolved: true,
                }
            }

            pointsRef.current = nextPoints
            setSnappedPoints(nextPoints)
            onSamplingStatusChange?.({
                sampledPoints: nextPoints.filter((entry) => entry.resolved)
                    .length,
                totalPoints: nextPoints.length,
                isComplete: false,
                error: null,
            })
        })
            .then(() => {
                if (!cancelled) {
                    setSamplingComplete(true)
                    onSamplingStatusChange?.({
                        sampledPoints: pointsRef.current.length,
                        totalPoints: pointsRef.current.length,
                        isComplete: true,
                        error: null,
                    })
                }
            })
            .catch((error) => {
                console.error(
                    'Failed to sample DEM elevations for track',
                    error
                )
                onSamplingStatusChange?.({
                    sampledPoints: pointsRef.current.filter(
                        (entry) => entry.resolved
                    ).length,
                    totalPoints: pointsRef.current.length,
                    isComplete: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Unknown DEM sampling error.',
                })
            })

        return () => {
            cancelled = true
        }
    }, [onSamplingStatusChange, preparedTrack])

    const renderPoints = snappedPoints
    const cumulativeDistances = useMemo(
        () => renderPoints.map((point) => point.distanceFromStartM),
        [renderPoints]
    )

    const smoothedPath = useMemo(
        () =>
            smoothPath(
                renderPoints.map(
                    (point) => new Vector3(point.x, point.y, point.z)
                )
            ),
        [renderPoints]
    )

    const curve = useMemo(
        () =>
            smoothedPath.length >= 2
                ? new CatmullRomCurve3(smoothedPath)
                : null,
        [smoothedPath]
    )

    const geometry = useMemo(
        () =>
            buildSegmentedTrackGeometry({
                pathPoints: smoothedPath,
                segmentSpeeds: preparedTrack.segmentSpeeds,
                cumulativeDistancesM: cumulativeDistances,
                totalDistanceM: preparedTrack.totalDistanceM,
                radius: TRACK_RADIUS,
                radialSegments: TRACK_RADIAL_SEGMENTS,
                sampleSegments: Math.max(1, smoothedPath.length - 1),
                maxSpeedKmh: preparedTrack.stats.maxSpeedKmh,
                useSpeedColors: true,
            }),
        [
            cumulativeDistances,
            preparedTrack.segmentSpeeds,
            preparedTrack.stats.maxSpeedKmh,
            preparedTrack.totalDistanceM,
            smoothedPath,
        ]
    )

    const highlights = useMemo(() => {
        const items: HighlightSpec[] = []
        const highestPoint = smoothedPath[preparedTrack.highestPreparedIndex]
        const fastestPoint =
            preparedTrack.fastestPreparedIndex !== null
                ? smoothedPath[preparedTrack.fastestPreparedIndex]
                : null
        const startPoint = smoothedPath[0]
        const endPoint = smoothedPath[smoothedPath.length - 1]

        if (!startPoint || !endPoint) {
            return items
        }

        const startDirection = buildLateralDirection(smoothedPath, 0, 1)
        const endDirection = buildLateralDirection(
            smoothedPath,
            smoothedPath.length - 1,
            -1
        )
        const startEndDistance = startPoint.distanceTo(endPoint)
        const splitSpread =
            startEndDistance < OVERLAP_SPLIT_DISTANCE
                ? HIGHLIGHT_ARM_REACH * 0.36
                : 0
        const startSide = splitSpread > 0 ? 1 : -1
        const endSide = splitSpread > 0 ? -1 : 1

        items.push({
            id: 'track-start',
            title: 'Track',
            value: '🚩 Start',
            accent: '#22c55e',
            glow: '#86efac',
            distanceM: 0,
            totalDistanceM: preparedTrack.totalDistanceM,
            position: startPoint,
            armOffset: buildArmOffset(startDirection, startSide, splitSpread),
        })

        items.push({
            id: 'track-end',
            title: 'Track',
            value: '🏁 End',
            accent: '#3b82f6',
            glow: '#93c5fd',
            distanceM: preparedTrack.totalDistanceM,
            totalDistanceM: preparedTrack.totalDistanceM,
            position: endPoint,
            armOffset: buildArmOffset(endDirection, endSide, splitSpread),
        })

        if (highestPoint) {
            items.push({
                id: 'track-highest',
                title: '⛰️ High Point',
                value: `${preparedTrack.stats.highestElevationM} m`,
                accent: '#f59e0b',
                glow: '#fcd34d',
                distanceM:
                    preparedTrack.points[preparedTrack.highestPreparedIndex]
                        ?.distanceFromStartM ?? 0,
                totalDistanceM: preparedTrack.totalDistanceM,
                position: highestPoint,
                armOffset: buildArmOffset(
                    buildLateralDirection(
                        smoothedPath,
                        preparedTrack.highestPreparedIndex,
                        1
                    ),
                    1
                ),
            })
        }

        if (fastestPoint && preparedTrack.stats.maxSpeedKmh !== null) {
            items.push({
                id: 'track-fastest',
                title: 'Top Speed',
                value: `⚡ ${preparedTrack.stats.maxSpeedKmh.toFixed(1)} km/h`,
                accent: `${getTrackColorForSpeed(preparedTrack.stats.maxSpeedKmh, preparedTrack.stats.maxSpeedKmh).getStyle()}`,
                glow: 'rgba(252, 165, 165, 0.8)',
                distanceM:
                    preparedTrack.points[
                        preparedTrack.fastestPreparedIndex ?? 0
                    ]?.distanceFromStartM ?? 0,
                totalDistanceM: preparedTrack.totalDistanceM,
                position: fastestPoint,
                armOffset: buildArmOffset(
                    buildLateralDirection(
                        smoothedPath,
                        preparedTrack.fastestPreparedIndex ?? 0,
                        -1
                    ),
                    -1
                ),
            })
        }

        return items
    }, [
        preparedTrack.fastestPreparedIndex,
        preparedTrack.highestPreparedIndex,
        preparedTrack.points,
        preparedTrack.stats.highestElevationM,
        preparedTrack.stats.maxSpeedKmh,
        preparedTrack.totalDistanceM,
        smoothedPath,
    ])

    useEffect(() => {
        if (curve && samplingComplete) {
            curveRef.current = curve
            onReadyChange(true)
            return
        }

        curveRef.current = null
        onReadyChange(false)
    }, [curve, curveRef, onReadyChange, samplingComplete])

    if (!curve || smoothedPath.length < 2) {
        return null
    }

    return (
        <group>
            <DroneShape preparedTrack={preparedTrack} />

            <mesh geometry={geometry}>
                <meshStandardMaterial
                    color="#ffffff"
                    vertexColors
                    roughness={0.7}
                    metalness={0.1}
                />
            </mesh>

            {highlights.map((highlight) => (
                <TrackHighlight key={highlight.id} {...highlight} />
            ))}
        </group>
    )
}

function DroneShape({ preparedTrack }: { preparedTrack: PreparedTrackData }) {
    const { curveRef, progressRef } = useDroneFlight()
    const droneRef = useRef<Mesh>(null)
    const materialRef = useRef<MeshStandardMaterial>(null)
    const colorRef = useRef(new Color())

    useFrame(() => {
        if (!droneRef.current || !curveRef.current) {
            return
        }

        curveRef.current.getPointAt(
            progressRef.current,
            droneRef.current.position
        )
        droneRef.current.position.y += 3

        if (materialRef.current) {
            const currentDistanceM =
                preparedTrack.totalDistanceM * progressRef.current
            const currentSpeedKmh = interpolateSmoothedSpeedAtDistance(
                preparedTrack.points,
                currentDistanceM
            )

            colorRef.current.copy(
                getTrackColorForSpeed(
                    currentSpeedKmh,
                    preparedTrack.stats.maxSpeedKmh
                )
            )
            materialRef.current.color.copy(colorRef.current)
            materialRef.current.emissive.copy(colorRef.current)
        }
    })

    return (
        <mesh ref={droneRef}>
            <cylinderGeometry args={[14, 14, 24, 24]} />
            <meshStandardMaterial
                ref={materialRef}
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={0.12}
                roughness={0.55}
                metalness={0.08}
            />
        </mesh>
    )
}
