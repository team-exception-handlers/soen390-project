import BuildingInformation from "@/components/BuildingInformation";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import { ChevronDown, ChevronUp, Map, X } from "lucide-react-native";
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
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader, { Campus } from "../../components/AppHeader";
import ShuttleDirections from "../../components/ShuttleDirections";
import TransitLegTimeline from "../../components/TransitLegTimeline";
import { BUILDINGS, type BuildingRecord } from "../../constants/buildings";
import LOY_POLYGONS from "../../constants/maps/outdoor/LOY-polygons";
import SGW_POLYGONS from "../../constants/maps/outdoor/SGW-polygons";
import { getNearestStop, STOPS } from "../../utils/locationLogic";
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
import { calculateArrivalTime, getShuttleInfo } from "../../utils/shuttleLogic";
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

const TRAVEL_MODES: { value: RouteProfile | "transit"; label: string }[] = [
  { value: "walking", label: "Walk" },
  { value: "driving", label: "Drive" },
  { value: "transit", label: "Transit" },
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
const getFloorPlanAsset = (key: string): any | null => {
  const assets: Record<string, () => any> = {
    "H-8": () => require("../../assets/floor_plans/Hall-8.svg"),
    "H-9": () => require("../../assets/floor_plans/Hall-9.svg"),
    "MB-1": () => require("../../assets/floor_plans/MB-1.svg"),
    "MB--2": () => require("../../assets/floor_plans/MB-S2.svg"),
    "VE-1": () => require("../../assets/floor_plans/VE-1.svg"),
    "VE-2": () => require("../../assets/floor_plans/VE-2.svg"),
    "VL-1": () => require("../../assets/floor_plans/VL-1.svg"),
    "VL-2": () => require("../../assets/floor_plans/VL-2.svg"),
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

const getLegColor = (mode: string, styles: any) => {
  if (mode === "WALK") return styles.legPillWalk;
  if (mode === "BUS") return styles.legPillBus;
  if (mode === "SUBWAY") return styles.legPillSubway;
  if (mode === "TRAM") return styles.legPillTram;
  return styles.legPillBus;
};

const TransitItineraryCard = ({
  itinerary,
  index,
  isExpanded,
  isSelected,
  setSelectedItineraryIndex,
  setRouteDurationMinutes,
  setRouteDistanceMeters,
  setRouteInstructions,
  setExpandedItineraries,
  formatTime,
  styles,
  expandedIntermediateStops,
  setExpandedIntermediateStops,
}: any) => {
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable
        style={[styles.itineraryCard, isSelected && styles.itineraryCardActive]}
        onPress={() => {
          setSelectedItineraryIndex(index);
          setRouteDurationMinutes(Math.round(itinerary.durationSeconds / 60));
          setRouteDistanceMeters(itinerary.distanceMeters);
          setRouteInstructions(itinerary.instructions);
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.itineraryTime}>
              {formatTime(itinerary.departureTime)} →{" "}
              {formatTime(itinerary.arrivalTime)}
            </Text>
            <Text style={styles.itineraryDuration}>
              {Math.round(itinerary.durationSeconds / 60)} min
            </Text>
            <Text style={styles.itineraryTransfers}>
              {itinerary.transfers === 0
                ? "Direct"
                : `${itinerary.transfers} transfer${itinerary.transfers > 1 ? "s" : ""}`}
            </Text>
            <View style={styles.itineraryLegsRow}>
              {itinerary.legs.map((leg: any, legIndex: any) => (
                <Text
                  key={legIndex}
                  style={[styles.legPill, getLegColor(leg.mode, styles)]}
                >
                  {leg.mode === "WALK" ? "Walk" : leg.route || leg.mode}
                </Text>
              ))}
            </View>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setExpandedItineraries((prev: any) =>
                prev.includes(index)
                  ? prev.filter((i: any) => i !== index)
                  : [...prev, index],
              );
            }}
            style={{ padding: 8, marginLeft: 8 }}
          >
            {isExpanded ? (
              <ChevronUp size={20} color="#007AFF" strokeWidth={2.5} />
            ) : (
              <ChevronDown size={20} color="#8E8E93" strokeWidth={2.5} />
            )}
          </Pressable>
        </View>
      </Pressable>

      {isExpanded && (
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 16,
            paddingBottom: 12,
            backgroundColor: "#FAFAFA",
            borderRadius: 12,
            marginTop: 8,
          }}
        >
          <TransitLegTimeline
            itinerary={itinerary}
            styles={styles}
            formatTime={formatTime}
            canToggleIntermediateStops
            expandedStops={expandedIntermediateStops}
            onToggleStops={(stopKey: string) => {
              setExpandedIntermediateStops((prev: any) => {
                const next = new Set(prev);
                if (next.has(stopKey)) next.delete(stopKey);
                else next.add(stopKey);
                return next;
              });
            }}
            stopKeyPrefix={`itin-${index}`}
          />
        </View>
      )}
    </View>
  );
};

