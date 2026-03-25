import {
  getRoomDetails,
  getRoomsForBuilding,
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

describe("getRoomsForBuilding", () => {
  test("returns sorted unique room labels for VE", () => {
    const rooms = getRoomsForBuilding("VE");
    expect(rooms.length).toBeGreaterThan(0);
    const sorted = [...rooms].sort((a, b) => a.localeCompare(b));
    expect(rooms).toEqual(sorted);
    expect(new Set(rooms).size).toBe(rooms.length);
    expect(rooms.some((l) => l.toLowerCase().includes("101"))).toBe(true);
  });

  test("includes Hall JSON nodes when app building code is H", () => {
    const rooms = getRoomsForBuilding("H");
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.some((l) => l.includes("867") || l.toLowerCase().includes("h-867"))).toBe(
      true,
    );
  });

  test("includes MB-S2 nodes when app building code is MB", () => {
    const rooms = getRoomsForBuilding("MB");
    expect(rooms.length).toBeGreaterThan(0);
  });

  test("returns empty array when no rooms exist for code", () => {
    expect(getRoomsForBuilding("ZZZ")).toEqual([]);
  });
});

describe("roomLabelMatchesSearchPrefix", () => {
  test("treats empty query as match-all", () => {
    expect(roomLabelMatchesSearchPrefix("VE", "VE-101", "")).toBe(true);
    expect(roomLabelMatchesSearchPrefix("H", "H-001", "")).toBe(true);
  });

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
