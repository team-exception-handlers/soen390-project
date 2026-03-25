import {
  getRoomDetails,
  roomLabelMatchesSearchPrefix,
} from "../../utils/roomUtils";

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

  test("resolves Hall building when app code is H (buildingId Hall)", () => {
    const room = getRoomDetails("H", "867");
    expect(room).toBeDefined();
    expect(room?.buildingCode).toBe("H");
    expect(room?.roomNumber).toBe("867");
  });

  test("resolves MB-S2 rooms when app code is MB (prefixed labels)", () => {
    const room = getRoomDetails("MB", "S2.330");
    expect(room).toBeDefined();
    expect(room?.buildingCode).toBe("MB");
    expect(room?.roomNumber).toBe("S2.330");
  });
});

describe("roomLabelMatchesSearchPrefix", () => {
  test("matches number part prefix for Hall (H-) labels", () => {
    expect(roomLabelMatchesSearchPrefix("H", "H-867", "8")).toBe(true);
    expect(roomLabelMatchesSearchPrefix("H", "H-118", "8")).toBe(false);
    expect(roomLabelMatchesSearchPrefix("H", "H-118", "118")).toBe(true);
    expect(roomLabelMatchesSearchPrefix("H", "H-867", "h-8")).toBe(true);
  });

  test("matches full label prefix when user types building code", () => {
    expect(roomLabelMatchesSearchPrefix("VE", "VE-101", "ve-10")).toBe(true);
    expect(roomLabelMatchesSearchPrefix("VE", "VE-101", "101")).toBe(true);
    expect(roomLabelMatchesSearchPrefix("VE", "VE-101", "02")).toBe(false);
  });
});
