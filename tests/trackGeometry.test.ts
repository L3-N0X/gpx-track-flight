import { describe, expect, test } from 'bun:test'
import { Vector3 } from 'three'
import { buildSegmentedTrackGeometry } from '../src/lib/trackGeometry'

describe('buildSegmentedTrackGeometry', () => {
    test('creates deterministic vertex and color buffers', () => {
        const geometry = buildSegmentedTrackGeometry({
            pathPoints: [
                new Vector3(0, 0, 0),
                new Vector3(100, 0, 0),
                new Vector3(200, 0, 0),
            ],
            segmentSpeeds: [10, 20],
            cumulativeDistancesM: [0, 100, 200],
            totalDistanceM: 200,
            radius: 8,
            radialSegments: 12,
            sampleSegments: 2,
            maxSpeedKmh: 20,
            useSpeedColors: true,
        })

        const position = geometry.getAttribute('position')
        const color = geometry.getAttribute('color')

        expect(position.count).toBe(2 * 12 * 4)
        expect(color.count).toBe(position.count)
        expect(geometry.index?.count).toBe(2 * 12 * 6)
    })

    test('still emits a color buffer for neutral fallback rendering', () => {
        const geometry = buildSegmentedTrackGeometry({
            pathPoints: [new Vector3(0, 0, 0), new Vector3(50, 0, 0)],
            segmentSpeeds: [0],
            cumulativeDistancesM: [0, 50],
            totalDistanceM: 50,
            radius: 8,
            radialSegments: 8,
            sampleSegments: 1,
            maxSpeedKmh: null,
            useSpeedColors: false,
        })

        expect(geometry.getAttribute('color').count).toBeGreaterThan(0)
    })
})
