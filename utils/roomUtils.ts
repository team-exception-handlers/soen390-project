import cc1 from "../constants/maps/indoor/cc1.json";
import hall from "../constants/maps/indoor/hall.json";
import mbFloorsCombined from "../constants/maps/indoor/mb_floors_combined.json";
import ve from "../constants/maps/indoor/ve.json";
import vlFloorsCombined from "../constants/maps/indoor/vl_floors_combined.json";
import { RoomRecord } from "../types/rooms";

const ALL_FILES = [
  cc1,
  hall,
  mbFloorsCombined,
  ve,
  vlFloorsCombined,
];

/** App building code "H" (Henry F. Hall) maps to JSON buildingId "Hall". MB includes S2 (MB-S2). */
function buildingIdMatches(buildingCode: string, nodeBuildingId: string): boolean {
  return (
    nodeBuildingId === buildingCode ||
    (buildingCode === "H" && nodeBuildingId === "Hall") ||
    (buildingCode === "MB" && nodeBuildingId === "MB-S2")
  );
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
