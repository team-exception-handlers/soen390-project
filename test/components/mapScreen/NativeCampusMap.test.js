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

function findAll(node, predicate, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, acc));
    return acc;
  }
  if (predicate(node)) acc.push(node);
  if (node?.props?.children) findAll(node.props.children, predicate, acc);
  return acc;
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

function loadNativeCampusMap({ fallback = false } = {}) {
  let NativeCampusMap;

  jest.isolateModules(() => {
    jest.doMock("react-native", () => {
      const React = require("react");
      const PropTypes = require("prop-types");

      const host =
        (type) => {
          const HostComponent = ({ children, ...rest }) =>
            React.createElement(type, rest, children);
          HostComponent.displayName = `${type}Host`;
          HostComponent.propTypes = { children: PropTypes.node };
          return HostComponent;
        };

      return {
        Text: host("Text"),
        View: host("View"),
      };
    });

    jest.doMock("../../../utils/transitousDirections", () => ({
      decodePolyline: jest.fn(() => [
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.578 },
      ]),
    }));

    jest.doMock("../../../utils/locationUtils", () => ({
      findUserBuilding: jest.fn(() => null),
    }));

    if (fallback) {
      jest.doMock("../../../utils/nativeMaps", () => ({
        NativeMapMarker: null,
        NativeMapPolygon: null,
        NativeMapPolyline: null,
        NativeMapView: null,
      }));
    } else {
      jest.doMock("../../../utils/nativeMaps", () => {
        const React = require("react");
        return {
          NativeMapMarker: ({ children, ...rest }) =>
            React.createElement("NativeMapMarker", rest, children),
          NativeMapPolygon: ({ children, ...rest }) =>
            React.createElement("NativeMapPolygon", rest, children),
          NativeMapPolyline: ({ children, ...rest }) =>
            React.createElement("NativeMapPolyline", rest, children),
          NativeMapView: ({ children, ...rest }) =>
            React.createElement("NativeMapView", rest, children),
        };
      });
    }

    NativeCampusMap = require("../../../components/mapScreen/NativeCampusMap").default;
  });

  return NativeCampusMap;
}

function createProps(overrides = {}) {
  return {
    mapRef: { current: null },
    styles: createStyles(),
    region: {
      latitude: 45.497,
      longitude: -73.579,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    isDirectionsMode: true,
    routeMode: "transit",
    routeCoordinates: [],
    transitItineraries: [
      {
        legs: [
          {
            mode: "WALK",
            route: "",
            from: { name: "A" },
            to: { name: "B" },
            legGeometry: { points: "encoded" },
          },
          {
            mode: "BUS",
            route: "24",
            from: { name: "B" },
            to: { name: "C" },
            legGeometry: null,
          },
        ],
      },
    ],
    selectedItineraryIndex: 0,
    shuttleWalkToCoords: [],
    shuttleDriveCoords: [],
    shuttleWalkFromCoords: [],
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
        {
          properties: { code: "CJ" },
          geometry: {
            coordinates: [
              [
                [-73.581, 45.496],
                [-73.58, 45.496],
                [-73.58, 45.497],
                [-73.581, 45.496],
              ],
            ],
          },
        },
      ],
    },
    selectedBuilding: "H",
    currentBuilding: "CJ",
    visibleBuildingsWithPolygons: [
      {
        code: "CJA",
        latitude: 45.4965,
        longitude: -73.5805,
      },
    ],
    showCampusSummaryMarkers: true,
    campusMarkerData: [
      { campus: "SGW", latitude: 45.497, longitude: -73.579 },
    ],
    setSelectedBuilding: jest.fn(),
    setMapViewportRegion: jest.fn(),
    ...overrides,
  };
}

describe("components/mapScreen/NativeCampusMap", () => {
  afterEach(() => {
    jest.resetModules();
  });

  test("renders a fallback when native map support is unavailable", () => {
    const NativeCampusMap = loadNativeCampusMap({ fallback: true });
    const tree = renderTree(NativeCampusMap(createProps()));
    const textNode = findAll(tree, (node) => node?.type === "Text")[0];

    expect(textNode.props.children).toBe("Map view is unavailable in this environment.");
  });

  test("renders transit overlays, polygons, building markers, and campus markers", () => {
    const NativeCampusMap = loadNativeCampusMap();
    const props = createProps();
    const tree = renderTree(NativeCampusMap(props));

    findAll(tree, (node) => node?.type === "NativeMapView")[0].props.onPress();
    expect(props.setSelectedBuilding).toHaveBeenCalledWith(null);

    findAll(tree, (node) => node?.type === "NativeMapView")[0]
      .props.onRegionChangeComplete(props.region);
    expect(props.setMapViewportRegion).toHaveBeenCalledWith(props.region);

    expect(
      findAll(tree, (node) => node?.type === "NativeMapPolyline"),
    ).toHaveLength(1);
    expect(findByTestID(tree, "polygon-H")).not.toBeNull();
    findByTestID(tree, "polygon-H").props.onPress();
    expect(props.setSelectedBuilding).toHaveBeenCalledWith(null);

    findByTestID(tree, "marker-CJA").props.onPress();
    expect(props.setSelectedBuilding).toHaveBeenCalledWith("CJ");
    expect(findByTestID(tree, "campus-marker-SGW")).not.toBeNull();
  });

  test("renders shuttle overlays when shuttle routing is active", () => {
    const NativeCampusMap = loadNativeCampusMap();
    const tree = renderTree(
      NativeCampusMap(
        createProps({
          routeMode: "shuttle",
          transitItineraries: [],
          shuttleWalkToCoords: [
            { latitude: 45.497, longitude: -73.579 },
            { latitude: 45.498, longitude: -73.578 },
          ],
          shuttleDriveCoords: [
            { latitude: 45.498, longitude: -73.578 },
            { latitude: 45.499, longitude: -73.577 },
          ],
          shuttleWalkFromCoords: [
            { latitude: 45.499, longitude: -73.577 },
            { latitude: 45.5, longitude: -73.576 },
          ],
        }),
      ),
    );

    expect(findByTestID(tree, "route-polyline-shuttle-walk-to")).not.toBeNull();
    expect(findByTestID(tree, "route-polyline-shuttle-drive")).not.toBeNull();
    expect(findByTestID(tree, "route-polyline-shuttle-walk-from")).not.toBeNull();
  });

  test("renders the default route polyline for walking directions", () => {
    const NativeCampusMap = loadNativeCampusMap();
    const tree = renderTree(
      NativeCampusMap(
        createProps({
          routeMode: "walking",
          transitItineraries: [],
          routeCoordinates: [
            { latitude: 45.497, longitude: -73.579 },
            { latitude: 45.498, longitude: -73.578 },
          ],
        }),
      ),
    );

    expect(findByTestID(tree, "route-polyline")).not.toBeNull();
  });
});
