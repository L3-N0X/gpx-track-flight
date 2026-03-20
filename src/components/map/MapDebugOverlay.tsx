export interface MapDebugMetrics {
    fps: number
    frameTimeMs: number
    drawCalls: number
    triangles: number
    geometries: number
    textures: number
    visibleMapMeshes: number
    totalMapMeshes: number
    visibleSceneObjects: number
    cameraX: number
    cameraY: number
    cameraZ: number
    flightProgress: number
    isPlaying: boolean
    speed: number
    curveReady: boolean
}

export interface TrackSamplingStatus {
    sampledPoints: number
    totalPoints: number
    isComplete: boolean
    error: string | null
}

interface MapDebugOverlayProps {
    isOpen: boolean
    metrics: MapDebugMetrics | null
    terrainReady: boolean
    trackReady: boolean
    samplingStatus: TrackSamplingStatus | null
}

function formatNumber(value: number) {
    return Number.isFinite(value) ? value.toFixed(1) : '0.0'
}

export function MapDebugOverlay({
    isOpen,
    metrics,
    terrainReady,
    trackReady,
    samplingStatus,
}: MapDebugOverlayProps) {
    if (!isOpen) {
        return null
    }

    const sampledPoints = samplingStatus?.sampledPoints ?? 0
    const totalPoints = samplingStatus?.totalPoints ?? 0
    const samplingPercent =
        totalPoints > 0 ? ((sampledPoints / totalPoints) * 100).toFixed(0) : '0'

    return (
        <div className="absolute top-4 left-4 z-20 w-80 bg-slate-950/85 text-slate-100 border border-slate-700 rounded-lg shadow-xl backdrop-blur-md pointer-events-none">
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold tracking-wide">
                    Debug Overlay
                </span>
                <span className="text-[11px] text-slate-400">Toggle: I</span>
            </div>

            <div className="p-3 space-y-3 text-xs">
                <section className="space-y-1">
                    <div className="font-semibold text-slate-300">Renderer</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <span>FPS</span>
                        <span>
                            {metrics ? formatNumber(metrics.fps) : '...'}
                        </span>
                        <span>Frame ms</span>
                        <span>
                            {metrics
                                ? formatNumber(metrics.frameTimeMs)
                                : '...'}
                        </span>
                        <span>Draw calls</span>
                        <span>{metrics?.drawCalls ?? 0}</span>
                        <span>Triangles</span>
                        <span>{metrics?.triangles ?? 0}</span>
                        <span>Geometries</span>
                        <span>{metrics?.geometries ?? 0}</span>
                        <span>Textures</span>
                        <span>{metrics?.textures ?? 0}</span>
                    </div>
                </section>

                <section className="space-y-1">
                    <div className="font-semibold text-slate-300">
                        Map State
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <span>Terrain ready</span>
                        <span>{terrainReady ? 'yes' : 'no'}</span>
                        <span>Track ready</span>
                        <span>{trackReady ? 'yes' : 'no'}</span>
                        <span>Map meshes</span>
                        <span>
                            {metrics?.visibleMapMeshes ?? 0}/
                            {metrics?.totalMapMeshes ?? 0}
                        </span>
                        <span>Visible objects</span>
                        <span>{metrics?.visibleSceneObjects ?? 0}</span>
                    </div>
                </section>

                <section className="space-y-1">
                    <div className="font-semibold text-slate-300">
                        Track DEM
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <span>Sampled</span>
                        <span>
                            {sampledPoints}/{totalPoints} ({samplingPercent}%)
                        </span>
                        <span>Complete</span>
                        <span>{samplingStatus?.isComplete ? 'yes' : 'no'}</span>
                        <span>Error</span>
                        <span className="truncate">
                            {samplingStatus?.error ?? '-'}
                        </span>
                    </div>
                </section>

                <section className="space-y-1">
                    <div className="font-semibold text-slate-300">Flight</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <span>Playing</span>
                        <span>{metrics?.isPlaying ? 'yes' : 'no'}</span>
                        <span>Speed</span>
                        <span>
                            {metrics
                                ? `${formatNumber(metrics.speed)}x`
                                : '...'}
                        </span>
                        <span>Progress</span>
                        <span>
                            {metrics
                                ? `${(metrics.flightProgress * 100).toFixed(1)}%`
                                : '...'}
                        </span>
                        <span>Curve ready</span>
                        <span>{metrics?.curveReady ? 'yes' : 'no'}</span>
                    </div>
                </section>

                <section className="space-y-1">
                    <div className="font-semibold text-slate-300">Camera</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <span>X</span>
                        <span>
                            {metrics ? formatNumber(metrics.cameraX) : '...'}
                        </span>
                        <span>Y</span>
                        <span>
                            {metrics ? formatNumber(metrics.cameraY) : '...'}
                        </span>
                        <span>Z</span>
                        <span>
                            {metrics ? formatNumber(metrics.cameraZ) : '...'}
                        </span>
                    </div>
                </section>
            </div>
        </div>
    )
}
