jest.mock("lucide-react-native", () => {
  const React = require("react");
  return {
    Map: (props) => React.createElement("MapIcon", props),
  };
});

jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");

  const Pressable = ({ children, ...rest }) =>
    React.createElement("Pressable", rest, children);
  Pressable.propTypes = { children: PropTypes.node };

  const Text = ({ children, ...rest }) =>
    React.createElement("Text", rest, children);
  Text.propTypes = { children: PropTypes.node };

  const TextInput = (props) => React.createElement("TextInput", props);

  const View = ({ children, ...rest }) =>
    React.createElement("View", rest, children);
  View.propTypes = { children: PropTypes.node };

  return {
    Pressable,
    StyleSheet: { create: (styles) => styles },
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
    setActiveFloorPlan: jest.fn(),
    setFloorPlanModalVisible: jest.fn(),
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
    expect(props.setActiveFloorPlan).toHaveBeenCalledWith(asset);
    expect(props.setFloorPlanModalVisible).toHaveBeenCalledWith(true);
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

    findByTestID(el, "route-mode-walking").props.onPress();
    findByTestID(el, "route-mode-driving").props.onPress();
    findByTestID(el, "route-mode-transit").props.onPress();
    findByTestID(el, "route-mode-shuttle").props.onPress();

    expect(props.setRouteMode).toHaveBeenNthCalledWith(1, "walking");
    expect(props.setRouteMode).toHaveBeenNthCalledWith(2, "driving");
    expect(props.setRouteMode).toHaveBeenNthCalledWith(3, "transit");
    expect(props.setRouteMode).toHaveBeenNthCalledWith(4, "shuttle");

    findByTestID(el, "direction-start-button").props.onPress();
    expect(props.setRouteStarted).toHaveBeenCalledWith(true);
    expect(props.routeInstructionsDismissedRef.current).toBe(false);
    expect(props.setShowRouteInstructions).toHaveBeenCalledWith(true);
  });
});
