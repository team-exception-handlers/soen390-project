import { BUILDINGS, Campus } from "../constants/buildings";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type PolygonFeature = {
  properties: { code: string };
};

const DEFAULT_REGION: MapRegion = {
  latitude: 45.4967,
  longitude: -73.5799,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

function buildingHasPolygon(
  building: { code: string },
  polygonFeatures: readonly PolygonFeature[],
): boolean {
  const hasExact = polygonFeatures.some(
    (f) => f.properties.code === building.code,
  );
  const hasParent = polygonFeatures.some(
    (f) =>
      building.code.startsWith(f.properties.code) && f.properties.code.length >= 2,
  );
  return hasExact || hasParent;
}

/**
 * Calculate the map region so it fits and centers on buildings that have polygons.
 * If polygonFeatures is provided, only those buildings are used so the map centers on what's actually shown.
 */
export function getCampusRegion(
  campus: Campus,
  polygonFeatures?: readonly PolygonFeature[],
): MapRegion {
  let campusBuildings = BUILDINGS.filter(
    (building) => building.campus === campus,
  );

  if (polygonFeatures && polygonFeatures.length > 0) {
    campusBuildings = campusBuildings.filter((b) =>
      buildingHasPolygon(b, polygonFeatures),
    );
  }

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
  const paddingMultiplier = campus === "LOY" ? 1.1 : 0.75;
  const latitudeDelta = Math.max((maxLat - minLat) * paddingMultiplier, 0.005);
  const longitudeDelta = Math.max((maxLng - minLng) * paddingMultiplier, 0.005);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
}
