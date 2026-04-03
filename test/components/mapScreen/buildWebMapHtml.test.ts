import { buildWebMapHtml } from "../../../components/mapScreen/buildWebMapHtml";

describe("components/mapScreen/buildWebMapHtml", () => {
  const baseArgs = {
    defaultRegion: {
      latitude: 45.497,
      longitude: -73.579,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    buildingsWithPolygons: [
      {
        latitude: 45.497,
        longitude: -73.579,
        code: "H",
        shortName: "Hall",
        campus: "SGW" as const,
      },
    ],
    campusMarkerData: [
      { campus: "SGW" as const, latitude: 45.497, longitude: -73.579 },
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
    routeMode: "transit" as const,
    routeCoordinates: [
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.578 },
    ],
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
    transitSegments: [
      {
        mode: "BUS",
        route: "24",
        color: "#007AFF",
        coords: [
          [45.497, -73.579],
          [45.498, -73.578],
        ] as [number, number][],
      },
    ],
    serializedWebFrameTargetOrigin: "\"https://example.com\"",
    userLat: 45.497,
    userLng: -73.579,
    focusBounds: [
      [45.496, -73.58],
      [45.5, -73.576],
    ] as [[number, number], [number, number]],
  };

  test("serializes map state, polygons, transit segments, and user marker data", () => {
    const html = buildWebMapHtml(baseArgs);

    expect(html).toContain("const map = L.map('map', { maxZoom: 22 }).setView([45.497, -73.579], 20);");
    expect(html).toContain('"code":"H"');
    expect(html).toContain('"route":"24"');
    expect(html).toContain("window.setMapBounds(initialFocusBounds, [20, 20], window.selectedCampus)");
    expect(html).toContain("window.currentBuildingCode = currentBuilding");
    expect(html).toContain("window.userMarker = L.marker([45.497, -73.579], { icon: userIcon }).addTo(map);");
    expect(html).toContain('window.parent.postMessage(payload, parentMessageTargetOrigin);');
  });

  test("omits the injected user marker block when no user location is available", () => {
    const html = buildWebMapHtml({
      ...baseArgs,
      currentBuilding: null,
      routeMode: "walking",
      transitSegments: [],
      userLat: null,
      userLng: null,
    });

    expect(html).toContain("routeMode === 'walking' ? 7 : 6");
    expect(html).toContain("const currentBuilding = null;");
    expect(html).not.toContain("window.userMarker = L.marker");
  });
});
