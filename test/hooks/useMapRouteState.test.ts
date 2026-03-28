import {
  createInitialMapRouteState,
  mapRouteStateReducer,
} from "../../hooks/useMapRouteState";

describe("hooks/useMapRouteState", () => {
  test("reset_geometry clears derived route data but preserves shuttle departure", () => {
    const state = {
      ...createInitialMapRouteState(),
      routeCoordinates: [{ latitude: 1, longitude: 2 }],
      routeDurationMinutes: 12,
      routeDistanceMeters: 500,
      routeInstructions: [{ text: "Head north", distanceMeters: 50 }],
      showRouteInstructions: true,
      transitItineraries: [{} as any],
      selectedItineraryIndex: 2,
      selectedShuttleDeparture: "12:00",
      shuttleWalkToCoords: [{ latitude: 1, longitude: 2 }],
      shuttleDriveCoords: [{ latitude: 3, longitude: 4 }],
      shuttleWalkFromCoords: [{ latitude: 5, longitude: 6 }],
      expandedItineraries: [0],
      expandedIntermediateStops: new Set(["stop-1"]),
      routeStarted: true,
    };

    const next = mapRouteStateReducer(state, { type: "reset_geometry" });

    expect(next.routeCoordinates).toEqual([]);
    expect(next.routeInstructions).toEqual([]);
    expect(next.showRouteInstructions).toBe(false);
    expect(next.selectedItineraryIndex).toBe(0);
    expect(next.selectedShuttleDeparture).toBe("12:00");
  });

  test("applies transit route results and resets selection state", () => {
    const result = {
      routeCoordinates: [],
      routeDurationMinutes: 30,
      routeDistanceMeters: 2400,
      routeInstructions: [{ text: "Walk to stop", distanceMeters: 100 }],
      transitItineraries: [{ durationSeconds: 1800 } as any],
      shuttleWalkToCoords: [],
      shuttleDriveCoords: [],
      shuttleWalkFromCoords: [],
    };

    const next = mapRouteStateReducer(createInitialMapRouteState(), {
      type: "apply_route_result",
      payload: {
        result,
        showInstructions: true,
        routeMode: "transit",
      },
    });

    expect(next.routeDurationMinutes).toBe(30);
    expect(next.routeDistanceMeters).toBe(2400);
    expect(next.transitItineraries).toEqual(result.transitItineraries);
    expect(next.showRouteInstructions).toBe(true);
    expect(next.routeStarted).toBe(false);
  });

  test("applies shuttle route results and preserves shuttle geometry", () => {
    const result = {
      routeCoordinates: [],
      routeDurationMinutes: 35,
      routeDistanceMeters: 3200,
      routeInstructions: [{ text: "Take the shuttle", distanceMeters: 0 }],
      transitItineraries: [{ durationSeconds: 2000 } as any],
      shuttleWalkToCoords: [{ latitude: 1, longitude: 2 }],
      shuttleDriveCoords: [{ latitude: 3, longitude: 4 }],
      shuttleWalkFromCoords: [{ latitude: 5, longitude: 6 }],
    };

    const next = mapRouteStateReducer(createInitialMapRouteState(), {
      type: "apply_route_result",
      payload: {
        result,
        showInstructions: false,
        routeMode: "shuttle",
      },
    });

    expect(next.transitItineraries).toEqual(result.transitItineraries);
    expect(next.shuttleDriveCoords).toEqual(result.shuttleDriveCoords);
    expect(next.shuttleWalkToCoords).toEqual(result.shuttleWalkToCoords);
    expect(next.showRouteInstructions).toBe(false);
  });

  test("setters update itinerary expansion and instruction details", () => {
    let next = mapRouteStateReducer(createInitialMapRouteState(), {
      type: "set_expanded_itineraries",
      payload: [0, 1],
    });
    expect(next.expandedItineraries).toEqual([0, 1]);

    next = mapRouteStateReducer(next, {
      type: "set_expanded_intermediate_stops",
      payload: new Set(["stop-1"]),
    });
    expect(Array.from(next.expandedIntermediateStops)).toEqual(["stop-1"]);

    next = mapRouteStateReducer(next, {
      type: "set_route_instructions",
      payload: [{ text: "Continue", distanceMeters: 10 }],
    });
    expect(next.routeInstructions[0].text).toBe("Continue");
  });
});
