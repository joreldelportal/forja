// ============================================
// PPL MAPPING: UI dayType ↔ DB day_key
// ============================================

// UI day types used across the app
export type UiPplDayType = "PPL_PUSH" | "PPL_PULL" | "PPL_LEGS_A" | "PPL_LEGS_B";

// DB day_key values stored in Supabase
export type DbDayKey = "push" | "pull" | "lega" | "legb";

// Program key for PPL Advanced Gym
export const PPL_PROGRAM_KEY = "ppl_advanced_gym";

// Mapping configuration
const PPL_DAY_CONFIG: Record<UiPplDayType, { dbKey: DbDayKey; shortLabel: string; fullLabel: string }> = {
  PPL_PUSH: { dbKey: "push", shortLabel: "Push", fullLabel: "Push" },
  PPL_PULL: { dbKey: "pull", shortLabel: "Pull", fullLabel: "Pull" },
  PPL_LEGS_A: { dbKey: "lega", shortLabel: "Legs A", fullLabel: "Legs A (Quad Focus)" },
  PPL_LEGS_B: { dbKey: "legb", shortLabel: "Legs B", fullLabel: "Legs B (Hamstring Focus)" },
};

// Reverse mapping: DB key -> UI day type
const DB_TO_UI_MAP: Record<DbDayKey, UiPplDayType> = {
  push: "PPL_PUSH",
  pull: "PPL_PULL",
  lega: "PPL_LEGS_A",
  legb: "PPL_LEGS_B",
};

/**
 * Convert UI dayType to DB day_key
 */
export function uiDayTypeToDbDayKey(uiDayType: UiPplDayType): DbDayKey {
  return PPL_DAY_CONFIG[uiDayType].dbKey;
}

/**
 * Convert DB day_key to UI dayType
 */
export function dbDayKeyToUiDayType(dbKey: DbDayKey): UiPplDayType {
  return DB_TO_UI_MAP[dbKey];
}

/**
 * Get short label for UI display (e.g., "Push", "Legs A")
 */
export function uiDayTypeShortLabel(uiDayType: UiPplDayType): string {
  return PPL_DAY_CONFIG[uiDayType].shortLabel;
}

/**
 * Get full label for UI display (e.g., "Legs A (Quad Focus)")
 */
export function uiDayTypeFullLabel(uiDayType: UiPplDayType): string {
  return PPL_DAY_CONFIG[uiDayType].fullLabel;
}

/**
 * Check if a dayType is a PPL day type
 */
export function isPplDayType(dayType: string): dayType is UiPplDayType {
  return dayType in PPL_DAY_CONFIG;
}

/**
 * Get all PPL day types
 */
export function getAllPplDayTypes(): UiPplDayType[] {
  return Object.keys(PPL_DAY_CONFIG) as UiPplDayType[];
}
