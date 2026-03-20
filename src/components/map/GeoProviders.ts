import { MapProvider } from 'geo-three'

// Constants
export const MAX_ZOOM = 17

// We use the standard MapProvider class and override the HTTP fetch string
// to easily use the Esri Basemap styles without needing a dedicated EsriProvider class, since we just need tile URLs.
export class EsriWorldImageryProvider extends MapProvider {
    public apiKey: string

    public constructor(apiKey: string = '') {
        super()
        this.apiKey = apiKey
        this.minZoom = 6
    }

    public fetchTile(
        zoom: number,
        x: number,
        y: number
    ): Promise<HTMLImageElement | HTMLCanvasElement | ImageBitmap> {
        // According to user request: basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/tiles/imagery/{z}/{y}/{x}?token=ESRI_API_KEY
        // and using 512x resolution
        // const url = `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/static/tile/${zoom}/${y}/${x}?token=${this.apiKey}`;
        const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`

        return new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => {
                console.error(`EsriProvider Failed to load tile: ${url}`)
                reject()
            }
            image.crossOrigin = 'Anonymous'
            image.src = url
        })
    }
}

export class EsriLabelProvider extends MapProvider {
    public apiKey: string

    public constructor(apiKey: string = '') {
        super()
        this.apiKey = apiKey
        this.minZoom = 1
        this.maxZoom = 17
    }

    public fetchTile(
        zoom: number,
        x: number,
        y: number
    ): Promise<HTMLImageElement | HTMLCanvasElement | ImageBitmap> {
        const esriZoom = zoom - 1
        return new Promise((resolve, reject) => {
            const image = document.createElement('img')
            image.onload = () => resolve(image)
            image.onerror = reject
            image.crossOrigin = 'Anonymous'
            // ✅ Correct path — labels overlay for imagery style
            image.src = `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/${esriZoom}/${y}/${x}?token=${this.apiKey}`
        })
    }
}

// Custom Elevation provider for AWS Terrarium RGB tiles
export class AWSTerrariumElevationProvider extends MapProvider {
    public constructor() {
        super()
        this.maxZoom = 17
    }

    public fetchTile(
        zoom: number,
        x: number,
        y: number
    ): Promise<HTMLImageElement | HTMLCanvasElement | ImageBitmap> {
        const maxDataZoom = 14
        let fetchZoom = zoom
        let fetchX = x
        let fetchY = y

        if (zoom > maxDataZoom) {
            const zoomDiff = zoom - maxDataZoom
            fetchZoom = maxDataZoom
            fetchX = Math.floor(x / Math.pow(2, zoomDiff))
            fetchY = Math.floor(y / Math.pow(2, zoomDiff))
        }

        // AWS Elevation Tiles: s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${fetchZoom}/${fetchX}/${fetchY}.png`

        return new Promise((resolve, reject) => {
            const image = new Image()
            image.crossOrigin = 'Anonymous'
            image.onload = () => {
                const canvas = document.createElement('canvas')
                const ctxWidth = 256
                const ctxHeight = 256
                canvas.width = ctxWidth
                canvas.height = ctxHeight
                const context = canvas.getContext('2d', {
                    willReadFrequently: true,
                })

                if (!context) {
                    resolve(image)
                    return
                }

                context.imageSmoothingEnabled = false

                if (zoom > maxDataZoom) {
                    const zoomDiff = zoom - maxDataZoom
                    const power = Math.pow(2, zoomDiff)
                    const cropSize = image.width / power
                    const offsetX = (x % power) * cropSize
                    const offsetY = (y % power) * cropSize

                    context.drawImage(
                        image,
                        offsetX,
                        offsetY,
                        cropSize,
                        cropSize,
                        0,
                        0,
                        ctxWidth,
                        ctxHeight
                    )
                } else {
                    context.drawImage(image, 0, 0, ctxWidth, ctxHeight)
                }

                const imageData = context.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                )
                const data = imageData.data

                // AWS Terrarium: height = (R * 256 + G + B / 256) - 32768
                // Mapbox: height = (r * 65536 + g * 256 + b) * 0.1 - 10000
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i]
                    const g = data[i + 1]
                    const b = data[i + 2]

                    // Decode
                    const h = r * 256.0 + g + b / 256.0 - 32768.0

                    // Mountain scale exaggeration (so they don't look tiny from 6km up)
                    const hExaggerated = h * 2.5

                    // Encode to Mapbox
                    const value = Math.max(0, (hExaggerated + 10000) * 10)
                    data[i] = Math.floor(value / 65536)
                    data[i + 1] = Math.floor((value % 65536) / 256)
                    data[i + 2] = Math.floor(value % 256)
                    // alpha is data[i + 3] = 255 which is already set
                }

                context.putImageData(imageData, 0, 0)
                resolve(canvas)
            }
            image.onerror = () => {
                console.error(
                    `AWSTerrariumElevationProvider Failed to load tile: ${url}`
                )
                reject()
            }
            image.src = url
        })
    }
}
