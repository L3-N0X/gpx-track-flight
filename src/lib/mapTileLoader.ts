import { Texture, TextureLoader } from 'three'

const TILE_SIZE = 256
const textureLoader = new TextureLoader()

// Global image/tile caches for sharing load operations
const elevationCache = new Map<string, Promise<Float32Array>>()
const imageryCache = new Map<string, Promise<Texture>>()

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
        img.src = url
    })
}

/**
 * Loads an ESRI imagery tile as a Three.js Texture.
 * Returns a dark slate placeholder texture if the request fails.
 */
export function fetchImageryTexture(
    z: number,
    x: number,
    y: number
): Promise<Texture> {
    const key = `${z}/${x}/${y}`
    const cached = imageryCache.get(key)
    if (cached) {
        return cached
    }

    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`

    const promise = new Promise<Texture>((resolve, reject) => {
        textureLoader.load(
            url,
            (texture) => {
                texture.generateMipmaps = true
                resolve(texture)
            },
            undefined,
            (err) => reject(err)
        )
    }).catch((err) => {
        console.warn(
            `[TileLoader] Failed to load imagery for ${key}, using placeholder:`,
            err
        )
        // Clean up from cache so we don't stick on a failed state permanently
        imageryCache.delete(key)

        // Return a dark solid placeholder texture
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#0f172a' // dark slate
        ctx.fillRect(0, 0, 16, 16)
        const fallbackTexture = new Texture(canvas)
        fallbackTexture.needsUpdate = true
        return fallbackTexture
    })

    imageryCache.set(key, promise)
    return promise
}

/**
 * Fetches and decodes AWS Terrarium elevation tiles.
 * Supports zoom levels up to 17 by sub-sampling zoom 14 elevation parent tiles.
 * Decodes elevation directly to meters: height = (R * 256 + G + B / 256) - 32768
 * Returns a flat 0-elevation array if the tile cannot be retrieved.
 */
export function fetchElevationTile(
    z: number,
    x: number,
    y: number
): Promise<Float32Array> {
    const key = `${z}/${x}/${y}`
    const cached = elevationCache.get(key)
    if (cached) {
        return cached
    }

    const promise = (async () => {
        const maxDataZoom = 14
        let fetchZoom = z
        let fetchX = x
        let fetchY = y

        if (z > maxDataZoom) {
            const zoomDiff = z - maxDataZoom
            const power = Math.pow(2, zoomDiff)
            fetchZoom = maxDataZoom
            fetchX = Math.floor(x / power)
            fetchY = Math.floor(y / power)
        }

        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${fetchZoom}/${fetchX}/${fetchY}.png`

        try {
            const img = await loadImage(url)

            const canvas = document.createElement('canvas')
            canvas.width = TILE_SIZE
            canvas.height = TILE_SIZE
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (!ctx) {
                throw new Error('Failed to create canvas 2D context')
            }

            ctx.imageSmoothingEnabled = false

            if (z > maxDataZoom) {
                const zoomDiff = z - maxDataZoom
                const power = Math.pow(2, zoomDiff)
                const cropSize = img.width / power
                const offsetX = (x % power) * cropSize
                const offsetY = (y % power) * cropSize

                ctx.drawImage(
                    img,
                    offsetX,
                    offsetY,
                    cropSize,
                    cropSize,
                    0,
                    0,
                    TILE_SIZE,
                    TILE_SIZE
                )
            } else {
                ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE)
            }

            const imgData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE)
            const pixels = imgData.data

            const heights = new Float32Array(TILE_SIZE * TILE_SIZE)
            for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
                const r = pixels[i * 4]
                const g = pixels[i * 4 + 1]
                const b = pixels[i * 4 + 2]

                // Decode AWS Terrarium formula
                heights[i] = r * 256.0 + g + b / 256.0 - 32768.0
            }

            return heights
        } catch (err) {
            console.warn(
                `[TileLoader] Failed to load/decode elevation for ${key}, using flat:`,
                err
            )
            elevationCache.delete(key)
            // Return flat 0-height array as fallback
            return new Float32Array(TILE_SIZE * TILE_SIZE)
        }
    })()

    elevationCache.set(key, promise)
    return promise
}

/**
 * Clears the global tile cache. Call this when transitioning between tracks.
 */
export function clearTileCache() {
    elevationCache.clear()
    imageryCache.clear()
}
