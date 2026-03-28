import { Text, View } from "react-native";
import type { BuildingRecord } from "../../constants/buildings";
import type { MapScreenStyles } from "../../styles/mapScreen.styles";

type CurrentBuildingBannerProps = Readonly<{
  building: BuildingRecord | null;
  isWebPlatform: boolean;
  topInset: number;
  styles: MapScreenStyles;
}>;

export default function CurrentBuildingBanner({
  building,
  isWebPlatform,
  topInset,
  styles,
}: CurrentBuildingBannerProps) {
  if (!building) return null;

  return (
    <View
      style={[styles.buildingInfo, !isWebPlatform && { top: topInset + 44 }]}
      testID="current-building-info"
    >
      <Text style={styles.buildingInfoTitle}>Current Building:</Text>
      <Text style={styles.buildingInfoText} testID="current-building-name">
        {building.longName} ({building.shortName}) - [{building.code}]
      </Text>
    </View>
  );
}
