import { Text, TouchableOpacity } from "react-native";
import type { MapScreenStyles } from "../../styles/mapScreen.styles";

type LocationPermissionBannerProps = Readonly<{
  visible: boolean;
  bottomOffset: number;
  onPress: () => void | Promise<void>;
  styles: MapScreenStyles;
}>;

export default function LocationPermissionBanner({
  visible,
  bottomOffset,
  onPress,
  styles,
}: LocationPermissionBannerProps) {
  if (!visible) return null;

  return (
    <TouchableOpacity
      testID="location-permission-banner"
      style={[styles.permissionBanner, { bottom: bottomOffset }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.permissionText}>
        Enable location permissions to see where you are on campus. Tap here.
      </Text>
    </TouchableOpacity>
  );
}
