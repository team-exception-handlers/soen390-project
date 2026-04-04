import type { Campus } from "../../constants/buildings";
import type { LatLng, MapBounds, RouteMode } from "../../types/map";
import type { MapRegion } from "../../utils/mapRegions";

type MarkerBuilding = {
  latitude: number;
  longitude: number;
  code: string;
  shortName: string;
  campus: Campus;
};

type CampusMarker = {
  campus: Campus;
  latitude: number;
  longitude: number;
};

type WebTransitSegment = {
  mode: string;
  route: string;
  color: string;
  coords: [number, number][];
};

type BuildWebMapHtmlArgs = {
  defaultRegion: MapRegion;
  buildingsWithPolygons: MarkerBuilding[];
  campusMarkerData: CampusMarker[];
  allPolygons: unknown;
  currentBuilding: string | null;
  routeMode: RouteMode;
  routeCoordinates: LatLng[];
  shuttleWalkToCoords: LatLng[];
  shuttleDriveCoords: LatLng[];
  shuttleWalkFromCoords: LatLng[];
  transitSegments: WebTransitSegment[];
  serializedWebFrameTargetOrigin: string;
  userLat: number | null;
  userLng: number | null;
  focusBounds: MapBounds;
};

export function buildWebMapHtml({
  defaultRegion,
  buildingsWithPolygons,
  campusMarkerData,
  allPolygons,
  currentBuilding,
  routeMode,
  routeCoordinates,
  shuttleWalkToCoords,
  shuttleDriveCoords,
  shuttleWalkFromCoords,
  transitSegments,
  serializedWebFrameTargetOrigin,
  userLat,
  userLng,
  focusBounds,
}: BuildWebMapHtmlArgs) {
  const { latitude, longitude } = defaultRegion;

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
            body { margin: 0; padding: 0; }
            #map { width: 100%; height: 100vh; }
            .building-marker { background: transparent; border: none; }
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
            .user-marker { background: transparent; border: none; }
            .campus-marker { background: transparent; border: none; }
            .campus-badge {
                min-width: 38px;
                height: 38px;
                padding: 0 10px;
                background: #A32638;
                color: #ffffff;
                border: 2px solid #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.2px;
                border-radius: 19px;
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
            const map = L.map('map', { maxZoom: 22 }).setView([${latitude}, ${longitude}], 20);
            window.map = map;
            const parentMessageTargetOrigin = ${serializedWebFrameTargetOrigin};
            const notifyHost = (payload) => {
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
                    return;
                }

                window.parent.postMessage(payload, parentMessageTargetOrigin);
            };

            const buildings = ${JSON.stringify(buildingsWithPolygons)};
            const campusMarkers = ${JSON.stringify(campusMarkerData)};
            const polygonData = ${JSON.stringify(allPolygons)};
            const currentBuilding = ${JSON.stringify(currentBuilding)};
            const routeMode = ${JSON.stringify(routeMode)};
            const routeCoordinates = ${JSON.stringify(
              routeCoordinates.map((point) => [point.latitude, point.longitude]),
            )};
            const shuttleWalkToCoords = ${JSON.stringify(
              shuttleWalkToCoords.map((point) => [point.latitude, point.longitude]),
            )};
            const shuttleDriveCoords = ${JSON.stringify(
              shuttleDriveCoords.map((point) => [point.latitude, point.longitude]),
            )};
            const shuttleWalkFromCoords = ${JSON.stringify(
              shuttleWalkFromCoords.map((point) => [point.latitude, point.longitude]),
            )};
            const transitSegments = ${JSON.stringify(transitSegments)};
            const initialFocusBounds = ${JSON.stringify(focusBounds)};

            let selectedPolygon = null;
            let markerRecords = [];
            window.polygonMap = {};
            window.currentBuildingPolygon = null;
            window.currentBuildingCode = null;
            window.selectedBuildingCode = null;
            window.selectedPolygon = null;
            window.userMarker = null;
            window.followUser = false;
            window.hasCenteredOnUser = false;
            window.selectedCampus = "SGW";
            window.defaultCampusZoom = null;

            L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 22,
                maxNativeZoom: 19
            }).addTo(map);

            const defaultPolygonStyle = { color: '#A32638', fillColor: '#A32638', fillOpacity: 0.2, weight: 2 };
            const currentPolygonStyle = { color: '#FFA500', fillColor: '#FFA500', fillOpacity: 0.5, weight: 3 };
            const selectedPolygonStyle = { color: '#238c51', fillColor: '#238c51', fillOpacity: 0.5, weight: 3 };

            const resetPolygonStyle = (polygon) => {
                if (!polygon) return;
                const code = polygon.__buildingCode || null;
                if (code && window.currentBuildingCode === code) polygon.setStyle(currentPolygonStyle);
                else polygon.setStyle(defaultPolygonStyle);
            };

            const getPinVisibilityMode = () => {
                const defaultCampusZoom =
                  typeof window.defaultCampusZoom === 'number'
                    ? window.defaultCampusZoom
                    : map.getZoom();
                const zoomOutDelta = defaultCampusZoom - map.getZoom();
                if (zoomOutDelta > 0.45) return 'campus-summary';
                return 'all';
            };
            const shouldShowMarker = (record, visibilityMode) => {
                if (record.type === 'campus') return visibilityMode === 'campus-summary';
                return visibilityMode === 'all';
            };
            const updateMarkerVisibility = () => {
                const visibilityMode = getPinVisibilityMode();
                markerRecords.forEach((record) => {
                    const shouldShow = shouldShowMarker(record, visibilityMode);
                    const marker = record.marker;
                    const isVisible = map.hasLayer(marker);
                    if (shouldShow && !isVisible) marker.addTo(map);
                    if (!shouldShow && isVisible) map.removeLayer(marker);
                });
            };
            window.updateMarkerVisibility = updateMarkerVisibility;
            window.setMapBounds = (nextBounds, padding = [20, 20], nextCampus = window.selectedCampus) => {
                if (!Array.isArray(nextBounds) || nextBounds.length !== 2) return;
                if (nextCampus) window.selectedCampus = nextCampus;
                window.defaultCampusZoom = map.getBoundsZoom(
                  nextBounds,
                  false,
                  L.point(padding[0], padding[1])
                );
                map.fitBounds(nextBounds, { padding });
                updateMarkerVisibility();
            };

            let routeLayers = [];
            let hasAnyRoute = false;

            if (routeMode === "transit" && Array.isArray(transitSegments) && transitSegments.length) {
              transitSegments.forEach((seg) => {
                if (!seg.coords || seg.coords.length < 2) return;

                const poly = L.polyline(seg.coords, {
                  color: seg.color,
                  weight: 6,
                  opacity: 0.9,
                  lineCap: "round",
                  lineJoin: "round",
                  dashArray: seg.mode === "WALK" ? "2 12" : undefined
                }).addTo(map);

                routeLayers.push(poly);
              });

              if (routeLayers.length) {
                hasAnyRoute = true;
                const group = L.featureGroup(routeLayers);
                map.fitBounds(group.getBounds(), { padding: [50, 50] });
              }
            }

            if (!hasAnyRoute && routeMode === 'shuttle' && shuttleDriveCoords.length > 1) {
                const walkingStyle = {
                    color: '#2E7D32',
                    weight: 6,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: '2 12'
                };
                const drivingStyle = {
                    color: '#912338',
                    weight: 6,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round'
                };

                if (shuttleWalkToCoords.length > 1) {
                    routeLayers.push(L.polyline(shuttleWalkToCoords, walkingStyle).addTo(map));
                }
                routeLayers.push(L.polyline(shuttleDriveCoords, drivingStyle).addTo(map));
                if (shuttleWalkFromCoords.length > 1) {
                    routeLayers.push(L.polyline(shuttleWalkFromCoords, walkingStyle).addTo(map));
                }

                const group = L.featureGroup(routeLayers);
                map.fitBounds(group.getBounds(), { padding: [50, 50] });
                hasAnyRoute = true;
            }

            if (!hasAnyRoute && routeCoordinates.length > 1) {
                const routeStyle = {
                    color: '#1668C7',
                    weight: routeMode === 'walking' ? 7 : 6,
                    opacity: 0.88,
                    lineCap: 'round',
                    lineJoin: 'round'
                };

                if (routeMode === 'walking') {
                    routeStyle.dashArray = '1 12';
                }

                const routePolyline = L.polyline(routeCoordinates, routeStyle).addTo(map);
                routeLayers.push(routePolyline);

                L.circleMarker(routeCoordinates[0], {
                    radius: 6,
                    color: '#14532D',
                    fillColor: '#22C55E',
                    fillOpacity: 1,
                    weight: 2
                }).addTo(map);

                L.circleMarker(routeCoordinates[routeCoordinates.length - 1], {
                    radius: 6,
                    color: '#7F1D1D',
                    fillColor: '#EF4444',
                    fillOpacity: 1,
                    weight: 2
                }).addTo(map);

                map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
                hasAnyRoute = true;
            }

            if (!hasAnyRoute) {
                window.setMapBounds(initialFocusBounds, [20, 20], window.selectedCampus);
            }

            window.addEventListener('message', function(event) {
                if (event.origin !== parentMessageTargetOrigin) return;

                const data = event.data;
                if (data?.type === 'focusBounds') {
                    window.setMapBounds(data.bounds, data.padding, data.campus);
                }
            });

            const disableFollow = () => { window.followUser = false; };
            map.on('dragstart', disableFollow);
            map.on('zoomstart', disableFollow);
            map.on('movestart', disableFollow);
            map.on('zoomend', updateMarkerVisibility);
            map.on('moveend', updateMarkerVisibility);

            polygonData.features.forEach((feature) => {
                const coordinates = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                const buildingCode = feature.properties.code;

                const polygon = L.polygon(coordinates, defaultPolygonStyle).addTo(map);

                window.polygonMap[buildingCode] = polygon;
                polygon.__buildingCode = buildingCode;

                polygon.on('click', function(e) {
                    if (selectedPolygon) resetPolygonStyle(selectedPolygon);
                    this.setStyle(selectedPolygonStyle);
                    selectedPolygon = this;
                    window.selectedBuildingCode = buildingCode;
                    window.selectedPolygon = selectedPolygon;
                    notifyHost({ type: 'buildingSelected', buildingCode: buildingCode });
                    L.DomEvent.stopPropagation(e);
                });

                polygon.on('mouseover', function() {
                    if (this !== selectedPolygon) this.setStyle({ fillOpacity: 0.3 });
                });

                polygon.on('mouseout', function() {
                    if (this !== selectedPolygon) this.setStyle({ fillOpacity: 0.2 });
                });
            });

            if (currentBuilding && window.polygonMap[currentBuilding]) {
                window.currentBuildingPolygon = window.polygonMap[currentBuilding];
                window.currentBuildingCode = currentBuilding;
                window.currentBuildingPolygon.setStyle(currentPolygonStyle);
            }

            map.on('click', function() {
                if (selectedPolygon) {
                    resetPolygonStyle(selectedPolygon);
                    selectedPolygon = null;
                    window.selectedBuildingCode = null;
                    window.selectedPolygon = null;
                    notifyHost({ type: 'buildingDeselected' });
                }
            });

            const createBuildingIcon = (code) => L.divIcon({
                className: 'building-marker',
                html: '<div class="marker-badge">' + code + '</div><div class="marker-stem"></div>',
                iconSize: [40, 44],
                iconAnchor: [20, 44],
                popupAnchor: [0, -40]
            });
            const createCampusIcon = (campusCode) => {
                return L.divIcon({
                    className: 'campus-marker',
                    html: '<div class="campus-badge">' + campusCode + '</div>',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                    popupAnchor: [0, -20]
                });
            };

            buildings.forEach((building) => {
                const marker = L.marker([building.latitude, building.longitude], { icon: createBuildingIcon(building.code) });

                marker.on('click', function(e) {
                    let polygon = window.polygonMap[building.code];
                    if (!polygon && building.code.length > 2) {
                        const baseCode = building.code.slice(0, -1);
                        polygon = window.polygonMap[baseCode];
                    }

                    if (polygon) {
                        if (selectedPolygon) resetPolygonStyle(selectedPolygon);

                        if (selectedPolygon === polygon) {
                            resetPolygonStyle(selectedPolygon);
                            selectedPolygon = null;
                        } else {
                            polygon.setStyle(selectedPolygonStyle);
                            selectedPolygon = polygon;
                        }
                    }

                    if (selectedPolygon) {
                      window.selectedBuildingCode = building.code;
                      window.selectedPolygon = selectedPolygon;
                      notifyHost({ type: 'buildingSelected', buildingCode: building.code });
                    } else {
                      window.selectedBuildingCode = null;
                      window.selectedPolygon = null;
                      notifyHost({ type: 'buildingDeselected' });
                    }

                    L.DomEvent.stopPropagation(e);
                });

                markerRecords.push({ type: 'building', building, marker });
            });

            campusMarkers.forEach((campusMarker) => {
                const marker = L.marker(
                  [campusMarker.latitude, campusMarker.longitude],
                  { icon: createCampusIcon(campusMarker.campus) }
                );

                markerRecords.push({ type: 'campus', campus: campusMarker.campus, marker });
            });

            updateMarkerVisibility();

            ${
              userLat && userLng
                ? `
            const userIcon = L.divIcon({
                className: 'user-marker',
                html: '<div style="width: 14px; height: 14px; background: #007AFF; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            window.userMarker = L.marker([${userLat}, ${userLng}], { icon: userIcon }).addTo(map);
            `
                : ""
            }
        </script>
    </body>
    </html>
  `;
}
