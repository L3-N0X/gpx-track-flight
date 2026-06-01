import React, { useEffect, useState, useMemo, cloneElement } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import {
    Loader2,
    ArrowLeft,
    Mountain,
    TrendingUp,
    TrendingDown,
    Gauge,
    Clock,
    Compass,
    Download,
    Play,
    ShieldAlert,
    Share2,
    Copy,
    Zap,
    Percent,
} from 'lucide-react'
import { toast } from 'sonner'
import { parseGpx } from '../lib/gpxParser'
import { computeGpxStats } from '../lib/gpxStats'
import { LeafletTrackMap } from '../components/map/LeafletTrackMap'
import { ElevationProfile } from '../components/map/ElevationProfile'

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

interface StatCardProps {
    icon: React.ReactElement<{ className?: string }>
    title: string
    value: string
}

function StatCard({ icon, title, value }: StatCardProps) {
    const bgIcon = cloneElement(icon, {
        className:
            'w-20 h-20 absolute -right-4 -bottom-4 text-primary opacity-12 group-hover:opacity-22 group-hover:scale-115 group-hover:rotate-6 transition-all duration-500 ease-out pointer-events-none',
    })

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
                        <span className="text-xs sm:text-sm lg:text-base font-semibold text-muted-foreground/90 tracking-normal select-none lowercase align-baseline ml-0.5">
                            {trimmed}
                        </span>
                        {hasTrailingSpace && <span className="mx-0.5"></span>}
                    </React.Fragment>
                )
            }
        })
    }

    return (
        <div className="relative overflow-hidden bg-card/45 backdrop-blur-md border border-border/40 py-3 px-4 rounded-2xl flex flex-col justify-between shadow-xs transition-all hover:bg-card/65 hover:border-primary/20 hover:scale-[1.02] active:scale-[0.98] duration-300 group h-24 select-none">
            {bgIcon}
            <div className="flex flex-col h-full justify-center gap-1 z-10 relative">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {title}
                </span>
                <span className="text-3xl sm:text-4xl lg:text-5xl font-[1000] tracking-tight text-foreground tabular-nums leading-none flex items-baseline flex-wrap">
                    {renderValue(value)}
                </span>
            </div>
        </div>
    )
}

