import type { RouteProfile } from "../utils/osrmDirections";

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type RouteMode = RouteProfile | "transit" | "shuttle";

export type MapBounds = [[number, number], [number, number]];
