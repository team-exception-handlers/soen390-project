export type RouteProfile = "walking" | "driving" | "cycling";

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type OsrmRoute = {
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
};

type OsrmResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates: [number, number][];
    };
  }>;
};

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1";
const MODE_SPEEDS_KMH: Record<RouteProfile, number> = {
  walking: 5,
  cycling: 15,
  driving: 35,
};

const estimateDurationSeconds = (
  distanceMeters: number,
  profile: RouteProfile,
) => {
  const speedKmh = MODE_SPEEDS_KMH[profile];
  const durationHours = distanceMeters / 1000 / speedKmh;
  return Math.round(durationHours * 3600);
};

export const buildOsrmRouteUrl = (
  origin: RoutePoint,
  destination: RoutePoint,
  profile: RouteProfile = "walking",
) => {
  const start = `${origin.longitude},${origin.latitude}`;
  const end = `${destination.longitude},${destination.latitude}`;
  return `${OSRM_BASE_URL}/${profile}/${start};${end}?overview=full&geometries=geojson&steps=false`;
};

export const fetchOsrmRoute = async (
  origin: RoutePoint,
  destination: RoutePoint,
  profile: RouteProfile = "walking",
): Promise<OsrmRoute> => {
  const url = buildOsrmRouteUrl(origin, destination, profile);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM route request failed with ${response.status}.`);
  }

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];

  if (data.code !== "Ok" || !route?.geometry?.coordinates?.length) {
    throw new Error("No route available for the selected buildings.");
  }

  const durationSeconds =
    profile === "driving"
      ? Math.round(route.duration)
      : estimateDurationSeconds(route.distance, profile);

  return {
    distanceMeters: route.distance,
    durationSeconds,
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
  };
};
