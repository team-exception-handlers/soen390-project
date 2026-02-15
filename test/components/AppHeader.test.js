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
  useSafeAreaInsets: () => ({ top: 10 }),
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

  test("campus buttons call onCampusChange with correct value", () => {
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

    // trigger the onPress arrow functions inside CampusButton
    sgw.props.onPress();
    expect(onCampusChange).toHaveBeenCalledWith("SGW");

    loy.props.onPress();
    expect(onCampusChange).toHaveBeenCalledWith("LOY");
  });

  test("applies correct styles depending on Platform and isWide", () => {
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
    const lg = el.props.style;
    expect(lg).toContainEqual({ paddingHorizontal: 28 });

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

  test("BlurView children onPress functions are executed", () => {
    const AppHeader = require("../../components/AppHeader").default;
    const onCampusChange = jest.fn();
    const searchInputRef = { current: null };
    const el = AppHeader({
      campus: "SGW",
      onCampusChange,
      searchText: "",
      onSearchTextChange: jest.fn(),
      searchInputRef,
    });

    // Find campus buttons inside BlurView
    const sgw = findByTestID(el, "campus-toggle-sgw");
    const loy = findByTestID(el, "campus-toggle-loyola");

    // trigger onPress
    sgw.props.onPress(); // line 98
    loy.props.onPress(); // line 100

    expect(onCampusChange).toHaveBeenCalledWith("SGW");
    expect(onCampusChange).toHaveBeenCalledWith("LOY");
  });
});
