import type { PreparedTrackPoint } from './trackPreparation'

export interface TrackProfileSampleInput {
    ele: number
    distanceFromStartM: number
}

export interface TrackProfileMetrics {
    smoothedElevationsM: number[]
    inclinePercents: number[]
}

export interface TrackSpeedMetrics {
    smoothedSpeedsKmh: number[]
}

export interface TelemetryWindowSample {
    distanceM: number
    elevationM: number
}

export interface TelemetryWindow {
    samples: TelemetryWindowSample[]
    minElevationM: number
    maxElevationM: number
    startDistanceM: number
    endDistanceM: number
}

const MIN_GRADE_DISTANCE_M = 5
const MAX_GRADE_PERCENT = 45

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function lerp(start: number, end: number, t: number) {
    return start + (end - start) * t
}

function niceStep(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
        return 1
    }

    const exponent = Math.floor(Math.log10(value))
    const fraction = value / 10 ** exponent

    if (fraction <= 1) return 1 * 10 ** exponent
    if (fraction <= 2) return 2 * 10 ** exponent
    if (fraction <= 5) return 5 * 10 ** exponent
    return 10 * 10 ** exponent
}

export function computeTrackProfileMetrics(
    samples: TrackProfileSampleInput[]
): TrackProfileMetrics {
    if (samples.length === 0) {
        return {
            smoothedElevationsM: [],
            inclinePercents: [],
        }
    }

    const smoothedElevationsM = samples.map((sample, index) => {
        const previous = samples[index - 1]?.ele ?? sample.ele
        const current = sample.ele
        const next = samples[index + 1]?.ele ?? sample.ele

        return (previous + current * 2 + next) / 4
    })

    const inclinePercents = samples.map((_, index) => {
        const previousIndex = Math.max(0, index - 1)
        const nextIndex = Math.min(samples.length - 1, index + 1)
        const distanceDelta =
            samples[nextIndex].distanceFromStartM -
            samples[previousIndex].distanceFromStartM

        if (distanceDelta < MIN_GRADE_DISTANCE_M) {
            return 0
        }

        const elevationDelta =
            smoothedElevationsM[nextIndex] - smoothedElevationsM[previousIndex]

        return clamp(
            (elevationDelta / distanceDelta) * 100,
            -MAX_GRADE_PERCENT,
            MAX_GRADE_PERCENT
        )
    })

    return {
        smoothedElevationsM,
        inclinePercents,
    }
}

export function computeTrackSpeedMetrics(
    speedsKmh: number[]
): TrackSpeedMetrics {
    if (speedsKmh.length === 0) {
        return { smoothedSpeedsKmh: [] }
    }

    const smoothedSpeedsKmh = speedsKmh.map((speed, index) => {
        const previous = speedsKmh[index - 1] ?? speed
        const current = speed
        const next = speedsKmh[index + 1] ?? speed

        return (previous + current * 2 + next) / 4
    })

    return { smoothedSpeedsKmh }
}

export function findPreparedPointIndexAtDistance(
    points: PreparedTrackPoint[],
    targetDistanceM: number
) {
    if (points.length === 0) {
        return 0
    }

    let low = 0
    let high = points.length - 1

    while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if (points[mid].distanceFromStartM < targetDistanceM) {
            low = mid + 1
        } else {
            high = mid
        }
    }

    const candidate = low
    const previous = Math.max(0, candidate - 1)
    const previousDistance = Math.abs(
        points[previous].distanceFromStartM - targetDistanceM
    )
    const currentDistance = Math.abs(
        points[candidate].distanceFromStartM - targetDistanceM
    )

    return previousDistance <= currentDistance ? previous : candidate
}

export function interpolateSmoothedElevationAtDistance(
    points: PreparedTrackPoint[],
    targetDistanceM: number
) {
    if (points.length === 0) {
        return 0
    }

    if (targetDistanceM <= points[0].distanceFromStartM) {
        return points[0].smoothedElevationM
    }

    const lastPoint = points[points.length - 1]
    if (targetDistanceM >= lastPoint.distanceFromStartM) {
        return lastPoint.smoothedElevationM
    }

    const nextIndex = findPreparedPointIndexAtDistance(points, targetDistanceM)
    const leftIndex =
        points[nextIndex].distanceFromStartM >= targetDistanceM
            ? Math.max(0, nextIndex - 1)
            : nextIndex
    const rightIndex = Math.min(points.length - 1, leftIndex + 1)
    const leftPoint = points[leftIndex]
    const rightPoint = points[rightIndex]
    const segmentDistance =
        rightPoint.distanceFromStartM - leftPoint.distanceFromStartM

    if (segmentDistance <= 0) {
        return leftPoint.smoothedElevationM
    }

    const t = (targetDistanceM - leftPoint.distanceFromStartM) / segmentDistance

    return lerp(leftPoint.smoothedElevationM, rightPoint.smoothedElevationM, t)
}

