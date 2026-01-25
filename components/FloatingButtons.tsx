import { Building2, MapPin } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

export default function FloatingButtons() {
  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        <Building2 size={18} strokeWidth={2} color="#333" />
        <Text style={styles.label}>SGW</Text>

        <MapPin size={18} strokeWidth={2} color="#333" />
        <Text style={styles.label}>Loyola</Text>
      </View>

      <View style={styles.circle}>
        <MapPin size={20} strokeWidth={2} color="#333" />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    top: 260,
  },
  pill: {
    backgroundColor: "#EFEAF7",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: "#555",
    marginTop: 4,
    marginBottom: 12,
    fontWeight: "500",
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFEAF7",
    alignItems: "center",
    justifyContent: "center",
  },
});
