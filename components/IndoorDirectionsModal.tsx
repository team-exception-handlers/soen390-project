import { ChevronDown, ChevronUp, Navigation, X } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Polyline, type SvgProps } from "react-native-svg";
import type { IndoorRoute } from "../utils/indoorDirections";

import Hall8Plan from "../assets/floor_plans/hall8.svg";
import Hall9Plan from "../assets/floor_plans/hall9.svg";
import H1Plan from "../assets/floor_plans/H1.svg";
import H2Plan from "../assets/floor_plans/H2.svg";
import CC1Plan from "../assets/floor_plans/CC1.svg";
import Ve1Plan from "../assets/floor_plans/ve1.svg";
import Ve2Plan from "../assets/floor_plans/ve2.svg";

type FloorPlanAsset =
  | { kind: "image"; source: any }
  | { kind: "svg"; component: React.ComponentType<SvgProps> };

const FLOOR_PLAN_ASSETS: Record<string, FloorPlanAsset> = {
  "H-1": { kind: "svg", component: H1Plan },
  "H-2": { kind: "svg", component: H2Plan },
  "H-8": { kind: "svg", component: Hall8Plan },
  "H-9": { kind: "svg", component: Hall9Plan },
  "MB-1": { kind: "image", source: require("../assets/floor_plans/mb_1.png") },
  "MB--2": { kind: "image", source: require("../assets/floor_plans/mb_s2.png") },
  "VE-1": { kind: "svg", component: Ve1Plan },
  "VE-2": { kind: "svg", component: Ve2Plan },
  "VL-1": { kind: "image", source: require("../assets/floor_plans/vl_1.png") },
  "VL-2": { kind: "image", source: require("../assets/floor_plans/vl_2.png") },
  "CC-1": { kind: "svg", component: CC1Plan },
};

function getFloorAsset(
  buildingCode: string,
  floor: number,
): FloorPlanAsset | null {
  const key = `${buildingCode}-${floor}`;
  return FLOOR_PLAN_ASSETS[key] ?? null;
}

type Props = Readonly<{
  visible: boolean;
  onClose: () => void;
  route: IndoorRoute | null;
  buildingCode: string;
  originRoom: string;
  destinationRoom: string;
  floorBounds: (floor: number) => { width: number; height: number };
}>;

