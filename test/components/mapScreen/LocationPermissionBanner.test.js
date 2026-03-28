jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");

  const Text = ({ children, ...rest }) =>
    React.createElement("Text", rest, children);
  Text.propTypes = { children: PropTypes.node };

  const TouchableOpacity = ({ children, ...rest }) =>
    React.createElement("TouchableOpacity", rest, children);
  TouchableOpacity.propTypes = { children: PropTypes.node };

  return {
    Text,
    TouchableOpacity,
  };
});

const LocationPermissionBanner =
  require("../../../components/mapScreen/LocationPermissionBanner").default;

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

describe("components/mapScreen/LocationPermissionBanner", () => {
  test("returns null when location guidance is hidden", () => {
    const element = LocationPermissionBanner({
      visible: false,
      bottomOffset: 10,
      onPress: jest.fn(),
      styles: createStyles(),
    });

    expect(element).toBeNull();
  });

  test("renders the permission banner and forwards presses", () => {
    const onPress = jest.fn();
    const styles = createStyles();
    const tree = renderTree(
      LocationPermissionBanner({
        visible: true,
        bottomOffset: 28,
        onPress,
        styles,
      }),
    );

    const banner = findByTestID(tree, "location-permission-banner");
    expect(banner.props.style).toEqual([
      styles.permissionBanner,
      { bottom: 28 },
    ]);
    banner.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
