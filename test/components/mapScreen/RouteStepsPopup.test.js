jest.mock("lucide-react-native", () => {
  const React = require("react");
  return {
    ChevronDown: (props) => React.createElement("ChevronDown", props),
    ChevronUp: (props) => React.createElement("ChevronUp", props),
    X: (props) => React.createElement("XIcon", props),
  };
});

jest.mock("../../../components/ShuttleDirections", () => {
  const React = require("react");
  return (props) => React.createElement("ShuttleDirections", props);
});

jest.mock("../../../components/TransitLegTimeline", () => {
  const React = require("react");
  return (props) => React.createElement("TransitLegTimeline", props);
});

jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");

  const Pressable = ({ children, ...rest }) =>
    React.createElement("Pressable", rest, children);
  Pressable.propTypes = { children: PropTypes.node };

  const ScrollView = ({ children, ...rest }) =>
    React.createElement("ScrollView", rest, children);
  ScrollView.propTypes = { children: PropTypes.node };

  const Text = ({ children, ...rest }) =>
    React.createElement("Text", rest, children);
  Text.propTypes = { children: PropTypes.node };

  const View = ({ children, ...rest }) =>
    React.createElement("View", rest, children);
  View.propTypes = { children: PropTypes.node };

  return {
    Pressable,
    ScrollView,
    StyleSheet: { create: (styles) => styles },
    Text,
    View,
  };
});

const RouteStepsPopup =
  require("../../../components/mapScreen/RouteStepsPopup").default;

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

function findAll(node, predicate, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, acc));
    return acc;
  }
  if (predicate(node)) acc.push(node);
  if (node?.props?.children) findAll(node.props.children, predicate, acc);
  return acc;
}

function findByType(node, type) {
  return findAll(node, (candidate) => candidate?.type === type)[0] ?? null;
}

function findText(node, text) {
  return findAll(node, (candidate) => candidate?.props?.children === text)[0] ?? null;
}

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

const itinerary = {
  durationSeconds: 1800,
  distanceMeters: 2400,
  transfers: 0,
  departureTime: "2025-01-01T10:00:00.000Z",
  arrivalTime: "2025-01-01T10:30:00.000Z",
  legs: [
    {
      mode: "WALK",
      route: "",
      from: { name: "Origin" },
      to: { name: "Stop A" },
      duration: 300,
      distance: 350,
      legGeometry: null,
    },
    {
      mode: "BUS",
      route: "24",
      from: { name: "Stop A" },
      to: { name: "Stop B" },
      duration: 600,
      distance: 1200,
      legGeometry: { points: "abc" },
    },
    {
      mode: "SUBWAY",
      route: "1",
      from: { name: "Stop B" },
      to: { name: "Stop C" },
      duration: 600,
      distance: 700,
      legGeometry: { points: "def" },
    },
    {
      mode: "TRAM",
      route: "T1",
      from: { name: "Stop C" },
      to: { name: "Destination" },
      duration: 300,
      distance: 150,
      legGeometry: { points: "ghi" },
    },
  ],
  instructions: [{ text: "Walk to Stop A", distanceMeters: 350 }],
};

function createProps(overrides = {}) {
  return {
    styles: createStyles(),
    routeSheetPanResponder: { panHandlers: { onStartShouldSetResponder: jest.fn() } },
    formatTime: jest.fn(() => "10:00"),
    routeInstructionsDismissedRef: { current: false },
    setShowRouteInstructions: jest.fn(),
    routeMode: "walking",
    actualOriginPoint: { latitude: 45.5, longitude: -73.57 },
    destinationBuilding: {
      code: "EV",
      shortName: "Engineering",
      longName: "Engineering Building",
    },
    transitItineraries: [],
    routeStarted: false,
    selectedItineraryIndex: 0,
    expandedItineraries: [],
    setSelectedItineraryIndex: jest.fn(),
    setRouteDurationMinutes: jest.fn(),
    setRouteDistanceMeters: jest.fn(),
    setRouteInstructions: jest.fn(),
    setExpandedItineraries: jest.fn(),
    expandedIntermediateStops: new Set(),
    setExpandedIntermediateStops: jest.fn(),
    routeInstructions: [
      { text: "Head north", distanceMeters: 100 },
      { text: "Turn right", distanceMeters: 200 },
    ],
    selectedShuttleDeparture: null,
    setSelectedShuttleDeparture: jest.fn(),
    ...overrides,
  };
}

