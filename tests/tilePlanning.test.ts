import { beforeAll, describe, expect, test } from "bun:test";
import type { PreparedTrackData } from "../src/lib/trackPreparation";

let buildWarmupPlan: typeof import("../src/lib/tilePlanning").buildWarmupPlan;
let buildLocalTerrainBounds: typeof import("../src/lib/tilePlanning").buildLocalTerrainBounds;
let buildLocalRenderPlan: typeof import("../src/lib/tilePlanning").buildLocalRenderPlan;
let mercatorToTile: typeof import("../src/lib/tilePlanning").mercatorToTile;
let TERRAIN_OPERATIONAL_ZOOM: typeof import("../src/lib/tilePlanning").TERRAIN_OPERATIONAL_ZOOM;
let LOCAL_WINDOW_MAX_SIZE_M: typeof import("../src/lib/tilePlanning").LOCAL_WINDOW_MAX_SIZE_M;
let LOCAL_WINDOW_MIN_SIZE_M: typeof import("../src/lib/tilePlanning").LOCAL_WINDOW_MIN_SIZE_M;

beforeAll(async () => {
  class MockOffscreenCanvas {
    public width: number;
    public height: number;

    public constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    public getContext() {
      return {
        fillStyle: "#000000",
        fillRect() {},
      };
    }
  }

  Object.assign(globalThis, {
    OffscreenCanvas: MockOffscreenCanvas,
    document: {
      createElement: () => new MockOffscreenCanvas(1, 1),
    },
  });

  const tilePlanning = await import("../src/lib/tilePlanning");
  buildWarmupPlan = tilePlanning.buildWarmupPlan;
  buildLocalTerrainBounds = tilePlanning.buildLocalTerrainBounds;
  buildLocalRenderPlan = tilePlanning.buildLocalRenderPlan;
  mercatorToTile = tilePlanning.mercatorToTile;
  TERRAIN_OPERATIONAL_ZOOM = tilePlanning.TERRAIN_OPERATIONAL_ZOOM;
  LOCAL_WINDOW_MAX_SIZE_M = tilePlanning.LOCAL_WINDOW_MAX_SIZE_M;
  LOCAL_WINDOW_MIN_SIZE_M = tilePlanning.LOCAL_WINDOW_MIN_SIZE_M;
});

const preparedTrack: PreparedTrackData = {
  name: "Test",
  stats: {
    trackName: "Test",
    totalDistanceKm: 1,
    elevationGainM: 10,
    elevationLossM: 0,
    maxSpeedKmh: 30,
    avgSpeedKmh: 18,
    highestPointIndex: 1,
    highestElevationM: 520,
    fastestPointIndex: 1,
    pointSpeeds: [0, 30],
  },
  points: [
    {
      lat: 48.1351,
      lon: 11.582,
      ele: 500,
      mercatorX: 1289297,
      mercatorY: 6129360,
      x: 1289297,
      y: 1500,
      z: -6129360,
      speedKmh: 0,
      distanceFromStartM: 0,
      originalIndex: 0,
    },
    {
      lat: 48.1356,
      lon: 11.5826,
      ele: 520,
      mercatorX: 1289360,
      mercatorY: 6129440,
      x: 1289360,
      y: 1520,
      z: -6129440,
      speedKmh: 30,
      distanceFromStartM: 100,
      originalIndex: 1,
    },
  ],
  segmentSpeeds: [24],
  totalDistanceM: 100,
  mercatorBounds: {
    minX: 1289297,
    maxX: 1289360,
    minY: 6129360,
    maxY: 6129440,
  },
  highestPreparedIndex: 1,
  fastestPreparedIndex: 1,
};

describe("tile planning", () => {
  test("returns a stable sorted warm tile list", () => {
    const warmupPlan = buildWarmupPlan(preparedTrack);

    expect(warmupPlan.targetZoom).toBe(TERRAIN_OPERATIONAL_ZOOM);
    expect(warmupPlan.tileKeys.length).toBeGreaterThan(0);
    expect([...warmupPlan.tileKeys]).toEqual([...warmupPlan.tileKeys].sort());
  });

  test("maps mercator coordinates to valid tile coordinates", () => {
    const tile = mercatorToTile(TERRAIN_OPERATIONAL_ZOOM, 1289297, 6129360);
    const max = Math.pow(2, TERRAIN_OPERATIONAL_ZOOM) - 1;

    expect(tile.x).toBeGreaterThanOrEqual(0);
    expect(tile.x).toBeLessThanOrEqual(max);
    expect(tile.y).toBeGreaterThanOrEqual(0);
    expect(tile.y).toBeLessThanOrEqual(max);
  });

  test("builds a bounded local terrain window around the track", () => {
    const bounds = buildLocalTerrainBounds(preparedTrack);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(LOCAL_WINDOW_MIN_SIZE_M);
    expect(width).toBeLessThanOrEqual(LOCAL_WINDOW_MAX_SIZE_M);
    expect(bounds.minX).toBeLessThanOrEqual(preparedTrack.mercatorBounds.minX);
    expect(bounds.maxX).toBeGreaterThanOrEqual(preparedTrack.mercatorBounds.maxX);
    expect(bounds.minY).toBeLessThanOrEqual(preparedTrack.mercatorBounds.minY);
    expect(bounds.maxY).toBeGreaterThanOrEqual(preparedTrack.mercatorBounds.maxY);
  });

  test("creates a stable local tile allowlist for the bounded render area", () => {
    const renderPlan = buildLocalRenderPlan(preparedTrack);

    expect(renderPlan.rootZoom).toBeGreaterThanOrEqual(0);
    expect(renderPlan.tileKeys.length).toBeGreaterThan(0);
    expect(renderPlan.tileKeys).toEqual([...renderPlan.tileKeys].sort());
    expect(renderPlan.rootX).toBeGreaterThanOrEqual(0);
    expect(renderPlan.rootY).toBeGreaterThanOrEqual(0);
  });
});
