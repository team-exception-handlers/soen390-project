import Constants from "expo-constants";
import { useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import AppHeader, { Campus } from "../../components/AppHeader";
import { BUILDINGS, type BuildingRecord } from "../../constants/buildings";
import LOY_POLYGONS from "../../constants/maps/outdoor/LOY-polygons";
import SGW_POLYGONS from "../../constants/maps/outdoor/SGW-polygons";
import { getCampusRegion } from "../../utils/mapRegions";

let WebView: React.ComponentType<any> | null = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    WebView = require("react-native-webview").WebView;
  } catch {
    WebView = null;
  }
}

export default function MapScreen() {
  {
    /* these make it so we can view selected campus and building from the map level */
  }
  const [campus, setCampus] = useState<Campus>("SGW");
  const [searchText, setSearchText] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);
  const markerRefs = useRef<{ [key: string]: any }>({});

  const isExpoGo = Constants.appOwnership === "expo";

  let MapViewComponent: React.ComponentType<any> | null = null;
  let MapMarkerComponent: React.ComponentType<any> | null = null;
  let MapCalloutComponent: React.ComponentType<any> | null = null;
  let MapPolygonComponent: React.ComponentType<any> | null = null;
  if (Platform.OS !== "web" && !isExpoGo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const maps = require("react-native-maps");
      MapViewComponent = maps.default;
      MapMarkerComponent = maps.Marker;
      MapCalloutComponent = maps.Callout;
      MapPolygonComponent = maps.Polygon;
    } catch {
      MapViewComponent = null;
      MapMarkerComponent = null;
      MapCalloutComponent = null;
      MapPolygonComponent = null;
    }
  }

  // Get polygon data based on campus
  const campusPolygons = campus === "SGW" ? SGW_POLYGONS : LOY_POLYGONS;

  // Generate HTML for web map also here
  const getMapHTML = (
    region: ReturnType<typeof getCampusRegion>,
    buildings: BuildingRecord[],
  ) => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    const buildingData = buildings.map(
      ({ latitude: lat, longitude: lng, code, shortName }) => ({
        latitude: lat,
        longitude: lng,
        code,
        shortName,
      }),
    );

    // Calculate bounds for better viw of the map
    const minLat = latitude - latitudeDelta / 2;
    const maxLat = latitude + latitudeDelta / 2;
    const minLng = longitude - longitudeDelta / 2;
    const maxLng = longitude + longitudeDelta / 2;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
        .building-label {
            background: white;
            border: 1px solid rgba(0, 0, 0, 0.25);
            border-radius: 12px;
            padding: 2px 6px;
            color: #1C1C1E;
            font-size: 12px;
            font-weight: 600;
        }
        .building-popup {
            font-size: 13px;
            color: #1C1C1E;
            font-weight: 600;
        }
        .building-marker {
            background: transparent;
            border: none;
        }
        .marker-badge {
            min-width: 30px;
            height: 28px;
            padding: 0 8px;
            border-radius: 14px;
            background: #A32638;
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .marker-stem {
            width: 0;
            height: 0;
            margin: -2px auto 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid #A32638;
            filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.12));
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        const map = L.map('map').setView([${latitude}, ${longitude}], 15);
        const buildings = ${JSON.stringify(buildingData)};
        const polygonData = ${JSON.stringify(campusPolygons)};
        let selectedPolygon = null;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // Set view to show the campus region
        const bounds = [[${minLat}, ${minLng}], [${maxLat}, ${maxLng}]];
        map.fitBounds(bounds, { padding: [20, 20] });

        // Render building polygons
        polygonData.features.forEach((feature) => {
            const coordinates = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            const buildingCode = feature.properties.code;
            const buildingInfo = buildings.find(b => b.code === buildingCode);

            const polygon = L.polygon(coordinates, {
                color: '#A32638',
                fillColor: '#A32638',
                fillOpacity: 0.2,
                weight: 2,
                className: 'building-polygon'
            }).addTo(map);

            polygon.on('click', function(e) {
                if (selectedPolygon) {
                    selectedPolygon.setStyle({
                        fillOpacity: 0.2,
                        weight: 2
                    });
                }

                // Highlight selected polygon
                this.setStyle({
                    fillOpacity: 0.5,
                    weight: 3
                });
                selectedPolygon = this;

                L.DomEvent.stopPropagation(e);
            });

            // Add hover effect
            polygon.on('mouseover', function() {
                if (this !== selectedPolygon) {
                    this.setStyle({
                        fillOpacity: 0.3
                    });
                }
            });

            polygon.on('mouseout', function() {
                if (this !== selectedPolygon) {
                    this.setStyle({
                        fillOpacity: 0.2
                    });
                }
            });

            // Bind popup with building name
            if (buildingInfo) {
                polygon.bindPopup(
                    '<div class="building-popup">' +
                    buildingInfo.shortName +
                    '</div>'
                );
            }
        });

        // Reset selection on map click
        map.on('click', function() {
            if (selectedPolygon) {
                selectedPolygon.setStyle({
                    fillOpacity: 0.2,
                    weight: 2
                });
                selectedPolygon = null;
            }
        });

        const createBuildingIcon = (code) => L.divIcon({
            className: 'building-marker',
            html: '<div class="marker-badge">' + code + '</div><div class="marker-stem"></div>',
            iconSize: [40, 44],
            iconAnchor: [20, 44],
            popupAnchor: [0, -40]
        });

        buildings.forEach((building) => {
            const marker = L.marker([building.latitude, building.longitude], {
                icon: createBuildingIcon(building.code)
            }).addTo(map);
            marker.bindPopup(
                '<div class="building-popup">' +
                building.shortName +
                '</div>'
            );
        });
    </script>
