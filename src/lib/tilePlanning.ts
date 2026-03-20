import { UnitsUtils } from 'geo-three'
import type { PreparedTrackData } from './trackPreparation'

export const TERRAIN_OPERATIONAL_ZOOM = 13
export const TERRAIN_COARSE_ZOOM = 8
export const TERRAIN_BOUNDARY_ZOOM = 10
export const TRACK_CORRIDOR_PADDING_M = 250
export const SURROUNDING_PADDING_M = 600
export const MIN_OPERATIONAL_ZOOM = 11
export const MAX_WARM_TILES = 180
export const LOCAL_WINDOW_SCALE = 3
export const LOCAL_WINDOW_MIN_SIZE_M = 20_000
export const LOCAL_WINDOW_MAX_SIZE_M = 120_000

export interface TileBounds {
    minX: number
    maxX: number
    minY: number
    maxY: number
}

export interface WarmupPlan {
    targetZoom: number
    coarseZoom: number
    tileKeys: string[]
}

export interface LocalRenderPlan {
    rootZoom: number
    rootX: number
    rootY: number
    detailZoom: number
    coarseZoom: number
    tileKeys: string[]
    bounds: TileBounds
}

const MAX_MERCATOR = UnitsUtils.WEB_MERCATOR_MAX_EXTENT

function clampTileCoordinate(value: number, zoom: number): number {
    const maxIndex = Math.pow(2, zoom) - 1
    return Math.max(0, Math.min(maxIndex, value))
}

export function createTileKey(zoom: number, x: number, y: number): string {
    return `${zoom}/${x}/${y}`
}

export function mercatorToTile(
    zoom: number,
    mercatorX: number,
    mercatorY: number
) {
    const worldSize = MAX_MERCATOR * 2
    const tilesPerAxis = Math.pow(2, zoom)
    const normalizedX = (mercatorX + MAX_MERCATOR) / worldSize
    const normalizedY = (MAX_MERCATOR - mercatorY) / worldSize

    return {
        x: clampTileCoordinate(Math.floor(normalizedX * tilesPerAxis), zoom),
        y: clampTileCoordinate(Math.floor(normalizedY * tilesPerAxis), zoom),
    }
}

function addTileRect(
    tileKeys: Set<string>,
    zoom: number,
    minMercatorX: number,
    maxMercatorX: number,
    minMercatorY: number,
    maxMercatorY: number
) {
    const topLeft = mercatorToTile(zoom, minMercatorX, maxMercatorY)
    const bottomRight = mercatorToTile(zoom, maxMercatorX, minMercatorY)

    for (let x = topLeft.x; x <= bottomRight.x; x++) {
        for (let y = topLeft.y; y <= bottomRight.y; y++) {
            tileKeys.add(createTileKey(zoom, x, y))
        }
    }
}

function buildTileRectSet(bounds: TileBounds, zoom: number) {
    const tileKeys = new Set<string>()

    addTileRect(
        tileKeys,
        zoom,
        bounds.minX,
        bounds.maxX,
        bounds.minY,
        bounds.maxY
    )

    return tileKeys
}

function buildTileSet(preparedTrack: PreparedTrackData, zoom: number) {
    const tileKeys = new Set<string>()

    for (let i = 0; i < preparedTrack.points.length - 1; i++) {
        const current = preparedTrack.points[i]
        const next = preparedTrack.points[i + 1]

        addTileRect(
            tileKeys,
            zoom,
            Math.min(current.mercatorX, next.mercatorX) -
                TRACK_CORRIDOR_PADDING_M,
            Math.max(current.mercatorX, next.mercatorX) +
                TRACK_CORRIDOR_PADDING_M,
            Math.min(current.mercatorY, next.mercatorY) -
                TRACK_CORRIDOR_PADDING_M,
            Math.max(current.mercatorY, next.mercatorY) +
                TRACK_CORRIDOR_PADDING_M
        )
    }

    addTileRect(
        tileKeys,
        zoom,
        preparedTrack.mercatorBounds.minX - SURROUNDING_PADDING_M,
        preparedTrack.mercatorBounds.maxX + SURROUNDING_PADDING_M,
        preparedTrack.mercatorBounds.minY - SURROUNDING_PADDING_M,
        preparedTrack.mercatorBounds.maxY + SURROUNDING_PADDING_M
    )

    return tileKeys
}

