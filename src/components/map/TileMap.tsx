import { useEffect, useState } from "react";
import { MapView, UnitsUtils, MapHeightNode, MapNodeGeometry } from "geo-three";
import {
  EsriWorldImageryProvider,
  AWSTerrariumElevationProvider,
  MAX_ZOOM,
} from "./GeoProviders";

// Monkey-patch geo-three's skirt generation.
// A "skirt" is a wall drawn straight down from the edges of a tile to hide gaps between different LOD levels.
// Default geo-three skirt is only 10m deep, which is completely insufficient for mountainous terrain gaps.
const originalBuildSkirt = MapNodeGeometry.buildSkirt;
MapNodeGeometry.buildSkirt = function (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  width: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  height: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  widthSegments: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  heightSegments: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _skirtDepth: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  indices: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vertices: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normals: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uvs: any,
) {
  // Call original generating function, but override the depth parameter to a massive 500m
  originalBuildSkirt.call(
    this,
    width,
    height,
    widthSegments,
    heightSegments,
    500.0,
    indices,
    vertices,
    normals,
    uvs,
  );
};

// Convert coordinates to scene coordinates.
// Initially looking at Munich (10, 355, 545 is roughly 48.1351 N, 11.5820 E)
const INITIAL_COORDS = UnitsUtils.datumsToSpherical(48.1351, 11.582);

export function TileMap() {
  const [mapView, setMapView] = useState<MapView | null>(null);

  useEffect(() => {
    // Load the API Key from import.meta.env
    const apiKey =
      import.meta.env.ESRI_API_KEY || import.meta.env.VITE_ESRI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️ ESRI_API_KEY or VITE_ESRI_API_KEY is missing from environment variables! The map tiles will fail to load 401 Unauthorized.",
      );
    }

    const colorProvider = new EsriWorldImageryProvider(apiKey);
    const elevationProvider = new AWSTerrariumElevationProvider();

    // maxZoom is a property of the provider in geo-three, not the map itself
    colorProvider.maxZoom = MAX_ZOOM;

    // Apply custom mesh resolution since we're using MapView.HEIGHT (default is 16)
    // 128 gives a very detailed mesh for the 256x256 altitude tile
    // @ts-expect-error type missing in d.ts
    MapHeightNode.geometrySize = 128;

    // Use MapView.HEIGHT which uses CPU mesh generation (stable) and decodes MapBox format
    // which we manually cross-encoded in the AWSTerrariumElevationProvider.
    const map = new MapView(MapView.HEIGHT, colorProvider, elevationProvider);

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
    <group position={[-INITIAL_COORDS.x, 0, INITIAL_COORDS.y]} name="TileMapGroup">
      <primitive object={mapView} />
    </group>
  );
}
