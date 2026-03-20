import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Mesh, Vector3 } from 'three'
import { useDroneFlight } from '../../contexts/DroneFlightContext'
import {
    applySampledTrackHeight,
    sampleTrackElevations,
} from '../../lib/demSampling'
import { buildSegmentedTrackGeometry } from '../../lib/trackGeometry'
import type {
    PreparedTrackData,
    PreparedTrackPoint,
} from '../../lib/trackPreparation'

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

interface SnappedTrackPoint extends PreparedTrackPoint {
    resolved: boolean
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

    const highestPoint = smoothedPath[preparedTrack.highestPreparedIndex]
    const fastestPoint =
        preparedTrack.fastestPreparedIndex !== null
            ? smoothedPath[preparedTrack.fastestPreparedIndex]
            : null

    return (
        <group>
            <DroneShape />

            <mesh geometry={geometry}>
                <meshStandardMaterial
                    color="#ffffff"
                    vertexColors
                    roughness={0.7}
                    metalness={0.1}
                />
            </mesh>

            {highestPoint && (
                <group
                    position={[
                        highestPoint.x,
                        highestPoint.y + 100,
                        highestPoint.z,
                    ]}
                >
                    <mesh position={[0, -50, 0]}>
                        <cylinderGeometry args={[2, 2, 100]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    <Html center className="pointer-events-none">
                        <div className="flex flex-col items-center drop-shadow-md">
                            <div className="bg-slate-900/80 font-bold text-white px-2 py-1 rounded border border-white/20 whitespace-nowrap mb-1">
                                ⛰️ {preparedTrack.stats.highestElevationM}m
                            </div>
                            <div className="w-3 h-3 bg-white rounded-full border-2 border-slate-500"></div>
                        </div>
                    </Html>
                </group>
            )}

            {fastestPoint && preparedTrack.stats.maxSpeedKmh !== null && (
                <group
                    position={[
                        fastestPoint.x,
                        fastestPoint.y + 100,
                        fastestPoint.z,
                    ]}
                >
                    <mesh position={[0, -50, 0]}>
                        <cylinderGeometry args={[2, 2, 100]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    <Html center className="pointer-events-none">
                        <div className="flex flex-col items-center drop-shadow-md">
                            <div className="bg-slate-900/80 font-bold text-white px-2 py-1 rounded border border-white/20 whitespace-nowrap mb-1">
                                🚀 {preparedTrack.stats.maxSpeedKmh.toFixed(1)}{' '}
                                km/h
                            </div>
                            <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                        </div>
                    </Html>
                </group>
            )}
        </group>
    )
}

function DroneShape() {
    const { curveRef, progressRef } = useDroneFlight()
    const droneRef = useRef<Mesh>(null)

    useFrame(() => {
        if (!droneRef.current || !curveRef.current) {
            return
        }

        curveRef.current.getPointAt(
            progressRef.current,
            droneRef.current.position
        )
    })

    return (
        <mesh ref={droneRef}>
            <sphereGeometry args={[20, 16, 16]} />
            <meshStandardMaterial
                color="#ffffff"
                emissive="#ff0000"
                emissiveIntensity={0.8}
            />
        </mesh>
    )
}
