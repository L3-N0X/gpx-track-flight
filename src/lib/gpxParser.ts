export interface GpxPoint {
    lat: number
    lon: number
    ele: number
    /** ISO 8601 timestamp from the <time> tag, if present */
    time?: string
}

export interface GpxData {
    name: string
    points: GpxPoint[]
}

export function parseGpx(xmlString: string): GpxData {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml')
    const trackPoints = xmlDoc.getElementsByTagName('trkpt')
    const nameNode = xmlDoc.getElementsByTagName('name')[0]
    const name = nameNode
        ? nameNode.textContent || 'Unnamed Track'
        : 'Unnamed Track'

    const points: GpxPoint[] = []

    for (let i = 0; i < trackPoints.length; i++) {
        const pt = trackPoints[i]
        const lat = parseFloat(pt.getAttribute('lat') || '0')
        const lon = parseFloat(pt.getAttribute('lon') || '0')
        const eleNode = pt.getElementsByTagName('ele')[0]
        const ele = eleNode ? parseFloat(eleNode.textContent || '0') : 0
        const timeNode = pt.getElementsByTagName('time')[0]
        const time = timeNode ? (timeNode.textContent ?? undefined) : undefined

        if (!isNaN(lat) && !isNaN(lon)) {
            points.push({ lat, lon, ele, time })
        }
    }

    return { name, points }
}
