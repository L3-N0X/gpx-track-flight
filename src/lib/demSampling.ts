import { fetchElevationTile } from './mapTileLoader'
import type { PreparedTrackData, PreparedTrackPoint } from './trackPreparation'

const TERRARIUM_ZOOM = 14
const TILE_SIZE = 256
const SAMPLE_BATCH_SIZE = 32

interface TileCoordinate {
    x: number
    y: number
}

function latLonToTileCoordinate(
    lat: number,
    lon: number,
    zoom: number
): TileCoordinate {
    const latitudeRad = (lat * Math.PI) / 180
    const tilesPerAxis = Math.pow(2, zoom)
    const x = ((lon + 180) / 360) * tilesPerAxis
    const y =
        ((1 -
            Math.log(Math.tan(latitudeRad) + 1 / Math.cos(latitudeRad)) /
                Math.PI) /
            2) *
        tilesPerAxis

    return {
        x: Math.max(0, Math.min(tilesPerAxis - 1, Math.floor(x))),
        y: Math.max(0, Math.min(tilesPerAxis - 1, Math.floor(y))),
    }
}

function latLonToPixelCoordinate(
    lat: number,
    lon: number,
    zoom: number
): { pixelX: number; pixelY: number } {
    const latitudeRad = (lat * Math.PI) / 180
    const tilesPerAxis = Math.pow(2, zoom)
    const x = ((lon + 180) / 360) * tilesPerAxis * TILE_SIZE
    const y =
        ((1 -
            Math.log(Math.tan(latitudeRad) + 1 / Math.cos(latitudeRad)) /
                Math.PI) /
            2) *
        tilesPerAxis *
        TILE_SIZE

    return {
        pixelX: x,
        pixelY: y,
    }
}

function sampleHeight(tile: Float32Array, lat: number, lon: number): number {
    const { pixelX, pixelY } = latLonToPixelCoordinate(lat, lon, TERRARIUM_ZOOM)
    const localX = pixelX % TILE_SIZE
    const localY = pixelY % TILE_SIZE

    const x0 = Math.floor(localX)
    const y0 = Math.floor(localY)
    const x1 = Math.min(TILE_SIZE - 1, x0 + 1)
    const y1 = Math.min(TILE_SIZE - 1, y0 + 1)
    const tx = localX - x0
    const ty = localY - y0

    const h00 = tile[y0 * TILE_SIZE + x0]
    const h10 = tile[y0 * TILE_SIZE + x1]
    const h01 = tile[y1 * TILE_SIZE + x0]
    const h11 = tile[y1 * TILE_SIZE + x1]

    const top = h00 * (1 - tx) + h10 * tx
    const bottom = h01 * (1 - tx) + h11 * tx
    return top * (1 - ty) + bottom * ty
}

function waitForNextTick(): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, 0)
    })
}

export async function sampleTrackElevations(
    preparedTrack: PreparedTrackData,
    onBatch: (updates: Array<{ index: number; height: number }>) => void
): Promise<void> {
    for (
        let start = 0;
        start < preparedTrack.points.length;
        start += SAMPLE_BATCH_SIZE
    ) {
        const batch = preparedTrack.points.slice(
            start,
            start + SAMPLE_BATCH_SIZE
        )
        const updates: Array<{ index: number; height: number }> = []

        for (let offset = 0; offset < batch.length; offset++) {
            const point = batch[offset]
            const tile = latLonToTileCoordinate(
                point.lat,
                point.lon,
                TERRARIUM_ZOOM
            )
            const tileSample = await fetchElevationTile(
                TERRARIUM_ZOOM,
                tile.x,
                tile.y
            )
            updates.push({
                index: start + offset,
                height: sampleHeight(tileSample, point.lat, point.lon),
            })
        }

        onBatch(updates)
        await waitForNextTick()
    }
}

export function applySampledTrackHeight(
    _point: PreparedTrackPoint,
    terrainHeight: number,
    clearance: number
) {
    return terrainHeight + clearance
}

export async function sampleLocationElevation(
    lat: number,
    lon: number
): Promise<number> {
    const tile = latLonToTileCoordinate(lat, lon, TERRARIUM_ZOOM)
    const tileSample = await fetchElevationTile(TERRARIUM_ZOOM, tile.x, tile.y)
    return sampleHeight(tileSample, lat, lon)
}
