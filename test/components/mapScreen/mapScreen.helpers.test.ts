import { BUILDINGS } from "../../../constants/buildings";
import {
  buildingHasPolygon,
  detectBuildingFromLocation,
  formatDuration,
  getBoundsFromRegion,
  getFloorPlanAsset,
  getPinVisibilityMode,
  getTransitColor,
  roundCoord,
  resolveBuildingByCode,
  resolvePolygonCode,
  shouldShowBuildingPin,
} from "../../../components/mapScreen/mapScreen.helpers";

const findUserBuilding = jest.fn();

jest.mock("../../../utils/locationUtils", () => ({
  findUserBuilding,
}));
jest.mock("../../../assets/floor_plans/png/H1.png", () => "H1_ASSET");
jest.mock("../../../assets/floor_plans/png/H2.png", () => "H2_ASSET");
jest.mock("../../../assets/floor_plans/png/hall8.png", () => "H8_ASSET");
jest.mock("../../../assets/floor_plans/png/hall9.png", () => "H9_ASSET");
jest.mock("../../../assets/floor_plans/png/mb_1.png", () => "MB1_ASSET");
jest.mock("../../../assets/floor_plans/png/mb_s2.png", () => "MB_S2_ASSET");
jest.mock("../../../assets/floor_plans/png/ve1.png", () => "VE1_ASSET");
jest.mock("../../../assets/floor_plans/png/ve2.png", () => "VE2_ASSET");
jest.mock("../../../assets/floor_plans/png/vl_1.png", () => "VL1_ASSET");
jest.mock("../../../assets/floor_plans/png/vl_2.png", () => "VL2_ASSET");


describe("components/mapScreen/mapScreen.helpers", () => {
  test("rounds coordinates to four decimal places", () => {
    expect(roundCoord(45.49716)).toBe(45.4972);
  });

  test("formats durations across hour boundaries", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(95)).toBe("1 h 35 min");
  });

  test("resolves buildings by exact and prefix codes", () => {
    expect(resolveBuildingByCode(null, BUILDINGS)).toBeNull();
    expect(resolveBuildingByCode("EV", BUILDINGS)?.code).toBe("EV");
    expect(resolveBuildingByCode("CJ", BUILDINGS)?.code).toBe("CJ");
    expect(resolveBuildingByCode("XYZ", BUILDINGS)).toBeNull();
  });

  test("returns transit colors for major modes and metro lines", () => {
    expect(getTransitColor("WALK")).toBe("#2E7D32");
    expect(getTransitColor("BUS")).toBe("#007AFF");
    expect(getTransitColor("SUBWAY", "2")).toBe("#FF6600");
    expect(getTransitColor("SUBWAY", "5")).toBe("#0075BF");
    expect(getTransitColor("SUBWAY", "unknown")).toBe("#007AFF");
    expect(getTransitColor("FERRY")).toBe("#1668C7");
  });

  test("builds map bounds from a region", () => {
    expect(
      getBoundsFromRegion({
        latitude: 45.5,
        longitude: -73.6,
        latitudeDelta: 0.2,
        longitudeDelta: 0.4,
      }),
    ).toEqual([
      [45.4, -73.8],
      [45.6, -73.39999999999999],
    ]);
  });

  test("detects polygon availability and resolves parent polygon codes", () => {
    const polygons = [{ properties: { code: "CJ" } }, { properties: { code: "H" } }];

    expect(buildingHasPolygon({ code: "CJA" }, polygons)).toBe(true);
    expect(buildingHasPolygon({ code: "EV" }, polygons)).toBe(false);
    expect(resolvePolygonCode("CJA", polygons)).toBe("CJ");
    expect(resolvePolygonCode("H", polygons)).toBe("H");
  });

  test("loads floor plan assets and returns null for unknown keys", () => {
    expect(getFloorPlanAsset("H-1")).toBe("H1_ASSET");
    expect(getFloorPlanAsset("H-2")).toBe("H2_ASSET");
    expect(getFloorPlanAsset("H-8")).toBe("H8_ASSET");
    expect(getFloorPlanAsset("H-9")).toBe("H9_ASSET");
    expect(getFloorPlanAsset("MB-1")).toBe("MB1_ASSET");
    expect(getFloorPlanAsset("MB--2")).toBe("MB_S2_ASSET");
    expect(getFloorPlanAsset("VE-1")).toBe("VE1_ASSET");
    expect(getFloorPlanAsset("VE-2")).toBe("VE2_ASSET");
    expect(getFloorPlanAsset("VL-1")).toBe("VL1_ASSET");
    expect(getFloorPlanAsset("VL-2")).toBe("VL2_ASSET");
    expect(getFloorPlanAsset("missing")).toBeNull();
  });

  test("switches pin visibility mode by zoom level", () => {
    expect(getPinVisibilityMode(1.01)).toBe("all");
    expect(getPinVisibilityMode(1.2)).toBe("campus-summary");
    expect(shouldShowBuildingPin("all")).toBe(true);
    expect(shouldShowBuildingPin("campus-summary")).toBe(false);
  });

  test("detects buildings from location across both campuses", () => {
    findUserBuilding.mockReset();
    findUserBuilding
      .mockReturnValueOnce("H")
      .mockReturnValueOnce(null);
    expect(detectBuildingFromLocation(45.5, -73.57)).toEqual({
      code: "H",
      campus: "SGW",
    });

    findUserBuilding.mockReset();
    findUserBuilding
      .mockReturnValueOnce(null)
      .mockReturnValueOnce("SP");
    expect(detectBuildingFromLocation(45.46, -73.64)).toEqual({
      code: "SP",
      campus: "LOY",
    });

    findUserBuilding.mockReset();
    findUserBuilding
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);
    expect(detectBuildingFromLocation(0, 0)).toEqual({
      code: null,
      campus: null,
    });
  });
});
