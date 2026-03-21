import {
  EMPTY_NATIVE_MAP_COMPONENTS,
  type NativeMapComponents,
} from "./nativeMapComponents.types";

export const loadNativeMapComponents = (): NativeMapComponents => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require("react-native-maps");

    return {
      MapViewComponent: maps.default,
      MapMarkerComponent: maps.Marker,
      MapCalloutComponent: maps.Callout,
      MapPolygonComponent: maps.Polygon,
      MapPolylineComponent: maps.Polyline,
    };
  } catch {
    return EMPTY_NATIVE_MAP_COMPONENTS;
  }
};

export { EMPTY_NATIVE_MAP_COMPONENTS };
