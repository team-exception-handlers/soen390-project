jest.mock("lucide-react-native", () => ({
  ChevronDown: (props) => {
    const React = require("react");
    return React.createElement("ChevronDown", props);
  },
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");

  const AnimatedView = ({ children, ...rest }) =>
    React.createElement("AnimatedView", rest, children);
  AnimatedView.propTypes = { children: PropTypes.node };

  const Animated = {
    Value: function (v) {
      this._value = v;
    },
    timing: (val, opts) => ({ start: jest.fn() }),
    View: AnimatedView,
  };

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
    Animated,
    Dimensions: { get: () => ({ height: 800 }) },
    Image: (props) => React.createElement("Image", props, null),
    Pressable,
    ScrollView,
    StyleSheet: { create: (s) => s },
    Text,
    View,
  };
});

jest.mock("react", () => {
  const Actual = jest.requireActual("react");
  return {
    ...Actual,
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    useEffect: (fn) => fn(),
  };
});

const BuildingInformation =
  require("../../components/BuildingInformation").default;

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
  if (node?.props?.children)
    return findByTestID(node.props.children, id);
  return null;
}

describe("components/BuildingInformation", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("renders title, image and description when provided", () => {
    const onClose = jest.fn();
    const el = BuildingInformation({
      buildingCode: "B1",
      onClose,
      buildingName: "My Building",
      buildingInfo: "This is a test building.",
      buildingPhotoLink: "http://example.com/photo.jpg",
      onSelectDestination: jest.fn(),
    });

    const drawer = findByTestID(el, "building-info-drawer");
    expect(drawer).toBeTruthy();

    const title = findByTestID(el, "building-info-title");
    expect(title.props.children).toBe("My Building");

    const desc = findByTestID(el, "building-info-description");
    expect(desc.props.children).toBe("This is a test building.");
  });

  test("renders fallback description when buildingInfo missing", () => {
    const onClose = jest.fn();
    const el = BuildingInformation({
      buildingCode: "B1",
      onClose,
      buildingName: "No Info",
      buildingInfo: undefined,
      buildingPhotoLink: undefined,
      onSelectDestination: jest.fn(),
    });

    const desc = findByTestID(el, "building-info-description");
    expect(desc.props.children).toBe("Building information not available.");
  });

  test("close button calls onClose when pressed", () => {
    const onClose = jest.fn();
    const el = BuildingInformation({
      buildingCode: "B1",
      onClose,
      buildingName: "Close Test",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      onSelectDestination: jest.fn(),
    });

    const closeBtn = findByTestID(el, "building-info-close");
    closeBtn.props.onPress();
    expect(onClose).toHaveBeenCalled();
  });

  test("directions button calls onSelectDestination when pressed", () => {
    const onSelectDestination = jest.fn();
    const el = BuildingInformation({
      buildingCode: "B1",
      onClose: jest.fn(),
      buildingName: "Directions Test",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      editingField: "to",
      onSelectDestination,
    });

    const directionsBtn = findByTestID(el, "building-info-directions");
    directionsBtn.props.onPress();
    expect(onSelectDestination).toHaveBeenCalledWith("B1");
  });

  test("shows 'Start Here' when editingField is 'from'", () => {
    const el = BuildingInformation({
      buildingCode: "B1",
      onClose: jest.fn(),
      buildingName: "Start Here Test",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      editingField: "from",
      onSelectDestination: jest.fn(),
    });

    const directionsBtn = findByTestID(el, "building-info-directions");
    const text = directionsBtn.props.children;
    expect(text.props.children).toBe("Start Here");
  });

  test("renders See floor plans when options exist and calls onOpenFloorPlans", () => {
    const onOpenFloorPlans = jest.fn();
    const el = BuildingInformation({
      buildingCode: "H",
      onClose: jest.fn(),
      buildingName: "Hall",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      onSelectDestination: jest.fn(),
      floorPlanOptions: [{ key: "H-1", label: "Floor 1" }],
      onOpenFloorPlans,
    });

    const floorPlansBtn = findByTestID(el, "building-info-floor-plans");
    expect(floorPlansBtn).toBeTruthy();

    // coverage: accessibilityLabel (line around 122)
    expect(floorPlansBtn.props.accessibilityLabel).toBe("See floor plans for this building");

    // coverage: style callback uses pressed state (line around 124)
    const styleNotPressed = floorPlansBtn.props.style({ pressed: false });
    const stylePressed = floorPlansBtn.props.style({ pressed: true });
    expect(styleNotPressed).not.toContainEqual({ opacity: 0.85 });
    expect(stylePressed).toContainEqual({ opacity: 0.85 });

    floorPlansBtn.props.onPress();
    expect(onOpenFloorPlans).toHaveBeenCalled();
  });

  test("does not render floor plans button when floorPlanOptions is empty", () => {
    const el = BuildingInformation({
      buildingCode: "H",
      onClose: jest.fn(),
      buildingName: "Hall",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      onSelectDestination: jest.fn(),
      floorPlanOptions: [],
      onOpenFloorPlans: jest.fn(),
    });

    expect(findByTestID(el, "building-info-floor-plans")).toBeNull();
  });

  test("does not render directions button when buildingCode is null", () => {
    const el = BuildingInformation({
      buildingCode: null,
      onClose: jest.fn(),
      buildingName: "No Code",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      onSelectDestination: jest.fn(),
    });

    const directionsBtn = findByTestID(el, "building-info-directions");
    expect(directionsBtn).toBeNull();
  });

  test("directions button style changes when pressed", () => {
    const el = BuildingInformation({
      buildingCode: "B1",
      onClose: jest.fn(),
      buildingName: "Style Test",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      editingField: "from",
      onSelectDestination: jest.fn(),
    });

    const directionsBtn = findByTestID(el, "building-info-directions");
    expect(directionsBtn).toBeTruthy();

    // simulate pressed = false
    const styleNormal = directionsBtn.props.style({ pressed: false });
    expect(styleNormal).toContainEqual(expect.any(Object)); // normal style applied
    expect(styleNormal).not.toContainEqual({ opacity: 0.85 });

    // simulate pressed = true
    const stylePressed = directionsBtn.props.style({ pressed: true });
    expect(stylePressed).toContainEqual({ opacity: 0.85 });
  });
});
