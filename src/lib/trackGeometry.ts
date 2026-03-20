import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three'

export interface TrackGeometryInput {
    pathPoints: Vector3[]
    segmentSpeeds: number[]
    cumulativeDistancesM: number[]
    totalDistanceM: number
    radius: number
    radialSegments: number
    sampleSegments: number
    maxSpeedKmh: number | null
    useSpeedColors: boolean
}

function getSpeedColor(speedKmh: number, maxSpeedKmh: number | null) {
    const color = new Color()
    const normalizedMax = maxSpeedKmh && maxSpeedKmh > 0 ? maxSpeedKmh : 1
    const ratio = Math.min(Math.max(speedKmh / normalizedMax, 0), 1)

    color.setHSL(0.33 * (1 - ratio), 0.8, 0.5)
    return color
}

function getNeutralTrackColor() {
    return new Color('#d9dee7')
}

function getSegmentIndexAtDistance(
    distanceM: number,
    cumulativeDistancesM: number[]
) {
    for (let i = 0; i < cumulativeDistancesM.length - 1; i++) {
        if (distanceM <= cumulativeDistancesM[i + 1]) {
            return i
        }
    }

    return Math.max(0, cumulativeDistancesM.length - 2)
}

export function buildSegmentedTrackGeometry({
    pathPoints,
    segmentSpeeds,
    cumulativeDistancesM,
    totalDistanceM,
    radius,
    radialSegments,
    sampleSegments,
    maxSpeedKmh,
    useSpeedColors,
}: TrackGeometryInput) {
    const geometry = new BufferGeometry()

    if (pathPoints.length < 2) {
        geometry.setAttribute('position', new Float32BufferAttribute([], 3))
        return geometry
    }

    const tangents: Vector3[] = []
    const normals: Vector3[] = []
    const binormals: Vector3[] = []

    const up = new Vector3(0, 1, 0)
    const altUp = new Vector3(1, 0, 0)

    for (let i = 0; i < pathPoints.length; i++) {
        const previous = pathPoints[Math.max(0, i - 1)]
        const next = pathPoints[Math.min(pathPoints.length - 1, i + 1)]
        tangents.push(next.clone().sub(previous).normalize())
    }

    const firstReference = Math.abs(tangents[0].dot(up)) > 0.98 ? altUp : up
    normals.push(
        new Vector3().crossVectors(firstReference, tangents[0]).normalize()
    )
    binormals.push(
        new Vector3().crossVectors(tangents[0], normals[0]).normalize()
    )

    for (let i = 1; i < pathPoints.length; i++) {
        const projectedNormal = normals[i - 1]
            .clone()
            .sub(
                tangents[i]
                    .clone()
                    .multiplyScalar(normals[i - 1].dot(tangents[i]))
            )

        if (projectedNormal.lengthSq() < 1e-6) {
            const fallbackReference =
                Math.abs(tangents[i].dot(up)) > 0.98 ? altUp : up
            projectedNormal.copy(
                new Vector3().crossVectors(fallbackReference, tangents[i])
            )
        }

        normals.push(projectedNormal.normalize())
        binormals.push(
            new Vector3().crossVectors(tangents[i], projectedNormal).normalize()
        )
    }

    const positions: number[] = []
    const normalsAttribute: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    let vertexOffset = 0

    for (let segmentIndex = 0; segmentIndex < sampleSegments; segmentIndex++) {
        const pointIndexA = Math.min(segmentIndex, pathPoints.length - 2)
        const pointIndexB = Math.min(pointIndexA + 1, pathPoints.length - 1)

        const distanceRatio =
            sampleSegments > 0 ? (segmentIndex + 0.5) / sampleSegments : 0
        const distanceAtCenter = totalDistanceM * distanceRatio
        const speedIndex = getSegmentIndexAtDistance(
            distanceAtCenter,
            cumulativeDistancesM
        )
        const speed = segmentSpeeds[speedIndex] ?? 0
        const color = useSpeedColors
            ? getSpeedColor(speed, maxSpeedKmh)
            : getNeutralTrackColor()

        const start = pathPoints[pointIndexA]
        const end = pathPoints[pointIndexB]
        const startNormal = normals[pointIndexA]
        const startBinormal = binormals[pointIndexA]
        const endNormal = normals[pointIndexB]
        const endBinormal = binormals[pointIndexB]

        for (let radialIndex = 0; radialIndex < radialSegments; radialIndex++) {
            const angle = (radialIndex / radialSegments) * Math.PI * 2
            const nextAngle = ((radialIndex + 1) / radialSegments) * Math.PI * 2

            const startOffsetA = startNormal
                .clone()
                .multiplyScalar(Math.cos(angle) * radius)
                .add(
                    startBinormal
                        .clone()
                        .multiplyScalar(Math.sin(angle) * radius)
                )
            const startOffsetB = startNormal
                .clone()
                .multiplyScalar(Math.cos(nextAngle) * radius)
                .add(
                    startBinormal
                        .clone()
                        .multiplyScalar(Math.sin(nextAngle) * radius)
                )
            const endOffsetA = endNormal
                .clone()
                .multiplyScalar(Math.cos(angle) * radius)
                .add(
                    endBinormal.clone().multiplyScalar(Math.sin(angle) * radius)
                )
            const endOffsetB = endNormal
                .clone()
                .multiplyScalar(Math.cos(nextAngle) * radius)
                .add(
                    endBinormal
                        .clone()
                        .multiplyScalar(Math.sin(nextAngle) * radius)
                )

            const quadPositions = [
                start.clone().add(startOffsetA),
                start.clone().add(startOffsetB),
                end.clone().add(endOffsetB),
                end.clone().add(endOffsetA),
            ]

            const quadNormals = [
                startOffsetA.clone().normalize(),
                startOffsetB.clone().normalize(),
                endOffsetB.clone().normalize(),
                endOffsetA.clone().normalize(),
            ]

            for (let i = 0; i < quadPositions.length; i++) {
                const position = quadPositions[i]
                const normal = quadNormals[i]
                positions.push(position.x, position.y, position.z)
                normalsAttribute.push(normal.x, normal.y, normal.z)
                colors.push(color.r, color.g, color.b)
            }

            indices.push(
                vertexOffset,
                vertexOffset + 1,
                vertexOffset + 2,
                vertexOffset,
                vertexOffset + 2,
                vertexOffset + 3
            )
            vertexOffset += 4
        }
    }

    geometry.setIndex(indices)
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute(
        'normal',
        new Float32BufferAttribute(normalsAttribute, 3)
    )
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    return geometry
}
