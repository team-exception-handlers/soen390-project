const path = require("node:path");
const { buildOsrmRouteUrl, fetchOsrmRoute } = require(
  path.join(__dirname, "..", "..", "utils", "osrmDirections.ts"),
);

describe("utils/osrmDirections", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete globalThis.fetch;
    jest.restoreAllMocks();
  });

  test("buildOsrmRouteUrl uses walking endpoint by default", () => {
    const url = buildOsrmRouteUrl(
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.46, longitude: -73.64 },
    );

    expect(url).toBe(
      "https://routing.openstreetmap.de/routed-foot/route/v1/walking/-73.579,45.497;-73.64,45.46?overview=full&geometries=geojson&steps=true",
    );
  });

  test("buildOsrmRouteUrl switches base URL for profile", () => {
    const url = buildOsrmRouteUrl(
      { latitude: 45.5, longitude: -73.6 },
      { latitude: 45.6, longitude: -73.7 },
      "driving",
    );

    expect(url).toContain("routing.openstreetmap.de/routed-car/route/v1/driving/");
    expect(url).toContain("steps=true");
  });

  test("fetchOsrmRoute maps coordinates and builds step instructions", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        routes: [
          {
            distance: 1000,
            duration: 97.2,
            geometry: {
              coordinates: [
                [-73.579, 45.497],
                [-73.578, 45.498],
              ],
            },
            legs: [
              {
                steps: [
                  {
                    distance: 150,
                    name: "Maisonneuve Blvd",
                    maneuver: { type: "depart", modifier: "north_east" },
                  },
                  {
                    distance: 1200,
                    ref: "A-10",
                    maneuver: { type: "turn", modifier: "left" },
                  },
                  {
                    distance: 800,
                    name: "Main St",
                    maneuver: { type: "fork", modifier: "right" },
                  },
                  {
                    distance: 500,
                    maneuver: { type: "depart" }, // no modifier
                  },
                  {
                    distance: 8,
                    maneuver: { type: "continue" },
                  },
                  {
                    distance: 3,
                    maneuver: { type: "arrive" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const route = await fetchOsrmRoute(
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.578 },
      "walking",
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://routing.openstreetmap.de/routed-foot/route/v1/walking/-73.579,45.497;-73.578,45.498?overview=full&geometries=geojson&steps=true",
    );
    expect(route).toEqual({
      distanceMeters: 1000,
      durationSeconds: 97,
      coordinates: [
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.578 },
      ],
      instructions: [
        {
          text: "Head north east on Maisonneuve Blvd, for 150 m.",
          distanceMeters: 150,
        },
        {
          text: "Turn left onto A-10, for 1.2 km.",
          distanceMeters: 1200,
        },
        {
          text: "Keep right onto Main St, for 800 m.",
          distanceMeters: 800,
        },
        {
          text: "Head forward on the path, for 500 m.",
          distanceMeters: 500,
        },
        {
          text: "Continue on the path, for a few meters.",
          distanceMeters: 8,
        },
        {
          text: "Arrive at your destination.",
          distanceMeters: 3,
        },
      ],
    });
  });

  test("fetchOsrmRoute returns empty instructions when legs are missing", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        routes: [
          {
            distance: 2000,
            duration: 123.7,
            geometry: { coordinates: [[-73.6, 45.5]] },
          },
        ],
      }),
    });

    const route = await fetchOsrmRoute(
      { latitude: 45.5, longitude: -73.6 },
      { latitude: 45.51, longitude: -73.61 },
      "driving",
    );

    expect(route.durationSeconds).toBe(124);
    expect(route.instructions).toEqual([]);
  });

  test("fetchOsrmRoute throws when response is not ok", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(
      fetchOsrmRoute(
        { latitude: 45.5, longitude: -73.6 },
        { latitude: 45.51, longitude: -73.61 },
      ),
    ).rejects.toThrow("OSRM route request failed with 503.");
  });

  test("fetchOsrmRoute throws when no route is available", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "NoRoute",
        routes: [],
      }),
    });

    await expect(
      fetchOsrmRoute(
        { latitude: 45.5, longitude: -73.6 },
        { latitude: 45.51, longitude: -73.61 },
      ),
    ).rejects.toThrow("No route available for the selected buildings.");
  });

  test("buildStepInstruction: turn with no modifier", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        routes: [{
          distance: 100, duration: 60,
          geometry: { coordinates: [[-73.579, 45.497], [-73.578, 45.498]] },
          legs: [{ steps: [
            { distance: 50, name: "Main St", maneuver: { type: "turn" } },
          ]}],
        }],
      }),
    });
    const route = await fetchOsrmRoute(
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.578 },
    );
    expect(route.instructions[0].text).toBe("Turn onto Main St, for 50 m.");
  });

  test("buildStepInstruction: fork with no modifier", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        routes: [{
          distance: 100, duration: 60,
          geometry: { coordinates: [[-73.579, 45.497], [-73.578, 45.498]] },
          legs: [{ steps: [
            { distance: 200, name: "Ramp", maneuver: { type: "fork" } },
          ]}],
        }],
      }),
    });
    const route = await fetchOsrmRoute(
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.578 },
    );
    expect(route.instructions[0].text).toBe("Keep going onto Ramp, for 200 m.");
  });

  test("buildStepInstruction: unknown maneuver type falls through to continue", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        routes: [{
          distance: 100, duration: 60,
          geometry: { coordinates: [[-73.579, 45.497], [-73.578, 45.498]] },
          legs: [{ steps: [
            { distance: 300, name: "Side St", maneuver: { type: "roundabout", modifier: "straight" } },
          ]}],
        }],
      }),
    });
    const route = await fetchOsrmRoute(
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.578 },
    );
    expect(route.instructions[0].text).toContain("Continue on");
  });

  test("fetchOsrmRoute handles leg with null steps", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        routes: [{
          distance: 500, duration: 60,
          geometry: { coordinates: [[-73.579, 45.497], [-73.578, 45.498]] },
          legs: [{ steps: null }],
        }],
      }),
    });
    const route = await fetchOsrmRoute(
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.578 },
    );
    expect(route.instructions).toEqual([]);
  });

  test("fetchOsrmRoute throws when code is Ok but geometry is empty", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: "Ok",
        routes: [
          {
            distance: 1000,
            duration: 120,
            geometry: { coordinates: [] },
          },
        ],
      }),
    });

    await expect(
      fetchOsrmRoute(
        { latitude: 45.5, longitude: -73.6 },
        { latitude: 45.51, longitude: -73.61 },
      ),
    ).rejects.toThrow("No route available for the selected buildings.");
  });
});
