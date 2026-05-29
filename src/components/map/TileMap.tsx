import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { PlaneGeometry, Box3, Vector3, Frustum, Matrix4, Texture } from 'three'
import { useFrame } from '@react-three/fiber'
import type { PreparedTrackData } from '../../lib/trackPreparation'
import { getTileWidth, getTileLocalBounds } from '../../lib/mapUtils'
import {
    fetchImageryTexture,
    fetchElevationTile,
    clearTileCache,
} from '../../lib/mapTileLoader'
import { buildLocalTerrainBounds, mercatorToTile } from '../../lib/tilePlanning'

// Geometry segments density based on detail level
// Zoom <= 11: 16 segments (coarse detail)
// Zoom 12-13: 24 segments
// Zoom >= 14: 32 segments (high detail)
function getSegmentCount(z: number): number {
    return z <= 11 ? 16 : z <= 13 ? 24 : 32
}

function sampleHeightFromGrid(
    grid: Float32Array,
    u: number,
    v: number
): number {
    const px = u * 255
    const py = v * 255
    const x0 = Math.floor(px)
    const y0 = Math.floor(py)
    const x1 = Math.min(255, x0 + 1)
    const y1 = Math.min(255, y0 + 1)
    const tx = px - x0
    const ty = py - y0

    const h00 = grid[y0 * 256 + x0]
    const h10 = grid[y0 * 256 + x1]
    const h01 = grid[y1 * 256 + x0]
    const h11 = grid[y1 * 256 + x1]

    const top = h00 * (1 - tx) + h10 * tx
    const bottom = h01 * (1 - tx) + h11 * tx
    return top * (1 - ty) + bottom * ty
}

function displaceGeometry(
    geometry: PlaneGeometry,
    elevationGrid: Float32Array,
    z: number,
    width: number
) {
    const positionAttr = geometry.getAttribute('position')
    const uvs = geometry.getAttribute('uv')

    const S = getSegmentCount(z)
    const N = S + 3 // S+2 segments has S+3 vertices along each axis

    // 15 meters vertical skirt to seal gaps
    const skirtDepth = 15
    const heights = new Float32Array(positionAttr.count)

    // First pass: compute horizontal layout and terrain heights
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const idx = r * N + c

            // Map outer skirt vertices (0 and S+2) to the exact boundary of the terrain grid (0 and S)
            const c_snapped = c === 0 ? 0 : c === S + 2 ? S : c - 1
            const r_snapped = r === 0 ? 0 : r === S + 2 ? S : r - 1

            const u = c_snapped / S
            const v = r_snapped / S

            uvs.setXY(idx, u, 1 - v)
            const h = sampleHeightFromGrid(elevationGrid, u, v)
            heights[idx] = h

            const x_local = -width / 2 + u * width
            const z_local = -width / 2 + v * width

            positionAttr.setX(idx, x_local)
            positionAttr.setY(idx, h)
            positionAttr.setZ(idx, z_local)
        }
    }

    uvs.needsUpdate = true
    positionAttr.needsUpdate = true

    // Compute vertex normals on the smooth terrain (before pulling skirt down)
    // This ensures boundary terrain vertex shading is completely unaffected by the vertical skirt.
    geometry.computeVertexNormals()

    // Second pass: pull down boundary vertices vertically and copy boundary normals to skirt vertices
    const normalAttr = geometry.getAttribute('normal')
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const idx = r * N + c

            const isSkirt = r === 0 || r === N - 1 || c === 0 || c === N - 1
            if (isSkirt) {
                // Find corresponding terrain edge vertex height
                const targetR = r === 0 ? 1 : r === N - 1 ? N - 2 : r
                const targetC = c === 0 ? 1 : c === N - 1 ? N - 2 : c
                const targetIdx = targetR * N + targetC

                positionAttr.setY(idx, heights[targetIdx] - skirtDepth)

                // Copy normal from the terrain edge vertex to the skirt vertex to ensure continuous lighting
                if (normalAttr) {
                    const nx = normalAttr.getX(targetIdx)
                    const ny = normalAttr.getY(targetIdx)
                    const nz = normalAttr.getZ(targetIdx)
                    normalAttr.setXYZ(idx, nx, ny, nz)
                }
            }
        }
    }

    positionAttr.needsUpdate = true
    if (normalAttr) {
        normalAttr.needsUpdate = true
    }
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
}

