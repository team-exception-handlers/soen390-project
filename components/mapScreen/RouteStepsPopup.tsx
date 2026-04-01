import { ChevronDown, ChevronUp, X } from "lucide-react-native";
import {
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type GestureResponderHandlers,
} from "react-native";
import type { BuildingRecord } from "../../constants/buildings";
import type { MapScreenStyles } from "../../styles/mapScreen.styles";
import type { RouteMode } from "../../types/map";
import type { RouteInstruction, RoutePoint } from "../../utils/osrmDirections";
import type { TransitItinerary } from "../../utils/transitousDirections";
import ShuttleDirections from "../ShuttleDirections";
import TransitLegTimeline from "../TransitLegTimeline";

function getLegColor(mode: string, styles: MapScreenStyles) {
  if (mode === "WALK") return styles.legPillWalk;
  if (mode === "BUS") return styles.legPillBus;
  if (mode === "SUBWAY") return styles.legPillSubway;
  if (mode === "TRAM") return styles.legPillTram;
  return styles.legPillBus;
}

type TransitItineraryCardProps = Readonly<{
  itinerary: TransitItinerary;
  index: number;
  isExpanded: boolean;
  isSelected: boolean;
  setSelectedItineraryIndex: (index: number) => void;
  setRouteDurationMinutes: (durationMinutes: number | null) => void;
  setRouteDistanceMeters: (distanceMeters: number | null) => void;
  setRouteInstructions: (instructions: RouteInstruction[]) => void;
  setExpandedItineraries: Dispatch<SetStateAction<number[]>>;
  formatTime: (iso: string) => string;
  styles: MapScreenStyles;
  expandedIntermediateStops: Set<string>;
  setExpandedIntermediateStops: Dispatch<SetStateAction<Set<string>>>;
}>;

function TransitItineraryCard({
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
}: TransitItineraryCardProps) {
  let transfersText = "Direct";
  if (itinerary.transfers > 0) {
    transfersText = `${itinerary.transfers} transfer${itinerary.transfers > 1 ? "s" : ""}`;
  }

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
              {transfersText}
            </Text>
            <View style={styles.itineraryLegsRow}>
            {itinerary.legs.map((leg) => (
                <Text
                key={`${leg.mode}-${leg.startTime}-${leg.endTime}`}
                  style={[styles.legPill, getLegColor(leg.mode, styles)]}
                >
                  {leg.mode === "WALK" ? "Walk" : leg.route || leg.mode}
                </Text>
              ))}
            </View>
          </View>

          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              setExpandedItineraries((previous) =>
                previous.includes(index)
                  ? previous.filter((item) => item !== index)
                  : [...previous, index],
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
              setExpandedIntermediateStops((previous) => {
                const next = new Set(previous);
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
}

export type RouteStepsPopupState = Readonly<{
  routeSheetPanResponder: { panHandlers: GestureResponderHandlers };
  routeMode: RouteMode;
  actualOriginPoint: RoutePoint | null;
  destinationBuilding: BuildingRecord | null;
  transitItineraries: TransitItinerary[];
  routeStarted: boolean;
  selectedItineraryIndex: number;
  expandedItineraries: number[];
  expandedIntermediateStops: Set<string>;
  routeInstructions: RouteInstruction[];
  selectedShuttleDeparture?: string | null;
}>;

export type RouteStepsPopupActions = Readonly<{
  hideInstructions: () => void;
  setSelectedItineraryIndex: (index: number) => void;
  setRouteDurationMinutes: (durationMinutes: number | null) => void;
  setRouteDistanceMeters: (distanceMeters: number | null) => void;
  setRouteInstructions: (instructions: RouteInstruction[]) => void;
  setExpandedItineraries: Dispatch<SetStateAction<number[]>>;
  setExpandedIntermediateStops: Dispatch<SetStateAction<Set<string>>>;
  setSelectedShuttleDeparture?: (time: string) => void;
  popupMaxHeight?: number;
}>;

export type RouteStepsPopupHelpers = Readonly<{
  formatTime: (iso: string) => string;
}>;

type RouteStepsPopupProps = Readonly<{
  state: RouteStepsPopupState;
  actions: RouteStepsPopupActions;
  helpers: RouteStepsPopupHelpers;
  styles: MapScreenStyles;
}>;

export default function RouteStepsPopup({
  state,
  actions,
  helpers,
  styles,
}: RouteStepsPopupProps) {
  const {
    routeSheetPanResponder,
    routeMode,
    actualOriginPoint,
    destinationBuilding,
    transitItineraries,
    routeStarted,
    selectedItineraryIndex,
    expandedItineraries,
    expandedIntermediateStops,
    routeInstructions,
    selectedShuttleDeparture,
  } = state;
  const {
    hideInstructions,
    setSelectedItineraryIndex,
    setRouteDurationMinutes,
    setRouteDistanceMeters,
    setRouteInstructions,
    setExpandedItineraries,
    setExpandedIntermediateStops,
    setSelectedShuttleDeparture,
    popupMaxHeight,
  } = actions;
  const { formatTime } = helpers;

  const hasTransitItineraries =
    routeMode === "transit" && transitItineraries.length > 0;
  const showTransitJourneyDetails = hasTransitItineraries && routeStarted;

  let content = null;

  if (routeMode === "shuttle") {
    if (routeStarted) {
      content = (
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
            <Text
              style={{
                fontSize: 15,
                color: "#666",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              No shuttles at this time.
            </Text>
          )}
        </>
      );
    } else {
      content = (
        <ShuttleDirections
          origin={actualOriginPoint}
          destination={destinationBuilding}
          routeStarted={routeStarted}
          routeInstructions={routeInstructions}
          onDepartureSelect={(time) => {
            if (
              setSelectedShuttleDeparture &&
              selectedShuttleDeparture !== time
            ) {
              setSelectedShuttleDeparture(time);
            }
          }}
        />
      );
    } 
  } else if (hasTransitItineraries) {
    if (showTransitJourneyDetails) {
      content = (
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
      );
    } else {
      content = (
        <>
          {transitItineraries.map((itinerary, index) => {
            const isExpanded = expandedItineraries.includes(index);
            const isSelected = index === selectedItineraryIndex;

            return (
              <TransitItineraryCard
                key={`${itinerary.departureTime}-${itinerary.arrivalTime}-${itinerary.transfers}-${itinerary.distanceMeters}`}
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
      );
    }
  } else {
    content = routeInstructions.length > 0
    ? routeInstructions.map((instruction, index) => (
      <Text
        key={`${instruction.text}-${instruction.distanceMeters}`}
        style={styles.routeStepText}
      >
        {`${index + 1}. ${instruction.text}`}
      </Text>
    )) : (
      <Text style={styles.routeStepText}>
        Route loaded. No step-by-step directions available.
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.routeStepsPopup,
        popupMaxHeight === undefined ? null : { maxHeight: popupMaxHeight },
      ]}
      testID="route-steps-popup"
    >
      <Pressable
        {...routeSheetPanResponder.panHandlers}
        style={styles.routeStepsHandle}
        onPress={hideInstructions}
      >
        <ChevronDown size={24} color="#1F1F24" strokeWidth={2.5} />
      </Pressable>
      <Pressable
        testID="route-steps-close-button"
        style={styles.routeStepsCloseButton}
        onPress={hideInstructions}
      >
        <X size={26} color="#1F1F24" strokeWidth={2.5} />
      </Pressable>

      <ScrollView
        style={styles.routeStepsList}
        contentContainerStyle={styles.routeStepsListContent}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    </View>
  );
}