export function SharePage() {
    const { shareId } = useParams<{ shareId: string }>()
    const location = useLocation()
    const navigate = useNavigate()

    // Check if we received GPX content directly from navigation (e.g. uploaded locally) or sessionStorage
    const [gpxContent, setGpxContent] = useState<string | null>(() => {
        if (location.state?.gpxContent) {
            try {
                sessionStorage.setItem(
                    'lastImportedGpx',
                    location.state.gpxContent
                )
            } catch (e) {
                console.warn('Failed to save GPX to sessionStorage:', e)
            }
            return location.state.gpxContent
        }
        if (!shareId) {
            try {
                return sessionStorage.getItem('lastImportedGpx') || null
            } catch {
                return null
            }
        }
        return null
    })
    const [localShareId, setLocalShareId] = useState<string | null>(
        shareId || null
    )
    const [isGeneratingShare, setIsGeneratingShare] = useState(false)
    const [loading, setLoading] = useState(!gpxContent && !!shareId)
    const [error, setError] = useState<string | null>(null)
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    // Sync loaded/shared track to sessionStorage to allow page reloads
    useEffect(() => {
        if (gpxContent) {
            try {
                sessionStorage.setItem('lastImportedGpx', gpxContent)
            } catch (e) {
                console.warn('Failed to save GPX to sessionStorage:', e)
            }
        }
    }, [gpxContent])

    // Load shared track from DB if not already present in local state
    useEffect(() => {
        if (gpxContent) {
            setLoading(false)
            return
        }

        if (!shareId) {
            setError('No GPX track uploaded or share link provided.')
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        fetch(`/api/share?id=${shareId}`)
            .then((res) => {
                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error(
                            'This shared route track could not be found or has expired.'
                        )
                    }
                    throw new Error('Failed to retrieve the shared track.')
                }
                return res.json()
            })
            .then((data) => {
                if (data && data.gpxContent) {
                    setGpxContent(data.gpxContent)
                } else {
                    throw new Error(
                        'Received invalid data package from the server.'
                    )
                }
                setLoading(false)
            })
            .catch((err) => {
                console.error('Error fetching share page track:', err)
                setError(
                    err instanceof Error
                        ? err.message
                        : 'An error occurred while loading this route.'
                )
                setLoading(false)
            })
    }, [shareId, gpxContent])

    // Parse track and compute stats
    const parsedData = useMemo(() => {
        if (!gpxContent) return null
        try {
            const parsed = parseGpx(gpxContent)
            const stats = computeGpxStats(parsed.name, parsed.points)
            return { parsed, stats }
        } catch (err) {
            console.error('Parsing failed:', err)
            setError('Failed to parse the GPX file details.')
            return null
        }
    }, [gpxContent])

    const handleShareRoute = async () => {
        if (isGeneratingShare || !gpxContent) return
        setIsGeneratingShare(true)

        try {
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gpxContent }),
            })

            if (!response.ok) {
                throw new Error('Failed to share track')
            }

            const data = await response.json()
            setLocalShareId(data.id)

            // Quietly update the route address to include the new share UUID
            navigate(`/share/${data.id}`, {
                replace: true,
                state: { gpxContent },
            })

            const shareUrl = `${window.location.origin}/share/${data.id}`
            const success = await copyToClipboard(shareUrl)
            if (success) {
                toast.success('Track shared & link copied to clipboard!')
            } else {
                toast.success('Track shared successfully! Copy link below.')
            }
        } catch (err) {
            console.error('Error sharing route:', err)
            toast.error('Failed to generate sharing link.')
        } finally {
            setIsGeneratingShare(false)
        }
    }

    const handleCopyShareLink = async () => {
        const id = localShareId || shareId
        if (!id) return
        const shareUrl = `${window.location.origin}/share/${id}`
        const success = await copyToClipboard(shareUrl)
        if (success) {
            toast.success('Link copied to clipboard!')
        } else {
            toast.error('Failed to copy link. Please copy manually.')
        }
    }

    const handleDownloadGpx = () => {
        if (!gpxContent || !parsedData) return
        const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${parsedData.stats.trackName.replace(/[\s/]+/g, '_') || 'shared_route'}.gpx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleLaunch3D = () => {
        const id = localShareId || shareId
        const query = id ? `?share=${id}` : ''
        navigate(`/map${query}`, { state: { gpxContent } })
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <h3 className="text-xl font-bold mb-1">
                    Loading Route Details
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                    Fetching coordinates and analyzing mountain biking stats...
                </p>
            </div>
        )
    }

    if (error || !parsedData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 max-w-md mx-auto">
                <div className="bg-destructive/10 p-4 rounded-full border border-destructive/20 mb-6">
                    <ShieldAlert className="w-12 h-12 text-destructive" />
                </div>
                <h3 className="text-2xl font-bold mb-3">No Route Loaded</h3>
                <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                    {error ||
                        'Upload a GPX file on the homepage or open a valid sharing link.'}
                </p>
                <div className="flex gap-4">
                    <Link
                        to="/"
                        className="flex items-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-primary/20 cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go to Upload
                    </Link>
                </div>
            </div>
        )
    }

    const { parsed, stats } = parsedData

    // Format duration from seconds
    const formatDuration = (sec: number | null): string => {
        if (sec === null) return 'N/A'
        const h = Math.floor(sec / 3600)
        const m = Math.floor((sec % 3600) / 60)
        if (h > 0) return `${h}h ${m}m`
        return `${m}m`
    }

    const activeShareId = localShareId || shareId

    return (
        <div className="w-full max-w-6xl mx-auto px-1.5 sm:px-4 py-8 animate-in fade-in duration-500">
            {/* Header / Hero Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-border/40 pb-6">
                <div className="w-full md:w-auto min-w-0">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                        {stats.trackName}
                    </h1>
                    {activeShareId && (
                        <div className="flex items-center gap-1.5 mt-2.5 bg-muted/40 border border-border/40 rounded-xl p-1 max-w-sm w-full">
                            <div className="relative flex-1 min-w-0">
                                <input
                                    type="text"
                                    readOnly
                                    value={`${window.location.origin}/share/${activeShareId}`}
                                    onClick={handleCopyShareLink}
                                    className="w-full bg-transparent text-[11px] font-mono px-2.5 py-1.5 focus:outline-hidden text-muted-foreground truncate cursor-pointer hover:text-foreground transition-colors"
                                />
                            </div>
                            <button
                                onClick={handleCopyShareLink}
                                className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-200"
                                title="Copy link to clipboard"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {activeShareId ? (
                        <button
                            onClick={handleCopyShareLink}
                            className="flex items-center justify-center gap-2 bg-card hover:bg-card/90 text-foreground border border-border/80 font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer text-sm w-full sm:w-auto"
                            title="Copy link to clipboard"
                        >
                            <Copy className="w-4 h-4 text-muted-foreground" />
                            Copy Link
                        </button>
                    ) : (
                        <button
                            onClick={handleShareRoute}
                            disabled={isGeneratingShare}
                            className="flex items-center justify-center gap-2 bg-card hover:bg-card/90 text-foreground border border-border/80 font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer text-sm w-full sm:w-auto disabled:opacity-50"
                        >
                            {isGeneratingShare ? (
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            ) : (
                                <Share2 className="w-4 h-4 text-muted-foreground" />
                            )}
                            Share Route
                        </button>
                    )}

                    <button
                        onClick={handleDownloadGpx}
                        className="flex items-center justify-center gap-2 bg-card hover:bg-card/90 text-foreground border border-border/80 font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer text-sm w-full sm:w-auto"
                        title="Download raw GPX coordinates"
                    >
                        <Download className="w-4 h-4 text-muted-foreground" />
                        Download GPX
                    </button>

                    <button
                        onClick={handleLaunch3D}
                        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-primary/20 hover:scale-[1.02] cursor-pointer text-sm w-full sm:w-auto group"
                    >
                        <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                        Relive in 3D Map
                    </button>
                </div>
            </div>

            {/* Dashboard Contents Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Map & Elevation Plot */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* 2D Map Container */}
                    <div className="h-[350px] md:h-[450px] w-full rounded-2xl overflow-hidden shadow-xs relative">
                        <LeafletTrackMap
                            points={parsed.points}
                            hoveredIndex={hoveredIndex}
                            onHoverPoint={setHoveredIndex}
                        />
                    </div>

                    {/* Interactive Elevation Profile Component */}
                    <ElevationProfile
                        points={parsed.points}
                        smoothedElevations={stats.smoothedElevations}
                        hoveredIndex={hoveredIndex}
                        onHoverPoint={setHoveredIndex}
                    />
                </div>

                {/* Right Column - MTB Stats panel */}
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-4">
                        <StatCard
                            icon={<Compass />}
                            title="Total Distance"
                            value={`${stats.totalDistanceKm.toFixed(2)} km`}
                        />

                        <StatCard
                            icon={<TrendingUp />}
                            title="Elevation Gain"
                            value={`+${stats.elevationGainM} m`}
                        />

                        <StatCard
                            icon={<TrendingDown />}
                            title="Elevation Loss"
                            value={`-${stats.elevationLossM} m`}
                        />

                        <StatCard
                            icon={<Mountain />}
                            title="Highest Peak"
                            value={`${stats.highestElevationM} m`}
                        />

                        {stats.movingTimeS !== null && (
                            <StatCard
                                icon={<Clock />}
                                title="Riding Duration"
                                value={formatDuration(stats.movingTimeS)}
                            />
                        )}

                        {stats.avgMovingSpeedKmh !== null && (
                            <StatCard
                                icon={<Gauge />}
                                title="Average Speed"
                                value={`${stats.avgMovingSpeedKmh} km/h`}
                            />
                        )}

                        {stats.maxSpeedKmh !== null && (
                            <StatCard
                                icon={<Zap />}
                                title="Max Speed"
                                value={`${stats.maxSpeedKmh} km/h`}
                            />
                        )}

                        <StatCard
                            icon={<Percent />}
                            title="Max Gradient"
                            value={`${stats.maxUphillGradient}%`}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
