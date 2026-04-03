import type { Campus, BuildingRecord } from "../../constants/buildings";
import LOY_POLYGONS from "../../constants/maps/outdoor/LOY-polygons";
import SGW_POLYGONS from "../../constants/maps/outdoor/SGW-polygons";
import type { PolygonFeature, MapRegion } from "../../utils/mapRegions";
import { findUserBuilding } from "../../utils/locationUtils";
import type { MapBounds } from "../../types/map";

export type FloorPlanAsset = unknown | null;
export type PinVisibilityMode = "all" | "campus-summary";
export type DetectedBuilding = {
  code: string | null;
  campus: Campus | null;
};

export const roundCoord = (value: number) => Number(value.toFixed(4));

export const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
};

export const getPinVisibilityMode = (
  zoomOutFactor: number,
): PinVisibilityMode => {
  if (zoomOutFactor > 1.08) return "campus-summary";
  return "all";
};

export const shouldShowBuildingPin = (
  visibilityMode: PinVisibilityMode,
): boolean => visibilityMode === "all";

export const resolveBuildingByCode = (
  code: string | null | undefined,
  buildings: BuildingRecord[],
) => {
  if (!code) return null;
  const exact = buildings.find((building) => building.code === code);
  if (exact) return exact;
  return buildings.find((building) => building.code.startsWith(code)) ?? null;
};

export const detectBuildingFromLocation = (
  latitude: number,
  longitude: number,
): DetectedBuilding => {
  const sgwBuilding = findUserBuilding(
    latitude,
    longitude,
    SGW_POLYGONS as never,
  );
  if (sgwBuilding) return { code: sgwBuilding, campus: "SGW" };

  const loyBuilding = findUserBuilding(
    latitude,
    longitude,
    LOY_POLYGONS as never,
  );
  if (loyBuilding) return { code: loyBuilding, campus: "LOY" };

  return { code: null, campus: null };
};

export const getFloorPlanAsset = (key: string): FloorPlanAsset => {
  const assets: Record<string, () => FloorPlanAsset> = {
    "H-1": () => require("../../assets/floor_plans/png/H1.png"),
    "H-2": () => require("../../assets/floor_plans/png/H2.png"),
    "H-8": () => require("../../assets/floor_plans/png/hall8.png"),
    "H-9": () => require("../../assets/floor_plans/png/hall9.png"),
    "MB-1": () => require("../../assets/floor_plans/png/mb_1.png"),
    "MB--2": () => require("../../assets/floor_plans/png/mb_s2.png"),
    "VE-1": () => require("../../assets/floor_plans/png/ve1.png"),
    "VE-2": () => require("../../assets/floor_plans/png/ve2.png"),
    "VL-1": () => require("../../assets/floor_plans/png/vl_1.png"),
    "VL-2": () => require("../../assets/floor_plans/png/vl_2.png"),
  };
  return assets[key] ? assets[key]() : null;
};

export const getTransitColor = (mode: string, route?: string) => {
  if (mode === "WALK") return "#2E7D32";
  if (mode === "BUS") return "#007AFF";
  if (mode === "TRAM") return "#9C27B0";

  if (mode === "SUBWAY" || mode === "RAIL" || mode === "METRO") {
    const line = (route ?? "").trim();
    if (line === "1") return "#009E60";
    if (line === "2") return "#FF6600";
    if (line === "4") return "#FFD700";
    if (line === "5") return "#0075BF";
    return "#007AFF";
  }

  return "#1668C7";
};

export const getBoundsFromRegion = (region: MapRegion): MapBounds => {
  const minLat = region.latitude - region.latitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  const minLng = region.longitude - region.longitudeDelta / 2;
  const maxLng = region.longitude + region.longitudeDelta / 2;

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
};

export const buildingHasPolygon = (
  building: { code: string },
  polygonFeatures: readonly PolygonFeature[],
): boolean => {
  const hasExact = polygonFeatures.some((f) => f.properties.code === building.code);
  const hasParent = polygonFeatures.some(
    (f) =>
      building.code.startsWith(f.properties.code) &&
      f.properties.code.length >= 2,
  );
  return hasExact || hasParent;
};

export const resolvePolygonCode = (
  buildingCode: string,
  polygonFeatures: readonly PolygonFeature[],
) => {
  const hasExactPolygon = polygonFeatures.some(
    (feature) => feature.properties.code === buildingCode,
  );

  if (hasExactPolygon) return buildingCode;

  return (
    polygonFeatures.find(
      (feature) =>
        buildingCode.startsWith(feature.properties.code) &&
        feature.properties.code.length >= 2,
    )?.properties.code ?? buildingCode
  );
};
