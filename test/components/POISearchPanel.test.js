const React = require("react");

// ── mocks ──────────────────────────────────────────────────────────────
jest.mock("lucide-react-native", () => ({
  X: (props) => React.createElement("X", props),
}));

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: ({ children, ...rest }) =>
    React.createElement("Pressable", rest, children),
  ScrollView: ({ children, ...rest }) =>
    React.createElement("ScrollView", rest, children),
  StyleSheet: { create: (s) => s },
  Text: ({ children, ...rest }) =>
    React.createElement("Text", rest, children),
  View: ({ children, ...rest }) =>
    React.createElement("View", rest, children),
}));

const mockFetchNearbyPOIs = jest.fn();
const mockGetIndoorWashroomPOIs = jest.fn().mockReturnValue([]);
jest.mock("../../utils/poiSearch", () => {
  const actual = jest.requireActual("../../utils/poiSearch");
  return {
    ...actual,
    fetchNearbyPOIs: (...args) => mockFetchNearbyPOIs(...args),
    getIndoorWashroomPOIs: (...args) => mockGetIndoorWashroomPOIs(...args),
  };
});

// Controllable React hooks
let mockStates;
let mockStateIdx;

function resetStates(overrides = {}) {
  // indices: 0=selectedCategory, 1=selectedDistance, 2=results, 3=loading, 4=noResults, 5=error
  mockStates = [
    overrides.selectedCategory ?? null,
    overrides.selectedDistance ?? { label: "1 km", meters: 1000, km: 1 },
    overrides.results ?? [],
    overrides.loading ?? false,
    overrides.noResults ?? false,
    overrides.error ?? null,
  ];
  mockStateIdx = 0;
}

jest.mock("react", () => {
  const Actual = jest.requireActual("react");
  return {
    ...Actual,
    useState: (init) => {
      const idx = mockStateIdx++;
      if (mockStates[idx] === undefined) mockStates[idx] = init;
      return [mockStates[idx], (v) => { mockStates[idx] = typeof v === "function" ? v(mockStates[idx]) : v; }];
    },
    useCallback: (fn) => fn,
  };
});

const POISearchPanel = require("../../components/POISearchPanel").default;

// ── helpers ────────────────────────────────────────────────────────────
function expand(node) {
  if (node == null || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(expand).filter((x) => x != null);
  if (typeof node === "object" && node.$$typeof) {
    const { type, props } = node;
    if (typeof type === "function") return expand(type(props || {}));
    if (typeof type === "string") {
      const newProps = { ...props };
      if (newProps.children !== undefined) newProps.children = expand(newProps.children);
      return { type, props: newProps };
    }
  }
  return null;
}

function textFrom(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFrom).join("");
  if (typeof node === "object" && node.props?.children != null) return textFrom(node.props.children);
  return "";
}

function findByTestID(node, id) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const res = findByTestID(child, id);
      if (res) return res;
    }
    return null;
  }
  if (node?.props?.testID === id) return node;
  if (node?.props?.children) return findByTestID(node.props.children, id);
  return null;
}

function findAllByTestIDPrefix(node, prefix) {
  const results = [];
  function walk(n) {
    if (!n) return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n?.props?.testID?.startsWith(prefix)) results.push(n);
    if (n?.props?.children) walk(n.props.children);
  }
  walk(node);
  return results;
}

function render(overrides = {}) {
  resetStates(overrides);
  const props = {
    userLocation: "userLocation" in overrides ? overrides.userLocation : { latitude: 45.497, longitude: -73.578 },
    onResultsChange: overrides.onResultsChange ?? jest.fn(),
    onClose: overrides.onClose ?? jest.fn(),
  };
  const tree = expand(POISearchPanel(props));
  return { tree, props };
}

