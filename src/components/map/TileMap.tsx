import { useEffect, useState } from "react";
import { LODRaycast, MapHeightNode, MapNodeGeometry, MapView } from "geo-three";
import {
  EsriWorldImageryProvider,
  AWSTerrariumElevationProvider,
  MAX_ZOOM,
} from "./GeoProviders";
import { INITIAL_COORDS } from "../../lib/constants";
import type { PreparedTrackData } from "../../lib/trackPreparation";

const TERRAIN_GEOMETRY_SEGMENTS = 16;

MapNodeGeometry.buildSkirt = function () {
  return;
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
    colorProvider.minZoom = 0;
    colorProvider.maxZoom = MAX_ZOOM;

    // @ts-expect-error geo-three leaves this static field out of the published types.
    MapHeightNode.geometrySize = TERRAIN_GEOMETRY_SEGMENTS;

    const map = new MapView(MapView.HEIGHT, colorProvider, elevationProvider);
    map.cacheTiles = false;
    if (map.lod instanceof LODRaycast) {
      map.lod.thresholdUp = 0.75;
      map.lod.thresholdDown = 0.22;
    }

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
