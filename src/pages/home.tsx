import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    UploadCloud,
    Map as MapIcon,
    Loader2,
    Layers,
    Cpu,
    Video,
    Tv,
    Gamepad2,
    Sparkles,
    ShieldCheck,
    Terminal,
} from 'lucide-react'

export function HomePage() {
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isHovering, setIsHovering] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const handleFileChange = async (file: File | null) => {
        if (!file) return
        setIsLoading(true)
        try {
            const text = await file.text()
            navigate('/share', { state: { gpxContent: text } })
        } catch (err) {
            console.error('Failed to read file', err)
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center py-12 min-h-[80vh] w-full max-w-6xl mx-auto px-4 text-center animate-in fade-in duration-700">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-8">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>100% Free & Open Source Visualizer</span>
            </div>

            {/* Main Title */}
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-transparent font-heading leading-tight">
                Relive Your{' '}
                <span className="text-primary bg-linear-to-r from-primary to-primary-light bg-clip-text text-transparent">
                    Adventures
                </span>{' '}
                in 3D
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-muted-foreground mb-14 max-w-2xl mx-auto leading-relaxed">
                Import GPX tracks from Garmin, Strava, or Wahoo and visualize
                your hiking, road cycling, and mountain biking tracks on
                realistic 3D satellite elevation maps.
            </p>

            {/* Upload Zone */}
            <div className="w-full max-w-xl mb-8">
                <div
                    className={`relative w-full border-2 border-dashed rounded-3xl p-12 transition-all duration-300 ${isHovering ? 'border-primary bg-primary/5 scale-[1.02] shadow-xl shadow-primary/10' : 'border-border/60 bg-card/30 hover:border-primary/50'} cursor-pointer group shadow-xs`}
                    onDragOver={(e) => {
                        e.preventDefault()
                        setIsHovering(true)
                    }}
                    onDragLeave={() => setIsHovering(false)}
                    onDrop={(e) => {
                        e.preventDefault()
                        setIsHovering(false)
                        handleFileChange(e.dataTransfer.files[0])
                    }}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        accept=".gpx"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) =>
                            handleFileChange(e.target.files?.[0] || null)
                        }
                    />

                    <div className="flex flex-col items-center justify-center">
                        {isLoading ? (
                            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
                        ) : (
                            <div className="bg-primary/10 p-5 rounded-full mb-6 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                                <UploadCloud className="w-10 h-10 text-primary" />
                            </div>
                        )}
                        <h3 className="text-2xl font-semibold mb-2 font-heading">
                            {isLoading
                                ? 'Processing GPX Track...'
                                : 'Upload GPX File'}
                        </h3>
                        <p className="text-muted-foreground text-sm max-w-sm">
                            Drag and drop your file here, or click to browse.
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick trust badges */}
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground/80 mt-2 mb-12">
                <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> No
                    Server Uploads (Client Parsed)
                </span>
                <span className="flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5 text-primary" />{' '}
                    Self-hostable via Docker
                </span>
            </div>

            {/* Feature Showcase Grid */}
            <div className="mt-20 text-left w-full">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4 bg-linear-to-br from-foreground to-foreground/80 bg-clip-text text-transparent">
                        Engineered for High-Performance 3D Exploration
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        Equipped with custom WebGL components that render
                        real-world maps smoothly right inside your web browser.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                    {/* Card 1: Custom Quadtree */}
                    <div className="bg-card/40 hover:bg-card/60 transition-all hover:border-primary/30 duration-300 p-8 rounded-3xl border border-border/50 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                                <Layers className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-heading">
                                Custom Quadtree LOD
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                A ground-up React Three Fiber terrain engine
                                that dynamically loads, subdivides, and caches
                                maps based on camera distance, supporting up to
                                level 17 high-res details.
                            </p>
                        </div>
                    </div>

                    {/* Card 2: DEM Displacement */}
                    <div className="bg-card/40 hover:bg-card/60 transition-all hover:border-primary/30 duration-300 p-8 rounded-3xl border border-border/50 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                                <Cpu className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-heading">
                                AWS Elevation Mapping
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Decodes AWS Terrarium elevation tiles to raw
                                heights on the CPU, displacing WebGL tile mesh
                                vertices to accurately shape 3D mountains,
                                ridges, and valleys.
                            </p>
                        </div>
                    </div>

                    {/* Card 3: Seamless Edges */}
                    <div className="bg-card/40 hover:bg-card/60 transition-all hover:border-primary/30 duration-300 p-8 rounded-3xl border border-border/50 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                                <MapIcon className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-heading">
                                Seamless Tile Edges
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Generates custom vertical tile skirts and
                                synchronizes border normal vectors, blocking
                                holes and visual seams between adjacent
                                Level-of-Detail tiles.
                            </p>
                        </div>
                    </div>

                    {/* Card 4: Cinematic Drone */}
                    <div className="bg-card/40 hover:bg-card/60 transition-all hover:border-primary/30 duration-300 p-8 rounded-3xl border border-border/50 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                                <Tv className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-heading">
                                Cinematic Drone Camera
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Follows the GPX path using a Catmull-Rom spline
                                with look-ahead prediction, corner-smoothing,
                                and terrain height clamping to prevent clipping.
                            </p>
                        </div>
                    </div>

                    {/* Card 5: HD Recording */}
                    <div className="bg-card/40 hover:bg-card/60 transition-all hover:border-primary/30 duration-300 p-8 rounded-3xl border border-border/50 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                                <Video className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-heading">
                                HD Video Export
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Records directly in-browser using the native
                                Screen Capture API. Captures both high-fps 3D
                                maps and telemetry overlays into a crisp 15 Mbps
                                H.264 MP4 file.
                            </p>
                        </div>
                    </div>

                    {/* Card 6: Free-Roam Controls */}
                    <div className="bg-card/40 hover:bg-card/60 transition-all hover:border-primary/30 duration-300 p-8 rounded-3xl border border-border/50 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                                <Gamepad2 className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 font-heading">
                                Free-Roam Mode
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Pause flight tracking anytime to fly around
                                using standard FPS W/A/S/D keys. Raycasting
                                protections prevent the camera from going below
                                topography.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* How It Works Section */}
            <div className="mt-28 w-full border-t border-border/40 pt-20">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4 bg-linear-to-br from-foreground to-foreground/80 bg-clip-text text-transparent">
                        How It Works Under the Hood
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        From raw GPS logs to a fully interactive 3D WebGL
                        simulator.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
                    <div className="flex flex-col items-center text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-4 shadow-md shadow-primary/20">
                            1
                        </div>
                        <h4 className="font-semibold text-lg mb-2">
                            Import GPX
                        </h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            Drag and drop any activity file. We parse XML track
                            points instantly locally on the client.
                        </p>
                    </div>

                    <div className="flex flex-col items-center text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-4 shadow-md shadow-primary/20">
                            2
                        </div>
                        <h4 className="font-semibold text-lg mb-2">
                            AWS Elevation Fetch
                        </h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            The engine resolves matching AWS Terrarium elevation
                            tiles and fetches satellite imagery.
                        </p>
                    </div>

                    <div className="flex flex-col items-center text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-4 shadow-md shadow-primary/20">
                            3
                        </div>
                        <h4 className="font-semibold text-lg mb-2">
                            CPU Displacement
                        </h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            Grid heights are calculated on the CPU, displacing
                            Three.js vertices to sculpt realistic mountains.
                        </p>
                    </div>

                    <div className="flex flex-col items-center text-center p-4">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-4 shadow-md shadow-primary/20">
                            4
                        </div>
                        <h4 className="font-semibold text-lg mb-2">
                            Fly & Record
                        </h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            The cinematic drone camera tracks your route, and
                            you can record a high-definition video export.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
