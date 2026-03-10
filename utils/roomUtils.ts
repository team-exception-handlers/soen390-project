import CC1 from "../constants/maps/indoor/CC1.json";
import HALL1 from "../constants/maps/indoor/HALL-1.json";
import HALL2 from "../constants/maps/indoor/HALL-2.json";
import HALL8 from "../constants/maps/indoor/HALL-8.json";
import HALL9 from "../constants/maps/indoor/HALL-9.json";
import MB1 from "../constants/maps/indoor/MB-1.json";
import MBS2 from "../constants/maps/indoor/MB-S2.json";
import VE1 from "../constants/maps/indoor/VE-1.json";
import VE2 from "../constants/maps/indoor/VE-2.json";
import VL1 from "../constants/maps/indoor/VL-1.json";
import VL2 from "../constants/maps/indoor/VL-2.json";
import { RoomRecord } from "../types/rooms";
const ALL_FILES = [
  VL1,
  VL2,
  HALL8,
  HALL9,
  MB1,
  MBS2,
  CC1,
  VE1,
  VE2,
  HALL1,
  HALL2,
];

export const getRoomDetails = (
  buildingCode: string,
  roomNumber: string,
): RoomRecord | undefined => {
  for (const file of ALL_FILES) {
    const roomNode = file.nodes.find(
      (node: any) =>
        node.type === "room" &&
        node.buildingId === buildingCode &&
        node.label === roomNumber,
    );

    if (roomNode) {
      return {
        buildingCode: roomNode.buildingId,
        roomNumber: roomNode.label,
        x: roomNode.x,
        y: roomNode.y,
        floor: roomNode.floor,
        accessible: roomNode.accessible,
      };
    }
  }

  return undefined;
};
