# GPX Track Flight 3D Visualizer

A high-performance, premium 3D GPX flight visualizer built with **React**, **Three.js**, and **React Three Fiber (R3F)**, powered by **Vite** and **Bun**. 

This application parses standard GPX files (mountain biking, hiking, road cycling, etc.), maps the track coordinates to 3D space, fetches matching satellite imagery and elevation data, and renders a cinematic, smooth drone-flight simulation following the GPX path.

This is an **open-source, 100% free alternative** to **Relive** and **SportsTracks** visualizers. The application is already fully functional and ready to use, though active development is ongoing and additional features are planned. It is optimized for self-hosting, and pre-built Docker container builds are available directly from the **GitHub Packages** section of this repository.

---

## ⚡ Key Features

- 🛰️ **Custom Quadtree LOD Tiling Engine**: Ground-up R3F terrain engine replacing heavy libraries. Dynamically loads, subdivides, and simplifies terrain tiles on-the-fly based on camera distance, supporting up to level 17 high-resolution details.
- 🏞️ **DEM Terrain Displacement**: Decodes AWS Terrarium RGB elevation tiles to raw height maps on the CPU, displacing tile mesh vertices to form accurate 3D mountains, ridges, and valleys.
- 🌍 **Seamless Edges (Tile Skirts)**: Generates vertical skirts at tile boundaries and synchronizes boundary normal vectors. This seals visual gaps between adjacent Level-of-Detail (LOD) tiles without causing shading creases or "mosaic valleys".
- 🎮 **Interactive Flight Scrubbing**: A custom, YouTube-style progress slider allowing real-time scrubbing. Dragging the slider automatically pauses the flight and snaps the camera instantly to that track point.
- 🎥 **HD Video Recording (with UI Overlays)**: Records flights directly in-browser using the native Screen Capture API. Captures the full tab viewport (WebGL + HTML UI stats/telemetry overlays) at a crisp **15 Mbps bitrate**, exporting to **H.264 MP4** or high-quality WebM.
- 🛸 **Cinematic Drone Camera**: Follows the track smoothly using a Catmull-Rom spline path. Features corner-smoothing, look-ahead target prediction, automatic terrain collision avoidance, and smooth takeoff transitions.
- 🕹️ **Free-Roam Camera**: Pause the flight to explore the 3D map manually using standard FPS keys (`W`, `A`, `S`, `D` for horizontal movement, `Q`/`E` for altitude, and `Shift` for speed boost).
- ⛰️ **Anti-Clipping Protection**: In free-roam mode, the camera shoots a vertical raycast downwards and clamps the camera height to a minimum of **15 meters above the local terrain**, preventing the view from slipping under the map.
- 🏷️ **3D Billboarding Labels**: Renders village and city labels dynamically in 3D space, which orient towards the camera and adjust visibility based on altitude and settlement scale.

---

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (Fast package manager & bundler)
- **Frontend Core**: React 19, TypeScript
- **3D Graphics**: Three.js, React Three Fiber (`@react-three/fiber`)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite 8 (Lightning-fast HMR and bundling)

---

## 📂 Project Structure

```raw
├── src/
│   ├── components/         # React components
│   │   ├── map/            # 3D Map, Camera, Track, Labels & UI Overlays
│   │   │   ├── DroneCamera.tsx          # Follow camera logic & collision avoidance
│   │   │   ├── DroneFlightControls.tsx  # Flight playback, speed, mode & slider UI
│   │   │   ├── FlightRecorder.tsx       # Screen/tab recorder engine (MediaRecorder)
│   │   │   ├── FlightTelemetryOverlay.tsx# Dynamic speed, incline & elevation profile chart
│   │   │   ├── LocationLabels.tsx       # 3D billboard labels for cities
│   │   │   ├── Map3D.tsx                # Canvas entrypoint & scene lighting setup
│   │   │   ├── MapControls.tsx          # Free roam camera controls & anti-clip clamping
│   │   │   ├── TileMap.tsx              # Custom Quadtree LOD terrain renderer
│   │   │   └── Track.tsx                # 3D track line renderer
│   ├── contexts/           # React context providers (DroneFlightContext)
│   ├── lib/                # Mathematical helpers & data loaders
│   │   ├── mapUtils.ts     # Web Mercator projections & coordinate systems
│   │   ├── mapTileLoader.ts# Image & AWS DEM elevation fetching, decoding & caching
│   │   ├── demSampling.ts  # CPU-side height mapping & track elevation snapping
│   │   └── trackTelemetry.ts# Telemetry stats, gradients & local elevation charts
│   ├── App.tsx             # Root React component
│   └── main.tsx            # Entrypoint
├── server.ts               # Local Bun production release server
├── vite.config.ts          # Vite configuration
└── package.json            # Script definitions and npm packages
```

---

## 🚀 Getting Started

### 1. Installation

Ensure you have [Bun](https://bun.sh/) installed.

```bash
# Clone the project and navigate to the directory
cd gpx-track-flight

# Install all dependencies
bun install
```

### 2. Running in Development

```bash
# Run the Vite development server
bun run dev
```

This will spin up the local development site, typically at `http://localhost:5173`. Open it in your browser and upload any GPX track file to visualize.

### 3. Production Build

Verify that the TypeScript types compile and the bundle is compiled successfully:

```bash
# Compile and build the production static files
bun run build
```

The resulting assets will be compiled into the `dist/` folder.

---

## ⚙️ How it Works

### Web Mercator Projection
To render GPS data in Three.js, latitude and longitude coordinates are projected into EPSG:3857 (Web Mercator) coordinates using a custom projection module in `mapUtils.ts`. These coordinates are then centered relative to the start point of the GPX track to avoid floating-point jitter/precision issues at high coordinates.

### CPU Elevation Sampling
Before rendering the 3D track, the track points are processed:
1. The app parses the GPX XML.
2. It fetches matching DEM (Digital Elevation Model) tiles at Zoom 14 from AWS Terrarium.
3. The tiles are decoded on the fly, and `demSampling.ts` samples elevations to snap the GPX points to the exact height of the terrain, guaranteeing that the track follows the terrain profile perfectly.

### Quadtree LOD Tiling
The terrain uses a custom quadtree subdivision algorithm starting from Zoom 10 root tiles around the track bounds:
- If a tile is close to the camera (distance $< 2.4 \times width$), it is split into 4 child tiles.
- If it moves far away (distance $> 2.8 \times width$), it is simplified back into its parent.
- **Hysteresis** prevents rapid, flickering subdivisions.
- **Cache Eviction Protection** locks siblings in memory until all children are fully loaded, avoiding flashing/rendering holes.

---

## 📄 License

This project is open-source and released under the [MIT License](LICENSE).
