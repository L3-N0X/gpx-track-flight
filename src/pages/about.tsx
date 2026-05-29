import {
    Cpu,
    Layers,
    Video,
    Gamepad2,
    Compass,
    Mountain,
    ShieldCheck,
    Terminal,
    Zap,
    Map,
    Tv,
    Eye,
} from 'lucide-react'

export function AboutPage() {
    return (
        <div className="max-w-5xl w-full mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section */}
            <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
                    <Zap className="w-4 h-4" />
                    <span>Open-Source Flight Visualizer</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold font-heading tracking-tight mb-6 bg-linear-to-r from-foreground via-foreground/80 to-foreground/60 bg-clip-text text-transparent">
                    About GPX Track Flight
                </h1>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    A high-performance, premium 3D GPX flight visualizer built
                    with <strong>React</strong>, <strong>Three.js</strong>, and{' '}
                    <strong>React Three Fiber</strong>. Map your rides, hikes,
                    or runs onto real-world terrain and experience them
                    cinematically.
                </p>

                {/* Badges / Quick Info */}
                <div className="flex flex-wrap justify-center gap-4 mt-8">
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-sm font-medium shadow-xs">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        100% Free & Open Source
                    </span>
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-sm font-medium shadow-xs">
                        <Layers className="w-4 h-4 text-primary" />
                        Level 17 High-Res Imagery
                    </span>
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-sm font-medium shadow-xs">
                        <Cpu className="w-4 h-4 text-primary" />
                        GPU-Accelerated 3D Terrain
                    </span>
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-sm font-medium shadow-xs">
                        <Terminal className="w-4 h-4 text-primary" />
                        Self-Hostable with Docker
                    </span>
                </div>
            </div>

            {/* Main Stats / Pillars Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                <div className="bg-card/40 border border-border/60 rounded-3xl p-8 hover:border-primary/30 transition-all duration-300">
                    <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                        <Mountain className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-4 font-heading">
                        The Mission
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Commercial flight visualizers often lock key
                        customization options, video exports, or map resolution
                        behind monthly subscriptions. GPX Track Flight was built
                        to be a{' '}
                        <strong>fully free, high-fidelity alternative</strong>{' '}
                        to services like Relive and SportsTracks.
                    </p>
                    <p className="text-muted-foreground mt-4 leading-relaxed">
                        By combining public satellite feeds and AWS DEM (Digital
                        Elevation Model) terrain files with a lightweight custom
                        WebGL renderer, it recreates your outdoor paths with
                        breathtaking realism and smooth playback directly in
                        your web browser.
                    </p>
                </div>

                <div className="bg-card/40 border border-border/60 rounded-3xl p-8 hover:border-primary/30 transition-all duration-300 flex flex-col justify-between">
                    <div>
                        <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                            <Compass className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold mb-4 font-heading">
                            How It Works
                        </h2>
                        <p className="text-muted-foreground leading-relaxed mb-4">
                            When you drop a GPX file into the app, it projects
                            the geographic coordinates to Web Mercator
                            coordinates, centers them to avoid WebGL jitter, and
                            fetches matching AWS Terrarium elevation tiles.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            A custom LOD (Level-of-Detail) engine dynamically
                            tiles the terrain on-the-fly, allowing you to fly
                            over high-resolution mountains and deep valleys
                            without grinding your browser to a halt.
                        </p>
                    </div>
                </div>
            </div>

            {/* Core Capabilities */}
            <div className="mb-16">
                <h2 className="text-3xl font-bold text-center mb-10 font-heading">
                    Core Capabilities
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card/30 border border-border/40 hover:bg-card/50 transition-colors p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Layers className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">
                                Quadtree LOD Engine
                            </h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Subdivides map tiles dynamically based on camera
                            distance, rendering up to level 17 high-res
                            satellite details with seamless tile skirts to block
                            rendering gaps.
                        </p>
                    </div>

                    <div className="bg-card/30 border border-border/40 hover:bg-card/50 transition-colors p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Tv className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">
                                Cinematic Drone Camera
                            </h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Sweeps along the GPX path using smart Catmull-Rom
                            splines, offering corner smoothing, predictive
                            look-ahead targets, and automatic terrain collision
                            avoidance.
                        </p>
                    </div>

                    <div className="bg-card/30 border border-border/40 hover:bg-card/50 transition-colors p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Video className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">
                                HD In-Browser Recording
                            </h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Record flights directly inside the browser at 15
                            Mbps. Captures both WebGL imagery and dynamic
                            telemetry overlays, exporting directly to H.264 MP4.
                        </p>
                    </div>

                    <div className="bg-card/30 border border-border/40 hover:bg-card/50 transition-colors p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Gamepad2 className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">
                                Free-Roam Flight Mode
                            </h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Pause the cinematic tracking at any time to freely
                            fly around using standard WASD keys, with
                            anti-clipping protection keeping you above the
                            topography.
                        </p>
                    </div>

                    <div className="bg-card/30 border border-border/40 hover:bg-card/50 transition-colors p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Map className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">
                                Interactive Telemetry
                            </h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            An interactive scrubber slider lets you jump to any
                            track point, showing speed, incline, height, and
                            active elevation charts synchronously.
                        </p>
                    </div>

                    <div className="bg-card/30 border border-border/40 hover:bg-card/50 transition-colors p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Eye className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">
                                3D Billboarding Labels
                            </h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Places 3D text labels for cities and landmarks
                            directly in the virtual space. Labels orient towards
                            the camera and filter based on camera height.
                        </p>
                    </div>
                </div>
            </div>

            {/* Technical Self-Hosting / Deployment Info */}
            <div className="bg-linear-to-br from-card to-card/60 border border-border/80 rounded-3xl p-8 md:p-10 mb-8">
                <div className="flex flex-col md:flex-row gap-8 items-start justify-between">
                    <div className="max-w-xl">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4 font-heading">
                            Host It Yourself
                        </h2>
                        <p className="text-muted-foreground leading-relaxed mb-4">
                            GPX Track Flight is fully optimized for
                            containerized environments. Deploy it locally or on
                            your home server in seconds.
                        </p>
                        <ul className="space-y-2 text-muted-foreground text-sm">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />{' '}
                                Pre-built images on GitHub Container Registry
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />{' '}
                                Zero external database setup required to start
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />{' '}
                                Powered by high-speed Bun runtime environment
                            </li>
                        </ul>
                    </div>
                    <div className="w-full md:w-auto bg-black/30 dark:bg-black/60 border border-white/5 rounded-2xl p-5 font-mono text-xs text-emerald-400 select-all shadow-inner">
                        <div className="flex justify-between items-center text-muted-foreground mb-3 text-[10px] uppercase tracking-wider font-sans border-b border-white/5 pb-2">
                            <span>Docker Launch</span>
                            <span className="text-emerald-500/80">cli</span>
                        </div>
                        <p className="text-white/40">
                            # Run via Docker Hub / GHCR
                        </p>
                        <p className="mt-1">
                            docker run -d -p 3000:3000
                            ghcr.io/l3-n0x/gpx-track-flight:latest
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
