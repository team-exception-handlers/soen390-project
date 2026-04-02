import type { ComponentType } from "react";
import { X } from "lucide-react-native";
import { Image, Modal, Platform, Pressable, View } from "react-native";
import Svg from "react-native-svg";
import type { MapScreenStyles } from "../../styles/mapScreen.styles";
import type { FloorPlanAsset } from "./mapScreen.helpers";

type FloorPlanModalProps = Readonly<{
  visible: boolean;
  activeFloorPlan: FloorPlanAsset;
  onClose: () => void;
  styles: MapScreenStyles;
}>;

export default function FloorPlanModal({
  visible,
  activeFloorPlan,
  onClose,
  styles,
}: FloorPlanModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Pressable style={styles.modalCloseButton} onPress={onClose}>
            <X size={24} color="#1F1F24" strokeWidth={2.5} />
          </Pressable>

          {activeFloorPlan != null &&
            (Platform.OS === "web" ? (
              <Image
                source={activeFloorPlan as any}
                style={styles.floorPlanImage}
                resizeMode="contain"
              />
            ) : typeof activeFloorPlan === "number" ? (
              <Image
                source={activeFloorPlan as any}
                style={styles.floorPlanImage}
                resizeMode="contain"
              />
            ) : (
              (() => {
                const FloorPlanComponent = activeFloorPlan as ComponentType<{
                  width?: string | number;
                  height?: string | number;
                }>;

                return (
                  <Svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 1024 1024"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <FloorPlanComponent width={1024} height={1024} />
                  </Svg>
                );
              })()
            ))}
        </View>
      </View>
    </Modal>
  );
}
