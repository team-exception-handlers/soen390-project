import { Map, Navigation } from "lucide-react-native";
import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { MapScreenStyles } from "../../styles/mapScreen.styles";
import type { BuildingRecord } from "../../constants/buildings";
import { RoomRecord } from "../../types/rooms";
import type { RouteProfile } from "../../utils/osrmDirections";

type RouteMode = RouteProfile | "transit" | "shuttle";
type EditingField = "from" | "to" | undefined;
type FloorPlanAsset = unknown | null;
type GetFloorPlanAsset = (key: string) => FloorPlanAsset;

type RoomInputGroupProps = Readonly<{
  building: BuildingRecord | null;
  room: string;
  setRoom: Dispatch<SetStateAction<string>>;
  styles: MapScreenStyles;
  getRoomDetails: (
    buildingCode: string,
    roomNumber: string,
  ) => RoomRecord | undefined;
  getFloorPlanAsset: GetFloorPlanAsset;
  setActiveFloorPlan: (asset: FloorPlanAsset) => void;
  setFloorPlanModalVisible: (visible: boolean) => void;
}>;

function RoomInputGroup({
  building,
  room,
  setRoom,
  styles,
  getRoomDetails,
  getFloorPlanAsset,
  setActiveFloorPlan,
  setFloorPlanModalVisible,
}: RoomInputGroupProps) {
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
}

type TransportModeSelectorProps = Readonly<{
  isDirectionsMode: boolean;
  isSameCampus: boolean;
  routeMode: RouteMode;
  setRouteMode: (routeMode: RouteMode) => void;
  modeDurations: Record<string, number | null>;
  setRouteStarted: (started: boolean) => void;
  routeInstructionsDismissedRef: MutableRefObject<boolean>;
  setShowRouteInstructions: (visible: boolean) => void;
  clearDirections: () => void;
  styles: MapScreenStyles;
  formatDuration: (minutes: number) => string;
}>;

function TransportModeSelector({
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
}: TransportModeSelectorProps) {
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
}

type DirectionsPanelProps = Readonly<{
  setSearchText: (text: string) => void;
  setEditingField: Dispatch<SetStateAction<EditingField>>;
  searchInputRef: RefObject<TextInput | null>;
  editingField: EditingField;
  originBuilding: BuildingRecord | null;
  destinationBuilding: BuildingRecord | null;
  clearDirections: () => void;
  isDirectionsMode: boolean;
  isSameCampus: boolean;
  routeMode: RouteMode;
  setRouteMode: (routeMode: RouteMode) => void;
  modeDurations: Record<string, number | null>;
  setRouteStarted: (started: boolean) => void;
  routeInstructionsDismissedRef: MutableRefObject<boolean>;
  setShowRouteInstructions: (visible: boolean) => void;
  styles: MapScreenStyles;
  formatDuration: (minutes: number) => string;
  originRoom: string;
  setOriginRoom: Dispatch<SetStateAction<string>>;
  destinationRoom: string;
  setDestinationRoom: Dispatch<SetStateAction<string>>;
  setActiveFloorPlan: (asset: FloorPlanAsset) => void;
  setFloorPlanModalVisible: (visible: boolean) => void;
  getRoomDetails: (
    buildingCode: string,
    roomNumber: string,
  ) => RoomRecord | undefined;
  getFloorPlanAsset: GetFloorPlanAsset;
  onShowIndoorDirections?: () => void;
  hasIndoorRoute?: boolean;
}>;

export default function DirectionsPanel({
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
  originRoom,
  setOriginRoom,
  destinationRoom,
  setDestinationRoom,
  setActiveFloorPlan,
  setFloorPlanModalVisible,
  getRoomDetails,
  getFloorPlanAsset,
  onShowIndoorDirections,
  hasIndoorRoute,
}: DirectionsPanelProps) {
  const isSameBuilding =
    originBuilding &&
    destinationBuilding &&
    originBuilding.code === destinationBuilding.code;
  const showIndoorButton =
    isSameBuilding && originRoom.trim() && destinationRoom.trim();

  return (
    <View style={styles.directionsPanel} testID="directions-panel">
      <View style={styles.directionFieldRow}>
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

      {showIndoorButton && (
        <Pressable
          testID="indoor-directions-button"
          style={styles.indoorRouteButton}
          onPress={onShowIndoorDirections}
        >
          <Navigation size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.indoorRouteButtonText}>
            {hasIndoorRoute === false
              ? "No Indoor Path Available"
              : "Indoor Directions"}
          </Text>
        </Pressable>
      )}

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
}
