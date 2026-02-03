import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type TabType = "map" | "profile";

type Props = {
  focused: boolean;
  label: string;
  type: TabType;
};

function getIconName(type: TabType, focused: boolean): "map" | "map-outline" | "person" | "person-outline" {
  if (type === "map") {
    return focused ? "map" : "map-outline";
  }
  return focused ? "person" : "person-outline";
}

export default function BottomTabIcon({ focused, label, type }: Readonly<Props>) {
  const iconName = getIconName(type, focused);

  return (
    <View style={styles.container}>
      <Ionicons
        name={iconName}
        size={22}
        color={focused ? "#007AFF" : "#8E8E93"}
      />
      <Text
        style={[styles.label, focused && styles.labelFocused]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
    paddingTop: 6,
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    color: "#8E8E93",
    textAlign: "center",
  },
  labelFocused: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
