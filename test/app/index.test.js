const keyboardDismiss = jest.fn();
const useStateMock = jest.fn();

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useState: (...args) => useStateMock(...args),
    useMemo: (factory) => factory(),
    useCallback: (fn) => fn,
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
  };
});

jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");

  const host =
    (type) => {
      const HostComponent = ({ children, ...rest }) =>
        React.createElement(type, rest, children);
      HostComponent.displayName = `${type}Host`;
      return HostComponent;
    };

  const Pressable = ({ children, style, ...rest }) => {
    const resolvedStyle =
      typeof style === "function" ? style({ pressed: false }) : style;
    return React.createElement("Pressable", { ...rest, style: resolvedStyle }, children);
  };
  Pressable.propTypes = {
    children: PropTypes.node,
    style: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.array,
      PropTypes.func,
    ]),
  };

  return {
    Image: host("Image"),
    Keyboard: { dismiss: keyboardDismiss },
    Linking: { openSettings: jest.fn() },
    Modal: host("Modal"),
    PanResponder: { create: jest.fn(() => ({ panHandlers: {} })) },
    Platform: { OS: "web" },
    Pressable,
    ScrollView: host("ScrollView"),
    StyleSheet: { create: (styles) => styles },
    Text: host("Text"),
    TextInput: host("TextInput"),
    TouchableOpacity: host("TouchableOpacity"),
    useWindowDimensions: () => ({ width: 1280, height: 800 }),
    View: host("View"),
  };
});

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "standalone" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ canAskAgain: true })),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  return {
    ChevronUp: (props) => React.createElement("ChevronUp", props),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

jest.mock("react-native-svg", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, ...props }) => React.createElement("Svg", props, children),
    Circle: (props) => React.createElement("Circle", props),
  };
});

jest.mock("../../components/AppHeader", () => {
  const React = require("react");
  const AppHeaderMock = (props) => React.createElement("AppHeader", props);
  AppHeaderMock.displayName = "AppHeaderMock";
  return AppHeaderMock;
});

[
  "../../components/BuildingInformation",
  "../../components/IndoorDirectionsModal",
  "../../components/POISearchPanel",
  "../../components/mapScreen/CurrentBuildingBanner",
  "../../components/mapScreen/DirectionsPanel",
  "../../components/mapScreen/FloorPlanModal",
  "../../components/mapScreen/LocationPermissionBanner",
  "../../components/mapScreen/NativeCampusMap",
  "../../components/mapScreen/RouteStepsPopup",
  "../../components/mapScreen/WebCampusMap",
].forEach((path) => {
  jest.mock(path, () => {
    const React = require("react");
    const MockComponent = (props) =>
      React.createElement(path.split("/").pop(), props);
    MockComponent.displayName = `${path.split("/").pop()}Mock`;
    return MockComponent;
  });
});

jest.mock("../../hooks/useMapRouteState", () => ({
  useMapRouteState: () => ({
    state: {
      routeCoordinates: [],
      routeDurationMinutes: null,
      routeDistanceMeters: null,
      routeLoading: false,
      routeInstructions: [],
      showRouteInstructions: false,
      transitItineraries: [],
      selectedItineraryIndex: 0,
      selectedShuttleDeparture: null,
      shuttleWalkToCoords: [],
      shuttleDriveCoords: [],
      shuttleWalkFromCoords: [],
      expandedItineraries: [],
      expandedIntermediateStops: new Set(),
      routeStarted: false,
    },
    actions: {
      resetAll: jest.fn(),
      resetGeometry: jest.fn(),
      applyRouteResult: jest.fn(),
      setRouteLoading: jest.fn(),
      showInstructions: jest.fn(),
      hideInstructions: jest.fn(),
      setRouteStarted: jest.fn(),
      setSelectedItineraryIndex: jest.fn(),
      setExpandedItineraries: jest.fn(),
      setExpandedIntermediateStops: jest.fn(),
      setRouteDurationMinutes: jest.fn(),
      setRouteDistanceMeters: jest.fn(),
      setRouteInstructions: jest.fn(),
      setSelectedShuttleDeparture: jest.fn(),
      shouldShowInstructionsForResult: jest.fn(() => false),
      resetDismissed: jest.fn(),
    },
  }),
}));

jest.mock("../../hooks/useUserCampusLocation", () => ({
  useUserCampusLocation: () => ({
    userLocation: null,
    currentBuilding: null,
    locationPermissionDenied: false,
    setOriginMode: jest.fn(),
    restoreAutoOriginFromCurrentLocation: jest.fn(() => null),
  }),
}));

