import { getRoomDetails } from "../../utils/roomUtils";

describe("getRoomDetails", () => {
  test("returns the correct room", () => {
    const room = getRoomDetails("VE", "101");

    expect(room).toBeDefined();
    expect(room?.buildingCode).toBe("VE");
    expect(room?.roomNumber).toBe("101");
  });

  test("returns undefined when room not found", () => {
    const room = getRoomDetails("VE", "999");

    expect(room).toBeUndefined();
  });
});
