jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");

  const Text = ({ children, ...rest }) =>
    React.createElement("Text", rest, children);
  Text.propTypes = { children: PropTypes.node };

  const View = ({ children, ...rest }) =>
    React.createElement("View", rest, children);
  View.propTypes = { children: PropTypes.node };

  return {
    Text,
    View,
  };
});

const CurrentBuildingBanner =
  require("../../../components/mapScreen/CurrentBuildingBanner").default;

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

describe("components/mapScreen/CurrentBuildingBanner", () => {
  test("returns null when no building is selected", () => {
    const element = CurrentBuildingBanner({
      building: null,
      isWebPlatform: true,
      topInset: 0,
      styles: createStyles(),
    });

    expect(element).toBeNull();
  });

  test("renders current building details on web", () => {
    const styles = createStyles();
    const tree = renderTree(
      CurrentBuildingBanner({
        building: {
          code: "H",
          shortName: "Hall",
          longName: "Hall Building",
        },
        isWebPlatform: true,
        topInset: 12,
        styles,
      }),
    );

    expect(findByTestID(tree, "current-building-name").props.children).toEqual([
      "Hall Building",
      " (",
      "Hall",
      ") - [",
      "H",
      "]",
    ]);
    expect(findByTestID(tree, "current-building-info").props.style).toEqual([
      styles.buildingInfo,
      false,
    ]);
  });

  test("offsets the banner below the safe area on native", () => {
    const styles = createStyles();
    const tree = renderTree(
      CurrentBuildingBanner({
        building: {
          code: "EV",
          shortName: "Engineering",
          longName: "Engineering Building",
        },
        isWebPlatform: false,
        topInset: 20,
        styles,
      }),
    );

    expect(findByTestID(tree, "current-building-info").props.style).toEqual([
      styles.buildingInfo,
      { top: 64 },
    ]);
  });
});
