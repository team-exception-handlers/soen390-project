import { useCallback, useMemo, useReducer, useRef } from "react";
import type { RouteLoaderResult } from "../utils/routeCalculators";
import type { RouteInstruction } from "../utils/osrmDirections";
import type { TransitItinerary } from "../utils/transitousDirections";
import type { LatLng, RouteMode } from "../types/map";

export type MapRouteState = {
  routeCoordinates: LatLng[];
  routeDurationMinutes: number | null;
  routeDistanceMeters: number | null;
  routeLoading: boolean;
  routeInstructions: RouteInstruction[];
  showRouteInstructions: boolean;
  transitItineraries: TransitItinerary[];
  selectedItineraryIndex: number;
  selectedShuttleDeparture: string | null;
  shuttleWalkToCoords: LatLng[];
  shuttleDriveCoords: LatLng[];
  shuttleWalkFromCoords: LatLng[];
  expandedItineraries: number[];
  expandedIntermediateStops: Set<string>;
  routeStarted: boolean;
};

type MapRouteStateAction =
  | { type: "reset_all" }
  | { type: "reset_geometry" }
  | {
      type: "apply_route_result";
      payload: {
        result: RouteLoaderResult;
        showInstructions: boolean;
        routeMode: RouteMode;
      };
    }
  | { type: "set_route_loading"; payload: boolean }
  | { type: "set_show_route_instructions"; payload: boolean }
  | { type: "set_route_started"; payload: boolean }
  | { type: "set_selected_itinerary_index"; payload: number }
  | { type: "set_expanded_itineraries"; payload: number[] | ((value: number[]) => number[]) }
  | {
      type: "set_expanded_intermediate_stops";
      payload: Set<string> | ((value: Set<string>) => Set<string>);
    }
  | { type: "set_route_duration_minutes"; payload: number | null }
  | { type: "set_route_distance_meters"; payload: number | null }
  | { type: "set_route_instructions"; payload: RouteInstruction[] }
  | { type: "set_selected_shuttle_departure"; payload: string | null };

export const createInitialMapRouteState = (): MapRouteState => ({
  routeCoordinates: [],
  routeDurationMinutes: null,
  routeDistanceMeters: null,
  routeLoading: false,
  routeInstructions: [],
  showRouteInstructions: false,
  transitItineraries: [],
  selectedItineraryIndex: 0,
  selectedShuttleDeparture: null,
  shuttleWalkToCoords: [],
  shuttleDriveCoords: [],
  shuttleWalkFromCoords: [],
  expandedItineraries: [],
  expandedIntermediateStops: new Set(),
  routeStarted: false,
});

const resetGeometryState = (state: MapRouteState): MapRouteState => ({
  ...state,
  routeCoordinates: [],
  routeDurationMinutes: null,
  routeDistanceMeters: null,
  routeInstructions: [],
  showRouteInstructions: false,
  transitItineraries: [],
  selectedItineraryIndex: 0,
  shuttleWalkToCoords: [],
  shuttleDriveCoords: [],
  shuttleWalkFromCoords: [],
  expandedItineraries: [],
  expandedIntermediateStops: new Set(),
  routeStarted: false,
});

