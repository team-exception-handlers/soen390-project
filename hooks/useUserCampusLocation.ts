import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Campus } from "../constants/buildings";
import { detectBuildingFromLocation, type DetectedBuilding } from "../components/mapScreen/mapScreen.helpers";
import {
  getInitialLocationFix,
  hasLocationPermission,
  requestLocationPermission,
  startWatchingLocation,
} from "../utils/locationUtils";

export type OriginMode = "auto" | "manual";

type UseUserCampusLocationArgs = {
  campus: Campus;
  setCampus: Dispatch<SetStateAction<Campus>>;
  setOriginBuildingCode: Dispatch<SetStateAction<string | null>>;
  defaultOriginBuildingCode: string;
};

type ApplyDetectedLocationStateOptions = {
  forceOriginSync?: boolean;
  syncOriginWhenAuto?: boolean;
  syncCampusMode?: "never" | "once" | "always";
};

type ResolveDetectedLocationStateArgs = {
  detected: DetectedBuilding;
  originMode: OriginMode;
  hasInitializedCampusFromLocation: boolean;
  options?: ApplyDetectedLocationStateOptions;
};

export function resolveDetectedLocationState({
  detected,
  originMode,
  hasInitializedCampusFromLocation,
  options = {},
}: ResolveDetectedLocationStateArgs) {
  const {
    forceOriginSync = false,
    syncOriginWhenAuto = false,
    syncCampusMode = "never",
  } = options;

  const shouldSyncOrigin =
    forceOriginSync || (syncOriginWhenAuto && originMode === "auto");

  let nextCampus: Campus | null = null;
  let nextHasInitializedCampusFromLocation = hasInitializedCampusFromLocation;

  if (detected.campus) {
    if (syncCampusMode === "always") {
      nextCampus = detected.campus;
      nextHasInitializedCampusFromLocation = true;
    } else if (
      syncCampusMode === "once" &&
      !hasInitializedCampusFromLocation
    ) {
      nextCampus = detected.campus;
      nextHasInitializedCampusFromLocation = true;
    }
  }

  return {
    nextCurrentBuildingCode: detected.code,
    nextOriginBuildingCode: shouldSyncOrigin ? detected.code : undefined,
    nextCampus,
    nextHasInitializedCampusFromLocation,
  };
}

export function useUserCampusLocation({
  campus,
  setCampus,
  setOriginBuildingCode,
  defaultOriginBuildingCode,
}: Readonly<UseUserCampusLocationArgs>) {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [currentBuilding, setCurrentBuilding] = useState<
    string | null | undefined
  >(undefined);
  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const campusRef = useRef<Campus>(campus);
  const originModeRef = useRef<OriginMode>("auto");
  const hasInitializedCampusFromLocationRef = useRef(false);

  useEffect(() => {
    campusRef.current = campus;
  }, [campus]);

  const applyDetectedLocationState = useCallback(
    (
      detected: DetectedBuilding,
      options: ApplyDetectedLocationStateOptions = {},
    ) => {
      const resolution = resolveDetectedLocationState({
        detected,
        originMode: originModeRef.current,
        hasInitializedCampusFromLocation:
          hasInitializedCampusFromLocationRef.current,
        options,
      });

      setCurrentBuilding((previous) =>
        previous === resolution.nextCurrentBuildingCode
          ? previous
          : resolution.nextCurrentBuildingCode,
      );

      const nextOriginBuildingCode = resolution.nextOriginBuildingCode;
      if (nextOriginBuildingCode !== undefined) {
        setOriginBuildingCode((previous) =>
          previous === nextOriginBuildingCode
            ? previous
            : nextOriginBuildingCode,
        );
      }

      hasInitializedCampusFromLocationRef.current =
        resolution.nextHasInitializedCampusFromLocation;

      if (resolution.nextCampus && campusRef.current !== resolution.nextCampus) {
        setCampus(resolution.nextCampus);
      }

      return resolution.nextCampus ?? detected.campus;
    },
    [setCampus, setOriginBuildingCode],
  );

  const handleLocationUpdate = useCallback(
    (location: Location.LocationObject) => {
      const coords = location?.coords;
      if (
        !coords ||
        typeof coords.latitude !== "number" ||
        typeof coords.longitude !== "number"
      ) {
        return;
      }

      const detected = detectBuildingFromLocation(
        coords.latitude,
        coords.longitude,
      );

      setUserLocation(location);
      setLocationPermissionDenied(false);
      applyDetectedLocationState(detected, {
        syncOriginWhenAuto: true,
        syncCampusMode: "once",
      });
    },
    [applyDetectedLocationState],
  );

  useEffect(() => {
    async function setupLocation() {
      const permission = await hasLocationPermission();

      if (!permission) {
        const granted = await requestLocationPermission();
        if (!granted) {
          setLocationPermissionDenied(true);
          setOriginBuildingCode(defaultOriginBuildingCode);
          return;
        }
      }

      try {
        const initialLocation = await getInitialLocationFix();
        if (initialLocation) {
          handleLocationUpdate(initialLocation);
        } else {
          setOriginBuildingCode(defaultOriginBuildingCode);
        }
      } catch {
        setOriginBuildingCode(defaultOriginBuildingCode);
      }

      const subscription = await startWatchingLocation(handleLocationUpdate);
      if (subscription) {
        locationSubscription.current = subscription;
      }
    }

    setupLocation();

    return () => {
      if (locationSubscription.current) {
        try {
          locationSubscription.current.remove();
        } catch (error) {
          console.error("Failed to remove location subscription", error);
        } finally {
          locationSubscription.current = null;
        }
      }
    };
  }, [defaultOriginBuildingCode, handleLocationUpdate, setOriginBuildingCode]);

  const restoreAutoOriginFromCurrentLocation = useCallback(() => {
    originModeRef.current = "auto";

    const latitude = userLocation?.coords?.latitude;
    const longitude = userLocation?.coords?.longitude;

    if (typeof latitude === "number" && typeof longitude === "number") {
      const detected = detectBuildingFromLocation(latitude, longitude);
      return applyDetectedLocationState(detected, {
        forceOriginSync: true,
        syncCampusMode: "always",
      });
    }

    setOriginBuildingCode(defaultOriginBuildingCode);
    return null;
  }, [
    applyDetectedLocationState,
    defaultOriginBuildingCode,
    setOriginBuildingCode,
    userLocation,
  ]);

  return {
    userLocation,
    currentBuilding,
    locationPermissionDenied,
    originModeRef,
    setOriginMode: (mode: OriginMode) => {
      originModeRef.current = mode;
    },
    restoreAutoOriginFromCurrentLocation,
  };
}
