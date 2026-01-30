import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type TabType = "map" | "profile";

type Props = {
  focused: boolean;
  label: string;
  type: TabType;
};

export default function BottomTabIcon({ focused, label, type }: Readonly<Props>) {
  const iconName =
    type === "map"
      ? focused
        ? "map"
        : "map-outline"
      : focused
        ? "person"
        : "person-outline";

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
