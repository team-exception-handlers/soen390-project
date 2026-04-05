// components/TransitTimeline.tsx
import { Bus, ChevronDown, ChevronUp, Footprints, MapPin, Train, TramFront } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { TransitItinerary, TransitLeg } from "../utils/transitousDirections";

type Styles = Record<string, any>;

type Props = Readonly<{
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
}>;

type TransitLegItemProps = Readonly<{
    leg: TransitLeg;
    legIndex: number;
    totalLegs: number;
    styles: Styles;
    formatTime: (iso: string) => string;
    alwaysShowIntermediateStops: boolean;
    canToggleIntermediateStops: boolean;
    expandedStops: Set<string>;
    onToggleStops?: (stopKey: string) => void;
    stopKeyPrefix: string;
}>;

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
}: Readonly<{
    mode: string;
    route?: string;
    styles: Styles;
}>) {
    const pillStyle = getRoutePillStyle(mode, styles);

    return (
        <View style={[styles.timelineRoutePill, pillStyle]}>
            <RouteIcon mode={mode} />
            <Text style={styles.timelineRouteText}>{route}</Text>
        </View>
    );
}

function getRoutePillStyle(mode: string, styles: Styles) {
    switch (mode) {
        case "BUS":
            return styles.timelineRoutePillBus;
        case "SUBWAY":
            return styles.timelineRoutePillSubway;
        default:
            return styles.timelineRoutePillTram;
    }
}

