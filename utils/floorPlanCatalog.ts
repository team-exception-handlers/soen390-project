/**
 * Floor plans available in the app (must stay in sync with getFloorPlanAsset keys on the map screen).
 */
export type FloorPlanOption = { key: string; label: string };

const BY_BUILDING: Record<string, FloorPlanOption[]> = {
  H: [
    { key: "H-1", label: "Floor 1" },
    { key: "H-2", label: "Floor 2" },
    { key: "H-8", label: "Floor 8" },
    { key: "H-9", label: "Floor 9" },
  ],
  MB: [
    { key: "MB-1", label: "Floor 1" },
    { key: "MB--2", label: "S2" },
  ],
  VE: [
    { key: "VE-1", label: "Floor 1" },
    { key: "VE-2", label: "Floor 2" },
  ],
  VL: [
    { key: "VL-1", label: "Floor 1" },
    { key: "VL-2", label: "Floor 2" },
  ],
};

export function getFloorPlanOptionsForBuilding(
  buildingCode: string | null | undefined,
): FloorPlanOption[] {
  if (!buildingCode) return [];
  return BY_BUILDING[buildingCode] ?? [];
}

export function getFloorPlanLabelForKey(key: string): string {
  for (const options of Object.values(BY_BUILDING)) {
    const found = options.find((o) => o.key === key);
    if (found) return found.label;
  }
  return key;
}