export const mapRouteStateReducer = (
  state: MapRouteState,
  action: MapRouteStateAction,
): MapRouteState => {
  switch (action.type) {
    case "reset_all":
      return {
        ...createInitialMapRouteState(),
        selectedShuttleDeparture: state.selectedShuttleDeparture,
      };
    case "reset_geometry":
      return resetGeometryState(state);
    case "apply_route_result": {
      const { result, showInstructions, routeMode } = action.payload;
      const nextState: MapRouteState = {
        ...state,
        routeCoordinates: result.routeCoordinates,
        routeDurationMinutes: result.routeDurationMinutes,
        routeDistanceMeters: result.routeDistanceMeters,
        routeInstructions: result.routeInstructions,
        showRouteInstructions: showInstructions,
      };

      if (routeMode === "transit") {
        return {
          ...nextState,
          transitItineraries: result.transitItineraries,
          selectedItineraryIndex: 0,
          expandedItineraries: [],
          routeStarted: false,
        };
      }

      if (routeMode === "shuttle") {
        return {
          ...nextState,
          transitItineraries: result.transitItineraries,
          shuttleWalkToCoords: result.shuttleWalkToCoords,
          shuttleDriveCoords: result.shuttleDriveCoords,
          shuttleWalkFromCoords: result.shuttleWalkFromCoords,
        };
      }

      return nextState;
    }
    case "set_route_loading":
      return { ...state, routeLoading: action.payload };
    case "set_show_route_instructions":
      return { ...state, showRouteInstructions: action.payload };
    case "set_route_started":
      return { ...state, routeStarted: action.payload };
    case "set_selected_itinerary_index":
      return { ...state, selectedItineraryIndex: action.payload };
    case "set_expanded_itineraries":
      return {
        ...state,
        expandedItineraries:
          typeof action.payload === "function"
            ? action.payload(state.expandedItineraries)
            : action.payload,
      };
    case "set_expanded_intermediate_stops":
      return {
        ...state,
        expandedIntermediateStops:
          typeof action.payload === "function"
            ? action.payload(state.expandedIntermediateStops)
            : action.payload,
      };
    case "set_route_duration_minutes":
      return { ...state, routeDurationMinutes: action.payload };
    case "set_route_distance_meters":
      return { ...state, routeDistanceMeters: action.payload };
    case "set_route_instructions":
      return { ...state, routeInstructions: action.payload };
    case "set_selected_shuttle_departure":
      return { ...state, selectedShuttleDeparture: action.payload };
    default:
      return state;
  }
};

export function useMapRouteState() {
  const [state, dispatch] = useReducer(
    mapRouteStateReducer,
    undefined,
    createInitialMapRouteState,
  );
  const routeInstructionsDismissedRef = useRef(false);

  const actions = useMemo(
    () => ({
      resetAll: () => {
        routeInstructionsDismissedRef.current = false;
        dispatch({ type: "reset_all" });
      },
      resetGeometry: () => dispatch({ type: "reset_geometry" }),
      applyRouteResult: (
        result: RouteLoaderResult,
        options: { showInstructions: boolean; routeMode: RouteMode },
      ) =>
        dispatch({
          type: "apply_route_result",
          payload: {
            result,
            showInstructions: options.showInstructions,
            routeMode: options.routeMode,
          },
        }),
      setRouteLoading: (value: boolean) =>
        dispatch({ type: "set_route_loading", payload: value }),
      showInstructions: () => {
        routeInstructionsDismissedRef.current = false;
        dispatch({ type: "set_show_route_instructions", payload: true });
      },
      hideInstructions: () => {
        routeInstructionsDismissedRef.current = true;
        dispatch({ type: "set_show_route_instructions", payload: false });
      },
      setRouteStarted: (value: boolean) =>
        dispatch({ type: "set_route_started", payload: value }),
      setSelectedItineraryIndex: (value: number) =>
        dispatch({ type: "set_selected_itinerary_index", payload: value }),
      setExpandedItineraries: (
        value: number[] | ((current: number[]) => number[]),
      ) => dispatch({ type: "set_expanded_itineraries", payload: value }),
      setExpandedIntermediateStops: (
        value: Set<string> | ((current: Set<string>) => Set<string>),
      ) =>
        dispatch({
          type: "set_expanded_intermediate_stops",
          payload: value,
        }),
      setRouteDurationMinutes: (value: number | null) =>
        dispatch({ type: "set_route_duration_minutes", payload: value }),
      setRouteDistanceMeters: (value: number | null) =>
        dispatch({ type: "set_route_distance_meters", payload: value }),
      setRouteInstructions: (value: RouteInstruction[]) =>
        dispatch({ type: "set_route_instructions", payload: value }),
      setSelectedShuttleDeparture: (value: string | null) =>
        dispatch({ type: "set_selected_shuttle_departure", payload: value }),
      shouldShowInstructionsForResult: (result: RouteLoaderResult) =>
        (result.routeCoordinates.length > 0 ||
          result.routeInstructions.length > 0) &&
        !routeInstructionsDismissedRef.current,
      resetDismissed: () => {
        routeInstructionsDismissedRef.current = false;
      },
    }),
    [],
  );

  const collapseInstructions = useCallback(() => {
    actions.hideInstructions();
  }, [actions]);

  return {
    state,
    actions,
    routeInstructionsDismissedRef,
    collapseInstructions,
  };
}
