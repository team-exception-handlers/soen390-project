import {
  findIndoorRoute,
  getFloorBounds,
  getGraphFloorBounds,
} from "../../utils/indoorDirections";

describe("indoorDirections", () => {
  test("uses Hall 1 coordinate space for Hall first-floor routes", () => {
    const route = findIndoorRoute("H", "112", "102-3");

    expect(route).not.toBeNull();
    expect(route?.startFloor).toBe(1);
    expect(route?.endFloor).toBe(1);

    const hall1Bounds = getGraphFloorBounds("H", 1);
    const hall1Segments = route?.segments.filter((segment) => segment.floor === 1) ?? [];

    expect(hall1Segments.length).toBeGreaterThan(0);

    for (const segment of hall1Segments) {
      for (const point of segment.points) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(hall1Bounds.width);
        expect(point.y).toBeLessThanOrEqual(hall1Bounds.height);
      }
    }
  });

  test("maps MB S2 bounds to the MB-S2 coordinate space", () => {
    const route = findIndoorRoute("MB", "S2.210", "S2.401");

    expect(route).not.toBeNull();

    const imageBounds = getFloorBounds("MB", -2);
    const graphBounds = getGraphFloorBounds("MB", -2);
    const s2Segments = route?.segments ?? [];

    expect(imageBounds).toEqual({ width: 1024, height: 1024 });
    expect(graphBounds.width).toBeLessThanOrEqual(imageBounds.width);
    expect(graphBounds.height).toBeLessThanOrEqual(imageBounds.height);
    expect(s2Segments.length).toBeGreaterThan(0);

    for (const segment of s2Segments) {
      for (const point of segment.points) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(graphBounds.width);
        expect(point.y).toBeLessThanOrEqual(graphBounds.height);
      }
    }
  });
});
