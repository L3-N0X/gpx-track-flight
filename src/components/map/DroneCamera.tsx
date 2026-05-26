import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Raycaster, Vector3, type Object3D } from 'three'
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
const CAMERA_COLLISION_STEPS = 14
const CAMERA_MAX_PITCH_RADIANS = (82 * Math.PI) / 180
const CAMERA_COLLISION_PADDING_M = 24
const CAMERA_RAY_START_OFFSET_M = 8
const CAMERA_AVOIDANCE_LERP_UP = 0.32
const CAMERA_AVOIDANCE_LERP_DOWN = 0.07

interface InitialCameraPose {
    position: Vector3
    target: Vector3
}

function applyWorldOffset(position: Vector3, worldOrigin: { x: number; y: number }) {
    position.x -= worldOrigin.x
    position.z += worldOrigin.y
}

function hasTerrainBetweenThumbAndCamera(
    raycaster: Raycaster,
    terrainGroup: Object3D | undefined,
    thumbPosition: Vector3,
    cameraPosition: Vector3,
    direction: Vector3
) {
    if (!terrainGroup) {
        return false
    }

    const distance = cameraPosition.distanceTo(thumbPosition)
    if (distance <= CAMERA_RAY_START_OFFSET_M + CAMERA_COLLISION_PADDING_M) {
        return false
    }

    direction.copy(cameraPosition).sub(thumbPosition).normalize()
    raycaster.near = CAMERA_RAY_START_OFFSET_M
    raycaster.far = distance - CAMERA_COLLISION_PADDING_M
    raycaster.set(thumbPosition, direction)

    return raycaster
        .intersectObject(terrainGroup, true)
        .some((hit) => hit.object.visible)
}

