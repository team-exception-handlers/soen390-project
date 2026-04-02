import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Platform, StyleSheet } from "react-native";
import type { BuildingRecord, Campus } from "../../constants/buildings";
import type { MapScreenStyles } from "../../styles/mapScreen.styles";
import type { LatLng, MapBounds, RouteMode } from "../../types/map";
import { decodePolyline, type TransitItinerary } from "../../utils/transitousDirections";
import { getTransitColor } from "./mapScreen.helpers";
import { buildWebMapHtml } from "./buildWebMapHtml";
import type { MapRegion } from "../../utils/mapRegions";

let WebView: ComponentType<any> | null = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    WebView = require("react-native-webview").WebView;
  } catch {
    WebView = null;
  }
}

type CampusMarkerData = {
  campus: Campus;
  latitude: number;
  longitude: number;
};

type WebCampusMapProps = Readonly<{
  styles: MapScreenStyles;
  defaultRegion: MapRegion;
  buildingsWithPolygons: BuildingRecord[];
  campusMarkerData: CampusMarkerData[];
  allPolygons: any;
  currentBuilding: string | null | undefined;
  selectedBuilding: string | null;
  routeMode: RouteMode;
  routeCoordinates: LatLng[];
  shuttleWalkToCoords: LatLng[];
  shuttleDriveCoords: LatLng[];
  shuttleWalkFromCoords: LatLng[];
  transitItineraries: TransitItinerary[];
  selectedItineraryIndex: number;
  userLocation: { coords?: LatLng } | null;
  campus: Campus;
  focusBounds: MapBounds;
  focusRequestKey: number;
  setSelectedBuilding: (code: string | null) => void;
}>;

