import {
    LODRaycast,
    MapHeightNode,
    MapNode,
    MapNodeGeometry,
    MapView,
} from 'geo-three'
import { useEffect, useState } from 'react'
import { INITIAL_COORDS } from '../../lib/constants'
import {
    AWSTerrariumElevationProvider,
    EsriWorldImageryProvider,
    MAX_ZOOM,
} from './GeoProviders'

const TERRAIN_GEOMETRY_SEGMENTS = 16

MapNodeGeometry.buildSkirt = function () {
    return
}

MapNode.prototype.frustumCulled = false

interface TileMapProps {
    onWarmupChange: (ready: boolean) => void
}

export function TileMap({ onWarmupChange }: TileMapProps) {
    const [mapView, setMapView] = useState<MapView | null>(null)

    useEffect(() => {
        const esriApiKey =
            import.meta.env.ESRI_API_KEY || import.meta.env.VITE_ESRI_API_KEY
        const mapboxApiKey =
            import.meta.env.MAPBOX_API_TOKEN ||
            import.meta.env.VITE_MAPBOX_API_TOKEN
        if (!esriApiKey) {
            console.warn(
                'ESRI_API_KEY or VITE_ESRI_API_KEY is missing from environment variables. Imagery tiles may fail to load.'
            )
        }
        if (!mapboxApiKey) {
            console.warn(
                'MAPBOX_API_TOKEN or VITE_MAPBOX_API_TOKEN is missing from environment variables. Map tiles may fail to load.'
            )
        }

        const colorProvider = new EsriWorldImageryProvider(esriApiKey)
        // const colorProvider = new MapBoxProvider(
        //     mapboxApiKey,
        //     'mapbox/satellite-v9'
        // )
        const elevationProvider = new AWSTerrariumElevationProvider()
        // const elevationProvider = new MapBoxProvider(
        //     mapboxApiKey,
        //     'mapbox.terrain-rgb',
        //     MapBoxProvider.MAP_ID
        //     // 'pngraw'
        // )
        colorProvider.minZoom = 0
        colorProvider.maxZoom = MAX_ZOOM

        // @ts-expect-error geo-three leaves this static field out of the published types.
        MapHeightNode.geometrySize = TERRAIN_GEOMETRY_SEGMENTS

        const map = new MapView(
            MapView.HEIGHT,
            colorProvider,
            elevationProvider
        )
        map.cacheTiles = false
        if (map.lod instanceof LODRaycast) {
            map.lod.thresholdUp = 0.75
            map.lod.thresholdDown = 0.15
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMapView(map)
        onWarmupChange(true)

        return () => {
            onWarmupChange(false)
            map.clear()
        }
    }, [onWarmupChange])

    if (!mapView) {
        return null
    }

    return (
        <group
            position={[-INITIAL_COORDS.x, 0, INITIAL_COORDS.y]}
            name="TileMapGroup"
        >
            <primitive object={mapView} />
        </group>
    )
}
