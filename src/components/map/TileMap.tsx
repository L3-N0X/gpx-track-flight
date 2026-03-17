import { useEffect, useState } from 'react';
import { MapView, UnitsUtils } from 'geo-three';
import { EsriWorldImageryProvider, AWSTerrariumElevationProvider, MAX_ZOOM } from './GeoProviders';

// Convert coordinates to scene coordinates.
// Initially looking at Munich (10, 355, 545 is roughly 48.1351 N, 11.5820 E)
const INITIAL_COORDS = UnitsUtils.datumsToSpherical(48.1351, 11.5820);

export function TileMap() {
    const [mapView, setMapView] = useState<MapView | null>(null);

    useEffect(() => {
        // Load the API Key from import.meta.env
        const apiKey = import.meta.env.ESRI_API_KEY || import.meta.env.VITE_ESRI_API_KEY;
        if (!apiKey) {
            console.warn("⚠️ ESRI_API_KEY or VITE_ESRI_API_KEY is missing from environment variables! The map tiles will fail to load 401 Unauthorized.");
        }
        
        const colorProvider = new EsriWorldImageryProvider(apiKey);
        const elevationProvider = new AWSTerrariumElevationProvider();
        
        // maxZoom is a property of the provider in geo-three, not the map itself
        colorProvider.maxZoom = MAX_ZOOM;
        elevationProvider.maxZoom = MAX_ZOOM;

        // Use standard MapView, PLANAR mode for 3D terrain
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new MapView(MapView.PLANAR, colorProvider, elevationProvider as any);
        
        // eslint-disable-next-line
        setMapView(map);

        return () => {
            // Cleanup map geometry if needed
            map.clear();
        };
    }, []);

    // geo-three's LOD/chunking update runs automatically via MapView.onBeforeRender in modern geo-three versions.
    // We no longer need to call mapView.update() manually in useFrame.

    if (!mapView) return null;

    return (
        <group position={[-INITIAL_COORDS.x, 0, INITIAL_COORDS.y]}>
            <primitive object={mapView} />
        </group>
    );
}
