import type { Campus } from "../constants/buildings";

export interface Coordinates {
    latitude: number;
    longitude: number;
}

export const STOPS: Record<Campus, Coordinates> = {
    LOY: {
        latitude: 45.458,
        longitude: -73.639,
    },
    SGW: {
        latitude: 45.497,
        longitude: -73.578,
    },
};

// Haversine formula to calculate distance in km
export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
    const dLon = (coord2.longitude - coord1.longitude) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1.latitude * (Math.PI / 180)) *
        Math.cos(coord2.latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
};

export const getNearestStop = (userLocation: Coordinates): { stop: Campus; destination: Campus } => {
    const distToLoyola = calculateDistance(userLocation, STOPS.LOY);
    const distToSGW = calculateDistance(userLocation, STOPS.SGW);

    if (distToLoyola < distToSGW) {
        return { stop: 'LOY', destination: 'SGW' };
    } else {
        return { stop: 'SGW', destination: 'LOY' };
    }
};