const RouteStepsPopup = (props: any) => {
const {
    styles,
    routeSheetPanResponder,
    formatTime,
    routeInstructionsDismissedRef,
    setShowRouteInstructions,
    routeMode,
    actualOriginPoint,
    destinationBuilding,
    transitItineraries,
    routeStarted,
    selectedItineraryIndex,
    expandedItineraries,
    setSelectedItineraryIndex,
    setRouteDurationMinutes,
    setRouteDistanceMeters,
    setRouteInstructions,
    setExpandedItineraries,
    expandedIntermediateStops,
    setExpandedIntermediateStops,
    routeInstructions,
    selectedShuttleDeparture,
    setSelectedShuttleDeparture
  } = props;

  const hasTransitItineraries =
    routeMode === "transit" && transitItineraries.length > 0;

  const showTransitJourneyDetails = hasTransitItineraries && routeStarted;

  return (
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
        testID="route-steps-close-button"
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
        {routeMode === "shuttle" ? (
          !routeStarted ? (
            <ShuttleDirections
              origin={actualOriginPoint}
              destination={destinationBuilding}
              routeStarted={routeStarted}
              routeInstructions={routeInstructions}
              onDepartureSelect={(time) => {
                if (setSelectedShuttleDeparture && selectedShuttleDeparture !== time) {
                  setSelectedShuttleDeparture(time);
                }
              }}
            />
          ) : (
            <>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  marginBottom: 20,
                  color: "#1C1C1E",
                }}
              >
                Journey Details
              </Text>
              {transitItineraries[0] ? (
                <TransitLegTimeline
                  itinerary={transitItineraries[0]}
                  styles={styles}
                  formatTime={formatTime}
                  alwaysShowIntermediateStops
                  stopKeyPrefix="shuttle-journey"
                />
              ) : (
                <Text style={{ fontSize: 15, color: "#666", marginTop: 10, textAlign: "center" }}>
                  No shuttles at this time.
                </Text>
              )}
            </>
          )
        ) : hasTransitItineraries ? (
          showTransitJourneyDetails ? (
            <>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  marginBottom: 20,
                  color: "#1C1C1E",
                }}
              >
                Journey Details
              </Text>

              {transitItineraries[selectedItineraryIndex] && (
                <TransitLegTimeline
                  itinerary={transitItineraries[selectedItineraryIndex]}
                  styles={styles}
                  formatTime={formatTime}
                  alwaysShowIntermediateStops
                  stopKeyPrefix={`journey-${selectedItineraryIndex}`}
                />
              )}
            </>
          ) : (
            <>
              {transitItineraries.map((itinerary: any, index: any) => {
                const isExpanded = expandedItineraries.includes(index);
                const isSelected = index === selectedItineraryIndex;

                return (
                  <TransitItineraryCard
                    key={index}
                    itinerary={itinerary}
                    index={index}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    setSelectedItineraryIndex={setSelectedItineraryIndex}
                    setRouteDurationMinutes={setRouteDurationMinutes}
                    setRouteDistanceMeters={setRouteDistanceMeters}
                    setRouteInstructions={setRouteInstructions}
                    setExpandedItineraries={setExpandedItineraries}
                    formatTime={formatTime}
                    styles={styles}
                    expandedIntermediateStops={expandedIntermediateStops}
                    setExpandedIntermediateStops={setExpandedIntermediateStops}
                  />
                );
              })}
            </>
          )
        ) : (
          routeInstructions.map((instruction: any, index: any) => (
            <Text
              key={`${index}-${instruction.text}`}
              style={styles.routeStepText}
            >
              {`${index + 1}. ${instruction.text}`}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const RoomInputGroup = ({
  building,
  room,
  setRoom,
  styles,
  getRoomDetails,
  getFloorPlanAsset,
  setActiveFloorPlan,
  setFloorPlanModalVisible,
}: any) => {
  if (!building) return null;

  const details = getRoomDetails(building.code, room);
  const floorKey = details ? `${details.buildingCode}-${details.floor}` : null;
  const hasPlan = !!floorKey && getFloorPlanAsset(floorKey) !== null;

  return (
    <View style={styles.roomInputContainer}>
      <TextInput
        style={styles.roomInput}
        placeholder="Room #"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={room}
        onChangeText={setRoom}
        keyboardType="default"
      />
      <Pressable
        style={
          hasPlan
            ? styles.floorPlanButtonActive
            : styles.floorPlanButtonDisabled
        }
        disabled={!hasPlan}
        accessibilityLabel="View Floor Plan"
        onPress={() => {
          if (floorKey) {
            setActiveFloorPlan(getFloorPlanAsset(floorKey));
            setFloorPlanModalVisible(true);
          }
        }}
      >
        <Map size={16} color={hasPlan ? "#FFFFFF" : "rgba(255,255,255,0.3)"} />
      </Pressable>
    </View>
  );
};

const TransportModeSelector = ({
  isDirectionsMode,
  isSameCampus,
  routeMode,
  setRouteMode,
  modeDurations,
  setRouteStarted,
  routeInstructionsDismissedRef,
  setShowRouteInstructions,
  clearDirections,
  styles,
  formatDuration,
}: any) => {
  if (!isDirectionsMode) return null;

  if (isSameCampus) {
    return (
      <View style={styles.modeSelectorGrid}>
        <View style={styles.modeSelectorRow}>
          <Pressable
            testID="route-mode-walking"
            style={[styles.modePill, styles.modePillActive]}
          >
            <Text style={[styles.modePillText, styles.modePillTextActive]}>
              Walk{" "}
              {modeDurations.walking !== null
                ? formatDuration(modeDurations.walking)
                : "—"}
            </Text>
          </Pressable>
          <Text style={styles.sameCampusHint}>Same campus</Text>
          <Pressable
            testID="direction-exit-button"
            style={styles.modeActionButton}
            onPress={clearDirections}
          >
            <Text style={styles.modeActionButtonText}>Exit</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.modeSelectorGrid}>
      <View style={styles.modeSelectorRow}>
        <View style={styles.modePillGroup}>
          <Pressable
            testID="route-mode-walking"
            style={[
              styles.modePill,
              routeMode === "walking" && styles.modePillActive,
            ]}
            onPress={() => setRouteMode("walking")}
          >
            <Text
              style={[
                styles.modePillText,
                routeMode === "walking" && styles.modePillTextActive,
              ]}
            >
              Bike -{" "}
              {modeDurations.walking !== null
                ? formatDuration(modeDurations.walking)
                : "—"}
            </Text>
          </Pressable>
          <Pressable
            testID="route-mode-driving"
            style={[
              styles.modePill,
              routeMode === "driving" && styles.modePillActive,
            ]}
            onPress={() => setRouteMode("driving")}
          >
            <Text
              style={[
                styles.modePillText,
                routeMode === "driving" && styles.modePillTextActive,
              ]}
            >
              Car -{" "}
              {modeDurations.driving !== null
                ? formatDuration(modeDurations.driving)
                : "—"}
            </Text>
          </Pressable>
        </View>
        <Pressable
          testID="direction-start-button"
          style={styles.modeActionButton}
          onPress={() => {
            setRouteStarted(true);
            routeInstructionsDismissedRef.current = false;
            setShowRouteInstructions(true);
          }}
        >
          <Text style={styles.modeActionButtonText}>Start</Text>
        </Pressable>
      </View>

      <View style={styles.modeSelectorRow}>
        <View style={styles.modePillGroup}>
          <Pressable
            testID="route-mode-transit"
            style={[
              styles.modePill,
              routeMode === "transit" && styles.modePillActive,
            ]}
            onPress={() => setRouteMode("transit")}
          >
            <Text
              style={[
                styles.modePillText,
                routeMode === "transit" && styles.modePillTextActive,
              ]}
            >
              Public Transit -{" "}
              {modeDurations.transit !== null
                ? formatDuration(modeDurations.transit)
                : "—"}
            </Text>
          </Pressable>
          <Pressable
            testID="route-mode-shuttle"
            style={[
              styles.modePill,
              routeMode === "shuttle" && styles.modePillActive,
            ]}
            onPress={() => setRouteMode("shuttle")}
          >
            <Text
              style={[
                styles.modePillText,
                routeMode === "shuttle" && styles.modePillTextActive,
              ]}
            >
              Shuttle
            </Text>
          </Pressable>
        </View>
        <Pressable
          testID="direction-exit-button"
          style={styles.modeActionButton}
          onPress={clearDirections}
        >
          <Text style={styles.modeActionButtonText}>Exit</Text>
        </Pressable>
      </View>
    </View>
  );
};

const DirectionsPanel = ({
  setSearchText,
  setEditingField,
  searchInputRef,
  editingField,
  originBuilding,
  destinationBuilding,
  clearDirections,
  isDirectionsMode,
  isSameCampus,
  routeMode,
  setRouteMode,
  modeDurations,
  setRouteStarted,
  routeInstructionsDismissedRef,
  setShowRouteInstructions,
  styles,
  formatDuration,
  // newly added props from main
  originRoom,
  setOriginRoom,
  destinationRoom,
  setDestinationRoom,
  setActiveFloorPlan,
  setFloorPlanModalVisible,
  getRoomDetails,
  getFloorPlanAsset,
}: any) => {
  return (
    <View style={styles.directionsPanel} testID="directions-panel">
      <View style={styles.directionFieldRow}>
        {/* FROM FIELD */}
        <View style={{ flex: 1 }}>
          <Pressable
            testID="direction-from-button"
            onPress={() => {
              setEditingField("from");
              searchInputRef.current?.focus?.();
            }}
            style={[
              styles.directionFieldButton,
              editingField === "from" && styles.directionFieldButtonActive,
            ]}
          >
            <Text style={styles.directionFieldLabel}>FROM</Text>
            <Text
              style={styles.directionFieldValue}
              numberOfLines={1}
              ellipsizeMode="tail"
              testID={
                originBuilding
                  ? `direction-from-value-${originBuilding.code}`
                  : "direction-from-value-empty"
              }
            >
              {originBuilding
                ? `${originBuilding.code} - ${originBuilding.shortName}`
                : "Current location"}
            </Text>
          </Pressable>
          {/* Origin Room Input + Icon Button */}
          <RoomInputGroup
            building={originBuilding}
            room={originRoom}
            setRoom={setOriginRoom}
            styles={styles}
            getRoomDetails={getRoomDetails}
            getFloorPlanAsset={getFloorPlanAsset}
            setActiveFloorPlan={setActiveFloorPlan}
            setFloorPlanModalVisible={setFloorPlanModalVisible}
          />
        </View>

        {/* TO FIELD */}
        <View style={{ flex: 1 }}>
          <Pressable
            testID="direction-to-button"
            onPress={() => {
              setEditingField("to");
              setSearchText("");
              searchInputRef.current?.focus?.();
            }}
            style={[
              styles.directionFieldButton,
              editingField === "to" && styles.directionFieldButtonActive,
            ]}
          >
            <Text style={styles.directionFieldLabel}>TO</Text>
            <Text
              style={styles.directionFieldValue}
              numberOfLines={1}
              ellipsizeMode="tail"
              testID={
                destinationBuilding
                  ? `direction-to-value-${destinationBuilding.code}`
                  : "direction-to-value-empty"
              }
            >
              {destinationBuilding
                ? `${destinationBuilding.code} - ${destinationBuilding.shortName}`
                : "Where to?"}
            </Text>
          </Pressable>
          {/* Destination Room Input + Icon Button */}
          <RoomInputGroup
            building={destinationBuilding}
            room={destinationRoom}
            setRoom={setDestinationRoom}
            styles={styles}
            getRoomDetails={getRoomDetails}
            getFloorPlanAsset={getFloorPlanAsset}
            setActiveFloorPlan={setActiveFloorPlan}
            setFloorPlanModalVisible={setFloorPlanModalVisible}
          />
        </View>

        {/* GO / CANCEL BUTTON */}
        <Pressable
          testID="direction-go-button"
          onPress={clearDirections}
          style={styles.clearRouteButton}
        >
          <Text style={styles.clearRouteText}>
            {isDirectionsMode ? "Cancel" : "Go"}
          </Text>
        </Pressable>
      </View>

      <TransportModeSelector
        isDirectionsMode={isDirectionsMode}
        isSameCampus={isSameCampus}
        routeMode={routeMode}
        setRouteMode={setRouteMode}
        modeDurations={modeDurations}
        setRouteStarted={setRouteStarted}
        routeInstructionsDismissedRef={routeInstructionsDismissedRef}
        setShowRouteInstructions={setShowRouteInstructions}
        clearDirections={clearDirections}
        styles={styles}
        formatDuration={formatDuration}
      />
    </View>
  );
};

export default function MapScreen() {
  // Tracks whether the user is editing the start or destination
  const [editingField, setEditingField] = useState<"from" | "to" | undefined>(
    undefined,
  );
  const [floorPlanModalVisible, setFloorPlanModalVisible] = useState(false);
  const [activeFloorPlan, setActiveFloorPlan] = useState<any>(null);
  const [campus, setCampus] = useState<Campus>("SGW");
  const [searchText, setSearchText] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [destinationBuildingCode, setDestinationBuildingCode] =
    useState<string>(DEFAULT_DESTINATION_BUILDING_CODE);
  // Tracks the selected origin building (or null if using current location)
  const [originBuildingCode, setOriginBuildingCode] = useState<string | null>(
    null,
  );
  const [originRoom, setOriginRoom] = useState<string>("");
  const [destinationRoom, setDestinationRoom] = useState<string>("");
  const [isDirectionsMode, setIsDirectionsMode] = useState(false);
  const [routeMode, setRouteMode] = useState<
    RouteProfile | "transit" | "shuttle"
  >("walking");
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [, setRouteDurationMinutes] = useState<number | null>(null);
  const [, setRouteDistanceMeters] = useState<number | null>(null);
  const [, setRouteLoading] = useState(false);
  const [, setRouteError] = useState<string | null>(null);
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

const [selectedShuttleDeparture, setSelectedShuttleDeparture] = useState<string | null>(null);
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
    isWebPlatform && typeof window !== "undefined"
      ? window.location.origin
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

  // Styles defined inside component
  const styles = StyleSheet.create({
    floorPlanButtonActive: {
      width: 34,
      height: 30,
      backgroundColor: "rgba(35, 140, 81, 0.8)",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#238c51",
      justifyContent: "center",
      alignItems: "center",
    },
    floorPlanButtonTextActive: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: "90%",
      height: "75%",
      backgroundColor: "white",
      borderRadius: 20,
      overflow: "hidden",
      position: "relative",
    },
    modalCloseButton: {
      position: "absolute",
      top: 16,
      right: 16,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#F5F5F6",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    floorPlanImage: {
      width: "100%",
      height: "100%",
    },
    roomInput: {
      flex: 1,
      height: 30,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
      color: "white",
      paddingHorizontal: 8,
      fontSize: 12,
    },
    roomInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 6,
    },
    floorPlanButtonDisabled: {
      width: 34,
      height: 30,
      backgroundColor: "rgba(255,255,255,0.03)",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      justifyContent: "center",
      alignItems: "center",
    },
    floorPlanButtonTextDisabled: {
      color: "rgba(255,255,255,0.3)",
      fontSize: 11,
      fontWeight: "700",
    },
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
    campusMarkerContainer: {
      alignItems: "center",
      justifyContent: "center",
    },
    campusMarkerBadge: {
      minWidth: 38,
      height: 38,
      paddingHorizontal: 10,
      backgroundColor: "#A32638",
      borderWidth: 2,
      borderColor: "white",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
      borderRadius: 19,
    },
    campusMarkerText: {
      color: "white",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.2,
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
      alignSelf: "stretch",
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
      letterSpacing: 0.4,
      lineHeight: 14,
      minHeight: 14,
    },
    directionFieldValue: {
      color: "white",
      fontSize: 13,
      marginTop: 3,
      fontWeight: "600",
      lineHeight: 18,
      minHeight: 18,
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
    itineraryCard: {
      backgroundColor: "white",
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
      borderWidth: 2,
      borderColor: "#E5E5EA",
    },
    itineraryCardActive: {
      borderColor: "#007AFF",
      backgroundColor: "#F0F7FF",
    },
    itineraryTime: {
      fontSize: 16,
      fontWeight: "700",
      color: "#1C1C1E",
      marginBottom: 4,
    },
    itineraryDuration: {
      fontSize: 13,
      color: "#3A3A3C",
      marginBottom: 2,
    },
    itineraryTransfers: {
      fontSize: 12,
      color: "#8E8E93",
      marginBottom: 8,
    },
    itineraryLegsRow: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
    },
    legPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      fontSize: 12,
      fontWeight: "600",
    },
    legPillWalk: {
      backgroundColor: "#E8F5E9",
      color: "#2E7D32",
    },
    legPillBus: {
      backgroundColor: "#FFF3E0",
      color: "#E65100",
    },
    legPillSubway: {
      backgroundColor: "#E3F2FD",
      color: "#1565C0",
    },
    legPillTram: {
      backgroundColor: "#F3E5F5",
      color: "#6A1B9A",
    },
    legDetailRow: {
      flexDirection: "row",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: "#F0F0F0",
    },
    legDetailTime: {
      width: 60,
      fontSize: 13,
      fontWeight: "600",
      color: "#1C1C1E",
    },
    legDetailLine: {
      width: 20,
      alignItems: "center",
      marginRight: 8,
    },
    legDetailContent: {
      flex: 1,
      fontSize: 13,
      color: "#3A3A3C",
    },
    timelineContainer: {
      flexDirection: "row",
      marginBottom: 8,
    },
    timelineLeft: {
      width: 60,
      alignItems: "flex-end",
      paddingRight: 12,
    },
    timelineCenter: {
      width: 40,
      alignItems: "center",
      position: "relative",
    },
    timelineIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "white",
      borderWidth: 2,
      zIndex: 2,
    },
    timelineIconWalk: {
      borderColor: "#2E7D32",
      backgroundColor: "#E8F5E9",
    },
    timelineIconTransit: {
      borderColor: "#007AFF",
      backgroundColor: "#E3F2FD",
    },
    timelineLine: {
      position: "absolute",
      width: 3,
      top: 32,
      bottom: -8,
      backgroundColor: "#E5E5EA",
      left: "50%",
      marginLeft: -1.5,
    },
    timelineLineWalk: {
      backgroundColor: "#2E7D32",
    },
    timelineLineTransit: {
      backgroundColor: "#007AFF",
    },
    timelineRight: {
      flex: 1,
      paddingLeft: 8,
    },
    timelineTime: {
      fontSize: 15,
      fontWeight: "700",
      color: "#1C1C1E",
      marginBottom: 4,
    },
    timelineStopName: {
      fontSize: 14,
      fontWeight: "600",
      color: "#1C1C1E",
      marginBottom: 6,
    },
    timelineWalkDetail: {
      fontSize: 13,
      color: "#6A6A75",
      marginBottom: 4,
    },
    timelineRoutePill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      marginBottom: 6,
    },
    timelineRoutePillBus: {
      backgroundColor: "#007AFF",
    },
    timelineRoutePillSubway: {
      backgroundColor: "#007AFF",
    },
    timelineRoutePillTram: {
      backgroundColor: "#9C27B0",
    },
    timelineRouteText: {
      fontSize: 13,
      fontWeight: "700",
      color: "white",
      marginLeft: 6,
    },
    timelineHeadsign: {
      fontSize: 13,
      color: "#3A3A3C",
      marginTop: 2,
    },
    sameCampusHint: {
      color: "rgba(255,255,255,0.55)",
      fontSize: 11,
      fontStyle: "italic",
      alignSelf: "center",
      flex: 1,
      marginLeft: 8,
    },
    modeSelectorGrid: {
      marginTop: 10,
      gap: 8,
    },
    modeSelectorRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    modePill: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.28)",
      backgroundColor: "rgba(255,255,255,0.10)",
      alignItems: "center",
      justifyContent: "center",
    },
    modePillActive: {
      backgroundColor: "#D2E9FF",
      borderColor: "#95C6F3",
    },
    modePillText: {
      color: "white",
      fontSize: 13,
      fontWeight: "700",
    },
    modePillTextActive: {
      color: "#123B5D",
    },
    modePillSpacer: {
      flex: 1,
    },
    modePillGroup: {
      flex: 1,
      flexDirection: "row",
      gap: 8,
    },
    modeActionButton: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    modeActionButtonText: {
      color: "white",
      fontSize: 13,
      fontWeight: "700",
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

    const handleShuttleRoute = async () => {
      setRouteCoordinates([]);
      setRouteDurationMinutes(30);
      setRouteDistanceMeters(null);
      setRouteInstructions([{ text: "Shuttle Journey", distanceMeters: 0 }]);
      setTransitItineraries([]);
      setShuttleWalkToCoords([]);
      setShuttleDriveCoords([]);
      setShuttleWalkFromCoords([]);

      if (!routeInstructionsDismissedRef.current) {
        setShowRouteInstructions(true);
      }

      try {
        const nearest = getNearestStop(actualOriginPoint);
        const originStopCoords = STOPS[nearest.stop];
        const destStopCoords = STOPS[nearest.destination];

        const mockedNow = new Date();

        const shuttleInfo = getShuttleInfo(nearest.stop as any, mockedNow);
        if (shuttleInfo.serviceUnavailable) {
          if (cancelled) return;
          setRouteLoading(false);
          return;
        }

        const [walkTo, drive, walkFrom] = await Promise.all([
          fetchOsrmRoute(actualOriginPoint, originStopCoords, "walking"),
          fetchOsrmRoute(originStopCoords, destStopCoords, "driving"),
          fetchOsrmRoute(destStopCoords, destinationBuilding, "walking"),
        ]);

        if (cancelled) return;

        const instructions: RouteInstruction[] = [];
        if (walkTo.instructions) instructions.push(...walkTo.instructions);

        const walkToMinutes = Math.round(walkTo.durationSeconds / 60);
        const arrivalAtStopDate = new Date(mockedNow);
        arrivalAtStopDate.setMinutes(arrivalAtStopDate.getMinutes() + walkToMinutes);

        let validDeparture: Date | undefined;

        if (selectedShuttleDeparture) {
          const [h, m] = selectedShuttleDeparture.split(':').map(Number);
          validDeparture = new Date(mockedNow);
          validDeparture.setHours(h, m, 0, 0);
          if (validDeparture < mockedNow && h < 5) validDeparture.setDate(validDeparture.getDate() + 1);
        } else {
          const activeDepartures = shuttleInfo.nextThreeDepartures.map((t: string) => {
            const [h, m] = t.split(':').map(Number);
            const d = new Date(mockedNow);
            d.setHours(h, m, 0, 0);
            if (d < mockedNow && h < 5) d.setDate(d.getDate() + 1); // handle overnight if needed
            return d;
          });
          validDeparture = activeDepartures.find((d: Date) => d >= arrivalAtStopDate) || activeDepartures[0];
        }

        let waitMinutes = 0;
        if (validDeparture) {
          const waitMs = validDeparture.getTime() - arrivalAtStopDate.getTime();
          waitMinutes = Math.max(0, Math.round(waitMs / 60000));
          instructions.push({ text: `Arrive at ${nearest.stop} shuttle stop. Wait for ${waitMinutes} minute(s).`, distanceMeters: 0 });

          const hh = validDeparture.getHours().toString().padStart(2, '0');
          const mm = validDeparture.getMinutes().toString().padStart(2, '0');
          const arrivalTimeString = calculateArrivalTime(`${hh}:${mm}`);

          const arrH = parseInt(arrivalTimeString.split(':')[0]);
          const arrM = parseInt(arrivalTimeString.split(':')[1]);
          const arrivalDate = new Date(validDeparture);
          arrivalDate.setHours(arrH, arrM, 0, 0);
          if (arrivalDate < validDeparture) arrivalDate.setDate(arrivalDate.getDate() + 1);

          instructions.push({ text: `Take the shuttle to ${nearest.destination} campus. Estimated arrival at ${arrivalTimeString}.`, distanceMeters: drive.distanceMeters });

          const walkToLeg = {
            mode: "WALK",
            from: { name: "Current Location", lat: actualOriginPoint.latitude, lon: actualOriginPoint.longitude },
            to: { name: `${nearest.stop} Shuttle Stop`, lat: originStopCoords.latitude, lon: originStopCoords.longitude },
            startTime: mockedNow.toISOString(),
            endTime: arrivalAtStopDate.toISOString(),
            distance: walkTo.distanceMeters,
            duration: walkTo.durationSeconds,
            legGeometry: null
          };

          const shuttleLeg = {
            mode: "BUS",
            route: "Shuttle",
            headsign: `${nearest.destination} Campus`,
            from: { name: `${nearest.stop} Shuttle Stop`, lat: originStopCoords.latitude, lon: originStopCoords.longitude },
            to: { name: `${nearest.destination} Shuttle Stop`, lat: destStopCoords.latitude, lon: destStopCoords.longitude },
            startTime: validDeparture.toISOString(),
            endTime: arrivalDate.toISOString(),
            distance: drive.distanceMeters,
            duration: Math.round((arrivalDate.getTime() - validDeparture.getTime()) / 1000),
            legGeometry: null
          };

          const walkFromLeg = {
            mode: "WALK",
            from: { name: `${nearest.destination} Shuttle Stop`, lat: destStopCoords.latitude, lon: destStopCoords.longitude },
            to: { name: destinationBuilding.shortName, lat: destinationBuilding.latitude, lon: destinationBuilding.longitude },
            startTime: arrivalDate.toISOString(),
            endTime: new Date(arrivalDate.getTime() + walkFrom.durationSeconds * 1000).toISOString(),
            distance: walkFrom.distanceMeters,
            duration: walkFrom.durationSeconds,
            legGeometry: null
          };

          const totalDuration = walkTo.durationSeconds + shuttleLeg.duration + walkFrom.durationSeconds + waitMinutes * 60;

          const transitItin: TransitItinerary = {
            durationSeconds: totalDuration,
            distanceMeters: walkTo.distanceMeters + drive.distanceMeters + walkFrom.distanceMeters,
            transfers: 0,
            departureTime: new Date().toISOString(),
            arrivalTime: walkFromLeg.endTime,
            legs: [walkToLeg, shuttleLeg, walkFromLeg],
            instructions,
            coordinates: []
          };

          setTransitItineraries([transitItin]);
        } else {
          instructions.push({ text: `Arrive at ${nearest.stop} shuttle stop.`, distanceMeters: 0 });
          instructions.push({ text: `Take the shuttle to ${nearest.destination} campus.`, distanceMeters: drive.distanceMeters });
        }

        if (walkFrom.instructions) instructions.push(...walkFrom.instructions);

        setRouteInstructions(instructions);
        setRouteDurationMinutes(Math.round((walkTo.durationSeconds + drive.durationSeconds + walkFrom.durationSeconds) / 60) + waitMinutes);
        setRouteDistanceMeters(walkTo.distanceMeters + drive.distanceMeters + walkFrom.distanceMeters);

        setShuttleWalkToCoords(walkTo.coordinates);
        setShuttleDriveCoords(drive.coordinates);
        setShuttleWalkFromCoords(walkFrom.coordinates);
        setRouteLoading(false);
      } catch (err) {
        if (cancelled) return;
        setRouteLoading(false);
      }
    };

    const handleTransitRoute = async () => {
      const itineraries = await fetchTransitItineraries(
        actualOriginPoint,
        destinationBuilding,
        new Date().toISOString(),
      );
      if (cancelled) return;
      setTransitItineraries(itineraries);
      setSelectedItineraryIndex(0);
      setExpandedItineraries([]);
      setRouteStarted(false);

      const firstRoute = itineraries[0];
      setRouteCoordinates([]);
      setRouteDurationMinutes(Math.round(firstRoute.durationSeconds / 60));
      setRouteDistanceMeters(firstRoute.distanceMeters);
      setRouteInstructions(firstRoute.instructions);
      if (
        firstRoute.instructions.length > 0 &&
        !routeInstructionsDismissedRef.current
      ) {
        setShowRouteInstructions(true);
      }
    };

    const handleOsrmRoute = async () => {
      const actualMode = (
        routeMode === "walking" && !isSameCampus ? "cycling" : routeMode
      ) as RouteProfile;
      const route = await fetchOsrmRoute(
        actualOriginPoint,
        destinationBuilding,
        actualMode,
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
    };

    const loadRoute = async () => {
      try {
        if (routeMode === "shuttle") {
          await handleShuttleRoute();
          return;
        }

        if (routeMode === "transit") {
          await handleTransitRoute();
        } else {
          await handleOsrmRoute();
        }
      } catch {
        if (cancelled) return;
        setRouteCoordinates([]);
        setRouteInstructions([]);
        setShowRouteInstructions(false);
        setTransitItineraries([]);
        setSelectedItineraryIndex(0);
        setExpandedItineraries([]);
        setExpandedIntermediateStops(new Set());
        setRouteStarted(false);
        routeInstructionsDismissedRef.current = false;
      } finally {
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

  const shouldRenderRoutePolyline =
    isDirectionsMode && MapPolylineComponent && routeCoordinates.length > 1;

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
              <Image
                source={activeFloorPlan}
                style={styles.floorPlanImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