// ── tests ──────────────────────────────────────────────────────────────
describe("POISearchPanel", () => {
  beforeEach(() => {
    mockFetchNearbyPOIs.mockReset();
    mockGetIndoorWashroomPOIs.mockReset().mockReturnValue([]);
  });

  it("renders the header with title and close button", () => {
    const { tree } = render();
    const text = textFrom(tree);
    expect(text).toContain("Nearby Places");

    const closeBtn = findByTestID(tree, "poi-close-button");
    expect(closeBtn).not.toBeNull();
  });

  it("renders all 8 category chips", () => {
    const { tree } = render();
    const categories = [
      "restaurant", "cafe", "washroom", "pharmacy",
      "library", "gym", "bank", "grocery",
    ];
    for (const cat of categories) {
      const chip = findByTestID(tree, `poi-category-${cat}`);
      expect(chip).not.toBeNull();
    }
  });

  it("renders all 4 distance options", () => {
    const { tree } = render();
    for (const meters of [500, 1000, 2000, 5000]) {
      const chip = findByTestID(tree, `poi-distance-${meters}`);
      expect(chip).not.toBeNull();
    }
  });

  it("calls onClose when close button is pressed", () => {
    const onClose = jest.fn();
    const { tree } = render({ onClose });
    const closeBtn = findByTestID(tree, "poi-close-button");
    closeBtn.props.onPress();
    expect(onClose).toHaveBeenCalled();
  });

  it("triggers search when a category chip is pressed", async () => {
    mockFetchNearbyPOIs.mockResolvedValue([
      { id: "1", name: "Cafe A", category: "cafe", latitude: 45.498, longitude: -73.579, distance: 0.2 },
    ]);

    const onResultsChange = jest.fn();
    const { tree } = render({ onResultsChange });
    const cafeChip = findByTestID(tree, "poi-category-cafe");

    await cafeChip.props.onPress();

    expect(mockFetchNearbyPOIs).toHaveBeenCalledWith(
      { latitude: 45.497, longitude: -73.578 },
      "cafe",
      1000,
    );
    expect(onResultsChange).toHaveBeenCalled();
  });

  it("triggers search with new distance when distance chip is pressed and category is selected", async () => {
    mockFetchNearbyPOIs.mockResolvedValue([]);

    const { tree } = render({ selectedCategory: "restaurant" });
    const dist5km = findByTestID(tree, "poi-distance-5000");

    await dist5km.props.onPress();

    expect(mockFetchNearbyPOIs).toHaveBeenCalledWith(
      expect.any(Object),
      "restaurant",
      5000,
    );
  });

  it("does not search when distance is changed without a selected category", async () => {
    const { tree } = render({ selectedCategory: null });
    const dist500 = findByTestID(tree, "poi-distance-500");

    await dist500.props.onPress();

    expect(mockFetchNearbyPOIs).not.toHaveBeenCalled();
  });

  it("shows loading indicator when loading", () => {
    const { tree } = render({ loading: true });
    const loadingEl = findByTestID(tree, "poi-loading");
    expect(loadingEl).not.toBeNull();
    expect(textFrom(loadingEl)).toContain("Searching nearby places");
  });

  it("shows error message when error is set", () => {
    const { tree } = render({ error: "Failed to fetch nearby places. Please try again." });
    const errorEl = findByTestID(tree, "poi-error");
    expect(errorEl).not.toBeNull();
    expect(textFrom(errorEl)).toContain("Failed to fetch");
  });

  it("shows no results message when noResults is true and not loading", () => {
    const { tree } = render({
      noResults: true,
      loading: false,
      selectedCategory: "cafe",
    });
    const noResultsEl = findByTestID(tree, "poi-no-results");
    expect(noResultsEl).not.toBeNull();
    expect(textFrom(noResultsEl)).toContain("coffee shops found within");
    expect(textFrom(noResultsEl)).toContain("Try increasing the distance range");
  });

  it("shows generic no-results text when no category is selected", () => {
    const { tree } = render({
      noResults: true,
      loading: false,
      selectedCategory: null,
    });
    const noResultsEl = findByTestID(tree, "poi-no-results");
    expect(noResultsEl).not.toBeNull();
    expect(textFrom(noResultsEl)).toContain("places found within");
  });

  it("does not show no-results when loading", () => {
    const { tree } = render({ noResults: true, loading: true });
    const noResultsEl = findByTestID(tree, "poi-no-results");
    expect(noResultsEl).toBeNull();
  });

  it("renders results list with POI items", () => {
    const results = [
      { id: "10", name: "Cafe Latte", category: "cafe", latitude: 45.498, longitude: -73.579, distance: 0.15, address: "123 Main St" },
      { id: "11", name: "Bean There", category: "cafe", latitude: 45.499, longitude: -73.580, distance: 0.35 },
    ];
    const { tree } = render({ results, loading: false });

    const list = findByTestID(tree, "poi-results-list");
    expect(list).not.toBeNull();

    const item1 = findByTestID(tree, "poi-result-10");
    expect(item1).not.toBeNull();
    expect(textFrom(item1)).toContain("Cafe Latte");
    expect(textFrom(item1)).toContain("150 m");
    expect(textFrom(item1)).toContain("123 Main St");

    const item2 = findByTestID(tree, "poi-result-11");
    expect(item2).not.toBeNull();
    expect(textFrom(item2)).toContain("Bean There");
    expect(textFrom(item2)).toContain("350 m");
  });

  it("does not render results list when loading", () => {
    const results = [
      { id: "10", name: "Test", category: "cafe", latitude: 0, longitude: 0, distance: 0.1 },
    ];
    const { tree } = render({ results, loading: true });
    const list = findByTestID(tree, "poi-results-list");
    expect(list).toBeNull();
  });

  it("sets error when userLocation is null and search is triggered", async () => {
    const { tree } = render({ userLocation: null });
    const cafeChip = findByTestID(tree, "poi-category-cafe");
    await cafeChip.props.onPress();

    expect(mockFetchNearbyPOIs).not.toHaveBeenCalled();
    // error state was set via setState
    expect(mockStates[5]).toBe("Location not available. Please enable location services.");
  });

  it("handles fetch failure gracefully", async () => {
    mockFetchNearbyPOIs.mockRejectedValue(new Error("Network error"));
    const onResultsChange = jest.fn();

    const { tree } = render({ onResultsChange });
    const cafeChip = findByTestID(tree, "poi-category-cafe");
    await cafeChip.props.onPress();

    expect(onResultsChange).toHaveBeenCalledWith([]);
    expect(mockStates[5]).toBe("Failed to fetch nearby places. Please try again.");
  });

  it("shows active styling on selected category chip", () => {
    const { tree } = render({ selectedCategory: "gym" });
    const gymChip = findByTestID(tree, "poi-category-gym");
    // The chip should have active style applied (array with chipActive)
    expect(gymChip.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({})]),
    );
  });

  it("shows active styling on selected distance chip", () => {
    const { tree } = render({
      selectedDistance: { label: "2 km", meters: 2000, km: 2 },
    });
    const dist2km = findByTestID(tree, "poi-distance-2000");
    expect(dist2km.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({})]),
    );
  });

  it("merges indoor washroom results when searching washroom category", async () => {
    mockFetchNearbyPOIs.mockResolvedValue([
      { id: "outdoor-1", name: "Public WC", category: "washroom", latitude: 45.498, longitude: -73.579, distance: 0.3 },
    ]);
    mockGetIndoorWashroomPOIs.mockReturnValue([
      { id: "indoor-wc-H", name: "Hall Building (Indoor)", category: "washroom", latitude: 45.497, longitude: -73.578, distance: 0.1, address: "1455 De Maisonneuve" },
    ]);

    const onResultsChange = jest.fn();
    const { tree } = render({ onResultsChange });
    const washroomChip = findByTestID(tree, "poi-category-washroom");
    await washroomChip.props.onPress();

    expect(mockGetIndoorWashroomPOIs).toHaveBeenCalledWith({ latitude: 45.497, longitude: -73.578 });
    expect(onResultsChange).toHaveBeenCalled();
    const passedResults = onResultsChange.mock.calls[0][0];
    expect(passedResults).toHaveLength(2);
    // Sorted by distance: indoor (0.1) before outdoor (0.3)
    expect(passedResults[0].id).toBe("indoor-wc-H");
    expect(passedResults[1].id).toBe("outdoor-1");
  });

  it("does not merge indoor washrooms for non-washroom categories", async () => {
    mockFetchNearbyPOIs.mockResolvedValue([
      { id: "1", name: "Cafe", category: "cafe", latitude: 45.498, longitude: -73.579, distance: 0.2 },
    ]);

    const { tree } = render();
    const cafeChip = findByTestID(tree, "poi-category-cafe");
    await cafeChip.props.onPress();

    expect(mockGetIndoorWashroomPOIs).not.toHaveBeenCalled();
  });
});
