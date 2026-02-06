import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import BottomTabIcon from "../../components/BottomTabIcon";

const TabBarBackground = () =>
  Platform.OS === "ios" ? (
    <BlurView
      intensity={80}
      tint="light"
      style={StyleSheet.absoluteFill}
    />
  ) : null;

const MapTabIcon = ({ focused }: { focused: boolean }) => (
  <BottomTabIcon focused={focused} label="Map" type="map" />
);

const ProfileTabIcon = ({ focused }: { focused: boolean }) => (
  <BottomTabIcon focused={focused} label="Profile" type="profile" />
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
        },

        tabBarBackground: () => <TabBarBackground />,

        tabBarItemStyle: {
          paddingVertical: 6,
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
