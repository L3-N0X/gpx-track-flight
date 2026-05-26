import { useEffect, useMemo, useState, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { UnitsUtils } from 'geo-three'
import { Vector3, Mesh, Group } from 'three'
import type { PreparedTrackData } from '../../lib/trackPreparation'
import { sampleLocationElevation } from '../../lib/demSampling'

interface LocationLabelsProps {
    preparedTrack: PreparedTrackData
}

interface PlaceNode {
    id: number
    name: string
    lat: number
    lon: number
    type: 'city' | 'town' | 'village' | 'hamlet'
    x: number
    z: number
    elevation: number
    resolvedElevation: boolean
    distanceToTrack: number
}

// Memory cache to avoid querying OSM multiple times for the same track
const overpassCache = new Map<string, PlaceNode[]>()

function haversineDistanceM(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

export function LocationLabels({
    preparedTrack,
}: LocationLabelsProps) {
    const [places, setPlaces] = useState<PlaceNode[]>([])

    // Compute bounding box and cache key
    const cacheKey = useMemo(() => {
        return `${preparedTrack.name}_${preparedTrack.points.length}`
    }, [preparedTrack])

    useEffect(() => {
        let isCancelled = false
        const points = preparedTrack.points

        if (points.length === 0) {
            console.log('[LocationLabels] preparedTrack has 0 points, skipping fetch')
            setPlaces([])
            return
        }

        console.log('[LocationLabels] Initializing for track:', preparedTrack.name, 'with key:', cacheKey)

        // Check cache first
        if (overpassCache.has(cacheKey)) {
            const cached = overpassCache.get(cacheKey) || []
            console.log('[LocationLabels] Found cached places:', cached.length)
            setPlaces(cached)
            // If they are not fully elevation resolved, trigger elevation sampling
            if (cached.some((p) => !p.resolvedElevation)) {
                console.log('[LocationLabels] Triggering elevation sampling for cached places...')
                void resolveElevations(cached, isCancelled)
            }
            return
        }

        const fetchPlaces = async () => {
            try {
                // Find lat/lon limits
                let minLat = Number.POSITIVE_INFINITY
                let maxLat = Number.NEGATIVE_INFINITY
                let minLon = Number.POSITIVE_INFINITY
                let maxLon = Number.NEGATIVE_INFINITY

                for (const p of points) {
                    if (p.lat < minLat) minLat = p.lat
                    if (p.lat > maxLat) maxLat = p.lat
                    if (p.lon < minLon) minLon = p.lon
                    if (p.lon > maxLon) maxLon = p.lon
                }

                console.log('[LocationLabels] Track lat/lon bounds:', { minLat, maxLat, minLon, maxLon })

                // Expand bbox by 0.08 degrees (approx 9km) to find places in region
                const margin = 0.08
                const S = minLat - margin
                const W = minLon - margin
                const N = maxLat + margin
                const E = maxLon + margin

                console.log('[LocationLabels] Expanded query bbox:', { S, W, N, E })

                // Query Overpass API for place nodes
                const query = `[out:json][timeout:15];(node["place"~"city|town|village|hamlet"](${S},${W},${N},${E}););out body;`
                const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`

                console.log('[LocationLabels] Fetching from Overpass API url:', url)
                const res = await fetch(url)
                if (!res.ok) {
                    throw new Error(
                        `OSM Overpass query failed with status: ${res.status}`
                    )
                }

                const data = await res.json()
                const elements = data.elements || []
                console.log(`[LocationLabels] OSM returned ${elements.length} raw place nodes.`)

                // Map and filter elements
                const mapped: PlaceNode[] = []

                for (const elem of elements) {
                    if (!elem.tags?.name) continue

                    // Calculate distance to nearest point on the track
                    let minDistance = Number.POSITIVE_INFINITY
                    for (const pt of points) {
                        const d = haversineDistanceM(
                            elem.lat,
                            elem.lon,
                            pt.lat,
                            pt.lon
                        )
                        if (d < minDistance) minDistance = d
                    }

                    const type = elem.tags.place as
                        | 'city'
                        | 'town'
                        | 'village'
                        | 'hamlet'

                    // Rejection filters based on place type and track distance
                    // (more generous bounds to ensure villages/hamlets are included)
                    let keep = false
                    if (type === 'city' && minDistance <= 60000) keep = true
                    else if (type === 'town' && minDistance <= 35000)
                        keep = true
                    else if (type === 'village' && minDistance <= 25000)
                        keep = true
                    else if (type === 'hamlet' && minDistance <= 12000)
                        keep = true

                    if (!keep) continue

                    // Project coordinates to Web Mercator
                    const mercator = UnitsUtils.datumsToSpherical(
                        elem.lat,
                        elem.lon
                    )
                    const x = mercator.x
                    const z = -mercator.y

                    // Guess initial elevation from first track point (avoid ground clipping before resolution)
                    const initialElevation = points[0]?.smoothedElevationM ?? 1000

                    mapped.push({
                        id: elem.id,
                        name: elem.tags.name,
                        lat: elem.lat,
                        lon: elem.lon,
                        type,
                        x,
                        z,
                        elevation: initialElevation,
                        resolvedElevation: false,
                        distanceToTrack: minDistance,
                    })
                }

                console.log(`[LocationLabels] Filtered down to ${mapped.length} places near track.`)

                // Score places dynamically to balance size/importance against track proximity
                const getRankingScore = (node: PlaceNode) => {
                    const baseScore =
                        node.type === 'city'
                            ? 100
                            : node.type === 'town'
                              ? 80
                              : node.type === 'village'
                                ? 60
                                : 40
                    const distanceKm = node.distanceToTrack / 1000
                    return baseScore - distanceKm * 2.0
                }

                mapped.sort((a, b) => getRankingScore(b) - getRankingScore(a))

                // Limit total number of labels to 45 (increased to capture more villages/hamlets)
                const finalPlaces = mapped.slice(0, 45)
                console.log('[LocationLabels] Final places to display:', finalPlaces.map(p => `${p.name} (${p.type}, trackDist: ${(p.distanceToTrack/1000).toFixed(1)}km)`))

                if (isCancelled) return

                setPlaces(finalPlaces)
                overpassCache.set(cacheKey, finalPlaces)

                // Start sampling elevation for each place
                void resolveElevations(finalPlaces, isCancelled)
            } catch (err) {
                console.error('Failed to fetch place labels', err)
            } finally {
            }
        }

        void fetchPlaces()

        return () => {
            isCancelled = true
        }
    }, [cacheKey, preparedTrack])

    const resolveElevations = async (
        nodes: PlaceNode[],
        isCancelled: boolean
    ) => {
        console.log(`[LocationLabels] Resolving elevations for ${nodes.length} places...`)
        const updated = [...nodes]
        for (let i = 0; i < updated.length; i++) {
            if (isCancelled) return
            if (updated[i].resolvedElevation) continue

            try {
                const height = await sampleLocationElevation(
                    updated[i].lat,
                    updated[i].lon
                )
                if (isCancelled) return

                console.log(`[LocationLabels] Resolved elevation for ${updated[i].name}: ${height.toFixed(1)}m`)
                updated[i] = {
                    ...updated[i],
                    elevation: height,
                    resolvedElevation: true,
                }
                setPlaces([...updated])
                overpassCache.set(cacheKey, updated)
            } catch (e) {
                console.warn(
                    `Elevation sampling failed for place: ${updated[i].name}`,
                    e
                )
            }
        }
        console.log('[LocationLabels] Elevation resolution complete.')
    }

    return (
        <group>
            {places.map((place) => (
                <LocationLabelItem key={place.id} place={place} />
            ))}
        </group>
    )
}

function LocationLabelItem({ place }: { place: PlaceNode }) {
    const { camera } = useThree()
    const groupRef = useRef<Group>(null)
    const labelRef = useRef<HTMLDivElement>(null)
    const stalkRef = useRef<Mesh>(null)
    const tempWorldPosition = useMemo(() => new Vector3(), [])

    // Define visual properties based on place type (lowered further)
    const floatHeight = useMemo(() => {
        switch (place.type) {
            case 'city':
                return 80
            case 'town':
                return 60
            case 'village':
                return 45
            case 'hamlet':
            default:
                return 30
        }
    }, [place.type])

    const badgeStyles = useMemo(() => {
        switch (place.type) {
            case 'city':
                return {
                    bg: 'bg-primary/20 dark:bg-primary/30 border-primary text-primary-light font-bold text-xs uppercase tracking-wider',
                    indicator:
                        'w-2 h-2 rounded-full bg-primary-light inline-block mr-1.5 animate-pulse',
                    notch: 'border-t-primary/80',
                    stalkRadius: 1.5,
                    stalkColor: '#5f9552',
                }
            case 'town':
                return {
                    bg: 'bg-slate-900/80 dark:bg-slate-955/80 border-slate-700/80 text-slate-100 font-semibold text-[11px]',
                    indicator:
                        'w-1.5 h-1.5 rounded-full bg-slate-300 inline-block mr-1.5',
                    notch: 'border-t-slate-900/80',
                    stalkRadius: 1.1,
                    stalkColor: '#cbd5e1',
                }
            case 'village':
                return {
                    bg: 'bg-slate-900/60 dark:bg-slate-955/60 border-slate-800/60 text-slate-300 font-medium text-[10px]',
                    indicator:
                        'w-1 h-1 rounded-full bg-slate-400/80 inline-block mr-1.5',
                    notch: 'border-t-slate-900/60',
                    stalkRadius: 0.8,
                    stalkColor: '#94a3b8',
                }
            case 'hamlet':
            default:
                return {
                    bg: 'bg-slate-900/40 dark:bg-slate-955/40 border-slate-900/40 text-slate-400 text-[9.5px]',
                    indicator:
                        'w-1 h-1 rounded-full bg-slate-500/60 inline-block mr-1',
                    notch: 'border-t-slate-900/40',
                    stalkRadius: 0.6,
                    stalkColor: '#64748b',
                }
        }
    }, [place.type])

    useFrame(() => {
        if (!labelRef.current || !groupRef.current) return

        // Get actual world position of the label group (taking parent shifts into account)
        groupRef.current.getWorldPosition(tempWorldPosition)
        tempWorldPosition.y += floatHeight

        const distance = camera.position.distanceTo(tempWorldPosition)

        // Define LOD thresholds (reduced to prevent horizon clutter)
        let maxVisibleDistance = 35000 // city: 35km
        let minVisibleDistance = 0
        if (place.type === 'town') maxVisibleDistance = 20000 // 20km
        else if (place.type === 'village') maxVisibleDistance = 10000 // 10km
        else if (place.type === 'hamlet') maxVisibleDistance = 5000 // 5km

        const isVisible =
            distance >= minVisibleDistance && distance <= maxVisibleDistance

        // Log visibility status periodically (extremely low frequency to prevent spam)
        if (Math.random() < 0.0005) {
            console.log(
                `[LocationLabelItem] ${place.name}: dist=${distance.toFixed(1)}m, limit=${maxVisibleDistance}m, isVisible=${isVisible}, pos=[${tempWorldPosition.x.toFixed(0)}, ${tempWorldPosition.y.toFixed(0)}, ${tempWorldPosition.z.toFixed(0)}], cameraPos=[${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}]`
            )
        }

        if (!isVisible) {
            labelRef.current.style.display = 'none'
            if (stalkRef.current) stalkRef.current.visible = false
            return
        }

        labelRef.current.style.display = 'block'
        if (stalkRef.current) stalkRef.current.visible = true

        // Scaling logic: Angular size correction (constant size modified by caps)
        const baseScale =
            place.type === 'city'
                ? 1.25
                : place.type === 'town'
                  ? 1.05
                  : place.type === 'village'
                    ? 0.9
                    : 0.8

        // As distance goes from 100m to maxVisibleDistance, scale factor changes smoothly
        const t = (distance - 100) / (maxVisibleDistance - 100)
        const clampedT = Math.max(0, Math.min(1, t))
        const distScale = 1.3 - clampedT * 0.9 // scale factor from 1.3 down to 0.4
        const finalScale = baseScale * distScale

        labelRef.current.style.transform = `translate(-50%, calc(-100% - 8px)) scale(${finalScale})`

        // Opacity fadeout when approaching the max visibility limit (starts fading at 50% distance)
        const fadeThreshold = maxVisibleDistance * 0.5
        const opacity =
            distance > fadeThreshold
                ? 1 -
                  (distance - fadeThreshold) /
                      (maxVisibleDistance - fadeThreshold)
                : 1
        labelRef.current.style.opacity = Math.max(0.15, opacity).toString()
    })

    return (
        <group ref={groupRef} position={[place.x, place.elevation, place.z]}>
            {/* Minimal vertical stalk anchor (made thicker and color-coded) */}
            <mesh ref={stalkRef} position={[0, floatHeight / 2, 0]}>
                <cylinderGeometry args={[badgeStyles.stalkRadius, badgeStyles.stalkRadius, floatHeight, 6]} />
                <meshBasicMaterial
                    color={badgeStyles.stalkColor}
                />
            </mesh>

            {/* Projected HTML Label badge */}
            <Html
                transform={false}
                position={[0, floatHeight, 0]}
                zIndexRange={[0, 0]}
                className="pointer-events-none select-none"
            >
                <div
                    ref={labelRef}
                    className="transition-transform duration-100 ease-out"
                    style={{ transformOrigin: 'bottom center' }}
                >
                    <div
                        className={`relative flex items-center whitespace-nowrap rounded-md px-2 py-1 text-center border backdrop-blur-xs shadow-md border-opacity-30 ${badgeStyles.bg}`}
                    >
                        <span className={badgeStyles.indicator} />
                        <span>{place.name}</span>

                        {/* Pointer Notch */}
                        <div
                            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${badgeStyles.notch}`}
                        />
                    </div>
                </div>
            </Html>
        </group>
    )
}
