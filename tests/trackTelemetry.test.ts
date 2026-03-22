import { describe, expect, test } from 'bun:test'
import {
    buildElevationLabels,
    buildTelemetryWindow,
    computeTrackProfileMetrics,
    computeTrackSpeedMetrics,
    findPreparedPointIndexAtDistance,
    interpolateSmoothedElevationAtDistance,
    interpolateSmoothedSpeedAtDistance,
} from '../src/lib/trackTelemetry'
import type { PreparedTrackPoint } from '../src/lib/trackPreparation'

const points: PreparedTrackPoint[] = [
    {
        lat: 0,
        lon: 0,
        ele: 100,
        smoothedElevationM: 100,
        inclinePercent: 0,
        mercatorX: 0,
        mercatorY: 0,
        x: 0,
        y: 0,
        z: 0,
        speedKmh: 0,
        smoothedSpeedKmh: 0,
        distanceFromStartM: 0,
        originalIndex: 0,
    },
    {
        lat: 0,
        lon: 0,
        ele: 110,
        smoothedElevationM: 110,
        inclinePercent: 0,
        mercatorX: 0,
        mercatorY: 0,
        x: 0,
        y: 0,
        z: 0,
        speedKmh: 10,
        smoothedSpeedKmh: 10,
        distanceFromStartM: 400,
        originalIndex: 1,
    },
    {
        lat: 0,
        lon: 0,
        ele: 140,
        smoothedElevationM: 140,
        inclinePercent: 0,
        mercatorX: 0,
        mercatorY: 0,
        x: 0,
        y: 0,
        z: 0,
        speedKmh: 20,
        smoothedSpeedKmh: 20,
        distanceFromStartM: 900,
        originalIndex: 2,
    },
    {
        lat: 0,
        lon: 0,
        ele: 120,
        smoothedElevationM: 120,
        inclinePercent: 0,
        mercatorX: 0,
        mercatorY: 0,
        x: 0,
        y: 0,
        z: 0,
        speedKmh: 15,
        smoothedSpeedKmh: 15,
        distanceFromStartM: 1400,
        originalIndex: 3,
    },
]

describe('track telemetry helpers', () => {
    test('computes signed incline percentages from smoothed elevations', () => {
        const metrics = computeTrackProfileMetrics([
            { ele: 100, distanceFromStartM: 0 },
            { ele: 110, distanceFromStartM: 100 },
            { ele: 130, distanceFromStartM: 200 },
            { ele: 100, distanceFromStartM: 300 },
            { ele: 90, distanceFromStartM: 302 },
        ])

        expect(metrics.smoothedElevationsM[1]).toBeGreaterThan(100)
        expect(metrics.inclinePercents[1]).toBeGreaterThan(0)
        expect(metrics.inclinePercents[3]).toBeLessThan(0)
        expect(metrics.inclinePercents[4]).toBe(0)
    })

    test('builds a clipped local telemetry window around the current distance', () => {
        const middleWindow = buildTelemetryWindow(points, 900, 500)

        expect(middleWindow.startDistanceM).toBe(400)
        expect(middleWindow.endDistanceM).toBe(1400)
        expect(middleWindow.samples[0]?.distanceM).toBe(400)
        expect(middleWindow.samples.at(-1)?.distanceM).toBe(1400)

        const edgeWindow = buildTelemetryWindow(points, 150, 500)
        expect(edgeWindow.startDistanceM).toBe(0)
        expect(edgeWindow.endDistanceM).toBe(650)
        expect(edgeWindow.samples[0]?.distanceM).toBe(0)
        expect(edgeWindow.samples.at(-1)?.distanceM).toBe(650)
    })

    test('smooths and interpolates speeds for stable UI playback telemetry', () => {
        const metrics = computeTrackSpeedMetrics([0, 12, 30, 18])

        expect(metrics.smoothedSpeedsKmh[0]).toBe(3)
        expect(metrics.smoothedSpeedsKmh[1]).toBe(13.5)
        expect(metrics.smoothedSpeedsKmh[2]).toBe(22.5)
        expect(metrics.smoothedSpeedsKmh[3]).toBe(21)

        const telemetryPoints = points.map((point, index) => ({
            ...point,
            smoothedSpeedKmh: metrics.smoothedSpeedsKmh[index] ?? 0,
        }))

        expect(interpolateSmoothedSpeedAtDistance(telemetryPoints, 650)).toBe(18)
    })

    test('finds current positions and stable elevation labels', () => {
        expect(findPreparedPointIndexAtDistance(points, 920)).toBe(2)
        expect(findPreparedPointIndexAtDistance(points, 50)).toBe(0)
        expect(interpolateSmoothedElevationAtDistance(points, 650)).toBe(125)

        expect(buildElevationLabels(432, 587, 3)).toEqual([600, 500, 400])
        expect(buildElevationLabels(501, 507, 3)).toEqual([510, 505, 500])
    })
})
