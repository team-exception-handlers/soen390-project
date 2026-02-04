import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type Campus = "SGW" | "LOY";

type AppHeaderProps = {
  campus: Campus;
  onCampusChange: (campus: Campus) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
};

export default function AppHeader({
  campus,
  onCampusChange,
  searchText,
  onSearchTextChange,
}: Readonly<AppHeaderProps>) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 900;

  return (
    <LinearGradient
      colors={["#8F1D2C", "#A32638", "#B12A3A"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        Platform.OS !== "web" ? { paddingTop: insets.top + 12 } : null,
        Platform.OS === "web" && isWide ? { paddingHorizontal: 28 } : null,
      ]}
    >
      <BlurView intensity={35} tint="light" style={styles.glassToggle}>
        <CampusButton
          label="SGW"
          active={campus === "SGW"}
          onPress={() => onCampusChange("SGW")}
        />
        <CampusButton
          label="Loyola"
          active={campus === "LOY"}
          onPress={() => onCampusChange("LOY")}
        />
      </BlurView>

      <Text style={styles.title}>Where to?</Text>

      <View style={styles.searchContainer}>
        <TextInput
          value={searchText}
          onChangeText={onSearchTextChange}
          placeholder="Search buildings, rooms, services"
          placeholderTextColor="#8E8E93"
          style={styles.input}
        />
      </View>
    </LinearGradient>
  );
}

type CampusButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function CampusButton({ label, active, onPress }: Readonly<CampusButtonProps>) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleButton, active && styles.toggleButtonActive]}
    >
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === "web" ? 35 : 0,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },

  glassToggle: {
    flexDirection: "row",
    alignSelf: "center",
    borderRadius: 20,
    padding: 4,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.15)",
    transform: Platform.OS !== "web" ? [{ translateY: -25 }] : [],
    marginTop: Platform.OS === "web" ? -20 : 0,
  },

  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },

  toggleButtonActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },

  toggleText: {
    fontSize: 13,
    fontWeight: "500",
    color: "white",
  },

  toggleTextActive: {
    color: "#A32638",
    fontWeight: "600",
  },

  title: {
    marginTop: Platform.OS !== "web" ? 30 : 14,
    marginBottom: 10,
    fontSize: 28,
    fontWeight: "700",
    color: "white",
  },

  searchContainer: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  input: {
    fontSize: 15,
    color: "#1C1C1E",
  },
});
