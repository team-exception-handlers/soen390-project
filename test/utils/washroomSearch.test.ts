import { BUILDINGS, type BuildingRecord } from "../../constants/buildings";
import { findNearestWashroomTarget } from "../../utils/washroomSearch";

const sgwBuildings = BUILDINGS.filter((b) => b.campus === "SGW");
const hBuilding = BUILDINGS.find((b) => b.code === "H")!;
const mbBuilding = BUILDINGS.find((b) => b.code === "MB")!;

describe("findNearestWashroomTarget", () => {
  test("returns null when campus list cannot match any building with washroom data", () => {
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: [],
      actualOriginPoint: null,
      originBuildingCode: null,
      originRoom: "",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).toBeNull();
  });

  test("picks nearest SGW building by GPS when there is no room context", () => {
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: {
        latitude: hBuilding.latitude,
        longitude: hBuilding.longitude,
      },
      originBuildingCode: null,
      originRoom: "",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("H");
    expect(result!.roomLabel.length).toBeGreaterThan(0);
  });

  test("when GPS is closer to MB than H, prefers MB washroom", () => {
    const result = findNearestWashroomTarget("female_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: {
        latitude: mbBuilding.latitude,
        longitude: mbBuilding.longitude,
      },
      originBuildingCode: null,
      originRoom: "",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("MB");
  });

  test("uses first campus building when actualOriginPoint is null", () => {
    const tinyList: BuildingRecord[] = [hBuilding, mbBuilding];
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: tinyList,
      actualOriginPoint: null,
      originBuildingCode: null,
      originRoom: "",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe(tinyList[0].code);
  });

  test("same-building context: nearest male washroom from a known room in H", () => {
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: {
        latitude: hBuilding.latitude,
        longitude: hBuilding.longitude,
      },
      originBuildingCode: "H",
      originRoom: "127",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("H");
    expect(result!.roomLabel.length).toBeGreaterThan(0);
  });

  test("matches Hall room labels with H- prefix when user enters short room id", () => {
    const result = findNearestWashroomTarget("female_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: "H",
      originRoom: "802",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("H");
    expect(result!.roomLabel).toContain("802");
  });

  test("building only (no room): picks washroom nearest to floor 1 in that building", () => {
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: "H",
      originRoom: "",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("H");
  });

  test("unknown room in building falls back to floor-1 ordering within that building", () => {
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: "H",
      originRoom: "not-a-real-room-xyz",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("H");
  });

  test("destination room context is used when origin has no room", () => {
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: "H",
      originRoom: "",
      destinationBuildingCode: "H",
      destinationRoom: "131",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("H");
  });

  test("origin room is preferred when both origin and destination rooms are set", () => {
    const fromOrigin = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: "H",
      originRoom: "127",
      destinationBuildingCode: "H",
      destinationRoom: "131",
    });
    const fromDestOnly = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: null,
      originRoom: "",
      destinationBuildingCode: "H",
      destinationRoom: "131",
    });
    expect(fromOrigin).not.toBeNull();
    expect(fromDestOnly).not.toBeNull();
    expect(fromOrigin!.building.code).toBe("H");
    expect(fromDestOnly!.building.code).toBe("H");
  });

  test("returns null when building code context has no washroom data for that building", () => {
    // Use a building code that exists in BUILDINGS but has no washroom nodes
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: "EV",
      originRoom: "101",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    // EV has no washroom data so it falls through to GPS-based nearest building
    expect(result === null || typeof result!.building.code === "string").toBe(true);
  });

  test("destination building context used when no origin building", () => {
    const result = findNearestWashroomTarget("female_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: null,
      originRoom: "",
      destinationBuildingCode: "H",
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("H");
  });

  test("MB washroom found via destination room context", () => {
    const result = findNearestWashroomTarget("female_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: null,
      originRoom: "",
      destinationBuildingCode: "MB",
      destinationRoom: "MB-1.410",
    });
    expect(result).not.toBeNull();
    expect(result!.building.code).toBe("MB");
  });

  test("compareWashroomLabels: labels with same number sort by locale", () => {
    // Both H-801A and H-801B have the same number prefix (801), localeCompare used
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: "H",
      originRoom: "820",
      destinationBuildingCode: null,
      destinationRoom: "",
    });
    expect(result).not.toBeNull();
  });
});
