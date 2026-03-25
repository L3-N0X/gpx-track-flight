import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useDroneFlight } from '../../contexts/DroneFlightContext'
import type { PreparedTrackData } from '../../lib/trackPreparation'
import { interpolateSmoothedSpeedAtDistance } from '../../lib/trackTelemetry'

// Distance behind the drone the camera hovers (meters along the track tangent)
const CAM_BEHIND_METERS = 600
// Height above the drone the camera hovers
const CAM_ABOVE_METERS = 250
// How fast the camera swings around corners (lower = smoother, higher = snappier)
// This smooths the "behind direction" so there's no lateral shake on curves
const BEHIND_LERP = 0.04
const MIN_TRACK_FLIGHT_SPEED_KMH = 5
const FLIGHT_START_TRANSITION_SECONDS = 1.6

interface InitialCameraPose {
    position: Vector3
    target: Vector3
}

function applyWorldOffset(position: Vector3, worldOrigin: { x: number; y: number }) {
    position.x -= worldOrigin.x
    position.z += worldOrigin.y
}

export function DroneCamera({
    preparedTrack,
    initialCameraPose,
    worldOrigin,
}: {
    preparedTrack: PreparedTrackData | null
    initialCameraPose: InitialCameraPose | null
    worldOrigin: { x: number; y: number }
}) {
    const { camera } = useThree()
    const { isPlaying, setIsPlaying, speed, mode, progressRef, curveRef } =
        useDroneFlight()

    const droneWorldPos = useRef(new Vector3())
    const rawTangent = useRef(new Vector3())
    const transitionStartPos = useRef(new Vector3())
    const transitionStartTarget = useRef(new Vector3())
    const transitionTargetPos = useRef(new Vector3())
    const transitionTargetLookAt = useRef(new Vector3())
    const cameraForward = useRef(new Vector3())
    const transitionProgress = useRef(0)
    const isTransitioning = useRef(false)
    const wasPlaying = useRef(false)
    // Smoothed "behind" direction — this is the key to jitter-free cornering.
    // Instead of snapping the camera directly behind the drone each frame (which
    // oscillates left/right as the tangent wiggles), we lerp this direction
    // gradually, so the camera glides around corners.
    const smoothBehind = useRef(new Vector3(0, 0, 1)) // arbitrary initial dir

    const updateFlightCameraPose = (t: number) => {
        const curve = curveRef.current
        if (!curve) {
            return null
        }

        curve.getPointAt(t, droneWorldPos.current)
        applyWorldOffset(droneWorldPos.current, worldOrigin)

        curve.getTangentAt(t, rawTangent.current)

        const lerpFactor = 1 - Math.pow(1 - BEHIND_LERP, 1)
        smoothBehind.current
            .lerp(rawTangent.current.clone().negate(), lerpFactor)
            .normalize()

        transitionTargetPos.current.set(
            droneWorldPos.current.x +
                smoothBehind.current.x * CAM_BEHIND_METERS,
            droneWorldPos.current.y + CAM_ABOVE_METERS,
            droneWorldPos.current.z + smoothBehind.current.z * CAM_BEHIND_METERS
        )
        transitionTargetLookAt.current.copy(droneWorldPos.current)

        return {
            position: transitionTargetPos.current,
            target: transitionTargetLookAt.current,
        }
    }

    useFrame((_, delta) => {
        if (!curveRef.current) {
            wasPlaying.current = isPlaying
            return
        }

        if (isPlaying && !wasPlaying.current) {
            if (progressRef.current <= 0.0001 && initialCameraPose) {
                isTransitioning.current = true
                transitionProgress.current = 0
                transitionStartPos.current.copy(camera.position)
                camera.getWorldDirection(cameraForward.current)
                transitionStartTarget.current
                    .copy(camera.position)
                    .add(cameraForward.current.multiplyScalar(600))
                smoothBehind.current.set(0, 0, 1)
            } else {
                isTransitioning.current = false
            }
        }

        if (!isPlaying) {
            isTransitioning.current = false
            wasPlaying.current = false
            return
        }

        if (isTransitioning.current) {
            const initialPose = updateFlightCameraPose(0)
            if (!initialPose) {
                wasPlaying.current = isPlaying
                return
            }

            transitionProgress.current = Math.min(
                transitionProgress.current +
                    delta / FLIGHT_START_TRANSITION_SECONDS,
                1
            )

            const eased =
                transitionProgress.current *
                transitionProgress.current *
                (3 - 2 * transitionProgress.current)

            camera.position.lerpVectors(
                transitionStartPos.current,
                initialPose.position,
                eased
            )
            transitionTargetPos.current.lerpVectors(
                transitionStartTarget.current,
                initialPose.target,
                eased
            )
            camera.lookAt(transitionTargetPos.current)

            if (transitionProgress.current >= 1) {
                isTransitioning.current = false
            }

            wasPlaying.current = isPlaying
            return
        }

        const curve = curveRef.current
        const curveLength = curve.getLength()
        const flightDistanceM =
            mode === 'track-speed' &&
            preparedTrack &&
            preparedTrack.totalDistanceM > 0
                ? preparedTrack.totalDistanceM
                : curveLength

        const baseTravelSpeedMetersPerSecond =
            mode === 'track-speed' &&
            preparedTrack &&
            preparedTrack.points.length > 0
                ? Math.max(
                      interpolateSmoothedSpeedAtDistance(
                          preparedTrack.points,
                          preparedTrack.totalDistanceM * progressRef.current
                      ),
                      MIN_TRACK_FLIGHT_SPEED_KMH
                  ) / 3.6
                : 200

        // Advance progress along the track
        progressRef.current +=
            (delta * speed * baseTravelSpeedMetersPerSecond) / flightDistanceM
        if (progressRef.current >= 1) {
            progressRef.current = 1
            setIsPlaying(false)
        }

        const t = progressRef.current

        curve.getPointAt(t, droneWorldPos.current)
        applyWorldOffset(droneWorldPos.current, worldOrigin)
        curve.getTangentAt(t, rawTangent.current)
        const lerpFactor = 1 - Math.pow(1 - BEHIND_LERP, delta * 60)
        smoothBehind.current
            .lerp(rawTangent.current.clone().negate(), lerpFactor)
            .normalize()

        const camX =
            droneWorldPos.current.x + smoothBehind.current.x * CAM_BEHIND_METERS
        const camY = droneWorldPos.current.y + CAM_ABOVE_METERS
        const camZ =
            droneWorldPos.current.z + smoothBehind.current.z * CAM_BEHIND_METERS
        camera.position.set(camX, camY, camZ)

        camera.lookAt(droneWorldPos.current)
        wasPlaying.current = isPlaying
    })

    return null
}
