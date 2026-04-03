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

const createHostComponent = (type) => {
  const React = require("react");
  const PropTypes = require("prop-types");
  const HostComponent = ({ children, ...rest }) =>
    React.createElement(type, rest, children);
  HostComponent.displayName = `${type}Host`;
  HostComponent.propTypes = { children: PropTypes.node };
  return HostComponent;
};

const lucideMockFactory = () => {
  const React = require("react");
  return {
    X: (props) => React.createElement("XIcon", props),
  };
};

const svgMockFactory = () => {
  const React = require("react");
  return ({ children, ...rest }) => React.createElement("Svg", rest, children);
};

const reactNativeMockFactory = (os) => () => ({
  Image: createHostComponent("Image"),
  Modal: createHostComponent("Modal"),
  Platform: { OS: os },
  Pressable: createHostComponent("Pressable"),
  View: createHostComponent("View"),
});

function loadFloorPlanModal(os) {
  let FloorPlanModal;

  jest.isolateModules(() => {
    jest.doMock("lucide-react-native", lucideMockFactory);
    jest.doMock("react-native-svg", svgMockFactory);
    jest.doMock("react-native", reactNativeMockFactory(os));

    FloorPlanModal = require("../../../components/mapScreen/FloorPlanModal").default;
  });

  return FloorPlanModal;
}

describe("components/mapScreen/FloorPlanModal", () => {
  afterEach(() => {
    jest.resetModules();
  });

  test("renders image assets on web and closes when pressed", () => {
    const FloorPlanModal = loadFloorPlanModal("web");
    const onClose = jest.fn();
    const styles = createStyles();
    const tree = renderTree(
      FloorPlanModal({
        visible: true,
        activeFloorPlan: { uri: "floor-plan.png" },
        onClose,
        styles,
      }),
    );

    expect(findByType(tree, "Image").props.source).toEqual({
      uri: "floor-plan.png",
    });
    findByType(tree, "Pressable").props.onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("renders numeric native assets as images", () => {
    const FloorPlanModal = loadFloorPlanModal("ios");
    const tree = renderTree(
      FloorPlanModal({
        visible: true,
        activeFloorPlan: 42,
        onClose: jest.fn(),
        styles: createStyles(),
      }),
    );

    expect(findByType(tree, "Image").props.source).toBe(42);
  });

  test("renders component floor plans inside svg on native", () => {
    const FloorPlanModal = loadFloorPlanModal("ios");
    const FloorPlanGraphic = (props) => {
      const React = require("react");
      return React.createElement("FloorPlanGraphic", props);
    };

    const tree = renderTree(
      FloorPlanModal({
        visible: true,
        activeFloorPlan: FloorPlanGraphic,
        onClose: jest.fn(),
        styles: createStyles(),
      }),
    );

    expect(findByType(tree, "Svg")).not.toBeNull();
    expect(findByType(tree, "FloorPlanGraphic").props.width).toBe(1024);
    expect(findByType(tree, "FloorPlanGraphic").props.height).toBe(1024);
  });
});
