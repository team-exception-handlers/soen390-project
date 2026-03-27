const React = require("react");

let mockStates = [];
let mockStateIdx = 0;

jest.mock("react", () => {
  const Actual = jest.requireActual("react");
  return {
    ...Actual,
    useState: (init) => {
      const idx = mockStateIdx++;
      if (mockStates[idx] === undefined) mockStates[idx] = init;
      return [
        mockStates[idx],
        (value) => {
          mockStates[idx] =
            typeof value === "function" ? value(mockStates[idx]) : value;
        },
      ];
    },
    useCallback: (fn) => fn,
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  return {
    ChevronDown: (props) => React.createElement("ChevronDown", props),
    ChevronUp: (props) => React.createElement("ChevronUp", props),
    Navigation: (props) => React.createElement("NavigationIcon", props),
    X: (props) => React.createElement("XIcon", props),
  };
});

jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");

  const Image = (props) => React.createElement("Image", props);
  const Modal = ({ children, ...rest }) =>
    React.createElement("Modal", rest, children);
  Modal.propTypes = { children: PropTypes.node };

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
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet: {
      absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
      create: (styles) => styles,
    },
    Text,
    View,
  };
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, ...props }) => React.createElement("Svg", props, children),
    Circle: (props) => React.createElement("Circle", props),
    Polyline: (props) => React.createElement("Polyline", props),
  };
});

jest.mock("../../assets/floor_plans/svg/CC1.svg", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => React.createElement("CC1Plan", props),
  };
});

jest.mock("../../assets/floor_plans/svg/H1.svg", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => React.createElement("H1Plan", props),
  };
});

jest.mock("../../assets/floor_plans/svg/H2.svg", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => React.createElement("H2Plan", props),
  };
});

jest.mock("../../assets/floor_plans/svg/hall8.svg", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => React.createElement("Hall8Plan", props),
  };
});

jest.mock("../../assets/floor_plans/svg/hall9.svg", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => React.createElement("Hall9Plan", props),
  };
});

jest.mock("../../assets/floor_plans/png/mb_1.png", () => "mb_1.png");
jest.mock("../../assets/floor_plans/png/mb_s2.png", () => "mb_s2.png");
jest.mock("../../assets/floor_plans/png/ve1.png", () => "ve1.png");
jest.mock("../../assets/floor_plans/png/ve2.png", () => "ve2.png");
jest.mock("../../assets/floor_plans/png/vl_1.png", () => "vl_1.png");
jest.mock("../../assets/floor_plans/png/vl_2.png", () => "vl_2.png");
jest.mock("../../utils/indoorDirections", () => {
  const actual = jest.requireActual("../../utils/indoorDirections");
  return {
    ...actual,
    findIndoorRoute: jest.fn(actual.findIndoorRoute),
  };
});

const IndoorDirectionsModal =
  require("../../components/IndoorDirectionsModal").default;
const indoorDirections = require("../../utils/indoorDirections");

function expand(node) {
  if (node == null || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(expand);

  if (typeof node === "object" && node.$$typeof) {
    const { type, props } = node;
    if (typeof type === "function") return expand(type(props));
    const nextProps = { ...props };
    if (nextProps.children !== undefined) nextProps.children = expand(nextProps.children);
    return { type, props: nextProps };
  }

  return node;
}

function renderModal(props) {
  mockStateIdx = 0;
  return expand(React.createElement(IndoorDirectionsModal, props));
}

function textFrom(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFrom).join("");
  if (typeof node === "object" && node.props?.children != null) {
    return textFrom(node.props.children);
  }
  return "";
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

function findByTestID(node, id) {
  return findAll(node, (candidate) => candidate?.props?.testID === id)[0] ?? null;
}

function findByType(node, type) {
  return findAll(node, (candidate) => candidate?.type === type)[0] ?? null;
}

function findText(node, text) {
  return findAll(
    node,
    (candidate) =>
      typeof candidate === "object" &&
      candidate?.type === "Text" &&
      textFrom(candidate).includes(text),
  )[0] ?? null;
}

function createProps(overrides = {}) {
  return {
    visible: true,
    onClose: jest.fn(),
    route: null,
    buildingCode: "H",
    originRoom: "919",
    destinationRoom: "962",
    floorBounds: jest.fn(() => ({ width: 100, height: 100 })),
    graphFloorBounds: undefined,
    ...overrides,
  };
}

function createRoute(overrides = {}) {
  return {
    segments: [
      {
        floor: 1,
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 50 },
        ],
      },
    ],
    steps: [
      { instruction: "Start at room MB-1.210.", floor: 1 },
      { instruction: "Continue straight for about 2 m.", floor: 1 },
      { instruction: "Room MB-1.130 will be on your right.", floor: 1 },
    ],
    totalDistance: 100,
    startFloor: 1,
    endFloor: 1,
    ...overrides,
  };
}

