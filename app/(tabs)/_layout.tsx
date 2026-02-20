import { BlurView } from "expo-blur";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomTabIcon from "../../components/BottomTabIcon";

const TAB_BAR_BASE_HEIGHT = 56;

const MapTabIcon = ({ focused }: { focused: boolean }) => (
  <BottomTabIcon focused={focused} label="Map" type="map" />
);

const ProfileTabIcon = ({ focused }: { focused: boolean }) => (
  <BottomTabIcon focused={focused} label="Profile" type="profile" />
);

function TabBarBackground() {
  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={35}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
    );
  }

  // Android
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        style={StyleSheet.absoluteFill}
        intensity={90}
        tint="light"
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(255,255,255,0.55)" },
        ]}
      />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setBackgroundColorAsync("transparent");

      NavigationBar.setButtonStyleAsync("dark");

      NavigationBar.setPositionAsync("absolute");
    }
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        tabBarStyle: [
          styles.tabBar,
          {
            height: TAB_BAR_BASE_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
        ],

        tabBarBackground: TabBarBackground,

        tabBarItemStyle: {
          paddingVertical: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: MapTabIcon,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ProfileTabIcon,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,

    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
  },
});
