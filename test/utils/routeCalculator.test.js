jest.mock("../../utils/osrmDirections", () => ({ fetchOsrmRoute: jest.fn() }));
jest.mock("../../utils/transitousDirections", () => ({ fetchTransitItineraries: jest.fn() }));
jest.mock("../../utils/locationLogic", () => ({
    getNearestStop: jest.fn(),
    STOPS: {
        "Main Campus":     { latitude: 45.5,  longitude: -73.6  },
        "Downtown Campus": { latitude: 45.51, longitude: -73.61 },
    },
}));
jest.mock("../../utils/shuttleLogic", () => ({
    getShuttleInfo:       jest.fn(),
    calculateArrivalTime: jest.fn(),
}));

const {
    emptyRouteResult,
    calculateShuttleRouteHelper,
    calculateTransitRouteHelper,
    calculateOsrmRouteHelper,
} = require("../../utils/routeCalculators");

const { fetchOsrmRoute }          = require("../../utils/osrmDirections");
const { fetchTransitItineraries } = require("../../utils/transitousDirections");
const { getNearestStop }          = require("../../utils/locationLogic");
const { getShuttleInfo, calculateArrivalTime } = require("../../utils/shuttleLogic");

const originPoint = { latitude: 45.49, longitude: -73.58 };

const destinationBuilding = {
    latitude:  45.52,
    longitude: -73.62,
    shortName: "EV Building",
};

function mockOsrmLeg(overrides = {}) {
    return {
        coordinates:     [{ latitude: 45.5, longitude: -73.6 }],
        durationSeconds: 300,
        distanceMeters:  400,
        instructions:    [{ text: "Head north", distanceMeters: 400 }],
        ...overrides,
    };
}

function mockShuttleInfo(overrides = {}) {
    return {
        serviceUnavailable:  false,
        nextThreeDepartures: ["10:00", "10:30", "11:00"],
        ...overrides,
    };
}

describe("emptyRouteResult", () => {
    test("returns a result with all empty/null fields", () => {
        const result = emptyRouteResult();
        expect(result.routeCoordinates).toEqual([]);
        expect(result.routeDurationMinutes).toBeNull();
        expect(result.routeDistanceMeters).toBeNull();
        expect(result.routeInstructions).toEqual([]);
        expect(result.transitItineraries).toEqual([]);
        expect(result.shuttleWalkToCoords).toEqual([]);
        expect(result.shuttleDriveCoords).toEqual([]);
        expect(result.shuttleWalkFromCoords).toEqual([]);
    });

    test("returns a new object on every call", () => {
        expect(emptyRouteResult()).not.toBe(emptyRouteResult());
    });
});

describe("calculateOsrmRouteHelper", () => {
    beforeEach(() => {
        fetchOsrmRoute.mockResolvedValue(mockOsrmLeg());
    });

    afterEach(() => jest.clearAllMocks());

    test("calls fetchOsrmRoute with the provided mode when on the same campus", async () => {
        await calculateOsrmRouteHelper(originPoint, destinationBuilding, "walking", true);
        expect(fetchOsrmRoute).toHaveBeenCalledWith(originPoint, destinationBuilding, "walking");
    });

    test("upgrades 'walking' to 'cycling' when not on the same campus", async () => {
        await calculateOsrmRouteHelper(originPoint, destinationBuilding, "walking", false);
        expect(fetchOsrmRoute).toHaveBeenCalledWith(originPoint, destinationBuilding, "cycling");
    });

    test("does not upgrade non-walking modes even on a different campus", async () => {
        await calculateOsrmRouteHelper(originPoint, destinationBuilding, "driving", false);
        expect(fetchOsrmRoute).toHaveBeenCalledWith(originPoint, destinationBuilding, "driving");
    });

    test("returns correct route data from the osrm response", async () => {
        const leg = mockOsrmLeg({ durationSeconds: 600, distanceMeters: 800 });
        fetchOsrmRoute.mockResolvedValue(leg);

        const result = await calculateOsrmRouteHelper(originPoint, destinationBuilding, "driving", true);

        expect(result.routeDurationMinutes).toBe(10);
        expect(result.routeDistanceMeters).toBe(800);
        expect(result.routeCoordinates).toEqual(leg.coordinates);
        expect(result.routeInstructions).toEqual(leg.instructions);
    });

    test("rounds duration to the nearest minute", async () => {
        fetchOsrmRoute.mockResolvedValue(mockOsrmLeg({ durationSeconds: 95 }));
        const result = await calculateOsrmRouteHelper(originPoint, destinationBuilding, "walking", true);
        expect(result.routeDurationMinutes).toBe(2);
    });
});

