import cc1 from "../constants/maps/indoor/cc1.json";
import hallCombined from "../constants/maps/indoor/hall.json";
import hall1 from "../constants/maps/indoor/hall1.json";
import hall2 from "../constants/maps/indoor/hall2.json";
import mbFloorsCombined from "../constants/maps/indoor/mb_floors_combined.json";
import ve1 from "../constants/maps/indoor/ve1.json";
import ve2 from "../constants/maps/indoor/ve2.json";
import vl1 from "../constants/maps/indoor/vl1.json";
import vl2 from "../constants/maps/indoor/vl2.json";
import { RoomRecord } from "../types/rooms";

const ALL_FILES = [
  cc1,
  hall1,
  hall2,
  hallCombined,
  mbFloorsCombined,
  ve1,
  ve2,
  vl1,
  vl2,
];

/** App building code "H" (Henry F. Hall) maps to JSON buildingId "Hall". MB includes S2 (MB-S2). */
function buildingIdMatches(
  buildingCode: string,
  nodeBuildingId: string,
): boolean {
  return (
    nodeBuildingId === buildingCode ||
    (buildingCode === "H" && nodeBuildingId === "Hall") ||
    (buildingCode === "MB" && nodeBuildingId === "MB-S2")
  );
}

function roomLabelPrefixForSearch(buildingCode: string): string {
  return buildingCode === "H" ? "H" : buildingCode;
}

/**
 * Prefix match for room autocomplete: matches the full label (ex: "h-867") or the part after
 * the building prefix (ex: "867")
 */
export function roomLabelMatchesSearchPrefix(
  buildingCode: string,
  label: string,
  queryLower: string,
): boolean {
  if (!queryLower) return true;
  const lower = label.toLowerCase();
  const prefixed = `${roomLabelPrefixForSearch(buildingCode).toLowerCase()}-`;
  const variants = new Set<string>([lower]);
  if (lower.startsWith(prefixed)) {
    variants.add(lower.slice(prefixed.length));
  }
  for (const v of variants) {
    if (v.startsWith(queryLower)) return true;
  }
  return false;
}

/** JSON may use prefixed labels (e.g. "H-822", "VL-202-30"); app often sends "822", "202-30". Match both. */
function roomLabelMatches(
  buildingCode: string,
  nodeLabel: string | undefined,
  userLabel: string,
): boolean {
  if (!nodeLabel) return false;
  if (nodeLabel === userLabel) return true;
  const prefix = buildingCode === "H" ? "H" : buildingCode;
  if (nodeLabel === `${prefix}-${userLabel}`) return true;
  return false;
}

export const getRoomsForBuilding = (buildingCode: string): string[] => {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const file of ALL_FILES) {
    for (const node of (file as any).nodes) {
      if (
        node.type === "room" &&
        buildingIdMatches(buildingCode, node.buildingId)
      ) {
        const label = node.label as string | undefined;
        if (label && !seen.has(label)) {
          seen.add(label);
          labels.push(label);
        }
      }
    }
  }

  return labels.sort((a, b) => a.localeCompare(b));
};

export const getRoomDetails = (
  buildingCode: string,
  roomNumber: string,
): RoomRecord | undefined => {
  for (const file of ALL_FILES) {
    const roomNode = file.nodes.find(
      (node: any) =>
        node.type === "room" &&
        buildingIdMatches(buildingCode, node.buildingId) &&
        roomLabelMatches(buildingCode, node.label, roomNumber),
    );

    if (roomNode) {
      return {
        buildingCode,
        roomNumber,
        x: roomNode.x,
        y: roomNode.y,
        floor: roomNode.floor,
        accessible: roomNode.accessible,
      };
    }
  }

  return undefined;
};
