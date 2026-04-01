import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ChevronDown } from "lucide-react-native";
import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { FloorPlanOption } from "../utils/floorPlanCatalog";

type BuildingInformationProps = {
  readonly buildingCode: string | null;
  readonly onClose: () => void;
  readonly buildingName: string | undefined;
  readonly buildingInfo: string | undefined;
  readonly buildingPhotoLink: string | undefined;
  readonly onSelectDestination: (code: string) => void;
  readonly editingField?: "from" | "to";
  /** When non-empty, shows "See floor plans" next to directions. */
  readonly floorPlanOptions?: readonly FloorPlanOption[];
  readonly onOpenFloorPlans?: () => void;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const EXPANDED_HEIGHT = Math.min(420, SCREEN_HEIGHT * 0.6);
const COLLAPSED_HEIGHT = 0;

export default function BuildingInformation({
  buildingCode,
  onClose,
  buildingName,
  buildingInfo,
  buildingPhotoLink,
  onSelectDestination,
  editingField,
  floorPlanOptions = [],
  onOpenFloorPlans,
}: BuildingInformationProps) {
  const tabBarHeight = useBottomTabBarHeight();
  const heightAnimation = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.timing(heightAnimation, {
        toValue,
        duration: 220,
        useNativeDriver: false,
      }).start();
    },
    [heightAnimation],
  );

  useEffect(() => {
    if (!buildingCode) {
      animateTo(COLLAPSED_HEIGHT);
      return;
    }

    animateTo(EXPANDED_HEIGHT);
  }, [buildingCode, animateTo]);

  const handleGetDirections = useCallback(() => {
    if (!buildingCode) return;
    onSelectDestination(buildingCode);
  }, [buildingCode, onSelectDestination]);

  return (
    <View
      style={[styles.overlay, { bottom: tabBarHeight + 8 }]}
      pointerEvents="box-none"
    >
      <Animated.View
        testID="building-info-drawer"
        style={[styles.drawer, { height: heightAnimation }]}
      >
        <View style={styles.handleRow}>
          <Pressable
            testID="building-info-close"
            accessibilityRole="button"
            accessibilityLabel="Close building information"
            onPress={onClose}
            style={styles.closeBtn}
          >
            <ChevronDown size={24} color="#8e8e93" />
          </Pressable>

          <View style={styles.header}>
            <Text
              testID="building-info-title"
              style={styles.title}
              numberOfLines={1}
            >
              {buildingName}
            </Text>

            {buildingCode && (
              <View style={styles.headerActions}>
                <Pressable
                  testID="building-info-directions"
                  accessibilityRole="button"
                  accessibilityLabel="Get directions to this building"
                  style={({ pressed }) => [
                    styles.headerDirectionsButton,
                    pressed && styles.headerDirectionsButtonPressed,
                  ]}
                  onPress={handleGetDirections}
                >
                  <Text style={styles.headerDirectionsButtonText}>
                    {editingField === "from" ? "Start Here" : "Go There"}
                  </Text>
                </Pressable>
                {floorPlanOptions.length > 0 && onOpenFloorPlans ? (
                  <Pressable
                    testID="building-info-floor-plans"
                    accessibilityRole="button"
                    accessibilityLabel="See floor plans for this building"
                    style={({ pressed }) => [
                      styles.headerFloorPlansButton,
                      pressed && styles.headerFloorPlansButtonPressed,
                    ]}
                    onPress={onOpenFloorPlans}
                  >
                    <Text style={styles.headerFloorPlansButtonText}>
                      See floor plans
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>

        <ScrollView
          testID="building-info-content"
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {buildingPhotoLink ? (
            <Image
              style={styles.image}
              source={{ uri: buildingPhotoLink }}
              resizeMode="contain"
            />
          ) : null}

          <Text testID="building-info-description" style={styles.bodyText}>
            {buildingInfo || "Building information not available."}
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
  },

  drawer: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  handleRow: {
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },

  closeBtn: {
    alignSelf: "center",
    padding: 4,
    marginBottom: 6,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    padding: 14,
    paddingBottom: 22,
  },

  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },

  image: {
    width: "100%",
    height: 220,
    marginBottom: 14,
  },

  headerDirectionsButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  headerDirectionsButtonPressed: {
    opacity: 0.85,
  },

  headerDirectionsButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  headerFloorPlansButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1668C7",
    alignItems: "center",
    justifyContent: "center",
  },

  headerFloorPlansButtonPressed: {
    opacity: 0.85,
  },

  headerFloorPlansButtonText: {
    color: "#1668C7",
    fontSize: 13,
    fontWeight: "600",
  },
});