</body>
</html>
    `;
  };

  const getMapDataURL = (
    region: ReturnType<typeof getCampusRegion>,
    buildings: BuildingRecord[],
  ) => {
    const html = getMapHTML(region, buildings);
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  };

  const campusBuildings = BUILDINGS.filter(
    (building) => building.campus === campus,
  );
  const region = getCampusRegion(campus);

  return (
    <View style={styles.container}>
      <AppHeader
        campus={campus}
        onCampusChange={setCampus}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />
      {Platform.OS === "web" || !MapViewComponent ? (
        Platform.OS === "web" ? (
          <iframe
            key={campus}
            src={getMapDataURL(region, campusBuildings)}
            style={styles.map}
            frameBorder="0"
            allowFullScreen
          />
        ) : WebView ? (
          <WebView
            key={campus}
            ref={webViewRef}
            source={{ html: getMapHTML(region, campusBuildings) }}
            style={styles.map}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
          />
        ) : null
      ) : MapMarkerComponent && MapCalloutComponent && MapPolygonComponent ? (
        <MapViewComponent
          key={campus}
          style={styles.map}
          initialRegion={region}
        >
          {campusPolygons.features.map((feature: any) => {
            const coordinates = feature.geometry.coordinates[0].map(
              (coord: number[]) => ({
                latitude: coord[1],
                longitude: coord[0],
              }),
            );
            const buildingCode = feature.properties.code;
            const isSelected = selectedBuilding === buildingCode;

            return (
              <MapPolygonComponent
                key={buildingCode}
                coordinates={coordinates}
                strokeColor="#A32638"
                fillColor="#A32638"
                strokeWidth={isSelected ? 3 : 2}
                fillOpacity={isSelected ? 0.5 : 0.2}
                tappable={true}
                onPress={() => {
                  setSelectedBuilding(
                    selectedBuilding === buildingCode ? null : buildingCode,
                  );
                  // Show marker callout for this building
                  if (markerRefs.current[buildingCode]) {
                    markerRefs.current[buildingCode].showCallout();
                  }
                }}
              />
            );
          })}

          {campusBuildings.map((building) => (
            <MapMarkerComponent
              key={building.code}
              ref={(ref: any) => {
                if (ref) {
                  markerRefs.current[building.code] = ref;
                }
              }}
              coordinate={{
                latitude: building.latitude,
                longitude: building.longitude,
              }}
            >
              <View style={styles.markerContainer}>
                <View style={styles.markerBadge}>
                  <Text style={styles.markerText}>{building.code}</Text>
                </View>
                <View style={styles.markerStem} />
              </View>
              <MapCalloutComponent>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{building.shortName}</Text>
                </View>
              </MapCalloutComponent>
            </MapMarkerComponent>
          ))}
        </MapViewComponent>
      ) : (
        <View style={styles.webFallback}>
          <Text style={styles.webFallbackText}>
            Map view is unavailable in this environment.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
  },
  markerBadge: {
    minWidth: 30,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "#A32638",
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "white",
  },
  markerStem: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#A32638",
  },
  callout: {
    minWidth: 140,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  webFallbackText: {
    color: "#2C2C2C",
    fontSize: 16,
    textAlign: "center",
  },
});
