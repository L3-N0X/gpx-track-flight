import { UnitsUtils } from "geo-three";
import { computeGpxStats, type GpxStats } from "./gpxStats";
import { parseGpx } from "./gpxParser";

export interface PreparedTrackPoint {
  lat: number;
  lon: number;
  ele: number;
  mercatorX: number;
  mercatorY: number;
  x: number;
  y: number;
  z: number;
  speedKmh: number;
  distanceFromStartM: number;
  originalIndex: number;
}

export interface MercatorBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PreparedTrackData {
  name: string;
  stats: GpxStats;
  points: PreparedTrackPoint[];
  segmentSpeeds: number[];
  totalDistanceM: number;
  mercatorBounds: MercatorBounds;
  highestPreparedIndex: number;
  fastestPreparedIndex: number | null;
}

const MIN_TRACK_POINT_DISTANCE_M = 10;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusM = 6371000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function averageSegmentSpeed(pointSpeeds: number[], startIndex: number, endIndex: number): number {
  let sum = 0;
  let count = 0;

  for (let i = startIndex + 1; i <= endIndex; i++) {
    const speed = pointSpeeds[i] ?? 0;
    if (speed > 0) {
      sum += speed;
      count++;
    }
  }

  if (count > 0) {
    return sum / count;
  }

  const fallbackStart = pointSpeeds[startIndex] ?? 0;
  const fallbackEnd = pointSpeeds[endIndex] ?? 0;
  return (fallbackStart + fallbackEnd) / 2;
}

function findNearestPreparedIndex(points: PreparedTrackPoint[], originalIndex: number | null): number | null {
  if (originalIndex === null || points.length === 0) {
    return null;
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i++) {
    const distance = Math.abs(points[i].originalIndex - originalIndex);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function prepareTrackData(gpxContent: string): PreparedTrackData {
  const gpxData = parseGpx(gpxContent);
  const stats = computeGpxStats(gpxData.name, gpxData.points);

  if (gpxData.points.length === 0) {
    return {
      name: gpxData.name,
      stats,
      points: [],
      segmentSpeeds: [],
      totalDistanceM: 0,
      mercatorBounds: {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      },
      highestPreparedIndex: 0,
      fastestPreparedIndex: null,
    };
  }

  const preparedPoints: PreparedTrackPoint[] = [];
  const segmentSpeeds: number[] = [];

  let previousMercatorX: number | null = null;
  let previousMercatorY: number | null = null;
  let totalDistanceM = 0;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < gpxData.points.length; i++) {
    const point = gpxData.points[i];
    const mercator = UnitsUtils.datumsToSpherical(point.lat, point.lon);

    const shouldInclude =
      preparedPoints.length === 0 ||
      previousMercatorX === null ||
      previousMercatorY === null ||
      Math.hypot(mercator.x - previousMercatorX, mercator.y - previousMercatorY) >=
        MIN_TRACK_POINT_DISTANCE_M ||
      i === gpxData.points.length - 1;

    if (!shouldInclude) {
      continue;
    }

    if (preparedPoints.length > 0) {
      const previousPrepared = preparedPoints[preparedPoints.length - 1];
      totalDistanceM += haversineMeters(
        previousPrepared.lat,
        previousPrepared.lon,
        point.lat,
        point.lon,
      );
      segmentSpeeds.push(
        averageSegmentSpeed(stats.pointSpeeds, previousPrepared.originalIndex, i),
      );
    }

    preparedPoints.push({
      lat: point.lat,
      lon: point.lon,
      ele: point.ele,
      mercatorX: mercator.x,
      mercatorY: mercator.y,
      x: mercator.x,
      y: Math.max(point.ele + 1000, 4000),
      z: -mercator.y,
      speedKmh: stats.pointSpeeds[i] ?? 0,
      distanceFromStartM: totalDistanceM,
      originalIndex: i,
    });

    previousMercatorX = mercator.x;
    previousMercatorY = mercator.y;

    minX = Math.min(minX, mercator.x);
    maxX = Math.max(maxX, mercator.x);
    minY = Math.min(minY, mercator.y);
    maxY = Math.max(maxY, mercator.y);
  }

  if (preparedPoints.length === 1) {
    segmentSpeeds.push(preparedPoints[0].speedKmh);
  }

  return {
    name: gpxData.name,
    stats,
    points: preparedPoints,
    segmentSpeeds,
    totalDistanceM,
    mercatorBounds: {
      minX,
      maxX,
      minY,
      maxY,
    },
    highestPreparedIndex: findNearestPreparedIndex(preparedPoints, stats.highestPointIndex) ?? 0,
    fastestPreparedIndex: findNearestPreparedIndex(preparedPoints, stats.fastestPointIndex),
  };
}
