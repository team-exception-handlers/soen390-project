import { BUILDINGS, Campus } from "../constants/buildings";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const DEFAULT_REGION: MapRegion = {
  latitude: 45.4967,
  longitude: -73.5799,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

/**
 * Calculating the map that will fit all the buildings for each campus we have
 */
export function getCampusRegion(campus: Campus): MapRegion {
  const campusBuildings = BUILDINGS.filter(
    (building) => building.campus === campus
  );

  if (campusBuildings.length === 0) {
    return DEFAULT_REGION;
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const building of campusBuildings) {
    minLat = Math.min(minLat, building.latitude);
    maxLat = Math.max(maxLat, building.latitude);
    minLng = Math.min(minLng, building.longitude);
    maxLng = Math.max(maxLng, building.longitude);
  }

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * 1.4, 0.005);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.4, 0.005);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
}
