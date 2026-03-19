import { useEffect, useState } from "react";
import { MapHeightNode, MapNodeGeometry, MapView } from "geo-three";
import {
  EsriWorldImageryProvider,
  AWSTerrariumElevationProvider,
  MAX_ZOOM,
} from "./GeoProviders";
import { INITIAL_COORDS } from "../../lib/constants";
import type { PreparedTrackData } from "../../lib/trackPreparation";

const originalBuildSkirt = MapNodeGeometry.buildSkirt;
MapNodeGeometry.buildSkirt = function (
  width: number,
  height: number,
  widthSegments: number,
  heightSegments: number,
  _skirtDepth: number,
  indices: number[],
  vertices: number[],
  normals: number[],
  uvs: number[],
) {
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

interface TileMapProps {
  preparedTrack: PreparedTrackData;
  onWarmupChange: (ready: boolean) => void;
}

export function TileMap({ preparedTrack: _preparedTrack, onWarmupChange }: TileMapProps) {
  const [mapView, setMapView] = useState<MapView | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.ESRI_API_KEY || import.meta.env.VITE_ESRI_API_KEY;
    if (!apiKey) {
      console.warn(
        "ESRI_API_KEY or VITE_ESRI_API_KEY is missing from environment variables. Imagery tiles may fail to load.",
      );
    }

    const colorProvider = new EsriWorldImageryProvider(apiKey);
    const elevationProvider = new AWSTerrariumElevationProvider();
    colorProvider.maxZoom = MAX_ZOOM;

    // @ts-expect-error geo-three leaves this static field out of the published types.
    MapHeightNode.geometrySize = 64;

    const map = new MapView(MapView.HEIGHT, colorProvider, elevationProvider);
    map.cacheTiles = false;

    setMapView(map);
    onWarmupChange(true);

    return () => {
      onWarmupChange(false);
      map.clear();
    };
  }, [onWarmupChange]);

  if (!mapView) {
    return null;
  }

  return (
    <group position={[-INITIAL_COORDS.x, 0, INITIAL_COORDS.y]} name="TileMapGroup">
      <primitive object={mapView} />
    </group>
  );
}
