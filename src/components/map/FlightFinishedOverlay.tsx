import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
    Route,
    TrendingUp,
    Mountain,
    Clock,
    Gauge,
    Zap,
    RotateCcw,
    Share2,
    Check,
    Loader2,
    Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import type { GpxStats } from '../../lib/gpxStats'

interface FlightFinishedOverlayProps {
    points: { lat: number; lon: number }[]
    stats: GpxStats
    gpxContent: string
    shareId?: string | null
    onRestart: () => void
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}

async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch (_) {}

    try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.top = '0'
        textArea.style.left = '0'
        textArea.style.position = 'fixed'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        return successful
    } catch (err) {
        console.error('Fallback copy failed', err)
        return false
    }
}

export function FlightFinishedOverlay({
    points,
    stats,
    gpxContent,
    shareId: initialShareId,
    onRestart,
}: FlightFinishedOverlayProps) {
    const pathRef = useRef<SVGPathElement>(null)
    const [pathLength, setPathLength] = useState(0)
    const [animatePath, setAnimatePath] = useState(false)

    // Sharing states
    const [shareId, setShareId] = useState<string | null>(
        initialShareId || null
    )
    const [isSharing, setIsSharing] = useState(false)
    const [copied, setCopied] = useState(false)

    // Calculate projection for green-themed SVG track map
    const { path, viewBox } = useMemo(() => {
        const width = 360
        const height = 180
        const padding = 16

        if (!points || points.length === 0) {
            return { path: '', viewBox: `0 0 ${width} ${height}` }
        }

        let minLat = Infinity
        let maxLat = -Infinity
        let minLon = Infinity
        let maxLon = -Infinity

        for (const p of points) {
            if (p.lat < minLat) minLat = p.lat
            if (p.lat > maxLat) maxLat = p.lat
            if (p.lon < minLon) minLon = p.lon
            if (p.lon > maxLon) maxLon = p.lon
        }

        const latRange = maxLat - minLat || 1
        const lonRange = maxLon - minLon || 1

        const chartWidth = width - 2 * padding
        const chartHeight = height - 2 * padding

        // Scale to fit while maintaining aspect ratio
        const scale = Math.min(chartWidth / lonRange, chartHeight / latRange)

        const offsetX = (width - lonRange * scale) / 2
        const offsetY = (height - latRange * scale) / 2

        const project = (lat: number, lon: number) => {
            const x = offsetX + (lon - minLon) * scale
            // Y inverted: SVG 0 is top, latitude max is top
            const y = height - (offsetY + (lat - minLat) * scale)
            return `${x.toFixed(1)},${y.toFixed(1)}`
        }

        const pathData = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${project(p.lat, p.lon)}`)
            .join(' ')

        return { path: pathData, viewBox: `0 0 ${width} ${height}` }
    }, [points])

    // Track path rendering animation
    useEffect(() => {
        if (pathRef.current) {
            const length = pathRef.current.getTotalLength()
            setPathLength(length)
        }

        const timer = setTimeout(() => {
            setAnimatePath(true)
        }, 500)

        return () => clearTimeout(timer)
    }, [path])

    const handleShare = async () => {
        const generatedUrl = shareId
            ? `${window.location.origin}/share/${shareId}`
            : null
        if (generatedUrl) {
            const success = await copyToClipboard(generatedUrl)
            if (success) {
                setCopied(true)
                toast.success('Link copied to clipboard!')
                setTimeout(() => setCopied(false), 2000)
            } else {
                toast.error('Failed to copy share link. Please copy manually.')
            }
            return
        }

        setIsSharing(true)
        try {
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ gpxContent }),
            })

            if (!response.ok) {
                throw new Error('Failed to create share link')
            }

            const data = await response.json()
            setShareId(data.id)

            // Copy to clipboard immediately
            const url = `${window.location.origin}/share/${data.id}`
            const success = await copyToClipboard(url)
            if (success) {
                setCopied(true)
                toast.success('Track shared & link copied!')
                setTimeout(() => setCopied(false), 2000)
            } else {
                toast.success('Track shared successfully!')
            }
        } catch (error) {
            console.error('Error sharing track:', error)
            toast.error('Failed to generate sharing link. Please try again.')
        } finally {
            setIsSharing(false)
        }
    }

    const renderValue = (val: string) => {
        if (val === 'N/A') {
            return (
                <span className="font-roboto-flex font-[1000] tracking-tight text-muted-foreground/60">
                    N/A
                </span>
            )
        }

        const parts = val.split(/([+-]?\d+(?:\.\d+)?)/)
        return parts.map((part, index) => {
            if (!part) return null
            const isNumber = index % 2 === 1
            if (isNumber) {
                return (
                    <span
                        key={index}
                        className="font-roboto-flex font-[1000] tracking-tight text-foreground"
                    >
                        {part}
                    </span>
                )
            } else {
                const hasLeadingSpace = part.startsWith(' ')
                const hasTrailingSpace = part.endsWith(' ')
                const trimmed = part.trim()
                if (!trimmed) {
                    return (
                        <span key={index} className="mx-1 inline-block"></span>
                    )
                }
                return (
                    <React.Fragment key={index}>
                        {hasLeadingSpace && <span className="mx-0.5"></span>}
                        <span className="text-xs font-semibold text-muted-foreground/90 tracking-normal select-none lowercase align-baseline ml-0.5">
                            {trimmed}
                        </span>
                        {hasTrailingSpace && <span className="mx-0.5"></span>}
                    </React.Fragment>
                )
            }
        })
    }

    const statsList = useMemo(() => {
        const durationVal = stats.movingTimeS ?? stats.totalDurationS
        const speedVal = stats.avgMovingSpeedKmh ?? stats.avgSpeedKmh

        return [
            {
                icon: <Route className="w-4 h-4 text-primary" />,
                label: 'Distance',
                value: `${stats.totalDistanceKm.toFixed(2)} km`,
                delay: '150ms',
            },
            {
                icon: <TrendingUp className="w-4 h-4 text-primary" />,
                label: 'Elev. Gain',
                value: `+${stats.elevationGainM} m`,
                delay: '300ms',
            },
            {
                icon: <Mountain className="w-4 h-4 text-primary" />,
                label: 'Highest Peak',
                value: `${stats.highestElevationM} m`,
                delay: '450ms',
            },
            {
                icon: <Clock className="w-4 h-4 text-primary" />,
                label: 'Duration',
                value: durationVal ? formatDuration(durationVal) : 'N/A',
                delay: '600ms',
            },
            {
                icon: <Gauge className="w-4 h-4 text-primary" />,
                label: 'Avg Speed',
                value: speedVal ? `${speedVal.toFixed(1)} km/h` : 'N/A',
                delay: '750ms',
            },
            {
                icon: <Zap className="w-4 h-4 text-primary" />,
                label: 'Max Speed',
                value:
                    stats.maxSpeedKmh !== null
                        ? `${stats.maxSpeedKmh.toFixed(1)} km/h`
                        : 'N/A',
                delay: '900ms',
            },
        ]
    }, [stats])

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 md:p-8 animate-in fade-in duration-700 flex justify-center items-start md:items-center">
            <div className="max-w-xl w-full my-auto flex flex-col items-center gap-6 md:gap-8 animate-in slide-in-from-bottom-8 zoom-in-95 duration-500 cubic-bezier(0.16, 1, 0.3, 1) py-8 px-6 md:px-10 bg-card/95 border border-border/40 rounded-3xl shadow-2xl">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-heading">
                        Track Completed!
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto font-semibold">
                        {stats.trackName}
                    </p>
                </div>

                {/* SVG Path Canvas */}
                <div className="relative w-full max-w-xs h-32 md:h-40 flex items-center justify-center overflow-hidden">
                    {path && (
                        <svg
                            viewBox={viewBox}
                            className="w-full h-full p-2 drop-shadow-[0_0_8px_var(--primary)] select-none"
                            preserveAspectRatio="xMidYMid meet"
                            style={{
                                filter: 'drop-shadow(0px 0px 8px oklch(0.62 0.11 135 / 35%))',
                            }}
                        >
                            {/* Static Shadow/Guide Path */}
                            <path
                                d={path}
                                fill="none"
                                stroke="var(--border)"
                                strokeWidth="2"
                                className="opacity-30"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {/* Animated Active Track Path */}
                            <path
                                ref={pathRef}
                                d={path}
                                fill="none"
                                stroke="var(--primary)"
                                strokeWidth="3"
                                strokeDasharray={pathLength || 1000}
                                strokeDashoffset={
                                    animatePath ? 0 : pathLength || 1000
                                }
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    transition:
                                        'stroke-dashoffset 2.5s cubic-bezier(0.22, 1, 0.36, 1)',
                                }}
                            />
                        </svg>
                    )}
                </div>

                {/* Staggered Grid Reveal of Stats (clean text, no cards, no borders) */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8 w-full mt-2 justify-items-center">
                    {statsList.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex flex-col items-center text-center transition-all duration-300 opacity-0"
                            style={{
                                animation:
                                    'slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                                animationDelay: item.delay,
                            }}
                        >
                            <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground select-none">
                                {item.icon}
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {item.label}
                                </span>
                            </div>
                            <div className="text-xl md:text-2xl font-[1000] text-foreground tracking-tight tabular-nums leading-none flex items-baseline justify-center flex-wrap">
                                {renderValue(item.value)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Share Link Display */}
                {shareId && (
                    <div className="w-full max-w-md bg-foreground/5 border border-border/40 rounded-xl p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-4 md:mt-6">
                        <span className="text-xs font-mono truncate text-muted-foreground/80 select-all max-w-[70%]">
                            {`${window.location.origin}/share/${shareId}`}
                        </span>
                        <button
                            onClick={async () => {
                                const generatedUrl = `${window.location.origin}/share/${shareId}`
                                const success =
                                    await copyToClipboard(generatedUrl)
                                if (success) {
                                    setCopied(true)
                                    toast.success('Link copied to clipboard!')
                                    setTimeout(() => setCopied(false), 2000)
                                } else {
                                    toast.error(
                                        'Failed to copy. Please copy manually.'
                                    )
                                }
                            }}
                            className="flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs shrink-0"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Bottom Actions */}
                <div
                    className={`flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md ${shareId ? 'mt-1 md:mt-2' : 'mt-4'}`}
                >
                    <button
                        onClick={handleShare}
                        disabled={isSharing}
                        className="flex items-center justify-center gap-2 bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold px-6 py-3 rounded-xl transition-all cursor-pointer text-sm w-full sm:w-1/2 disabled:opacity-50"
                    >
                        {isSharing ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : copied ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                            <Share2 className="w-4 h-4 text-primary" />
                        )}
                        {isSharing
                            ? 'Sharing...'
                            : copied
                              ? 'Link Copied!'
                              : 'Share Route'}
                    </button>

                    <button
                        onClick={onRestart}
                        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-3 rounded-xl transition-all shadow-md shadow-primary/10 hover:scale-[1.02] cursor-pointer text-sm w-full sm:w-1/2"
                    >
                        <RotateCcw className="w-4 h-4 animate-spin-reverse" />
                        Replay Track
                    </button>
                </div>
            </div>

            {/* Injected custom styles for staggered animations */}
            <style>{`
                @keyframes slideUpFade {
                    from {
                        opacity: 0;
                        transform: translateY(16px) scale(0.97);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                .animate-spin-reverse {
                    animation: spin-rev 3s linear infinite paused;
                }
                button:hover .animate-spin-reverse {
                    animation-play-state: running;
                }
                @keyframes spin-rev {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }
            `}</style>
        </div>
    )
}
