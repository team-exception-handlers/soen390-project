import Constants from "expo-constants";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppHeader, { Campus } from "../../components/AppHeader";
import { BUILDINGS } from "../../constants/buildings";
import LOY_POLYGONS from "../../constants/maps/outdoor/LOY-polygons";
import SGW_POLYGONS from "../../constants/maps/outdoor/SGW-polygons";
import {
  findUserBuilding,
  hasLocationPermission,
  requestLocationPermission,
  startWatchingLocation
} from "../../utils/locationUtils";

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
  const [campus, setCampus] = useState<Campus>("SGW");
  const [searchText, setSearchText] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [currentBuilding, setCurrentBuilding] = useState<string | null | undefined>(undefined);
  const locationSubscription = useRef<any>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

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

  // Start tracking user location
  useEffect(() => {
    async function setupLocation() {
      const permission = await hasLocationPermission();

      if (!permission) {
        const granted = await requestLocationPermission();
        if (!granted) {
          setLocationPermissionDenied(true);
          return;
        }
      }

      const subscription = await startWatchingLocation((location: Location.LocationObject) => {
        {/*setUserLocation(location);
        setLocationPermissionDenied(false);
        const { latitude, longitude } = location.coords;
        */}
         const latitude = 45.497092;
        const longitude = -73.5788;

  
        const fakeLocation = {
          ...location,
          coords: {
            ...location.coords,
            latitude,
            longitude,
          }
        };

        setUserLocation(fakeLocation);
        setLocationPermissionDenied(false);
        const polygons = campus === "SGW" ? SGW_POLYGONS : LOY_POLYGONS;
        const building = findUserBuilding(latitude, longitude, polygons as any);

        if (building !== currentBuilding) {
          setCurrentBuilding(building);
          console.log("Current building:", building || "Outside");
        }

        console.log("User location:", latitude, longitude);
      });

      if (subscription) {
        locationSubscription.current = subscription;
      }
    }

    setupLocation();

    return () => {
      if (locationSubscription.current) {
        try {
          if (typeof locationSubscription.current.remove === 'function') {
            locationSubscription.current.remove();
          }
        } catch (error) {
        }
        locationSubscription.current = null;
      }
    };
  }, [campus]);

  // Get polygon data based on campus
  const campusPolygons = campus === "SGW" ? SGW_POLYGONS : LOY_POLYGONS;

  const campusBuildings = BUILDINGS.filter(
    (building) => building.campus === campus,
  );
  const region = getCampusRegion(campus);

  useEffect(() => {
    if (webViewRef.current && Platform.OS !== "web" && userLocation) {
      const { latitude, longitude } = userLocation.coords;

      const script = `
      (function() {
        try {
          if (typeof L !== 'undefined' && window.map) {
            if (window.userMarker) {
              // Just update position
              window.userMarker.setLatLng([${latitude}, ${longitude}]);
              window.map.panTo([${latitude}, ${longitude}], { animate: true, duration: 0.5 });
              console.log('User marker updated to:', ${latitude}, ${longitude});
            } else {
              // Create marker if it doesn't exist
              const userIcon = L.divIcon({
                className: 'user-marker',
                html: '<div style="width: 14px; height: 14px; background: #007AFF; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });
              window.userMarker = L.marker([${latitude}, ${longitude}], { icon: userIcon }).addTo(window.map);
              console.log('User marker created at:', ${latitude}, ${longitude});
            }
          }
        } catch (e) {
          console.log('User marker error:', e);
        }
      })();
      true;
    `;
      webViewRef.current?.injectJavaScript(script);
    }
  }, [userLocation]);

  // Generate HTML for web map
  const mapHTML = useMemo(() => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    const buildingData = campusBuildings.map(
      ({ latitude: lat, longitude: lng, code, shortName }) => ({
        latitude: lat,
        longitude: lng,
        code,
        shortName,
      }),
    );

    const minLat = latitude - latitudeDelta / 2;
    const maxLat = latitude + latitudeDelta / 2;
    const minLng = longitude - longitudeDelta / 2;
    const maxLng = longitude + longitudeDelta / 2;

    // ADD THESE LINES:
    const userLat = userLocation?.coords.latitude || null;
    const userLng = userLocation?.coords.longitude || null;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
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
        .user-marker {
            background: transparent;
            border: none;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        const map = L.map('map').setView([${latitude}, ${longitude}], 15);
        window.map = map; 
        const buildings = ${JSON.stringify(buildingData)};
        const polygonData = ${JSON.stringify(campusPolygons)};
        const currentBuilding = ${JSON.stringify(currentBuilding)};
        let selectedPolygon = null;
        window.polygonMap = {};
        window.currentBuildingPolygon = null;
        window.userMarker = null;  

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        const bounds = [[${minLat}, ${minLng}], [${maxLat}, ${maxLng}]];
        map.fitBounds(bounds, { padding: [20, 20] });

        // Render building polygons
        polygonData.features.forEach((feature) => {
            const coordinates = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            const buildingCode = feature.properties.code;

            const polygon = L.polygon(coordinates, {
                color: '#A32638',
                fillColor: '#A32638',
                fillOpacity: 0.2,
                weight: 2
            }).addTo(map);

            window.polygonMap[buildingCode] = polygon;

            polygon.on('click', function(e) {
                if (selectedPolygon) {
                    selectedPolygon.setStyle({
                        color: '#A32638',
                        fillColor: '#A32638',
                        fillOpacity: 0.2,
                        weight: 2
                    });
                }

                this.setStyle({
                    color: '#238c51',
                    fillColor: '#238c51',
                    fillOpacity: 0.5,
                    weight: 3
                });
                selectedPolygon = this;

                L.DomEvent.stopPropagation(e);
            });

            polygon.on('mouseover', function() {
                if (this !== selectedPolygon) {
                    this.setStyle({ fillOpacity: 0.3 });
                }
            });

            polygon.on('mouseout', function() {
                if (this !== selectedPolygon) {
                    this.setStyle({ fillOpacity: 0.2 });
                }
            });
        });

        // Highlight current building if available
        if (currentBuilding && window.polygonMap[currentBuilding]) {
            window.currentBuildingPolygon = window.polygonMap[currentBuilding];
            window.currentBuildingPolygon.setStyle({
                color: '#FFA500',
                fillColor: '#FFA500',
                fillOpacity: 0.5,
                weight: 3
            });
        }

        map.on('click', function() {
            if (selectedPolygon) {
                selectedPolygon.setStyle({
                    color: '#A32638',
                    fillColor: '#A32638',
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

            marker.on('click', function(e) {
                let polygon = window.polygonMap[building.code];
                if (!polygon && building.code.length > 2) {
                    const baseCode = building.code.slice(0, -1);
                    polygon = window.polygonMap[baseCode];
                }

                if (polygon) {
                    if (selectedPolygon) {
                        selectedPolygon.setStyle({
                            color: '#A32638',
                            fillColor: '#A32638',
                            fillOpacity: 0.2,
                            weight: 2
                        });
                    }

                    if (selectedPolygon === polygon) {
                        selectedPolygon = null;
                    } else {
                        polygon.setStyle({
                            color: '#238c51',
                            fillColor: '#238c51',
                            fillOpacity: 0.5,
                            weight: 3
                        });
                        selectedPolygon = polygon;
                    }
                }
                L.DomEvent.stopPropagation(e);
            });
        });

        // ADD USER MARKER HERE (right before closing script tag):
        ${userLat && userLng ? `
        console.log('Adding user marker at:', ${userLat}, ${userLng});
        const userIcon = L.divIcon({
            className: 'user-marker',
            html: '<div style="width: 14px; height: 14px; background: #007AFF; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        window.userMarker = L.marker([${userLat}, ${userLng}], { icon: userIcon }).addTo(map);
        ` : 'console.log("No user location available");'}
    </script>
</body>
</html>
  `;
  }, [campus, currentBuilding]);


  return (
  
      <View style={styles.container}>
         {/*
      {currentBuilding && (() => {
        const building = BUILDINGS.find(b => b.code === currentBuilding);
        return building ? (
          <View style={styles.buildingInfo}>
            <Text style={styles.buildingInfoText}>
              {building.longName} ({building.shortName}) - [{building.code}]
            </Text>
          </View>
        ) : null;
      })()}
      */}    
  {currentBuilding && (() => {
    const building = BUILDINGS.find(b => b.code === currentBuilding);
    return building ? (
      <View style={styles.buildingInfo}>
        <Text style={styles.buildingInfoTitle}>
          Current Building:
        </Text>
        <Text style={styles.buildingInfoText}>
          {building.longName} ({building.shortName}) - [{building.code}]
        </Text>
      </View>
    ) : null;
  })()}

      <AppHeader
        campus={campus}
        onCampusChange={setCampus}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />

      {locationPermissionDenied && (
        <TouchableOpacity
          style={styles.permissionBanner}
          onPress={async () => {
            setLocationPermissionDenied(false);
            const granted = await requestLocationPermission();
            if (granted) {
              setLocationPermissionDenied(false);
              // Restart location tracking
              const subscription = await startWatchingLocation((location: Location.LocationObject) => {
                setUserLocation(location);
                console.log("User location:", location.coords.latitude, location.coords.longitude);
              });
              locationSubscription.current = subscription;
            }
            else {
              setLocationPermissionDenied(true);
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.permissionText}>
            Enable location permissions to see where you are on campus. Tap here.
          </Text>
        </TouchableOpacity>
      )}

      {Platform.OS === "web" || !MapViewComponent ? (
        Platform.OS === "web" ? (
          <iframe
            key={campus}
            src={`data:text/html;charset=utf-8,${encodeURIComponent(mapHTML)}`}
            style={styles.map}
            frameBorder="0"
            allowFullScreen
          />
        ) : WebView ? (
          <WebView
            key={campus}
            ref={webViewRef}
            source={{ html: mapHTML }}
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
          showsUserLocation={true}
          showsMyLocationButton={true}
          onPress={() => {
            setSelectedBuilding(null);
          }}
        >
          {campusPolygons.features.map((feature: any) => {
            const coordinates = feature.geometry.coordinates[0].map(
              (coord: number[]) => ({
                latitude: coord[1],
                longitude: coord[0],
              }),
            );
            const buildingCode = feature.properties.code;
            const isSelected = selectedBuilding === buildingCode || currentBuilding === buildingCode;

            return (
              <MapPolygonComponent
                key={buildingCode}
                coordinates={coordinates}
                strokeColor={isSelected ? "#238c51" : "#A32638"}
                fillColor={isSelected ? "#238c51" : "#A32638"}
                strokeWidth={isSelected ? 3 : 2}
                fillOpacity={isSelected ? 0.5 : 0.2}
                tappable={true}
                onPress={() => {
                  setSelectedBuilding(
                    selectedBuilding === buildingCode ? null : buildingCode,
                  );
                }}
              />
            );
          })}

          {campusBuildings.map((building) => {
            const hasExactPolygon = campusPolygons.features.some(
              (f: any) => f.properties.code === building.code,
            );
            const polygonCode = hasExactPolygon
              ? building.code
              : campusPolygons.features.find(
                (f: any) =>
                  building.code.startsWith(f.properties.code) &&
                  f.properties.code.length >= 2,
              )?.properties.code || building.code;

            return (
              <MapMarkerComponent
                key={building.code}
                coordinate={{
                  latitude: building.latitude,
                  longitude: building.longitude,
                }}
                onPress={() => {
                  setSelectedBuilding(
                    selectedBuilding === polygonCode ? null : polygonCode,
                  );
                }}
              >
                <View style={styles.markerContainer}>
                  <View style={styles.markerBadge}>
                    <Text style={styles.markerText}>{building.code}</Text>
                  </View>
                  <View style={styles.markerStem} />
                </View>
              </MapMarkerComponent>
            );
          })}
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

  permissionBanner: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#ff3700",
    opacity: 0.9,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    zIndex: 1000,
    maxWidth: "90%",
  },

  permissionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },

  buildingInfo: {
    position: "absolute",
    top: 78.5,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    zIndex: 1000,
  },

  buildingInfoText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  buildingInfoTitle: {
  color: "white",
  fontSize: 14,
  fontWeight: "600",
  marginBottom: 4,
  textAlign: "center",
  opacity: 0.9,
},

});