export const WEB_MERCATOR_MAX_EXTENT = 20037508.342789244;
const EARTH_RADIUS = 6378137.0;

/**
 * Converts latitude and longitude (WGS84) to Web Mercator (EPSG:3857) coordinates.
 * Aligns perfectly with the original UnitsUtils.datumsToSpherical in geo-three.
 */
export function datumsToSpherical(latitude: number, longitude: number): { x: number; y: number } {
    const x = longitude * EARTH_RADIUS * (Math.PI / 180);
    const y = Math.log(Math.tan((latitude + 90) * (Math.PI / 360))) * EARTH_RADIUS;
    return { x, y };
}

/**
 * Returns the width of a map tile in meters at a given zoom level.
 */
export function getTileWidth(zoom: number): number {
    return (WEB_MERCATOR_MAX_EXTENT * 2) / Math.pow(2, zoom);
}

export interface TileLocalBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}

/**
 * Computes the spatial bounds of a tile in local Three.js coordinates relative to the tile layout.
 * In our system:
 * - Mercator X is mapped to local X
 * - Mercator Y is mapped to local -Z
 * - Local Y is the height/elevation.
 */
export function getTileLocalBounds(zoom: number, x: number, y: number): TileLocalBounds {
    const width = getTileWidth(zoom);
    
    // Web Mercator X: min is -WEB_MERCATOR_MAX_EXTENT, max is WEB_MERCATOR_MAX_EXTENT
    const minX = -WEB_MERCATOR_MAX_EXTENT + x * width;
    const maxX = minX + width;
    
    // Web Mercator Y: goes from North (WEB_MERCATOR_MAX_EXTENT) to South (-WEB_MERCATOR_MAX_EXTENT)
    const maxY = WEB_MERCATOR_MAX_EXTENT - y * width;
    const minY = maxY - width;
    
    // Mapping:
    // local Z = -Mercator Y
    // Therefore, top-left of tile in Web Mercator (minX, maxY) corresponds to (minX, -maxY) in local coordinates.
    // bottom-right of tile in Web Mercator (maxX, minY) corresponds to (maxX, -minY) in local coordinates.
    return {
        minX,
        maxX,
        minY: -2000,  // estimated minimum height
        maxY: 10000,  // estimated maximum height
        minZ: -maxY,
        maxZ: -minY
    };
}
