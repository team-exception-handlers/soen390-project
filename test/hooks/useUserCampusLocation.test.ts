const mockUseState = jest.fn();
const mockUseRef = jest.fn();
const mockUseEffect = jest.fn();

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useState: (initialValue: unknown) => mockUseState(initialValue),
    useRef: (initialValue: unknown) => mockUseRef(initialValue),
    useEffect: (effect: () => void | (() => void)) => mockUseEffect(effect),
    useCallback: <T extends (...args: any[]) => any>(fn: T) => fn,
  };
});

jest.mock("expo-location", () => ({}));

const detectBuildingFromLocation = jest.fn();

jest.mock("../../components/mapScreen/mapScreen.helpers", () => ({
  detectBuildingFromLocation,
}));

jest.mock("../../utils/locationUtils", () => ({
  getInitialLocationFix: jest.fn(),
  hasLocationPermission: jest.fn(),
  requestLocationPermission: jest.fn(),
  startWatchingLocation: jest.fn(),
}));

import {
  resolveDetectedLocationState,
  useUserCampusLocation,
} from "../../hooks/useUserCampusLocation";
import {
  getInitialLocationFix,
  hasLocationPermission,
  requestLocationPermission,
  startWatchingLocation,
} from "../../utils/locationUtils";

const getInitialLocationFixMock = getInitialLocationFix as jest.MockedFunction<
  typeof getInitialLocationFix
>;
const hasLocationPermissionMock = hasLocationPermission as jest.MockedFunction<
  typeof hasLocationPermission
>;
const requestLocationPermissionMock =
  requestLocationPermission as jest.MockedFunction<typeof requestLocationPermission>;
const startWatchingLocationMock = startWatchingLocation as jest.MockedFunction<
  typeof startWatchingLocation
>;

type StateEntry = {
  value: unknown;
  setter: jest.Mock;
};

let stateEntries: StateEntry[] = [];
let stateCursor = 0;
let stateOverrides: unknown[] = [];
let refEntries: Array<{ current: unknown }> = [];
let effectEntries: Array<() => void | (() => void)> = [];

const flushPromises = async () =>
  new Promise((resolve) => setImmediate(resolve));

function initializeReactHookMocks() {
  stateEntries = [];
  stateCursor = 0;
  refEntries = [];
  effectEntries = [];

  mockUseState.mockImplementation((initialValue: unknown) => {
    const index = stateCursor++;
    const entry: StateEntry = {
      value:
        index in stateOverrides ? stateOverrides[index] : initialValue,
      setter: jest.fn((nextValue: unknown) => {
        entry.value =
          typeof nextValue === "function"
            ? (nextValue as (previous: unknown) => unknown)(entry.value)
            : nextValue;
      }),
    };

    stateEntries[index] = entry;
    return [entry.value, entry.setter];
  });

  mockUseRef.mockImplementation((initialValue: unknown) => {
    const ref = { current: initialValue };
    refEntries.push(ref);
    return ref;
  });

  mockUseEffect.mockImplementation((effect: () => void | (() => void)) => {
    effectEntries.push(effect);
  });
}