jest.mock("../../utils/googleCalendarNextClass", () => ({
  fetchNextConcordiaClassToday: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
}));

jest.mock("../../utils/googleCalendarAuth", () => ({
  getToken: jest.fn(async () => null),
}));

function createStyles() {
  const store = {};
  return new Proxy(store, {
    get: (target, key) => {
      if (!(key in target)) {
        target[key] = { styleKey: String(key) };
      }
      return target[key];
    },
  });
}

jest.mock("../../styles/mapScreen.styles", () => ({
  createMapScreenStyles: () => createStyles(),
}));

function renderTree(node) {
  if (Array.isArray(node)) return node.map(renderTree);
  if (!node || typeof node !== "object") return node;
  if (typeof node.type === "function") {
    return renderTree(node.type(node.props));
  }
  if (!node.props?.children) return node;
  return {
    ...node,
    props: {
      ...node.props,
      children: renderTree(node.props.children),
    },
  };
}

function findByType(node, type) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findByType(child, type);
      if (result) return result;
    }
    return null;
  }
  if (node.type === type) return node;
  if (node.props?.children) return findByType(node.props.children, type);
  return null;
}

function findByTestID(node, id) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findByTestID(child, id);
      if (result) return result;
    }
    return null;
  }
  if (node?.props?.testID === id) return node;
  if (node?.props?.children) return findByTestID(node.props.children, id);
  return null;
}

function mockUseStateSequence(values) {
  const setters = values.map(() => jest.fn());
  useStateMock.mockImplementationOnce((initial) => [values[0] ?? initial, setters[0]]);
  for (let index = 1; index < values.length; index += 1) {
    useStateMock.mockImplementationOnce((initial) => [values[index] ?? initial, setters[index]]);
  }
  useStateMock.mockImplementation((initial) => [initial, jest.fn()]);
  return setters;
}

describe("app/(tabs)/index", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("wires campus change and search result selection", () => {
    const setters = mockUseStateSequence([
      undefined, // 0: floorPlanModalOptions
      undefined, // 1: selectedFloorPlanKey
      undefined, // 2: editingField
      undefined, // 3: floorPlanModalVisible
      undefined, // 4: activeFloorPlan
      undefined, // 5: selectedFloorPlanNode
      undefined, // 6: floorPlanDirectionsFromRoom
      undefined, // 7: floorPlanDirectionsPromptVisible
      undefined, // 8: indoorDirectionsTargetNodeId
      undefined, // 9: pendingIndoorNode
      undefined, // 10: pendingIndoorFloorKey
      undefined, // 11: pendingIndoorRoomPopup
      "SGW",     // 12: campus
      "hall",    // 13: searchText
      undefined, // 14: selectedBuilding
      undefined, // 15: destinationBuildingCode
      undefined, // 16: originBuildingCode
      undefined, // 17: originRoom
      undefined, // 18: destinationRoom
      undefined, // 19: destinationRoomDisplayLabel
      undefined, // 20: focusedRoom
      undefined, // 21: isDirectionsMode
      undefined, // 22: indoorRoute
      undefined, // 23: indoorDirectionsModalVisible
      undefined, // 24: routeMode
      undefined, // 25: modeDurations
      undefined, // 26: nextClassLoading
      undefined, // 27: nextClassMessage
      undefined, // 28: hasCalendarToken
      undefined, // 29: directionsPanelBottom
      undefined, // 30: mapViewportRegion
      undefined, // 31: focusedBounds
      undefined, // 32: mapFocusRequestKey
      undefined, // 33: showPOIPanel
      undefined, // 34: poiResults
      undefined, // 35: destinationPOI
      undefined, // 36: washroomPickerBuilding
      undefined, // 37: routingOriginPoint
    ]);

    const MapScreen = require("../../app/(tabs)/index").default;
    const tree = renderTree(MapScreen());

    const header = findByType(tree, "AppHeader");
    header.props.onCampusChange("LOY");
    expect(setters[12]).toHaveBeenCalledWith("LOY");

    const hallResult = findByTestID(tree, "search-result-H");
    hallResult.props.onPress();
    expect(setters[14]).toHaveBeenCalledWith("H");
    expect(setters[13]).toHaveBeenCalledWith("");
    expect(keyboardDismiss).toHaveBeenCalled();
  });
});
