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

function createProps(overrides = {}) {
  return {
    styles: createStyles(),
    defaultRegion: {
      latitude: 45.497,
      longitude: -73.579,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    buildingsWithPolygons: [
      {
        code: "H",
        shortName: "Hall",
        campus: "SGW",
        latitude: 45.497,
        longitude: -73.579,
      },
    ],
    campusMarkerData: [
      { campus: "SGW", latitude: 45.497, longitude: -73.579 },
    ],
    allPolygons: {
      features: [
        {
          properties: { code: "H" },
          geometry: {
            coordinates: [
              [
                [-73.58, 45.497],
                [-73.579, 45.497],
                [-73.579, 45.498],
                [-73.58, 45.497],
              ],
            ],
          },
        },
      ],
    },
    currentBuilding: "H",
    selectedBuilding: null,
    routeMode: "transit",
    routeCoordinates: [
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.578 },
    ],
    shuttleWalkToCoords: [],
    shuttleDriveCoords: [],
    shuttleWalkFromCoords: [],
    transitItineraries: [
      {
        legs: [
          {
            mode: "WALK",
            route: "",
            legGeometry: { points: "encoded", precision: 6 },
          },
        ],
      },
    ],
    selectedItineraryIndex: 0,
    userLocation: {
      coords: { latitude: 45.497, longitude: -73.579 },
    },
    campus: "SGW",
    focusBounds: [
      [45.496, -73.58],
      [45.5, -73.576],
    ],
    focusRequestKey: 1,
    setSelectedBuilding: jest.fn(),
    ...overrides,
  };
}

function loadWebCampusMap({
  os,
  iframeRefCurrent = null,
  webViewRefCurrent = null,
  webMapReady = false,
  withWebView = true,
}) {
  let WebCampusMap;
  const buildWebMapHtml = jest.fn(() => "<html>mock-map</html>");
  const decodePolyline = jest.fn(() => [
    { latitude: 45.497, longitude: -73.579 },
    { latitude: 45.498, longitude: -73.578 },
  ]);
  const stateSetter = jest.fn();

  jest.isolateModules(() => {
    jest.doMock("react", () => {
      const actual = jest.requireActual("react");
      let refCall = 0;
      return {
        ...actual,
        useState: () => [webMapReady, stateSetter],
        useMemo: (factory) => factory(),
        useCallback: (fn) => fn,
        useEffect: (effect) => effect(),
        useRef: (value) => {
          refCall += 1;
          if (refCall === 1) return { current: iframeRefCurrent };
          if (refCall === 2) return { current: webViewRefCurrent };
          return { current: value };
        },
      };
    });

    jest.doMock("react-native", () => ({
      Platform: { OS: os },
      StyleSheet: { flatten: (value) => value },
    }));

    jest.doMock("../../../components/mapScreen/buildWebMapHtml", () => ({
      buildWebMapHtml,
    }));

    jest.doMock("../../../utils/transitousDirections", () => ({
      decodePolyline,
    }));

    jest.doMock("../../../utils/locationUtils", () => ({
      findUserBuilding: jest.fn(() => null),
    }));

    if (withWebView) {
      jest.doMock("react-native-webview", () => {
        const React = require("react");
        return {
          WebView: ({ children, ...rest }) =>
            React.createElement("WebView", rest, children),
        };
      });
    } else {
      jest.doMock("react-native-webview", () => {
        throw new Error("missing");
      });
    }

    WebCampusMap = require("../../../components/mapScreen/WebCampusMap").default;
  });

  return { WebCampusMap, buildWebMapHtml, decodePolyline, stateSetter };
}

describe("components/mapScreen/WebCampusMap", () => {
  let originalWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    originalWindow = global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
    jest.resetModules();
  });

  test("renders the iframe map on web and bridges postMessage events", () => {
    const postMessage = jest.fn();
    const contentWindow = { postMessage };
    const messageHandlers = [];
    global.window = {
      location: { origin: "https://campus.example" },
      addEventListener: jest.fn((event, handler) => {
        if (event === "message") messageHandlers.push(handler);
      }),
      removeEventListener: jest.fn(),
    };

    const { WebCampusMap, buildWebMapHtml, decodePolyline } = loadWebCampusMap({
      os: "web",
      iframeRefCurrent: { contentWindow },
      withWebView: false,
    });

    const props = createProps();
    const tree = renderTree(WebCampusMap(props));

    expect(tree.type).toBe("iframe");
    expect(tree.props.srcDoc).toBe("<html>mock-map</html>");
    expect(buildWebMapHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        currentBuilding: "H",
        userLat: 45.497,
        userLng: -73.579,
        serializedWebFrameTargetOrigin: "\"https://campus.example\"",
      }),
    );
    expect(decodePolyline).toHaveBeenCalledWith("encoded", 6);

    messageHandlers[0]({
      origin: "https://campus.example",
      source: contentWindow,
      data: JSON.stringify({ type: "buildingSelected", buildingCode: "H" }),
    });
    expect(props.setSelectedBuilding).toHaveBeenCalledWith("H");

    messageHandlers[0]({
      origin: "https://campus.example",
      source: contentWindow,
      data: { type: "buildingDeselected" },
    });
    expect(props.setSelectedBuilding).toHaveBeenCalledWith(null);

    tree.props.onLoad();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "focusBounds",
        campus: "SGW",
      }),
      "https://campus.example",
    );
  });

  test("renders the native webview and handles bridge callbacks", () => {
    global.window = undefined;
    const injectJavaScript = jest.fn();
    const { WebCampusMap, buildWebMapHtml, stateSetter } = loadWebCampusMap({
      os: "ios",
      webViewRefCurrent: { injectJavaScript },
      webMapReady: true,
      withWebView: true,
    });

    const props = createProps({
      selectedBuilding: "EV",
    });
    const tree = renderTree(WebCampusMap(props));
    const webView = findByTestID(tree, "map-webview");

    expect(webView.type).toBe("WebView");
    expect(buildWebMapHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        currentBuilding: null,
        userLat: null,
        userLng: null,
      }),
    );
    expect(injectJavaScript).toHaveBeenCalled();

    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: `rnmsg://${encodeURIComponent(
          JSON.stringify({ type: "buildingSelected", buildingCode: "H" }),
        )}`,
      }),
    ).toBe(false);
    expect(props.setSelectedBuilding).toHaveBeenCalledWith("H");

    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: `rnmsg://${encodeURIComponent(
          JSON.stringify({ type: "buildingDeselected" }),
        )}`,
      }),
    ).toBe(false);
    expect(props.setSelectedBuilding).toHaveBeenCalledWith(null);

    expect(
      webView.props.onShouldStartLoadWithRequest({
        url: "https://example.com",
      }),
    ).toBe(true);

    webView.props.onLoadEnd();
    expect(stateSetter).toHaveBeenCalledWith(true);
  });

  test("returns null on native when react-native-webview is unavailable", () => {
    global.window = undefined;
    const { WebCampusMap } = loadWebCampusMap({
      os: "android",
      withWebView: false,
    });

    expect(WebCampusMap(createProps())).toBeNull();
  });
});
