import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { ChevronUp, X } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg from "react-native-svg";
import AppHeader, { Campus } from "../../components/AppHeader";
import BuildingInformation from "../../components/BuildingInformation";
import IndoorDirectionsModal from "../../components/IndoorDirectionsModal";
import DirectionsPanel from "../../components/mapScreen/DirectionsPanel";
import RouteStepsPopup from "../../components/mapScreen/RouteStepsPopup";
import { BUILDINGS, type BuildingRecord } from "../../constants/buildings";
import LOY_POLYGONS from "../../constants/maps/outdoor/LOY-polygons";
import SGW_POLYGONS from "../../constants/maps/outdoor/SGW-polygons";
import { createMapScreenStyles } from "../../styles/mapScreen.styles";
import { parseLocationParts } from "../../utils/classLocation";
import { fetchNextConcordiaClassToday } from "../../utils/googleCalendarNextClass";
import {
  findIndoorRoute,
  getFloorBounds,
  getGraphFloorBounds,
  type IndoorRoute,
} from "../../utils/indoorDirections";

import {
  findUserBuilding,
  hasLocationPermission,
  requestLocationPermission,
  startWatchingLocation,
} from "../../utils/locationUtils";
import { getCampusRegion } from "../../utils/mapRegions";
import {
  fetchOsrmRoute,
  type RouteInstruction,
  type RouteProfile,
} from "../../utils/osrmDirections";
import { getRoomDetails } from "../../utils/roomUtils";
import {
  calculateOsrmRouteHelper,
  calculateShuttleRouteHelper,
  calculateTransitRouteHelper,
  RouteLoaderResult,
} from "../../utils/routeCalculators";
import {
  decodePolyline,
  fetchTransitItineraries,
  formatTime,
  type TransitItinerary,
} from "../../utils/transitousDirections";

let WebView: React.ComponentType<any> | null = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    WebView = require("react-native-webview").WebView;
  } catch {
    WebView = null;
  }
}

const roundCoord = (value: number) => Number(value.toFixed(4));

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
};

const DEFAULT_START_BUILDING_CODE = "H";
const DEFAULT_DESTINATION_BUILDING_CODE = "EV";
type PinVisibilityMode = "all" | "campus-summary";

const getPinVisibilityMode = (zoomOutFactor: number): PinVisibilityMode => {
  if (zoomOutFactor > 1.08) return "campus-summary";
  return "all";
};

const shouldShowBuildingPin = (visibilityMode: PinVisibilityMode): boolean => {
  return visibilityMode === "all";
};

const resolveBuildingByCode = (
  code: string | null | undefined,
  buildings: BuildingRecord[],
) => {
  if (!code) return null;
  const exact = buildings.find((building) => building.code === code);
  if (exact) return exact;
  return buildings.find((building) => building.code.startsWith(code)) ?? null;
};

const detectBuildingFromLocation = (
  latitude: number,
  longitude: number,
): { code: string | null; campus: Campus | null } => {
  const sgwBuilding = findUserBuilding(
    latitude,
    longitude,
    SGW_POLYGONS as any,
  );
  if (sgwBuilding) return { code: sgwBuilding, campus: "SGW" };

  const loyBuilding = findUserBuilding(
    latitude,
    longitude,
    LOY_POLYGONS as any,
  );
  if (loyBuilding) return { code: loyBuilding, campus: "LOY" };

  return { code: null, campus: null };
};
const getFloorPlanAsset = (key: string): any => {
  const assets: Record<string, () => any> = {
    "H-1": () => require("../../assets/floor_plans/png/H1.png"),
    "H-2": () => require("../../assets/floor_plans/png/H2.png"),
    "H-8": () => require("../../assets/floor_plans/png/hall8.png"),
    "H-9": () => require("../../assets/floor_plans/png/hall9.png"),
    "MB-1": () => require("../../assets/floor_plans/png/mb_1.png"),
    "MB--2": () => require("../../assets/floor_plans/png/mb_s2.png"),
    "VE-1": () => require("../../assets/floor_plans/png/ve1.png"),
    "VE-2": () => require("../../assets/floor_plans/png/ve2.png"),
    "VL-1": () => require("../../assets/floor_plans/png/vl_1.png"),
    "VL-2": () => require("../../assets/floor_plans/png/vl_2.png"),
  };
  return assets[key] ? assets[key]() : null;
};
/* these make it so we can view selected campus and building from the map level */
const getTransitColor = (mode: string, route?: string) => {
  if (mode === "WALK") return "#2E7D32";
  if (mode === "BUS") return "#007AFF";
  if (mode === "TRAM") return "#9C27B0";

  // STM metro colors
  if (mode === "SUBWAY" || mode === "RAIL" || mode === "METRO") {
    const line = (route ?? "").trim();
    if (line === "1") return "#009E60"; // GREEN LINE
    if (line === "2") return "#FF6600"; // ORANGE LINE
    if (line === "4") return "#FFD700"; // YELLOW LINE
    if (line === "5") return "#0075BF"; // BLUE LINE
    return "#007AFF"; // fallback: blue
  }

  return "#1668C7";
};

