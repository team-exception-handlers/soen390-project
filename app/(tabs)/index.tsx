import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { ChevronUp, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Image,
    Keyboard,
    Linking,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
    type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import AppHeader from "../../components/AppHeader";
import BuildingInformation from "../../components/BuildingInformation";
import IndoorDirectionsModal from "../../components/IndoorDirectionsModal";
import CurrentBuildingBanner from "../../components/mapScreen/CurrentBuildingBanner";
import DirectionsPanel from "../../components/mapScreen/DirectionsPanel";
import LocationPermissionBanner from "../../components/mapScreen/LocationPermissionBanner";
import NativeCampusMap from "../../components/mapScreen/NativeCampusMap";
import RouteStepsPopup from "../../components/mapScreen/RouteStepsPopup";
import WebCampusMap from "../../components/mapScreen/WebCampusMap";
import {
    buildingHasPolygon,
    formatDuration,
    getBoundsFromRegion,
    getDistanceBetweenCoordsMeters,
    getFloorPlanAsset,
    getPinVisibilityMode,
    resolveBuildingByCode,
    roundCoord,
    shouldShowBuildingPin,
    type FloorPlanAsset,
} from "../../components/mapScreen/mapScreen.helpers";
import { BUILDINGS, type BuildingRecord, type Campus } from "../../constants/buildings";
import LOY_POLYGONS from "../../constants/maps/outdoor/LOY-polygons";
import SGW_POLYGONS from "../../constants/maps/outdoor/SGW-polygons";
import { useMapRouteState } from "../../hooks/useMapRouteState";
import { useUserCampusLocation } from "../../hooks/useUserCampusLocation";
import { createMapScreenStyles } from "../../styles/mapScreen.styles";
import type { MapBounds, RouteMode } from "../../types/map";
import { parseLocationParts } from "../../utils/classLocation";
import {
    getFloorPlanLabelForKey,
    getFloorPlanOptionsForBuilding,
} from "../../utils/floorPlanCatalog";
import { getToken } from "../../utils/googleCalendarAuth";
import { fetchNextConcordiaClassToday } from "../../utils/googleCalendarNextClass";
import {
    findIndoorRoute,
    findIndoorRouteToNodeId,
    getFloorBounds,
    getGraphFloorBounds,
    getSpecialNodesForFloor,
    type IndoorRoute,
    type SpecialFloorNode,
} from "../../utils/indoorDirections";
import { getCampusRegion } from "../../utils/mapRegions";
import { fetchOsrmRoute } from "../../utils/osrmDirections";

import POISearchPanel from "../../components/POISearchPanel";
import {
    requestLocationPermission
} from "../../utils/locationUtils";
import type { POIResult } from "../../utils/poiSearch";
import {
    getRoomDetails,
    getRoomsForBuilding,
    roomLabelMatchesSearchPrefix,
} from "../../utils/roomUtils";
import {
    calculateOsrmRouteHelper,
    calculateShuttleRouteHelper,
    calculateTransitRouteHelper,
} from "../../utils/routeCalculators";
import {
    fetchTransitItineraries,
    formatTime
} from "../../utils/transitousDirections";
import {
    findNearestWashroomTarget,
    type WashroomCategory
} from "../../utils/washroomSearch";

const parseFloorPlanKey = (key: string): { building: string; floor: number } | null => {
  const match = key.match(/^([A-Z]+)-(-?\d+)$/);
  if (!match) return null;
  const building = match[1];
  const floor = parseInt(match[2], 10);
  return { building, floor };
};

const SPECIAL_NODE_COLORS: Record<string, { fill: string; label: string }> = {
  bathroom: { fill: "#2196F3", label: "Bathroom" },
  stairs: { fill: "#FF9800", label: "Stairs" },
  elevator: { fill: "#F44336", label: "Elevator" },
  escalator: { fill: "#4CAF50", label: "Escalator" },
};

const DEFAULT_START_BUILDING_CODE = "H";
const DEFAULT_DESTINATION_BUILDING_CODE = "EV";
const ROUTE_RECALC_MIN_DISTANCE_METERS = 25;

export default function MapScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const [floorPlanModalOptions, setFloorPlanModalOptions] = useState<
    { key: string; label: string }[]
  >([]);
  const [selectedFloorPlanKey, setSelectedFloorPlanKey] = useState<string | null>(
    null,
  );
  const { toBuilding, toRoom } = useLocalSearchParams<{
    toBuilding?: string;
    toRoom?: string;
  }>();

  const [editingField, setEditingField] = useState<"from" | "to" | undefined>(
    undefined,
  );
  const [floorPlanModalVisible, setFloorPlanModalVisible] = useState(false);
  const [activeFloorPlan, setActiveFloorPlan] = useState<FloorPlanAsset>(null);
  const [selectedFloorPlanNode, setSelectedFloorPlanNode] = useState<SpecialFloorNode | null>(null);
  const [floorPlanDirectionsFromRoom, setFloorPlanDirectionsFromRoom] = useState("");
  const [floorPlanDirectionsPromptVisible, setFloorPlanDirectionsPromptVisible] = useState(false);
  const [indoorDirectionsTargetNodeId, setIndoorDirectionsTargetNodeId] = useState<string | undefined>(undefined);
  const [pendingIndoorNode, setPendingIndoorNode] = useState<SpecialFloorNode | null>(null);
  const [pendingIndoorFloorKey, setPendingIndoorFloorKey] = useState<string | null>(null);
  const [campus, setCampus] = useState<Campus>("SGW");
  const [searchText, setSearchText] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [destinationBuildingCode, setDestinationBuildingCode] =
    useState<string>(DEFAULT_DESTINATION_BUILDING_CODE);
  const [originBuildingCode, setOriginBuildingCode] = useState<string | null>(
    null,
  );
  const [originRoom, setOriginRoom] = useState("");
  const [destinationRoom, setDestinationRoom] = useState("");
  const [focusedRoom, setFocusedRoom] = useState<"from" | "to" | null>(null);
  const [isDirectionsMode, setIsDirectionsMode] = useState(false);
  const [indoorRoute, setIndoorRoute] = useState<IndoorRoute | null | undefined>(
    undefined,
  );
  const [indoorDirectionsModalVisible, setIndoorDirectionsModalVisible] =
    useState(false);
  const [routeMode, setRouteMode] = useState<RouteMode>("walking");
  const [modeDurations, setModeDurations] = useState<
    Record<string, number | null>
  >({
    walking: null,
    driving: null,
    transit: null,
  });
  const [nextClassLoading, setNextClassLoading] = useState(false);
  const [nextClassMessage, setNextClassMessage] = useState<string | null>(null);
  const [hasCalendarToken, setHasCalendarToken] = useState(false);
  const [directionsPanelBottom, setDirectionsPanelBottom] = useState(0);
  const [mapViewportRegion, setMapViewportRegion] = useState(() =>
    getCampusRegion("SGW", SGW_POLYGONS.features),
  );
  const [focusedBounds, setFocusedBounds] = useState<MapBounds>(() =>
    getBoundsFromRegion(getCampusRegion("SGW", SGW_POLYGONS.features)),
  );
  const [mapFocusRequestKey, setMapFocusRequestKey] = useState(0);

  const mapRef = useRef<any>(null);
  const searchInputRef = useRef<TextInput>(null);

  const {
    state: routeState,
    actions: routeActions,
    routeInstructionsDismissedRef,
  } = useMapRouteState();

  const {
    userLocation,
    currentBuilding,
    locationPermissionDenied,
    setOriginMode,
    restoreAutoOriginFromCurrentLocation,
  } = useUserCampusLocation({
    campus,
    setCampus,
    setOriginBuildingCode,
    defaultOriginBuildingCode: DEFAULT_START_BUILDING_CODE,
  });

  useEffect(() => {
    if (typeof toBuilding === "string" && toBuilding.trim()) {
      setDestinationBuildingCode(toBuilding.trim().toUpperCase());
      setIsDirectionsMode(true);
    }

    if (typeof toRoom === "string") {
      setDestinationRoom(toRoom.trim());
    }
  }, [toBuilding, toRoom]);

  const routeSheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 24) {
          routeActions.hideInstructions();
          return;
        }
        if (gestureState.dy < -24) {
          routeActions.showInstructions();
        }
      },
    }),
  ).current;

  const webViewRef = useRef<any>(null);
  const [webMapReady, setWebMapReady] = useState(false);
  const locationSubscription = useRef<any>(null);
  const campusRef = useRef<Campus>(campus);
  const originModeRef = useRef<"auto" | "manual">("auto");
  const hasInitializedCampusFromLocationRef = useRef(false);
  const [showPOIPanel, setShowPOIPanel] = useState(false);
  const [poiResults, setPOIResults] = useState<POIResult[]>([]);
  const [destinationPOI, setDestinationPOI] = useState<POIResult | null>(null);
  const [washroomPickerBuilding, setWashroomPickerBuilding] = useState<
    string | null
  >(null);

  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const isWebPlatform = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 56;

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
      webViewRef.current?.contentWindow?.postMessage(
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
    getToken().then((token) => setHasCalendarToken(token !== null));
  }, []);

  useEffect(() => {
    if (!nextClassMessage) return;

    const timeout = setTimeout(() => {
      setNextClassMessage(null);
    }, 4000);

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
    [insets.bottom, insets.top, isWebPlatform],
  );
  const routeStepsPopupMaxHeight = useMemo(() => {
    const preferredMaxHeight = isWebPlatform ? 360 : 300;
    if (!directionsPanelBottom) return preferredMaxHeight;

    const popupBottomOffset = insets.bottom + TAB_BAR_HEIGHT + 10;
    const gapBelowDirectionsPanel = 12;
    const availableHeight =
      windowHeight -
      directionsPanelBottom -
      popupBottomOffset -
      gapBelowDirectionsPanel;

    return Math.max(140, Math.min(preferredMaxHeight, availableHeight));
  }, [directionsPanelBottom, insets.bottom, isWebPlatform, windowHeight]);

  const handleDirectionsPanelLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      setDirectionsPanelBottom(y + height);
    },
    [],
  );

  const focusMapRegion = useCallback(
    (nextRegion: typeof mapViewportRegion) => {
      setMapViewportRegion(nextRegion);
      setFocusedBounds(getBoundsFromRegion(nextRegion));
      setMapFocusRequestKey((value) => value + 1);
      if (!isWebPlatform && mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(nextRegion, 450);
      }
    },
    [isWebPlatform],
  );

  const clearRoomInputs = useCallback(() => {
    setOriginRoom("");
    setDestinationRoom("");
  }, []);

  const handleCampusChange = useCallback(
    (nextCampus: Campus) => {
      setCampus(nextCampus);
      setSearchText("");
      setSelectedBuilding(null);
      focusMapRegion(
        getCampusRegion(
          nextCampus,
          nextCampus === "SGW" ? SGW_POLYGONS.features : LOY_POLYGONS.features,
        ),
      );
    },
    [focusMapRegion],
  );

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
    if (originBuildingCode) {
      const building = BUILDINGS.find((value) => value.code === originBuildingCode);
      if (building) {
        return { latitude: building.latitude, longitude: building.longitude };
      }
    }

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
  const [routingOriginPoint, setRoutingOriginPoint] = useState(actualOriginPoint);
  const previousAutoRoutingOriginRef = useRef<{
    point: { latitude: number; longitude: number } | null;
    currentBuildingCode: string | null | undefined;
  }>({
    point: null,
    currentBuildingCode: undefined,
  });

  useEffect(() => {
    if (!actualOriginPoint) {
      previousAutoRoutingOriginRef.current = {
        point: null,
        currentBuildingCode: currentBuilding,
      };
      setRoutingOriginPoint(null);
      return;
    }

    if (originBuildingCode) {
      previousAutoRoutingOriginRef.current = {
        point: null,
        currentBuildingCode: currentBuilding,
      };
      setRoutingOriginPoint((previous) =>
        previous?.latitude === actualOriginPoint.latitude &&
        previous?.longitude === actualOriginPoint.longitude
          ? previous
          : actualOriginPoint,
      );
      return;
    }

    const previousAutoOrigin = previousAutoRoutingOriginRef.current;
    const shouldKeepPreviousOrigin =
      previousAutoOrigin.point &&
      previousAutoOrigin.currentBuildingCode === currentBuilding &&
      getDistanceBetweenCoordsMeters(
        previousAutoOrigin.point,
        actualOriginPoint,
      ) < ROUTE_RECALC_MIN_DISTANCE_METERS;

    if (shouldKeepPreviousOrigin) {
      return;
    }

    previousAutoRoutingOriginRef.current = {
      point: actualOriginPoint,
      currentBuildingCode: currentBuilding,
    };
    setRoutingOriginPoint((previous) =>
      previous?.latitude === actualOriginPoint.latitude &&
      previous?.longitude === actualOriginPoint.longitude
        ? previous
        : actualOriginPoint,
    );
  }, [actualOriginPoint, currentBuilding, originBuildingCode]);

  const destinationBuilding = useMemo(
    () => resolveBuildingByCode(destinationBuildingCode, BUILDINGS),
    [destinationBuildingCode],
  );
  const originBuilding = useMemo(
    () => resolveBuildingByCode(originBuildingCode, BUILDINGS),
    [originBuildingCode],
  );
  const selectedBuildingRecord = useMemo(
    () => BUILDINGS.find((building) => building.code === selectedBuilding) ?? null,
    [selectedBuilding],
  );
  const currentBuildingRecord = useMemo(
    () => BUILDINGS.find((building) => building.code === currentBuilding) ?? null,
    [currentBuilding],
  );

  const isSameCampus = useMemo(() => {
    if (!originBuilding || !destinationBuilding) return true;
    return originBuilding.campus === destinationBuilding.campus;
  }, [destinationBuilding, originBuilding]);

  const roomSuggestions = useMemo(() => {
    if (!focusedRoom) return [];
    const building = focusedRoom === "from" ? originBuilding : destinationBuilding;
    if (!building) return [];

    const currentRoom = (
      focusedRoom === "from" ? originRoom : destinationRoom
    )
      .trim()
      .toLowerCase();
    const allRooms = getRoomsForBuilding(building.code);

    if (!currentRoom) return allRooms.slice(0, 10);

    return allRooms
      .filter((room) =>
        roomLabelMatchesSearchPrefix(building.code, room, currentRoom),
      )
      .slice(0, 10);
  }, [destinationBuilding, destinationRoom, focusedRoom, originBuilding, originRoom]);

  useEffect(() => {
    if (isSameCampus) setRouteMode("walking");
  }, [isSameCampus]);

  useEffect(() => {
    // Skip room-to-room recalculation when routing to a specific node (e.g. washroom, stairs)
    if (indoorDirectionsTargetNodeId) return;

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

    setIndoorRoute(
      findIndoorRoute(originCode, trimmedOriginRoom, trimmedDestinationRoom),
    );
  }, [destinationBuilding, destinationRoom, originBuilding, originRoom, indoorDirectionsTargetNodeId]);

  const resolvedDestination = useMemo(() => {
    if (destinationPOI) {
      return {
        latitude: destinationPOI.latitude,
        longitude: destinationPOI.longitude,
      };
    }
    return destinationBuilding;
  }, [destinationPOI, destinationBuilding]);

  useEffect(() => {
    if (!resolvedDestination || !routingOriginPoint) {
      setModeDurations({ walking: null, driving: null, transit: null });
      return;
    }

    let cancelled = false;

    const loadDurations = async () => {
      const walkOrBikeProfile = isSameCampus ? "walking" : "cycling";
      const [walkOrBike, drive] = await Promise.allSettled([
        fetchOsrmRoute(routingOriginPoint, resolvedDestination, walkOrBikeProfile),
        fetchOsrmRoute(routingOriginPoint, resolvedDestination, "driving"),
      ]);

      if (cancelled) return;

      setModeDurations((previous) => ({
        ...previous,
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
          const itineraries = await fetchTransitItineraries(
            routingOriginPoint,
            resolvedDestination,
          );
          if (!cancelled) {
            setModeDurations((previous) => ({
              ...previous,
              transit: itineraries[0]
                ? Math.round(itineraries[0].durationSeconds / 60)
                : null,
            }));
          }
        } catch {
          if (!cancelled) {
            setModeDurations((previous) => ({ ...previous, transit: null }));
          }
        }
      }
    };

    loadDurations();

    return () => {
      cancelled = true;
    };
  }, [isSameCampus, resolvedDestination, routingOriginPoint]);

  const exitDirectionsMode = useCallback(() => {
    setIsDirectionsMode(false);
    setDestinationPOI(null);
    setPendingIndoorNode(null);
    setPendingIndoorFloorKey(null);
    routeActions.resetAll();
  }, [routeActions]);

  const setDestinationAndEnterDirectionsMode = useCallback(
    (
      building: string | null,
      room?: string | null,
      clearInputs = true,
    ) => {
      if (!building) return;
      setDestinationBuildingCode(building);
      setDestinationRoom(room ?? "");
      setIsDirectionsMode(true);
      setEditingField(undefined);
      if (clearInputs) {
        setSelectedBuilding(null);
        setSearchText("");
      }
      routeInstructionsDismissedRef.current = false;
      routeActions.showInstructions();
      setDestinationPOI(null);

      const destinationRecord = resolveBuildingByCode(building, BUILDINGS);
      if (destinationRecord && destinationRecord.campus !== campus) {
        setCampus(destinationRecord.campus);
      }
    },
    [campus, routeActions, routeInstructionsDismissedRef],
  );

  const handlePOIPress = useCallback(
    (poi: POIResult) => {
      // Indoor washroom POIs: show male/female picker
      if (poi.id.startsWith("indoor-wc-")) {
        const buildingCode = poi.id.replace("indoor-wc-", "");
        setWashroomPickerBuilding(buildingCode);
        return;
      }

      setDestinationPOI(poi);
      setDestinationBuildingCode("");
      setDestinationRoom("");
      setIsDirectionsMode(true);
      setEditingField(undefined);
      setSelectedBuilding(null);
      setSearchText("");
      setShowPOIPanel(false);
      routeInstructionsDismissedRef.current = false;
      routeActions.showInstructions();
    },
    [routeActions, routeInstructionsDismissedRef],
  );

  const handleWashroomPickerSelect = useCallback(
    (category: WashroomCategory) => {
      if (!washroomPickerBuilding) return;
      const target = findNearestWashroomTarget(category, {
        campusBuildings,
        actualOriginPoint,
        originBuildingCode: originBuildingCode,
        originRoom,
        destinationBuildingCode: washroomPickerBuilding,
        destinationRoom: "",
      });
      setWashroomPickerBuilding(null);
      setShowPOIPanel(false);
      setPOIResults([]);
      if (target) {
        setDestinationAndEnterDirectionsMode(
          target.building.code,
          target.roomLabel,
          true,
        );
      }
    },
    [
      washroomPickerBuilding,
      campusBuildings,
      actualOriginPoint,
      originBuildingCode,
      originRoom,
    ],
  );

  const animateMapToRegion = useCallback(
    (region: any, targetCampus: Campus) => {
      setMapViewportRegion(region);

      if (!isWebPlatform) {
        mapRef.current?.animateToRegion?.(region, 450);
      }

      if (Platform.OS === "web") {
        const minLat = region.latitude - region.latitudeDelta / 2;
        const maxLat = region.latitude + region.latitudeDelta / 2;
        const minLng = region.longitude - region.longitudeDelta / 2;
        const maxLng = region.longitude + region.longitudeDelta / 2;
        postToWebIframe({
          type: "focusBounds",
          bounds: [[minLat, minLng], [maxLat, maxLng]],
          campus: targetCampus,
          padding: [20, 20],
        });
      }

      setCampus(targetCampus);
    },
    [isWebPlatform, postToWebIframe],
  );

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

      const className = nextEvent.summary ?? "your next class";
      const location = room ? `${building}-${room}` : building;

      setDestinationAndEnterDirectionsMode(building, room);
      setNextClassMessage(`Directions set to ${className} (${location}).`);
    } catch (error) {
      console.error("Failed to get next class directions:", error);
      setNextClassMessage("Could not load your next class.");
    } finally {
      setNextClassLoading(false);
    }
  }, [campus, routeActions]);

  const clearDirections = useCallback(() => {
    setSearchText("");
    setSelectedBuilding(null);

    if (!isDirectionsMode) {
      routeActions.resetDismissed();
      setIsDirectionsMode(true);
      return;
    }

    exitDirectionsMode();
    const restoredCampus = restoreAutoOriginFromCurrentLocation();
    const mapCampus = restoredCampus ?? campus;
    const polygons =
      mapCampus === "SGW" ? SGW_POLYGONS.features : LOY_POLYGONS.features;
    focusMapRegion(getCampusRegion(mapCampus, polygons));
  }, [
    campus,
    exitDirectionsMode,
    focusMapRegion,
    isDirectionsMode,
    restoreAutoOriginFromCurrentLocation,
    routeActions,
  ]);

  const searchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];
    return BUILDINGS.filter((building) => {
      const haystack = [
        building.code,
        building.shortName,
        building.longName,
        building.address,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }).slice(0, 8);
  }, [searchText]);

  const washroomSearchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const isWashroomQuery =
      query.includes("washroom") || query.includes("bathroom");
    if (!isWashroomQuery) return [];

    const washroomParams = {
      campusBuildings,
      actualOriginPoint,
      originBuildingCode: originBuilding?.code ?? null,
      originRoom,
      destinationBuildingCode: destinationBuilding?.code ?? null,
      destinationRoom,
    };

    const maleWashroomTarget = findNearestWashroomTarget(
      "male_washroom",
      washroomParams,
    );
    const femaleWashroomTarget = findNearestWashroomTarget(
      "female_washroom",
      washroomParams,
    );

    return [
      maleWashroomTarget
        ? {
          key: "nearest-male-washroom",
          label: "Nearest male washroom",
          building: maleWashroomTarget.building,
          roomLabel: maleWashroomTarget.roomLabel,
        }
        : null,
      femaleWashroomTarget
        ? {
          key: "nearest-female-washroom",
          label: "Nearest female washroom",
          building: femaleWashroomTarget.building,
          roomLabel: femaleWashroomTarget.roomLabel,
        }
        : null,
    ].filter((result): result is {
      key: string;
      label: string;
      building: BuildingRecord;
      roomLabel: string;
    } => result !== null);
  }, [
    actualOriginPoint,
    campusBuildings,
    destinationBuilding?.code,
    destinationRoom,
    originBuilding?.code,
    originRoom,
    searchText,
  ]);

  const handleSearchResultPress = useCallback((building: BuildingRecord) => {
    if (building.campus !== campus) {
      handleCampusChange(building.campus);
    }
    setSelectedBuilding(building.code);
    setSearchText("");
    Keyboard.dismiss();
  }, [campus, handleCampusChange]);

  useEffect(() => {
    setSearchText("");
    setSelectedBuilding(null);
  }, [campusBuildings]);

  useEffect(() => {
    if (!isDirectionsMode || !resolvedDestination || !routingOriginPoint) {
      routeActions.resetAll();
      return;
    }

    let cancelled = false;

    const fetchRoute = async () => {
      if (routeMode === "shuttle") {
        return calculateShuttleRouteHelper(
          routingOriginPoint,
          resolvedDestination,
          routeState.selectedShuttleDeparture,
        );
      }
      if (routeMode === "transit") {
        return calculateTransitRouteHelper(routingOriginPoint, resolvedDestination);
      }
      return calculateOsrmRouteHelper(
        routingOriginPoint,
        resolvedDestination,
        routeMode,
        isSameCampus,
      );
    };

    const loadRoute = async () => {
      routeActions.resetGeometry();
      routeActions.setRouteLoading(true);

      try {
        const result = await fetchRoute();
        if (cancelled || !result) return;

        routeActions.applyRouteResult(result, {
          routeMode,
          showInstructions: routeActions.shouldShowInstructionsForResult(result),
        });
      } catch {
        if (!cancelled) {
          routeActions.resetAll();
          clearRoomInputs();
        }
      } finally {
        routeActions.setRouteLoading(false);
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [
    isDirectionsMode,
    resolvedDestination,
    routingOriginPoint,
    clearRoomInputs,
    destinationBuilding,
    isDirectionsMode,
    isSameCampus,
    routeActions,
    routeMode,
    routeState.selectedShuttleDeparture,
  ]);

  const buildingsWithPolygons = useMemo(
    () =>
      BUILDINGS.filter((building) =>
        buildingHasPolygon(building, allPolygons.features),
      ),
    [allPolygons.features],
  );

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

  useEffect(() => {
    if (isDirectionsMode) return;
    focusMapRegion(region);
  }, [focusMapRegion, isDirectionsMode, region]);

  const shouldUseWebFallback = Platform.OS === "web" || isExpoGo;
  const routeContentAvailable =
    routeState.routeInstructions.length > 0 ||
    routeState.routeCoordinates.length > 0 ||
    routeMode === "shuttle";
  const hasIndoorRoute =
    indoorRoute === undefined ? undefined : indoorRoute !== null;
  const selectedBuildingFloorPlans = useMemo(
    () => getFloorPlanOptionsForBuilding(selectedBuilding),
    [selectedBuilding],
  );

  const openFloorPlanModal = useCallback((floorKey: string) => {
    setFloorPlanModalOptions([
      { key: floorKey, label: getFloorPlanLabelForKey(floorKey) },
    ]);
    setSelectedFloorPlanKey(floorKey);
    setActiveFloorPlan(getFloorPlanAsset(floorKey));
    setFloorPlanModalVisible(true);
  }, []);

  const openBuildingFloorPlansFromMap = useCallback(() => {
    if (!selectedBuilding) return;
    const opts = getFloorPlanOptionsForBuilding(selectedBuilding);
    if (opts.length === 0) return;
    setFloorPlanModalOptions([...opts]);
    setSelectedFloorPlanKey(opts[0].key);
    setActiveFloorPlan(getFloorPlanAsset(opts[0].key));
    setFloorPlanModalVisible(true);
  }, [selectedBuilding]);

  const closeFloorPlanModal = useCallback(() => {
    setFloorPlanModalVisible(false);
    setFloorPlanModalOptions([]);
    setSelectedFloorPlanKey(null);
    setSelectedFloorPlanNode(null);
    setFloorPlanDirectionsPromptVisible(false);
    setFloorPlanDirectionsFromRoom("");
  }, []);

  const handleFloorPlanNodePress = useCallback((node: SpecialFloorNode) => {
    setSelectedFloorPlanNode((prev) => (prev?.id === node.id ? null : node));
    setFloorPlanDirectionsPromptVisible(false);
    setFloorPlanDirectionsFromRoom("");
  }, []);

  const launchIndoorDirectionsFromFloorPlan = useCallback(
    (fromRoom: string, node: SpecialFloorNode, floorKey: string) => {
      const parsedKey = parseFloorPlanKey(floorKey);
      if (!parsedKey) return;

      const route = findIndoorRouteToNodeId(
        parsedKey.building,
        fromRoom,
        node.id,
      );

      setIndoorRoute(route);
      setOriginRoom(fromRoom);
      const destLabel = node.category === "male_washroom"
        ? "Men's Washroom"
        : node.category === "female_washroom"
          ? "Women's Washroom"
          : SPECIAL_NODE_COLORS[node.type]?.label ?? node.type;
      setDestinationRoom(destLabel);
      setIndoorDirectionsTargetNodeId(node.id);

      // Close floor plan modal and open indoor directions modal
      setFloorPlanModalVisible(false);
      setFloorPlanModalOptions([]);
      setSelectedFloorPlanKey(null);
      setSelectedFloorPlanNode(null);
      setFloorPlanDirectionsPromptVisible(false);
      setFloorPlanDirectionsFromRoom("");

      const buildingCode = parsedKey.building;
      const buildingRecord = BUILDINGS.find((b) => b.code === buildingCode);
      if (buildingRecord) {
        setOriginBuildingCode(buildingCode);
      }

      setIndoorDirectionsModalVisible(true);
    },
    [],
  );

  const handleFloorPlanGetDirections = useCallback(() => {
    if (!selectedFloorPlanNode || !selectedFloorPlanKey) return;
    const parsedKey = parseFloorPlanKey(selectedFloorPlanKey);
    if (!parsedKey) return;

    // If user is NOT in the same building
    if (originBuildingCode !== parsedKey.building) {
      // If origin building has room data, let user pick a starting room first
      if (originBuildingCode && getRoomsForBuilding(originBuildingCode).length > 0) {
        if (originRoom.trim()) {
          setFloorPlanDirectionsFromRoom(originRoom.trim());
        }
        setFloorPlanDirectionsPromptVisible(true);
        return;
      }
      // No room data — save pending indoor destination and navigate outdoors
      setPendingIndoorNode(selectedFloorPlanNode);
      setPendingIndoorFloorKey(selectedFloorPlanKey);
      setFloorPlanModalVisible(false);
      setFloorPlanModalOptions([]);
      setSelectedFloorPlanKey(null);
      setSelectedFloorPlanNode(null);
      setFloorPlanDirectionsPromptVisible(false);
      setFloorPlanDirectionsFromRoom("");
      setDestinationAndEnterDirectionsMode(parsedKey.building);
      return;
    }

    // User is in the same building — show the room prompt (pre-fill if origin room is set)
    if (originRoom.trim()) {
      setFloorPlanDirectionsFromRoom(originRoom.trim());
    }
    setFloorPlanDirectionsPromptVisible(true);
  }, [selectedFloorPlanNode, selectedFloorPlanKey, originRoom, originBuildingCode, launchIndoorDirectionsFromFloorPlan, setDestinationAndEnterDirectionsMode]);

  // Determine which building the room prompt targets (origin building when cross-building, otherwise floor plan building)
  const floorPlanPromptBuilding = useMemo(() => {
    if (!selectedFloorPlanKey) return null;
    const parsedKey = parseFloorPlanKey(selectedFloorPlanKey);
    if (!parsedKey) return null;
    if (originBuildingCode && originBuildingCode !== parsedKey.building && getRoomsForBuilding(originBuildingCode).length > 0) {
      return originBuildingCode;
    }
    return parsedKey.building;
  }, [selectedFloorPlanKey, originBuildingCode]);

  const floorPlanRoomSuggestions = useMemo(() => {
    if (!floorPlanDirectionsPromptVisible || !floorPlanPromptBuilding) return [];
    const allRooms = getRoomsForBuilding(floorPlanPromptBuilding);
    const query = floorPlanDirectionsFromRoom.trim().toLowerCase();
    if (!query) return allRooms.slice(0, 10);
    return allRooms
      .filter((room) => roomLabelMatchesSearchPrefix(floorPlanPromptBuilding, room, query))
      .slice(0, 10);
  }, [floorPlanDirectionsPromptVisible, floorPlanPromptBuilding, floorPlanDirectionsFromRoom]);

  const handleFloorPlanDirectionsGo = useCallback(() => {
    if (!selectedFloorPlanNode || !selectedFloorPlanKey || !floorPlanDirectionsFromRoom.trim()) return;
    const parsedKey = parseFloorPlanKey(selectedFloorPlanKey);
    if (!parsedKey) return;

    // Cross-building: save pending indoor destination, set origin room, and redirect to outdoor directions
    if (originBuildingCode !== parsedKey.building) {
      setPendingIndoorNode(selectedFloorPlanNode);
      setPendingIndoorFloorKey(selectedFloorPlanKey);
      setOriginRoom(floorPlanDirectionsFromRoom.trim());
      setFloorPlanModalVisible(false);
      setFloorPlanModalOptions([]);
      setSelectedFloorPlanKey(null);
      setSelectedFloorPlanNode(null);
      setFloorPlanDirectionsPromptVisible(false);
      setFloorPlanDirectionsFromRoom("");
      setDestinationAndEnterDirectionsMode(parsedKey.building);
      return;
    }

    launchIndoorDirectionsFromFloorPlan(
      floorPlanDirectionsFromRoom.trim(),
      selectedFloorPlanNode,
      selectedFloorPlanKey,
    );
  }, [selectedFloorPlanNode, selectedFloorPlanKey, floorPlanDirectionsFromRoom, originBuildingCode, launchIndoorDirectionsFromFloorPlan, setDestinationAndEnterDirectionsMode]);

  // When user physically arrives at the building with a pending indoor destination, launch indoor directions
  useEffect(() => {
    if (!pendingIndoorNode || !pendingIndoorFloorKey || !currentBuilding) return;
    const parsedKey = parseFloorPlanKey(pendingIndoorFloorKey);
    if (!parsedKey || currentBuilding !== parsedKey.building) return;

    const node = pendingIndoorNode;
    const floorKey = pendingIndoorFloorKey;
    setPendingIndoorNode(null);
    setPendingIndoorFloorKey(null);

    // Find the nearest entrance/lobby as starting point
    const defaultRoom = originRoom.trim() || "entrance";
    launchIndoorDirectionsFromFloorPlan(defaultRoom, node, floorKey);
  }, [currentBuilding, pendingIndoorNode, pendingIndoorFloorKey, originRoom, launchIndoorDirectionsFromFloorPlan]);

  return (
    <View style={styles.container}>
      <AppHeader
        campus={campus}
        onCampusChange={handleCampusChange}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        searchInputRef={searchInputRef}
      />

      {showPOIPanel && (
        <POISearchPanel
          userLocation={actualOriginPoint}
          onResultsChange={setPOIResults}
          onSelectPOI={handlePOIPress}
          onClose={() => {
            setShowPOIPanel(false);
            setPOIResults([]);
          }}
        />
      )}

      <Modal
        visible={washroomPickerBuilding !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setWashroomPickerBuilding(null)}
      >
        <Pressable
          style={styles.washroomPickerOverlay}
          onPress={() => setWashroomPickerBuilding(null)}
        >
          <View style={styles.washroomPickerCard}>
            <Text style={styles.washroomPickerTitle}>
              Select washroom type
            </Text>
            <Pressable
              testID="washroom-picker-male"
              style={({ pressed }) => [
                styles.washroomPickerOption,
                pressed && styles.washroomPickerOptionPressed,
              ]}
              onPress={() => handleWashroomPickerSelect("male_washroom")}
            >
              <Text style={styles.washroomPickerOptionText}>
                Male washroom
              </Text>
            </Pressable>
            <Pressable
              testID="washroom-picker-female"
              style={({ pressed }) => [
                styles.washroomPickerOption,
                pressed && styles.washroomPickerOptionPressed,
              ]}
              onPress={() => handleWashroomPickerSelect("female_washroom")}
            >
              <Text style={styles.washroomPickerOptionText}>
                Female washroom
              </Text>
            </Pressable>
            <Pressable
              testID="washroom-picker-cancel"
              style={styles.washroomPickerCancel}
              onPress={() => setWashroomPickerBuilding(null)}
            >
              <Text style={styles.washroomPickerCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
              <Text style={styles.searchResultCode}>
                {building.code}
                {building.campus !== campus && (
                  <Text style={styles.searchResultCampusBadge}>
                    {" "}({building.campus})
                  </Text>
                )}
              </Text>
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
        state={{
          searchInputRef,
          editingField,
          originBuilding,
          destinationBuilding,
          destinationPOIName: destinationPOI?.name ?? null,
          isDirectionsMode,
          isSameCampus,
          routeMode,
          modeDurations,
          originRoom,
          destinationRoom,
          focusedRoom,
          roomSuggestions,
          hasIndoorRoute,
        }}
        actions={{
          setSearchText,
          setEditingField,
          clearDirections,
          setRouteMode,
          setRouteStarted: routeActions.setRouteStarted,
          showRouteInstructions: routeActions.showInstructions,
          setOriginRoom,
          setDestinationRoom,
          setActiveFloorPlan,
          setFloorPlanModalVisible,
          openFloorPlanModal,
          setFocusedRoom,
          onRoomSuggestionPressIn: () => {
            // reserved for suggestion tap timing parity
          },
          onRoomSuggestionSelect: (room, field) => {
            if (field === "from") setOriginRoom(room);
            else setDestinationRoom(room);
            setFocusedRoom(null);
          },
          onLayout: handleDirectionsPanelLayout,
        }}
        helpers={{
          getRoomDetails,
          getFloorPlanAsset,
          formatDuration,
        }}
        styles={styles}
        onShowIndoorDirections={() => setIndoorDirectionsModalVisible(true)}
      />

      <CurrentBuildingBanner
        building={currentBuildingRecord}
        isWebPlatform={isWebPlatform}
        topInset={insets.top}
        styles={styles}
      />

      <LocationPermissionBanner
        visible={locationPermissionDenied}
        bottomOffset={insets.bottom + TAB_BAR_HEIGHT + 10}
        styles={styles}
        onPress={async () => {
          const { canAskAgain } = await Location.getForegroundPermissionsAsync();
          if (canAskAgain) {
            await requestLocationPermission();
          } else {
            await Linking.openSettings();
          }
        }}
      />

      {shouldUseWebFallback ? (
        <WebCampusMap
          styles={styles}
          defaultRegion={defaultSgwRegion}
          buildingsWithPolygons={buildingsWithPolygons}
          campusMarkerData={campusMarkerData}
          allPolygons={allPolygons}
          currentBuilding={currentBuilding}
          selectedBuilding={selectedBuilding}
          routeMode={routeMode}
          routeCoordinates={routeState.routeCoordinates}
          shuttleWalkToCoords={routeState.shuttleWalkToCoords}
          shuttleDriveCoords={routeState.shuttleDriveCoords}
          shuttleWalkFromCoords={routeState.shuttleWalkFromCoords}
          transitItineraries={routeState.transitItineraries}
          selectedItineraryIndex={routeState.selectedItineraryIndex}
          userLocation={userLocation}
          campus={campus}
          focusBounds={focusedBounds}
          focusRequestKey={mapFocusRequestKey}
          setSelectedBuilding={setSelectedBuilding}
        />
      ) : (
        <NativeCampusMap
          mapRef={mapRef}
          styles={styles}
          region={region}
          isDirectionsMode={isDirectionsMode}
          routeMode={routeMode}
          routeCoordinates={routeState.routeCoordinates}
          transitItineraries={routeState.transitItineraries}
          selectedItineraryIndex={routeState.selectedItineraryIndex}
          shuttleWalkToCoords={routeState.shuttleWalkToCoords}
          shuttleDriveCoords={routeState.shuttleDriveCoords}
          shuttleWalkFromCoords={routeState.shuttleWalkFromCoords}
          allPolygons={allPolygons as any}
          selectedBuilding={selectedBuilding}
          currentBuilding={currentBuilding}
          visibleBuildingsWithPolygons={visibleBuildingsWithPolygons}
          showCampusSummaryMarkers={showCampusSummaryMarkers}
          campusMarkerData={campusMarkerData}
          setSelectedBuilding={setSelectedBuilding}
          setMapViewportRegion={setMapViewportRegion}
        />
      )}

      <Pressable
        testID="poi-floating-button"
        style={styles.poiButton}
        onPress={() => {
          setShowPOIPanel((prev) => !prev);
          if (showPOIPanel) setPOIResults([]);
        }}
      >
        <Text style={styles.poiButtonText}>
          {showPOIPanel ? "Close" : "Nearby"}
        </Text>
      </Pressable>

      {hasCalendarToken && (
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
      )}

      {nextClassMessage && (
        <View style={styles.nextClassAlert}>
          <Text style={styles.nextClassAlertText}>{nextClassMessage}</Text>
        </View>
      )}

      {Platform.OS !== "web" &&
        process.env.EXPO_PUBLIC_ENABLE_E2E_HOOKS === "1" && (
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

      {isDirectionsMode && routeState.showRouteInstructions && routeContentAvailable && (
        <RouteStepsPopup
          state={{
            routeSheetPanResponder,
            routeMode,
            actualOriginPoint,
            destinationBuilding,
            transitItineraries: routeState.transitItineraries,
            routeStarted: routeState.routeStarted,
            selectedItineraryIndex: routeState.selectedItineraryIndex,
            expandedItineraries: routeState.expandedItineraries,
            expandedIntermediateStops: routeState.expandedIntermediateStops,
            routeInstructions: routeState.routeInstructions,
            selectedShuttleDeparture: routeState.selectedShuttleDeparture,
          }}
          actions={{
            hideInstructions: routeActions.hideInstructions,
            setSelectedItineraryIndex: routeActions.setSelectedItineraryIndex,
            setRouteDurationMinutes: routeActions.setRouteDurationMinutes,
            setRouteDistanceMeters: routeActions.setRouteDistanceMeters,
            setRouteInstructions: routeActions.setRouteInstructions,
            setExpandedItineraries: routeActions.setExpandedItineraries,
            setExpandedIntermediateStops:
              routeActions.setExpandedIntermediateStops,
            setSelectedShuttleDeparture:
              routeActions.setSelectedShuttleDeparture,
          }}
          helpers={{ formatTime }}
          styles={styles}
        />
      )}

      {isDirectionsMode && !routeState.showRouteInstructions && routeContentAvailable && (
        <Pressable
          {...routeSheetPanResponder.panHandlers}
          style={styles.routeStepsCollapsedTab}
          testID="route-steps-collapsed-tab"
          onPress={routeActions.showInstructions}
        >
          <ChevronUp size={24} color="#1F1F24" strokeWidth={2.5} />
        </Pressable>
      )}

      <BuildingInformation
        buildingCode={selectedBuilding}
        onClose={() => setSelectedBuilding(null)}
        buildingName={selectedBuildingRecord?.longName}
        buildingInfo={selectedBuildingRecord?.description}
        buildingPhotoLink={selectedBuildingRecord?.photoLink}
        editingField={editingField}
        floorPlanOptions={selectedBuildingFloorPlans}
        onOpenFloorPlans={openBuildingFloorPlansFromMap}
        onSelectDestination={(code: string) => {
          if (editingField === "from") {
            setOriginMode("manual");
            setOriginBuildingCode(code);
          } else {
            setDestinationAndEnterDirectionsMode(code);
            return;
          }
          setSelectedBuilding(null);
          setEditingField(undefined);
        }}
      />

      <Modal
        visible={floorPlanModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeFloorPlanModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={closeFloorPlanModal}
            >
              <X size={24} color="#1F1F24" strokeWidth={2.5} />
            </Pressable>

            {floorPlanModalOptions.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.floorPlanModalChipScroll}
                contentContainerStyle={styles.floorPlanModalChipScrollContent}
              >
                {floorPlanModalOptions.map((opt) => {
                  const active = opt.key === selectedFloorPlanKey;
                  return (
                    <Pressable
                      key={opt.key}
                      testID={`floor-plan-chip-${opt.key}`}
                      onPress={() => {
                        setSelectedFloorPlanKey(opt.key);
                        setActiveFloorPlan(getFloorPlanAsset(opt.key));
                        setSelectedFloorPlanNode(null);
                        setFloorPlanDirectionsPromptVisible(false);
                        setFloorPlanDirectionsFromRoom("");
                      }}
                      style={[
                        styles.floorPlanModalChip,
                        active && styles.floorPlanModalChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.floorPlanModalChipText,
                          active && styles.floorPlanModalChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <View style={styles.floorPlanModalBody}>
              {(activeFloorPlan != null && selectedFloorPlanKey != null) ? (() => {
                const parsedKey = parseFloorPlanKey(selectedFloorPlanKey);
                if (!parsedKey) {
                  return (Platform.OS === "web" ? (
                    <Image
                      source={activeFloorPlan}
                      style={styles.floorPlanImage}
                      resizeMode="contain"
                    />
                  ) : typeof activeFloorPlan === "number" ? (
                    <Image
                      source={activeFloorPlan}
                      style={styles.floorPlanImage}
                      resizeMode="contain"
                    />
                  ) : (
                    (() => {
                      const FloorPlanComponent = activeFloorPlan as React.ComponentType<{
                        width?: string | number;
                        height?: string | number;
                      }>;
                      return (
                        <Svg width="100%" height="100%" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">
                          <FloorPlanComponent width={1024} height={1024} />
                        </Svg>
                      );
                    })()
                  )) as React.ReactNode;
                }

                const specialNodes = getSpecialNodesForFloor(parsedKey.building, parsedKey.floor);
                const bounds = getFloorBounds(parsedKey.building, parsedKey.floor);
                const graphBounds = getGraphFloorBounds(parsedKey.building, parsedKey.floor);

                const renderSpecialNodeCircles = () =>
                  specialNodes.map((node) => {
                    const x = (node.x * bounds.width) / graphBounds.width;
                    const y = (node.y * bounds.height) / graphBounds.height;
                    const nodeColor = SPECIAL_NODE_COLORS[node.type];
                    if (!nodeColor) return null;
                    const isSelected = selectedFloorPlanNode?.id === node.id;
                    return (
                      <React.Fragment key={node.id}>
                        {isSelected && (
                          <Circle
                            cx={x}
                            cy={y}
                            r={18}
                            fill="none"
                            stroke={nodeColor.fill}
                            strokeWidth={3}
                            opacity={0.6}
                          />
                        )}
                        <Circle
                          cx={x}
                          cy={y}
                          r={12}
                          fill={nodeColor.fill}
                          stroke={isSelected ? "#1F1F24" : "white"}
                          strokeWidth={isSelected ? 3 : 2}
                          opacity={0.9}
                          onPress={() => handleFloorPlanNodePress(node)}
                        />
                      </React.Fragment>
                    );
                  });

                if (Platform.OS === "web") {
                  return (
                    <View style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <Image
                        source={activeFloorPlan}
                        style={styles.floorPlanImage}
                        resizeMode="contain"
                      />
                      {specialNodes.length > 0 && (
                        <Svg width="100%" height="100%" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', top: 0, left: 0 }}>
                          {renderSpecialNodeCircles()}
                        </Svg>
                      )}
                    </View>
                  );
                } else if (typeof activeFloorPlan === "number") {
                  return (
                    <View style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <Image
                        source={activeFloorPlan}
                        style={styles.floorPlanImage}
                        resizeMode="contain"
                      />
                      {specialNodes.length > 0 && (
                        <View style={StyleSheet.absoluteFill}>
                          <Svg width="100%" height="100%" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet">
                            {renderSpecialNodeCircles()}
                          </Svg>
                        </View>
                      )}
                    </View>
                  );
                } else {
                  const FloorPlanComponent = activeFloorPlan as React.ComponentType<{
                    width?: string | number;
                    height?: string | number;
                  }>;
                  return (
                    <Svg width="100%" height="100%" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet">
                      <FloorPlanComponent width={bounds.width} height={bounds.height} />
                      {renderSpecialNodeCircles()}
                    </Svg>
                  );
                }
              })() : null}
            </View>
            <View style={styles.floorPlanLegend}>
              {Object.entries(SPECIAL_NODE_COLORS).map(([type, { fill, label }]) => (
                <View key={type} style={styles.floorPlanLegendItem}>
                  <View style={[styles.floorPlanLegendSwatch, { backgroundColor: fill }]} />
                  <Text style={styles.floorPlanLegendText}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Selected node info & get directions */}
            {selectedFloorPlanNode && !floorPlanDirectionsPromptVisible && (
              <View style={floorPlanNodeStyles.selectedNodeBar}>
                <View style={[floorPlanNodeStyles.selectedNodeSwatch, { backgroundColor: SPECIAL_NODE_COLORS[selectedFloorPlanNode.type]?.fill ?? "#888" }]} />
                <Text style={floorPlanNodeStyles.selectedNodeText} numberOfLines={1}>
                  {selectedFloorPlanNode.category === "male_washroom"
                    ? "Men's Washroom"
                    : selectedFloorPlanNode.category === "female_washroom"
                      ? "Women's Washroom"
                      : SPECIAL_NODE_COLORS[selectedFloorPlanNode.type]?.label ?? selectedFloorPlanNode.type}
                </Text>
                <Pressable
                  testID="floor-plan-get-directions"
                  style={({ pressed }) => [
                    floorPlanNodeStyles.directionsButton,
                    pressed && floorPlanNodeStyles.directionsButtonPressed,
                  ]}
                  onPress={handleFloorPlanGetDirections}
                >
                  <Text style={floorPlanNodeStyles.directionsButtonText}>Get Directions</Text>
                </Pressable>
              </View>
            )}

            {/* Directions prompt: enter starting room */}
            {floorPlanDirectionsPromptVisible && selectedFloorPlanNode && (
              <View style={floorPlanNodeStyles.directionsPrompt}>
                <Text style={floorPlanNodeStyles.directionsPromptTitle}>
                  Directions to{" "}
                  {selectedFloorPlanNode.category === "male_washroom"
                    ? "Men's Washroom"
                    : selectedFloorPlanNode.category === "female_washroom"
                      ? "Women's Washroom"
                      : SPECIAL_NODE_COLORS[selectedFloorPlanNode.type]?.label ?? selectedFloorPlanNode.type}
                </Text>
                <View style={floorPlanNodeStyles.directionsPromptRow}>
                  <TextInput
                    testID="floor-plan-from-room-input"
                    style={floorPlanNodeStyles.directionsInput}
                    placeholder={`Enter starting room in ${floorPlanPromptBuilding ?? "building"} (e.g. 820)`}
                    placeholderTextColor="#999"
                    value={floorPlanDirectionsFromRoom}
                    onChangeText={setFloorPlanDirectionsFromRoom}
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={handleFloorPlanDirectionsGo}
                  />
                  <Pressable
                    testID="floor-plan-directions-go"
                    style={({ pressed }) => [
                      floorPlanNodeStyles.goButton,
                      pressed && floorPlanNodeStyles.goButtonPressed,
                      !floorPlanDirectionsFromRoom.trim() && floorPlanNodeStyles.goButtonDisabled,
                    ]}
                    onPress={handleFloorPlanDirectionsGo}
                    disabled={!floorPlanDirectionsFromRoom.trim()}
                  >
                    <Text style={floorPlanNodeStyles.goButtonText}>Go</Text>
                  </Pressable>
                </View>
                {floorPlanRoomSuggestions.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={floorPlanNodeStyles.suggestionsScroll}
                    contentContainerStyle={floorPlanNodeStyles.suggestionsContent}
                  >
                    {floorPlanRoomSuggestions.map((room) => (
                      <Pressable
                        key={room}
                        testID={`floor-plan-room-suggestion-${room}`}
                        style={({ pressed }) => [
                          floorPlanNodeStyles.suggestionChip,
                          pressed && floorPlanNodeStyles.suggestionChipPressed,
                        ]}
                        onPress={() => {
                          setFloorPlanDirectionsFromRoom(room);
                        }}
                      >
                        <Text style={floorPlanNodeStyles.suggestionChipText}>{room}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <Pressable
                  testID="floor-plan-directions-cancel"
                  onPress={() => {
                    setFloorPlanDirectionsPromptVisible(false);
                    setFloorPlanDirectionsFromRoom("");
                  }}
                >
                  <Text style={floorPlanNodeStyles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <IndoorDirectionsModal
        visible={indoorDirectionsModalVisible}
        onClose={() => {
          setIndoorDirectionsModalVisible(false);
          setIndoorDirectionsTargetNodeId(undefined);
        }}
        route={indoorRoute ?? null}
        buildingCode={originBuilding?.code ?? destinationBuilding?.code ?? ""}
        originRoom={originRoom}
        destinationRoom={destinationRoom}
        targetNodeId={indoorDirectionsTargetNodeId}
        floorBounds={(floor) =>
          getFloorBounds(originBuilding?.code ?? destinationBuilding?.code ?? "", floor)
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

const floorPlanNodeStyles = StyleSheet.create({
  selectedNodeBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F8F9FA",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    gap: 10,
  },
  selectedNodeSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  selectedNodeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1F1F24",
  },
  directionsButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  directionsButtonPressed: {
    opacity: 0.85,
  },
  directionsButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  directionsPrompt: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8F9FA",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    gap: 8,
  },
  directionsPromptTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F1F24",
  },
  directionsPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  directionsInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: "#FFFFFF",
    color: "#1F1F24",
  },
  goButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  goButtonPressed: {
    opacity: 0.85,
  },
  goButtonDisabled: {
    opacity: 0.4,
  },
  goButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    paddingVertical: 4,
  },
  suggestionsScroll: {
    maxHeight: 36,
  },
  suggestionsContent: {
    gap: 6,
    paddingVertical: 2,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  suggestionChipPressed: {
    backgroundColor: "#C8E6C9",
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2e7d32",
  },
});
