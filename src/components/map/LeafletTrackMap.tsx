import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GpxPoint } from '../../lib/gpxParser'
import { useTheme } from '@/hooks/use-theme'

interface LeafletTrackMapProps {
    points: GpxPoint[]
    hoveredIndex: number | null
    onHoverPoint?: (index: number | null) => void
}

export function LeafletTrackMap({
    points,
    hoveredIndex,
    onHoverPoint,
}: LeafletTrackMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<L.Map | null>(null)
    const polylineRef = useRef<L.Polyline | null>(null)
    const hoverMarkerRef = useRef<L.CircleMarker | null>(null)
    const tileLayerRef = useRef<L.TileLayer | null>(null)
    const { theme } = useTheme()

    // Determine raw theme string (handles 'system' resolution)
    const getResolvedTheme = (): 'dark' | 'light' => {
        if (theme === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
        }
        return theme as 'dark' | 'light'
    }

    const resolvedTheme = getResolvedTheme()

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current || points.length === 0) return

        // Create map instance
        const map = L.map(mapContainerRef.current, {
            zoomControl: true,
            attributionControl: false,
            renderer: L.svg({ padding: 0.5 }),
        })
        mapRef.current = map

        // Custom Leaflet styling overrides
        const style = document.createElement('style')
        style.innerHTML = `
            .leaflet-container {
                background: transparent !important;
            }
            .leaflet-bar {
                border: 1px solid var(--border) !important;
                background-color: var(--card) !important;
                border-radius: 8px !important;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
            }
            .leaflet-bar a {
                background-color: var(--card) !important;
                color: var(--foreground) !important;
                border-bottom: 1px solid var(--border) !important;
                transition: background-color 0.2s;
            }
            .leaflet-bar a:hover {
                background-color: var(--accent) !important;
                color: var(--accent-foreground) !important;
            }
            .leaflet-top, .leaflet-bottom {
                z-index: 10 !important;
            }
        `
        document.head.appendChild(style)

        // Select tile layer based on resolvedTheme
        const tileUrl =
            resolvedTheme === 'dark'
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

        const tileLayer = L.tileLayer(tileUrl, {
            maxZoom: 19,
            updateWhenIdle: false,
            keepBuffer: 3,
        }).addTo(map)
        tileLayerRef.current = tileLayer

        // Plot track points
        const latLngs = points.map((p) => L.latLng(p.lat, p.lon))
        const polyline = L.polyline(latLngs, {
            color: 'oklch(0.62 0.11 135)', // matches primary green color
            weight: 4,
            opacity: 0.9,
            lineJoin: 'round',
        }).addTo(map)
        polylineRef.current = polyline

        // Add start and end circle markers
        L.circleMarker(latLngs[0], {
            radius: 5,
            fillColor: '#22c55e', // green-500
            fillOpacity: 1,
            color: '#ffffff',
            weight: 2,
        }).addTo(map)

        L.circleMarker(latLngs[latLngs.length - 1], {
            radius: 5,
            fillColor: '#ef4444', // red-500
            fillOpacity: 1,
            color: '#ffffff',
            weight: 2,
        }).addTo(map)

        // Fit map bounds to polyline
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] })

        // ResizeObserver to handle layout changes (especially transitions from loading state where size is 0)
        let hasFitted = false
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize()
            if (
                !hasFitted &&
                mapContainerRef.current &&
                mapContainerRef.current.offsetWidth > 0
            ) {
                map.fitBounds(polyline.getBounds(), { padding: [20, 20] })
                hasFitted = true
            }
        })

        if (mapContainerRef.current) {
            resizeObserver.observe(mapContainerRef.current)
        }

        // Enable hover tracking on the map
        const handleMouseMove = (e: L.LeafletMouseEvent) => {
            if (!onHoverPoint) return

            // Find closest GPX point
            let minD = Infinity
            let minIdx = 0
            const clickLat = e.latlng.lat
            const clickLng = e.latlng.lng

            for (let i = 0; i < points.length; i++) {
                const p = points[i]
                const d = (p.lat - clickLat) ** 2 + (p.lon - clickLng) ** 2
                if (d < minD) {
                    minD = d
                    minIdx = i
                }
            }

            // Define a threshold (approx 500m squared in lat/lon diff coords to avoid trigger if cursor is too far)
            if (minD < 0.05) {
                onHoverPoint(minIdx)
            } else {
                onHoverPoint(null)
            }
        }

        map.on('mousemove', handleMouseMove)
        polyline.on('mousemove', handleMouseMove)

        map.on('mouseout', () => {
            if (onHoverPoint) onHoverPoint(null)
        })

        return () => {
            resizeObserver.disconnect()
            map.remove()
            document.head.removeChild(style)
        }
    }, [points])

    // Update Tile Layer theme on changes
    useEffect(() => {
        if (!mapRef.current || !tileLayerRef.current) return

        const tileUrl =
            resolvedTheme === 'dark'
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

        tileLayerRef.current.setUrl(tileUrl)
    }, [resolvedTheme])

    // Update Hover Marker position
    useEffect(() => {
        if (!mapRef.current) return

        if (
            hoveredIndex === null ||
            hoveredIndex < 0 ||
            hoveredIndex >= points.length
        ) {
            if (hoverMarkerRef.current) {
                hoverMarkerRef.current.remove()
                hoverMarkerRef.current = null
            }
            return
        }

        const point = points[hoveredIndex]
        const latlng = L.latLng(point.lat, point.lon)

        if (!hoverMarkerRef.current) {
            // Create nice glowing halo marker for active tracking
            hoverMarkerRef.current = L.circleMarker(latlng, {
                radius: 8,
                fillColor: 'oklch(0.73 0.08 65)', // Accent secondary color
                fillOpacity: 0.9,
                color: '#ffffff',
                weight: 2,
            }).addTo(mapRef.current)
        } else {
            hoverMarkerRef.current.setLatLng(latlng)
        }
    }, [hoveredIndex, points])

    return (
        <div className="relative z-0 w-full h-full rounded-2xl overflow-hidden border border-border shadow-inner bg-card/30">
            <div
                ref={mapContainerRef}
                className="w-full h-full min-h-[350px] md:min-h-[450px]"
            />
        </div>
    )
}
