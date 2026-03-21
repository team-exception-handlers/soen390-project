import { fetchOsrmRoute, RouteInstruction, RouteProfile } from "./osrmDirections";
import { TransitItinerary, fetchTransitItineraries } from "./transitousDirections";
import { getNearestStop, STOPS } from "./locationLogic";
import { getShuttleInfo, calculateArrivalTime } from "./shuttleLogic";

export interface RouteLoaderResult {
  routeCoordinates: { latitude: number; longitude: number }[];
  routeDurationMinutes: number | null;
  routeDistanceMeters: number | null;
  routeInstructions: RouteInstruction[];
  transitItineraries: TransitItinerary[];
  shuttleWalkToCoords: { latitude: number; longitude: number }[];
  shuttleDriveCoords: { latitude: number; longitude: number }[];
  shuttleWalkFromCoords: { latitude: number; longitude: number }[];
}

export const emptyRouteResult = (): RouteLoaderResult => ({
  routeCoordinates: [],
  routeDurationMinutes: null,
  routeDistanceMeters: null,
  routeInstructions: [],
  transitItineraries: [],
  shuttleWalkToCoords: [],
  shuttleDriveCoords: [],
  shuttleWalkFromCoords: [],
});

function calculateValidDeparture(
  selectedShuttleDeparture: string | null,
  shuttleInfo: any,
  mockedNow: Date,
  arrivalAtStopDate: Date
): Date | undefined {
  if (selectedShuttleDeparture) {
    const [h, m] = selectedShuttleDeparture.split(":").map(Number);
    const validDeparture = new Date(mockedNow);
    validDeparture.setHours(h, m, 0, 0);
    if (validDeparture < mockedNow && h < 5) {
      validDeparture.setDate(validDeparture.getDate() + 1);
    }
    return validDeparture;
  }
  
  const activeDepartures = shuttleInfo.nextThreeDepartures.map((t: string) => {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(mockedNow);
    d.setHours(h, m, 0, 0);
    if (d < mockedNow && h < 5) d.setDate(d.getDate() + 1);
    return d;
  });
  
  return activeDepartures.find((d: Date) => d >= arrivalAtStopDate) || activeDepartures[0];
}

