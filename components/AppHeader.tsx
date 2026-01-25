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
} from "react-native";

export type Campus = "SGW" | "Loyola";

type AppHeaderProps = {
  campus: Campus;
  onCampusChange: (campus: Campus) => void;
};

export default function AppHeader({ campus, onCampusChange }: AppHeaderProps) {
  return (
    <LinearGradient
      colors={["#8F1D2C", "#A32638", "#B12A3A"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <BlurView intensity={35} tint="light" style={styles.glassToggle}>
        <CampusButton
          label="SGW"
          active={campus === "SGW"}
          onPress={() => onCampusChange("SGW")}
        />
        <CampusButton
          label="Loyola"
          active={campus === "Loyola"}
          onPress={() => onCampusChange("Loyola")}
        />
      </BlurView>

      <Text style={styles.title}>Where to?</Text>

      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search buildings, rooms, services"
          placeholderTextColor="#8E8E93"
          style={styles.input}
        />
      </View>
    </LinearGradient>
  );
}

type CampusButtonProps = {
  label: Campus;
  active: boolean;
  onPress: () => void;
};

function CampusButton({ label, active, onPress }: CampusButtonProps) {
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
    paddingTop: Platform.OS === "ios" ? 60 : 40,
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
    marginTop: 14,
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
