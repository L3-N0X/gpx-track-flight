import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { useDroneFlight } from '../../contexts/DroneFlightContext'

export function DroneFlightControls({
    canPlay,
    canReset,
    onResetCamera,
}: {
    canPlay: boolean
    canReset: boolean
    onResetCamera: () => void
}) {
    const {
        isPlaying,
        setIsPlaying,
        speed,
        setSpeed,
        mode,
        setMode,
        progressRef,
    } = useDroneFlight()
    const [isExpanded, setIsExpanded] = useState(true)
    const progressBarRef = useRef<HTMLDivElement>(null)

    // Use requestAnimationFrame to update the progress bar at 60fps without React re-renders
    useEffect(() => {
        let animationFrameId: number

        const updateProgress = () => {
            if (progressBarRef.current) {
                // progressRef.current is a value between 0 and 1
                const percent = (progressRef.current * 100).toFixed(2)
                progressBarRef.current.style.width = `${percent}%`
            }
            animationFrameId = requestAnimationFrame(updateProgress)
        }

        updateProgress()

        return () => cancelAnimationFrame(animationFrameId)
    }, [progressRef])

    const speeds =
        mode === 'track-speed' ? [10, 25, 50, 100, 200] : [0.5, 1, 2, 5, 10]

    return (
        <>
            {/* Top Overlay: Controls */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                {isExpanded ? (
                    <div className="mt-3 bg-background/75 backdrop-blur-md border border-border rounded-xl shadow-lg p-2 min-w-50 flex flex-col gap-3">
                        <div
                            className="flex items-center justify-between text-sm font-semibold text-muted-foreground px-2 py-1 cursor-pointer hover:text-foreground transition-colors select-none"
                            onClick={() => setIsExpanded(false)}
                        >
                            <span>Flight Settings</span>
                            <ChevronUp size={16} />
                        </div>

                        <div className="flex flex-col gap-3 px-2 pb-2">
                            <div className="flex justify-center">
                                <button
                                    onClick={() => {
                                        if (canPlay) {
                                            if (isPlaying) {
                                                setIsPlaying(false)
                                                return
                                            }

                                            if (progressRef.current >= 1) {
                                                progressRef.current = 0
                                            }

                                            setIsPlaying(true)
                                        }
                                    }}
                                    disabled={!canPlay}
                                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-medium py-2 px-6 rounded-md transition-colors w-full disabled:cursor-not-allowed"
                                >
                                    {isPlaying ? (
                                        <Pause size={18} />
                                    ) : (
                                        <Play size={18} />
                                    )}
                                    {!canPlay
                                        ? 'Preparing Flight'
                                        : isPlaying
                                          ? 'Pause'
                                          : 'Play Flight'}
                                </button>
                            </div>

                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPlaying(false)
                                        progressRef.current = 0
                                        onResetCamera()
                                    }}
                                    disabled={!canReset}
                                    className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 disabled:bg-muted/60 disabled:text-muted-foreground text-foreground font-medium py-2 px-6 rounded-md transition-colors w-full disabled:cursor-not-allowed"
                                >
                                    <RotateCcw size={16} />
                                    Reset Camera
                                </button>
                            </div>

                            <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground">
                                    Flight Mode
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setMode('fixed')}
                                        disabled={isPlaying}
                                        className={`px-2 py-2 text-xs font-semibold rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                            mode === 'fixed'
                                                ? 'bg-accent text-accent-foreground border border-ring/50'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                        }`}
                                    >
                                        Fixed Speed
                                    </button>
                                    <button
                                        onClick={() => setMode('track-speed')}
                                        disabled={isPlaying}
                                        className={`px-2 py-2 text-xs font-semibold rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                            mode === 'track-speed'
                                                ? 'bg-accent text-accent-foreground border border-ring/50'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                        }`}
                                    >
                                        Drive Speed
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1 text-center">
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Playback Multiplier
                                </div>
                                <div className="flex gap-1 justify-center">
                                    {speeds.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setSpeed(s)}
                                            className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                                                speed === s
                                                    ? 'bg-accent text-accent-foreground border border-ring/50'
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                            }`}
                                        >
                                            {s}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        className="flex h-5 w-10 items-center justify-center rounded-b-md border-x border-b border-border bg-background/75 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
                        aria-label="Expand flight settings"
                    >
                        <ChevronDown size={16} />
                    </button>
                )}
            </div>

            {/* Bottom Progress Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-96 h-12 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-auto group">
                <div className="w-full bg-background/75 backdrop-blur-md rounded-full h-4 border border-border overflow-hidden cursor-pointer shadow-md">
                    <div
                        ref={progressBarRef}
                        className="bg-primary h-full rounded-full transition-none"
                        style={{ width: '0%' }}
                    ></div>
                </div>
                <div className="absolute -top-6 text-xs font-semibold text-foreground bg-background/75 px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Flight Progress
                </div>
            </div>
        </>
    )
}
