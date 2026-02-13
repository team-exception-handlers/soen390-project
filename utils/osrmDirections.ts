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
  routes?: {
    distance: number;
    duration: number;
    geometry?: {
      coordinates: [number, number][];
    };
  }[];
};

const OSRM_BASE_URLS: Record<RouteProfile, string> = {
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1",
  cycling: "https://routing.openstreetmap.de/routed-bike/route/v1",
  driving: "https://routing.openstreetmap.de/routed-car/route/v1",
};

export const buildOsrmRouteUrl = (
  origin: RoutePoint,
  destination: RoutePoint,
  profile: RouteProfile = "walking",
) => {
  const baseUrl = OSRM_BASE_URLS[profile];
  const start = `${origin.longitude},${origin.latitude}`;
  const end = `${destination.longitude},${destination.latitude}`;
  return `${baseUrl}/${profile}/${start};${end}?overview=full&geometries=geojson&steps=false`;
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

  return {
    distanceMeters: route.distance,
    durationSeconds: Math.round(route.duration),
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
  };
};
