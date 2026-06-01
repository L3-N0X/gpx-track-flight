import { useState, useEffect, useRef } from 'react'
import {
    Play,
    Pause,
    RotateCcw,
    ChevronUp,
    Square,
    Settings,
} from 'lucide-react'
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
        isRecording,
        setIsRecording,
        isFinished,
        setIsFinished,
    } = useDroneFlight()
    const [isExpanded, setIsExpanded] = useState(true)
    const progressBarRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const thumbRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)

    // Collapse settings panel when recording starts so it is hidden in the video
    useEffect(() => {
        if (isRecording) {
            setIsExpanded(false)
        }
    }, [isRecording])

    // Use requestAnimationFrame to update the progress bar and thumb at 60fps without React re-renders
    useEffect(() => {
        let animationFrameId: number

        const updateProgress = () => {
            const percent = (progressRef.current * 100).toFixed(2)
            if (progressBarRef.current) {
                progressBarRef.current.style.width = `${percent}%`
            }
            if (thumbRef.current) {
                thumbRef.current.style.left = `${percent}%`
            }
            animationFrameId = requestAnimationFrame(updateProgress)
        }

        updateProgress()

        return () => cancelAnimationFrame(animationFrameId)
    }, [progressRef])

    const handleProgressScrub = (clientX: number) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        // Subtract border padding (p-[3px] is 6px total) to align 0-100% perfectly
        const innerWidth = rect.width - 6
        const clickX = clientX - rect.left - 3
        const percentage = Math.max(0, Math.min(1, clickX / innerWidth))
        progressRef.current = percentage

        if (percentage < 0.999 && isFinished) {
            setIsFinished(false)
        }

        const percentStr = `${(percentage * 100).toFixed(2)}%`
        if (progressBarRef.current) {
            progressBarRef.current.style.width = percentStr
        }
        if (thumbRef.current) {
            thumbRef.current.style.left = percentStr
        }
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return // Left click only
        isDragging.current = true
        setIsPlaying(false)
        handleProgressScrub(e.clientX)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (isDragging.current) {
                handleProgressScrub(moveEvent.clientX)
            }
        }

        const handleMouseUp = () => {
            isDragging.current = false
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        isDragging.current = true
        setIsPlaying(false)
        if (e.touches.length > 0) {
            handleProgressScrub(e.touches[0].clientX)
        }

        const handleTouchMove = (moveEvent: TouchEvent) => {
            if (isDragging.current && moveEvent.touches.length > 0) {
                handleProgressScrub(moveEvent.touches[0].clientX)
            }
        }

        const handleTouchEnd = () => {
            isDragging.current = false
            window.removeEventListener('touchmove', handleTouchMove)
            window.removeEventListener('touchend', handleTouchEnd)
        }

        window.addEventListener('touchmove', handleTouchMove)
        window.addEventListener('touchend', handleTouchEnd)
    }

    const speeds =
        mode === 'track-speed' ? [10, 25, 50, 100, 200] : [0.5, 1, 2, 5, 10]

    return (
        <>
            {/* Top Overlay: Controls with transition animations */}
            <div
                className={`absolute top-4 right-4 z-20 border border-border bg-background/75 backdrop-blur-md pointer-events-auto shadow-lg transition-all duration-300 ease-in-out flex flex-col overflow-hidden select-none ${
                    isExpanded
                        ? 'w-56 h-[340px] p-2 rounded-xl'
                        : 'w-9 h-9 p-0 rounded-lg justify-center items-center cursor-pointer hover:text-foreground hover:bg-background text-muted-foreground'
                }`}
                onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
            >
                {/* Collapsed Gear Icon */}
                <div
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                        isExpanded
                            ? 'opacity-0 pointer-events-none scale-75'
                            : 'opacity-100 scale-100'
                    }`}
                >
                    <Settings size={18} />
                </div>

                {/* Expanded Card Content */}
                <div
                    className={`flex flex-col h-full transition-all duration-300 w-full ${
                        isExpanded
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 pointer-events-none scale-90'
                    }`}
                >
                    <div
                        className="flex items-center justify-between text-sm font-semibold text-muted-foreground px-2 py-1 cursor-pointer hover:text-foreground transition-colors select-none w-full"
                        onClick={(e) => {
                            e.stopPropagation() // Prevent container click event
                            setIsExpanded(false)
                        }}
                    >
                        <span>Flight Settings</span>
                        <ChevronUp size={16} />
                    </div>

                    <div className="flex flex-col gap-3 px-2 pb-2 mt-2 w-full">
                        <div className="flex justify-center">
                            <button
                                onClick={() => {
                                    if (canPlay) {
                                        if (isPlaying) {
                                            setIsPlaying(false)
                                            return
                                        }

                                        if (
                                            progressRef.current >= 1 ||
                                            isFinished
                                        ) {
                                            progressRef.current = 0
                                            setIsFinished(false)
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
                                    setIsFinished(false)
                                    onResetCamera()
                                }}
                                disabled={!canReset}
                                className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 disabled:bg-muted/60 disabled:text-muted-foreground text-foreground font-medium py-2 px-6 rounded-md transition-colors w-full disabled:cursor-not-allowed"
                            >
                                <RotateCcw size={16} />
                                Reset Camera
                            </button>
                        </div>

                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => {
                                    if (canPlay) {
                                        setIsRecording(!isRecording)
                                    }
                                }}
                                disabled={!canPlay}
                                className={`flex items-center justify-center gap-2 font-medium py-2 px-6 rounded-md transition-colors w-full disabled:cursor-not-allowed ${
                                    isRecording
                                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                                        : 'bg-muted hover:bg-muted/80 disabled:bg-muted/60 disabled:text-muted-foreground text-foreground'
                                }`}
                            >
                                {isRecording ? (
                                    <>
                                        <Square
                                            size={16}
                                            className="fill-current"
                                        />
                                        <span className="animate-pulse">
                                            Stop Recording
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2.5 h-2.5 bg-red-600 rounded-full inline-block animate-pulse"></span>
                                        <span>Record Flight</span>
                                    </>
                                )}
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
            </div>

            {/* Bottom Progress Slider */}
            <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-8rem)] md:w-96 h-8 flex items-center justify-center opacity-85 hover:opacity-100 transition-opacity duration-300 pointer-events-auto group cursor-pointer"
            >
                {/* Track Background */}
                <div className="w-full bg-background/75 backdrop-blur-md rounded-full h-3 border border-border p-[3px] flex items-center shadow-md">
                    <div className="relative w-full h-1.5 bg-muted/40 rounded-full overflow-visible">
                        {/* Filled Track */}
                        <div
                            ref={progressBarRef}
                            className="bg-primary h-full rounded-full absolute left-0 top-0 transition-none"
                            style={{ width: '0%' }}
                        ></div>
                        {/* Thumb */}
                        <div
                            ref={thumbRef}
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary border border-foreground/10 rounded-full shadow-lg transition-transform duration-150 scale-0 group-hover:scale-100 -translate-x-1/2"
                            style={{ left: '0%' }}
                        ></div>
                    </div>
                </div>
                <div className="absolute -top-6 text-xs font-semibold text-foreground bg-background/75 px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Drag to Scrub Flight
                </div>
            </div>
        </>
    )
}
