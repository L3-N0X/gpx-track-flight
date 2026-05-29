import { Vector3 } from 'three'
import type { PreparedTrackPoint } from './trackPreparation'

export interface CameraPose {
    position: Vector3
    target: Vector3
}

const INITIAL_CAMERA_BEHIND_METERS = 180
const INITIAL_CAMERA_ABOVE_METERS = 260
const INITIAL_CAMERA_LOOKAHEAD_METERS = 110

export function findLookAheadPoint(
    points: Vector3[] | PreparedTrackPoint[],
    minimumDistanceM: number
): Vector3 | null {
    if (points.length < 2) {
        return null
    }

    const first = points[0]
    const startPoint =
        'x' in first
            ? new Vector3(first.x, first.y, first.z)
            : (first as Vector3)

    for (let i = 1; i < points.length; i++) {
        const p = points[i]
        const currentPoint =
            'x' in p ? new Vector3(p.x, p.y, p.z) : (p as Vector3)
        if (currentPoint.distanceTo(startPoint) >= minimumDistanceM) {
            return currentPoint
        }
    }

    const last = points[points.length - 1]
    return 'x' in last ? new Vector3(last.x, last.y, last.z) : (last as Vector3)
}

export function computeCameraPose(
    points: Vector3[] | PreparedTrackPoint[],
    worldOrigin: { x: number; y: number }
): CameraPose | null {
    if (points.length === 0) {
        return null
    }

    const first = points[0]
    const startPoint =
        'x' in first
            ? new Vector3(first.x, first.y, first.z)
            : (first as Vector3)

    const trackOffset = new Vector3(-worldOrigin.x, 0, worldOrigin.y)
    const startWorld = startPoint.clone().add(trackOffset)

    const aheadPoint =
        findLookAheadPoint(points, INITIAL_CAMERA_LOOKAHEAD_METERS) ??
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