export default function MapScreen() {
  // Tracks whether the user is editing the start or destination
  const [editingField, setEditingField] = useState<"from" | "to" | undefined>(
    undefined,
  );
  const [floorPlanModalVisible, setFloorPlanModalVisible] = useState(false);
  const [activeFloorPlan, setActiveFloorPlan] = useState<any>(null);
  const { toBuilding, toRoom } = useLocalSearchParams<{
    toBuilding?: string;
    toRoom?: string;
  }>();
  const [campus, setCampus] = useState<Campus>("SGW");
  const [searchText, setSearchText] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [destinationBuildingCode, setDestinationBuildingCode] =
    useState<string>(DEFAULT_DESTINATION_BUILDING_CODE);
  useEffect(() => {
    if (typeof toBuilding === "string" && toBuilding.trim()) {
      setDestinationBuildingCode(toBuilding.trim().toUpperCase());
      setIsDirectionsMode(true);
    }

    if (typeof toRoom === "string") {
      setDestinationRoom(toRoom.trim());
    }
  }, [toBuilding, toRoom]);

  // Tracks the selected origin building (or null if using current location)i
  const [originBuildingCode, setOriginBuildingCode] = useState<string | null>(
    null,
  );
  const [originRoom, setOriginRoom] = useState<string>("");
  const [destinationRoom, setDestinationRoom] = useState<string>("");
  const [isDirectionsMode, setIsDirectionsMode] = useState(false);
  const [indoorRoute, setIndoorRoute] = useState<IndoorRoute | null | undefined>(
    undefined,
  );
  const [indoorDirectionsModalVisible, setIndoorDirectionsModalVisible] =
    useState(false);

  const [routeMode, setRouteMode] = useState<
    RouteProfile | "transit" | "shuttle"
  >("walking");

  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [routeDurationMinutes, setRouteDurationMinutes] = useState<number | null>(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeInstructions, setRouteInstructions] = useState<
    RouteInstruction[]
  >([]);
  const [showRouteInstructions, setShowRouteInstructions] = useState(false);
  const [modeDurations, setModeDurations] = useState<
    Record<string, number | null>
  >({
    walking: null,
    driving: null,
    transit: null,
  });

  const [transitItineraries, setTransitItineraries] = useState<
    TransitItinerary[]
  >([]);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState(0);

  const [selectedShuttleDeparture] = useState<
    string | null
  >(null);
  const [shuttleWalkToCoords, setShuttleWalkToCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [shuttleDriveCoords, setShuttleDriveCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [shuttleWalkFromCoords, setShuttleWalkFromCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  const [expandedItineraries, setExpandedItineraries] = useState<number[]>([]);
  const [expandedIntermediateStops, setExpandedIntermediateStops] = useState<
    Set<string>
  >(new Set());
  const [routeStarted, setRouteStarted] = useState(false);
  const [nextClassLoading, setNextClassLoading] = useState(false);
  const [nextClassMessage, setNextClassMessage] = useState<string | null>(null);
  const [mapViewportRegion, setMapViewportRegion] = useState(() =>
    getCampusRegion("SGW", SGW_POLYGONS.features),
  );

  const routeInstructionsDismissedRef = useRef(false);
  const webIframeRef = useRef<HTMLIFrameElement | null>(null);
  const routeSheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 24) {
          routeInstructionsDismissedRef.current = true;
          setShowRouteInstructions(false);
          return;
        }
        if (gestureState.dy < -24) {
          routeInstructionsDismissedRef.current = false;
          setShowRouteInstructions(true);
        }
      },
    }),
  ).current;

  const mapRef = useRef<any>(null);
  const webViewRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [currentBuilding, setCurrentBuilding] = useState<
    string | null | undefined
  >(undefined);
  const [webMapReady, setWebMapReady] = useState(false);
  const locationSubscription = useRef<any>(null);
  const campusRef = useRef<Campus>(campus);
  const originModeRef = useRef<"auto" | "manual">("auto");
  const hasInitializedCampusFromLocationRef = useRef(false);
  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 56;

  const isWebPlatform = Platform.OS === "web";
  const webFrameTargetOrigin =
    isWebPlatform && typeof globalThis.window !== "undefined"
      ? globalThis.window.location.origin
      : null;
  const serializedWebFrameTargetOrigin = JSON.stringify(
    webFrameTargetOrigin ?? "*",
  );
  const showE2EHooks =
    Platform.OS !== "web" && process.env.EXPO_PUBLIC_ENABLE_E2E_HOOKS === "1";
  const userLat = isWebPlatform ? userLocation?.coords.latitude || null : null;
  const userLng = isWebPlatform ? userLocation?.coords.longitude || null : null;
  const currentBuildingForHTML = isWebPlatform ? currentBuilding : null;

  const postToWebIframe = useCallback(
    (message: unknown) => {
      if (!isWebPlatform || !webFrameTargetOrigin) return;
      webIframeRef.current?.contentWindow?.postMessage(
        message,
        webFrameTargetOrigin,
      );
    },
    [isWebPlatform, webFrameTargetOrigin],
  );

  useEffect(() => {
    campusRef.current = campus;
  }, [campus]);

  useEffect(() => {
    if (!nextClassMessage) return;

    const timeout = setTimeout(() => {
      setNextClassMessage(null);
    }, 4000); // disappears after 4 seconds

    return () => clearTimeout(timeout);
  }, [nextClassMessage]);
  const styles = useMemo(
    () =>
      createMapScreenStyles({
        isWebPlatform,
        topInset: insets.top,
        bottomInset: insets.bottom,
        tabBarHeight: TAB_BAR_HEIGHT,
      }),
    [isWebPlatform, insets.top, insets.bottom],
  );

  let MapViewComponent: React.ComponentType<any> | null = null;
  let MapMarkerComponent: React.ComponentType<any> | null = null;
  let MapCalloutComponent: React.ComponentType<any> | null = null;
  let MapPolygonComponent: React.ComponentType<any> | null = null;
  let MapPolylineComponent: React.ElementType | null = null;

  useEffect(() => {
    if (!isWebPlatform || !webFrameTargetOrigin) return;

    const handler = (event: MessageEvent) => {
      if (event.origin !== webFrameTargetOrigin) return;
      if (event.source !== webIframeRef.current?.contentWindow) return;

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data?.type === "buildingSelected") {
          setSelectedBuilding(data.buildingCode);
        }
        if (data?.type === "buildingDeselected") {
          setSelectedBuilding(null);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isWebPlatform, webFrameTargetOrigin]);

  if (Platform.OS !== "web" && !isExpoGo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const maps = require("react-native-maps");
      MapViewComponent = maps.default;
      MapMarkerComponent = maps.Marker;
      MapCalloutComponent = maps.Callout;
      MapPolygonComponent = maps.Polygon;
      MapPolylineComponent = maps.Polyline;
    } catch {
      MapViewComponent = null;
      MapMarkerComponent = null;
      MapCalloutComponent = null;
      MapPolygonComponent = null;
      MapPolylineComponent = null;
    }
  }

  const applyDetectedLocationState = useCallback(
    (
      detected: { code: string | null; campus: Campus | null },
      options: {
        forceOriginSync?: boolean;
        syncOriginWhenAuto?: boolean;
        syncCampusMode?: "never" | "once" | "always";
      } = {},
    ) => {
      const {
        forceOriginSync = false,
        syncOriginWhenAuto = false,
        syncCampusMode = "never",
      } = options;

      setCurrentBuilding((previous) =>
        previous === detected.code ? previous : detected.code,
      );

      if (
        forceOriginSync ||
        (syncOriginWhenAuto && originModeRef.current === "auto")
      ) {
        setOriginBuildingCode((previous) =>
          previous === detected.code ? previous : detected.code,
        );
      }

      if (!detected.campus) return;

      if (syncCampusMode === "always") {
        hasInitializedCampusFromLocationRef.current = true;
        if (campusRef.current !== detected.campus) {
          setCampus(detected.campus);
        }
        return;
      }

      if (
        syncCampusMode === "once" &&
        !hasInitializedCampusFromLocationRef.current
      ) {
        hasInitializedCampusFromLocationRef.current = true;
        if (campusRef.current !== detected.campus) {
          setCampus(detected.campus);
        }
      }
    },
    [],
  );

  const handleLocationUpdate = useCallback(
    (location: Location.LocationObject) => {
      const { latitude, longitude } = location.coords;
      const detected = detectBuildingFromLocation(latitude, longitude);

      setUserLocation(location);
      setLocationPermissionDenied(false);
      applyDetectedLocationState(detected, {
        syncOriginWhenAuto: true,
        syncCampusMode: "once",
      });
    },
    [applyDetectedLocationState],
  );

  // Start tracking user location
  useEffect(() => {
    async function setupLocation() {
      const permission = await hasLocationPermission();

      if (!permission) {
        const granted = await requestLocationPermission();
        if (!granted) {
          setLocationPermissionDenied(true);
          setOriginBuildingCode(DEFAULT_START_BUILDING_CODE);
          return;
        }
      }

      try {
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        handleLocationUpdate(initialLocation);
      } catch (error) {
        console.error("Error getting initial location:", error);
        setOriginBuildingCode(DEFAULT_START_BUILDING_CODE);
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
          if (typeof locationSubscription.current.remove === "function") {
            locationSubscription.current.remove();
          }
        } catch (error) {
          console.error("Failed to remove location subscription", error);
        } finally {
          locationSubscription.current = null;
        }
      }
    };
  }, [handleLocationUpdate]);

  const campusPolygons = useMemo(
    () => (campus === "SGW" ? SGW_POLYGONS : LOY_POLYGONS),
    [campus],
  );

  const allPolygons = useMemo(
    () => ({
      ...SGW_POLYGONS,
      features: [...SGW_POLYGONS.features, ...LOY_POLYGONS.features],
    }),
    [],
  );

  const campusBuildings = useMemo(
    () => BUILDINGS.filter((building) => building.campus === campus),
    [campus],
  );

  const defaultLoyRegion = useMemo(
    () => getCampusRegion("LOY", LOY_POLYGONS.features),
    [],
  );

  const defaultSgwRegion = useMemo(
    () => getCampusRegion("SGW", SGW_POLYGONS.features),
    [],
  );

  const actualOriginPoint = useMemo(() => {
    // If user selected a building as origin, use that building's coordinates
    if (originBuildingCode) {
      const building = BUILDINGS.find((b) => b.code === originBuildingCode);
      if (building)
        return { latitude: building.latitude, longitude: building.longitude };
    }

    // Fallback to current location
    const latitude = userLocation?.coords?.latitude;
    const longitude = userLocation?.coords?.longitude;
    if (typeof latitude === "number" && typeof longitude === "number") {
      return {
        latitude: roundCoord(latitude),
        longitude: roundCoord(longitude),
      };
    }

    return null;
  }, [originBuildingCode, userLocation]);

  const destinationBuilding = useMemo(
    () => resolveBuildingByCode(destinationBuildingCode, BUILDINGS),
    [destinationBuildingCode],
  );

  const originBuilding = useMemo(
    () => resolveBuildingByCode(originBuildingCode, BUILDINGS),
    [originBuildingCode],
  );

  const isSameCampus = useMemo(() => {
    if (!originBuilding || !destinationBuilding) return true;
    return originBuilding.campus === destinationBuilding.campus;
  }, [originBuilding, destinationBuilding]);

  useEffect(() => {
    if (isSameCampus) setRouteMode("walking");
  }, [isSameCampus]);

  // Compute indoor route whenever same building + both rooms are filled
  useEffect(() => {
    const originCode = originBuilding?.code;
    const destinationCode = destinationBuilding?.code;
    const trimmedOriginRoom = originRoom.trim();
    const trimmedDestinationRoom = destinationRoom.trim();

    if (
      originCode == null ||
      destinationCode == null ||
      originCode !== destinationCode ||
      trimmedOriginRoom.length === 0 ||
      trimmedDestinationRoom.length === 0
    ) {
      setIndoorRoute(undefined);
      return;
    }

    const route = findIndoorRoute(
      originCode,
      trimmedOriginRoom,
      trimmedDestinationRoom,
    );
    setIndoorRoute(route);
  }, [originBuilding, destinationBuilding, originRoom, destinationRoom]);

  useEffect(() => {
    if (!destinationBuilding || !actualOriginPoint) {
      setModeDurations({ walking: null, driving: null, transit: null });
      return;
    }
    let cancelled = false;
    const go = async () => {
      // For same campus: walk. For different campus: bike
      const walkOrBikeProfile = isSameCampus ? "walking" : "cycling";
      const [walkOrBike, drive] = await Promise.allSettled([
        fetchOsrmRoute(
          actualOriginPoint,
          destinationBuilding,
          walkOrBikeProfile,
        ),
        fetchOsrmRoute(actualOriginPoint, destinationBuilding, "driving"),
      ]);
      if (cancelled) return;
      setModeDurations((p) => ({
        ...p,
        walking:
          walkOrBike.status === "fulfilled"
            ? Math.round(walkOrBike.value.durationSeconds / 60)
            : null,
        driving:
          drive.status === "fulfilled"
            ? Math.round(drive.value.durationSeconds / 60)
            : null,
      }));
      if (!isSameCampus) {
        try {
          const itins = await fetchTransitItineraries(
            actualOriginPoint,
            destinationBuilding,
          );
          if (!cancelled)
            setModeDurations((p) => ({
              ...p,
              transit: itins[0]
                ? Math.round(itins[0].durationSeconds / 60)
                : null,
            }));
        } catch {
          if (!cancelled) setModeDurations((p) => ({ ...p, transit: null }));
        }
      }
    };
    go();
    return () => {
      cancelled = true;
    };
  }, [actualOriginPoint, destinationBuilding, isSameCampus]);

  const resetRouteState = () => {
    setRouteCoordinates([]);
    setRouteInstructions([]);
    setShowRouteInstructions(false);
    setTransitItineraries([]);
    setSelectedItineraryIndex(0);
    setExpandedItineraries([]);
    setExpandedIntermediateStops(new Set());
    setRouteStarted(false);
    routeInstructionsDismissedRef.current = false;
    setShuttleWalkToCoords([]);
    setShuttleDriveCoords([]);
    setShuttleWalkFromCoords([]);
    setOriginRoom("");
    setDestinationRoom("");
  };

  const exitDirectionsMode = () => {
    setIsDirectionsMode(false);
    resetRouteState();
    setRouteCoordinates([]);
    setRouteInstructions([]);
    setShowRouteInstructions(false);
    routeInstructionsDismissedRef.current = false;
  };

  const handleCampusChange = (nextCampus: Campus) => {
    if (isDirectionsMode) {
      setCampus(nextCampus);
      const polygons =
        nextCampus === "SGW" ? SGW_POLYGONS.features : LOY_POLYGONS.features;
      const newRegion = getCampusRegion(nextCampus, polygons);
      setMapViewportRegion(newRegion);
      if (!isWebPlatform && mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(newRegion, 450);
      }
      if (Platform.OS === "web") {
        const minLat = newRegion.latitude - newRegion.latitudeDelta / 2;
        const maxLat = newRegion.latitude + newRegion.latitudeDelta / 2;
        const minLng = newRegion.longitude - newRegion.longitudeDelta / 2;
        const maxLng = newRegion.longitude + newRegion.longitudeDelta / 2;
        postToWebIframe({
          type: "focusBounds",
          bounds: [
            [minLat, minLng],
            [maxLat, maxLng],
          ],
          campus: nextCampus,
          padding: [20, 20],
        });
      }
      if (webViewRef.current && webMapReady) {
        const bounds: [number, number][] = [
          [
            newRegion.latitude - newRegion.latitudeDelta / 2,
            newRegion.longitude - newRegion.longitudeDelta / 2,
          ],
          [
            newRegion.latitude + newRegion.latitudeDelta / 2,
            newRegion.longitude + newRegion.longitudeDelta / 2,
          ],
        ];
        const script = `
          (function() {
            if (window.setMapBounds) {
              window.setMapBounds(${JSON.stringify(bounds)}, [20, 20], ${JSON.stringify(nextCampus)});
            }
          })();
          true;
        `;
        webViewRef.current.injectJavaScript(script);
      }
      return;
    }
    setCampus(nextCampus);
  };

  const handleNextClassDirections = useCallback(async () => {
    setNextClassLoading(true);
    setNextClassMessage(null);

    try {
      const accessToken = await AsyncStorage.getItem("google_access_token");

      if (!accessToken) {
        setNextClassMessage("Please sign in to Google Calendar first.");
        return;
      }

      const nextEvent = await fetchNextConcordiaClassToday(
        accessToken,
        "primary",
      );

      if (!nextEvent) {
        setNextClassMessage("No upcoming classes today.");
        return;
      }

      const { building, room } = parseLocationParts(nextEvent.location);

      if (!building) {
        setNextClassMessage(
          "Your next class does not have a valid location in Google Calendar.",
        );
        return;
      }

      setDestinationBuildingCode(building);
      setDestinationRoom(room ?? "");
      setIsDirectionsMode(true);
      setEditingField(undefined);
      setSelectedBuilding(null);
      setSearchText("");
      routeInstructionsDismissedRef.current = false;
      setShowRouteInstructions(true);

      const destinationRecord = resolveBuildingByCode(building, BUILDINGS);
      if (destinationRecord && destinationRecord.campus !== campus) {
        setCampus(destinationRecord.campus);
      }

      const className = nextEvent.summary ?? "your next class";
      const location = room ? `${building}-${room}` : building;

      setNextClassMessage(`Directions set to ${className} (${location}).`);
    } catch (error) {
      console.error("Failed to get next class directions:", error);
      setNextClassMessage("Could not load your next class.");
    } finally {
      setNextClassLoading(false);
    }
  }, [campus, routeInstructionsDismissedRef]);

  const clearDirections = () => {
    setSearchText("");
    setSelectedBuilding(null);

    if (!isDirectionsMode) {
      routeInstructionsDismissedRef.current = false;
      setIsDirectionsMode(true);
      return;
    }

    exitDirectionsMode();
    originModeRef.current = "auto";
    let restoredCampus: Campus | null = null;

    const latitude = userLocation?.coords?.latitude;
    const longitude = userLocation?.coords?.longitude;
    if (typeof latitude === "number" && typeof longitude === "number") {
      const detected = detectBuildingFromLocation(latitude, longitude);
      restoredCampus = detected.campus;
      applyDetectedLocationState(detected, {
        forceOriginSync: true,
        syncCampusMode: "always",
      });
    } else {
      setOriginBuildingCode(DEFAULT_START_BUILDING_CODE);
    }

    if (restoredCampus && restoredCampus !== campus) {
      setCampus(restoredCampus);
    }

    if (!isWebPlatform) {
      const mapCampus = restoredCampus ?? campus;
      const polygons =
        mapCampus === "SGW" ? SGW_POLYGONS.features : LOY_POLYGONS.features;
      mapRef.current?.animateToRegion?.(
        getCampusRegion(mapCampus, polygons),
        450,
      );
    }
  };

  const searchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];
    return campusBuildings
      .filter((building) => {
        const haystack = [
          building.code,
          building.shortName,
          building.longName,
          building.address,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [campusBuildings, searchText]);

  const handleSearchResultPress = (building: BuildingRecord) => {
    setSelectedBuilding(building.code);
    setSearchText("");
    Keyboard.dismiss();
  };

  useEffect(() => {
    setSearchText("");
    setSelectedBuilding(null);
  }, [campusBuildings]);

  useEffect(() => {
    if (!isDirectionsMode || !destinationBuilding || !actualOriginPoint) {
      resetRouteState();
      setRouteCoordinates([]);
      setRouteInstructions([]);
      setShowRouteInstructions(false);
      routeInstructionsDismissedRef.current = false;
      return;
    }

    let cancelled = false;

    const applyRouteResult = (res: RouteLoaderResult) => {
  setRouteCoordinates(res.routeCoordinates);
  setRouteDurationMinutes(res.routeDurationMinutes);
  setRouteDistanceMeters(res.routeDistanceMeters);
  setRouteInstructions(res.routeInstructions);
  if (res.routeInstructions?.length > 0 && !routeInstructionsDismissedRef.current) {
    setShowRouteInstructions(true);
  }
};

const fetchRoute = async () => {
  if (routeMode === "shuttle") {
    return calculateShuttleRouteHelper(actualOriginPoint, destinationBuilding, selectedShuttleDeparture);
  }
  if (routeMode === "transit") {
    return calculateTransitRouteHelper(actualOriginPoint, destinationBuilding);
  }
  return calculateOsrmRouteHelper(actualOriginPoint, destinationBuilding, routeMode, isSameCampus);
};

const loadRoute = async () => {
  resetRouteState();
  setRouteLoading(true);

  try {
    const res = await fetchRoute();

    if (cancelled || !res) return;

    applyRouteResult(res);

    if (routeMode === "transit") {
      setTransitItineraries(res.transitItineraries);
      setSelectedItineraryIndex(0);
      setExpandedItineraries([]);
      setRouteStarted(false);
    } else if (routeMode === "shuttle") {
      setTransitItineraries(res.transitItineraries);
      setShuttleWalkToCoords(res.shuttleWalkToCoords);
      setShuttleDriveCoords(res.shuttleDriveCoords);
      setShuttleWalkFromCoords(res.shuttleWalkFromCoords);
    }
  } catch {
    if (cancelled) return;
    resetRouteState();
  } finally {
    setRouteLoading(false);
  }
};

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [
    isDirectionsMode,
    destinationBuilding,
    actualOriginPoint,
    routeMode,
    isSameCampus,
  ]);

  // Only show pins for buildings that have a polygon (exact or parent e.g. CJ for CJA)
  const buildingsWithPolygons = useMemo(() => {
    const buildingHasPolygon = (building: { code: string }) => {
      const hasExact = allPolygons.features.some(
        (f: { properties: { code: string } }) =>
          f.properties.code === building.code,
      );
      const hasParent = allPolygons.features.some(
        (f: { properties: { code: string } }) =>
          building.code.startsWith(f.properties.code) &&
          f.properties.code.length >= 2,
      );
      return hasExact || hasParent;
    };
    return BUILDINGS.filter(buildingHasPolygon);
  }, [allPolygons]);

  const region = useMemo(
    () => getCampusRegion(campus, campusPolygons.features),
    [campus, campusPolygons],
  );

  const pinVisibilityMode = useMemo(() => {
    const zoomOutFactor = Math.max(
      mapViewportRegion.latitudeDelta / region.latitudeDelta,
      mapViewportRegion.longitudeDelta / region.longitudeDelta,
    );
    return getPinVisibilityMode(zoomOutFactor);
  }, [mapViewportRegion, region]);

  const visibleBuildingsWithPolygons = useMemo(
    () =>
      buildingsWithPolygons.filter(() =>
        shouldShowBuildingPin(pinVisibilityMode),
      ),
    [buildingsWithPolygons, pinVisibilityMode],
  );

  const showCampusSummaryMarkers = pinVisibilityMode === "campus-summary";

  const campusMarkerData = useMemo(
    () => [
      {
        campus: "SGW" as Campus,
        latitude: defaultSgwRegion.latitude,
        longitude: defaultSgwRegion.longitude,
      },
      {
        campus: "LOY" as Campus,
        latitude: defaultLoyRegion.latitude,
        longitude: defaultLoyRegion.longitude,
      },
    ],
    [defaultLoyRegion, defaultSgwRegion],
  );

  const campusBounds = useMemo(() => {
    const minLat = region.latitude - region.latitudeDelta / 2;
    const maxLat = region.latitude + region.latitudeDelta / 2;
    const minLng = region.longitude - region.longitudeDelta / 2;
    const maxLng = region.longitude + region.longitudeDelta / 2;

    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [region]);

  const b = BUILDINGS.find((building) => building.code === selectedBuilding);
  let buildingInfo = b?.description;
  let buildingName = b?.longName;
  let buildingPhotoLink = b?.photoLink;

  useEffect(() => {
    if (
      webViewRef.current &&
      Platform.OS !== "web" &&
      userLocation &&
      webMapReady
    ) {
      const { latitude, longitude } = userLocation.coords;

      const script = `
      (function() {
        try {
          if (typeof L !== 'undefined' && window.map) {
            if (window.userMarker) {
              window.userMarker.setLatLng([${latitude}, ${longitude}]);
              console.log('User marker updated to:', ${latitude}, ${longitude});
            } else {
              const userIcon = L.divIcon({
                className: 'user-marker',
                html: '<div style="width: 14px; height: 14px; background: #007AFF; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });
              window.userMarker = L.marker([${latitude}, ${longitude}], { icon: userIcon }).addTo(window.map);
              console.log('User marker created at:', ${latitude}, ${longitude});
            }
          }
        } catch (e) {
          console.log('User marker error:', e);
        }
      })();
      true;
    `;
      webViewRef.current?.injectJavaScript(script);
    }
  }, [userLocation, webMapReady]);

  useEffect(() => {
    if (isDirectionsMode) return;

    setMapViewportRegion(region);

    if (!isWebPlatform) {
      mapRef.current?.animateToRegion?.(region, 450);
    }

    if (Platform.OS === "web") {
      postToWebIframe({
        type: "focusBounds",
        bounds: campusBounds,
        campus,
        padding: [20, 20],
      });
      return;
    }

    if (webViewRef.current && webMapReady) {
      const script = `
        (function() {
          if (window.setMapBounds) {
            window.setMapBounds(${JSON.stringify(campusBounds)}, [20, 20], ${JSON.stringify(campus)});
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    }
  }, [
    campus,
    campusBounds,
    isDirectionsMode,
    isWebPlatform,
    postToWebIframe,
    region,
    webMapReady,
  ]);

  useEffect(() => {
    if (Platform.OS === "web" || !webViewRef.current || !webMapReady) return;

    const script = `
      (function() {
        try {
          if (typeof L === 'undefined' || !window.polygonMap) return;
          const nextCode = ${JSON.stringify(currentBuilding ?? null)};
          const selectedCode =
            (window.selectedPolygon && window.selectedPolygon.__buildingCode) ||
            window.selectedBuildingCode ||
            null;

          if (
            window.currentBuildingCode &&
            window.currentBuildingCode !== selectedCode &&
            window.currentBuildingPolygon
          ) {
            window.currentBuildingPolygon.setStyle({
              color: '#A32638',
              fillColor: '#A32638',
              fillOpacity: 0.2,
              weight: 2
            });
          }

          if (nextCode && window.polygonMap[nextCode]) {
            window.currentBuildingPolygon = window.polygonMap[nextCode];
            window.currentBuildingCode = nextCode;
            if (nextCode !== selectedCode) {
              window.currentBuildingPolygon.setStyle({
                color: '#FFA500',
                fillColor: '#FFA500',
                fillOpacity: 0.5,
                weight: 3
              });
            }
          } else {
            window.currentBuildingPolygon = null;
            window.currentBuildingCode = null;
          }
        } catch (e) {
          console.log('Current building highlight error:', e);
        }
      })();
      true;
    `;

    webViewRef.current?.injectJavaScript(script);
  }, [currentBuilding, userLocation, selectedBuilding, webMapReady]);

  // Precompute per-leg transit segments for Leaflet
  const webTransitSegments = useMemo(() => {
    if (routeMode !== "transit") return [];
    const itin = transitItineraries[selectedItineraryIndex];
    if (!itin) return [];

    return itin.legs
      .filter((leg) => !!leg.legGeometry?.points)
      .map((leg) => {
        const precision = (leg.legGeometry as any)?.precision ?? 7;
        const coords = decodePolyline(leg.legGeometry!.points, precision).map(
          (p) => [p.latitude, p.longitude],
        );
        return {
          mode: leg.mode,
          route: leg.route ?? "",
          coords,
        };
      });
  }, [routeMode, transitItineraries, selectedItineraryIndex]);

  // Generate HTML for web map
  const mapHTML = useMemo(() => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } =
      defaultSgwRegion;
    const buildingData = buildingsWithPolygons.map(
      ({
        latitude: lat,
        longitude: lng,
        code,
        shortName,
        campus: buildingCampus,
      }) => ({
        latitude: lat,
        longitude: lng,
        code,
        shortName,
        campus: buildingCampus,
      }),
    );
    const campusSummaryData = campusMarkerData.map(
      ({ campus: summaryCampus, latitude: lat, longitude: lng }) => ({
        campus: summaryCampus,
        latitude: lat,
        longitude: lng,
      }),
    );

    const minLat = latitude - latitudeDelta / 2;
    const maxLat = latitude + latitudeDelta / 2;
    const minLng = longitude - longitudeDelta / 2;
    const maxLng = longitude + longitudeDelta / 2;

    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
              body { margin: 0; padding: 0; }
              #map { width: 100%; height: 100vh; }
              .building-marker { background: transparent; border: none; }
              .marker-badge {
                  min-width: 30px;
                  height: 28px;
                  padding: 0 8px;
                  border-radius: 14px;
                  background: #A32638;
                  color: #ffffff;
                  font-size: 12px;
                  font-weight: 700;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 2px solid #ffffff;
                  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
              }
              .marker-stem {
                  width: 0;
                  height: 0;
                  margin: -2px auto 0;
                  border-left: 6px solid transparent;
                  border-right: 6px solid transparent;
                  border-top: 8px solid #A32638;
                  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.12));
              }
              .user-marker { background: transparent; border: none; }
              .campus-marker { background: transparent; border: none; }
              .campus-badge {
                  min-width: 38px;
                  height: 38px;
                  padding: 0 10px;
                  background: #A32638;
                  color: #ffffff;
                  border: 2px solid #ffffff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
                  font-size: 11px;
                  font-weight: 800;
                  letter-spacing: 0.2px;
                  border-radius: 19px;
              }
          </style>
      </head>
      <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
              const map = L.map('map', { maxZoom: 22 }).setView([${latitude}, ${longitude}], 20);
              window.map = map;
              const parentMessageTargetOrigin = ${serializedWebFrameTargetOrigin};
              const notifyHost = (payload) => {
                  if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
                      return;
                  }

                  window.parent.postMessage(payload, parentMessageTargetOrigin);
              };

              const buildings = ${JSON.stringify(buildingData)};
              const campusMarkers = ${JSON.stringify(campusSummaryData)};
              const polygonData = ${JSON.stringify(allPolygons)};
              const currentBuilding = ${JSON.stringify(currentBuildingForHTML)};
              const routeMode = ${JSON.stringify(routeMode)};
              const routeCoordinates = ${JSON.stringify(
                routeCoordinates.map((point) => [
                  point.latitude,
                  point.longitude,
                ]),
              )};
              const shuttleWalkToCoords = ${JSON.stringify(
                shuttleWalkToCoords.map((point) => [
                  point.latitude,
                  point.longitude,
                ]),
              )};
              const shuttleDriveCoords = ${JSON.stringify(
                shuttleDriveCoords.map((point) => [
                  point.latitude,
                  point.longitude,
                ]),
              )};
              const shuttleWalkFromCoords = ${JSON.stringify(
                shuttleWalkFromCoords.map((point) => [
                  point.latitude,
                  point.longitude,
                ]),
              )};

              // Per-leg transit segments for Leaflet
              const transitSegments = ${JSON.stringify(webTransitSegments)};

              let selectedPolygon = null;
              let markerRecords = [];
              window.polygonMap = {};
              window.currentBuildingPolygon = null;
              window.currentBuildingCode = null;
              window.selectedBuildingCode = null;
              window.selectedPolygon = null;
              window.userMarker = null;
              window.followUser = false;
              window.hasCenteredOnUser = false;
              window.selectedCampus = "SGW";
              window.defaultCampusZoom = null;

              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '© OpenStreetMap contributors',
                  maxZoom: 22,
                  maxNativeZoom: 19
              }).addTo(map);

              const defaultPolygonStyle = { color: '#A32638', fillColor: '#A32638', fillOpacity: 0.2, weight: 2 };
              const currentPolygonStyle = { color: '#FFA500', fillColor: '#FFA500', fillOpacity: 0.5, weight: 3 };
              const selectedPolygonStyle = { color: '#238c51', fillColor: '#238c51', fillOpacity: 0.5, weight: 3 };

              const resetPolygonStyle = (polygon) => {
                  if (!polygon) return;
                  const code = polygon.__buildingCode || null;
                  if (code && window.currentBuildingCode === code) polygon.setStyle(currentPolygonStyle);
                  else polygon.setStyle(defaultPolygonStyle);
              };

              const bounds = [[${minLat}, ${minLng}], [${maxLat}, ${maxLng}]];
              const getPinVisibilityMode = () => {
                  const defaultCampusZoom =
                    typeof window.defaultCampusZoom === 'number'
                      ? window.defaultCampusZoom
                      : map.getZoom();
                  const zoomOutDelta = defaultCampusZoom - map.getZoom();
                  if (zoomOutDelta > 0.45) return 'campus-summary';
                  return 'all';
              };
              const shouldShowMarker = (record, visibilityMode) => {
                  if (record.type === 'campus') return visibilityMode === 'campus-summary';
                  return visibilityMode === 'all';
              };
              const updateMarkerVisibility = () => {
                  const visibilityMode = getPinVisibilityMode();
                  markerRecords.forEach((record) => {
                      const shouldShow = shouldShowMarker(record, visibilityMode);
                      const marker = record.marker;
                      const isVisible = map.hasLayer(marker);
                      if (shouldShow && !isVisible) marker.addTo(map);
                      if (!shouldShow && isVisible) map.removeLayer(marker);
                  });
              };
              window.updateMarkerVisibility = updateMarkerVisibility;
              window.setMapBounds = (nextBounds, padding = [20, 20], nextCampus = window.selectedCampus) => {
                  if (!Array.isArray(nextBounds) || nextBounds.length !== 2) return;
                  if (nextCampus) window.selectedCampus = nextCampus;
                  window.defaultCampusZoom = map.getBoundsZoom(
                    nextBounds,
                    false,
                    L.point(padding[0], padding[1])
                  );
                  map.fitBounds(nextBounds, { padding });
                  updateMarkerVisibility();
              };

             const segmentColor = (mode, route) => {
                  if (mode === "WALK") return "#2E7D32";
                  if (mode === "BUS") return "#007AFF";    
                  if (mode === "TRAM") return "#9C27B0";  

                  // STM metro colours
                  if (mode === "SUBWAY" || mode === "RAIL" || mode === "METRO") {
                    const line = (route || "").trim();
                    if (line === "1") return "#009E60"; // GREEN LINE
                    if (line === "2") return "#FF6600"; // ORANGE LINE
                    if (line === "4") return "#FFD700"; // YELLOW LINE
                    if (line === "5") return "#0075BF"; // BLUE LINE
                    return "#007AFF";
                  }

                  return "#1668C7";
                };


              let routeLayers = [];
              let hasAnyRoute = false;

              if (routeMode === "transit" && Array.isArray(transitSegments) && transitSegments.length) {
                transitSegments.forEach((seg) => {
                  if (!seg.coords || seg.coords.length < 2) return;

                  const poly = L.polyline(seg.coords, {
                    color: segmentColor(seg.mode, seg.route),
                    weight: 6,
                    opacity: 0.9,
                    lineCap: "round",
                    lineJoin: "round",
                    dashArray: seg.mode === "WALK" ? "2 12" : undefined
                  }).addTo(map);

                  routeLayers.push(poly);
                });

                if (routeLayers.length) {
                  hasAnyRoute = true;
                  const group = L.featureGroup(routeLayers);
                  map.fitBounds(group.getBounds(), { padding: [50, 50] });
                }
              }

              if (!hasAnyRoute && routeMode === 'shuttle' && shuttleDriveCoords.length > 1) {
                  const walkingStyle = {
                      color: '#2E7D32',
                      weight: 6,
                      opacity: 0.9,
                      lineCap: 'round',
                      lineJoin: 'round',
                      dashArray: '2 12'
                  };
                  const drivingStyle = {
                      color: '#912338',
                      weight: 6,
                      opacity: 0.9,
                      lineCap: 'round',
                      lineJoin: 'round'
                  };

                  if (shuttleWalkToCoords.length > 1) {
                      routeLayers.push(L.polyline(shuttleWalkToCoords, walkingStyle).addTo(map));
                  }
                  routeLayers.push(L.polyline(shuttleDriveCoords, drivingStyle).addTo(map));
                  if (shuttleWalkFromCoords.length > 1) {
                      routeLayers.push(L.polyline(shuttleWalkFromCoords, walkingStyle).addTo(map));
                  }

                  const group = L.featureGroup(routeLayers);
                  map.fitBounds(group.getBounds(), { padding: [50, 50] });
                  hasAnyRoute = true;
              }

              // Existing non-transit behavior (walking/driving): draw single polyline
              if (!hasAnyRoute && routeCoordinates.length > 1) {
                  const routeStyle = {
                      color: '#1668C7',
                      weight: routeMode === 'walking' ? 7 : 6,
                      opacity: 0.88,
                      lineCap: 'round',
                      lineJoin: 'round'
                  };

                  if (routeMode === 'walking') {
                      routeStyle.dashArray = '1 12';
                  }

                  const routePolyline = L.polyline(routeCoordinates, routeStyle).addTo(map);
                  routeLayers.push(routePolyline);

                  L.circleMarker(routeCoordinates[0], {
                      radius: 6,
                      color: '#14532D',
                      fillColor: '#22C55E',
                      fillOpacity: 1,
                      weight: 2
                  }).addTo(map);

                  L.circleMarker(routeCoordinates[routeCoordinates.length - 1], {
                      radius: 6,
                      color: '#7F1D1D',
                      fillColor: '#EF4444',
                      fillOpacity: 1,
                      weight: 2
                  }).addTo(map);

                  map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
                  hasAnyRoute = true;
              }

              if (!hasAnyRoute) {
                  window.setMapBounds(bounds, [20, 20], window.selectedCampus);
              }

              window.addEventListener('message', function(event) {
                  if (event.origin !== parentMessageTargetOrigin) return;

                  const data = event.data;
                  if (data?.type === 'focusBounds') {
                      window.setMapBounds(data.bounds, data.padding, data.campus);
                  }
              });

              const disableFollow = () => { window.followUser = false; };
              map.on('dragstart', disableFollow);
              map.on('zoomstart', disableFollow);
              map.on('movestart', disableFollow);
              map.on('zoomend', updateMarkerVisibility);
              map.on('moveend', updateMarkerVisibility);

              polygonData.features.forEach((feature) => {
                  const coordinates = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                  const buildingCode = feature.properties.code;

                  const polygon = L.polygon(coordinates, defaultPolygonStyle).addTo(map);

                  window.polygonMap[buildingCode] = polygon;
                  polygon.__buildingCode = buildingCode;

                  polygon.on('click', function(e) {
                      if (selectedPolygon) resetPolygonStyle(selectedPolygon);
                      this.setStyle(selectedPolygonStyle);
                      selectedPolygon = this;
                      window.selectedBuildingCode = buildingCode;
                      window.selectedPolygon = selectedPolygon;
                      notifyHost({ type: 'buildingSelected', buildingCode: buildingCode });
                      L.DomEvent.stopPropagation(e);
                  });

                  polygon.on('mouseover', function() {
                      if (this !== selectedPolygon) this.setStyle({ fillOpacity: 0.3 });
                  });

                  polygon.on('mouseout', function() {
                      if (this !== selectedPolygon) this.setStyle({ fillOpacity: 0.2 });
                  });
              });

              if (currentBuilding && window.polygonMap[currentBuilding]) {
                  window.currentBuildingPolygon = window.polygonMap[currentBuilding];
                  window.currentBuildingCode = currentBuilding;
                  window.currentBuildingPolygon.setStyle(currentPolygonStyle);
              }

              map.on('click', function() {
                  if (selectedPolygon) {
                      resetPolygonStyle(selectedPolygon);
                      selectedPolygon = null;
                      window.selectedBuildingCode = null;
                      window.selectedPolygon = null;
                      notifyHost({ type: 'buildingDeselected' });
                  }
              });

              const createBuildingIcon = (code) => L.divIcon({
                  className: 'building-marker',
                  html: '<div class="marker-badge">' + code + '</div><div class="marker-stem"></div>',
                  iconSize: [40, 44],
                  iconAnchor: [20, 44],
                  popupAnchor: [0, -40]
              });
              const createCampusIcon = (campusCode) => {
                  return L.divIcon({
                      className: 'campus-marker',
                      html: '<div class="campus-badge">' + campusCode + '</div>',
                      iconSize: [40, 40],
                      iconAnchor: [20, 20],
                      popupAnchor: [0, -20]
                  });
              };

              buildings.forEach((building) => {
                  const marker = L.marker([building.latitude, building.longitude], { icon: createBuildingIcon(building.code) });

                  marker.on('click', function(e) {
                      let polygon = window.polygonMap[building.code];
                      if (!polygon && building.code.length > 2) {
                          const baseCode = building.code.slice(0, -1);
                          polygon = window.polygonMap[baseCode];
                      }

                      if (polygon) {
                          if (selectedPolygon) resetPolygonStyle(selectedPolygon);

                          if (selectedPolygon === polygon) {
                              resetPolygonStyle(selectedPolygon);
                              selectedPolygon = null;
                          } else {
                              polygon.setStyle(selectedPolygonStyle);
                              selectedPolygon = polygon;
                          }
                      }

                      if (selectedPolygon) {
                        window.selectedBuildingCode = building.code;
                        window.selectedPolygon = selectedPolygon;
                        notifyHost({ type: 'buildingSelected', buildingCode: building.code });
                      } else {
                        window.selectedBuildingCode = null;
                        window.selectedPolygon = null;
                        notifyHost({ type: 'buildingDeselected' });
                      }

                      L.DomEvent.stopPropagation(e);
                  });

                  markerRecords.push({ type: 'building', building, marker });
              });

              campusMarkers.forEach((campusMarker) => {
                  const marker = L.marker(
                    [campusMarker.latitude, campusMarker.longitude],
                    { icon: createCampusIcon(campusMarker.campus) }
                  );

                  markerRecords.push({ type: 'campus', campus: campusMarker.campus, marker });
              });

              updateMarkerVisibility();

              ${
                userLat && userLng
                  ? `
              console.log('Adding user marker at:', ${userLat}, ${userLng});
              const userIcon = L.divIcon({
                  className: 'user-marker',
                  html: '<div style="width: 14px; height: 14px; background: #007AFF; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
              });
              window.userMarker = L.marker([${userLat}, ${userLng}], { icon: userIcon }).addTo(map);
              `
                  : 'console.log("No user location available");'
              }
          </script>
      </body>
      </html>
    `;
  }, [
    allPolygons,
    buildingsWithPolygons,
    campusMarkerData,
    currentBuildingForHTML,
    routeCoordinates,
    routeMode,
    shuttleWalkToCoords,
    shuttleDriveCoords,
    shuttleWalkFromCoords,
    userLat,
    userLng,
    serializedWebFrameTargetOrigin,
    webTransitSegments,
    defaultSgwRegion,
  ]);

  const webViewSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  const shouldUseWebFallback = Platform.OS === "web" || !MapViewComponent;

  useEffect(() => {
    if (Platform.OS !== "web") {
      setWebMapReady(false);
    }
  }, [mapHTML]);

  const renderWebMapContent = () => {
    if (Platform.OS === "web") {
      return (
        <iframe
          ref={webIframeRef}
          srcDoc={mapHTML}
          style={{ ...(StyleSheet.flatten(styles.map) as object), border: 0 }}
          allowFullScreen
          title="Concordia map"
          onLoad={() =>
            postToWebIframe({
              type: "focusBounds",
              bounds: campusBounds,
              campus,
              padding: [20, 20],
            })
          }
        />
      );
    }

    if (WebView) {
      return (
        <WebView
          testID="map-webview"
          ref={webViewRef}
          source={webViewSource}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          scalesPageToFit
          originWhitelist={["*"]}
          injectedJavaScriptBeforeContentLoaded={`
            window.ReactNativeWebView = {
              postMessage: function(data) {
                window.location.href = 'rnmsg://' + encodeURIComponent(data);
              }
            };
            true;
          `}
          onLoadEnd={() => setWebMapReady(true)}
          onShouldStartLoadWithRequest={(request: { url: string }) => {
            if (request.url.startsWith("rnmsg://")) {
              try {
                const data = JSON.parse(
                  decodeURIComponent(request.url.replace("rnmsg://", "")),
                );
                if (data?.type === "buildingSelected")
                  setSelectedBuilding(data.buildingCode);
                if (data?.type === "buildingDeselected")
                  setSelectedBuilding(null);
              } catch {}
              return false;
            }
            return true;
          }}
        />
      );
    }

    return null;
  };

  const webMapContent = renderWebMapContent();

  const nativeMapContent =
    MapViewComponent &&
    MapMarkerComponent &&
    MapCalloutComponent &&
    MapPolygonComponent ? (
      <MapViewComponent
        ref={mapRef}
        testID="map-native"
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setMapViewportRegion}
        showsUserLocation
        showsMyLocationButton
        onPress={() => setSelectedBuilding(null)}
      >
        {(() => {
          if (!MapPolylineComponent || !isDirectionsMode) return null;

          if (
            routeMode === "transit" &&
            transitItineraries[selectedItineraryIndex]
          ) {
            return (
              <>
                {transitItineraries[selectedItineraryIndex].legs.map(
                  (leg, index) => {
                    console.log(`Rendering leg ${index}:`, leg.mode);

                    if (!leg.legGeometry?.points) return null;

                    const precision = (leg.legGeometry as any)?.precision ?? 7;
                    const coordinates = decodePolyline(
                      leg.legGeometry.points,
                      precision,
                    );
                    if (coordinates.length < 2) return null;

                    const strokeColor = getTransitColor(leg.mode, leg.route);

                    const legKey = [
                      leg.mode ?? "unknown",
                      leg.route ?? "",
                      leg.from?.name ?? "",
                      leg.to?.name ?? "",
                      leg.legGeometry.points ?? "",
                    ].join("|");

                    return (
                      <MapPolylineComponent
                        key={legKey}
                        coordinates={coordinates}
                        strokeColor={strokeColor}
                        strokeWidth={leg.mode === "WALK" ? 4 : 6}
                        lineDashPattern={
                          leg.mode === "WALK" ? [2, 8] : undefined
                        }
                        lineCap="round"
                      />
                    );
                  },
                )}
              </>
            );
          }

          if (routeMode === "shuttle") {
            return (
              <>
                {shuttleWalkToCoords.length > 1 && (
                  <MapPolylineComponent
                    testID="route-polyline-shuttle-walk-to"
                    coordinates={shuttleWalkToCoords}
                    strokeColor="#2E7D32"
                    strokeWidth={6}
                    lineDashPattern={[2, 12]}
                    lineCap="round"
                  />
                )}
                {shuttleDriveCoords.length > 1 && (
                  <MapPolylineComponent
                    testID="route-polyline-shuttle-drive"
                    coordinates={shuttleDriveCoords}
                    strokeColor="#912338"
                    strokeWidth={6}
                    lineCap="round"
                  />
                )}
                {shuttleWalkFromCoords.length > 1 && (
                  <MapPolylineComponent
                    testID="route-polyline-shuttle-walk-from"
                    coordinates={shuttleWalkFromCoords}
                    strokeColor="#2E7D32"
                    strokeWidth={6}
                    lineDashPattern={[2, 12]}
                    lineCap="round"
                  />
                )}
              </>
            );
          }

          if (routeCoordinates.length > 1) {
            return (
              <MapPolylineComponent
                testID="route-polyline"
                coordinates={routeCoordinates}
                strokeColor="#1668C7"
                strokeWidth={routeMode === "walking" ? 6 : 5}
                lineDashPattern={routeMode === "walking" ? [1, 12] : undefined}
                lineCap="round"
              />
            );
          }

          return null;
        })()}

        {allPolygons.features.map((feature: any) => {
          const coordinates = feature.geometry.coordinates[0].map(
            (coord: number[]) => ({
              latitude: coord[1],
              longitude: coord[0],
            }),
          );

          const buildingCode = feature.properties.code;
          const isSelected = selectedBuilding === buildingCode;
          const isCurrent = currentBuilding === buildingCode;

          let strokeColor = "#A32638";
          let fillColor = "#A32638";
          let strokeWidth = 2;
          let fillOpacity = 0.2;

          if (isSelected) {
            strokeColor = "#238c51";
            fillColor = "#238c51";
            strokeWidth = 3;
            fillOpacity = 0.5;
          } else if (isCurrent) {
            strokeColor = "#FFA500";
            fillColor = "#FFA500";
            strokeWidth = 3;
            fillOpacity = 0.5;
          }

          return (
            <MapPolygonComponent
              key={buildingCode}
              testID={`polygon-${buildingCode}`}
              coordinates={coordinates}
              strokeColor={strokeColor}
              fillColor={fillColor}
              strokeWidth={strokeWidth}
              fillOpacity={fillOpacity}
              tappable
              onPress={() =>
                setSelectedBuilding(
                  selectedBuilding === buildingCode ? null : buildingCode,
                )
              }
            />
          );
        })}

        {visibleBuildingsWithPolygons.map((building) => {
          const hasExactPolygon = allPolygons.features.some(
            (f: any) => f.properties.code === building.code,
          );

          const polygonCode = hasExactPolygon
            ? building.code
            : allPolygons.features.find(
                (f: any) =>
                  building.code.startsWith(f.properties.code) &&
                  f.properties.code.length >= 2,
              )?.properties.code || building.code;

          return (
            <MapMarkerComponent
              key={building.code}
              testID={`marker-${building.code}`}
              identifier={`marker-${building.code}`}
              accessible
              accessibilityLabel={`marker-${building.code}`}
              accessibilityRole="button"
              coordinate={{
                latitude: building.latitude,
                longitude: building.longitude,
              }}
              onPress={() =>
                setSelectedBuilding(
                  selectedBuilding === polygonCode ? null : polygonCode,
                )
              }
            >
              <View
                style={styles.markerContainer}
                testID={`marker-view-${building.code}`}
                accessible
                accessibilityLabel={`marker-${building.code}`}
                accessibilityRole="button"
              >
                <View style={styles.markerBadge}>
                  <Text style={styles.markerText}>{building.code}</Text>
                </View>
                <View style={styles.markerStem} />
              </View>
            </MapMarkerComponent>
          );
        })}

        {showCampusSummaryMarkers &&
          campusMarkerData.map((campusMarker) => (
            <MapMarkerComponent
              key={`campus-marker-${campusMarker.campus}`}
              testID={`campus-marker-${campusMarker.campus}`}
              identifier={`campus-marker-${campusMarker.campus}`}
              accessible={false}
              accessibilityLabel={`campus-marker-${campusMarker.campus}`}
              coordinate={{
                latitude: campusMarker.latitude,
                longitude: campusMarker.longitude,
              }}
            >
              <View style={styles.campusMarkerContainer}>
                <View style={styles.campusMarkerBadge}>
                  <Text style={styles.campusMarkerText}>
                    {campusMarker.campus}
                  </Text>
                </View>
              </View>
            </MapMarkerComponent>
          ))}
      </MapViewComponent>
    ) : (
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackText}>
          Map view is unavailable in this environment.
        </Text>
      </View>
    );

  const searchInputRef = useRef<TextInput>(null);
  const hasIndoorRoute =
    indoorRoute === undefined ? undefined : indoorRoute !== null;

  return (
    <View style={styles.container}>
      <AppHeader
        campus={campus}
        onCampusChange={handleCampusChange}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        searchInputRef={searchInputRef}
      />

      {searchResults.length > 0 && (
        <View style={styles.searchResultsContainer} testID="search-results">
          <Text style={styles.searchResultsHint}>
            Tap a building to set destination (To).
          </Text>
          {searchResults.map((building) => (
            <Pressable
              key={building.code}
              testID={`search-result-${building.code}`}
              style={styles.searchResultItem}
              onPress={() => handleSearchResultPress(building)}
            >
              <Text style={styles.searchResultCode}>{building.code}</Text>
              <Text style={styles.searchResultName} numberOfLines={1}>
                {building.longName}
              </Text>
              <Text style={styles.searchResultAddress} numberOfLines={1}>
                {building.address}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <DirectionsPanel
        setSearchText={setSearchText}
        setEditingField={setEditingField}
        searchInputRef={searchInputRef}
        editingField={editingField}
        originBuilding={originBuilding}
        destinationBuilding={destinationBuilding}
        clearDirections={clearDirections}
        isDirectionsMode={isDirectionsMode}
        isSameCampus={isSameCampus}
        routeMode={routeMode}
        setRouteMode={setRouteMode}
        modeDurations={modeDurations}
        setRouteStarted={setRouteStarted}
        routeInstructionsDismissedRef={routeInstructionsDismissedRef}
        setShowRouteInstructions={setShowRouteInstructions}
        styles={styles}
        formatDuration={formatDuration}
        originRoom={originRoom}
        setOriginRoom={setOriginRoom}
        destinationRoom={destinationRoom}
        setDestinationRoom={setDestinationRoom}
        setActiveFloorPlan={setActiveFloorPlan}
        setFloorPlanModalVisible={setFloorPlanModalVisible}
        getRoomDetails={getRoomDetails}
        getFloorPlanAsset={getFloorPlanAsset}
        onShowIndoorDirections={() => setIndoorDirectionsModalVisible(true)}
        hasIndoorRoute={hasIndoorRoute}
      />

      {currentBuilding &&
        (() => {
          const building = BUILDINGS.find((b) => b.code === currentBuilding);
          return building ? (
            <View
              style={[
                styles.buildingInfo,
                !isWebPlatform && { top: insets.top + 44 },
              ]}
              testID="current-building-info"
            >
              <Text style={styles.buildingInfoTitle}>Current Building:</Text>
              <Text
                style={styles.buildingInfoText}
                testID="current-building-name"
              >
                {building.longName} ({building.shortName}) - [{building.code}]
              </Text>
            </View>
          ) : null;
        })()}

      {locationPermissionDenied && (
        <TouchableOpacity
          testID="location-permission-banner"
          style={[
            styles.permissionBanner,
            { bottom: insets.bottom + TAB_BAR_HEIGHT + 10 },
          ]}
          onPress={async () => {
            const { canAskAgain } =
              await Location.getForegroundPermissionsAsync();
            if (canAskAgain) {
              await requestLocationPermission();
            } else {
              await Linking.openSettings();
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.permissionText}>
            Enable location permissions to see where you are on campus. Tap
            here.
          </Text>
        </TouchableOpacity>
      )}

      {shouldUseWebFallback ? webMapContent : nativeMapContent}
      <Pressable
        testID="next-class-floating-button"
        style={styles.nextClassButton}
        onPress={handleNextClassDirections}
        disabled={nextClassLoading}
      >
        <Text style={styles.nextClassButtonText}>
          {nextClassLoading ? "…" : "Go to Next Class"}
        </Text>
      </Pressable>

      {nextClassMessage && (
        <View style={styles.nextClassAlert}>
          <Text style={styles.nextClassAlertText}>{nextClassMessage}</Text>
        </View>
      )}
      {showE2EHooks && (
        <View style={styles.e2eControls} pointerEvents="box-none">
          <TouchableOpacity
            testID="e2e-select-H"
            accessibilityLabel="e2e-select-H"
            accessibilityRole="button"
            style={styles.e2eButton}
            onPress={() => setSelectedBuilding("H")}
          >
            <Text style={styles.e2eButtonText}>H</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="e2e-select-SP"
            accessibilityLabel="e2e-select-SP"
            accessibilityRole="button"
            style={styles.e2eButton}
            onPress={() => setSelectedBuilding("SP")}
          >
            <Text style={styles.e2eButtonText}>SP</Text>
          </TouchableOpacity>
        </View>
      )}

      {isDirectionsMode &&
        showRouteInstructions &&
        (routeInstructions.length > 0 || routeMode === "shuttle") && (
          <RouteStepsPopup
            styles={styles}
            formatTime={formatTime}
            routeSheetPanResponder={routeSheetPanResponder}
            routeInstructionsDismissedRef={routeInstructionsDismissedRef}
            setShowRouteInstructions={setShowRouteInstructions}
            routeMode={routeMode}
            actualOriginPoint={actualOriginPoint}
            destinationBuilding={destinationBuilding}
            transitItineraries={transitItineraries}
            routeStarted={routeStarted}
            selectedItineraryIndex={selectedItineraryIndex}
            expandedItineraries={expandedItineraries}
            setSelectedItineraryIndex={setSelectedItineraryIndex}
            setRouteDurationMinutes={setRouteDurationMinutes}
            setRouteDistanceMeters={setRouteDistanceMeters}
            setRouteInstructions={setRouteInstructions}
            setExpandedItineraries={setExpandedItineraries}
            expandedIntermediateStops={expandedIntermediateStops}
            setExpandedIntermediateStops={setExpandedIntermediateStops}
            routeInstructions={routeInstructions}
          />
        )}

      {isDirectionsMode &&
        !showRouteInstructions &&
        (routeInstructions.length > 0 || routeMode === "shuttle") && (
          <Pressable
            {...routeSheetPanResponder.panHandlers}
            style={styles.routeStepsCollapsedTab}
            testID="route-steps-collapsed-tab"
            onPress={() => {
              routeInstructionsDismissedRef.current = false;
              setShowRouteInstructions(true);
            }}
          >
            <ChevronUp size={24} color="#1F1F24" strokeWidth={2.5} />
          </Pressable>
        )}

      <BuildingInformation
        buildingCode={selectedBuilding}
        onClose={() => setSelectedBuilding(null)}
        buildingName={buildingName}
        buildingInfo={buildingInfo}
        buildingPhotoLink={buildingPhotoLink}
        editingField={editingField}
        onSelectDestination={(code: string) => {
          if (editingField === "from") {
            originModeRef.current = "manual";
            setOriginBuildingCode(code);
          } else {
            setDestinationBuildingCode(code);
            setIsDirectionsMode(true);
          }
          setSelectedBuilding(null);
          setEditingField(undefined);
        }}
      />
      <Modal
        visible={floorPlanModalVisible}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setFloorPlanModalVisible(false)}
            >
              <X size={24} color="#1F1F24" strokeWidth={2.5} />
            </Pressable>

            {activeFloorPlan && (
              typeof activeFloorPlan === "number" ? (
                <Image
                  source={activeFloorPlan}
                  style={styles.floorPlanImage}
                  resizeMode="contain"
                />
              ) : (
                (() => {
                  const FloorPlanComponent =
                    activeFloorPlan as React.ComponentType<{
                      width?: string | number;
                      height?: string | number;
                    }>;
                  return (
                    <Svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 1024 1024"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <FloorPlanComponent width={1024} height={1024} />
                    </Svg>
                  );
                })()
              )
            )}
          </View>
        </View>
      </Modal>

      <IndoorDirectionsModal
        visible={indoorDirectionsModalVisible}
        onClose={() => setIndoorDirectionsModalVisible(false)}
        route={indoorRoute ?? null}
        buildingCode={
          originBuilding?.code ?? destinationBuilding?.code ?? ""
        }
        originRoom={originRoom}
        destinationRoom={destinationRoom}
        floorBounds={(floor) =>
          getFloorBounds(
            originBuilding?.code ?? destinationBuilding?.code ?? "",
            floor,
          )
        }
        graphFloorBounds={(floor) =>
          getGraphFloorBounds(
            originBuilding?.code ?? destinationBuilding?.code ?? "",
            floor,
          )
        }
      />
    </View>
  );
}
