import type { RefObject } from "react";
import { Text, View } from "react-native";
import type { BuildingRecord, Campus } from "../../constants/buildings";
import type { MapScreenStyles } from "../../styles/mapScreen.styles";
import type { LatLng, RouteMode } from "../../types/map";
import type { MapRegion, PolygonFeature } from "../../utils/mapRegions";
import {
  NativeMapMarker,
  NativeMapPolygon,
  NativeMapPolyline,
  NativeMapView,
} from "../../utils/nativeMaps";
import { decodePolyline, type TransitItinerary } from "../../utils/transitousDirections";
import { getTransitColor, resolvePolygonCode } from "./mapScreen.helpers";

type CampusMarkerData = {
  campus: Campus;
  latitude: number;
  longitude: number;
};

type NativeCampusMapProps = Readonly<{
  mapRef: RefObject<any>;
  styles: MapScreenStyles;
  region: MapRegion;
  isDirectionsMode: boolean;
  routeMode: RouteMode;
  routeCoordinates: LatLng[];
  transitItineraries: TransitItinerary[];
  selectedItineraryIndex: number;
  shuttleWalkToCoords: LatLng[];
  shuttleDriveCoords: LatLng[];
  shuttleWalkFromCoords: LatLng[];
  allPolygons: { features: PolygonFeature[] };
  selectedBuilding: string | null;
  currentBuilding: string | null | undefined;
  visibleBuildingsWithPolygons: BuildingRecord[];
  showCampusSummaryMarkers: boolean;
  campusMarkerData: CampusMarkerData[];
  setSelectedBuilding: (code: string | null) => void;
  setMapViewportRegion: (region: MapRegion) => void;
}>;

