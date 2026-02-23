// components/TransitTimeline.tsx
import { Bus, ChevronDown, ChevronUp, Footprints, MapPin, Train, TramFront } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { TransitItinerary } from "../utils/transitousDirections";

type Styles = Record<string, any>;

type Props = {
    itinerary: TransitItinerary;
    styles: Styles;
    formatTime: (iso: string) => string;
    /** if true, always show intermediate stops (Journey Details mode) */
    alwaysShowIntermediateStops?: boolean;
    /** if false, intermediate stops can be toggled per leg (Expanded itinerary mode) */
    canToggleIntermediateStops?: boolean;
    expandedStops?: Set<string>;
    onToggleStops?: (stopKey: string) => void;
    /** key prefix to make stopKeys unique across lists */
    stopKeyPrefix: string;
};

const LegIcon = ({ mode }: { mode: string }) => {
    if (mode === "WALK") return <Footprints size={20} color="#2E7D32" strokeWidth={2.5} />;
    if (mode === "BUS") return <Bus size={20} color="#007AFF" strokeWidth={2.5} />;
    if (mode === "SUBWAY") return <Train size={20} color="#007AFF" strokeWidth={2.5} />;
    return <TramFront size={20} color="#007AFF" strokeWidth={2.5} />;
};

const RouteIcon = ({ mode }: { mode: string }) => {
    if (mode === "BUS") return <Bus size={16} color="white" strokeWidth={2.5} />;
    if (mode === "SUBWAY") return <Train size={16} color="white" strokeWidth={2.5} />;
    return <TramFront size={16} color="white" strokeWidth={2.5} />;
};

function RoutePill({
    mode,
    route,
    styles,
}: {
    mode: string;
    route?: string;
    styles: Styles;
}) {
    const pillStyle =
        mode === "BUS"
            ? styles.timelineRoutePillBus
            : mode === "SUBWAY"
                ? styles.timelineRoutePillSubway
                : styles.timelineRoutePillTram;

    return (
        <View style={[styles.timelineRoutePill, pillStyle]}>
            <RouteIcon mode={mode} />
            <Text style={styles.timelineRouteText}>{route}</Text>
        </View>
    );
}

function IntermediateStopsList({
    stops,
    styles,
    formatTime,
    borderColor = "#007AFF",
}: {
    stops: { name: string; arrival: string }[];
    styles: Styles;
    formatTime: (iso: string) => string;
    borderColor?: string;
}) {
    return (
        <View style={{ marginLeft: 60, marginTop: -8, marginBottom: 8 }}>
            {stops.map((stop, stopIdx) => (
                <View
                    key={stopIdx}
                    style={{
                        flexDirection: "row",
                        paddingVertical: 6,
                        borderLeftWidth: 3,
                        borderLeftColor: borderColor,
                        paddingLeft: 28,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: "#3A3A3C",
                            width: 60,
                        }}
                    >
                        {formatTime(stop.arrival)}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#3A3A3C", flex: 1 }}>{stop.name}</Text>
                </View>
            ))}
        </View>
    );
}

function TimelineRow({
    left,
    center,
    right,
    styles,
}: {
    left: React.ReactNode;
    center: React.ReactNode;
    right: React.ReactNode;
    styles: Styles;
}) {
    return (
        <View style={styles.timelineContainer}>
            <View style={styles.timelineLeft}>{left}</View>
            <View style={styles.timelineCenter}>{center}</View>
            <View style={styles.timelineRight}>{right}</View>
        </View>
    );
}

