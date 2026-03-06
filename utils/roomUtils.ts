import { ROOMS, RoomRecord } from "../constants/rooms";

export const getRoomDetails = (
  buildingCode: string,
  roomNumber: string,
): RoomRecord | undefined => {
  return ROOMS.find(
    (room) =>
      room.buildingCode === buildingCode && room.roomNumber === roomNumber,
  );
};
