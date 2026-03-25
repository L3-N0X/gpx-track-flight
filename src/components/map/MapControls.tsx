import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Euler } from 'three'

const MOVEMENT_SPEED = 1000 // Base speed
const BOOST_MULTIPLIER = 10
const ROTATION_SPEED = 0.003

export function MapControls({
    cameraSyncToken = 0,
}: {
    cameraSyncToken?: number
}) {
    const { camera, gl } = useThree()

    // State references for performance (no re-renders on every frame input change)
    const keys = useRef<{ [key: string]: boolean }>({})
    const isDragging = useRef(false)
    const euler = useRef(new Euler(0, 0, 0, 'YXZ'))
    const direction = useRef(new Vector3()) // Reused vector for movement
    const velocity = useRef(new Vector3())

    useEffect(() => {
        // Inherit the camera pose that was computed during scene setup.
        euler.current.setFromQuaternion(camera.quaternion)
    }, [camera, cameraSyncToken])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keys.current[e.code] = true
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            keys.current[e.code] = false
        }

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0 || e.button === 2) {
                isDragging.current = true
            }
        }

        const handleMouseUp = () => {
            isDragging.current = false
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return

            euler.current.y -= e.movementX * ROTATION_SPEED
            euler.current.x -= e.movementY * ROTATION_SPEED

            // Limit pitch to prevent flipping
            euler.current.x = Math.max(
                -Math.PI / 2 + 0.01,
                Math.min(Math.PI / 2 - 0.01, euler.current.x)
            )

            camera.quaternion.setFromEuler(euler.current)
        }

        // Add event listeners
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        gl.domElement.addEventListener('mousedown', handleMouseDown)
        window.addEventListener('mouseup', handleMouseUp)
        window.addEventListener('mousemove', handleMouseMove)

        // Prevent context menu on right click dragging
        const handleContextMenu = (e: Event) => e.preventDefault()
        gl.domElement.addEventListener('contextmenu', handleContextMenu)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            gl.domElement.removeEventListener('mousedown', handleMouseDown)
            window.removeEventListener('mouseup', handleMouseUp)
            window.removeEventListener('mousemove', handleMouseMove)
            gl.domElement.removeEventListener('contextmenu', handleContextMenu)
        }
    }, [camera, gl.domElement])

    useFrame((_, delta) => {
        // Reset velocity
        velocity.current.set(0, 0, 0)

        // Movement logic
        const speed =
            keys.current['ShiftLeft'] || keys.current['ShiftRight']
                ? MOVEMENT_SPEED * BOOST_MULTIPLIER
                : MOVEMENT_SPEED

        // X-axis (left/right)
        if (keys.current['KeyA']) velocity.current.x -= speed
        if (keys.current['KeyD']) velocity.current.x += speed

        // Z-axis (forward/backward)
        if (keys.current['KeyW']) velocity.current.z -= speed
        if (keys.current['KeyS']) velocity.current.z += speed

        // Y-axis (up/down)
        if (keys.current['KeyQ']) velocity.current.y -= speed
        if (keys.current['KeyE']) velocity.current.y += speed

        // Apply movement relative to camera rotation
        direction.current.copy(velocity.current).multiplyScalar(delta)

        camera.translateX(direction.current.x)
        camera.translateY(direction.current.y)
        camera.translateZ(direction.current.z)

        if (camera.position.y < 20) {
            camera.position.setY(20)
        }
    })

    return null
}
