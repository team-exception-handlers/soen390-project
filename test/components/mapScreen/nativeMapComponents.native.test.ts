import { EMPTY_NATIVE_MAP_COMPONENTS } from "../../../components/mapScreen/nativeMapComponents.types";

// Mock react-native-maps before importing the module under test
const mockMaps = {
  default: () => "MapView",
  Marker: () => "Marker",
  Callout: () => "Callout",
  Polygon: () => "Polygon",
  Polyline: () => "Polyline",
};

jest.mock("react-native-maps", () => mockMaps);

describe("nativeMapComponents.native", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("returns native map components when react-native-maps is available", () => {
    jest.mock("react-native-maps", () => mockMaps);

    const { loadNativeMapComponents } = require(
      "../../../components/mapScreen/nativeMapComponents.native"
    );
    const result = loadNativeMapComponents();

    expect(result.MapViewComponent).toBe(mockMaps.default);
    expect(result.MapMarkerComponent).toBe(mockMaps.Marker);
    expect(result.MapCalloutComponent).toBe(mockMaps.Callout);
    expect(result.MapPolygonComponent).toBe(mockMaps.Polygon);
    expect(result.MapPolylineComponent).toBe(mockMaps.Polyline);
  });

  test("returns EMPTY_NATIVE_MAP_COMPONENTS when react-native-maps is unavailable", () => {
    jest.mock("react-native-maps", () => {
      throw new Error("Module not found");
    });

    const { loadNativeMapComponents } = require(
      "../../../components/mapScreen/nativeMapComponents.native"
    );
    const result = loadNativeMapComponents();

    expect(result).toEqual(EMPTY_NATIVE_MAP_COMPONENTS);
  });

  test("re-exports EMPTY_NATIVE_MAP_COMPONENTS", () => {
    const { EMPTY_NATIVE_MAP_COMPONENTS: reExported } = require(
      "../../../components/mapScreen/nativeMapComponents.native"
    );
    expect(reExported).toEqual(EMPTY_NATIVE_MAP_COMPONENTS);
  });
});
