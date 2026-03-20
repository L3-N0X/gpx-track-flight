import { AWSTerrariumElevationProvider } from '../components/map/GeoProviders'
import type { PreparedTrackData, PreparedTrackPoint } from './trackPreparation'

const TERRARIUM_ZOOM = 14
const TILE_SIZE = 256
const SAMPLE_BATCH_SIZE = 32
const elevationProvider = new AWSTerrariumElevationProvider()

interface TileCoordinate {
    x: number
    y: number
}

interface TileSample {
    data: Uint8ClampedArray
    width: number
    height: number
}

const tileCache = new Map<string, Promise<TileSample>>()

function createTileKey(zoom: number, x: number, y: number): string {
    return `${zoom}/${x}/${y}`
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

function decodeMapboxHeight(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number
): number {
    const clampedX = Math.max(0, Math.min(width - 1, x))
    const clampedY = Math.max(0, Math.min(height - 1, y))
    const index = (clampedY * width + clampedX) * 4
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]

    return (r * 65536 + g * 256 + b) * 0.1 - 10000
}

function sampleHeight(tile: TileSample, lat: number, lon: number): number {
    const { pixelX, pixelY } = latLonToPixelCoordinate(lat, lon, TERRARIUM_ZOOM)
    const localX = pixelX % TILE_SIZE
    const localY = pixelY % TILE_SIZE

    const x0 = Math.floor(localX)
    const y0 = Math.floor(localY)
    const x1 = Math.min(tile.width - 1, x0 + 1)
    const y1 = Math.min(tile.height - 1, y0 + 1)
    const tx = localX - x0
    const ty = localY - y0

    const h00 = decodeMapboxHeight(tile.data, tile.width, tile.height, x0, y0)
    const h10 = decodeMapboxHeight(tile.data, tile.width, tile.height, x1, y0)
    const h01 = decodeMapboxHeight(tile.data, tile.width, tile.height, x0, y1)
    const h11 = decodeMapboxHeight(tile.data, tile.width, tile.height, x1, y1)

    const top = h00 * (1 - tx) + h10 * tx
    const bottom = h01 * (1 - tx) + h11 * tx
    return top * (1 - ty) + bottom * ty
}

async function fetchTerrariumTile(
    zoom: number,
    x: number,
    y: number
): Promise<TileSample> {
    const key = createTileKey(zoom, x, y)
    const cached = tileCache.get(key)
    if (cached) {
        return cached
    }

    const request = elevationProvider.fetchTile(zoom, x, y).then((tile) => {
        const canvas = document.createElement('canvas')
        canvas.width = TILE_SIZE
        canvas.height = TILE_SIZE
        const context = canvas.getContext('2d', { willReadFrequently: true })

        if (!context) {
            throw new Error('Failed to create canvas context for DEM sampling.')
        }

        context.imageSmoothingEnabled = false
        context.drawImage(tile, 0, 0, TILE_SIZE, TILE_SIZE)
        const imageData = context.getImageData(0, 0, TILE_SIZE, TILE_SIZE)
        return {
            data: imageData.data,
            width: imageData.width,
            height: imageData.height,
        }
    })

    tileCache.set(key, request)
    return request
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
            const tileSample = await fetchTerrariumTile(
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
