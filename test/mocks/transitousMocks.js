const mockItineraryWithBus = {
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
};

const mockItineraryWithDuration = {
    duration: 7200,
    legs: [
        {
            mode: "WALK",
            from: { name: "A" },
            to: { name: "B" },
            startTime: "2026-02-19T17:00:00Z",
            endTime: "2026-02-19T19:00:00Z",
            distance: 5000,
            duration: 7200,
            legGeometry: { points: "abc" },
        },
    ],
};

const mockItineraryWithHoursMinutes = {
    duration: 9000,
    legs: [
        {
            mode: "WALK",
            from: { name: "A" },
            to: { name: "B" },
            startTime: "2026-02-19T17:00:00Z",
            endTime: "2026-02-19T19:30:00Z",
            distance: 5000,
            duration: 9000,
            legGeometry: { points: "abc" },
        },
    ],
};

const mockItineraryWithTram = {
    duration: 600,
    legs: [
        {
            mode: "TRAM",
            from: { name: "A" },
            to: { name: "B" },
            startTime: "2026-02-19T17:00:00Z",
            endTime: "2026-02-19T17:10:00Z",
            distance: 1000,
            duration: 600,
            routeShortName: "T1",
            headsign: "Center",
            legGeometry: { points: "abc" },
        },
    ],
};

const mockItineraryWithRail = {
    duration: 600,
    legs: [
        {
            mode: "RAIL",
            from: { name: "A" },
            to: { name: "B" },
            startTime: "2026-02-19T17:00:00Z",
            endTime: "2026-02-19T17:10:00Z",
            distance: 1000,
            duration: 600,
            routeShortName: "R2",
            headsign: "North",
            legGeometry: { points: "abc" },
        },
    ],
};

const mockItineraryWithTransfers = {
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
};

const mockItineraryWithNullGeometry = {
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
};

const mockItineraryWithFerry = {
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
};

const mockItineraryAllWalk = {
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
};

const mockItineraryNoRoute = {
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
};

const mockItineraryWithFork = {
    duration: 600,
    legs: [
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
    ].map(step => ({
        mode: "WALK",
        from: { name: "A" },
        to: { name: "B" },
        startTime: "2026-02-19T17:00:00Z",
        endTime: "2026-02-19T17:10:00Z",
        distance: step.distance,
        duration: 100,
        legGeometry: { points: "abc" },
        ...step,
    })),
};

module.exports = {
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
};