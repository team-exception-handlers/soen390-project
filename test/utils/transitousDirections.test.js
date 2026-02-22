const path = require("path");
const {
    buildTransitousUrl,
    decodePolyline,
    fetchTransitItineraries,
    fetchTransitRoute,
    formatTime,
} = require(
    path.join(__dirname, "..", "..", "utils", "transitousDirections.ts"),
);

describe("utils/transitousDirections", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => { });
    });

    afterEach(() => {
        delete globalThis.fetch;
        jest.restoreAllMocks();
    });

    test("decodePolyline decodes encoded string with precision 7", () => {
        const encoded = "i~fxbZhaqkzj@}tA_sAyCwDoAoF";
        const result = decodePolyline(encoded, 7);

        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty("latitude");
        expect(result[0]).toHaveProperty("longitude");
        expect(typeof result[0].latitude).toBe("number");
        expect(typeof result[0].longitude).toBe("number");
    });

    test("decodePolyline returns empty array for empty string", () => {
        const result = decodePolyline("");
        expect(result).toEqual([]);
    });

    test("formatTime converts ISO string to HH:mm format", () => {
        const iso = "2026-02-19T17:06:00Z";
        const result = formatTime(iso);

        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    test("buildTransitousUrl builds correct URL with current time", () => {
        const origin = { latitude: 45.495376, longitude: -73.577997 };
        const destination = { latitude: 45.457881, longitude: -73.641565 };

        const url = buildTransitousUrl(origin, destination);

        expect(url).toContain("https://api.transitous.org/api/v1/plan?");
        expect(url).toContain(`fromPlace=${origin.latitude}%2C${origin.longitude}`);
        expect(url).toContain(`toPlace=${destination.latitude}%2C${destination.longitude}`);
        expect(url).toContain("numItineraries=3");
        expect(url).toContain("time=");
    });

    test("buildTransitousUrl uses provided departureTime", () => {
        const origin = { latitude: 45.495376, longitude: -73.577997 };
        const destination = { latitude: 45.457881, longitude: -73.641565 };
        const departureTime = "2026-02-19T17:06:00Z";

        const url = buildTransitousUrl(origin, destination, departureTime);

        expect(url).toContain(`time=${encodeURIComponent(departureTime)}`);
    });

    test("fetchTransitItineraries parses API response correctly", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 1920,
                        legs: [
                            {
                                mode: "WALK",
                                from: { name: "START", lat: 45.49705, lon: -73.578009 },
                                to: { name: "Station A", lat: 45.49475, lon: -73.57078 },
                                startTime: "2026-02-19T17:06:00Z",
                                endTime: "2026-02-19T17:20:00Z",
                                distance: 978,
                                duration: 840,
                                legGeometry: { points: "i~fxbZhaqkzj@}tA_sA" },
                                intermediateStops: [],
                            },
                            {
                                mode: "BUS",
                                from: { name: "Station A", lat: 45.49475, lon: -73.57078 },
                                to: { name: "Station B", lat: 45.45367, lon: -73.64172 },
                                startTime: "2026-02-19T17:20:00Z",
                                endTime: "2026-02-19T17:29:00Z",
                                distance: 5000,
                                duration: 540,
                                routeShortName: "105",
                                headsign: "East",
                                legGeometry: { points: "wixvbZnh`gzj@fEfE" },
                                intermediateStops: [],
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.495376, longitude: -73.577997 },
            { latitude: 45.457881, longitude: -73.641565 },
        );

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining("https://api.transitous.org/api/v1/plan"),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "User-Agent": expect.stringContaining("concordia-class-finder"),
                    Accept: "application/json",
                }),
            }),
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            durationSeconds: 1920,
            distanceMeters: 5978,
            transfers: 0,
            departureTime: "2026-02-19T17:06:00Z",
            arrivalTime: "2026-02-19T17:29:00Z",
            legs: expect.arrayContaining([
                expect.objectContaining({
                    mode: "WALK",
                    route: undefined,
                }),
                expect.objectContaining({
                    mode: "BUS",
                    route: "105",
                    headsign: "East",
                }),
            ]),
            instructions: expect.arrayContaining([
                expect.objectContaining({
                    text: expect.stringContaining("Walk"),
                    distanceMeters: 978,
                }),
                expect.objectContaining({
                    text: expect.stringContaining("Take Bus 105"),
                    distanceMeters: 5000,
                }),
            ]),
            coordinates: expect.any(Array),
        });
    });

    test("fetchTransitItineraries calculates transfers correctly for multiple transit legs", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 3600,
                        legs: [
                            {
                                mode: "WALK",
                                from: {},
                                to: {},
                                distance: 100,
                                duration: 120,
                                legGeometry: { points: "abc" },
                            },
                            {
                                mode: "BUS",
                                from: {},
                                to: {},
                                distance: 1000,
                                duration: 600,
                                legGeometry: { points: "def" },
                            },
                            {
                                mode: "WALK",
                                from: {},
                                to: {},
                                distance: 50,
                                duration: 60,
                                legGeometry: { points: "ghi" },
                            },
                            {
                                mode: "SUBWAY",
                                from: {},
                                to: {},
                                distance: 2000,
                                duration: 900,
                                legGeometry: { points: "jkl" },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.495376, longitude: -73.577997 },
            { latitude: 45.457881, longitude: -73.641565 },
        );

        expect(result[0].transfers).toBe(1);
    });

    test("fetchTransitItineraries throws when response is not ok", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
        });

        await expect(
            fetchTransitItineraries(
                { latitude: 45.495376, longitude: -73.577997 },
                { latitude: 45.457881, longitude: -73.641565 },
            ),
        ).rejects.toThrow("Transitous request failed with 500");
    });

    test("fetchTransitItineraries throws when no itineraries available", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [],
            }),
        });

        await expect(
            fetchTransitItineraries(
                { latitude: 45.495376, longitude: -73.577997 },
                { latitude: 45.457881, longitude: -73.641565 },
            ),
        ).rejects.toThrow("No transit route available for the selected locations");
    });

    test("fetchTransitItineraries throws when itineraries is null", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({}),
        });

        await expect(
            fetchTransitItineraries(
                { latitude: 45.495376, longitude: -73.577997 },
                { latitude: 45.457881, longitude: -73.641565 },
            ),
        ).rejects.toThrow("No transit route available for the selected locations");
    });

    test("fetchTransitRoute returns first itinerary only", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 1920,
                        legs: [
                            {
                                mode: "WALK",
                                from: { name: "START" },
                                to: { name: "END" },
                                startTime: "2026-02-19T17:06:00Z",
                                endTime: "2026-02-19T17:20:00Z",
                                distance: 978,
                                duration: 840,
                                legGeometry: { points: "i~fxbZhaqkzj@}tA_sA" },
                            },
                        ],
                    },
                    {
                        duration: 2400,
                        legs: [
                            {
                                mode: "BUS",
                                from: { name: "START" },
                                to: { name: "END" },
                                startTime: "2026-02-19T17:10:00Z",
                                endTime: "2026-02-19T17:50:00Z",
                                distance: 5000,
                                duration: 2400,
                                legGeometry: { points: "wixvbZnh`gzj@fEfE" },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitRoute(
            { latitude: 45.495376, longitude: -73.577997 },
            { latitude: 45.457881, longitude: -73.641565 },
        );

        expect(result.durationSeconds).toBe(1920);
        expect(result.legs).toHaveLength(1);
        expect(result.legs[0].mode).toBe("WALK");
    });

    test("fetchTransitRoute passes departureTime parameter", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 1920,
                        legs: [
                            {
                                mode: "WALK",
                                from: {},
                                to: {},
                                distance: 100,
                                duration: 120,
                                legGeometry: { points: "abc" },
                            },
                        ],
                    },
                ],
            }),
        });

        const departureTime = "2026-02-19T17:06:00Z";
        await fetchTransitRoute(
            { latitude: 45.495376, longitude: -73.577997 },
            { latitude: 45.457881, longitude: -73.641565 },
            departureTime,
        );

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`time=${encodeURIComponent(departureTime)}`),
            expect.any(Object),
        );
    });
});