describe("components/mapScreen/RouteStepsPopup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("close button and handle dismiss the popup", () => {
    const props = createProps();
    const el = renderTree(RouteStepsPopup(props));

    findByTestID(el, "route-steps-close-button").props.onPress();
    expect(props.routeInstructionsDismissedRef.current).toBe(true);
    expect(props.setShowRouteInstructions).toHaveBeenCalledWith(false);

    props.routeInstructionsDismissedRef.current = false;
    const handle = findAll(
      el,
      (node) => node?.props?.style === props.styles.routeStepsHandle,
    )[0];
    handle.props.onPress();
    expect(props.routeInstructionsDismissedRef.current).toBe(true);
    expect(props.setShowRouteInstructions).toHaveBeenCalledTimes(2);
  });

  test("renders shuttle directions and forwards departure selection", () => {
    const props = createProps({
      routeMode: "shuttle",
      routeInstructions: [{ text: "Shuttle Journey", distanceMeters: 0 }],
    });
    const el = renderTree(RouteStepsPopup(props));

    const shuttle = findByType(el, "ShuttleDirections");
    expect(shuttle).toBeTruthy();
    expect(shuttle.props.origin).toEqual(props.actualOriginPoint);
    expect(shuttle.props.destination).toEqual(props.destinationBuilding);

    shuttle.props.onDepartureSelect("12:00");
    expect(props.setSelectedShuttleDeparture).toHaveBeenCalledWith("12:00");
  });

  test("does not update shuttle departure when the selected time is unchanged", () => {
    const props = createProps({
      routeMode: "shuttle",
      routeInstructions: [{ text: "Shuttle Journey", distanceMeters: 0 }],
      selectedShuttleDeparture: "12:00",
    });
    const el = renderTree(RouteStepsPopup(props));

    findByType(el, "ShuttleDirections").props.onDepartureSelect("12:00");
    expect(props.setSelectedShuttleDeparture).not.toHaveBeenCalled();
  });

  test("renders shuttle fallback message when route has started and no shuttles are available", () => {
    const el = renderTree(RouteStepsPopup(
      createProps({
        routeMode: "shuttle",
        routeStarted: true,
        transitItineraries: [],
      }),
    ));

    expect(findText(el, "Journey Details")).toBeTruthy();
    expect(findText(el, "No shuttles at this time.")).toBeTruthy();
  });

  test("renders shuttle journey details when itinerary data exists", () => {
    const props = createProps({
      routeMode: "shuttle",
      routeStarted: true,
      transitItineraries: [itinerary],
    });
    const el = renderTree(RouteStepsPopup(props));

    expect(findText(el, "Journey Details")).toBeTruthy();
    expect(findByType(el, "TransitLegTimeline").props.itinerary).toBe(itinerary);
  });

  test("renders transit journey details when transit route has started", () => {
    const props = createProps({
      routeMode: "transit",
      routeStarted: true,
      transitItineraries: [itinerary],
    });
    const el = renderTree(RouteStepsPopup(props));

    expect(findText(el, "Journey Details")).toBeTruthy();
    const timeline = findByType(el, "TransitLegTimeline");
    expect(timeline.props.itinerary).toBe(itinerary);
    expect(timeline.props.alwaysShowIntermediateStops).toBe(true);
  });

  test("renders collapsed transit itinerary cards and expands from the default state", () => {
    const props = createProps({
      routeMode: "transit",
      transitItineraries: [itinerary],
      expandedItineraries: [],
    });
    const el = renderTree(RouteStepsPopup(props));

    const toggle = findAll(
      el,
      (node) => node?.props?.style?.padding === 8 && node?.props?.style?.marginLeft === 8,
    )[0];
    const stopPropagation = jest.fn();
    toggle.props.onPress({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();

    const updater = props.setExpandedItineraries.mock.calls[0][0];
    expect(updater([])).toEqual([0]);
    expect(updater([0])).toEqual([]);
  });

  test("renders transit itinerary cards, selects an itinerary, and expands details", () => {
    const setExpandedIntermediateStops = jest.fn();
    const props = createProps({
      routeMode: "transit",
      transitItineraries: [itinerary],
      expandedItineraries: [0],
      setExpandedIntermediateStops,
    });
    const el = renderTree(RouteStepsPopup(props));

    const card = findAll(
      el,
      (node) =>
        Array.isArray(node?.props?.style) &&
        node.props.style.includes(props.styles.itineraryCard),
    )[0];
    card.props.onPress();
    expect(props.setSelectedItineraryIndex).toHaveBeenCalledWith(0);
    expect(props.setRouteDurationMinutes).toHaveBeenCalledWith(30);
    expect(props.setRouteDistanceMeters).toHaveBeenCalledWith(2400);
    expect(props.setRouteInstructions).toHaveBeenCalledWith(itinerary.instructions);

    const toggle = findAll(
      el,
      (node) => node?.props?.style?.padding === 8 && node?.props?.style?.marginLeft === 8,
    )[0];
    const stopPropagation = jest.fn();
    toggle.props.onPress({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(props.setExpandedItineraries).toHaveBeenCalled();

    const timeline = findByType(el, "TransitLegTimeline");
    timeline.props.onToggleStops("stop-1");
    const updater = setExpandedIntermediateStops.mock.calls[0][0];
    expect(Array.from(updater(new Set()))).toEqual(["stop-1"]);
    expect(Array.from(updater(new Set(["stop-1"])))).toEqual([]);
  });

  test("falls back to the bus leg style for unknown transit modes", () => {
    const props = createProps({
      routeMode: "transit",
      transitItineraries: [
        {
          ...itinerary,
          legs: [
            {
              mode: "FERRY",
              route: "",
              from: { name: "Dock A" },
              to: { name: "Dock B" },
              duration: 420,
              distance: 900,
              legGeometry: { points: "xyz" },
            },
          ],
        },
      ],
    });
    const el = renderTree(RouteStepsPopup(props));

    const fallbackLeg = findText(el, "FERRY");
    expect(fallbackLeg).toBeTruthy();
    expect(fallbackLeg.props.style).toEqual([
      props.styles.legPill,
      props.styles.legPillBus,
    ]);
  });

  test("renders singular and plural transfer labels for transit itineraries", () => {
    const props = createProps({
      routeMode: "transit",
      transitItineraries: [
        {
          ...itinerary,
          transfers: 1,
        },
        {
          ...itinerary,
          transfers: 2,
        },
      ],
    });
    const el = renderTree(RouteStepsPopup(props));

    expect(findText(el, "1 transfer")).toBeTruthy();
    expect(findText(el, "2 transfers")).toBeTruthy();
  });

  test("renders plain numbered instructions when not in shuttle or transit mode", () => {
    const el = renderTree(RouteStepsPopup(createProps()));

    expect(findText(el, "1. Head north")).toBeTruthy();
    expect(findText(el, "2. Turn right")).toBeTruthy();
  });
});
