import { MapProvider } from "geo-three";

// Constants
export const MAX_ZOOM = 19;

// We use the standard MapProvider class and override the HTTP fetch string
// to easily use the Esri Basemap styles without needing a dedicated EsriProvider class, since we just need tile URLs.
export class EsriWorldImageryProvider extends MapProvider {
  public apiKey: string;

  public constructor(apiKey: string = "") {
    super();
    this.apiKey = apiKey;
    this.minZoom = 6;
  }

  public fetchTile(
    zoom: number,
    x: number,
    y: number,
  ): Promise<HTMLImageElement | HTMLCanvasElement | ImageBitmap> {
    // According to user request: basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/tiles/imagery/{z}/{y}/{x}?token=ESRI_API_KEY
    // and using 512x resolution
    // const url = `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/static/tile/${zoom}/${y}/${x}?token=${this.apiKey}`;
    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        console.error(`EsriProvider Failed to load tile: ${url}`);
        reject();
      };
      image.crossOrigin = "Anonymous";
      image.src = url;
    });
  }
}

export class EsriLabelProvider extends MapProvider {
  public apiKey: string;

  public constructor(apiKey: string = "") {
    super();
    this.apiKey = apiKey;
    this.minZoom = 1;
    this.maxZoom = 19;
  }

  public fetchTile(
    zoom: number,
    x: number,
    y: number,
  ): Promise<HTMLImageElement | HTMLCanvasElement | ImageBitmap> {
    const esriZoom = zoom - 1;
    return new Promise((resolve, reject) => {
      const image = document.createElement("img");
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.crossOrigin = "Anonymous";
      // ✅ Correct path — labels overlay for imagery style
      image.src = `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/${esriZoom}/${y}/${x}?token=${this.apiKey}`;
    });
  }
}

// Custom Elevation provider for AWS Terrarium RGB tiles
export class AWSTerrariumElevationProvider extends MapProvider {
  public constructor() {
    super();
  }

  public fetchTile(
    zoom: number,
    x: number,
    y: number,
  ): Promise<HTMLImageElement | HTMLCanvasElement | ImageBitmap> {
    // AWS Elevation Tiles: s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        console.error(
          `AWSTerrariumElevationProvider Failed to load tile: ${url}`,
        );
        reject();
      };
      image.crossOrigin = "Anonymous";
      image.src = url;
    });
  }

  public elevationData(
    image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  ): Float32Array {
    let canvas: HTMLCanvasElement;
    if (image instanceof HTMLCanvasElement) {
      canvas = image;
    } else {
      canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (context) {
        // Ignore the typescript error if drawing ImageBitmap, context.drawImage supports it.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context.drawImage(image as any, 0, 0);
      }
    }

    const context = canvas.getContext("2d");
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);

    const size = canvas.width * canvas.height;
    const data = new Float32Array(size);

    if (imageData) {
      // Terrarium format: height = (red * 256 + green + blue / 256) - 32768
      for (let i = 0; i < size; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        data[i] = r * 256.0 + g + b / 256.0 - 32768.0;
      }
    }

    return data;
  }
}
