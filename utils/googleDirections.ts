import type { BuildingRecord } from "../constants/buildings";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type DirectionsLocation = Coordinates | BuildingRecord | string;

export type DirectionsOptions = {
  mode?: "walking" | "driving" | "bicycling" | "transit";
  language?: string;
  region?: string;
};

const GOOGLE_DIRECTIONS_ENDPOINT =
  "https://maps.googleapis.com/maps/api/directions/json";

const getGoogleMapsApiKey = () => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to your environment to use Directions API.",
    );
  }
  return apiKey;
};

const isLatLng = (
  value: DirectionsLocation,
): value is Coordinates | BuildingRecord =>
  typeof value === "object" &&
  value !== null &&
  "latitude" in value &&
  "longitude" in value;

const formatLocation = (location: DirectionsLocation) => {
  if (typeof location === "string") {
    return location;
  }
  if (isLatLng(location)) {
    return `${location.latitude},${location.longitude}`;
  }
  throw new Error("Invalid location format for directions request.");
};

export const buildDirectionsUrl = (
  origin: DirectionsLocation,
  destination: DirectionsLocation,
  options: DirectionsOptions = {},
) => {
  const params = new URLSearchParams({
    origin: formatLocation(origin),
    destination: formatLocation(destination),
    key: getGoogleMapsApiKey(),
  });

  if (options.mode) {
    params.set("mode", options.mode);
  }
  if (options.language) {
    params.set("language", options.language);
  }
  if (options.region) {
    params.set("region", options.region);
  }

  return `${GOOGLE_DIRECTIONS_ENDPOINT}?${params.toString()}`;
};

export const fetchDirections = async (
  origin: DirectionsLocation,
  destination: DirectionsLocation,
  options: DirectionsOptions = {},
) => {
  const url = buildDirectionsUrl(origin, destination, options);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directions API request failed with ${response.status}.`);
  }
  return response.json();
};
