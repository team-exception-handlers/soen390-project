import { BUILDINGS } from "../constants/buildings";
import { calculateDistance, type Coordinates } from "./locationLogic";
import { WASHROOM_ROOMS } from "./washroomSearch";

export type POICategory =
  | "restaurant"
  | "cafe"
  | "washroom"
  | "pharmacy"
  | "library"
  | "gym"
  | "bank"
  | "grocery";

export interface POIResult {
  id: string;
  name: string;
  category: POICategory;
  latitude: number;
  longitude: number;
  distance: number; // km from user
  address?: string;
}

const CATEGORY_OSM_TAGS: Record<POICategory, string> = {
  restaurant: '["amenity"="restaurant"]',
  cafe: '["amenity"="cafe"]',
  washroom: '["amenity"="toilets"]',
  pharmacy: '["amenity"="pharmacy"]',
  library: '["amenity"="library"]',
  gym: '["leisure"="fitness_centre"]',
  bank: '["amenity"="bank"]',
  grocery: '["shop"="supermarket"]',
};

const CATEGORY_LABELS: Record<POICategory, string> = {
  restaurant: "Restaurant",
  cafe: "Coffee Shop",
  washroom: "Washroom",
  pharmacy: "Pharmacy",
  library: "Library",
  gym: "Gym",
  bank: "Bank",
  grocery: "Grocery",
};

export const ALL_POI_CATEGORIES: POICategory[] = Object.keys(
  CATEGORY_OSM_TAGS,
) as POICategory[];

export function getCategoryLabel(category: POICategory): string {
  return CATEGORY_LABELS[category];
}

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || attempt === retries) return response;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
  }
  // Unreachable, but satisfies TS
  throw new Error("Overpass API: retries exhausted");
}

export async function fetchNearbyPOIs(
  userLocation: Coordinates,
  category: POICategory,
  radiusMeters: number,
): Promise<POIResult[]> {
  const tag = CATEGORY_OSM_TAGS[category];
  if (!tag) return [];

  const query = `
    [out:json][timeout:10];
    (
      node${tag}(around:${radiusMeters},${userLocation.latitude},${userLocation.longitude});
      way${tag}(around:${radiusMeters},${userLocation.latitude},${userLocation.longitude});
    );
    out center body;
  `;

  const response = await fetchWithRetry(OVERPASS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();

  const results: POIResult[] = (data.elements ?? [])
    .map((element: any) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") return null;

      const name =
        element.tags?.name ??
        element.tags?.["name:en"] ??
        getCategoryLabel(category);

      const distance = calculateDistance(userLocation, {
        latitude: lat,
        longitude: lon,
      });

      return {
        id: String(element.id),
        name,
        category,
        latitude: lat,
        longitude: lon,
        distance,
        address:
          element.tags?.["addr:street"] && element.tags?.["addr:housenumber"]
            ? `${element.tags["addr:housenumber"]} ${element.tags["addr:street"]}`
            : element.tags?.["addr:street"] ?? undefined,
      } satisfies POIResult;
    })
    .filter((r: POIResult | null): r is POIResult => r !== null);

  return results;
}

export function getIndoorWashroomPOIs(
  userLocation: Coordinates,
): POIResult[] {
  const buildingMap = new Map(
    BUILDINGS.map((b) => [b.code, b]),
  );

  // Deduplicate by building: one entry per building
  const seenBuildings = new Set<string>();
  const results: POIResult[] = [];

  for (const room of WASHROOM_ROOMS) {
    if (seenBuildings.has(room.buildingCode)) continue;
    seenBuildings.add(room.buildingCode);

    const building = buildingMap.get(room.buildingCode);
    if (!building) continue;

    const distance = calculateDistance(userLocation, {
      latitude: building.latitude,
      longitude: building.longitude,
    });

    results.push({
      id: `indoor-wc-${room.buildingCode}`,
      name: `${building.longName} (Indoor)`,
      category: "washroom",
      latitude: building.latitude,
      longitude: building.longitude,
      distance,
      address: building.address,
    });
  }

  return results;
}

export function filterPOIsByDistance(
  pois: POIResult[],
  maxDistanceKm: number,
): POIResult[] {
  return pois.filter((poi) => poi.distance <= maxDistanceKm);
}

export function sortPOIsByDistance(pois: POIResult[]): POIResult[] {
  return [...pois].sort((a, b) => a.distance - b.distance);
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
