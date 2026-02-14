jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 0, // just return 0 for tests
}));

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
