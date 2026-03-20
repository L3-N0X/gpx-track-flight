import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useDroneFlight } from '../../contexts/DroneFlightContext'
import { INITIAL_COORDS } from '../../lib/constants'

// Distance behind the drone the camera hovers (meters along the track tangent)
const CAM_BEHIND_METERS = 600
// Height above the drone the camera hovers
const CAM_ABOVE_METERS = 250
// How fast the camera swings around corners (lower = smoother, higher = snappier)
// This smooths the "behind direction" so there's no lateral shake on curves
const BEHIND_LERP = 0.04

export function DroneCamera() {
    const { camera } = useThree()
    const { isPlaying, speed, progressRef, curveRef } = useDroneFlight()

    const droneWorldPos = useRef(new Vector3())
    const rawTangent = useRef(new Vector3())
    // Smoothed "behind" direction — this is the key to jitter-free cornering.
    // Instead of snapping the camera directly behind the drone each frame (which
    // oscillates left/right as the tangent wiggles), we lerp this direction
    // gradually, so the camera glides around corners.
    const smoothBehind = useRef(new Vector3(0, 0, 1)) // arbitrary initial dir

    useFrame((_, delta) => {
        if (!isPlaying || !curveRef.current) return

        const curve = curveRef.current
        const curveLength = curve.getLength()

        // Advance progress along the track
        progressRef.current += (delta * speed * 200) / curveLength
        if (progressRef.current >= 1) {
            progressRef.current = 0 // loop
        }

        const t = progressRef.current

        // --- Drone world position (local → world) ---
        curve.getPointAt(t, droneWorldPos.current)
        droneWorldPos.current.x -= INITIAL_COORDS.x
        droneWorldPos.current.z += INITIAL_COORDS.y

        // --- Raw tangent (forward-facing, no axis corrections needed for a pure translation group) ---
        curve.getTangentAt(t, rawTangent.current)

        // Desired "behind" direction = opposite of forward tangent
        // Lerp toward it — this is what eliminates lateral shake:
        // the behind-dir glides smoothly around corners instead of snapping.
        // Lerp factor takes delta into account to be frame-rate independent.
        const lerpFactor = 1 - Math.pow(1 - BEHIND_LERP, delta * 60)
        smoothBehind.current
            .lerp(rawTangent.current.clone().negate(), lerpFactor)
            .normalize() // normalize so distance stays constant regardless of lerp magnitude

        // --- Camera position: behind + above, using smoothed direction ---
        // Constant distance every frame because we normalize smoothBehind.
        const camX =
            droneWorldPos.current.x + smoothBehind.current.x * CAM_BEHIND_METERS
        const camY = droneWorldPos.current.y + CAM_ABOVE_METERS
        const camZ =
            droneWorldPos.current.z + smoothBehind.current.z * CAM_BEHIND_METERS
        camera.position.set(camX, camY, camZ)

        // --- Always look directly at the drone —
        // No rotation slerp needed: since the camera position is already smoothed
        // by the BEHIND_LERP, the look direction changes smoothly automatically.
        // Using direct lookAt guarantees the drone is ALWAYS centered in the frame.
        camera.lookAt(droneWorldPos.current)
    })

    return null
}