describe("hooks/useUserCampusLocation", () => {
  beforeEach(() => {
    mockUseState.mockReset();
    mockUseRef.mockReset();
    mockUseEffect.mockReset();
    detectBuildingFromLocation.mockReset();
    getInitialLocationFixMock.mockReset();
    hasLocationPermissionMock.mockReset();
    requestLocationPermissionMock.mockReset();
    startWatchingLocationMock.mockReset();
    stateOverrides = [];
    initializeReactHookMocks();
  });

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

  test("does not initialize campus from location when sync is disabled", () => {
    const result = resolveDetectedLocationState({
      detected: { code: "SP", campus: "LOY" },
      originMode: "auto",
      hasInitializedCampusFromLocation: false,
      options: {
        syncCampusMode: "never",
      },
    });

    expect(result.nextCampus).toBeNull();
    expect(result.nextHasInitializedCampusFromLocation).toBe(false);
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

  test("setup applies an initial location fix and removes the watcher on cleanup", async () => {
    const location = {
      coords: { latitude: 45.497, longitude: -73.579 },
    } as any;
    const remove = jest.fn();
    const setCampus = jest.fn();
    const setOriginBuildingCode = jest.fn();

    detectBuildingFromLocation.mockReturnValue({ code: "H", campus: "SGW" });
    hasLocationPermissionMock.mockResolvedValue(true);
    getInitialLocationFixMock.mockResolvedValue(location);
    startWatchingLocationMock.mockResolvedValue({ remove } as any);

    useUserCampusLocation({
      campus: "LOY",
      setCampus,
      setOriginBuildingCode,
      defaultOriginBuildingCode: "H",
    });

    effectEntries[0]?.();
    const cleanup = effectEntries[1]?.();
    await flushPromises();

    expect(stateEntries[0]?.value).toBe(location);
    expect(stateEntries[1]?.value).toBe("H");
    expect(stateEntries[2]?.value).toBe(false);
    expect(setCampus).toHaveBeenCalledWith("SGW");
    expect(setOriginBuildingCode).toHaveBeenCalledTimes(1);
    expect(setOriginBuildingCode.mock.calls[0][0]("EV")).toBe("H");
    expect(startWatchingLocationMock).toHaveBeenCalledWith(expect.any(Function));

    (cleanup as (() => void) | undefined)?.();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test("setup falls back to the default origin when permission is denied", async () => {
    const setCampus = jest.fn();
    const setOriginBuildingCode = jest.fn();

    hasLocationPermissionMock.mockResolvedValue(false);
    requestLocationPermissionMock.mockResolvedValue(false);

    useUserCampusLocation({
      campus: "SGW",
      setCampus,
      setOriginBuildingCode,
      defaultOriginBuildingCode: "MB",
    });

    effectEntries[0]?.();
    effectEntries[1]?.();
    await flushPromises();

    expect(stateEntries[2]?.value).toBe(true);
    expect(setOriginBuildingCode).toHaveBeenCalledWith("MB");
    expect(startWatchingLocationMock).not.toHaveBeenCalled();
    expect(setCampus).not.toHaveBeenCalled();
  });

  test("setup handles invalid updates, initial location failures, and cleanup errors", async () => {
    const removeError = new Error("remove failed");
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const setOriginBuildingCode = jest.fn();

    hasLocationPermissionMock.mockResolvedValue(true);
    getInitialLocationFixMock.mockRejectedValue(new Error("boom"));
    startWatchingLocationMock.mockImplementation(async (callback) => {
      callback({ coords: { latitude: "bad", longitude: -73.5 } } as any);
      return {
        remove: () => {
          throw removeError;
        },
      } as any;
    });

    useUserCampusLocation({
      campus: "SGW",
      setCampus: jest.fn(),
      setOriginBuildingCode,
      defaultOriginBuildingCode: "EV",
    });

    effectEntries[0]?.();
    const cleanup = effectEntries[1]?.();
    await flushPromises();

    expect(setOriginBuildingCode).toHaveBeenCalledWith("EV");
    expect(detectBuildingFromLocation).not.toHaveBeenCalled();

    (cleanup as (() => void) | undefined)?.();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to remove location subscription",
      removeError,
    );

    consoleErrorSpy.mockRestore();
  });

  test("setup falls back to the default origin when no initial fix is available", async () => {
    const setOriginBuildingCode = jest.fn();

    hasLocationPermissionMock.mockResolvedValue(true);
    getInitialLocationFixMock.mockResolvedValue(null);
    startWatchingLocationMock.mockResolvedValue(null as any);

    useUserCampusLocation({
      campus: "SGW",
      setCampus: jest.fn(),
      setOriginBuildingCode,
      defaultOriginBuildingCode: "MB",
    });

    effectEntries[0]?.();
    effectEntries[1]?.();
    await flushPromises();

    expect(setOriginBuildingCode).toHaveBeenCalledWith("MB");
  });

  test("restoreAutoOriginFromCurrentLocation syncs from the live location and falls back when missing", () => {
    const setCampus = jest.fn();
    const setOriginBuildingCode = jest.fn();

    stateOverrides = [
      { coords: { latitude: 45.458, longitude: -73.64 } },
      undefined,
      false,
    ];
    initializeReactHookMocks();
    detectBuildingFromLocation.mockReturnValue({ code: "SP", campus: "LOY" });

    const hook = useUserCampusLocation({
      campus: "SGW",
      setCampus,
      setOriginBuildingCode,
      defaultOriginBuildingCode: "H",
    });

    effectEntries[0]?.();
    hook.setOriginMode("manual");

    expect(hook.restoreAutoOriginFromCurrentLocation()).toBe("LOY");
    expect(hook.originModeRef.current).toBe("auto");
    expect(setCampus).toHaveBeenCalledWith("LOY");
    expect(setOriginBuildingCode).toHaveBeenCalledTimes(1);
    expect(setOriginBuildingCode.mock.calls[0][0]("EV")).toBe("SP");

    setCampus.mockClear();
    setOriginBuildingCode.mockClear();
    stateOverrides = [null, undefined, false];
    initializeReactHookMocks();

    const fallbackHook = useUserCampusLocation({
      campus: "SGW",
      setCampus,
      setOriginBuildingCode,
      defaultOriginBuildingCode: "H",
    });

    expect(fallbackHook.restoreAutoOriginFromCurrentLocation()).toBeNull();
    expect(setOriginBuildingCode).toHaveBeenCalledWith("H");
    expect(setCampus).not.toHaveBeenCalled();
  });
});
