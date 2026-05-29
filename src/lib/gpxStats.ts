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
    // New MTB-specific metrics
    avgUphillGradient: number | null
    avgDownhillGradient: number | null
    maxUphillGradient: number | null
    maxDownhillGradient: number | null
    movingTimeS: number | null
    avgMovingSpeedKmh: number | null
    difficulty: 'green' | 'blue' | 'black' | 'extreme'
    difficultyScore: number
    smoothedElevations: number[]
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

/** Smooth elevation data to filter out GPS jitter before slope analysis */
function smoothElevations(points: GpxPoint[], windowSize = 5): number[] {
    const elevations = points.map((p) => p.ele)
    const smoothed = [...elevations]
    const half = Math.floor(windowSize / 2)

    for (let i = 0; i < elevations.length; i++) {
        let sum = 0
        let count = 0
        for (let w = -half; w <= half; w++) {
            const idx = i + w
            if (idx >= 0 && idx < elevations.length) {
                sum += elevations[idx]
                count++
            }
        }
        smoothed[i] = sum / count
    }
    return smoothed
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
    const smoothedEles = smoothElevations(points, 5)

    // MTB Gradient calculations
    let uphillGradSum = 0
    let uphillGradCount = 0
    let downhillGradSum = 0
    let downhillGradCount = 0
    let maxUphillGrad = 0
    let maxDownhillGrad = 0

    // Moving time calculation (filtering stationary intervals)
    let movingTimeS = 0
    let movingDistanceM = 0

    for (let i = 0; i < points.length; i++) {
        const curr = points[i]
        const currEle = smoothedEles[i]

        if (curr.ele > highestEle) {
            highestEle = curr.ele
            highestPointIndex = i
        }

        if (i > 0) {
            const prev = points[i - 1]
            const prevEle = smoothedEles[i - 1]

            // Distance
            const segDistM = haversineMeters(
                prev.lat,
                prev.lon,
                curr.lat,
                curr.lon
            )
            totalDistanceM += segDistM

            // Elevation Change (using raw elevation for standard total metrics)
            const dEleRaw = curr.ele - prev.ele
            if (dEleRaw > 0) elevationGainM += dEleRaw
            else elevationLossM += Math.abs(dEleRaw)

            // Smoothed Elevation Change for slope calculation
            const dEleSmoothed = currEle - prevEle

            // Calculate gradient over segments with significant distance to avoid noise
            if (segDistM > 1.5) {
                const gradientPercent = (dEleSmoothed / segDistM) * 100

                if (dEleSmoothed > 0.05) {
                    uphillGradSum += gradientPercent
                    uphillGradCount++
                    if (gradientPercent > maxUphillGrad) {
                        maxUphillGrad = gradientPercent
                    }
                } else if (dEleSmoothed < -0.05) {
                    const absGrad = Math.abs(gradientPercent)
                    downhillGradSum += absGrad
                    downhillGradCount++
                    if (absGrad > maxDownhillGrad) {
                        maxDownhillGrad = absGrad
                    }
                }
            }

            // Speed & moving time — only if both points have timestamps
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

                    // MTB filter: count as moving if speed is > 1.5 km/h
                    if (segSpeedKmh > 1.5) {
                        movingTimeS += dtS
                        movingDistanceM += segDistM
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

    const avgMovingSpeedKmh =
        hasTime && movingTimeS > 0
            ? (movingDistanceM / movingTimeS) * 3.6
            : null

    // Compute difficulty score and classification
    const totalDistanceKm = totalDistanceM / 1000
    const finalElevGain = Math.round(elevationGainM)
    const difficultyScore = totalDistanceKm + (finalElevGain / 100) * 2

    let difficulty: 'green' | 'blue' | 'black' | 'extreme' = 'green'
    if (difficultyScore >= 75) {
        difficulty = 'extreme'
    } else if (difficultyScore >= 40) {
        difficulty = 'black'
    } else if (difficultyScore >= 15) {
        difficulty = 'blue'
    }

    return {
        trackName: name,
        totalDistanceKm,
        elevationGainM: finalElevGain,
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
        // MTB-specific details
        avgUphillGradient:
            uphillGradCount > 0
                ? Math.round((uphillGradSum / uphillGradCount) * 10) / 10
                : 0,
        avgDownhillGradient:
            downhillGradCount > 0
                ? Math.round((downhillGradSum / downhillGradCount) * 10) / 10
                : 0,
        maxUphillGradient: Math.round(maxUphillGrad * 10) / 10,
        maxDownhillGradient: Math.round(maxDownhillGrad * 10) / 10,
        movingTimeS: hasTime ? Math.round(movingTimeS) : null,
        avgMovingSpeedKmh:
            avgMovingSpeedKmh !== null
                ? Math.round(avgMovingSpeedKmh * 10) / 10
                : null,
        difficulty,
        difficultyScore: Math.round(difficultyScore * 10) / 10,
        smoothedElevations: smoothedEles,
    }
}
