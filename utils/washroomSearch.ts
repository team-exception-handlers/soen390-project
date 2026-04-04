import type { BuildingRecord } from "../constants/buildings";
import { BUILDINGS } from "../constants/buildings";
import hallCombined from "../constants/maps/indoor/hall.json";
import hall1 from "../constants/maps/indoor/hall1.json";
import mbFloorsCombined from "../constants/maps/indoor/mb_floors_combined.json";
import ve2 from "../constants/maps/indoor/ve2.json";
import vl1 from "../constants/maps/indoor/vl1.json";
import vl2 from "../constants/maps/indoor/vl2.json";

type IndoorFloorData = {
  nodes: Array<{
    type?: string;
    buildingId?: string;
    floor?: number;
    label?: string;
    category?: string;
    x?: number;
    y?: number;
  }>;
};

export type WashroomCategory = "male_washroom" | "female_washroom";

export type NearestWashroomTarget = {
  building: BuildingRecord;
  roomLabel: string;
};

type WashroomRoom = {
  buildingCode: string;
  floor: number;
  label: string;
  category: WashroomCategory;
  x: number;
  y: number;
};

type IndoorRoomNode = {
  buildingCode: string;
  floor: number;
  label: string;
  x: number;
  y: number;
};

const INDOOR_WASHROOM_SOURCES: IndoorFloorData[] = [
  hallCombined as IndoorFloorData,
  hall1 as IndoorFloorData,
  mbFloorsCombined as IndoorFloorData,
  ve2 as IndoorFloorData,
  vl1 as IndoorFloorData,
  vl2 as IndoorFloorData,
];

function normalizeIndoorBuildingCode(buildingId: string): string {
  if (buildingId === "Hall") return "H";
  if (buildingId === "MB-S2") return "MB";
  return buildingId;
}

function compareWashroomLabels(a: string, b: string): number {
  const aNum = Number((a.match(/\d+/) ?? [])[0] ?? Number.POSITIVE_INFINITY);
  const bNum = Number((b.match(/\d+/) ?? [])[0] ?? Number.POSITIVE_INFINITY);
  if (aNum !== bNum) return aNum - bNum;
  return a.localeCompare(b);
}

function roomLabelMatchesForSearch(
  buildingCode: string,
  nodeLabel: string,
  userLabel: string,
): boolean {
  const normalizedNodeLabel = nodeLabel.trim();
  const normalizedUserLabel = userLabel.trim();
  if (!normalizedNodeLabel || !normalizedUserLabel) return false;
  if (normalizedNodeLabel === normalizedUserLabel) return true;

  const prefix = buildingCode === "H" ? "H" : buildingCode;
  return normalizedNodeLabel === `${prefix}-${normalizedUserLabel}`;
}

function isValidWashroomNode(node: any): node is Required<Pick<WashroomRoom, "label" | "category">> & {
  type: string;
  buildingId: string;
  floor: number;
  x: number;
  y: number;
} {
  return (
    node.type === "room" &&
    (node.category === "male_washroom" || node.category === "female_washroom") &&
    typeof node.label === "string" &&
    node.label.trim().length > 0 &&
    typeof node.buildingId === "string" &&
    typeof node.floor === "number" &&
    typeof node.x === "number" &&
    typeof node.y === "number"
  );
}

export const WASHROOM_ROOMS: WashroomRoom[] = INDOOR_WASHROOM_SOURCES.flatMap(
  (floorData) =>
    floorData.nodes
      .filter(isValidWashroomNode)
      .map((node) => ({
        buildingCode: normalizeIndoorBuildingCode(node.buildingId),
        floor: node.floor,
        label: node.label.trim(),
        category: node.category,
        x: node.x,
        y: node.y,
      })),
);

function isValidIndoorRoomNode(node: any): node is {
  type: string;
  buildingId: string;
  floor: number;
  label: string;
  x: number;
  y: number;
} {
  return (
    node.type === "room" &&
    typeof node.label === "string" &&
    node.label.trim().length > 0 &&
    typeof node.buildingId === "string" &&
    typeof node.floor === "number" &&
    typeof node.x === "number" &&
    typeof node.y === "number"
  );
}

const INDOOR_ROOMS: IndoorRoomNode[] = INDOOR_WASHROOM_SOURCES.flatMap(
  (floorData) =>
    floorData.nodes
      .filter(isValidIndoorRoomNode)
      .map((node) => ({
        buildingCode: normalizeIndoorBuildingCode(node.buildingId),
        floor: node.floor,
        label: node.label.trim(),
        x: node.x,
        y: node.y,
      })),
);

