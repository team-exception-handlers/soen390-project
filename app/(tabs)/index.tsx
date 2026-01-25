import { useState } from "react";
import { StyleSheet, View } from "react-native";
import AppHeader from "../../components/AppHeader";

type Campus = "SGW" | "Loyola";

{
  /* this allows the selected campus to be visible from the map page*/
}
export default function MapScreen() {
  const [campus, setCampus] = useState<Campus>("SGW");

  return (
    <View style={styles.container}>
      <AppHeader campus={campus} onCampusChange={setCampus} />
      {/* map */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
