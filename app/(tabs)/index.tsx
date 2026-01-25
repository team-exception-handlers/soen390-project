import { useState } from "react";
import { StyleSheet, View } from "react-native";
import AppHeader, { Campus } from "../../components/AppHeader";

export default function MapScreen() {
  {
    /* these make it so we can view selected campus and building from the map level */
  }
  const [campus, setCampus] = useState<Campus>("SGW");
  const [searchText, setSearchText] = useState("");

  return (
    <View style={styles.container}>
      <AppHeader
        campus={campus}
        onCampusChange={setCampus}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />
      {/* map */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