function setCameraPositionAtPitch(
    cameraPosition: Vector3,
    thumbPosition: Vector3,
    horizontalDirection: Vector3,
    pitch: number,
    distance: number
) {
    const horizontalDistance = Math.cos(pitch) * distance

    cameraPosition
        .copy(thumbPosition)
        .addScaledVector(horizontalDirection, horizontalDistance)
    cameraPosition.y += Math.sin(pitch) * distance
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
    const { camera, scene } = useThree()
    const { isPlaying, setIsPlaying, speed, mode, progressRef, curveRef } =
        useDroneFlight()

    const droneWorldPos = useRef(new Vector3())
    const rawTangent = useRef(new Vector3())
    const candidateCameraPos = useRef(new Vector3())
    const cameraToThumb = useRef(new Vector3())
    const horizontalCameraOffset = useRef(new Vector3())
    const rayDirection = useRef(new Vector3())
    const terrainRaycaster = useRef(new Raycaster())
    const smoothedAvoidancePitch = useRef<number | null>(null)
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
    const lastProgressRef = useRef(0)

    const avoidTerrainOcclusion = (cameraPosition: Vector3, delta: number) => {
        cameraToThumb.current.copy(cameraPosition).sub(droneWorldPos.current)
        const distance = cameraToThumb.current.length()
        if (distance <= 1e-6) {
            return
        }

        horizontalCameraOffset.current.set(
            cameraToThumb.current.x,
            0,
            cameraToThumb.current.z
        )
        if (horizontalCameraOffset.current.lengthSq() <= 1e-6) {
            return
        }

        horizontalCameraOffset.current.normalize()

        const startPitch = Math.atan2(
            cameraToThumb.current.y,
            Math.hypot(cameraToThumb.current.x, cameraToThumb.current.z)
        )
        const maxPitch = Math.max(startPitch, CAMERA_MAX_PITCH_RADIANS)
        let targetPitch = startPitch
        const terrainGroup = scene.getObjectByName('TileMapGroup')

        if (
            hasTerrainBetweenThumbAndCamera(
                terrainRaycaster.current,
                terrainGroup,
                droneWorldPos.current,
                cameraPosition,
                rayDirection.current
            )
        ) {
            targetPitch = maxPitch

            for (let step = 1; step <= CAMERA_COLLISION_STEPS; step++) {
                const candidatePitch =
                    startPitch +
                    (maxPitch - startPitch) *
                        (step / CAMERA_COLLISION_STEPS)

                setCameraPositionAtPitch(
                    candidateCameraPos.current,
                    droneWorldPos.current,
                    horizontalCameraOffset.current,
                    candidatePitch,
                    distance
                )

                if (
                    !hasTerrainBetweenThumbAndCamera(
                        terrainRaycaster.current,
                        terrainGroup,
                        droneWorldPos.current,
                        candidateCameraPos.current,
                        rayDirection.current
                    )
                ) {
                    targetPitch = candidatePitch
                    break
                }
            }
        }

        const currentPitch = Math.max(
            smoothedAvoidancePitch.current ?? startPitch,
            startPitch
        )
        const lerpBase =
            targetPitch > currentPitch
                ? CAMERA_AVOIDANCE_LERP_UP
                : CAMERA_AVOIDANCE_LERP_DOWN
        const lerpFactor = 1 - Math.pow(1 - lerpBase, delta * 60)
        const nextPitch = currentPitch + (targetPitch - currentPitch) * lerpFactor

        smoothedAvoidancePitch.current =
            Math.abs(nextPitch - startPitch) < 0.001 ? startPitch : nextPitch

        if (smoothedAvoidancePitch.current > startPitch + 0.001) {
            setCameraPositionAtPitch(
                cameraPosition,
                droneWorldPos.current,
                horizontalCameraOffset.current,
                smoothedAvoidancePitch.current,
                distance
            )
        }
    }

    const updateFlightCameraPose = (t: number, delta: number) => {
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
        avoidTerrainOcclusion(transitionTargetPos.current, delta)
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

        const t = progressRef.current
        const progressChangedManually = !isPlaying && Math.abs(t - lastProgressRef.current) > 1e-5

        if (progressChangedManually) {
            isTransitioning.current = false
            smoothedAvoidancePitch.current = null
            
            const curve = curveRef.current
            curve.getPointAt(t, droneWorldPos.current)
            applyWorldOffset(droneWorldPos.current, worldOrigin)
            
            curve.getTangentAt(t, rawTangent.current)
            smoothBehind.current.copy(rawTangent.current).negate().normalize()
            
            const camX = droneWorldPos.current.x + smoothBehind.current.x * CAM_BEHIND_METERS
            const camY = droneWorldPos.current.y + CAM_ABOVE_METERS
            const camZ = droneWorldPos.current.z + smoothBehind.current.z * CAM_BEHIND_METERS
            
            transitionTargetPos.current.set(camX, camY, camZ)
            avoidTerrainOcclusion(transitionTargetPos.current, 0.016)
            camera.position.copy(transitionTargetPos.current)
            camera.lookAt(droneWorldPos.current)
            
            lastProgressRef.current = t
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
                smoothedAvoidancePitch.current = null
            } else {
                isTransitioning.current = false
            }
        }

        if (!isPlaying) {
            isTransitioning.current = false
            smoothedAvoidancePitch.current = null
            wasPlaying.current = false
            lastProgressRef.current = t
            return
        }

        if (isTransitioning.current) {
            const initialPose = updateFlightCameraPose(0, delta)
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

            lastProgressRef.current = progressRef.current
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

        const nextT = progressRef.current

        curve.getPointAt(nextT, droneWorldPos.current)
        applyWorldOffset(droneWorldPos.current, worldOrigin)
        curve.getTangentAt(nextT, rawTangent.current)
        const lerpFactor = 1 - Math.pow(1 - BEHIND_LERP, delta * 60)
        smoothBehind.current
            .lerp(rawTangent.current.clone().negate(), lerpFactor)
            .normalize()

        const camX =
            droneWorldPos.current.x + smoothBehind.current.x * CAM_BEHIND_METERS
        const camY = droneWorldPos.current.y + CAM_ABOVE_METERS
        const camZ =
            droneWorldPos.current.z + smoothBehind.current.z * CAM_BEHIND_METERS
        transitionTargetPos.current.set(camX, camY, camZ)
        avoidTerrainOcclusion(transitionTargetPos.current, delta)
        camera.position.copy(transitionTargetPos.current)

        camera.lookAt(droneWorldPos.current)
        lastProgressRef.current = progressRef.current
        wasPlaying.current = isPlaying
    })

    return null
}
