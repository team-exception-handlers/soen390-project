/**
 * Loads AppHeader with Platform.OS === "ios" so StyleSheet.create evaluates
 * non-web branches (paddingTop, transform, marginTop, title marginTop).
 */

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const PropTypes = require("prop-types");
  const LinearGradient = ({ children, ...rest }) =>
    React.createElement("LinearGradient", rest, children);
  LinearGradient.propTypes = { children: PropTypes.node };
  return { LinearGradient };
});

jest.mock("expo-blur", () => {
  const React = require("react");
  const PropTypes = require("prop-types");
  const BlurView = ({ children, ...rest }) =>
    React.createElement("BlurView", rest, children);
  BlurView.propTypes = { children: PropTypes.node };
  return { BlurView };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 10 }),
}));

jest.mock("react-native", () => {
  const React = require("react");
  const PropTypes = require("prop-types");
  const Pressable = ({ children, ...rest }) =>
    React.createElement("Pressable", rest, children);
  const Text = ({ children, ...rest }) =>
    React.createElement("Text", rest, children);
  const View = ({ children, ...rest }) =>
    React.createElement("View", rest, children);
  Pressable.propTypes = { children: PropTypes.node };
  Text.propTypes = { children: PropTypes.node };
  View.propTypes = { children: PropTypes.node };
  return {
    Platform: { OS: "ios" },
    Pressable,
    StyleSheet: { create: (s) => s },
    Text,
    TextInput: (props) => React.createElement("TextInput", props),
    View,
    useWindowDimensions: () => ({ width: 400, height: 800 }),
  };
});

describe("components/AppHeader native StyleSheet branches", () => {
  test("module evaluates iOS style branches without throwing", () => {
    jest.isolateModules(() => {
      expect(() => require("../../components/AppHeader")).not.toThrow();
    });
  });
});