export function buildLocalTerrainBounds(
    preparedTrack: PreparedTrackData
): TileBounds {
    const width = Math.max(
        0,
        preparedTrack.mercatorBounds.maxX - preparedTrack.mercatorBounds.minX
    )
    const height = Math.max(
        0,
        preparedTrack.mercatorBounds.maxY - preparedTrack.mercatorBounds.minY
    )
    const trackSpan = Math.max(width, height)
    const sideLength = Math.min(
        LOCAL_WINDOW_MAX_SIZE_M,
        Math.max(LOCAL_WINDOW_MIN_SIZE_M, trackSpan * LOCAL_WINDOW_SCALE)
    )

    const centerX =
        (preparedTrack.mercatorBounds.minX +
            preparedTrack.mercatorBounds.maxX) /
        2
    const centerY =
        (preparedTrack.mercatorBounds.minY +
            preparedTrack.mercatorBounds.maxY) /
        2
    const halfSide = sideLength / 2

    return {
        minX: centerX - halfSide,
        maxX: centerX + halfSide,
        minY: centerY - halfSide,
        maxY: centerY + halfSide,
    }
}

export function buildLocalRenderPlan(
    preparedTrack: PreparedTrackData
): LocalRenderPlan {
    const bounds = buildLocalTerrainBounds(preparedTrack)
    const tileKeys = buildTileRectSet(bounds, TERRAIN_BOUNDARY_ZOOM)
    let rootZoom = TERRAIN_BOUNDARY_ZOOM
    let topLeft = mercatorToTile(rootZoom, bounds.minX, bounds.maxY)
    let bottomRight = mercatorToTile(rootZoom, bounds.maxX, bounds.minY)

    while (
        (topLeft.x !== bottomRight.x || topLeft.y !== bottomRight.y) &&
        rootZoom > 0
    ) {
        rootZoom--
        topLeft = mercatorToTile(rootZoom, bounds.minX, bounds.maxY)
        bottomRight = mercatorToTile(rootZoom, bounds.maxX, bounds.minY)
    }

    return {
        rootZoom,
        rootX: topLeft.x,
        rootY: topLeft.y,
        detailZoom: TERRAIN_OPERATIONAL_ZOOM,
        coarseZoom: TERRAIN_COARSE_ZOOM,
        tileKeys: [...tileKeys].sort(),
        bounds,
    }
}

export function buildWarmupPlan(preparedTrack: PreparedTrackData): WarmupPlan {
    let targetZoom = TERRAIN_OPERATIONAL_ZOOM
    let tileKeys = buildTileSet(preparedTrack, targetZoom)

    while (
        tileKeys.size > MAX_WARM_TILES &&
        targetZoom > MIN_OPERATIONAL_ZOOM
    ) {
        targetZoom--
        tileKeys = buildTileSet(preparedTrack, targetZoom)
    }

    return {
        targetZoom,
        coarseZoom: TERRAIN_COARSE_ZOOM,
        tileKeys: [...tileKeys].sort(),
    }
}

export function nodeIntersectsTileSet(
    nodeLevel: number,
    nodeX: number,
    nodeY: number,
    targetZoom: number,
    tileKeys: Set<string>
): boolean {
    if (nodeLevel > targetZoom) {
        return tileKeys.has(createTileKey(nodeLevel, nodeX, nodeY))
    }

    const scale = Math.pow(2, targetZoom - nodeLevel)
    const startX = nodeX * scale
    const startY = nodeY * scale
    const endX = startX + scale - 1
    const endY = startY + scale - 1

    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            if (tileKeys.has(createTileKey(targetZoom, x, y))) {
                return true
            }
        }
    }

    return false
}
