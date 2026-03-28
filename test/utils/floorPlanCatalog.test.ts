import {
    getFloorPlanLabelForKey,
    getFloorPlanOptionsForBuilding,
} from "../../utils/floorPlanCatalog";

describe("utils/floorPlanCatalog", () => {
  test("getFloorPlanOptionsForBuilding returns floor plan entries for known building", () => {
    const options = getFloorPlanOptionsForBuilding("H");
    expect(options).toEqual([
      { key: "H-1", label: "Floor 1" },
      { key: "H-2", label: "Floor 2" },
      { key: "H-8", label: "Floor 8" },
      { key: "H-9", label: "Floor 9" },
    ]);
  });

  test("getFloorPlanOptionsForBuilding returns empty array for unknown building code", () => {
    expect(getFloorPlanOptionsForBuilding("ZZ")).toEqual([]);
  });

  test("getFloorPlanOptionsForBuilding handles null/undefined safely", () => {
    expect(getFloorPlanOptionsForBuilding(null)).toEqual([]);
    expect(getFloorPlanOptionsForBuilding(undefined)).toEqual([]);
  });

  test("getFloorPlanLabelForKey returns matching label when key exists", () => {
    expect(getFloorPlanLabelForKey("MB--2")).toBe("S2");
    expect(getFloorPlanLabelForKey("H-9")).toBe("Floor 9");
  });

  test("getFloorPlanLabelForKey returns key when not found", () => {
    expect(getFloorPlanLabelForKey("UNKNOWN")).toBe("UNKNOWN");
  });
});