export default function IndoorDirectionsModal({
  visible,
  onClose,
  route,
  buildingCode,
  originRoom,
  destinationRoom,
  floorBounds,
}: Props) {
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [stepsExpanded, setStepsExpanded] = useState(true);

  const formatFloorLabel = (floor: number | null): string => {
    if (floor === null) return "";
    if (buildingCode === "MB" && floor === -2) return "S2";
    return String(floor);
  };

  const effectiveFloor = activeFloor ?? (route ? route.startFloor : null);

  const uniqueFloors = route
    ? [...new Set(route.steps.map((s) => s.floor))].sort((a, b) => a - b)
    : [];

  const currentSegment = route?.segments.find(
    (s) => s.floor === effectiveFloor,
  );

  const floorAsset =
    effectiveFloor !== null
      ? getFloorAsset(buildingCode, effectiveFloor)
      : null;

  const bounds =
    effectiveFloor !== null
      ? floorBounds(effectiveFloor)
      : { width: 2000, height: 1500 };

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const scalePoint = useCallback(
    (x: number, y: number) => {
      if (containerSize.width === 0 || containerSize.height === 0)
        return { sx: 0, sy: 0 };
      const aspectRatio = bounds.width / bounds.height;
      const containerAspect = containerSize.width / containerSize.height;
      let drawW: number;
      let drawH: number;
      let offsetX = 0;
      let offsetY = 0;
      if (containerAspect > aspectRatio) {
        drawH = containerSize.height;
        drawW = drawH * aspectRatio;
        offsetX = (containerSize.width - drawW) / 2;
      } else {
        drawW = containerSize.width;
        drawH = drawW / aspectRatio;
        offsetY = (containerSize.height - drawH) / 2;
      }
      return {
        sx: offsetX + (x / bounds.width) * drawW,
        sy: offsetY + (y / bounds.height) * drawH,
      };
    },
    [containerSize, bounds],
  );

  const scaledPoints =
    currentSegment?.points.map(({ x, y }) => {
      const { sx, sy } = scalePoint(x, y);
      return { sx, sy };
    }) ?? [];

  const polylineStr = scaledPoints.map((p) => `${p.sx},${p.sy}`).join(" ");

  const startPoint = scaledPoints[0] ?? null;
  const endPoint =
    scaledPoints.length > 1 ? scaledPoints[scaledPoints.length - 1] : null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Navigation size={18} color="#238c51" strokeWidth={2} />
              <Text style={styles.headerTitle}>Indoor Directions</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={20} color="#1F1F24" strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Route summary */}
          <View style={styles.routeSummary}>
            <Text style={styles.routeFrom} numberOfLines={1}>
              {originRoom ? `Room ${originRoom}` : "Starting point"}
            </Text>
            <Text style={styles.routeArrow}>→</Text>
            <Text style={styles.routeTo} numberOfLines={1}>
              {destinationRoom ? `Room ${destinationRoom}` : "Destination"}
            </Text>
          </View>

          {!route ? (
            <View style={styles.noPathContainer}>
              <Text style={styles.noPathTitle}>No Indoor Path Available</Text>
              <Text style={styles.noPathBody}>
                There is no navigable indoor route between{" "}
                <Text style={{ fontWeight: "700" }}>room {originRoom}</Text> and{" "}
                <Text style={{ fontWeight: "700" }}>
                  room {destinationRoom}
                </Text>{" "}
                in this building. Please verify the room numbers or use an
                alternate route.
              </Text>
            </View>
          ) : (
            <>
              {/* Floor selector tabs */}
              {uniqueFloors.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.floorTabs}
                  contentContainerStyle={styles.floorTabsContent}
                >
                  {uniqueFloors.map((floor) => (
                    <Pressable
                      key={floor}
                      style={[
                        styles.floorTab,
                        effectiveFloor === floor && styles.floorTabActive,
                      ]}
                      onPress={() => setActiveFloor(floor)}
                    >
                      <Text
                        style={[
                          styles.floorTabText,
                          effectiveFloor === floor && styles.floorTabTextActive,
                        ]}
                      >
                      Floor {formatFloorLabel(floor)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Floor plan with route overlay */}
              <View style={styles.mapContainer} onLayout={onContainerLayout}>
                {floorAsset ? (
                  floorAsset.kind === "image" ? (
                    <Image
                      source={floorAsset.source}
                      style={styles.floorPlanImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Svg
                      width="100%"
                      height="100%"
                      preserveAspectRatio="xMidYMid meet"
                      viewBox="0 0 1024 1024"
                    >
                      <floorAsset.component width="100%" height="100%" />
                    </Svg>
                  )
                ) : (
                  <View style={styles.noMapPlaceholder}>
                    <Text style={styles.noMapText}>
                      Floor plan not available for floor{" "}
                      {formatFloorLabel(effectiveFloor)}
                    </Text>
                  </View>
                )}

                {/* SVG route overlay */}
                {containerSize.width > 0 && scaledPoints.length > 0 && (
                  <Svg
                    style={StyleSheet.absoluteFill}
                    width={containerSize.width}
                    height={containerSize.height}
                  >
                    {scaledPoints.length > 1 && (
                      <Polyline
                        points={polylineStr}
                        stroke="#238c51"
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        opacity={0.9}
                      />
                    )}
                    {startPoint && (
                      <Circle
                        cx={startPoint.sx}
                        cy={startPoint.sy}
                        r={8}
                        fill="#238c51"
                        stroke="white"
                        strokeWidth={2}
                      />
                    )}
                    {endPoint && (
                      <Circle
                        cx={endPoint.sx}
                        cy={endPoint.sy}
                        r={8}
                        fill="#D32F2F"
                        stroke="white"
                        strokeWidth={2}
                      />
                    )}
                  </Svg>
                )}
              </View>

              {/* Step-by-step instructions */}
              <Pressable
                style={styles.stepsHeader}
                onPress={() => setStepsExpanded((v) => !v)}
              >
                <Text style={styles.stepsHeaderText}>
                  Step-by-step directions
                </Text>
                {stepsExpanded ? (
                  <ChevronDown size={18} color="#1F1F24" />
                ) : (
                  <ChevronUp size={18} color="#1F1F24" />
                )}
              </Pressable>

              {stepsExpanded && (
                <ScrollView
                  style={styles.stepsList}
                  showsVerticalScrollIndicator={false}
                >
                  {route.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View style={styles.stepBullet}>
                        <Text style={styles.stepBulletText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step.instruction}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F1F24",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F6",
    alignItems: "center",
    justifyContent: "center",
  },
  routeSummary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: "#F8F9FA",
  },
  routeFrom: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#238c51",
  },
  routeArrow: {
    fontSize: 14,
    color: "#888",
  },
  routeTo: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#D32F2F",
    textAlign: "right",
  },
  routeDistance: {
    fontSize: 11,
    color: "#888",
    marginLeft: 4,
  },
  noPathContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFB300",
    alignItems: "center",
  },
  noPathTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E65100",
    marginBottom: 8,
  },
  noPathBody: {
    fontSize: 14,
    color: "#5D4037",
    textAlign: "center",
    lineHeight: 20,
  },
  floorTabs: {
    maxHeight: 44,
  },
  floorTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  floorTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "transparent",
  },
  floorTabActive: {
    backgroundColor: "#238c51",
    borderColor: "#1a6b3e",
  },
  floorTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  floorTabTextActive: {
    color: "#FFFFFF",
  },
  mapContainer: {
    height: 260,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F5F5F6",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  floorPlanImage: {
    width: "100%",
    height: "100%",
  },
  noMapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noMapText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
  },
  stepsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  stepsHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1F24",
  },
  stepsList: {
    maxHeight: 320,
    paddingHorizontal: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  stepBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#238c51",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepBulletText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
});
