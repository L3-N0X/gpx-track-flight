import type { GpxPoint } from './gpxParser'

export interface GpxStats {
    trackName: string
    totalDistanceKm: number
    elevationGainM: number
    elevationLossM: number
    /** null when GPX has no <time> tags */
    maxSpeedKmh: number | null
    /** null when GPX has no <time> tags */
    avgSpeedKmh: number | null
    /** Index of highest point */
    highestPointIndex: number
    /** Highest elevation in meters */
    highestElevationM: number
    /** Index of fastest point (null if no time) */
    fastestPointIndex: number | null
    totalDurationS: number | null
    /** Speeds at each point in km/h */
    pointSpeeds: number[]
}

/** Haversine distance in meters between two lat/lon coordinates */
function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000 // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Compute MTB-relevant statistics from a list of GPX points.
 * Speed fields are null when the GPX contains no <time> tags.
 */
export function computeGpxStats(name: string, points: GpxPoint[]): GpxStats {
    let totalDistanceM = 0
    let elevationGainM = 0
    let elevationLossM = 0
    let maxSpeedKmh: number | null = null
    let totalTimeS = 0
    let hasTime = false

    let highestEle = -Infinity
    let highestPointIndex = 0
    let fastestPointIndex: number | null = null

    const pointSpeeds: number[] = new Array(points.length).fill(0)

    for (let i = 0; i < points.length; i++) {
        const curr = points[i]
        if (curr.ele > highestEle) {
            highestEle = curr.ele
            highestPointIndex = i
        }

        if (i > 0) {
            const prev = points[i - 1]

            // Distance
            const segDistM = haversineMeters(
                prev.lat,
                prev.lon,
                curr.lat,
                curr.lon
            )
            totalDistanceM += segDistM

            // Elevation
            const dEle = curr.ele - prev.ele
            if (dEle > 0) elevationGainM += dEle
            else elevationLossM += Math.abs(dEle)

            // Speed — only if both points have timestamps
            if (prev.time && curr.time) {
                hasTime = true
                const dtS =
                    (new Date(curr.time).getTime() -
                        new Date(prev.time).getTime()) /
                    1000
                if (dtS > 0) {
                    totalTimeS += dtS
                    const segSpeedKmh = (segDistM / dtS) * 3.6
                    pointSpeeds[i] = segSpeedKmh
                    if (maxSpeedKmh === null || segSpeedKmh > maxSpeedKmh) {
                        maxSpeedKmh = segSpeedKmh
                        fastestPointIndex = i
                    }
                }
            }
        }
    }

    // Smooth point speeds a bit to avoid jitter
    if (hasTime) {
        pointSpeeds[0] = pointSpeeds[1] || 0
    }

    const avgSpeedKmh =
        hasTime && totalTimeS > 0 ? (totalDistanceM / totalTimeS) * 3.6 : null

    return {
        trackName: name,
        totalDistanceKm: totalDistanceM / 1000,
        elevationGainM: Math.round(elevationGainM),
        elevationLossM: Math.round(elevationLossM),
        maxSpeedKmh:
            maxSpeedKmh !== null ? Math.round(maxSpeedKmh * 10) / 10 : null,
        avgSpeedKmh:
            avgSpeedKmh !== null ? Math.round(avgSpeedKmh * 10) / 10 : null,
        highestPointIndex,
        highestElevationM: Math.round(highestEle),
        fastestPointIndex,
        totalDurationS: hasTime ? Math.round(totalTimeS) : null,
        pointSpeeds,
    }
}