function IntermediateStopsList({
    stops,
    styles,
    formatTime,
    borderColor = "#007AFF",
}: Readonly<{
    stops: { name: string; arrival: string }[];
    styles: Styles;
    formatTime: (iso: string) => string;
    borderColor?: string;
}>) {
    return (
        <View style={{ marginLeft: 60, marginTop: -8, marginBottom: 8 }}>
            {stops.map((stop, stopIdx) => (
                <View
                    key={`stop-${stopIdx}-${stop.name}-${stop.arrival}`}
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
}: Readonly<{
    left: React.ReactNode;
    center: React.ReactNode;
    right: React.ReactNode;
    styles: Styles;
}>) {
    return (
        <View style={styles.timelineContainer}>
            <View style={styles.timelineLeft}>{left}</View>
            <View style={styles.timelineCenter}>{center}</View>
            <View style={styles.timelineRight}>{right}</View>
        </View>
    );
}


function TransitLegItem({
    leg,
    legIndex,
    totalLegs,
    styles,
    formatTime,
    alwaysShowIntermediateStops,
    canToggleIntermediateStops,
    expandedStops,
    onToggleStops,
    stopKeyPrefix,
}: TransitLegItemProps) {
    const isWalk = leg.mode === "WALK";
    const isFirstLeg = legIndex === 0;
    const isLastLeg = legIndex === totalLegs - 1;

    const stops = leg.intermediateStops ?? [];
    const hasIntermediateStops = !isWalk && stops.length > 0;

    const stopKey = `${stopKeyPrefix}-${legIndex}`;
    const isStopsExpanded = expandedStops.has(stopKey);
    const shouldShowIntermediateStops =
        hasIntermediateStops &&
        (alwaysShowIntermediateStops || (canToggleIntermediateStops && isStopsExpanded));

    return (
        <>
            <TimelineRow
                styles={styles}
                left={renderStartLeft(isFirstLeg, isWalk, leg.startTime, formatTime, styles)}
                center={renderStartCenter(isWalk, styles, leg.mode)}
                right={
                    <StartRightContent
                        leg={leg}
                        styles={styles}
                        formatTime={formatTime}
                        hasIntermediateStops={hasIntermediateStops}
                        stopsCount={stops.length}
                        alwaysShowIntermediateStops={alwaysShowIntermediateStops}
                        canToggleIntermediateStops={canToggleIntermediateStops}
                        isStopsExpanded={isStopsExpanded}
                        stopKey={stopKey}
                        onToggleStops={onToggleStops}
                    />
                }
            />

            {shouldShowIntermediateStops && (
                <IntermediateStopsList
                    stops={stops}
                    styles={styles}
                    formatTime={formatTime}
                />
            )}

            {isWalk && !isLastLeg && (
                <WalkArrivalRow leg={leg} styles={styles} formatTime={formatTime} />
            )}

            {isLastLeg && (
                <FinalDestinationRow leg={leg} styles={styles} formatTime={formatTime} />
            )}
        </>
    );
}

function renderStartLeft(
    isFirstLeg: boolean,
    isWalk: boolean,
    startTime: string,
    formatTime: (iso: string) => string,
    styles: Styles,
) {
    return (
        <Text style={styles.timelineTime}>
            {isFirstLeg && isWalk ? "Now" : formatTime(startTime)}
        </Text>
    );
}

function renderStartCenter(isWalk: boolean, styles: Styles, mode: string) {
    return (
        <>
            <View
                style={[
                    styles.timelineIcon,
                    isWalk ? styles.timelineIconWalk : styles.timelineIconTransit,
                ]}
            >
                <LegIcon mode={mode} />
            </View>
            <View
                style={[
                    styles.timelineLine,
                    isWalk ? styles.timelineLineWalk : styles.timelineLineTransit,
                ]}
            />
        </>
    );
}

function StartRightContent({
    leg,
    styles,
    formatTime,
    hasIntermediateStops,
    stopsCount,
    alwaysShowIntermediateStops,
    canToggleIntermediateStops,
    isStopsExpanded,
    stopKey,
    onToggleStops,
}: Readonly<{
    leg: TransitLeg;
    styles: Styles;
    formatTime: (iso: string) => string;
    hasIntermediateStops: boolean;
    stopsCount: number;
    alwaysShowIntermediateStops: boolean;
    canToggleIntermediateStops: boolean;
    isStopsExpanded: boolean;
    stopKey: string;
    onToggleStops?: (stopKey: string) => void;
}>) {
    if (leg.mode === "WALK") {
        return (
            <>
                <Text style={styles.timelineStopName}>{leg.from.name}</Text>
                <Text style={styles.timelineWalkDetail}>
                    {Math.round(leg.duration / 60)} min Walk {Math.round(leg.distance)} m
                </Text>
            </>
        );
    }

    return (
        <>
            <Text style={styles.timelineStopName}>{leg.from.name}</Text>

            <Text style={{ fontSize: 12, color: "#007AFF", fontWeight: "600", marginBottom: 4 }}>
                Departs {formatTime(leg.startTime)}
            </Text>

            <RoutePill mode={leg.mode} route={leg.route} styles={styles} />

            {!!leg.headsign && (
                <Text style={styles.timelineHeadsign}>→ {leg.headsign}</Text>
            )}

            {hasIntermediateStops && (
                <IntermediateStopsToggle
                    stopsCount={stopsCount}
                    durationMinutes={Math.round(leg.duration / 60)}
                    alwaysShowIntermediateStops={alwaysShowIntermediateStops}
                    canToggleIntermediateStops={canToggleIntermediateStops}
                    isStopsExpanded={isStopsExpanded}
                    onPress={() => onToggleStops?.(stopKey)}
                />
            )}
        </>
    );
}

function IntermediateStopsToggle({
    stopsCount,
    durationMinutes,
    alwaysShowIntermediateStops,
    canToggleIntermediateStops,
    isStopsExpanded,
    onPress,
}: Readonly<{
    stopsCount: number;
    durationMinutes: number;
    alwaysShowIntermediateStops: boolean;
    canToggleIntermediateStops: boolean;
    isStopsExpanded: boolean;
    onPress: () => void;
}>) {
    const stopLabel = `${stopsCount} intermediate stop${stopsCount > 1 ? "s" : ""}`;

    if (alwaysShowIntermediateStops) {
        return (
            <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>
                {stopLabel}
            </Text>
        );
    }

    if (!canToggleIntermediateStops) {
        return null;
    }

    return (
        <Pressable
            onPress={onPress}
            style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}
        >
            {isStopsExpanded ? (
                <ChevronUp size={14} color="#8E8E93" strokeWidth={2.5} />
            ) : (
                <ChevronDown size={14} color="#8E8E93" strokeWidth={2.5} />
            )}
            <Text style={{ fontSize: 12, color: "#8E8E93", marginLeft: 4 }}>
                {stopLabel} ({durationMinutes} min)
            </Text>
        </Pressable>
    );
}

function WalkArrivalRow({
    leg,
    styles,
    formatTime,
}: Readonly<{
    leg: TransitLeg;
    styles: Styles;
    formatTime: (iso: string) => string;
}>) {
    return (
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
                    <Text style={{ fontSize: 13, color: "#6A6A75", fontWeight: "600" }}>
                        {leg.to.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
                        Arrive at stop
                    </Text>
                </>
            }
        />
    );
}

function FinalDestinationRow({
    leg,
    styles,
    formatTime,
}: Readonly<{
    leg: TransitLeg;
    styles: Styles;
    formatTime: (iso: string) => string;
}>) {
    return (
        <TimelineRow
            styles={styles}
            left={<Text style={styles.timelineTime}>{formatTime(leg.endTime)}</Text>}
            center={
                <View
                    style={[
                        styles.timelineIcon,
                        { borderColor: "#EF4444", backgroundColor: "#FEE2E2" },
                    ]}
                >
                    <MapPin size={20} color="#EF4444" strokeWidth={2.5} />
                </View>
            }
            right={
                <Text style={[styles.timelineStopName, { color: "#EF4444" }]}>
                    {leg.to.name}
                </Text>
            }
        />
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
        {itinerary.legs.map((leg, legIndex) => (
                <TransitLegItem
                    key={`${stopKeyPrefix}-${legIndex}`}
                    leg={leg}
                    legIndex={legIndex}
                    totalLegs={itinerary.legs.length}
                    styles={styles}
                    formatTime={formatTime}
                    alwaysShowIntermediateStops={alwaysShowIntermediateStops}
                    canToggleIntermediateStops={canToggleIntermediateStops}
                    expandedStops={expandedStops}
                    onToggleStops={onToggleStops}
                    stopKeyPrefix={stopKeyPrefix}
                />
            ))}
        </>
    );
}