export type RouteProfile = "walking" | "driving" | "cycling";

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteInstruction = {
  text: string;
  distanceMeters: number;
};

export type OsrmRoute = {
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
  instructions: RouteInstruction[];
};

type OsrmResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry?: {
      coordinates: [number, number][];
    };
    legs?: {
      steps?: {
        distance: number;
        name?: string;
        ref?: string;
        maneuver?: {
          type?: string;
          modifier?: string;
          exit?: number;
        };
      }[];
    }[];
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
  return `${baseUrl}/${profile}/${start};${end}?overview=full&geometries=geojson&steps=true`;
};

const formatStepDistance = (distanceMeters: number) => {
  if (distanceMeters < 20) return "for a few meters";
  if (distanceMeters >= 1000) {
    return `for ${(distanceMeters / 1000).toFixed(1)} km`;
  }
  return `for ${Math.round(distanceMeters / 10) * 10} m`;
};

const getStepRoadName = (name?: string, ref?: string) => {
  const candidate = name?.trim() || ref?.trim();
  return candidate && candidate.length > 0 ? candidate : "the path";
};

const buildStepInstruction = (step: {
  distance: number;
  name?: string;
  ref?: string;
  maneuver?: {
    type?: string;
    modifier?: string;
    exit?: number;
  };
}): string => {
  const type = step.maneuver?.type ?? "continue";
  const modifier = step.maneuver?.modifier?.replaceAll("_", " ");
  const roadName = getStepRoadName(step.name, step.ref);

  if (type === "arrive") {
    return "Arrive at your destination.";
  }

  if (type === "depart") {
    const heading = modifier ? `Head ${modifier}` : "Head forward";
    return `${heading} on ${roadName}, ${formatStepDistance(step.distance)}.`;
  }

  if (type === "turn") {
    const turnDirection = modifier ? `Turn ${modifier}` : "Turn";
    return `${turnDirection} onto ${roadName}, ${formatStepDistance(step.distance)}.`;
  }

  if (type === "fork") {
    const forkDirection = modifier ? `Keep ${modifier}` : "Keep going";
    return `${forkDirection} onto ${roadName}, ${formatStepDistance(step.distance)}.`;
  }


  return `Continue on ${roadName}, ${formatStepDistance(step.distance)}.`;
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

  // just for testing, want to see the steps given from the api
  // some steps seem unnecessary, should look into a fix for that
  // console.log("Raw route steps", route.legs?.flatMap((leg) => leg.steps ?? []));

  const instructions: RouteInstruction[] = (route.legs ?? []).flatMap((leg) =>
    (leg.steps ?? []).map((step) => ({
      text: buildStepInstruction(step),
      distanceMeters: step.distance,
    })),
  );

  return {
    distanceMeters: route.distance,
    durationSeconds: Math.round(route.duration),
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
    instructions,
  };
};
