import {
    Coffee,
    Dumbbell,
    Landmark,
    Library,
    Pill,
    ShoppingCart,
    Toilet,
    UtensilsCrossed,
    X,
    type LucideIcon,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import type { Coordinates } from "../utils/locationLogic";
import {
    ALL_POI_CATEGORIES,
    fetchNearbyPOIs,
    filterPOIsByDistance,
    formatDistance,
    getCategoryLabel,
    getIndoorWashroomPOIs,
    sortPOIsByDistance,
    type POICategory,
    type POIResult,
} from "../utils/poiSearch";

const DISTANCE_OPTIONS = [
  { label: "500 m", meters: 500, km: 0.5 },
  { label: "1 km", meters: 1000, km: 1 },
  { label: "2 km", meters: 2000, km: 2 },
  { label: "5 km", meters: 5000, km: 5 },
];

const CATEGORY_ICONS: Record<POICategory, LucideIcon> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  washroom: Toilet,
  pharmacy: Pill,
  library: Library,
  gym: Dumbbell,
  bank: Landmark,
  grocery: ShoppingCart,
};

type Props = Readonly<{
  userLocation: Coordinates | null;
  onResultsChange?: (results: POIResult[]) => void;
  onClose: () => void;
  onSelectPOI?: (poi: POIResult) => void;
}>;

export default function POISearchPanel({
  userLocation,
  onResultsChange,
  onClose,
  onSelectPOI,
}: Props) {
  const [selectedCategory, setSelectedCategory] =
    useState<POICategory | null>(null);
  const [selectedDistance, setSelectedDistance] = useState(DISTANCE_OPTIONS[1]);
  const [results, setResults] = useState<POIResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (category: POICategory, distanceOption: (typeof DISTANCE_OPTIONS)[number]) => {
      if (!userLocation) {
        setError("Location not available. Please enable location services.");
        return;
      }

      setLoading(true);
      setError(null);
      setNoResults(false);

      try {
        const raw = await fetchNearbyPOIs(
          userLocation,
          category,
          distanceOption.meters,
        );

        // Merge indoor washroom data when searching washrooms
        if (category === "washroom") {
          const indoor = getIndoorWashroomPOIs(userLocation);
          const outdoorIds = new Set(raw.map((r) => r.id));
          for (const poi of indoor) {
            if (!outdoorIds.has(poi.id)) raw.push(poi);
          }
        }

        const filtered = filterPOIsByDistance(raw, distanceOption.km);
        const sorted = sortPOIsByDistance(filtered);

        setResults(sorted);
        onResultsChange?.(sorted);
        setNoResults(sorted.length === 0);
      } catch {
        setError("Failed to fetch nearby places. Please try again.");
        setResults([]);
        onResultsChange?.([]);
      } finally {
        setLoading(false);
      }
    },
    [userLocation, onResultsChange],
  );

  const handleCategoryPress = useCallback(
    (category: POICategory) => {
      setSelectedCategory(category);
      handleSearch(category, selectedDistance);
    },
    [selectedDistance, handleSearch],
  );

  const handleDistancePress = useCallback(
    (option: (typeof DISTANCE_OPTIONS)[number]) => {
      setSelectedDistance(option);
      if (selectedCategory) {
        handleSearch(selectedCategory, option);
      }
    },
    [selectedCategory, handleSearch],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Places</Text>
        <Pressable
          testID="poi-close-button"
          style={styles.closeButton}
          onPress={onClose}
        >
          <X size={18} color="#1F1F24" strokeWidth={2.5} />
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {ALL_POI_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            testID={`poi-category-${cat}`}
            style={[
              styles.chip,
              selectedCategory === cat && styles.chipActive,
            ]}
            onPress={() => handleCategoryPress(cat)}
          >
            {(() => {
              const Icon = CATEGORY_ICONS[cat];
              const isActive = selectedCategory === cat;
              return (
                <Icon
                  size={14}
                  color={isActive ? "#FFFFFF" : "#4A4A55"}
                  strokeWidth={2.25}
                />
              );
            })()}
            <Text
              style={[
                styles.chipText,
                selectedCategory === cat && styles.chipTextActive,
              ]}
            >
              {getCategoryLabel(cat)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Distance</Text>
      <View style={styles.distanceRow}>
        {DISTANCE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.label}
            testID={`poi-distance-${opt.meters}`}
            style={[
              styles.distanceChip,
              selectedDistance.meters === opt.meters &&
                styles.distanceChipActive,
            ]}
            onPress={() => handleDistancePress(opt)}
          >
            <Text
              style={[
                styles.distanceChipText,
                selectedDistance.meters === opt.meters &&
                  styles.distanceChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && (
        <View style={styles.statusRow} testID="poi-loading">
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.statusText}>Searching nearby places...</Text>
        </View>
      )}

      {error && (
        <View style={styles.statusRow} testID="poi-error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {noResults && !loading && (
        <View style={styles.statusRow} testID="poi-no-results">
          <Text style={styles.noResultsText}>
            No {selectedCategory ? getCategoryLabel(selectedCategory).toLowerCase() + "s" : "places"} found within{" "}
            {selectedDistance.label}. Try increasing the distance range.
          </Text>
        </View>
      )}

      {results.length > 0 && !loading && (
        <ScrollView style={styles.resultsList} testID="poi-results-list">
          {results.map((poi) => (
            <Pressable
              key={poi.id}
              style={({ pressed }) => [
                styles.resultItem,
                pressed && styles.resultItemPressed,
              ]}
              testID={`poi-result-${poi.id}`}
              onPress={() => onSelectPOI?.(poi)}
            >
              <View style={styles.resultHeader}>
                <View style={styles.resultNameWrap}>
                  {(() => {
                    const Icon = CATEGORY_ICONS[poi.category];
                    return (
                      <Icon
                        size={14}
                        color="#5D5D66"
                        strokeWidth={2.25}
                      />
                    );
                  })()}
                  <Text style={styles.resultName} numberOfLines={1}>
                    {poi.name}
                  </Text>
                </View>
                <Text style={styles.resultDistance}>
                  {formatDistance(poi.distance)}
                </Text>
              </View>
              {poi.address && (
                <Text style={styles.resultAddress} numberOfLines={1}>
                  {poi.address}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    maxHeight: 420,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F6F7FA",
    borderBottomWidth: 1,
    borderBottomColor: "#ECECF1",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1F24",
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E8E8ED",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5D5D66",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F0F0F5",
    borderWidth: 1,
    borderColor: "transparent",
    gap: 4,
  },
  chipActive: {
    backgroundColor: "#1668C7",
    borderColor: "#0d4a8c",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F1F24",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  distanceRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  distanceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F0F0F5",
    borderWidth: 1,
    borderColor: "transparent",
  },
  distanceChipActive: {
    backgroundColor: "#A32638",
    borderColor: "#7a1c2a",
  },
  distanceChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F1F24",
  },
  distanceChipTextActive: {
    color: "#FFFFFF",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: "#5D5D66",
  },
  errorText: {
    fontSize: 13,
    color: "#D32F2F",
    fontWeight: "500",
  },
  noResultsText: {
    fontSize: 13,
    color: "#5D5D66",
    fontStyle: "italic",
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  resultItemPressed: {
    backgroundColor: "#E8F0FE",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultNameWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 8,
  },
  resultName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F1F24",
  },
  resultDistance: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A32638",
    marginLeft: 8,
  },
  resultAddress: {
    marginTop: 2,
    fontSize: 12,
    color: "#6A6A75",
  },
});