class TileCache {
    public cache = new Map<
        string,
        {
            colorTexture: Texture
            elevationGrid: Float32Array
            lastUsed: number
        }
    >()
    private loadingPromises = new Map<string, Promise<void>>()
    public maxCacheSize = 200

    public get(key: string) {
        const item = this.cache.get(key)
        if (item) {
            item.lastUsed = Date.now()
            return item
        }
        return null
    }

    public isLoaded(key: string): boolean {
        return this.cache.has(key)
    }

    public async load(
        key: string,
        z: number,
        x: number,
        y: number,
        triggerUpdate: () => void
    ): Promise<void> {
        if (this.cache.has(key) || this.loadingPromises.has(key)) return

        const promise = (async () => {
            try {
                const [texture, heightGrid] = await Promise.all([
                    fetchImageryTexture(z, x, y),
                    fetchElevationTile(z, x, y),
                ])

                this.cache.set(key, {
                    colorTexture: texture,
                    elevationGrid: heightGrid,
                    lastUsed: Date.now(),
                })

                triggerUpdate()
            } catch (err) {
                console.error(`Failed to load tile ${key}:`, err)
            } finally {
                this.loadingPromises.delete(key)
            }
        })()

        this.loadingPromises.set(key, promise)
    }

    public cleanUnused(activeKeys: Set<string>) {
        if (this.cache.size <= this.maxCacheSize) return

        const unusedKeys: string[] = []
        for (const key of this.cache.keys()) {
            if (!activeKeys.has(key)) {
                unusedKeys.push(key)
            }
        }

        const overLimit = this.cache.size - this.maxCacheSize
        if (overLimit <= 0) return

        unusedKeys.sort((a, b) => {
            const itemA = this.cache.get(a)!
            const itemB = this.cache.get(b)!
            return itemA.lastUsed - itemB.lastUsed
        })

        const keysToEvict = unusedKeys.slice(0, overLimit)
        for (const key of keysToEvict) {
            const item = this.cache.get(key)
            if (item) {
                item.colorTexture.dispose()
                this.cache.delete(key)
            }
        }
    }

    public clearAll() {
        for (const item of this.cache.values()) {
            item.colorTexture.dispose()
        }
        this.cache.clear()
        this.loadingPromises.clear()
    }
}

interface MapTileMeshProps {
    z: number
    x: number
    y: number
    colorTexture: Texture
    elevationGrid: Float32Array
}

function MapTileMesh({
    z,
    x,
    y,
    colorTexture,
    elevationGrid,
}: MapTileMeshProps) {
    const segments = useMemo(() => getSegmentCount(z), [z])
    const { width, centerX, centerZ } = useMemo(() => {
        const w = getTileWidth(z)
        const b = getTileLocalBounds(z, x, y)
        const cx = (b.minX + b.maxX) / 2
        const cz = (b.minZ + b.maxZ) / 2
        return { width: w, centerX: cx, centerZ: cz }
    }, [z, x, y])

    const geometry = useMemo(() => {
        const geo = new PlaneGeometry(width, width, segments + 2, segments + 2)
        geo.rotateX(-Math.PI / 2)
        displaceGeometry(geo, elevationGrid, z, width)
        return geo
    }, [width, segments, elevationGrid, z])

    useEffect(() => {
        return () => {
            geometry.dispose()
        }
    }, [geometry])

    return (
        <mesh
            position={[centerX, 0, centerZ]}
            geometry={geometry}
            receiveShadow
            castShadow
        >
            <meshStandardMaterial
                map={colorTexture}
                roughness={0.85}
                metalness={0.15}
            />
        </mesh>
    )
}

function arraysEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

interface TileMapProps {
    preparedTrack?: PreparedTrackData | null
    onWarmupChange: (ready: boolean) => void
    worldOrigin: { x: number; y: number }
}

export function TileMap({
    preparedTrack,
    onWarmupChange,
    worldOrigin,
}: TileMapProps) {
    const tileCache = useMemo(() => new TileCache(), [])
    const [, forceUpdate] = useState(0)
    const triggerUpdate = useCallback(() => forceUpdate((n) => n + 1), [])

    const [renderedKeys, setRenderedKeys] = useState<string[]>([])
    const subdividedKeysRef = useRef<Set<string>>(new Set())

    // Calculate the track average elevation to use as a baseline for tile distance calculations
    const trackElevation = useMemo(() => {
        if (!preparedTrack || preparedTrack.points.length === 0) return 0
        const sum = preparedTrack.points.reduce(
            (acc, p) => acc + p.smoothedElevationM,
            0
        )
        return sum / preparedTrack.points.length
    }, [preparedTrack])

    // Limits
    const maxZoom = 17
    const rootZoom = 10
    const frustumMargin = 1000 // 1km visibility margin

    // Memoize the root tiles for the track to avoid re-evaluating bounds
    const rootTiles = useMemo(() => {
        if (!preparedTrack) return []
        const bounds = buildLocalTerrainBounds(preparedTrack)
        const topLeft = mercatorToTile(rootZoom, bounds.minX, bounds.maxY)
        const bottomRight = mercatorToTile(rootZoom, bounds.maxX, bounds.minY)

        const list: Array<{ z: number; x: number; y: number }> = []
        for (let x = topLeft.x; x <= bottomRight.x; x++) {
            for (let y = topLeft.y; y <= bottomRight.y; y++) {
                list.push({ z: rootZoom, x, y })
            }
        }
        return list
    }, [preparedTrack])

    // Check if the root tiles are loaded
    const rootsLoaded = useMemo(() => {
        if (rootTiles.length === 0) return false
        return rootTiles.every((t) =>
            tileCache.isLoaded(`${t.z}/${t.x}/${t.y}`)
        )
    }, [rootTiles, tileCache])

    // Set warmup change once root tiles are ready
    useEffect(() => {
        onWarmupChange(rootsLoaded)
    }, [rootsLoaded, onWarmupChange])

    // Cleanup cache when unmounting or track changes
    useEffect(() => {
        return () => {
            tileCache.clearAll()
            clearTileCache()
        }
    }, [preparedTrack, tileCache])

    // Temporary variables to avoid allocation in frame loop
    const frustum = useMemo(() => new Frustum(), [])
    const projScreenMatrix = useMemo(() => new Matrix4(), [])
    const tempCamPos = useMemo(() => new Vector3(), [])

    useFrame((state) => {
        if (!preparedTrack || rootTiles.length === 0) return

        // 1. Get Camera position and frustum in global coordinates
        tempCamPos.copy(state.camera.position)
        projScreenMatrix.multiplyMatrices(
            state.camera.projectionMatrix,
            state.camera.matrixWorldInverse
        )
        frustum.setFromProjectionMatrix(projScreenMatrix)

        // Sets of active rendering tiles, pending loads, and protected keys
        const activeKeys = new Map<
            string,
            { key: string; z: number; x: number; y: number }
        >()
        const tilesToLoad = new Set<string>()
        const nextSubdividedKeys = new Set<string>()
        const protectedKeys = new Set<string>()

        const getTileElevation = (z: number, x: number, y: number): number => {
            const key = `${z}/${x}/${y}`
            const item = tileCache.get(key)
            if (item) {
                return item.elevationGrid[128 * 256 + 128]
            }
            let curZ = z - 1
            let curX = Math.floor(x / 2)
            let curY = Math.floor(y / 2)
            while (curZ >= rootZoom) {
                const ancestorKey = `${curZ}/${curX}/${curY}`
                const ancestorItem = tileCache.get(ancestorKey)
                if (ancestorItem) {
                    return ancestorItem.elevationGrid[128 * 256 + 128]
                }
                curZ--
                curX = Math.floor(curX / 2)
                curY = Math.floor(curY / 2)
            }
            return trackElevation
        }

        // Local helper for distance to a tile center (projected at the local tile elevation)
        const getDistanceToTile = (z: number, x: number, y: number): number => {
            const bounds = getTileLocalBounds(z, x, y)
            const centerX = (bounds.minX + bounds.maxX) / 2
            const centerZ = (bounds.minZ + bounds.maxZ) / 2

            // Adjust camera position for world origin (group translation)
            const localCamX = tempCamPos.x + worldOrigin.x
            const localCamY = tempCamPos.y
            const localCamZ = tempCamPos.z - worldOrigin.y

            const tileElevation = getTileElevation(z, x, y)

            const dx = centerX - localCamX
            const dy = tileElevation - localCamY
            const dz = centerZ - localCamZ

            return Math.sqrt(dx * dx + dy * dy + dz * dz)
        }

        // Local helper to check if a tile intersects frustum with padding margin
        const isTileVisible = (z: number, x: number, y: number): boolean => {
            const bounds = getTileLocalBounds(z, x, y)
            const globalBox = new Box3(
                new Vector3(
                    bounds.minX - worldOrigin.x - frustumMargin,
                    -2000,
                    bounds.minZ + worldOrigin.y - frustumMargin
                ),
                new Vector3(
                    bounds.maxX - worldOrigin.x + frustumMargin,
                    10000,
                    bounds.maxZ + worldOrigin.y + frustumMargin
                )
            )
            return frustum.intersectsBox(globalBox)
        }

        const findClosestLoadedAncestor = (z: number, x: number, y: number) => {
            let curZ = z - 1
            let curX = Math.floor(x / 2)
            let curY = Math.floor(y / 2)
            while (curZ >= rootZoom) {
                const key = `${curZ}/${curX}/${curY}`
                if (tileCache.isLoaded(key)) {
                    return { key, z: curZ, x: curX, y: curY }
                }
                curZ--
                curX = Math.floor(curX / 2)
                curY = Math.floor(curY / 2)
            }
            return null
        }

        // Determine if a tile should subdivide
        const shouldSubdivide = (z: number, x: number, y: number): boolean => {
            if (z >= maxZoom) return false

            // If outside frustum, don't subdivide (saves CPU/memory loads)
            if (!isTileVisible(z, x, y)) return false

            const width = getTileWidth(z)
            const distance = getDistanceToTile(z, x, y)

            const key = `${z}/${x}/${y}`
            const wasSubdivided = subdividedKeysRef.current.has(key)
            const thresholdMultiplier = wasSubdivided ? 2.8 : 2.4

            return distance < thresholdMultiplier * width
        }

        // Recursive Quadtree LOD Traversal
        const evaluateTile = (z: number, x: number, y: number) => {
            const key = `${z}/${x}/${y}`
            protectedKeys.add(key) // Always protect any tile we traverse

            if (shouldSubdivide(z, x, y)) {
                // Record the decision to subdivide this tile
                nextSubdividedKeys.add(key)

                const nextZ = z + 1
                const nextX = x * 2
                const nextY = y * 2
                const childKeys = [
                    `${nextZ}/${nextX}/${nextY}`,
                    `${nextZ}/${nextX + 1}/${nextY}`,
                    `${nextZ}/${nextX}/${nextY + 1}`,
                    `${nextZ}/${nextX + 1}/${nextY + 1}`,
                ]

                // Protect all 4 children since we want to subdivide into them
                for (const childKey of childKeys) {
                    protectedKeys.add(childKey)
                }

                const allChildrenLoaded = childKeys.every((k) =>
                    tileCache.isLoaded(k)
                )

                if (allChildrenLoaded) {
                    evaluateTile(nextZ, nextX, nextY)
                    evaluateTile(nextZ, nextX + 1, nextY)
                    evaluateTile(nextZ, nextX, nextY + 1)
                    evaluateTile(nextZ, nextX + 1, nextY + 1)
                } else {
                    // Queue children for loading
                    for (const childKey of childKeys) {
                        if (!tileCache.isLoaded(childKey)) {
                            tilesToLoad.add(childKey)
                        }
                    }

                    // Fallback: render parent if loaded
                    if (tileCache.isLoaded(key)) {
                        activeKeys.set(key, { key, z, x, y })
                    } else {
                        // Find closest loaded ancestor (usually root tiles at zoom 10)
                        const ancestor = findClosestLoadedAncestor(z, x, y)
                        if (ancestor) {
                            activeKeys.set(ancestor.key, ancestor)
                        }
                    }
                }
            } else {
                // Render this tile if loaded
                if (tileCache.isLoaded(key)) {
                    activeKeys.set(key, { key, z, x, y })
                } else {
                    tilesToLoad.add(key)

                    // Fallback to closest loaded ancestor
                    const ancestor = findClosestLoadedAncestor(z, x, y)
                    if (ancestor) {
                        activeKeys.set(ancestor.key, ancestor)
                    }
                }
            }
        }

        // Start traversal from root tiles
        for (const root of rootTiles) {
            evaluateTile(root.z, root.x, root.y)
        }

        // 2. Load Throttling: Sort loading list by distance and start max 4 per frame
        const loadArray = Array.from(tilesToLoad).map((key) => {
            const [z, x, y] = key.split('/').map(Number)
            const dist = getDistanceToTile(z, x, y)
            return { key, z, x, y, dist }
        })
        loadArray.sort((a, b) => a.dist - b.dist)

        let startedLoads = 0
        for (const tile of loadArray) {
            if (!tileCache.isLoaded(tile.key)) {
                tileCache.load(tile.key, tile.z, tile.x, tile.y, triggerUpdate)
                startedLoads++
                if (startedLoads >= 4) break
            }
        }

        // 3. LRU Eviction: collect all keys that are either rendered or close to loading queue
        for (const tile of loadArray.slice(0, 8)) {
            protectedKeys.add(tile.key)
        }
        // Always protect root tiles
        for (const root of rootTiles) {
            protectedKeys.add(`${root.z}/${root.x}/${root.y}`)
        }
        tileCache.cleanUnused(protectedKeys)

        // 4. Update state only if visible tile set changed to minimize React re-renders
        const sortedNewKeys = Array.from(activeKeys.keys()).sort()
        if (!arraysEqual(sortedNewKeys, renderedKeys)) {
            setRenderedKeys(sortedNewKeys)
        }

        // 5. Store active subdivided keys for hysteresis checks next frame
        subdividedKeysRef.current = nextSubdividedKeys
    })

    // Helper to extract z, x, y metadata from tile key
    const tileMeshComponents = useMemo(() => {
        return renderedKeys
            .map((key) => {
                const [z, x, y] = key.split('/').map(Number)
                const tileData = tileCache.get(key)
                if (!tileData) return null

                return (
                    <MapTileMesh
                        key={key}
                        z={z}
                        x={x}
                        y={y}
                        colorTexture={tileData.colorTexture}
                        elevationGrid={tileData.elevationGrid}
                    />
                )
            })
            .filter(Boolean)
    }, [renderedKeys, tileCache])

    return (
        <group
            position={[-worldOrigin.x, 0, worldOrigin.y]}
            name="TileMapGroup"
            frustumCulled={false}
        >
            {tileMeshComponents}
        </group>
    )
}
