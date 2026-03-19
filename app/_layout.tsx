import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { useEffect } from "react";

function useMazeSnippet() {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const apiKey = "91f85022-cf96-483f-8433-b07c19eb8789";
    let sessionId: string | null = null;

    try {
      sessionId = sessionStorage.getItem("maze-us");
    } catch {}

    if (!sessionId) {
      sessionId = String(Date.now());
      try {
        sessionStorage.setItem("maze-us", sessionId);
      } catch {}
    }

    const script = document.createElement("script");
    script.src = `https://snippet.maze.co/maze-universal-loader.js?apiKey=${apiKey}`;
    script.async = true;
    document.head.appendChild(script);

    (globalThis as any).mazeUniversalSnippetApiKey = apiKey;

    return () => {
      script.remove();
    };
  }, []);
}

export default function RootLayout() {
  useMazeSnippet();

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
