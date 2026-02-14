import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ChevronDown, ChevronUp, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader, { Campus } from "../../components/AppHeader";
import { BUILDINGS, type BuildingRecord } from "../../constants/buildings";
import LOY_POLYGONS from "../../constants/maps/outdoor/LOY-polygons";
import SGW_POLYGONS from "../../constants/maps/outdoor/SGW-polygons";
import {
  findUserBuilding,
  hasLocationPermission,
  requestLocationPermission,
  startWatchingLocation,
} from "../../utils/locationUtils";
import {
  fetchOsrmRoute,
  type RouteInstruction,
  type RouteProfile,
} from "../../utils/osrmDirections";

import BuildingInformation from "@/components/BuildingInformation";
import { getCampusRegion } from "../../utils/mapRegions";
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

const TRAVEL_MODES: { value: RouteProfile; label: string }[] = [
  { value: "walking", label: "Walk" },
  { value: "driving", label: "Drive" },
  { value: "cycling", label: "Bike" },
];
const HALL_BUILDING_CODE = "H";

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
};

const formatDistance = (meters: number) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
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

/* these make it so we can view selected campus and building from the map level */
export default function MapScreen() {
  const [campus, setCampus] = useState<Campus>("SGW");
  const [searchText, setSearchText] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const destinationBuildingCode = HALL_BUILDING_CODE;
  const [isDirectionsMode, setIsDirectionsMode] = useState(false);
  const routeMode: RouteProfile = "walking";
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [routeDurationMinutes, setRouteDurationMinutes] = useState<
    number | null
  >(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(
    null,
  );
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeInstructions, setRouteInstructions] = useState<
    RouteInstruction[]
  >([]);
  const [showRouteInstructions, setShowRouteInstructions] = useState(false);
  const routeInstructionsDismissedRef = useRef(false);
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
  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 56;

  const isWebPlatform = Platform.OS === "web";
  const showE2EHooks =
    Platform.OS !== "web" &&
    process.env.EXPO_PUBLIC_ENABLE_E2E_HOOKS === "1";
  const userLat = isWebPlatform ? userLocation?.coords.latitude || null : null;
  const userLng = isWebPlatform ? userLocation?.coords.longitude || null : null;
  const currentBuildingForHTML = isWebPlatform ? currentBuilding : null;

  // Styles defined inside component 
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    map: {
      flex: 1,
    },
    markerContainer: {
      alignItems: "center",
    },
    markerBadge: {
      minWidth: 30,
      height: 28,
      paddingHorizontal: 8,
      borderRadius: 14,
      backgroundColor: "#A32638",
      borderWidth: 2,
      borderColor: "white",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    markerText: {
      fontSize: 12,
      fontWeight: "700",
      color: "white",
    },
    markerStem: {
      marginTop: -2,
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: "#A32638",
    },
    webFallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    webFallbackText: {
      color: "#2C2C2C",
      fontSize: 16,
      textAlign: "center",
    },
    permissionBanner: {
      position: "absolute",
      alignSelf: "center",
      backgroundColor: "#ff3700",
      opacity: 0.9,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
      zIndex: 1000,
      maxWidth: "90%",
    },
    permissionText: {
      fontSize: 13,
      fontWeight: "600",
      color: "white",
      textAlign: "center",
    },
    buildingInfo: {
      position: "absolute",
      top: isWebPlatform ? 53 : insets.top + 44,
      alignSelf: "center",
      backgroundColor: "rgba(0,0,0,0.7)",
      paddingVertical: isWebPlatform ? 8 : 4,
      paddingHorizontal: isWebPlatform ? 16 : 8,
      borderRadius: isWebPlatform ? 10 : 8,
      zIndex: 1000,
      maxWidth: isWebPlatform ? undefined : "90%",
    },
    buildingInfoText: {
      color: "white",
      fontSize: isWebPlatform ? 14 : 12,
      fontWeight: "700",
      textAlign: "center",
    },
    buildingInfoTitle: {
      color: "#FFA500",
      fontSize: isWebPlatform ? 14 : 12,
      fontWeight: "600",
      marginBottom: 2,
      textAlign: "center",
      opacity: 0.9,
    },
    searchResultsContainer: {
      marginHorizontal: 16,
      marginTop: 8,
      backgroundColor: "rgba(255,255,255,0.98)",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
      overflow: "hidden",
    },
    searchResultsHint: {
      fontSize: 12,
      color: "#5D5D66",
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: "#F6F7FA",
      borderBottomWidth: 1,
      borderBottomColor: "#ECECF1",
      fontWeight: "600",
    },
    searchResultItem: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#F0F0F0",
    },
    searchResultCode: {
      color: "#A32638",
      fontWeight: "700",
      fontSize: 13,
    },
    searchResultName: {
      marginTop: 3,
      color: "#202124",
      fontSize: 13,
      fontWeight: "500",
    },
    searchResultAddress: {
      marginTop: 2,
      color: "#6A6A75",
      fontSize: 12,
    },
    directionsPanel: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
      padding: 10,
      borderRadius: 14,
      backgroundColor: "rgba(20,20,24,0.82)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
    },
    directionFieldRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    directionFieldButton: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.28)",
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    directionFieldButtonActive: {
      borderColor: "#FFD08A",
      backgroundColor: "rgba(255,208,138,0.2)",
    },
    directionFieldLabel: {
      color: "#FFD08A",
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    directionFieldValue: {
      color: "white",
      fontSize: 13,
      marginTop: 3,
      fontWeight: "600",
    },
    clearRouteButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.28)",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    clearRouteText: {
      color: "white",
      fontSize: 12,
      fontWeight: "700",
    },
    routeModeRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },
    routeModeButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
      backgroundColor: "rgba(255,255,255,0.06)",
      paddingVertical: 8,
    },
    routeModeButtonActive: {
      backgroundColor: "#D2E9FF",
      borderColor: "#95C6F3",
    },
    routeModeButtonText: {
      color: "white",
      fontSize: 13,
      fontWeight: "700",
    },
    routeModeButtonTextActive: {
      color: "#123B5D",
    },
    routeStatusText: {
      marginTop: 10,
      color: "#E8E8EC",
      fontSize: 12,
      fontWeight: "600",
    },
    routeStepsPopup: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: insets.bottom + TAB_BAR_HEIGHT + 10,
      backgroundColor: "#F5F5F6",
      borderRadius: 28,
      paddingHorizontal: 14,
      paddingTop: 6,
      paddingBottom: 14,
      zIndex: 1100,
      maxHeight: isWebPlatform ? 360 : 300,
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 10,
    },
    routeStepsHandle: {
      alignSelf: "center",
      width: 44,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      marginTop: -2,
      marginBottom: 4,
    },
    routeStepsCloseButton: {
      position: "absolute",
      top: 14,
      right: 12,
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2.5,
      borderColor: "#1F1F24",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F5F5F6",
    },
    routeStepsCollapsedTab: {
      position: "absolute",
      alignSelf: "center",
      bottom: insets.bottom + TAB_BAR_HEIGHT + 10,
      width: 58,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#F5F5F6",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1100,
      shadowColor: "#000",
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 8,
    },
    routeStepsList: {
      marginTop: 10,
    },
    routeStepsListContent: {
      paddingRight: 54,
      paddingBottom: 8,
    },
    routeStepText: {
      fontSize: 18,
      lineHeight: 24,
      color: "#111111",
      fontWeight: "700",
      marginBottom: 18,
    },
    e2eControls: {
      position: "absolute",
      right: 12,
      bottom: 110,
      gap: 8,
      zIndex: 1100,
    },
    e2eButton: {
      backgroundColor: "rgba(0,0,0,0.72)",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      alignItems: "center",
      justifyContent: "center",
    },
    e2eButtonText: {
      color: "white",
      fontSize: 12,
      fontWeight: "700",
    },
  });

  let MapViewComponent: React.ComponentType<any> | null = null;
  let MapMarkerComponent: React.ComponentType<any> | null = null;
  let MapCalloutComponent: React.ComponentType<any> | null = null;
  let MapPolygonComponent: React.ComponentType<any> | null = null;
  let MapPolylineComponent: React.ComponentType<any> | null = null;
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handler = (event: MessageEvent) => {
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
        // ignore non-JSON messages
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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

  // Start tracking user location
  useEffect(() => {
    async function setupLocation() {
      const permission = await hasLocationPermission();

      if (!permission) {
        const granted = await requestLocationPermission();
        if (!granted) {
          setLocationPermissionDenied(true);
          return;
        }
      }

      const subscription = await startWatchingLocation(
        (location: Location.LocationObject) => {
          const { latitude, longitude } = location.coords;

          setUserLocation(location);
          setLocationPermissionDenied(false);
          const polygons = campus === "SGW" ? SGW_POLYGONS : LOY_POLYGONS;
          const building = findUserBuilding(
            latitude,
            longitude,
            polygons as any,
          );

          if (building !== currentBuilding) {
            setCurrentBuilding(building);
            console.log("Current building:", building || "Outside");
          }

          console.log("User location:", latitude, longitude);
        },
      );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentBuilding is set by this effect, not read
  }, [campus]);

  // Get polygon data based on campus
  const campusPolygons = useMemo(
    () => (campus === "SGW" ? SGW_POLYGONS : LOY_POLYGONS),
    [campus],
  );

  const campusBuildings = useMemo(
    () => BUILDINGS.filter((building) => building.campus === campus),
    [campus],
  );
  const defaultSgwRegion = useMemo(
    () => getCampusRegion("SGW", SGW_POLYGONS.features),
    [],
  );

  const originLatitude = useMemo(() => {
    const latitude = userLocation?.coords?.latitude;
    return typeof latitude === "number" ? roundCoord(latitude) : null;
  }, [userLocation?.coords?.latitude]);

  const originLongitude = useMemo(() => {
    const longitude = userLocation?.coords?.longitude;
    return typeof longitude === "number" ? roundCoord(longitude) : null;
  }, [userLocation?.coords?.longitude]);

  const originPoint = useMemo(() => {
    if (originLatitude === null || originLongitude === null) return null;
    return { latitude: originLatitude, longitude: originLongitude };
  }, [originLatitude, originLongitude]);

  const currentBuildingRecord = useMemo(
    () => resolveBuildingByCode(currentBuilding, campusBuildings),
    [campusBuildings, currentBuilding],
  );

  const destinationBuilding = useMemo(
    () => resolveBuildingByCode(destinationBuildingCode, BUILDINGS),
    [destinationBuildingCode],
  );

  const routeStatusText = useMemo(() => {
    if (!isDirectionsMode) return "";
    if (locationPermissionDenied) {
      return "Enable location permission to route from your current location.";
    }
    if (!originPoint) return "Finding your current location...";
    if (!destinationBuilding) {
      return "Hall building destination is unavailable.";
    }
    if (routeLoading) return "Loading route...";
    if (routeError) return routeError;
    if (routeDurationMinutes !== null && routeDistanceMeters !== null) {
      const modeLabel =
        TRAVEL_MODES.find((mode) => mode.value === routeMode)?.label ?? routeMode;
      return `${modeLabel}: ${formatDuration(routeDurationMinutes)} - ${formatDistance(routeDistanceMeters)}`;
    }
    return "Route unavailable for the selected destination.";
  }, [
    destinationBuilding,
    isDirectionsMode,
    locationPermissionDenied,
    originPoint,
    routeDistanceMeters,
    routeDurationMinutes,
    routeError,
    routeLoading,
    routeMode,
  ]);

  const exitDirectionsMode = () => {
    setIsDirectionsMode(false);
    setRouteCoordinates([]);
    setRouteDurationMinutes(null);
    setRouteDistanceMeters(null);
    setRouteError(null);
    setRouteLoading(false);
    setRouteInstructions([]);
    setShowRouteInstructions(false);
    routeInstructionsDismissedRef.current = false;
  };

  const handleCampusChange = (nextCampus: Campus) => {
    if (isDirectionsMode) {
      exitDirectionsMode();
    }
    setCampus(nextCampus);
  };

  const clearDirections = () => {
    setSearchText("");
    setSelectedBuilding(null);

    if (!isDirectionsMode) {
      routeInstructionsDismissedRef.current = false;
      setIsDirectionsMode(true);
      return;
    }

    exitDirectionsMode();
    setCampus("SGW");

    if (!isWebPlatform && campus === "SGW") {
      mapRef.current?.animateToRegion?.(defaultSgwRegion, 450);
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
  };

  useEffect(() => {
    setSearchText("");
    setSelectedBuilding(null);
  }, [campusBuildings]);

  useEffect(() => {
    if (
      !isDirectionsMode ||
      !destinationBuilding ||
      originLatitude === null ||
      originLongitude === null
    ) {
      setRouteCoordinates([]);
      setRouteDurationMinutes(null);
      setRouteDistanceMeters(null);
      setRouteError(null);
      setRouteLoading(false);
      setRouteInstructions([]);
      setShowRouteInstructions(false);
      routeInstructionsDismissedRef.current = false;
      return;
    }

    let cancelled = false;

    // log route mode
    console.log("Calculating route with mode:", routeMode);

    const loadRoute = async () => {
      try {
        setRouteLoading(true);
        setRouteError(null);
        const routeOrigin = {
          latitude: originLatitude,
          longitude: originLongitude,
        };
        const route = await fetchOsrmRoute(
          routeOrigin,
          destinationBuilding,
          routeMode,
        );

        if (cancelled) return;
        setRouteCoordinates(route.coordinates);
        setRouteDurationMinutes(Math.round(route.durationSeconds / 60));
        setRouteDistanceMeters(route.distanceMeters);
        setRouteInstructions(route.instructions);
        if (
          route.instructions.length > 0 &&
          !routeInstructionsDismissedRef.current
        ) {
          setShowRouteInstructions(true);
        }
      } catch {
        if (cancelled) return;
        setRouteCoordinates([]);
        setRouteDurationMinutes(null);
        setRouteDistanceMeters(null);
        setRouteError("Could not load route for this selection.");
        setRouteInstructions([]);
        setShowRouteInstructions(false);
        routeInstructionsDismissedRef.current = false;
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [
    isDirectionsMode,
    destinationBuilding,
    originLatitude,
    originLongitude,
    routeMode,
  ]);

  // Only show pins for buildings that have a polygon (exact or parent e.g. CJ for CJA)
  const buildingsWithPolygons = useMemo(() => {
    const buildingHasPolygon = (building: { code: string }) => {
      const hasExact = campusPolygons.features.some(
        (f: { properties: { code: string } }) =>
          f.properties.code === building.code,
      );
      const hasParent = campusPolygons.features.some(
        (f: { properties: { code: string } }) =>
          building.code.startsWith(f.properties.code) &&
          f.properties.code.length >= 2,
      );
      return hasExact || hasParent;
    };
    return campusBuildings.filter(buildingHasPolygon);
  }, [campusBuildings, campusPolygons]);

  const region = useMemo(
    () => getCampusRegion(campus, campusPolygons.features),
    [campus, campusPolygons],
  );

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

  // Generate HTML for web map
  const mapHTML = useMemo(() => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    const buildingData = buildingsWithPolygons.map(
      ({ latitude: lat, longitude: lng, code, shortName }) => ({
        latitude: lat,
        longitude: lng,
        code,
        shortName,
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
              .building-marker {
                  background: transparent;
                  border: none;
              }
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
              .user-marker {
                  background: transparent;
                  border: none;
              }
          </style>
      </head>
      <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
              const map = L.map('map', {
                maxZoom: 22
              }).setView([${latitude}, ${longitude}], 20);
              window.map = map; 
              const buildings = ${JSON.stringify(buildingData)};
              const polygonData = ${JSON.stringify(campusPolygons)};
              const currentBuilding = ${JSON.stringify(currentBuildingForHTML)};
              const routeMode = ${JSON.stringify(routeMode)};
              const routeCoordinates = ${JSON.stringify(
                routeCoordinates.map((point) => [point.latitude, point.longitude]),
              )};
              let selectedPolygon = null;
              window.polygonMap = {};
              window.currentBuildingPolygon = null;
              window.currentBuildingCode = null;
              window.selectedBuildingCode = null;
              window.selectedPolygon = null;
              window.userMarker = null;  
              window.followUser = false;
              window.hasCenteredOnUser = false;

              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '© OpenStreetMap contributors',
                  maxZoom: 22,
                  maxNativeZoom: 19  
              }).addTo(map);

              const defaultPolygonStyle = {
                  color: '#A32638',
                  fillColor: '#A32638',
                  fillOpacity: 0.2,
                  weight: 2
              };

              const currentPolygonStyle = {
                  color: '#FFA500',
                  fillColor: '#FFA500',
                  fillOpacity: 0.5,
                  weight: 3
              };

              const selectedPolygonStyle = {
                  color: '#238c51',
                  fillColor: '#238c51',
                  fillOpacity: 0.5,
                  weight: 3
              };

              const resetPolygonStyle = (polygon) => {
                  if (!polygon) return;
                  const code = polygon.__buildingCode || null;
                  if (code && window.currentBuildingCode === code) {
                      polygon.setStyle(currentPolygonStyle);
                  } else {
                      polygon.setStyle(defaultPolygonStyle);
                  }
              };

              const bounds = [[${minLat}, ${minLng}], [${maxLat}, ${maxLng}]];
              let routePolyline = null;
              if (routeCoordinates.length > 1) {
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

                  routePolyline = L.polyline(routeCoordinates, routeStyle).addTo(map);

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
              }

              if (routePolyline) {
                  map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
              } else {
                  map.fitBounds(bounds, { padding: [20, 20] });
              }

              const disableFollow = () => {
                  window.followUser = false;
              };

              map.on('dragstart', disableFollow);
              map.on('zoomstart', disableFollow);
              map.on('movestart', disableFollow);

              polygonData.features.forEach((feature) => {
                  const coordinates = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                  const buildingCode = feature.properties.code;

                  const polygon = L.polygon(coordinates, defaultPolygonStyle).addTo(map);

                  window.polygonMap[buildingCode] = polygon;
                  polygon.__buildingCode = buildingCode;

                  polygon.on('click', function(e) {
                      if (selectedPolygon) {
                          resetPolygonStyle(selectedPolygon);
                      }

                      this.setStyle(selectedPolygonStyle);
                      selectedPolygon = this;
                      window.selectedBuildingCode = buildingCode;
                      window.selectedPolygon = selectedPolygon;
                      (window.ReactNativeWebView || window.parent).postMessage(JSON.stringify({ type: 'buildingSelected', buildingCode: buildingCode }), '*');
                      L.DomEvent.stopPropagation(e);
                  });

                  polygon.on('mouseover', function() {
                      if (this !== selectedPolygon) {
                          this.setStyle({ fillOpacity: 0.3 });
                      }
                  });

                  polygon.on('mouseout', function() {
                      if (this !== selectedPolygon) {
                          this.setStyle({ fillOpacity: 0.2 });
                      }
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
                      (window.ReactNativeWebView || window.parent).postMessage(JSON.stringify({type: 'buildingDeselected'}), '*');
                  }
              });

              const createBuildingIcon = (code) => L.divIcon({
                  className: 'building-marker',
                  html: '<div class="marker-badge">' + code + '</div><div class="marker-stem"></div>',
                  iconSize: [40, 44],
                  iconAnchor: [20, 44],
                  popupAnchor: [0, -40]
              });

              buildings.forEach((building) => {
                  const marker = L.marker([building.latitude, building.longitude], {
                      icon: createBuildingIcon(building.code)
                  }).addTo(map);

                  marker.on('click', function(e) {
                      let polygon = window.polygonMap[building.code];
                      if (!polygon && building.code.length > 2) {
                          const baseCode = building.code.slice(0, -1);
                          polygon = window.polygonMap[baseCode];
                      }

                      if (polygon) {
                          if (selectedPolygon) {
                              resetPolygonStyle(selectedPolygon);
                          }

                          if (selectedPolygon === polygon) {
                              resetPolygonStyle(selectedPolygon);
                              selectedPolygon = null;
                          } else {
                              polygon.setStyle(selectedPolygonStyle);
                              selectedPolygon = polygon;
                          }
                      }
                          if(selectedPolygon){
                            window.selectedBuildingCode = building.code;
                            window.selectedPolygon = selectedPolygon;
                            (window.ReactNativeWebView || window.parent).postMessage(JSON.stringify({type:'buildingSelected', buildingCode: building.code}), '*');
                          } else {
                            window.selectedBuildingCode = null;
                            window.selectedPolygon = null;
                            (window.ReactNativeWebView || window.parent).postMessage(JSON.stringify({type: 'buildingDeselected'}), '*');
                          }
                      L.DomEvent.stopPropagation(e);
                  });
              });

              ${userLat && userLng
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
    buildingsWithPolygons,
    campusPolygons,
    currentBuildingForHTML,
    region,
    routeCoordinates,
    routeMode,
    userLat,
    userLng,
  ]);

  const webViewSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  const shouldUseWebFallback = Platform.OS === "web" || !MapViewComponent;

  useEffect(() => {
    if (Platform.OS !== "web") {
      setWebMapReady(false);
    }
  }, [campus]);

  const renderWebMapContent = () => {
    if (Platform.OS === "web") {
      return (
        <iframe
          key={campus}
          src={`data:text/html;charset=utf-8,${encodeURIComponent(mapHTML)}`}
          style={{ ...(StyleSheet.flatten(styles.map) as object), border: 0 }}
          allowFullScreen
          title="Concordia map"
        />
      );
    }

    if (WebView) {
      return (
        <WebView
          key={campus}
          testID="map-webview"
          ref={webViewRef}
          source={webViewSource}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          scalesPageToFit
          originWhitelist={['*']}
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
            if (request.url.startsWith('rnmsg://')) {
              try {
                const data = JSON.parse(decodeURIComponent(request.url.replace('rnmsg://', '')));
                if (data?.type === 'buildingSelected') setSelectedBuilding(data.buildingCode);
                if (data?.type === 'buildingDeselected') setSelectedBuilding(null);
              } catch { }
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
        key={campus}
        ref={mapRef}
        testID="map-native"
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        onPress={() => setSelectedBuilding(null)}
      >
        {isDirectionsMode && MapPolylineComponent && routeCoordinates.length > 1 && (
          <MapPolylineComponent
            testID="route-polyline"
            coordinates={routeCoordinates}
            strokeColor="#1668C7"
            strokeWidth={routeMode === "walking" ? 6 : 5}
            lineDashPattern={routeMode === "walking" ? [1, 12] : undefined}
            lineCap="round"
          />
        )}

        {campusPolygons.features.map((feature: any) => {
          const coordinates = feature.geometry.coordinates[0].map(
            (coord: number[]) => ({
              latitude: coord[1],
              longitude: coord[0],
            }),
          );

          const buildingCode = feature.properties.code;
          const isSelected = selectedBuilding === buildingCode;
          const isCurrent = currentBuilding === buildingCode;
          const strokeColor = isSelected
            ? "#238c51"
            : isCurrent
              ? "#FFA500"
              : "#A32638";
          const fillColor = isSelected
            ? "#238c51"
            : isCurrent
              ? "#FFA500"
              : "#A32638";
          const strokeWidth = isSelected ? 3 : isCurrent ? 3 : 2;
          const fillOpacity = isSelected ? 0.5 : isCurrent ? 0.5 : 0.2;

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

        {buildingsWithPolygons.map((building) => {
          const hasExactPolygon = campusPolygons.features.some(
            (f: any) => f.properties.code === building.code,
          );

          const polygonCode = hasExactPolygon
            ? building.code
            : campusPolygons.features.find(
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
      </MapViewComponent>
    ) : (
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackText}>
          Map view is unavailable in this environment.
        </Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <AppHeader
        campus={campus}
        onCampusChange={handleCampusChange}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />

      {searchResults.length > 0 && (
        <View style={styles.searchResultsContainer} testID="search-results">
          <Text style={styles.searchResultsHint}>
            Tap a building to set destination (To).
          </Text>
          {searchResults.map((building) => (
            <Pressable
              key={building.code}
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

      <View style={styles.directionsPanel} testID="directions-panel">
        <View style={styles.directionFieldRow}>
          <View style={[styles.directionFieldButton, styles.directionFieldButtonActive]}>
            <Text style={styles.directionFieldLabel}>From</Text>
            <Text style={styles.directionFieldValue} numberOfLines={1}>
              {currentBuildingRecord
                ? `Current location - ${currentBuildingRecord.code} ${currentBuildingRecord.shortName}`
                : originPoint
                  ? "Current location"
                  : locationPermissionDenied
                    ? "Location permission required"
                    : "Finding location..."}
            </Text>
          </View>

          <View
            style={[
              styles.directionFieldButton,
              destinationBuilding && styles.directionFieldButtonActive,
            ]}
          >
            <Text style={styles.directionFieldLabel}>To</Text>
            <Text style={styles.directionFieldValue} numberOfLines={1}>
              {destinationBuilding
                ? `${destinationBuilding.code} - ${destinationBuilding.shortName}`
                : "H - Hall Building"}
            </Text>
          </View>

          <Pressable onPress={clearDirections} style={styles.clearRouteButton}>
            <Text style={styles.clearRouteText}>
              {isDirectionsMode ? "Cancel" : "Go"}
            </Text>
          </Pressable>
        </View>

        {isDirectionsMode && (
          <Text style={styles.routeStatusText}>{routeStatusText}</Text>
        )}
      </View>

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
            Enable location permissions to see where you are on campus. Tap here.
          </Text>
        </TouchableOpacity>
      )}
      {shouldUseWebFallback ? webMapContent : nativeMapContent}
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

      {isDirectionsMode && showRouteInstructions && routeInstructions.length > 0 && (
        <View style={styles.routeStepsPopup} testID="route-steps-popup">
          <Pressable
            {...routeSheetPanResponder.panHandlers}
            style={styles.routeStepsHandle}
            onPress={() => {
              routeInstructionsDismissedRef.current = true;
              setShowRouteInstructions(false);
            }}
          >
            <ChevronDown size={24} color="#1F1F24" strokeWidth={2.5} />
          </Pressable>
          <Pressable
            style={styles.routeStepsCloseButton}
            onPress={() => {
              routeInstructionsDismissedRef.current = true;
              setShowRouteInstructions(false);
            }}
          >
            <X size={26} color="#1F1F24" strokeWidth={2.5} />
          </Pressable>

          <ScrollView
            style={styles.routeStepsList}
            contentContainerStyle={styles.routeStepsListContent}
            showsVerticalScrollIndicator={false}
          >
            {routeInstructions.map((instruction, index) => (
              <Text
                key={`${index}-${instruction.text}`}
                style={styles.routeStepText}
              >
                {`${index + 1}. ${instruction.text}`}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
      {isDirectionsMode && !showRouteInstructions && routeInstructions.length > 0 && (
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
      />
    </View>
  );
}