function findNearestBuildingFromSet(
  buildingCodes: Set<string>,
  campusBuildings: BuildingRecord[],
  actualOriginPoint: { latitude: number; longitude: number } | null,
): BuildingRecord | null {
  const candidateBuildings = campusBuildings.filter((building) =>
    buildingCodes.has(building.code),
  );
  if (candidateBuildings.length === 0) return null;

  if (!actualOriginPoint) {
    return candidateBuildings[0];
  }

  const [first, ...rest] = candidateBuildings;
  return rest.reduce(
    (nearest, current) => {
      const nearestDistanceSquared =
        (nearest.latitude - actualOriginPoint.latitude) ** 2 +
        (nearest.longitude - actualOriginPoint.longitude) ** 2;
      const currentDistanceSquared =
        (current.latitude - actualOriginPoint.latitude) ** 2 +
        (current.longitude - actualOriginPoint.longitude) ** 2;
      return currentDistanceSquared < nearestDistanceSquared ? current : nearest;
    },
    first,
  );
}

export type FindNearestWashroomParams = {
  campusBuildings: BuildingRecord[];
  actualOriginPoint: { latitude: number; longitude: number } | null;
  originBuildingCode: string | null;
  originRoom: string;
  destinationBuildingCode: string | null;
  destinationRoom: string;
};

/**
 * Resolves nearest male/female washroom for map search: prefers same-building
 * path from origin/destination room context, else nearest campus building with data.
 */
function getRoomContext(
  params: FindNearestWashroomParams
): { buildingCode: string | null; roomLabel: string } | null {
  const candidates = [
    { buildingCode: params.originBuildingCode, roomLabel: params.originRoom.trim() },
    { buildingCode: params.destinationBuildingCode, roomLabel: params.destinationRoom.trim() },
  ];

  return (
    candidates.find((c) => c.buildingCode != null && c.roomLabel.length > 0) ??
    candidates.find((c) => c.buildingCode != null) ??
    null
  );
}

function calculateIndoorProximity(
  washroom: WashroomRoom,
  roomNode: IndoorRoomNode
): number {
  return (
    Math.abs(washroom.floor - roomNode.floor) * 10000 +
    (washroom.x - roomNode.x) ** 2 +
    (washroom.y - roomNode.y) ** 2
  );
}

function findNearestWashroomInBuilding(
  washrooms: WashroomRoom[],
  buildingCode: string,
  roomLabel: string
): string | null {
  if (roomLabel.length > 0) {
    const startNode = INDOOR_ROOMS.find(
      (room) =>
        room.buildingCode === buildingCode &&
        roomLabelMatchesForSearch(buildingCode, room.label, roomLabel)
    );

    if (startNode) {
      const nearest = washrooms.reduce((best, current) => {
        const bestDist = calculateIndoorProximity(best, startNode);
        const currentDist = calculateIndoorProximity(current, startNode);
        return currentDist < bestDist ? current : best;
      });
      return nearest.label;
    }
  }

  const sorted = [...washrooms].sort((a, b) => {
    const floorDelta = Math.abs(a.floor - 1) - Math.abs(b.floor - 1);
    if (floorDelta !== 0) return floorDelta;
    return compareWashroomLabels(a.label, b.label);
  });
  return sorted[0]?.label ?? null;
}

function findNearestWashroomByCampus(
  washrooms: WashroomRoom[],
  campusBuildings: BuildingRecord[],
  originPoint: { latitude: number; longitude: number } | null
): NearestWashroomTarget | null {
  const buildingCodes = new Set(washrooms.map((w) => w.buildingCode));
  const nearestBuilding = findNearestBuildingFromSet(
    buildingCodes,
    campusBuildings,
    originPoint
  );

  if (!nearestBuilding) return null;

  const buildingWashrooms = washrooms.filter((w) => w.buildingCode === nearestBuilding.code);
  const roomLabel = findNearestWashroomInBuilding(buildingWashrooms, nearestBuilding.code, "");

  return roomLabel ? { building: nearestBuilding, roomLabel } : null;
}

export function findNearestWashroomTarget(
  category: WashroomCategory,
  params: FindNearestWashroomParams
): NearestWashroomTarget | null {
  const washrooms = WASHROOM_ROOMS.filter((room) => room.category === category);
  if (washrooms.length === 0) return null;

  const context = getRoomContext(params);
  if (context?.buildingCode) {
    const buildingWashrooms = washrooms.filter((r) => r.buildingCode === context.buildingCode);
    const buildingRecord = BUILDINGS.find((b) => b.code === context.buildingCode);

    if (buildingWashrooms.length > 0 && buildingRecord) {
      const roomLabel = findNearestWashroomInBuilding(
        buildingWashrooms,
        context.buildingCode,
        context.roomLabel
      );
      if (roomLabel) return { building: buildingRecord, roomLabel };
    }

    if (!buildingRecord) return null;
  }

  return findNearestWashroomByCampus(washrooms, params.campusBuildings, params.actualOriginPoint);
}