export function interpolateSmoothedSpeedAtDistance(
    points: PreparedTrackPoint[],
    targetDistanceM: number
) {
    if (points.length === 0) {
        return 0
    }

    if (targetDistanceM <= points[0].distanceFromStartM) {
        return points[0].smoothedSpeedKmh
    }

    const lastPoint = points[points.length - 1]
    if (targetDistanceM >= lastPoint.distanceFromStartM) {
        return lastPoint.smoothedSpeedKmh
    }

    const nextIndex = findPreparedPointIndexAtDistance(points, targetDistanceM)
    const leftIndex =
        points[nextIndex].distanceFromStartM >= targetDistanceM
            ? Math.max(0, nextIndex - 1)
            : nextIndex
    const rightIndex = Math.min(points.length - 1, leftIndex + 1)
    const leftPoint = points[leftIndex]
    const rightPoint = points[rightIndex]
    const segmentDistance =
        rightPoint.distanceFromStartM - leftPoint.distanceFromStartM

    if (segmentDistance <= 0) {
        return leftPoint.smoothedSpeedKmh
    }

    const t = (targetDistanceM - leftPoint.distanceFromStartM) / segmentDistance

    return lerp(leftPoint.smoothedSpeedKmh, rightPoint.smoothedSpeedKmh, t)
}

export function buildTelemetryWindow(
    points: PreparedTrackPoint[],
    currentDistanceM: number,
    windowRadiusM: number
): TelemetryWindow {
    if (points.length === 0) {
        return {
            samples: [],
            minElevationM: 0,
            maxElevationM: 0,
            startDistanceM: 0,
            endDistanceM: 0,
        }
    }

    const trackStartM = points[0].distanceFromStartM
    const trackEndM = points[points.length - 1].distanceFromStartM
    const startDistanceM = Math.max(
        trackStartM,
        currentDistanceM - windowRadiusM
    )
    const endDistanceM = Math.min(trackEndM, currentDistanceM + windowRadiusM)
    const samples: TelemetryWindowSample[] = [
        {
            distanceM: startDistanceM,
            elevationM: interpolateSmoothedElevationAtDistance(
                points,
                startDistanceM
            ),
        },
    ]

    for (const point of points) {
        if (
            point.distanceFromStartM > startDistanceM &&
            point.distanceFromStartM < endDistanceM
        ) {
            samples.push({
                distanceM: point.distanceFromStartM,
                elevationM: point.smoothedElevationM,
            })
        }
    }

    if (endDistanceM > startDistanceM) {
        samples.push({
            distanceM: endDistanceM,
            elevationM: interpolateSmoothedElevationAtDistance(
                points,
                endDistanceM
            ),
        })
    }

    const uniqueSamples = samples.filter((sample, index, list) => {
        return (
            index === 0 ||
            Math.abs(sample.distanceM - list[index - 1].distanceM) > 0.01
        )
    })

    const elevations = uniqueSamples.map((sample) => sample.elevationM)
    const minElevationM = Math.min(...elevations)
    const maxElevationM = Math.max(...elevations)

    return {
        samples: uniqueSamples,
        minElevationM,
        maxElevationM,
        startDistanceM,
        endDistanceM,
    }
}

export function buildElevationLabels(
    minElevationM: number,
    maxElevationM: number,
    labelCount = 3
) {
    if (labelCount <= 1) {
        return [Math.round(maxElevationM)]
    }

    const rawRange = Math.max(maxElevationM - minElevationM, 1)
    const step = niceStep(rawRange / (labelCount - 1))
    const upper = Math.ceil(maxElevationM / step) * step

    return Array.from({ length: labelCount }, (_, index) => {
        return upper - index * step
    })
}
