import {
  createInitialMapRouteState,
  mapRouteStateReducer,
  useMapRouteState,
} from "../../hooks/useMapRouteState";

const mockUseReducer = jest.fn();
const mockUseRef = jest.fn();

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useReducer: (...args: unknown[]) => mockUseReducer(...args),
    useMemo: (factory: () => unknown) => factory(),
    useCallback: <T extends (...args: any[]) => any>(fn: T) => fn,
    useRef: (value: unknown) => mockUseRef(value),
  };
});


describe("hooks/useMapRouteState", () => {
  beforeEach(() => {
    mockUseReducer.mockReset();
    mockUseRef.mockReset();
  });

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

  test("reset_all preserves shuttle departure and walk results use the base route state", () => {
    const state = {
      ...createInitialMapRouteState(),
      selectedShuttleDeparture: "16:00",
      routeCoordinates: [{ latitude: 1, longitude: 2 }],
    };
    const result = {
      routeCoordinates: [{ latitude: 45.5, longitude: -73.5 }],
      routeDurationMinutes: 10,
      routeDistanceMeters: 700,
      routeInstructions: [{ text: "Walk straight", distanceMeters: 20 }],
      transitItineraries: [{ durationSeconds: 600 } as any],
      shuttleWalkToCoords: [{ latitude: 1, longitude: 1 }],
      shuttleDriveCoords: [{ latitude: 2, longitude: 2 }],
      shuttleWalkFromCoords: [{ latitude: 3, longitude: 3 }],
    };

    expect(mapRouteStateReducer(state, { type: "reset_all" })).toEqual({
      ...createInitialMapRouteState(),
      selectedShuttleDeparture: "16:00",
    });

    expect(
      mapRouteStateReducer(createInitialMapRouteState(), {
        type: "apply_route_result",
        payload: {
          result,
          showInstructions: true,
          routeMode: "walking",
        },
      }),
    ).toMatchObject({
      routeCoordinates: result.routeCoordinates,
      routeDurationMinutes: 10,
      routeDistanceMeters: 700,
      routeInstructions: result.routeInstructions,
      showRouteInstructions: true,
      transitItineraries: [],
      shuttleWalkToCoords: [],
      shuttleDriveCoords: [],
      shuttleWalkFromCoords: [],
    });
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

  test("supports the remaining reducer setters and ignores unknown actions", () => {
    const state = createInitialMapRouteState();

    let next = mapRouteStateReducer(state, {
      type: "set_route_loading",
      payload: true,
    });
    expect(next.routeLoading).toBe(true);

    next = mapRouteStateReducer(next, {
      type: "set_show_route_instructions",
      payload: true,
    });
    expect(next.showRouteInstructions).toBe(true);

    next = mapRouteStateReducer(next, {
      type: "set_route_started",
      payload: true,
    });
    expect(next.routeStarted).toBe(true);

    next = mapRouteStateReducer(next, {
      type: "set_selected_itinerary_index",
      payload: 3,
    });
    expect(next.selectedItineraryIndex).toBe(3);

    next = mapRouteStateReducer(next, {
      type: "set_expanded_itineraries",
      payload: (current) => [...current, 4],
    });
    expect(next.expandedItineraries).toEqual([4]);

    next = mapRouteStateReducer(next, {
      type: "set_expanded_intermediate_stops",
      payload: (current) => new Set([...current, "stop-2"]),
    });
    expect(Array.from(next.expandedIntermediateStops)).toEqual(["stop-2"]);

    next = mapRouteStateReducer(next, {
      type: "set_route_duration_minutes",
      payload: 18,
    });
    expect(next.routeDurationMinutes).toBe(18);

    next = mapRouteStateReducer(next, {
      type: "set_route_distance_meters",
      payload: 900,
    });
    expect(next.routeDistanceMeters).toBe(900);

    next = mapRouteStateReducer(next, {
      type: "set_selected_shuttle_departure",
      payload: "14:30",
    });
    expect(next.selectedShuttleDeparture).toBe("14:30");

    expect(
      mapRouteStateReducer(next, { type: "unknown_action" } as any),
    ).toBe(next);
  });

  test("hook actions dispatch the expected state transitions and manage dismissal", () => {
    const dispatch = jest.fn();
    const state = createInitialMapRouteState();
    const routeInstructionsDismissedRef = { current: false };
    const result = {
      routeCoordinates: [{ latitude: 45.5, longitude: -73.5 }],
      routeDurationMinutes: 22,
      routeDistanceMeters: 1400,
      routeInstructions: [{ text: "Head east", distanceMeters: 50 }],
      transitItineraries: [],
      shuttleWalkToCoords: [],
      shuttleDriveCoords: [],
      shuttleWalkFromCoords: [],
    };

    mockUseReducer.mockReturnValue([state, dispatch]);
    mockUseRef.mockReturnValue(routeInstructionsDismissedRef);

    const hook = useMapRouteState();

    expect(hook.state).toBe(state);
    expect(hook.routeInstructionsDismissedRef).toBe(routeInstructionsDismissedRef);
    expect(hook.actions.shouldShowInstructionsForResult(result as any)).toBe(true);

    hook.actions.hideInstructions();
    expect(routeInstructionsDismissedRef.current).toBe(true);
    expect(hook.actions.shouldShowInstructionsForResult(result as any)).toBe(false);

    hook.actions.resetDismissed();
    expect(routeInstructionsDismissedRef.current).toBe(false);
    expect(
      hook.actions.shouldShowInstructionsForResult({
        ...result,
        routeCoordinates: [],
      } as any),
    ).toBe(true);

    hook.actions.resetAll();
    hook.actions.resetGeometry();
    hook.actions.applyRouteResult(result as any, {
      showInstructions: true,
      routeMode: "walking",
    });
    hook.actions.setRouteLoading(true);
    hook.actions.showInstructions();
    hook.actions.setRouteStarted(true);
    hook.actions.setSelectedItineraryIndex(1);
    hook.actions.setExpandedItineraries((current) => [...current, 1]);
    hook.actions.setExpandedIntermediateStops(
      (current) => new Set([...current, "stop-3"]),
    );
    hook.actions.setRouteDurationMinutes(12);
    hook.actions.setRouteDistanceMeters(450);
    hook.actions.setRouteInstructions(result.routeInstructions as any);
    hook.actions.setSelectedShuttleDeparture("09:15");
    hook.collapseInstructions();

    expect(routeInstructionsDismissedRef.current).toBe(true);
    expect(dispatch.mock.calls).toEqual(
      expect.arrayContaining([
        [{ type: "reset_all" }],
        [{ type: "reset_geometry" }],
        [
          {
            type: "apply_route_result",
            payload: {
              result,
              showInstructions: true,
              routeMode: "walking",
            },
          },
        ],
        [{ type: "set_route_loading", payload: true }],
        [{ type: "set_show_route_instructions", payload: true }],
        [{ type: "set_show_route_instructions", payload: false }],
        [{ type: "set_route_started", payload: true }],
        [{ type: "set_selected_itinerary_index", payload: 1 }],
        [{ type: "set_expanded_itineraries", payload: expect.any(Function) }],
        [
          {
            type: "set_expanded_intermediate_stops",
            payload: expect.any(Function),
          },
        ],
        [{ type: "set_route_duration_minutes", payload: 12 }],
        [{ type: "set_route_distance_meters", payload: 450 }],
        [{ type: "set_route_instructions", payload: result.routeInstructions }],
        [{ type: "set_selected_shuttle_departure", payload: "09:15" }],
      ]),
    );
  });
});
