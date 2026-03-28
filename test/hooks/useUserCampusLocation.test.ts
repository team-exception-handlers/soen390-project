jest.mock("../../utils/locationUtils", () => ({
  getInitialLocationFix: jest.fn(),
  hasLocationPermission: jest.fn(),
  requestLocationPermission: jest.fn(),
  startWatchingLocation: jest.fn(),
}));

import { resolveDetectedLocationState } from "../../hooks/useUserCampusLocation";

describe("hooks/useUserCampusLocation", () => {
  test("syncs origin building when origin mode is auto", () => {
    const result = resolveDetectedLocationState({
      detected: { code: "H", campus: "SGW" },
      originMode: "auto",
      hasInitializedCampusFromLocation: false,
      options: {
        syncOriginWhenAuto: true,
        syncCampusMode: "once",
      },
    });

    expect(result.nextCurrentBuildingCode).toBe("H");
    expect(result.nextOriginBuildingCode).toBe("H");
    expect(result.nextCampus).toBe("SGW");
    expect(result.nextHasInitializedCampusFromLocation).toBe(true);
  });

  test("does not sync origin building in manual mode unless forced", () => {
    const manualResult = resolveDetectedLocationState({
      detected: { code: "EV", campus: "SGW" },
      originMode: "manual",
      hasInitializedCampusFromLocation: true,
      options: {
        syncOriginWhenAuto: true,
        syncCampusMode: "once",
      },
    });

    expect(manualResult.nextOriginBuildingCode).toBeUndefined();
    expect(manualResult.nextCampus).toBeNull();

    const forcedResult = resolveDetectedLocationState({
      detected: { code: "EV", campus: "SGW" },
      originMode: "manual",
      hasInitializedCampusFromLocation: true,
      options: {
        forceOriginSync: true,
        syncCampusMode: "never",
      },
    });

    expect(forcedResult.nextOriginBuildingCode).toBe("EV");
  });

  test("respects campus sync modes", () => {
    const onceAfterInit = resolveDetectedLocationState({
      detected: { code: "SP", campus: "LOY" },
      originMode: "auto",
      hasInitializedCampusFromLocation: true,
      options: {
        syncCampusMode: "once",
      },
    });
    expect(onceAfterInit.nextCampus).toBeNull();

    const always = resolveDetectedLocationState({
      detected: { code: "SP", campus: "LOY" },
      originMode: "auto",
      hasInitializedCampusFromLocation: true,
      options: {
        syncCampusMode: "always",
      },
    });
    expect(always.nextCampus).toBe("LOY");
    expect(always.nextHasInitializedCampusFromLocation).toBe(true);
  });

  test("handles locations outside known campuses", () => {
    const result = resolveDetectedLocationState({
      detected: { code: null, campus: null },
      originMode: "auto",
      hasInitializedCampusFromLocation: false,
      options: {
        syncOriginWhenAuto: true,
        syncCampusMode: "once",
      },
    });

    expect(result.nextCurrentBuildingCode).toBeNull();
    expect(result.nextOriginBuildingCode).toBeNull();
    expect(result.nextCampus).toBeNull();
  });
});