export default function TransitLegTimeline({
    itinerary,
    styles,
    formatTime,
    alwaysShowIntermediateStops = false,
    canToggleIntermediateStops = false,
    expandedStops = new Set<string>(),
    onToggleStops,
    stopKeyPrefix,
}: Props) {
    return (
        <>
            {itinerary.legs.map((leg, legIndex) => {
                const isWalk = leg.mode === "WALK";
                const isLastLeg = legIndex === itinerary.legs.length - 1;
                const isFirstLeg = legIndex === 0;

                const stops = leg.intermediateStops ?? [];
                const hasIntermediateStops = !isWalk && stops.length > 0;

                const stopKey = `${stopKeyPrefix}-${legIndex}`;
                const isStopsExpanded = expandedStops.has(stopKey);

                // 1) Start-of-leg row
                const startLeft = (
                    <Text style={styles.timelineTime}>
                        {isFirstLeg && isWalk ? "Now" : formatTime(leg.startTime)}
                    </Text>
                );

                const startCenter = (
                    <>
                        <View style={[styles.timelineIcon, isWalk ? styles.timelineIconWalk : styles.timelineIconTransit]}>
                            <LegIcon mode={leg.mode} />
                        </View>
                        <View style={[styles.timelineLine, isWalk ? styles.timelineLineWalk : styles.timelineLineTransit]} />
                    </>
                );

                const startRight = (
                    <>
                        <Text style={styles.timelineStopName}>{leg.from.name}</Text>

                        {isWalk ? (
                            <Text style={styles.timelineWalkDetail}>
                                {Math.round(leg.duration / 60)} min Walk {Math.round(leg.distance)} m
                            </Text>
                        ) : (
                            <>
                                <Text style={{ fontSize: 12, color: "#007AFF", fontWeight: "600", marginBottom: 4 }}>
                                    Departs {formatTime(leg.startTime)}
                                </Text>

                                <RoutePill mode={leg.mode} route={leg.route} styles={styles} />

                                {!!leg.headsign && <Text style={styles.timelineHeadsign}>→ {leg.headsign}</Text>}

                                {hasIntermediateStops && (
                                    <>
                                        {alwaysShowIntermediateStops ? (
                                            <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>
                                                {stops.length} intermediate stop{stops.length > 1 ? "s" : ""}
                                            </Text>
                                        ) : canToggleIntermediateStops ? (
                                            <Pressable
                                                onPress={() => onToggleStops?.(stopKey)}
                                                style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}
                                            >
                                                {isStopsExpanded ? (
                                                    <ChevronUp size={14} color="#8E8E93" strokeWidth={2.5} />
                                                ) : (
                                                    <ChevronDown size={14} color="#8E8E93" strokeWidth={2.5} />
                                                )}
                                                <Text style={{ fontSize: 12, color: "#8E8E93", marginLeft: 4 }}>
                                                    {stops.length} intermediate stop{stops.length > 1 ? "s" : ""} (
                                                    {Math.round(leg.duration / 60)} min)
                                                </Text>
                                            </Pressable>
                                        ) : null}
                                    </>
                                )}
                            </>
                        )}
                    </>
                );

                // 2) Walk arrival row (if walk and not last leg)
                const walkArrivalRow =
                    isWalk && !isLastLeg ? (
                        <TimelineRow
                            styles={styles}
                            left={
                                <Text style={[styles.timelineTime, { fontSize: 13, color: "#6A6A75" }]}>
                                    {formatTime(leg.endTime)}
                                </Text>
                            }
                            center={
                                <>
                                    <View
                                        style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: 6,
                                            backgroundColor: "#D1D5DB",
                                            borderWidth: 2,
                                            borderColor: "white",
                                        }}
                                    />
                                    <View style={[styles.timelineLine, { backgroundColor: "#D1D5DB" }]} />
                                </>
                            }
                            right={
                                <>
                                    <Text style={{ fontSize: 13, color: "#6A6A75", fontWeight: "600" }}>{leg.to.name}</Text>
                                    <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>Arrive at stop</Text>
                                </>
                            }
                        />
                    ) : null;

                // 3) Final destination row (only last leg)
                const finalRow = isLastLeg ? (
                    <TimelineRow
                        styles={styles}
                        left={<Text style={styles.timelineTime}>{formatTime(leg.endTime)}</Text>}
                        center={
                            <View style={[styles.timelineIcon, { borderColor: "#EF4444", backgroundColor: "#FEE2E2" }]}>
                                <MapPin size={20} color="#EF4444" strokeWidth={2.5} />
                            </View>
                        }
                        right={<Text style={[styles.timelineStopName, { color: "#EF4444" }]}>{leg.to.name}</Text>}
                    />
                ) : null;

                const intermediateStopsBlock =
                    hasIntermediateStops && (alwaysShowIntermediateStops || (canToggleIntermediateStops && isStopsExpanded)) ? (
                        <IntermediateStopsList stops={stops} styles={styles} formatTime={formatTime} />
                    ) : null;

                return (
                    <React.Fragment key={legIndex}>
                        <TimelineRow styles={styles} left={startLeft} center={startCenter} right={startRight} />
                        {intermediateStopsBlock}
                        {walkArrivalRow}
                        {finalRow}
                    </React.Fragment>
                );
            })}
        </>
    );
}