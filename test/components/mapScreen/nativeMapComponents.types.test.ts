import {
  EMPTY_NATIVE_MAP_COMPONENTS,
  type NativeMapComponents,
} from "../../../components/mapScreen/nativeMapComponents.types";

describe("nativeMapComponents.types", () => {
  test("EMPTY_NATIVE_MAP_COMPONENTS has all fields set to null", () => {
    const expected: NativeMapComponents = {
      MapViewComponent: null,
      MapMarkerComponent: null,
      MapCalloutComponent: null,
      MapPolygonComponent: null,
      MapPolylineComponent: null,
    };
    expect(EMPTY_NATIVE_MAP_COMPONENTS).toEqual(expected);
  });
});
