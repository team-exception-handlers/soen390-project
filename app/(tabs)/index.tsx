import Constants from "expo-constants";
import { useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import AppHeader, { Campus } from "../../components/AppHeader";
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
  const webViewRef = useRef<any>(null);

  const isExpoGo = Constants.appOwnership === "expo";

  let MapViewComponent: React.ComponentType<any> | null = null;
  if (Platform.OS !== "web" && !isExpoGo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      MapViewComponent = require("react-native-maps").default;
    } catch {
      MapViewComponent = null;
    }
  }

  // Generate HTML for web map also here
  const getMapHTML = (region: ReturnType<typeof getCampusRegion>) => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

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
    </style>
</head>
<body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        const map = L.map('map').setView([${latitude}, ${longitude}], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
        
        // Set view to show the campus region
        const bounds = [[${minLat}, ${minLng}], [${maxLat}, ${maxLng}]];
        map.fitBounds(bounds, { padding: [20, 20] });
        
        // Add a marker for the campus center
        L.marker([${latitude}, ${longitude}])
            .addTo(map);
    </script>
</body>
</html>
    `;
  };

  const getMapDataURL = (region: ReturnType<typeof getCampusRegion>) => {
    const html = getMapHTML(region);
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  };

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
            src={getMapDataURL(region)}
            style={styles.map}
            frameBorder="0"
            allowFullScreen
          />
        ) : WebView ? (
          <WebView
            key={campus}
            ref={webViewRef}
            source={{ html: getMapHTML(region) }}
            style={styles.map}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
          />
        ) : null
      ) : (
        <MapViewComponent
          style={styles.map}
          initialRegion={region}
        />
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