export async function calculateShuttleRouteHelper(
  actualOriginPoint: any,
  destinationBuilding: any,
  selectedShuttleDeparture: string | null
): Promise<RouteLoaderResult | null> {
  const result = emptyRouteResult();
  result.routeDurationMinutes = 30;
  result.routeInstructions = [{ text: "Shuttle Journey", distanceMeters: 0 }];

  const nearest = getNearestStop(actualOriginPoint);
  const originStopCoords = STOPS[nearest.stop];
  const destStopCoords = STOPS[nearest.destination];

  const mockedNow = new Date();
  const shuttleInfo = getShuttleInfo(nearest.stop as any, mockedNow);
  
  if (shuttleInfo.serviceUnavailable) {
    return null;
  }

  const [walkTo, drive, walkFrom] = await Promise.all([
    fetchOsrmRoute(actualOriginPoint, originStopCoords, "walking"),
    fetchOsrmRoute(originStopCoords, destStopCoords, "driving"),
    fetchOsrmRoute(destStopCoords, destinationBuilding, "walking"),
  ]);

  const instructions: RouteInstruction[] = [];
  if (walkTo.instructions) instructions.push(...walkTo.instructions);

  const walkToMinutes = Math.round(walkTo.durationSeconds / 60);
  const arrivalAtStopDate = new Date(mockedNow);
  arrivalAtStopDate.setMinutes(arrivalAtStopDate.getMinutes() + walkToMinutes);

  const validDeparture = calculateValidDeparture(
    selectedShuttleDeparture,
    shuttleInfo,
    mockedNow,
    arrivalAtStopDate
  );

  let waitMinutes = 0;
  if (validDeparture) {
    const waitMs = validDeparture.getTime() - arrivalAtStopDate.getTime();
    waitMinutes = Math.max(0, Math.round(waitMs / 60000));
    instructions.push({
      text: `Arrive at ${nearest.stop} shuttle stop. Wait for ${waitMinutes} minute(s).`,
      distanceMeters: 0,
    });

    const hh = validDeparture.getHours().toString().padStart(2, "0");
    const mm = validDeparture.getMinutes().toString().padStart(2, "0");
    const arrivalTimeString = calculateArrivalTime(`${hh}:${mm}`);

    const arrH = Number.parseInt(arrivalTimeString.split(":")[0]);
    const arrM = Number.parseInt(arrivalTimeString.split(":")[1]);
    const arrivalDate = new Date(validDeparture);
    arrivalDate.setHours(arrH, arrM, 0, 0);
    if (arrivalDate < validDeparture) arrivalDate.setDate(arrivalDate.getDate() + 1);

    instructions.push({
      text: `Take the shuttle to ${nearest.destination} campus. Estimated arrival at ${arrivalTimeString}.`,
      distanceMeters: drive.distanceMeters,
    });

    const walkToLeg = {
      mode: "WALK",
      from: { name: "Current Location", lat: actualOriginPoint.latitude, lon: actualOriginPoint.longitude },
      to: { name: `${nearest.stop} Shuttle Stop`, lat: originStopCoords.latitude, lon: originStopCoords.longitude },
      startTime: mockedNow.toISOString(),
      endTime: arrivalAtStopDate.toISOString(),
      distance: walkTo.distanceMeters,
      duration: walkTo.durationSeconds,
      legGeometry: null,
    };

    const shuttleLeg = {
      mode: "BUS",
      route: "Shuttle",
      headsign: `${nearest.destination} Campus`,
      from: { name: `${nearest.stop} Shuttle Stop`, lat: originStopCoords.latitude, lon: originStopCoords.longitude },
      to: { name: `${nearest.destination} Shuttle Stop`, lat: destStopCoords.latitude, lon: destStopCoords.longitude },
      startTime: validDeparture.toISOString(),
      endTime: arrivalDate.toISOString(),
      distance: drive.distanceMeters,
      duration: Math.round((arrivalDate.getTime() - validDeparture.getTime()) / 1000),
      legGeometry: null,
    };

    const walkFromLeg = {
      mode: "WALK",
      from: { name: `${nearest.destination} Shuttle Stop`, lat: destStopCoords.latitude, lon: destStopCoords.longitude },
      to: { name: destinationBuilding.shortName, lat: destinationBuilding.latitude, lon: destinationBuilding.longitude },
      startTime: arrivalDate.toISOString(),
      endTime: new Date(arrivalDate.getTime() + walkFrom.durationSeconds * 1000).toISOString(),
      distance: walkFrom.distanceMeters,
      duration: walkFrom.durationSeconds,
      legGeometry: null,
    };

    const totalDuration = walkTo.durationSeconds + shuttleLeg.duration + walkFrom.durationSeconds + (waitMinutes * 60);

    const transitItin: TransitItinerary = {
      durationSeconds: totalDuration,
      distanceMeters: walkTo.distanceMeters + drive.distanceMeters + walkFrom.distanceMeters,
      transfers: 0,
      departureTime: new Date().toISOString(),
      arrivalTime: walkFromLeg.endTime,
      legs: [walkToLeg, shuttleLeg, walkFromLeg] as any[],
      instructions,
      coordinates: [],
    };

    result.transitItineraries = [transitItin];
  } else {
    instructions.push({ text: `Arrive at ${nearest.stop} shuttle stop.`, distanceMeters: 0 });
    instructions.push({ text: `Take the shuttle to ${nearest.destination} campus.`, distanceMeters: drive.distanceMeters });
  }

  if (walkFrom.instructions) instructions.push(...walkFrom.instructions);

  result.routeInstructions = instructions;
  result.routeDurationMinutes = Math.round((walkTo.durationSeconds + drive.durationSeconds + walkFrom.durationSeconds) / 60) + waitMinutes;
  result.routeDistanceMeters = walkTo.distanceMeters + drive.distanceMeters + walkFrom.distanceMeters;
  result.shuttleWalkToCoords = walkTo.coordinates;
  result.shuttleDriveCoords = drive.coordinates;
  result.shuttleWalkFromCoords = walkFrom.coordinates;

  return result;
}

export async function calculateTransitRouteHelper(
  actualOriginPoint: any,
  destinationBuilding: any
): Promise<RouteLoaderResult> {
  const result = emptyRouteResult();
  const itineraries = await fetchTransitItineraries(
    actualOriginPoint,
    destinationBuilding,
    new Date().toISOString()
  );

  result.transitItineraries = itineraries;
  const firstRoute = itineraries[0];
  
  if (firstRoute) {
    result.routeDurationMinutes = Math.round(firstRoute.durationSeconds / 60);
    result.routeDistanceMeters = firstRoute.distanceMeters;
    result.routeInstructions = firstRoute.instructions;
  }
  
  return result;
}

export async function calculateOsrmRouteHelper(
  actualOriginPoint: any,
  destinationBuilding: any,
  routeMode: RouteProfile | "transit" | "shuttle",
  isSameCampus: boolean
): Promise<RouteLoaderResult> {
  const result = emptyRouteResult();
  const actualMode = (
    routeMode === "walking" && !isSameCampus ? "cycling" : routeMode
  ) as RouteProfile;
  
  const route = await fetchOsrmRoute(
    actualOriginPoint,
    destinationBuilding,
    actualMode
  );

  result.routeCoordinates = route.coordinates;
  result.routeDurationMinutes = Math.round(route.durationSeconds / 60);
  result.routeDistanceMeters = route.distanceMeters;
  result.routeInstructions = route.instructions;

  return result;
}
