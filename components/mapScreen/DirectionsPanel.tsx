import { Map, Navigation } from "lucide-react-native";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { BuildingRecord } from "../../constants/buildings";
import type { MapScreenStyles } from "../../styles/mapScreen.styles";
import type { RouteMode } from "../../types/map";
import { RoomRecord } from "../../types/rooms";


type EditingField = "from" | "to" | undefined;
type GetFloorPlanAsset = (key: string) => unknown;

type RoomInputGroupProps = Readonly<{
  building: BuildingRecord | null;
  room: string;
  setRoom: Dispatch<SetStateAction<string>>;
  styles: MapScreenStyles;
  roomInputTestID?: string;
  getRoomDetails: (
    buildingCode: string,
    roomNumber: string,
  ) => RoomRecord | undefined;
  getFloorPlanAsset: GetFloorPlanAsset;
  openFloorPlanModal: (floorKey: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}>;

function RoomInputGroup({
  building,
  room,
  roomInputTestID,
  setRoom,
  styles,
  getRoomDetails,
  getFloorPlanAsset,
  openFloorPlanModal,
  onFocus,
  onBlur,
}: RoomInputGroupProps) {
  if (!building) return null;

  const details = getRoomDetails(building.code, room);
  const floorKey = details ? `${details.buildingCode}-${details.floor}` : null;
  const hasPlan = !!floorKey && getFloorPlanAsset(floorKey) !== null;

  return (
    <View style={styles.roomInputContainer}>
      <TextInput
        testID={roomInputTestID}
        style={styles.roomInput}
        placeholder="Room #"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={room}
        onChangeText={setRoom}
        keyboardType="default"
        onFocus={onFocus}
        onBlur={onBlur}
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
            openFloorPlanModal(floorKey);
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
  showRouteInstructions: () => void;
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
  showRouteInstructions,
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
              {modeDurations.walking === null
                ? "—"
                : formatDuration(modeDurations.walking)}
            </Text>
          </Pressable>
          <Text style={styles.sameCampusHint}>Same campus</Text>
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
              {modeDurations.walking === null
                ? "—"
                : formatDuration(modeDurations.walking)}
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
              {modeDurations.driving === null
                ? "—"
                : formatDuration(modeDurations.driving)}
            </Text>
          </Pressable>
        </View>
        <Pressable
          testID="direction-start-button"
          style={styles.modeActionButton}
          onPress={() => {
            setRouteStarted(true);
            showRouteInstructions();
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
              {modeDurations.transit === null
                ? "—"
                : formatDuration(modeDurations.transit)}
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
      </View>
    </View>
  );
}

export type DirectionsPanelState = Readonly<{
  searchInputRef: RefObject<TextInput | null>;
  editingField: EditingField;
  originBuilding: BuildingRecord | null;
  destinationBuilding: BuildingRecord | null;
  destinationPOIName?: string | null;
  isDirectionsMode: boolean;
  isSameCampus: boolean;
  routeMode: RouteMode;
  modeDurations: Record<string, number | null>;
  originRoom: string;
  destinationRoom: string;
  focusedRoom?: "from" | "to" | null;
  roomSuggestions?: string[];
  hasIndoorRoute?: boolean;
}>;

export type DirectionsPanelActions = Readonly<{
  setSearchText: (text: string) => void;
  setEditingField: Dispatch<SetStateAction<EditingField>>;
  clearDirections: () => void;
  setRouteMode: (routeMode: RouteMode) => void;
  setRouteStarted: (started: boolean) => void;
  showRouteInstructions: () => void;
  setOriginRoom: Dispatch<SetStateAction<string>>;
  setDestinationRoom: Dispatch<SetStateAction<string>>;
  openFloorPlanModal: (floorKey: string) => void;
  setFocusedRoom?: Dispatch<SetStateAction<"from" | "to" | null>>;
  onRoomSuggestionPressIn?: () => void;
  onRoomSuggestionSelect?: (room: string, field: "from" | "to") => void;

}>;

export type DirectionsPanelHelpers = Readonly<{
  getRoomDetails: (
    buildingCode: string,
    roomNumber: string,
  ) => RoomRecord | undefined;
  getFloorPlanAsset: GetFloorPlanAsset;
  formatDuration: (minutes: number) => string;
}>;

type DirectionsPanelProps = Readonly<{
  state: DirectionsPanelState;
  actions: DirectionsPanelActions;
  helpers: DirectionsPanelHelpers;
  styles: MapScreenStyles;
  onShowIndoorDirections?: () => void;
  onShowExitDirections?: () => void;
  hasExitRoute?: boolean;
  onShowEntryDirections?: () => void;
  hasEntryRoute?: boolean;
}>;

export default function DirectionsPanel({
  state,
  actions,
  helpers,
  styles,
  onShowIndoorDirections,
  onShowExitDirections,
  hasExitRoute,
  onShowEntryDirections,
  hasEntryRoute,
}: DirectionsPanelProps) {
  const {
    searchInputRef,
    editingField,
    originBuilding,
    destinationBuilding,
    destinationPOIName = null,
    isDirectionsMode,
    isSameCampus,
    routeMode,
    modeDurations,
    originRoom,
    destinationRoom,
    focusedRoom = null,
    roomSuggestions = [],
    hasIndoorRoute,
  } = state;
  const {
    setSearchText,
    setEditingField,
    clearDirections,
    setRouteMode,
    setRouteStarted,
    showRouteInstructions,
    setOriginRoom,
    setDestinationRoom,
    openFloorPlanModal,
    setFocusedRoom,
    onRoomSuggestionPressIn,
    onRoomSuggestionSelect,

  } = actions;
  const { getRoomDetails, getFloorPlanAsset, formatDuration } = helpers;

  const isSameBuilding =
    originBuilding?.code != null &&
    destinationBuilding?.code != null &&
    originBuilding.code === destinationBuilding.code;
  // Same-building: show room-to-room indoor directions button
  const showIndoorButton = isSameBuilding && originRoom.trim() && destinationRoom.trim();
  // Different buildings: show labeled exit button above transport selector
  const showExitButton = !isSameBuilding && originBuilding != null && originRoom.trim().length > 0;
  // Different buildings: show labeled entry button below transport selector (only when route exists)
  const showEntryButton =
    !isSameBuilding &&
    destinationBuilding != null &&
    destinationRoom.trim().length > 0 &&
    hasEntryRoute !== false;

  const destinationLabel = destinationBuilding
    ? `${destinationBuilding.code} - ${destinationBuilding.shortName}`
    : destinationPOIName || "Where to?";

  return (
    <View
      style={styles.directionsPanel}
      testID="directions-panel"
    >
      <View style={styles.directionFieldRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
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
            roomInputTestID={
              isDirectionsMode
                ? "direction-from-room-input"
                : "search-room-from-input"
            }
            styles={styles}
            getRoomDetails={getRoomDetails}
            getFloorPlanAsset={getFloorPlanAsset}
            openFloorPlanModal={openFloorPlanModal}
            onFocus={() => setFocusedRoom?.("from")}
            onBlur={() =>
              setTimeout(
                () =>
                  setFocusedRoom?.((prev) => (prev === "from" ? null : prev)),
                200,
              )
            }
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
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
              {destinationLabel}
            </Text>
          </Pressable>
          <RoomInputGroup
            building={destinationBuilding}
            room={destinationRoom}
            setRoom={setDestinationRoom}
            roomInputTestID={
              isDirectionsMode
                ? "direction-to-room-input"
                : "search-room-to-input"
            }
            styles={styles}
            getRoomDetails={getRoomDetails}
            getFloorPlanAsset={getFloorPlanAsset}
            openFloorPlanModal={openFloorPlanModal}
            onFocus={() => setFocusedRoom?.("to")}
            onBlur={() =>
              setTimeout(
                () => setFocusedRoom?.((prev) => (prev === "to" ? null : prev)),
                200,
              )
            }
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

      {focusedRoom != null && roomSuggestions.length > 0 && (
        <View style={styles.roomSuggestionsDropdownWrap}>
          <ScrollView
            testID="room-suggestions-list"
            style={styles.roomSuggestionsDropdown}
            contentContainerStyle={styles.roomSuggestionsDropdownContent}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.roomSuggestionsHeader}>
              <Text style={styles.roomSuggestionsHeaderText}>
                Suggested rooms
              </Text>
            </View>
            {roomSuggestions.map((label, index) => (
              <Pressable
                key={label}
                testID={`room-suggestion-index-${index}`}
                style={({ pressed }) => [
                  styles.roomSuggestionItem,
                  index === roomSuggestions.length - 1 &&
                  styles.roomSuggestionItemLast,
                  pressed && styles.roomSuggestionItemPressed,
                ]}
                onPressIn={onRoomSuggestionPressIn}
                onPress={() => {
                  if (focusedRoom) {
                    onRoomSuggestionSelect?.(label, focusedRoom);
                  }
                }}
              >
                <Text style={styles.roomSuggestionText}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {showIndoorButton && (
        <Pressable
          testID="indoor-directions-button"
          style={styles.indoorRouteButton}
          onPress={onShowIndoorDirections}
        >
          <Navigation size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.indoorRouteButtonText}>
            {hasIndoorRoute === false ? "No Indoor Path Available" : "Indoor Directions"}
          </Text>
        </Pressable>
      )}

      {showExitButton && (
        <Pressable
          testID="exit-directions-button"
          style={styles.indoorRouteButton}
          onPress={onShowExitDirections}
        >
          <Navigation size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.indoorRouteButtonText}>
            {hasExitRoute === false
              ? "No Indoor Path Available"
              : `Exit ${originBuilding?.shortName}`}
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
        showRouteInstructions={showRouteInstructions}
        clearDirections={clearDirections}
        styles={styles}
        formatDuration={formatDuration}
      />

      {showEntryButton && (
        <Pressable
          testID="entry-directions-button"
          style={styles.indoorRouteButton}
          onPress={onShowEntryDirections}
        >
          <Navigation size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.indoorRouteButtonText}>
            {`Enter ${destinationBuilding?.shortName}`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
