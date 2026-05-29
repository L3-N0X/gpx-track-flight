import { useEffect, useState } from 'react'
import { useLocation, useSearchParams, Link } from 'react-router-dom'
import { Map3D } from '../components/map/Map3D'
import { ShareTrackOverlay } from '../components/map/ShareTrackOverlay'
import { Loader2, AlertCircle, Home } from 'lucide-react'

export function MapPage() {
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const shareId = searchParams.get('share')

    const [gpxContent, setGpxContent] = useState<string | undefined>(() => {
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
                return sessionStorage.getItem('lastImportedGpx') || undefined
            } catch (e) {
                return undefined
            }
        }
        return undefined
    })
    const [loading, setLoading] = useState(!!shareId && !gpxContent)
    const [error, setError] = useState<string | null>(null)

    // Sync loaded track back to sessionStorage to allow page reloads
    useEffect(() => {
        if (gpxContent) {
            try {
                sessionStorage.setItem('lastImportedGpx', gpxContent)
            } catch (e) {
                console.warn('Failed to save GPX to sessionStorage:', e)
            }
        }
    }, [gpxContent])

    useEffect(() => {
        if (shareId && !gpxContent) {
            setLoading(true)
            setError(null)
            fetch(`/api/share?id=${shareId}`)
                .then((res) => {
                    if (!res.ok) {
                        if (res.status === 404) {
                            throw new Error(
                                'Shared track not found or link has expired.'
                            )
                        }
                        throw new Error('Failed to load shared flight track.')
                    }
                    return res.json()
                })
                .then((data) => {
                    if (data && data.gpxContent) {
                        setGpxContent(data.gpxContent)
                    } else {
                        throw new Error('Invalid track data received.')
                    }
                    setLoading(false)
                })
                .catch((err) => {
                    console.error('Error fetching shared track:', err)
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'An unknown error occurred.'
                    )
                    setLoading(false)
                })
        }
    }, [shareId, gpxContent])

    if (loading) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-50">
                <div className="flex flex-col items-center p-8 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl max-w-sm w-full mx-4 text-center shadow-2xl">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                    <h3 className="text-xl font-bold mb-2">
                        Loading Shared Track
                    </h3>
                    <p className="text-slate-400 text-sm">
                        Fetching GPX data from the server and preparing 3D
                        terrain...
                    </p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-50">
                <div className="flex flex-col items-center p-8 bg-slate-900/60 backdrop-blur-md border border-destructive/20 rounded-3xl max-w-sm w-full mx-4 text-center shadow-2xl">
                    <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                    <h3 className="text-xl font-bold mb-2 text-destructive">
                        Failed to Load
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">{error}</p>
                    <Link
                        to="/"
                        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-primary/20 cursor-pointer"
                    >
                        <Home className="w-4 h-4" />
                        Return Home
                    </Link>
                </div>
            </div>
        )
    }

    if (!gpxContent) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-50">
                <div className="flex flex-col items-center p-8 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl max-w-sm w-full mx-4 text-center shadow-2xl">
                    <AlertCircle className="w-12 h-12 text-primary mb-4" />
                    <h3 className="text-xl font-bold mb-2">No Track Loaded</h3>
                    <p className="text-slate-400 text-sm mb-6">
                        You must upload a GPX track file on the home page to
                        visualize it in 3D.
                    </p>
                    <Link
                        to="/"
                        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-primary/20 cursor-pointer"
                    >
                        <Home className="w-4 h-4" />
                        Go to Upload
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 top-16.25 sm:top-18.25 z-0 bg-slate-900 animate-in fade-in duration-500">
            <Map3D gpxContent={gpxContent} shareId={shareId} />
            <ShareTrackOverlay gpxContent={gpxContent} shareId={shareId} />
        </div>
    )
}