export default function WebCampusMap({
  styles,
  defaultRegion,
  buildingsWithPolygons,
  campusMarkerData,
  allPolygons,
  currentBuilding,
  selectedBuilding,
  routeMode,
  routeCoordinates,
  shuttleWalkToCoords,
  shuttleDriveCoords,
  shuttleWalkFromCoords,
  transitItineraries,
  selectedItineraryIndex,
  userLocation,
  campus,
  focusBounds,
  focusRequestKey,
  setSelectedBuilding,
}: WebCampusMapProps) {
  const webIframeRef = useRef<HTMLIFrameElement | null>(null);
  const webViewRef = useRef<any>(null);
  const [webMapReady, setWebMapReady] = useState(false);

  const webFrameTargetOrigin =
    Platform.OS === "web" && typeof globalThis.window !== "undefined"
      ? globalThis.window.location.origin
      : null;
  const serializedWebFrameTargetOrigin = JSON.stringify(
    webFrameTargetOrigin ?? "*",
  );

  const postToWebIframe = useCallback(
    (message: unknown) => {
      if (Platform.OS !== "web" || !webFrameTargetOrigin) return;
      webIframeRef.current?.contentWindow?.postMessage(
        message,
        webFrameTargetOrigin,
      );
    },
    [webFrameTargetOrigin],
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !webFrameTargetOrigin) return;

    const handler = (event: MessageEvent) => {
      if (event.origin !== webFrameTargetOrigin) return;
      if (event.source !== webIframeRef.current?.contentWindow) return;

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data?.type === "buildingSelected") {
          setSelectedBuilding(data.buildingCode);
        }
        if (data?.type === "buildingDeselected") {
          setSelectedBuilding(null);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setSelectedBuilding, webFrameTargetOrigin]);

  const webTransitSegments = useMemo(() => {
    if (routeMode !== "transit") return [];
    const itinerary = transitItineraries[selectedItineraryIndex];
    if (!itinerary) return [];

    return itinerary.legs
      .filter((leg) => !!leg.legGeometry?.points)
      .map((leg) => {
        const precision = (leg.legGeometry as any)?.precision ?? 7;
        return {
          mode: leg.mode,
          route: leg.route ?? "",
          color: getTransitColor(leg.mode, leg.route),
          coords: decodePolyline(leg.legGeometry!.points, precision).map(
            (point) => [point.latitude, point.longitude] as [number, number],
          ),
        };
      });
  }, [routeMode, selectedItineraryIndex, transitItineraries]);

  const mapHTML = useMemo(
    () =>
      buildWebMapHtml({
        defaultRegion,
        buildingsWithPolygons: buildingsWithPolygons.map(
          ({ latitude, longitude, code, shortName, campus: buildingCampus }) => ({
            latitude,
            longitude,
            code,
            shortName,
            campus: buildingCampus,
          }),
        ),
        campusMarkerData,
        allPolygons,
        currentBuilding: Platform.OS === "web" ? currentBuilding ?? null : null,
        routeMode,
        routeCoordinates,
        shuttleWalkToCoords,
        shuttleDriveCoords,
        shuttleWalkFromCoords,
        transitSegments: webTransitSegments,
        serializedWebFrameTargetOrigin,
        userLat:
          Platform.OS === "web" ? userLocation?.coords?.latitude ?? null : null,
        userLng:
          Platform.OS === "web" ? userLocation?.coords?.longitude ?? null : null,
        focusBounds,
      }),
    [
      allPolygons,
      buildingsWithPolygons,
      campusMarkerData,
      currentBuilding,
      defaultRegion,
      focusBounds,
      routeCoordinates,
      routeMode,
      serializedWebFrameTargetOrigin,
      shuttleDriveCoords,
      shuttleWalkFromCoords,
      shuttleWalkToCoords,
      userLocation,
      webTransitSegments,
    ],
  );

  const webViewSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      setWebMapReady(false);
    }
  }, [mapHTML]);

  useEffect(() => {
    const message = {
      type: "focusBounds",
      bounds: focusBounds,
      campus,
      padding: [20, 20],
    };

    if (Platform.OS === "web") {
      postToWebIframe(message);
      return;
    }

    if (webViewRef.current && webMapReady) {
      const script = `
        (function() {
          if (window.setMapBounds) {
            window.setMapBounds(${JSON.stringify(focusBounds)}, [20, 20], ${JSON.stringify(campus)});
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    }
  }, [campus, focusBounds, focusRequestKey, postToWebIframe, webMapReady]);

  useEffect(() => {
    if (Platform.OS === "web" || !webViewRef.current || !webMapReady || !userLocation) {
      return;
    }

    const { latitude, longitude } = userLocation.coords ?? {};
    if (typeof latitude !== "number" || typeof longitude !== "number") return;

    const script = `
      (function() {
        try {
          if (typeof L !== 'undefined' && window.map) {
            if (window.userMarker) {
              window.userMarker.setLatLng([${latitude}, ${longitude}]);
            } else {
              const userIcon = L.divIcon({
                className: 'user-marker',
                html: '<div style="width: 14px; height: 14px; background: #007AFF; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });
              window.userMarker = L.marker([${latitude}, ${longitude}], { icon: userIcon }).addTo(window.map);
            }
          }
        } catch (e) {
          console.log('User marker error:', e);
        }
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(script);
  }, [userLocation, webMapReady]);

  useEffect(() => {
    if (Platform.OS === "web" || !webViewRef.current || !webMapReady) return;

    const script = `
      (function() {
        try {
          if (typeof L === 'undefined' || !window.polygonMap) return;
          const nextCode = ${JSON.stringify(currentBuilding ?? null)};
          const selectedCode =
            (window.selectedPolygon && window.selectedPolygon.__buildingCode) ||
            window.selectedBuildingCode ||
            null;

          if (
            window.currentBuildingCode &&
            window.currentBuildingCode !== selectedCode &&
            window.currentBuildingPolygon
          ) {
            window.currentBuildingPolygon.setStyle({
              color: '#A32638',
              fillColor: '#A32638',
              fillOpacity: 0.2,
              weight: 2
            });
          }

          if (nextCode && window.polygonMap[nextCode]) {
            window.currentBuildingPolygon = window.polygonMap[nextCode];
            window.currentBuildingCode = nextCode;
            if (nextCode !== selectedCode) {
              window.currentBuildingPolygon.setStyle({
                color: '#FFA500',
                fillColor: '#FFA500',
                fillOpacity: 0.5,
                weight: 3
              });
            }
          } else {
            window.currentBuildingPolygon = null;
            window.currentBuildingCode = null;
          }
        } catch (e) {
          console.log('Current building highlight error:', e);
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(script);
  }, [currentBuilding, selectedBuilding, userLocation, webMapReady]);

  if (Platform.OS === "web") {
    return (
      <iframe
        ref={webIframeRef}
        srcDoc={mapHTML}
        style={{ ...(StyleSheet.flatten(styles.map) as object), border: 0 }}
        allowFullScreen
        title="Concordia map"
        onLoad={() =>
          postToWebIframe({
            type: "focusBounds",
            bounds: focusBounds,
            campus,
            padding: [20, 20],
          })
        }
      />
    );
  }

  if (WebView) {
    return (
      <WebView
        testID="map-webview"
        ref={webViewRef}
        source={webViewSource}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit
        originWhitelist={["*"]}
        injectedJavaScriptBeforeContentLoaded={`
          window.ReactNativeWebView = {
            postMessage: function(data) {
              window.location.href = 'rnmsg://' + encodeURIComponent(data);
            }
          };
          true;
        `}
        onLoadEnd={() => setWebMapReady(true)}
        onShouldStartLoadWithRequest={(request: { url: string }) => {
          if (request.url.startsWith("rnmsg://")) {
            try {
              const data = JSON.parse(
                decodeURIComponent(request.url.replace("rnmsg://", "")),
              );
              if (data?.type === "buildingSelected") {
                setSelectedBuilding(data.buildingCode);
              }
              if (data?.type === "buildingDeselected") {
                setSelectedBuilding(null);
              }
            } catch {
              // ignore malformed bridge messages
            }
            return false;
          }
          return true;
        }}
      />
    );
  }

  return null;
}
