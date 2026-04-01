jest.mock("lucide-react-native", () => {
  const React = require("react");
  return {
    Map: (props) => React.createElement("MapIcon", props),
    Navigation: (props) => React.createElement("NavigationIcon", props),
  };
});

jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");

  const Pressable = ({ children, style, ...rest }) => {
    const resolvedStyle =
      typeof style === "function" ? style({ pressed: false }) : style;
    return React.createElement(
      "Pressable",
      { ...rest, style: resolvedStyle },
      children,
    );
  };
  Pressable.propTypes = {
    children: PropTypes.node,
    style: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.array,
      PropTypes.func,
    ]),
  };

  const Text = ({ children, ...rest }) =>
    React.createElement("Text", rest, children);
  Text.propTypes = { children: PropTypes.node };

  const TextInput = (props) => React.createElement("TextInput", props);

  const View = ({ children, ...rest }) =>
    React.createElement("View", rest, children);
  View.propTypes = { children: PropTypes.node };

  const ScrollView = ({ children, ...rest }) =>
    React.createElement("ScrollView", rest, children);
  ScrollView.propTypes = { children: PropTypes.node };

  return {
    Pressable,
    StyleSheet: { create: (styles) => styles },
    ScrollView,
    Text,
    TextInput,
    View,
  };
});

const DirectionsPanel =
  require("../../../components/mapScreen/DirectionsPanel").default;

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

const originBuilding = {
  code: "H",
  shortName: "Hall",
  longName: "Hall Building",
};

const destinationBuilding = {
  code: "EV",
  shortName: "Engineering",
  longName: "Engineering Building",
};

function createProps(overrides = {}) {
  return {
    setSearchText: jest.fn(),
    setEditingField: jest.fn(),
    searchInputRef: { current: { focus: jest.fn() } },
    editingField: undefined,
    originBuilding,
    destinationBuilding,
    clearDirections: jest.fn(),
    isDirectionsMode: false,
    isSameCampus: false,
    routeMode: "walking",
    setRouteMode: jest.fn(),
    modeDurations: { walking: 12, driving: 7, transit: 18 },
    setRouteStarted: jest.fn(),
    routeInstructionsDismissedRef: { current: true },
    setShowRouteInstructions: jest.fn(),
    styles: createStyles(),
    formatDuration: (minutes) => `${minutes} min`,
    originRoom: "801",
    setOriginRoom: jest.fn(),
    destinationRoom: "102",
    setDestinationRoom: jest.fn(),
    openFloorPlanModal: jest.fn(),
    getRoomDetails: jest.fn(),
    getFloorPlanAsset: jest.fn(),
    ...overrides,
  };
}

