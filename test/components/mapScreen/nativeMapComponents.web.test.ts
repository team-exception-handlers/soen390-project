import { EMPTY_NATIVE_MAP_COMPONENTS } from "../../../components/mapScreen/nativeMapComponents.types";
import {
  loadNativeMapComponents,
  EMPTY_NATIVE_MAP_COMPONENTS as reExported,
} from "../../../components/mapScreen/nativeMapComponents.web";

describe("nativeMapComponents.web", () => {
  test("loadNativeMapComponents returns EMPTY_NATIVE_MAP_COMPONENTS", () => {
    const result = loadNativeMapComponents();
    expect(result).toBe(EMPTY_NATIVE_MAP_COMPONENTS);
  });

  test("all component fields are null", () => {
    const result = loadNativeMapComponents();
    expect(result.MapViewComponent).toBeNull();
    expect(result.MapMarkerComponent).toBeNull();
    expect(result.MapCalloutComponent).toBeNull();
    expect(result.MapPolygonComponent).toBeNull();
    expect(result.MapPolylineComponent).toBeNull();
  });

  test("re-exports EMPTY_NATIVE_MAP_COMPONENTS", () => {
    expect(reExported).toBe(EMPTY_NATIVE_MAP_COMPONENTS);
  });
});
