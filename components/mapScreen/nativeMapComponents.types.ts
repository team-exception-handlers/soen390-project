import type { ComponentType, ElementType } from "react";

export type NativeMapComponents = {
  MapViewComponent: ComponentType<any> | null;
  MapMarkerComponent: ComponentType<any> | null;
  MapCalloutComponent: ComponentType<any> | null;
  MapPolygonComponent: ComponentType<any> | null;
  MapPolylineComponent: ElementType | null;
};

export const EMPTY_NATIVE_MAP_COMPONENTS: NativeMapComponents = {
  MapViewComponent: null,
  MapMarkerComponent: null,
  MapCalloutComponent: null,
  MapPolygonComponent: null,
  MapPolylineComponent: null,
};
