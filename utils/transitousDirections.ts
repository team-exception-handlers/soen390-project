/**
 * Fetches public transit routes using the Transitous MOTIS 2 API.
 * Endpoint: https://api.transitous.org/api/v1/plan
 */
import type { LatLng } from "../types/map";

const MOTIS_BASE_URL = "https://api.transitous.org/api/v1/plan";

const USER_AGENT =
    "concordia-class-finder/1.0.0 (https://github.com/soen390)";

export type TransitLeg = {
    mode: string;
    from: { name: string; lat: number; lon: number };
    to: { name: string; lat: number; lon: number };
    startTime: string;
    endTime: string;
    distance: number;
    duration: number;
    route?: string;
    headsign?: string;
    legGeometry: { points: string } | null;
    intermediateStops?: { name: string; arrival: string }[];
};

export type TransitItinerary = {
    durationSeconds: number;
    distanceMeters: number;
    transfers: number;
    departureTime: string;
    arrivalTime: string;
    legs: TransitLeg[];
    instructions: { text: string; distanceMeters: number }[];
    coordinates: LatLng[];
};


export function decodePolyline(
    encoded: string,
    precision = 7,
): LatLng[] {
    if (typeof encoded !== "string" || encoded.length === 0) {
        return [];
    }
    const coords: LatLng[] = [];
    const factor = Math.pow(10, precision);
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let b: number;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;

        coords.push({ latitude: lat / factor, longitude: lng / factor });
    }

    return coords;
}


export function formatTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleTimeString("en-CA", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function formatRouteAndHeadsign(leg: TransitLeg): string {
    const route = leg.route ? `${leg.route}` : "";
    const headsign = leg.headsign ? ` towards ${leg.headsign}` : "";
    return `${route}${headsign}`;
}

function formatTransitTake(modeLabel: string, leg: TransitLeg): string {
    return `Take ${modeLabel}${formatRouteAndHeadsign(leg)} to ${leg.to.name}.`
}
function formatLegInstruction(leg: TransitLeg): string {
    const dist =
        leg.distance >= 1000
            ? `${(leg.distance / 1000).toFixed(1)} km`
            : `${Math.round(leg.distance)} m`;
    const dur = formatDuration(leg.duration);

    switch (leg.mode) {
        case "WALK":
            return `Walk ${dur} (${dist}) to ${leg.to.name}.`;
        case "BUS":
            return formatTransitTake("Bus",leg);
        case "SUBWAY":
            return formatTransitTake("Metro", leg);
        case "TRAM":
            return formatTransitTake("Tram", leg);
        case "RAIL":
            return formatTransitTake("Train", leg);
        default:
            return `Take ${leg.mode} to ${leg.to.name} (${dist}).`;
    }
}

// URL builder 

export function buildTransitousUrl(
    origin: LatLng,
    destination: LatLng,
    departureTime?: string,
): string {
    const params = new URLSearchParams({
        fromPlace: `${origin.latitude},${origin.longitude}`,
        toPlace: `${destination.latitude},${destination.longitude}`,
        time: departureTime || new Date().toISOString(),
        numItineraries: "3",
    });

    return `${MOTIS_BASE_URL}?${params.toString()}`;
}

function normalizeLegEndpoint(
    place: any,
    fallbackName: string,
): { name: string; lat: number; lon: number } {
    if (place && typeof place === "object") {
        return {
            name: typeof place.name === "string" && place.name.length > 0 ? place.name : fallbackName,
            lat: typeof place.lat === "number" ? place.lat : 0,
            lon: typeof place.lon === "number" ? place.lon : 0,
        };
    }
    return { name: fallbackName, lat: 0, lon: 0 };
}

function parseItinerary(itinerary: any): TransitItinerary {
    const legs: TransitLeg[] = (itinerary.legs ?? []).map((leg: any, index: number) => ({
        mode: leg.mode ?? "WALK",
        from: normalizeLegEndpoint(leg.from, index === 0 ? "Origin" : "Stop"),
        to: normalizeLegEndpoint(leg.to, "Destination"),
        startTime: leg.startTime ?? "",
        endTime: leg.endTime ?? "",
        distance: leg.distance ?? 0,
        duration: leg.duration ?? 0,
        route: leg.routeShortName ?? leg.route ?? undefined,
        headsign: leg.headsign ?? undefined,
        legGeometry: leg.legGeometry ?? null,
        intermediateStops: Array.isArray(leg.intermediateStops) ? leg.intermediateStops : [],
    }));

    const coordinates = legs.flatMap((leg) =>
        leg.legGeometry?.points
            ? decodePolyline(leg.legGeometry.points, 7)
            : [],
    );

    const distanceMeters = legs.reduce((sum, leg) => sum + (leg.distance ?? 0), 0);

    // Count transit legs (non-walk) minus 1 = transfers
    const transitLegs = legs.filter((l) => l.mode !== "WALK").length;
    const transfers = Math.max(0, transitLegs - 1);

    const instructions = legs.map((leg) => {
        try {
            return {
                text: formatLegInstruction(leg),
                distanceMeters: leg.distance ?? 0,
            };
        } catch {
            return { text: "Continue journey.", distanceMeters: leg.distance ?? 0 };
        }
    });

    return {
        durationSeconds: Math.round(itinerary.duration ?? 0),
        distanceMeters: Math.round(distanceMeters),
        transfers,
        departureTime: legs[0]?.startTime ?? "",
        arrivalTime: legs[legs.length - 1]?.endTime ?? "",
        legs,
        instructions,
        coordinates,
    };
}

// Main fetch: returns up to 3 itineraries
export async function fetchTransitItineraries(
    origin: LatLng,
    destination: LatLng,
    departureTime?: string,
): Promise<TransitItinerary[]> {
    const url = buildTransitousUrl(origin, destination, departureTime);

    const response = await fetch(url, {
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Transitous request failed with ${response.status}.`);
    }

    const data = await response.json();

    const itineraries = data?.itineraries;
    if (!itineraries || itineraries.length === 0) {
        throw new Error("No transit route available for the selected locations.");
    }

    return itineraries.map(parseItinerary);
}

export async function fetchTransitRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    departureTime?: string,
): Promise<TransitItinerary> {
    const itineraries = await fetchTransitItineraries(origin, destination, departureTime);
    return itineraries[0];
}
