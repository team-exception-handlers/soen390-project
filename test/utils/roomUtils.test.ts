import { getRoomDetails } from "../../utils/roomUtils";

jest.mock("../../constants/rooms", () => ({
  ROOMS: [
    { buildingCode: "H", roomNumber: "101" },
    { buildingCode: "H", roomNumber: "102" },
    { buildingCode: "EV", roomNumber: "201" },
  ],
}));

describe("getRoomDetails", () => {
  test("returns the correct room", () => {
    const room = getRoomDetails("H", "101");

    expect(room).toEqual({
      buildingCode: "H",
      roomNumber: "101",
    });
  });

  test("returns undefined when room not found", () => {
    const room = getRoomDetails("H", "999");

    expect(room).toBeUndefined();
  });
});
