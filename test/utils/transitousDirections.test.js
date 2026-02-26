const path = require("node:path");
const {
    buildTransitousUrl,
    decodePolyline,
    fetchTransitItineraries,
    fetchTransitRoute,
    formatTime,
} = require(
    path.join(__dirname, "..", "..", "utils", "transitousDirections.ts"),
);

const {
    mockItineraryWithBus,
    mockItineraryWithDuration,
    mockItineraryWithHoursMinutes,
    mockItineraryWithTram,
    mockItineraryWithRail,
    mockItineraryWithTransfers,
    mockItineraryWithNullGeometry,
    mockItineraryWithFerry,
    mockItineraryAllWalk,
    mockItineraryNoRoute,
    mockItineraryWithFork,
} = require("../mocks/transitousMocks");

const createMockFetch = (response) => {
    return jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(response),
    });
};

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
        globalThis.fetch = createMockFetch({ itineraries: [mockItineraryWithBus] });

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
        expect(result[0].durationSeconds).toBe(1920);
        expect(result[0].distanceMeters).toBe(5978);
        expect(result[0].transfers).toBe(0);
    });

    test("fetchTransitItineraries formats duration with exact hours", async () => {
        globalThis.fetch = createMockFetch({ itineraries: [mockItineraryWithDuration] });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].instructions[0].text).toContain("2 h");
        expect(result[0].instructions[0].text).not.toContain("0 min");
    });

    test("fetchTransitItineraries formats duration with hours and minutes", async () => {
        globalThis.fetch = createMockFetch({ itineraries: [mockItineraryWithHoursMinutes] });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].instructions[0].text).toContain("h");
        expect(result[0].instructions[0].text).toContain("min");
    });

    test("fetchTransitItineraries handles TRAM mode correctly", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 1200,
                        legs: [
                            {
                                mode: "TRAM",
                                from: { name: "Stop A" },
                                to: { name: "Stop B" },
                                startTime: "2026-02-19T17:00:00Z",
                                endTime: "2026-02-19T17:20:00Z",
                                distance: 3000,
                                duration: 1200,
                                routeShortName: "T1",
                                headsign: "Downtown",
                                legGeometry: { points: "xyz" },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].legs[0].mode).toBe("TRAM");
        expect(result[0].instructions[0].text).toContain("Take Tram");
        expect(result[0].instructions[0].text).toContain("T1");
        expect(result[0].instructions[0].text).toContain("towards Downtown");
    });

    test("fetchTransitItineraries handles RAIL mode correctly", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 1800,
                        legs: [
                            {
                                mode: "RAIL",
                                from: { name: "Station A" },
                                to: { name: "Station B" },
                                startTime: "2026-02-19T17:00:00Z",
                                endTime: "2026-02-19T17:30:00Z",
                                distance: 10000,
                                duration: 1800,
                                routeShortName: "R5",
                                headsign: "North",
                                legGeometry: { points: "qrs" },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].legs[0].mode).toBe("RAIL");
        expect(result[0].instructions[0].text).toContain("Take Train");
        expect(result[0].instructions[0].text).toContain("R5");
        expect(result[0].instructions[0].text).toContain("towards North");
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

    test("fetchTransitItineraries handles unknown mode with default case", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 900,
                        legs: [
                            {
                                mode: "OTHER",
                                from: { name: "A" },
                                to: { name: "B" },
                                distance: 1500,
                                duration: 900,
                                legGeometry: { points: "abc" },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].instructions[0].text).toContain("Take OTHER");
    });


    test("fetchTransitItineraries handles legs without geometry", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 600,
                        legs: [
                            {
                                mode: "WALK",
                                from: { name: "A" },
                                to: { name: "B" },
                                startTime: "2026-02-19T17:00:00Z",
                                endTime: "2026-02-19T17:10:00Z",
                                distance: 500,
                                duration: 600,
                                legGeometry: null,
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].coordinates).toEqual([]);
    });

    test("fetchTransitItineraries handles unknown transit mode", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 600,
                        legs: [
                            {
                                mode: "FERRY",
                                from: { name: "A" },
                                to: { name: "B" },
                                startTime: "2026-02-19T17:00:00Z",
                                endTime: "2026-02-19T17:10:00Z",
                                distance: 1000,
                                duration: 600,
                                legGeometry: { points: "abc" },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].instructions[0].text).toContain("Take FERRY to B (1.0 km).");
    });

    test("fetchTransitItineraries handles all walk itinerary", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 1200,
                        legs: [
                            {
                                mode: "WALK",
                                from: { name: "A" },
                                to: { name: "B" },
                                startTime: "2026-02-19T17:00:00Z",
                                endTime: "2026-02-19T17:20:00Z",
                                distance: 1000,
                                duration: 1200,
                                legGeometry: { points: "abc" },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].transfers).toBe(0);
    });

    test("fetchTransitItineraries handles leg without route", async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                itineraries: [
                    {
                        duration: 600,
                        legs: [
                            {
                                mode: "BUS",
                                from: { name: "A" },
                                to: { name: "B" },
                                startTime: "2026-02-19T17:00:00Z",
                                endTime: "2026-02-19T17:10:00Z",
                                distance: 1000,
                                duration: 600,
                                legGeometry: { points: "abc" },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await fetchTransitItineraries(
            { latitude: 45.5, longitude: -73.6 },
            { latitude: 45.6, longitude: -73.7 },
        );

        expect(result[0].instructions[0].text).toContain("Take Bus to B.");
    });
});