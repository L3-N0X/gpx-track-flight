import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Euler, Raycaster, Mesh, type Intersection } from "three";

const MOVEMENT_SPEED = 1000; // Base speed
const BOOST_MULTIPLIER = 10;
const ROTATION_SPEED = 0.003;

export function MapControls() {
  const { camera, gl, scene } = useThree();

  // State references for performance (no re-renders on every frame input change)
  const keys = useRef<{ [key: string]: boolean }>({});
  const isDragging = useRef(false);
  const euler = useRef(new Euler(0, 0, 0, "YXZ"));
  const direction = useRef(new Vector3()); // Reused vector for movement
  const velocity = useRef(new Vector3());
  const raycaster = useRef(new Raycaster());
  const rayOrigin = useRef(new Vector3());
  const downVector = useRef(new Vector3(0, -1, 0));


  useEffect(() => {
    // Initialize euler based on initial camera rotation,
    // looking down 60 degrees by default so the map is instantly visible
    camera.quaternion.setFromEuler(new Euler(-Math.PI / 3, 0, 0, "YXZ"));
    euler.current.setFromQuaternion(camera.quaternion);

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDragging.current = true;
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      euler.current.y -= e.movementX * ROTATION_SPEED;
      euler.current.x -= e.movementY * ROTATION_SPEED;

      // Limit pitch to prevent flipping
      euler.current.x = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, euler.current.x),
      );

      camera.quaternion.setFromEuler(euler.current);
    };

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    gl.domElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);

    // Prevent context menu on right click dragging
    const handleContextMenu = (e: Event) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      gl.domElement.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      gl.domElement.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [camera, gl.domElement]);

  useFrame((_, delta) => {
    // Reset velocity
    velocity.current.set(0, 0, 0);

    // Movement logic
    const speed =
      keys.current["ShiftLeft"] || keys.current["ShiftRight"]
        ? MOVEMENT_SPEED * BOOST_MULTIPLIER
        : MOVEMENT_SPEED;

    // X-axis (left/right)
    if (keys.current["KeyA"]) velocity.current.x -= speed;
    if (keys.current["KeyD"]) velocity.current.x += speed;

    // Z-axis (forward/backward)
    if (keys.current["KeyW"]) velocity.current.z -= speed;
    if (keys.current["KeyS"]) velocity.current.z += speed;

    // Y-axis (up/down)
    if (keys.current["KeyQ"]) velocity.current.y -= speed;
    if (keys.current["KeyE"]) velocity.current.y += speed;

    // Apply movement relative to camera rotation
    direction.current.copy(velocity.current).multiplyScalar(delta);

    camera.translateX(direction.current.x);
    camera.translateY(direction.current.y);
    camera.translateZ(direction.current.z);

    // Collision detection
    const tileMapGroup = scene.getObjectByName("TileMapGroup");
    if (tileMapGroup) {
      // Raycast straight down in world space from a very high altitude
      rayOrigin.current.set(camera.position.x, 100000, camera.position.z);
      raycaster.current.set(rayOrigin.current, downVector.current);

      // Perform a custom brute-force raycast that ignores object.visible
      // because geo-three might be hiding meshes in a weird way
      const allIntersects: Intersection[] = [];
      tileMapGroup.traverse((child) => {
        if ((child as Mesh).isMesh && (child as Mesh).geometry) {
          child.raycast(raycaster.current, allIntersects);
        }
      });

      allIntersects.sort((a, b) => a.distance - b.distance);

      if (allIntersects.length > 0) {
        // Find the first intersection that is actually the terrain
        const terrainWorldY = allIntersects[0].point.y;

        // Add a padding of 50 units above the terrain
        const minHeight = terrainWorldY + 50;

        // Extremely detailed debug log
        // Run once every 60 frames approx to avoid blowing up the console completely, but guarantee it runs.
        if (Math.random() < 0.05) {
          const hitObj = allIntersects[0].object;
          console.log(
            "Cam Y:",
            camera.position.y.toFixed(2),
            "Hit Y World:",
            terrainWorldY.toFixed(2),
            "Hit Obj Name/Type:",
            hitObj.name,
            hitObj.type,
          );
        }

        if (camera.position.y < minHeight) {
          camera.position.setY(minHeight);
        }
      } else {
        if (Math.random() < 0.05) {
          console.log(
            "Raycaster MISSED terrain entirely! Cam Pos:",
            camera.position.clone(),
          );
        }
        // Prevent falling into negative void if no tile is loaded yet
        if (camera.position.y < 20) camera.position.setY(20);
      }
    }
  });

  return null;
}