export default function NativeCampusMap({
  mapRef,
  styles,
  region,
  isDirectionsMode,
  routeMode,
  routeCoordinates,
  transitItineraries,
  selectedItineraryIndex,
  shuttleWalkToCoords,
  shuttleDriveCoords,
  shuttleWalkFromCoords,
  allPolygons,
  selectedBuilding,
  currentBuilding,
  visibleBuildingsWithPolygons,
  showCampusSummaryMarkers,
  campusMarkerData,
  setSelectedBuilding,
  setMapViewportRegion,
}: NativeCampusMapProps) {
  const PolygonComponent = NativeMapPolygon as any;

  if (!NativeMapView || !NativeMapMarker || !NativeMapPolygon) {
    return (
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackText}>
          Map view is unavailable in this environment.
        </Text>
      </View>
    );
  }

  return (
    <NativeMapView
      ref={mapRef}
      testID="map-native"
      style={styles.map}
      initialRegion={region}
      onRegionChangeComplete={setMapViewportRegion}
      showsUserLocation
      showsMyLocationButton
      onPress={() => setSelectedBuilding(null)}
    >
      {NativeMapPolyline && isDirectionsMode && routeMode === "transit" &&
        transitItineraries[selectedItineraryIndex]?.legs.map((leg) => {
          if (!leg.legGeometry?.points) return null;

          const precision = (leg.legGeometry as any)?.precision ?? 7;
          const coordinates = decodePolyline(leg.legGeometry.points, precision);
          if (coordinates.length < 2) return null;

          const legKey = [
            leg.mode ?? "unknown",
            leg.route ?? "",
            leg.from?.name ?? "",
            leg.to?.name ?? "",
            leg.legGeometry.points ?? "",
          ].join("|");

          return (
            <NativeMapPolyline
              key={legKey}
              coordinates={coordinates}
              strokeColor={getTransitColor(leg.mode, leg.route)}
              strokeWidth={leg.mode === "WALK" ? 4 : 6}
              lineDashPattern={leg.mode === "WALK" ? [2, 8] : undefined}
              lineCap="round"
            />
          );
        })}

      {NativeMapPolyline && isDirectionsMode && routeMode === "shuttle" && (
        <>
          {shuttleWalkToCoords.length > 1 && (
            <NativeMapPolyline
              testID="route-polyline-shuttle-walk-to"
              coordinates={shuttleWalkToCoords}
              strokeColor="#2E7D32"
              strokeWidth={6}
              lineDashPattern={[2, 12]}
              lineCap="round"
            />
          )}
          {shuttleDriveCoords.length > 1 && (
            <NativeMapPolyline
              testID="route-polyline-shuttle-drive"
              coordinates={shuttleDriveCoords}
              strokeColor="#912338"
              strokeWidth={6}
              lineCap="round"
            />
          )}
          {shuttleWalkFromCoords.length > 1 && (
            <NativeMapPolyline
              testID="route-polyline-shuttle-walk-from"
              coordinates={shuttleWalkFromCoords}
              strokeColor="#2E7D32"
              strokeWidth={6}
              lineDashPattern={[2, 12]}
              lineCap="round"
            />
          )}
        </>
      )}

      {NativeMapPolyline &&
        isDirectionsMode &&
        routeMode !== "transit" &&
        routeMode !== "shuttle" &&
        routeCoordinates.length > 1 && (
          <NativeMapPolyline
            testID="route-polyline"
            coordinates={routeCoordinates}
            strokeColor="#1668C7"
            strokeWidth={routeMode === "walking" ? 6 : 5}
            lineDashPattern={routeMode === "walking" ? [1, 12] : undefined}
            lineCap="round"
          />
        )}

      {allPolygons.features.map((feature) => {
        const coordinates = (feature as any).geometry.coordinates[0].map(
          (coord: number[]) => ({
            latitude: coord[1],
            longitude: coord[0],
          }),
        );

        const buildingCode = feature.properties.code;
        const isSelected = selectedBuilding === buildingCode;
        const isCurrent = currentBuilding === buildingCode;

        let strokeColor = "#A32638";
        let fillColor = "#A32638";
        let strokeWidth = 2;
        let fillOpacity = 0.2;

        if (isSelected) {
          strokeColor = "#238c51";
          fillColor = "#238c51";
          strokeWidth = 3;
          fillOpacity = 0.5;
        } else if (isCurrent) {
          strokeColor = "#FFA500";
          fillColor = "#FFA500";
          strokeWidth = 3;
          fillOpacity = 0.5;
        }

        return (
          <PolygonComponent
            key={buildingCode}
            testID={`polygon-${buildingCode}`}
            coordinates={coordinates}
            strokeColor={strokeColor}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            fillOpacity={fillOpacity}
            tappable
            onPress={() =>
              setSelectedBuilding(
                selectedBuilding === buildingCode ? null : buildingCode,
              )
            }
          />
        );
      })}

      {visibleBuildingsWithPolygons.map((building) => {
        const polygonCode = resolvePolygonCode(building.code, allPolygons.features);

        return (
          <NativeMapMarker
            key={building.code}
            testID={`marker-${building.code}`}
            identifier={`marker-${building.code}`}
            accessible
            accessibilityLabel={`marker-${building.code}`}
            accessibilityRole="button"
            coordinate={{
              latitude: building.latitude,
              longitude: building.longitude,
            }}
            onPress={() =>
              setSelectedBuilding(
                selectedBuilding === polygonCode ? null : polygonCode,
              )
            }
          >
            <View
              style={styles.markerContainer}
              testID={`marker-view-${building.code}`}
              accessible
              accessibilityLabel={`marker-${building.code}`}
              accessibilityRole="button"
            >
              <View style={styles.markerBadge}>
                <Text style={styles.markerText}>{building.code}</Text>
              </View>
              <View style={styles.markerStem} />
            </View>
          </NativeMapMarker>
        );
      })}

      {showCampusSummaryMarkers &&
        campusMarkerData.map((campusMarker) => (
          <NativeMapMarker
            key={`campus-marker-${campusMarker.campus}`}
            testID={`campus-marker-${campusMarker.campus}`}
            identifier={`campus-marker-${campusMarker.campus}`}
            accessible={false}
            accessibilityLabel={`campus-marker-${campusMarker.campus}`}
            coordinate={{
              latitude: campusMarker.latitude,
              longitude: campusMarker.longitude,
            }}
          >
            <View style={styles.campusMarkerContainer}>
              <View style={styles.campusMarkerBadge}>
                <Text style={styles.campusMarkerText}>
                  {campusMarker.campus}
                </Text>
              </View>
            </View>
          </NativeMapMarker>
        ))}
    </NativeMapView>
  );
}
