import { useMemo, useRef, useEffect, useState } from 'react'
import type { GpxPoint } from '../../lib/gpxParser'

interface ElevationProfileProps {
    points: GpxPoint[]
    smoothedElevations: number[]
    hoveredIndex: number | null
    onHoverPoint: (index: number | null) => void
}

function haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000 // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getGradeColor(grade: number): string {
    if (grade >= 15) {
        return 'oklch(0.55 0.22 20)' // Deep, vibrant red for steep climbs
    }
    if (grade <= -15) {
        return 'oklch(0.58 0.16 235)' // Deep blue/teal for steep descents
    }

    if (grade > 0) {
        // Climb: interpolate green (135) to deep red (20)
        const ratio = grade / 15
        const lightness = 0.62 - ratio * 0.07
        const chroma = 0.11 + ratio * 0.11
        const hue = 135 - ratio * 115
        return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`
    } else {
        // Descent: interpolate green (135) to blue/teal (235)
        const ratio = Math.abs(grade) / 15
        const lightness = 0.62 - ratio * 0.04
        const chroma = 0.11 + ratio * 0.05
        const hue = 135 + ratio * 100
        return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`
    }
}

export function ElevationProfile({
    points,
    smoothedElevations,
    hoveredIndex,
    onHoverPoint,
}: ElevationProfileProps) {
    const svgRef = useRef<SVGSVGElement>(null)
    const [width, setWidth] = useState(600)
    const height = 180

    // Measure element size dynamically
    useEffect(() => {
        if (!svgRef.current) return
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width)
            }
        })
        resizeObserver.observe(svgRef.current)
        return () => resizeObserver.disconnect()
    }, [])

    // Margins inside SVG (reduced padding)
    const padding = { top: 10, right: 10, bottom: 20, left: 35 }

    // Precompute cumulative distance and elevations
    const data = useMemo(() => {
        if (points.length === 0) return []
        let currentDist = 0
        const result = [
            {
                distanceKm: 0,
                ele: smoothedElevations[0] || points[0].ele,
                index: 0,
            },
        ]

        for (let i = 1; i < points.length; i++) {
            const d = haversine(
                points[i - 1].lat,
                points[i - 1].lon,
                points[i].lat,
                points[i].lon
            )
            currentDist += d / 1000
            result.push({
                distanceKm: currentDist,
                ele: smoothedElevations[i] || points[i].ele,
                index: i,
            })
        }
        return result
    }, [points, smoothedElevations])

    const totalDistance = data[data.length - 1]?.distanceKm || 0

    // Find min and max elevations
    const { minEle, maxEle } = useMemo(() => {
        if (data.length === 0) return { minEle: 0, maxEle: 100 }
        let min = Infinity
        let max = -Infinity
        for (const item of data) {
            if (item.ele < min) min = item.ele
            if (item.ele > max) max = item.ele
        }
        // Add a bit of padding to the top and bottom of Y axis
        const diff = max - min
        const buffer = diff * 0.1 || 20
        return {
            minEle: Math.max(0, Math.floor(min - buffer)),
            maxEle: Math.ceil(max + buffer),
        }
    }, [data])

    // Scale mappings
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    const getX = (distKm: number) => {
        if (totalDistance === 0) return padding.left
        return padding.left + (distKm / totalDistance) * plotWidth
    }

    const getY = (eleM: number) => {
        const range = maxEle - minEle
        if (range === 0) return padding.top + plotHeight / 2
        return padding.top + plotHeight - ((eleM - minEle) / range) * plotHeight
    }

    // Path generators
    const { areaPath, linePath } = useMemo(() => {
        if (data.length === 0) return { areaPath: '', linePath: '' }

        let pathStr = ''
        data.forEach((item, idx) => {
            const x = getX(item.distanceKm)
            const y = getY(item.ele)
            if (idx === 0) {
                pathStr += `M ${x} ${y}`
            } else {
                pathStr += ` L ${x} ${y}`
            }
        })

        const line = pathStr
        const area = `${pathStr} L ${getX(totalDistance)} ${height - padding.bottom} L ${getX(0)} ${height - padding.bottom} Z`
        return { areaPath: area, linePath: line }
    }, [data, width, minEle, maxEle])

    // Hover detection logic
    const handleMouseMove = (
        e: React.MouseEvent<SVGSVGElement, MouseEvent>
    ) => {
        if (data.length === 0 || !svgRef.current) return

        const rect = svgRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left - padding.left

        if (mouseX < 0 || mouseX > plotWidth) {
            onHoverPoint(null)
            return
        }

        const targetDist = (mouseX / plotWidth) * totalDistance

        // Binary search to find closest point by distance
        let low = 0
        let high = data.length - 1
        let closestIdx = 0
        let minDiff = Infinity

        while (low <= high) {
            const mid = Math.floor((low + high) / 2)
            const diff = Math.abs(data[mid].distanceKm - targetDist)

            if (diff < minDiff) {
                minDiff = diff
                closestIdx = mid
            }

            if (data[mid].distanceKm < targetDist) {
                low = mid + 1
            } else {
                high = mid - 1
            }
        }

        onHoverPoint(data[closestIdx].index)
    }

    const handleMouseLeave = () => {
        onHoverPoint(null)
    }

    // Compute ticks for Y axis
    const yTicks = useMemo(() => {
        const ticks = []
        const step = Math.max(10, Math.round((maxEle - minEle) / 4))
        const start = Math.ceil(minEle / step) * step
        for (let t = start; t <= maxEle; t += step) {
            ticks.push(t)
        }
        return ticks
    }, [minEle, maxEle])

    // Compute ticks for X axis
    const xTicks = useMemo(() => {
        const ticks = []
        const step = Math.max(1, Math.round(totalDistance / 5))
        for (let t = 0; t <= totalDistance; t += step) {
            ticks.push(t)
        }
        // Ensure last tick matches total distance if not close
        if (totalDistance - (ticks[ticks.length - 1] || 0) > step / 2) {
            ticks.push(Math.round(totalDistance))
        }
        return ticks
    }, [totalDistance])

    // Hovered point metrics
    const hoveredPoint =
        hoveredIndex !== null && data[hoveredIndex] ? data[hoveredIndex] : null

    // Compute dynamic gradient profile (e.g. color coding steep climbs)
    const activeGradient = useMemo(() => {
        if (!hoveredPoint || hoveredIndex === null || hoveredIndex === 0)
            return null
        const prev = data[hoveredIndex - 1] || hoveredPoint
        const dEle = hoveredPoint.ele - prev.ele
        const dDist = (hoveredPoint.distanceKm - prev.distanceKm) * 1000 // meters
        if (dDist < 1.0) return 0
        return (dEle / dDist) * 100
    }, [hoveredPoint, hoveredIndex, data])

    // Compute dynamic gradient color stops along the route
    const gradientStops = useMemo(() => {
        if (data.length === 0) return []

        // Target around 80 stops to keep SVG rendering performant and smooth
        const targetStopsCount = Math.min(80, data.length)
        const step = Math.max(1, Math.floor(data.length / targetStopsCount))

        const stops = []
        for (let i = 0; i < data.length; i += step) {
            const item = data[i]
            // Smooth gradient calculation using windowing to minimize GPS noise
            const prevIndex = Math.max(0, i - 2)
            const nextIndex = Math.min(data.length - 1, i + 2)
            const p1 = data[prevIndex]
            const p2 = data[nextIndex]

            let grade = 0
            if (p2.distanceKm > p1.distanceKm) {
                const dEle = p2.ele - p1.ele
                const dDist = (p2.distanceKm - p1.distanceKm) * 1000
                grade = (dEle / dDist) * 100
            }

            const offsetPct =
                totalDistance > 0 ? (item.distanceKm / totalDistance) * 100 : 0
            stops.push({
                offset: `${offsetPct.toFixed(1)}%`,
                color: getGradeColor(grade),
            })
        }

        // Ensure last stop is present at 100%
        if (
            stops.length > 0 &&
            parseFloat(stops[stops.length - 1].offset) < 99.5
        ) {
            stops.push({
                offset: '100%',
                color: stops[stops.length - 1].color,
            })
        }

        return stops
    }, [data, totalDistance])

    return (
        <div className="flex flex-col gap-2 py-3 px-4 bg-card/40 backdrop-blur-md border border-border/50 rounded-2xl w-full">
            <div className="flex justify-between items-center select-none">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Elevation Profile
                </h4>
                {hoveredPoint && (
                    <div className="flex gap-4 text-xs font-semibold">
                        <span className="text-muted-foreground">
                            Distance:{' '}
                            <span className="text-foreground tabular-nums">
                                {hoveredPoint.distanceKm.toFixed(2)} km
                            </span>
                        </span>
                        <span className="text-muted-foreground">
                            Elevation:{' '}
                            <span className="text-foreground tabular-nums">
                                {Math.round(hoveredPoint.ele)} m
                            </span>
                        </span>
                        {activeGradient !== null && (
                            <span className="text-muted-foreground">
                                Grade:{' '}
                                <span
                                    className={`tabular-nums ${
                                        activeGradient > 5
                                            ? 'text-destructive font-bold'
                                            : activeGradient < -5
                                              ? 'text-primary font-bold'
                                              : 'text-foreground'
                                    }`}
                                >
                                    {activeGradient > 0 ? '+' : ''}
                                    {activeGradient.toFixed(1)}%
                                </span>
                            </span>
                        )}
                    </div>
                )}
            </div>

            <svg
                ref={svgRef}
                width="100%"
                height={height}
                className="overflow-visible select-none cursor-crosshair mt-1"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <defs>
                    <linearGradient
                        id="elevation-line-gradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                    >
                        {gradientStops.map((stop, idx) => (
                            <stop
                                key={idx}
                                offset={stop.offset}
                                stopColor={stop.color}
                            />
                        ))}
                    </linearGradient>
                    <linearGradient
                        id="elevation-area-gradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                    >
                        {gradientStops.map((stop, idx) => (
                            <stop
                                key={idx}
                                offset={stop.offset}
                                stopColor={stop.color}
                                stopOpacity={0.15}
                            />
                        ))}
                    </linearGradient>
                </defs>

                {/* Y Axis Gridlines & Labels */}
                {yTicks.map((tick) => {
                    const y = getY(tick)
                    return (
                        <g
                            key={`y-${tick}`}
                            className="opacity-40 transition-opacity hover:opacity-80"
                        >
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={width - padding.right}
                                y2={y}
                                stroke="var(--border)"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                            />
                            <text
                                x={padding.left - 10}
                                y={y + 3}
                                textAnchor="end"
                                className="text-[10px] fill-muted-foreground font-medium tabular-nums"
                            >
                                {tick}m
                            </text>
                        </g>
                    )
                })}

                {/* X Axis Gridlines & Labels */}
                {xTicks.map((tick) => {
                    const x = getX(tick)
                    return (
                        <g key={`x-${tick}`} className="opacity-40">
                            <line
                                x1={x}
                                y1={padding.top}
                                x2={x}
                                y2={height - padding.bottom}
                                stroke="var(--border)"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                            />
                            <text
                                x={x}
                                y={height - padding.bottom + 15}
                                textAnchor="middle"
                                className="text-[10px] fill-muted-foreground font-medium tabular-nums"
                            >
                                {tick.toFixed(0)} km
                            </text>
                        </g>
                    )
                })}

                {/* Main Elevation Area Fill */}
                <path
                    d={areaPath}
                    fill="url(#elevation-area-gradient)"
                    className="transition-all duration-300"
                />

                {/* Elevation Line Trace */}
                <path
                    d={linePath}
                    fill="none"
                    stroke="url(#elevation-line-gradient)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                />

                {/* Active Hover Line and Marker */}
                {hoveredPoint && (
                    <g>
                        {/* Hover vertical line */}
                        <line
                            x1={getX(hoveredPoint.distanceKm)}
                            y1={padding.top}
                            x2={getX(hoveredPoint.distanceKm)}
                            y2={height - padding.bottom}
                            stroke="oklch(0.73 0.08 65)"
                            strokeWidth={1.5}
                            strokeDasharray="2 2"
                        />
                        {/* Hover circle marker */}
                        <circle
                            cx={getX(hoveredPoint.distanceKm)}
                            cy={getY(hoveredPoint.ele)}
                            r={6}
                            fill="oklch(0.73 0.08 65)"
                            stroke="white"
                            strokeWidth={2}
                            className="shadow-lg filter drop-shadow-md animate-pulse"
                        />
                    </g>
                )}
            </svg>
        </div>
    )
}