describe("components/mapScreen/DirectionsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders origin and destination values and handles from/to/go actions", () => {
    const props = createProps();
    const el = renderTree(DirectionsPanel(props));

    expect(findByTestID(el, "direction-from-value-H").props.children).toBe(
      "H - Hall",
    );
    expect(findByTestID(el, "direction-to-value-EV").props.children).toBe(
      "EV - Engineering",
    );

    findByTestID(el, "direction-from-button").props.onPress();
    expect(props.setEditingField).toHaveBeenCalledWith("from");
    expect(props.searchInputRef.current.focus).toHaveBeenCalled();

    findByTestID(el, "direction-to-button").props.onPress();
    expect(props.setEditingField).toHaveBeenCalledWith("to");
    expect(props.setSearchText).toHaveBeenCalledWith("");

    findByTestID(el, "direction-go-button").props.onPress();
    expect(props.clearDirections).toHaveBeenCalled();
  });

  test("renders room inputs and opens a floor plan when an asset exists", () => {
    const asset = { uri: "floor-plan" };
    const props = createProps({
      getRoomDetails: jest
        .fn()
        .mockImplementation((buildingCode, roomNumber) =>
          buildingCode === "H" && roomNumber === "801"
            ? { buildingCode: "H", floor: 8, roomNumber }
            : undefined,
        ),
      getFloorPlanAsset: jest
        .fn()
        .mockImplementation((key) => (key === "H-8" ? asset : null)),
    });

    const el = renderTree(DirectionsPanel(props));
    const textInputs = findAll(el, (node) => node?.type === "TextInput");
    expect(textInputs).toHaveLength(2);

    textInputs[0].props.onChangeText("802");
    expect(props.setOriginRoom).toHaveBeenCalledWith("802");

    const floorPlanButtons = findAll(
      el,
      (node) => node?.props?.accessibilityLabel === "View Floor Plan",
    );
    expect(floorPlanButtons).toHaveLength(2);
    expect(floorPlanButtons[1].props.disabled).toBe(true);

    floorPlanButtons[0].props.onPress();
    expect(props.openFloorPlanModal).toHaveBeenCalledWith("H-8");
  });

  test("renders empty origin/destination state when no buildings are selected", () => {
    const props = createProps({
      originBuilding: null,
      destinationBuilding: null,
      isDirectionsMode: false,
    });
    const el = renderTree(DirectionsPanel(props));

    expect(findByTestID(el, "direction-from-value-empty").props.children).toBe(
      "Current location",
    );
    expect(findByTestID(el, "direction-to-value-empty").props.children).toBe(
      "Where to?",
    );
    expect(
      findAll(el, (node) => node?.props?.accessibilityLabel === "View Floor Plan"),
    ).toHaveLength(0);
    expect(findByTestID(el, "route-mode-driving")).toBeNull();
  });

  test("renders same-campus transport controls", () => {
    const props = createProps({
      isDirectionsMode: true,
      isSameCampus: true,
    });
    const el = renderTree(DirectionsPanel(props));

    expect(findText(el, "Same campus")).toBeTruthy();
    expect(findByTestID(el, "route-mode-driving")).toBeNull();

    findByTestID(el, "direction-exit-button").props.onPress();
    expect(props.clearDirections).toHaveBeenCalled();
  });

  test("renders duration fallbacks and active styles across route modes", () => {
    renderTree(
      DirectionsPanel(
        createProps({
          isDirectionsMode: true,
          isSameCampus: true,
          modeDurations: { walking: null, driving: null, transit: null },
        }),
      ),
    );

    renderTree(
      DirectionsPanel(
        createProps({
          isDirectionsMode: true,
          isSameCampus: false,
          routeMode: "walking",
          modeDurations: { walking: null, driving: null, transit: null },
        }),
      ),
    );

    renderTree(
      DirectionsPanel(
        createProps({
          isDirectionsMode: true,
          isSameCampus: false,
          routeMode: "transit",
          modeDurations: { walking: null, driving: null, transit: null },
        }),
      ),
    );

    renderTree(
      DirectionsPanel(
        createProps({
          isDirectionsMode: true,
          isSameCampus: false,
          routeMode: "shuttle",
          modeDurations: { walking: null, driving: null, transit: null },
        }),
      ),
    );
  });

  test("renders inter-campus transport controls and wires mode buttons", () => {
    const props = createProps({
      isDirectionsMode: true,
      isSameCampus: false,
      routeMode: "driving",
    });
    const el = renderTree(DirectionsPanel(props));

    findByTestID(el, "route-mode-cycling").props.onPress();
    findByTestID(el, "route-mode-driving").props.onPress();
    findByTestID(el, "route-mode-transit").props.onPress();
    findByTestID(el, "route-mode-shuttle").props.onPress();

    expect(props.setRouteMode).toHaveBeenNthCalledWith(1, "cycling");
    expect(props.setRouteMode).toHaveBeenNthCalledWith(2, "driving");
    expect(props.setRouteMode).toHaveBeenNthCalledWith(3, "transit");
    expect(props.setRouteMode).toHaveBeenNthCalledWith(4, "shuttle");

    findByTestID(el, "direction-start-button").props.onPress();
    expect(props.setRouteStarted).toHaveBeenCalledWith(true);
    expect(props.routeInstructionsDismissedRef.current).toBe(false);
    expect(props.setShowRouteInstructions).toHaveBeenCalledWith(true);
  });

  test("renders active editing field styles", () => {
    const props = createProps({
      editingField: "from",
    });
    const el = renderTree(DirectionsPanel(props));

    const fromButton = findByTestID(el, "direction-from-button");
    expect(fromButton.props.style).toContain(props.styles.directionFieldButtonActive);
  });

  test("renders cancel button when in directions mode", () => {
    const props = createProps({
      isDirectionsMode: true,
    });
    const el = renderTree(DirectionsPanel(props));

    const goButton = findByTestID(el, "direction-go-button");
    expect(goButton.props.children.props.children).toBe("Cancel");
    goButton.props.onPress();
    expect(props.clearDirections).toHaveBeenCalled();
  });

  test("renders room input testIDs in directions mode", () => {
    const props = createProps({
      isDirectionsMode: true,
    });
    const el = renderTree(DirectionsPanel(props));

    expect(findByTestID(el, "direction-from-room-input")).not.toBeNull();
    expect(findByTestID(el, "direction-to-room-input")).not.toBeNull();
  });

  test("renders indoor directions button for same building with rooms", () => {
    const props = createProps({
      originBuilding: originBuilding,
      destinationBuilding: { ...originBuilding, code: "H", shortName: "Hall" }, // same building
      originRoom: "801",
      destinationRoom: "102",
      onShowIndoorDirections: jest.fn(),
      hasIndoorRoute: true,
    });
    const el = renderTree(DirectionsPanel(props));

    const indoorButton = findByTestID(el, "indoor-directions-button");
    expect(indoorButton).toBeTruthy();
    expect(findText(el, "Indoor Directions")).toBeTruthy();

    indoorButton.props.onPress();
    expect(props.onShowIndoorDirections).toHaveBeenCalled();
  });

  test("renders indoor directions button with no path available", () => {
    const props = createProps({
      originBuilding: originBuilding,
      destinationBuilding: { ...originBuilding, code: "H", shortName: "Hall" },
      originRoom: "801",
      destinationRoom: "102",
      onShowIndoorDirections: jest.fn(),
      hasIndoorRoute: false,
    });
    const el = renderTree(DirectionsPanel(props));

    expect(findText(el, "No Indoor Path Available")).toBeTruthy();
  });

  test("does not render indoor button when rooms are empty", () => {
    const props = createProps({
      originBuilding: originBuilding,
      destinationBuilding: { ...originBuilding, code: "H", shortName: "Hall" },
      originRoom: "",
      destinationRoom: "",
    });
    const el = renderTree(DirectionsPanel(props));

    expect(findByTestID(el, "indoor-directions-button")).toBeNull();
  });

  test("does not render indoor button when destination room is empty", () => {
    const props = createProps({
      originBuilding: originBuilding,
      destinationBuilding: { ...originBuilding, code: "H", shortName: "Hall" },
      originRoom: "801",
      destinationRoom: "",
    });
    const el = renderTree(DirectionsPanel(props));

    expect(findByTestID(el, "indoor-directions-button")).toBeNull();
  });

  test("does not render indoor button when origin room is empty", () => {
    const props = createProps({
      originBuilding: originBuilding,
      destinationBuilding: { ...originBuilding, code: "H", shortName: "Hall" },
      originRoom: "",
      destinationRoom: "102",
    });
    const el = renderTree(DirectionsPanel(props));

    expect(findByTestID(el, "indoor-directions-button")).toBeNull();
  });

  test("renders active editing field styles for to", () => {
    const props = createProps({
      editingField: "to",
    });
    const el = renderTree(DirectionsPanel(props));

    const toButton = findByTestID(el, "direction-to-button");
    expect(toButton.props.style).toContain(props.styles.directionFieldButtonActive);
  });

  test("room input focus and blur call setFocusedRoom and clear after delay", () => {
    jest.useFakeTimers();
    let focusedRoomState = null;
    const setFocusedRoom = jest.fn((update) => {
      focusedRoomState =
        typeof update === "function"
          ? update(focusedRoomState)
          : update;
    });

    const props = createProps({ setFocusedRoom });
    const el = renderTree(DirectionsPanel(props));
    const textInputs = findAll(el, (node) => node?.type === "TextInput");

    textInputs[0].props.onFocus();
    expect(setFocusedRoom).toHaveBeenCalledWith("from");

    textInputs[0].props.onBlur();
    jest.advanceTimersByTime(200);
    expect(focusedRoomState).toBeNull();

    setFocusedRoom.mockClear();
    focusedRoomState = "to";
    textInputs[0].props.onBlur();
    jest.advanceTimersByTime(200);
    expect(focusedRoomState).toBe("to");

    textInputs[1].props.onFocus();
    expect(setFocusedRoom).toHaveBeenCalledWith("to");

    focusedRoomState = "to";
    textInputs[1].props.onBlur();
    jest.advanceTimersByTime(200);
    expect(focusedRoomState).toBeNull();

    jest.useRealTimers();
  });

  test("room suggestions list calls press handlers and select callback", () => {
    const onRoomSuggestionPressIn = jest.fn();
    const onRoomSuggestionSelect = jest.fn();
    const props = createProps({
      focusedRoom: "from",
      roomSuggestions: ["H-801", "H-802"],
      onRoomSuggestionPressIn,
      onRoomSuggestionSelect,
    });
    const el = renderTree(DirectionsPanel(props));

    const suggestion = findByTestID(el, "room-suggestion-index-0");
    expect(suggestion).toBeTruthy();
    suggestion.props.onPressIn();
    expect(onRoomSuggestionPressIn).toHaveBeenCalled();
    suggestion.props.onPress();
    expect(onRoomSuggestionSelect).toHaveBeenCalledWith("H-801", "from");
  });

  test("renders POI name in TO field when no destination building but destinationPOIName is set", () => {
    const props = createProps({
      destinationBuilding: null,
      destinationPOIName: "Nice Cafe",
    });
    const el = renderTree(DirectionsPanel(props));

    const toValue = findByTestID(el, "direction-to-value-empty");
    expect(toValue).not.toBeNull();
    expect(toValue.props.children).toBe("Nice Cafe");
  });

  test("renders 'Where to?' when no destination building and no POI name", () => {
    const props = createProps({
      destinationBuilding: null,
      destinationPOIName: null,
    });
    const el = renderTree(DirectionsPanel(props));

    const toValue = findByTestID(el, "direction-to-value-empty");
    expect(toValue).not.toBeNull();
    expect(toValue.props.children).toBe("Where to?");
  });
});