describe("calculateTransitRouteHelper", () => {
    afterEach(() => jest.clearAllMocks());

    test("returns all itineraries from fetchTransitItineraries", async () => {
        const itinerary = {
            durationSeconds: 1800,
            distanceMeters:  3000,
            transfers:       1,
            departureTime:   new Date().toISOString(),
            arrivalTime:     new Date().toISOString(),
            legs:            [],
            instructions:    [{ text: "Board bus 55", distanceMeters: 0 }],
            coordinates:     [],
        };

        fetchTransitItineraries.mockResolvedValue([itinerary]);
        const result = await calculateTransitRouteHelper(originPoint, destinationBuilding);

        expect(result.transitItineraries).toHaveLength(1);
        expect(result.transitItineraries[0]).toEqual(itinerary);
    });

    test("populates top-level duration, distance, and instructions from the first itinerary", async () => {
        const itinerary = {
            durationSeconds: 1800,
            distanceMeters:  3000,
            transfers:       0,
            departureTime:   new Date().toISOString(),
            arrivalTime:     new Date().toISOString(),
            legs:            [],
            instructions:    [{ text: "Board bus 55", distanceMeters: 0 }],
            coordinates:     [],
        };

        fetchTransitItineraries.mockResolvedValue([itinerary]);
        const result = await calculateTransitRouteHelper(originPoint, destinationBuilding);

        expect(result.routeDurationMinutes).toBe(30);
        expect(result.routeDistanceMeters).toBe(3000);
        expect(result.routeInstructions).toEqual(itinerary.instructions);
    });

    test("returns empty route fields when there are no itineraries", async () => {
        fetchTransitItineraries.mockResolvedValue([]);
        const result = await calculateTransitRouteHelper(originPoint, destinationBuilding);

        expect(result.routeDurationMinutes).toBeNull();
        expect(result.routeDistanceMeters).toBeNull();
        expect(result.routeInstructions).toEqual([]);
    });

    test("passes the current time as an ISO string to fetchTransitItineraries", async () => {
        fetchTransitItineraries.mockResolvedValue([]);
        const before = Date.now();
        await calculateTransitRouteHelper(originPoint, destinationBuilding);
        const after = Date.now();

        const calledWith = fetchTransitItineraries.mock.calls[0][2];
        const calledTime = new Date(calledWith).getTime();

        expect(calledTime).toBeGreaterThanOrEqual(before);
        expect(calledTime).toBeLessThanOrEqual(after);
    });
});

describe("calculateShuttleRouteHelper", () => {
    beforeEach(() => {
        getNearestStop.mockReturnValue({ stop: "Main Campus", destination: "Downtown Campus" });
        getShuttleInfo.mockReturnValue(mockShuttleInfo());
        calculateArrivalTime.mockReturnValue("10:45");

        fetchOsrmRoute
            .mockResolvedValueOnce(mockOsrmLeg({ durationSeconds: 300, distanceMeters: 400,  coordinates: [{ latitude: 45.49, longitude: -73.58 }] }))
            .mockResolvedValueOnce(mockOsrmLeg({ durationSeconds: 600, distanceMeters: 5000, coordinates: [{ latitude: 45.5,  longitude: -73.6  }] }))
            .mockResolvedValueOnce(mockOsrmLeg({ durationSeconds: 180, distanceMeters: 200,  coordinates: [{ latitude: 45.52, longitude: -73.62 }] }));
    });

    afterEach(() => jest.clearAllMocks());

    test("returns null when shuttle service is unavailable", async () => {
        getShuttleInfo.mockReturnValue(mockShuttleInfo({ serviceUnavailable: true }));
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        expect(result).toBeNull();
    });

    test("returns a result with one transit itinerary on success", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        expect(result).not.toBeNull();
        expect(result.transitItineraries).toHaveLength(1);
    });

    test("itinerary contains walk-to, shuttle, and walk-from legs in order", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        const legs = result.transitItineraries[0].legs;
        expect(legs).toHaveLength(3);
        expect(legs[0].mode).toBe("WALK");
        expect(legs[1].mode).toBe("BUS");
        expect(legs[2].mode).toBe("WALK");
    });

    test("sets the shuttle leg headsign to the destination campus", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        expect(result.transitItineraries[0].legs[1].headsign).toBe("Downtown Campus Campus");
    });

    test("uses selectedShuttleDeparture when provided", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, "10:30");
        expect(result).not.toBeNull();

        const startTime = new Date(result.transitItineraries[0].legs[1].startTime);
        expect(startTime.getHours()).toBe(10);
        expect(startTime.getMinutes()).toBe(30);
    });

    test("populates all three coordinate arrays", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        expect(result.shuttleWalkToCoords).toHaveLength(1);
        expect(result.shuttleDriveCoords).toHaveLength(1);
        expect(result.shuttleWalkFromCoords).toHaveLength(1);
    });

    test("fetches three OSRM legs with walking, driving, and walking modes", async () => {
        await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        const calls = fetchOsrmRoute.mock.calls;
        expect(calls[0][2]).toBe("walking");
        expect(calls[1][2]).toBe("driving");
        expect(calls[2][2]).toBe("walking");
    });

    test("total duration is at least the sum of all leg travel times", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        // walkTo=300s + drive=600s + walkFrom=180s = 1080s = 18 min baseline
        expect(result.routeDurationMinutes).toBeGreaterThanOrEqual(18);
    });

    test("includes a wait instruction referencing the origin stop name", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        expect(
            result.routeInstructions.some((i) => i.text.includes("Main Campus shuttle stop"))
        ).toBe(true);
    });

    test("includes a shuttle instruction referencing the destination campus", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        expect(
            result.routeInstructions.some((i) => i.text.includes("Downtown Campus"))
        ).toBe(true);
    });

    test("embeds the arrival time from calculateArrivalTime in the shuttle instruction", async () => {
        const result = await calculateShuttleRouteHelper(originPoint, destinationBuilding, null);
        expect(
            result.routeInstructions.some((i) => i.text.includes("10:45"))
        ).toBe(true);
    });
});