/**
 * Isolated suite: washroomSearch resolves building metadata via BUILDINGS.
 * When the catalog omits a code that still appears in indoor washroom data,
 * findNearestWashroomTarget must return null (defensive branch).
 */
jest.mock("../../constants/buildings", () => {
  const actual = jest.requireActual<
    typeof import("../../constants/buildings")
  >("../../constants/buildings");
  return {
    ...actual,
    BUILDINGS: actual.BUILDINGS.filter((b) => b.code !== "H"),
  };
});

import { BUILDINGS } from "../../constants/buildings";
import { findNearestWashroomTarget } from "../../utils/washroomSearch";

describe("findNearestWashroomTarget when BUILDINGS omits a code", () => {
  test("returns null for H context if H is not in BUILDINGS", () => {
    expect(BUILDINGS.some((b) => b.code === "H")).toBe(false);

    const sgwBuildings = BUILDINGS.filter((b) => b.campus === "SGW");
    const result = findNearestWashroomTarget("male_washroom", {
      campusBuildings: sgwBuildings,
      actualOriginPoint: null,
      originBuildingCode: "H",
      originRoom: "",
      destinationBuildingCode: null,
      destinationRoom: "",
    });

    expect(result).toBeNull();
  });
});
