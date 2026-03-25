import { LODRaycast, MapHeightNode, MapNode, MapView } from 'geo-three'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { AWSTerrariumElevationProvider, EsriWorldImageryProvider, MAX_ZOOM } from './GeoProviders'
import type { PreparedTrackData } from '../../lib/trackPreparation'
import { buildWarmupPlan, nodeIntersectsTileSet } from '../../lib/tilePlanning'

const TERRAIN_GEOMETRY_SEGMENTS = 14

// ✅ PERFORMANCE: Enable frustum culling.
MapNode.prototype.frustumCulled = true

let totalGeometriesCreated = 0
let totalGeometriesDisposed = 0
let activeMapNodeGeometries = 0

// ✅ STABILITY: Expand bounding boxes for culling and track disposal.
// const originalCreateGeometry = MapNode.prototype.createGeometry
// const originalDispose = MapNode.prototype.dispose

// eslint-disable-next-line @typescript-eslint/no-explicit-any
MapNode.prototype.createGeometry = function (...args: any[]) {
    // @ts-expect-error: override geo-three internal
    originalCreateGeometry.apply(this, args)
    if (this.geometry) {
        totalGeometriesCreated++
        activeMapNodeGeometries++
        if (!this.geometry.boundingBox) {
            this.geometry.computeBoundingBox()
        }
        const box = this.geometry.boundingBox as Box3
        box.min.y = -2000
        box.max.y = 10000

        if (!this.geometry.boundingSphere) {
            this.geometry.computeBoundingSphere()
        }
        this.geometry.boundingSphere?.set(box.getCenter(new Vector3()), box.getSize(new Vector3()).length() / 2)
    }
}

// // Deep disposal to fix Three.js memory leaks
MapNode.prototype.dispose = function () {
    if (this.disposed) {
        return
    }

    if (this.geometry) {
        this.geometry.dispose()
        totalGeometriesDisposed++
        activeMapNodeGeometries--
    }
    if (this.material) {
        // @ts-expect-error material can be array or single
        const materials = Array.isArray(this.material) ? this.material : [this.material]
        for (const mat of materials) {
            if (mat.map) mat.map.dispose()
            if (mat.normalMap) mat.normalMap.dispose()
            if (mat.displacementMap) mat.displacementMap.dispose()
            mat.dispose()
        }
    }
    // @ts-expect-error: override geo-three internal
    originalDispose.apply(this)
}

const originalSubdivide = MapNode.prototype.subdivide
const originalSimplify = MapNode.prototype.simplify
let activeTileKeys: Set<string> | null = null
let activeTargetZoom = 13
const lastCameraPos = new Vector3()

let totalSimplifyCalls = 0
let forcedSimplifyCalls = 0

// eslint-disable-next-line @typescript-eslint/no-explicit-any
MapNode.prototype.simplify = function (...args: any[]) {
    if (this.disposed) {
        return
    }
    totalSimplifyCalls++
    // @ts-expect-error: override geo-three internal
    return originalSimplify.apply(this, args)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
MapNode.prototype.subdivide = function (...args: any[]) {
    if (this.disposed) {
        return
    }

    // Let geo-three's internal LOD handle distance-based detail via frustum culling
    // Only apply corridor pruning for very high detail nodes (level 17+)

    const inCorridor = activeTileKeys && nodeIntersectsTileSet(this.level, this.x, this.y, activeTargetZoom, activeTileKeys)

    // Only prune level 17+ nodes outside corridor to save memory
    if (this.level >= 17 && !inCorridor) {
        if (this.subdivided) {
            forcedSimplifyCalls++
            this.simplify()
        }
        return
    }

    // 5. Otherwise allow subdivision
    // @ts-expect-error: override geo-three internal
    return originalSubdivide.apply(this, args)
}

// Global logger for stats
setInterval(() => {
    if (totalGeometriesCreated > 0) {
        console.log('MapNode Geometry Lifecycle:', {
            created: totalGeometriesCreated,
            disposed: totalGeometriesDisposed,
            currentlyActive: activeMapNodeGeometries,
            ratio: (totalGeometriesDisposed / totalGeometriesCreated).toFixed(2),
            simplify: totalSimplifyCalls,
            forcedSimplify: forcedSimplifyCalls,
        })
    }
}, 5000)

interface TileMapProps {
    preparedTrack?: PreparedTrackData | null
    onWarmupChange: (ready: boolean) => void
    onMapViewReady?: (mapView: MapView) => void
    worldOrigin: { x: number; y: number }
}

export function TileMap({ preparedTrack, onWarmupChange, onMapViewReady, worldOrigin }: TileMapProps) {
    const [mapView, setMapView] = useState<MapView | null>(null)
    const lastPruneTime = useRef(0)

    useFrame((state) => {
        if (!mapView || !activeTileKeys) return

        // Update global camera position for the MapNode prototypes
        lastCameraPos.copy(state.camera.position)

        // Prune the tree every 5 seconds to catch nodes the LOD strategy missed
        const now = state.clock.getElapsedTime()
        if (now - lastPruneTime.current < 5.0) return
        lastPruneTime.current = now

        let nodesPruned = 0
        mapView.traverse((child) => {
            // @ts-expect-error level property check
            const level = child.level
            if (level !== undefined && level >= 8) {
                // @ts-expect-error isSubdivided check
                const isSubdivided = child.subdivided

                if (isSubdivided) {
                    const inCorridor =
                        activeTileKeys &&
                        nodeIntersectsTileSet(
                            level,
                            // @ts-expect-error internal
                            child.x,
                            // @ts-expect-error internal
                            child.y,
                            activeTargetZoom,
                            activeTileKeys
                        )

                    if (!inCorridor) {
                        // @ts-expect-error simplify method
                        child.simplify()
                        nodesPruned++
                    }
                }
            }
        })
        if (nodesPruned > 0) {
            console.log(`[TileMap] Background Pruned ${nodesPruned} nodes outside corridor`)
        }
    })

    useMemo(() => {
        if (!preparedTrack) {
            activeTileKeys = null
            return
        }
        const plan = buildWarmupPlan(preparedTrack)
        activeTileKeys = new Set(plan.tileKeys)
        activeTargetZoom = plan.targetZoom
        console.log('[TileMap] Active corridor tiles:', activeTileKeys.size, 'at zoom', activeTargetZoom)
    }, [preparedTrack])

    useEffect(() => {
        const esriApiKey = import.meta.env.ESRI_API_KEY || import.meta.env.VITE_ESRI_API_KEY
        const colorProvider = new EsriWorldImageryProvider(esriApiKey)
        const elevationProvider = new AWSTerrariumElevationProvider()

        colorProvider.minZoom = 0
        colorProvider.maxZoom = MAX_ZOOM

        // @ts-expect-error geo-three leaves this static field out of the published types.
        MapHeightNode.geometrySize = TERRAIN_GEOMETRY_SEGMENTS

        const map = new MapView(MapView.HEIGHT, colorProvider, elevationProvider)
        map.cacheTiles = false // Prevent memory leaks along long tracks.
        if (map.lod instanceof LODRaycast) {
            // Aggressive detail loading for the corridor.
            map.lod.thresholdUp = 0.75
            map.lod.thresholdDown = 0.1
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMapView(map)
        onWarmupChange(true)
        onMapViewReady?.(map)

        return () => {
            onWarmupChange(false)
            map.clear()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onWarmupChange])

    if (!mapView) {
        return null
    }

    return (
        <group position={[-worldOrigin.x, 0, worldOrigin.y]} name="TileMapGroup" frustumCulled={false}>
            <primitive object={mapView} />
        </group>
    )
}
