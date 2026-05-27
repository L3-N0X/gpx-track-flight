import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown, Gauge } from 'lucide-react'
import type { PreparedTrackData } from '../../lib/trackPreparation'
import { useDroneFlight } from '../../contexts/DroneFlightContext'
import {
    buildElevationLabels,
    buildTelemetryWindow,
    findPreparedPointIndexAtDistance,
    interpolateSmoothedElevationAtDistance,
    interpolateSmoothedSpeedAtDistance,
} from '../../lib/trackTelemetry'

const WINDOW_RADIUS_M = 500
const MIN_ELEVATION_RANGE_M = 120
const CHART_WIDTH = 284
const CHART_HEIGHT = 104
const CHART_PADDING_TOP = 8
const CHART_PADDING_BOTTOM = 14
const LABEL_COUNT = 3

interface ChartPoint {
    x: number
    y: number
}

function formatSignedPercent(value: number) {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function buildSmoothPath(points: ChartPoint[]) {
    if (points.length === 0) {
        return ''
    }

    if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`
    }

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
        const current = points[i]
        const next = points[i + 1]
        const midX = (current.x + next.x) / 2
        const midY = (current.y + next.y) / 2
        path += ` Q ${current.x} ${current.y} ${midX} ${midY}`
    }

    const lastPoint = points[points.length - 1]
    path += ` T ${lastPoint.x} ${lastPoint.y}`

    return path
}

function buildFillPath(points: ChartPoint[]) {
    if (points.length === 0) {
        return ''
    }

    const linePath = buildSmoothPath(points)
    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]

    return `${linePath} L ${lastPoint.x} ${CHART_HEIGHT} L ${firstPoint.x} ${CHART_HEIGHT} Z`
}

export function FlightTelemetryOverlay({
    preparedTrack,
}: {
    preparedTrack: PreparedTrackData
}) {
    const { progressRef } = useDroneFlight()
    const gradientId = useId()
    const [currentDistanceM, setCurrentDistanceM] = useState(0)
    const [isOpen, setIsOpen] = useState(true)

    // Collapse on mobile viewports by default
    useEffect(() => {
        if (window.innerWidth < 768) {
            setIsOpen(false)
        }
    }, [])

    useEffect(() => {
        let animationFrameId = 0

        const updateDistance = () => {
            const nextDistanceM =
                preparedTrack.totalDistanceM * progressRef.current
            setCurrentDistanceM((previousDistanceM) => {
                return Math.abs(previousDistanceM - nextDistanceM) >= 0.5
                    ? nextDistanceM
                    : previousDistanceM
            })
            animationFrameId = requestAnimationFrame(updateDistance)
        }

        updateDistance()

        return () => cancelAnimationFrame(animationFrameId)
    }, [preparedTrack.totalDistanceM, progressRef])

    const currentPointIndex = useMemo(() => {
        return findPreparedPointIndexAtDistance(
            preparedTrack.points,
            currentDistanceM
        )
    }, [currentDistanceM, preparedTrack.points])

    const currentPoint = preparedTrack.points[currentPointIndex]
    const currentSpeedKmh = useMemo(() => {
        return interpolateSmoothedSpeedAtDistance(
            preparedTrack.points,
            currentDistanceM
        )
    }, [currentDistanceM, preparedTrack.points])

    const telemetryWindow = useMemo(() => {
        return buildTelemetryWindow(
            preparedTrack.points,
            currentDistanceM,
            WINDOW_RADIUS_M
        )
    }, [currentDistanceM, preparedTrack.points])

    const actualElevationRange = Math.max(
        telemetryWindow.maxElevationM - telemetryWindow.minElevationM,
        1
    )
    const elevationRange = Math.max(actualElevationRange, MIN_ELEVATION_RANGE_M)
    const elevationMidpoint =
        (telemetryWindow.maxElevationM + telemetryWindow.minElevationM) / 2
    const displayMinElevationM = elevationMidpoint - elevationRange / 2
    const displayMaxElevationM = elevationMidpoint + elevationRange / 2

    const chartPoints = useMemo(() => {
        const domainStart = currentDistanceM - WINDOW_RADIUS_M
        const domainRange = WINDOW_RADIUS_M * 2

        return telemetryWindow.samples.map((sample) => {
            const normalizedX = (sample.distanceM - domainStart) / domainRange
            const normalizedY =
                (sample.elevationM - displayMinElevationM) / elevationRange

            return {
                x: normalizedX * CHART_WIDTH,
                y:
                    CHART_HEIGHT -
                    CHART_PADDING_BOTTOM -
                    normalizedY *
                        (CHART_HEIGHT -
                            CHART_PADDING_TOP -
                            CHART_PADDING_BOTTOM),
            }
        })
    }, [
        currentDistanceM,
        elevationRange,
        displayMinElevationM,
        telemetryWindow.samples,
    ])

    const markerY = useMemo(() => {
        const currentElevationM = interpolateSmoothedElevationAtDistance(
            preparedTrack.points,
            currentDistanceM
        )
        const normalizedY =
            (currentElevationM - displayMinElevationM) / elevationRange

        return (
            CHART_HEIGHT -
            CHART_PADDING_BOTTOM -
            normalizedY *
                (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM)
        )
    }, [
        elevationRange,
        currentDistanceM,
        displayMinElevationM,
        preparedTrack.points,
    ])

    const elevationLabels = useMemo(() => {
        return buildElevationLabels(
            displayMinElevationM,
            displayMaxElevationM,
            LABEL_COUNT
        )
    }, [displayMaxElevationM, displayMinElevationM])

    return (
        <div
            className={`pointer-events-auto absolute right-4 z-20 border border-border bg-background/75 backdrop-blur-md shadow-lg transition-all duration-300 ease-in-out select-none flex flex-col overflow-hidden ${
                isOpen
                    ? 'bottom-14 md:bottom-4 w-[min(88vw,20rem)] h-[184px] p-3 rounded-xl'
                    : 'bottom-4 w-10 h-10 p-0 rounded-lg items-center justify-center cursor-pointer hover:bg-background/95 hover:text-foreground text-muted-foreground'
            }`}
            onClick={!isOpen ? () => setIsOpen(true) : undefined}
        >
            {/* Collapsed Content */}
            <div
                className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                    isOpen ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 scale-100'
                }`}
            >
                <Gauge size={16} className="text-primary" />
            </div>

            {/* Expanded Content */}
            <div
                className={`flex flex-col h-full transition-all duration-300 ${
                    isOpen ? 'opacity-100 scale-100' : 'opacity-0 pointer-events-none scale-90'
                }`}
            >
                {/* Clickable Header to Collapse */}
                <div
                    className="flex items-center justify-between cursor-pointer select-none pb-1.5 mb-2 border-b border-border/40 text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsOpen(false)
                    }}
                >
                    <span className="text-[9px] uppercase tracking-[0.24em] font-bold">Telemetry & Profile</span>
                    <ChevronDown size={14} className="shrink-0" />
                </div>

                <div className="mb-2.5 flex items-end justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                            Current speed
                        </div>
                        <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                            {preparedTrack.stats.avgSpeedKmh === null
                                ? 'N/A'
                                : `${currentSpeedKmh.toFixed(1)} km/h`}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                            Incline
                        </div>
                        <div className="mt-1 text-xl font-semibold tabular-nums text-primary-light">
                            {formatSignedPercent(currentPoint.inclinePercent)}
                        </div>
                    </div>
                </div>

                <div className="relative h-26 rounded-lg px-2 py-1.5">
                    <svg
                        className="absolute inset-0 h-full w-full"
                        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                        preserveAspectRatio="none"
                        aria-label="Local elevation profile"
                        role="img"
                    >
                        <defs>
                            <linearGradient
                                id={gradientId}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor="var(--primary)"
                                    stopOpacity="0.28"
                                />
                                <stop
                                    offset="100%"
                                    stopColor="var(--primary)"
                                    stopOpacity="0"
                                />
                            </linearGradient>
                        </defs>

                        <path
                            d={buildFillPath(chartPoints)}
                            fill={`url(#${gradientId})`}
                        />
                        <path
                            d={buildSmoothPath(chartPoints)}
                            fill="none"
                            stroke="var(--primary)"
                            strokeOpacity="0.95"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle
                            cx={CHART_WIDTH / 2}
                            cy={markerY}
                            r="4"
                            fill="var(--background)"
                            stroke="var(--primary)"
                            strokeWidth="1.5"
                        />
                        <circle
                            cx={CHART_WIDTH / 2}
                            cy={markerY}
                            r="7.5"
                            fill="var(--primary)"
                            fillOpacity="0.12"
                        />
                    </svg>

                    <div className="absolute inset-y-0 right-2 flex flex-col justify-between py-1 text-right text-[10px] font-medium tabular-nums text-muted-foreground">
                        {elevationLabels.map((label) => (
                            <span key={label}>{`${label} m`}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
