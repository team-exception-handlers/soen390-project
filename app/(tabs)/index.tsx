import { StyleSheet, View } from "react-native";
import AppHeader from "../../components/AppHeader";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <AppHeader />
      {/* map */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
