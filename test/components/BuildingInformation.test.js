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

  const Animated = {
    Value: function (v) {
      this._value = v;
    },
    timing: (val, opts) => ({ start: jest.fn() }),
    View: (props) => React.createElement("AnimatedView", props, props.children),
  };

  return {
    Animated,
    Dimensions: { get: () => ({ height: 800 }) },
    Image: (props) => React.createElement("Image", props, null),
    Pressable: (props) =>
      React.createElement("Pressable", props, props.children),
    ScrollView: (props) =>
      React.createElement("ScrollView", props, props.children),
    StyleSheet: { create: (s) => s },
    Text: (props) => React.createElement("Text", props, props.children),
    View: (props) => React.createElement("View", props, props.children),
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

describe("components/BuildingInformation", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function findByTestID(node, id) {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const res = findByTestID(child, id);
        if (res) return res;
      }
      return null;
    }
    if (node && node.props && node.props.testID === id) return node;
    if (node && node.props && node.props.children)
      return findByTestID(node.props.children, id);
    return null;
  }

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

  test("animates to collapsed height when buildingCode is null", () => {
    const onClose = jest.fn();
    const el = BuildingInformation({
      buildingCode: null, // triggers collapsed branch (lines 54-55)
      onClose,
      buildingName: "Collapsed Test",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      onSelectDestination: jest.fn(),
    });

    const drawer = findByTestID(el, "building-info-drawer");
    expect(drawer).toBeTruthy();
  });

  test("renders 'Start Here' button when editingField is 'from'", () => {
    const onClose = jest.fn();
    const onSelectDestination = jest.fn();
    const el = BuildingInformation({
      buildingCode: "B1",
      onClose,
      buildingName: "Start Here Test",
      buildingInfo: "x",
      buildingPhotoLink: undefined,
      editingField: "from", // triggers line 100
      onSelectDestination,
    });

    const directionsBtn = findByTestID(el, "building-info-directions");
    expect(directionsBtn).toBeTruthy();

    const textNode = findByTestID(directionsBtn, undefined); // capture child text
    expect(directionsBtn.props.children.props.children).toBe("Start Here");

    // simulate pressing the directions button
    directionsBtn.props.onPress();
    expect(onSelectDestination).toHaveBeenCalledWith("B1");
  });
});
