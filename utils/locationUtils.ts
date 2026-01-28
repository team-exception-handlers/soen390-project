import * as Location from "expo-location";

export async function requestLocationPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
}

export async function hasLocationPermission(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
}

export async function startWatchingLocation(
    callback: (location: Location.LocationObject) => void
): Promise<Location.LocationSubscription | null> {
    try {
        const permission = await hasLocationPermission();
        if (!permission) {
            const granted = await requestLocationPermission();
            if (!granted) return null;
        }

        const subscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10,
            },
            callback
        );
        return subscription;
    } catch (error) {
        console.error("Error watching location:", error);
        return null;
    }
}