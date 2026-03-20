import * as Location from "expo-location";
import type { FeatureCollection } from "geojson";

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function hasLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === "granted";
}

export async function getInitialLocationFix(): Promise<Location.LocationObject | null> {
  const last = await Location.getLastKnownPositionAsync({
    maxAge: 10 * 60 * 1000,
  });
  if (last) return last;

  const tryCurrent = (accuracy: Location.Accuracy) =>
    Location.getCurrentPositionAsync({ accuracy });

  try {
    return await tryCurrent(Location.Accuracy.Balanced);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      return await tryCurrent(Location.Accuracy.Lowest);
    } catch {
      return null;
    }
  }
}

export async function startWatchingLocation(
  callback: (location: Location.LocationObject) => void,
): Promise<Location.LocationSubscription | null> {
  try {
    const permission = await hasLocationPermission();
    if (!permission) {
      const granted = await requestLocationPermission();
      if (!granted) return null;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      callback,
    );
    return subscription;
  } catch (error) {
    console.warn("Error watching location:", error);
    return null;
  }
}

export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][],
): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

export function findUserBuilding(
  lat: number,
  lng: number,
  polygons: FeatureCollection,
): string | null {
  for (const feature of polygons.features) {
    if (feature.geometry.type === "Polygon") {
      const coords = feature.geometry.coordinates[0] as [number, number][];
      if (isPointInPolygon(lat, lng, coords)) {
        return feature.properties?.code || null;
      }
    }
  }
  return null;
}
