jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  return {
    LinearGradient: ({ children, ...props }) =>
      React.createElement("LinearGradient", props, children),
  };
});

jest.mock("expo-blur", () => {
  const React = require("react");
  return {
    BlurView: ({ children, ...props }) =>
      React.createElement("BlurView", props, children),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 10 }), // non-zero to test paddingTop branch
}));

jest.mock("react-native", () => {
  const React = require("react");
  return {
    Platform: { OS: "web" },
    Pressable: (props) =>
      React.createElement("Pressable", props, props.children),
    StyleSheet: { create: (s) => s },
    Text: (props) => React.createElement("Text", props, props.children),
    TextInput: (props) => React.createElement("TextInput", props),
    View: (props) => React.createElement("View", props, props.children),
    useWindowDimensions: () => ({ width: 1000, height: 800 }),
  };
});

describe("components/AppHeader", () => {
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

  test("renders title and search input with provided value", () => {
    const AppHeader = require("../../components/AppHeader").default;
    const onCampusChange = jest.fn();
    const onSearchTextChange = jest.fn();
    const searchInputRef = { current: null };

    const el = AppHeader({
      campus: "SGW",
      onCampusChange,
      searchText: "hello world",
      onSearchTextChange,
      searchInputRef,
    });

    const title = findByTestID(el, "header-title");
    expect(title).toBeTruthy();
    expect(title.props.children).toBe("Where to?");

    const input = findByTestID(el, "search-input");
    expect(input).toBeTruthy();
    expect(input.props.value).toBe("hello world");
    expect(input.props.onChangeText).toBe(onSearchTextChange);
  });

  test("campus buttons call onCampusChange with correct value and cover active styles", () => {
    const AppHeader = require("../../components/AppHeader").default;
    const onCampusChange = jest.fn();
    const onSearchTextChange = jest.fn();
    const searchInputRef = { current: null };

    const el = AppHeader({
      campus: "SGW",
      onCampusChange,
      searchText: "",
      onSearchTextChange,
      searchInputRef,
    });

    const sgw = findByTestID(el, "campus-toggle-sgw");
    const loy = findByTestID(el, "campus-toggle-loyola");

    expect(sgw).toBeTruthy();
    expect(loy).toBeTruthy();

    // simulate presses
    sgw.props.onPress();
    expect(onCampusChange).toHaveBeenCalledWith("SGW");
    loy.props.onPress();
    expect(onCampusChange).toHaveBeenCalledWith("LOY");

    // Style coverage for active && inactive
    expect(Array.isArray(sgw.props.style)).toBe(true); // active=true
    expect(Array.isArray(loy.props.style)).toBe(true); // active=false
    expect(Array.isArray(sgw.props.children.props.style)).toBe(true);
    expect(Array.isArray(loy.props.children.props.style)).toBe(true);
  });

  test("applies correct styles depending on Platform, isWide and insets", () => {
    const path = require("path");
    const reactNative = require("react-native");

    // web + wide
    reactNative.Platform.OS = "web";
    reactNative.useWindowDimensions = () => ({ width: 1000, height: 800 });
    const AppHeaderWebWide = require(
      path.join(__dirname, "..", "..", "components", "AppHeader"),
    ).default;
    let el = AppHeaderWebWide({
      campus: "SGW",
      onCampusChange: jest.fn(),
      searchText: "",
      onSearchTextChange: jest.fn(),
      searchInputRef: { current: null },
    });
    expect(el.props.style).toContainEqual({ paddingHorizontal: 28 });

    // web + narrow
    reactNative.useWindowDimensions = () => ({ width: 500, height: 800 });
    const AppHeaderWebNarrow = require(
      path.join(__dirname, "..", "..", "components", "AppHeader"),
    ).default;
    el = AppHeaderWebNarrow({
      campus: "SGW",
      onCampusChange: jest.fn(),
      searchText: "",
      onSearchTextChange: jest.fn(),
      searchInputRef: { current: null },
    });
    expect(el.props.style).not.toContainEqual({ paddingHorizontal: 28 });

    // ios / non-web
    reactNative.Platform.OS = "ios";
    reactNative.useWindowDimensions = () => ({ width: 500, height: 800 });
    const AppHeaderIos = require(
      path.join(__dirname, "..", "..", "components", "AppHeader"),
    ).default;
    el = AppHeaderIos({
      campus: "SGW",
      onCampusChange: jest.fn(),
      searchText: "",
      onSearchTextChange: jest.fn(),
      searchInputRef: { current: null },
    });
    const styleIos = el.props.style;
    expect(styleIos).toContainEqual({ paddingTop: 22 }); // insets.top=10 + 12
  });
});