describe("components/IndoorDirectionsModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStates = [];
    mockStateIdx = 0;
  });

  test("renders the no-path state, fallback room labels, and closes when requested", () => {
    const props = createProps({
      originRoom: "",
      destinationRoom: "",
    });
    const tree = renderModal(props);

    expect(findByType(tree, "Modal").props.visible).toBe(true);
    expect(findText(tree, "Indoor Directions")).toBeTruthy();
    expect(findText(tree, "Starting point")).toBeTruthy();
    expect(findText(tree, "Destination")).toBeTruthy();
    expect(findText(tree, "No Indoor Path Available")).toBeTruthy();

    findByTestID(tree, "indoor-directions-close").props.onPress();
    expect(props.onClose).toHaveBeenCalled();
  });

  test("renders an image floor plan and draws the route overlay after layout", () => {
    const props = createProps({
      buildingCode: "MB",
      originRoom: "1.210",
      destinationRoom: "1.130",
      route: createRoute(),
    });

    let tree = renderModal(props);

    expect(findByType(tree, "Image").props.source).toBe("mb_1.png");
    expect(findAll(tree, (node) => node?.type === "Polyline")).toHaveLength(0);

    findByTestID(tree, "indoor-directions-map").props.onLayout({
      nativeEvent: { layout: { width: 100, height: 200 } },
    });

    tree = renderModal(props);

    expect(findByType(tree, "Polyline").props.points).toBe("0,50 50,100 100,100");
    expect(findAll(tree, (node) => node?.type === "Circle")).toHaveLength(2);
  });

  test("uses graph bounds when provided and renders a single-point route without a polyline", () => {
    const props = createProps({
      buildingCode: "VE",
      originRoom: "101",
      destinationRoom: "101",
      route: createRoute({
        segments: [{ floor: 1, points: [{ x: 100, y: 50 }] }],
        steps: [{ instruction: "You are already at room 101", floor: 1 }],
        totalDistance: 0,
      }),
      floorBounds: jest.fn(() => ({ width: 100, height: 100 })),
      graphFloorBounds: jest.fn(() => ({ width: 200, height: 100 })),
    });

    findByTestID(renderModal(props), "indoor-directions-map").props.onLayout({
      nativeEvent: { layout: { width: 200, height: 100 } },
    });

    const tree = renderModal(props);

    expect(props.graphFloorBounds).toHaveBeenCalledWith(1);
    expect(findByType(tree, "Image").props.source).toBe("ve1.png");
    expect(findAll(tree, (node) => node?.type === "Polyline")).toHaveLength(0);
    expect(findAll(tree, (node) => node?.type === "Circle")).toHaveLength(2);
    expect(findAll(tree, (node) => node?.type === "Circle")[0].props.cx).toBe(100);
  });

  test("renders floor tabs for multi-floor routes and switches the active SVG floor", () => {
    const props = createProps({
      route: createRoute({
        segments: [
          { floor: 8, points: [{ x: 0, y: 0 }, { x: 20, y: 20 }] },
          { floor: 9, points: [{ x: 40, y: 40 }, { x: 60, y: 60 }] },
        ],
        steps: [
          { instruction: "Start at room H-867.", floor: 8 },
          { instruction: "Take the stairs to floor 9.", floor: 9 },
          { instruction: "Room H-929 will be on your left.", floor: 9 },
        ],
        startFloor: 8,
        endFloor: 9,
      }),
      buildingCode: "H",
      originRoom: "867",
      destinationRoom: "929",
    });

    let tree = renderModal(props);

    expect(findText(tree, "Floor 8")).toBeTruthy();
    expect(findText(tree, "Floor 9")).toBeTruthy();
    expect(findByType(tree, "Hall8Plan")).toBeTruthy();
    expect(findByType(tree, "Hall9Plan")).toBeNull();

    findByTestID(tree, "indoor-directions-floor-9").props.onPress();
    tree = renderModal(props);

    expect(findByType(tree, "Hall8Plan")).toBeNull();
    expect(findByType(tree, "Hall9Plan")).toBeTruthy();
  });

  test("collapses and re-expands the step list", () => {
    const props = createProps({
      buildingCode: "MB",
      route: createRoute(),
    });

    let tree = renderModal(props);

    expect(findText(tree, "Continue straight for about 2 m.")).toBeTruthy();
    expect(findByType(tree, "ChevronDown")).toBeTruthy();

    findByTestID(tree, "indoor-directions-steps-toggle").props.onPress();
    tree = renderModal(props);

    expect(findText(tree, "Continue straight for about 2 m.")).toBeNull();
    expect(findByType(tree, "ChevronUp")).toBeTruthy();

    findByTestID(tree, "indoor-directions-steps-toggle").props.onPress();
    tree = renderModal(props);

    expect(findText(tree, "Continue straight for about 2 m.")).toBeTruthy();
    expect(findByType(tree, "ChevronDown")).toBeTruthy();
  });

  test("shows a placeholder when the active floor has no plan asset", () => {
    const props = createProps({
      buildingCode: "H",
      route: createRoute({
        segments: [{ floor: 3, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }],
        steps: [
          { instruction: "Start at room H-301.", floor: 3 },
          { instruction: "Room H-302 will be on your right.", floor: 3 },
        ],
        startFloor: 3,
        endFloor: 3,
      }),
      originRoom: "301",
      destinationRoom: "302",
    });

    const tree = renderModal(props);

    expect(findText(tree, "Floor plan not available for floor 3")).toBeTruthy();
    expect(findAll(tree, (node) => node?.type === "Image")).toHaveLength(0);
  });

  test("treats MB S2 routes as floor -2 and uses the S2 floor plan asset", () => {
    const props = createProps({
      buildingCode: "MB",
      originRoom: "S2.210",
      destinationRoom: "S2.235",
      route: createRoute({
        segments: [{ floor: 1, points: [{ x: 10, y: 10 }, { x: 20, y: 10 }] }],
        steps: [
          { instruction: "Start at room MB-S2.210.", floor: 1 },
          { instruction: "Room MB-S2.235 will be straight ahead.", floor: 1 },
        ],
      }),
      floorBounds: jest.fn((floor) =>
        floor === -2 ? { width: 120, height: 60 } : { width: 100, height: 100 },
      ),
    });

    const tree = renderModal(props);

    expect(props.floorBounds).toHaveBeenCalledWith(-2);
    expect(findByType(tree, "Image").props.source).toBe("mb_s2.png");
    expect(findText(tree, "Floor 1")).toBeNull();
  });

  test("recomputes the route when the elevator toggle is disabled", () => {
    mockStates = [null, { width: 0, height: 0 }, true, true, true, true, false];

    renderModal(createProps({
      buildingCode: "H",
      originRoom: "110",
      destinationRoom: "260",
      route: createRoute({
        segments: [
          { floor: 1, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
          { floor: 2, points: [{ x: 20, y: 20 }, { x: 30, y: 30 }] },
        ],
        steps: [
          { instruction: "Start at room H-110.", floor: 1 },
          { instruction: "take the elevator to floor 2.", floor: 2 },
          { instruction: "Room H-260 will be straight ahead.", floor: 2 },
        ],
        startFloor: 1,
        endFloor: 2,
      }),
    }));

    expect(indoorDirections.findIndoorRoute).toHaveBeenCalledWith(
      "H",
      "110",
      "260",
      false,
      false,
      true,
    );
  });

  test("toggles accessibility settings modal from header", () => {
    const props = createProps({
      route: createRoute(),
    });

    const tree = renderModal(props);

    findByTestID(tree, "indoor-directions-settings-button").props.onPress();
    expect(mockStates[3]).toBe(true);

    const settingsModal = findAll(
      tree,
      (node) =>
        node?.type === "Modal" && node?.props?.animationType === "fade",
    )[0];
    expect(settingsModal).toBeTruthy();
    settingsModal.props.onRequestClose();
    expect(mockStates[3]).toBe(false);

    findByTestID(tree, "indoor-directions-settings-overlay").props.onPress();
    expect(mockStates[3]).toBe(false);

    const stopPropagation = jest.fn();
    findByTestID(tree, "indoor-directions-settings-card").props.onPress({
      stopPropagation,
    });
    expect(stopPropagation).toHaveBeenCalled();
  });
});
