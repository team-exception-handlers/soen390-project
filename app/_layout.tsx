import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

// Keep splash visible until we hide it
SplashScreen.preventAutoHideAsync?.();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash once the root layout has mounted
    SplashScreen.hideAsync?.();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
