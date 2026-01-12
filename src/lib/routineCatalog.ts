// ============================================
// ROUTINE CATALOG v1
// Mapeo de tracks, day_types y system_routine_ids
// ============================================

// UUIDs de system_routines existentes
// NOTA: PPL NO tiene IDs aquí - se obtienen via RPC get_program_day_workout
export const SYSTEM_ROUTINE_IDS = {
  FULL_BODY_BASIC: "6614ec8d-d6f7-4578-8478-b7a3b17c33f7",
  FULL_BODY_INTERMEDIATE: "dcbae67b-fb19-48f2-ad83-661ab56c8210",
  FULL_BODY_HEALTH_40: "72364b03-f6a1-4863-b600-5b9925f27e47",
  UPPER_LOWER_INTERMEDIATE: "5feb8d48-0a8f-4c36-9b8d-449ad24713c5",
  // PPL: NO hardcodear IDs - se obtienen via RPC
  // Los IDs correctos vienen de system_program_day_variants
  CARDIO_OUTDOOR: "9d7dc2fa-85f7-4bed-ab02-52f59534e444",
  MOBILITY_GENERAL: "a4ed0df7-53b0-41cb-b1c2-06647279fc3d",
  BACK_HIPS_MOBILITY: "40ebfa67-798c-4ea2-899e-3d6cb352fb9f",
} as const;

// Tipos de Tracks
export type Track = "FULL_BODY" | "UPPER_LOWER" | "PPL" | "CARDIO" | "REGEN";

// Day Types por Track
type FullBodyDayType = "FB_A" | "FB_B" | "FB_C";
type UpperLowerDayType = "UL_UPPER_A" | "UL_LOWER_A" | "UL_UPPER_B" | "UL_LOWER_B";
type PPLDayType = "PPL_PUSH" | "PPL_PULL" | "PPL_LEGS_A" | "PPL_LEGS_B";
type CardioDayType = "CARDIO_A";
type RegenDayType = "REGEN_A" | "REGEN_B";

// Exportar DayType como union de todos los day types
export type DayType = FullBodyDayType | UpperLowerDayType | PPLDayType | CardioDayType | RegenDayType;

// Configuración de una variante de día
export type DayTypeConfig = {
  dayType: DayType;
  systemRoutineId: string;
  variantIndex: number;
  label: string;
};

// Configuración de un track
export type TrackConfig = {
  track: Track;
  label: string;
  dayTypes: DayTypeConfig[];
  rotationSequence: DayType[];
};

// ============================================
// CATÁLOGO DE TRACKS
// ============================================

export const TRACK_CATALOG: Record<Track, TrackConfig> = {
  FULL_BODY: {
    track: "FULL_BODY",
    label: "Full Body",
    dayTypes: [
      {
        dayType: "FB_A",
        systemRoutineId: SYSTEM_ROUTINE_IDS.FULL_BODY_BASIC,
        variantIndex: 1,
        label: "Full Body A (Basic)",
      },
      {
        dayType: "FB_B",
        systemRoutineId: SYSTEM_ROUTINE_IDS.FULL_BODY_INTERMEDIATE,
        variantIndex: 2,
        label: "Full Body B (Intermediate)",
      },
      {
        dayType: "FB_C",
        systemRoutineId: SYSTEM_ROUTINE_IDS.FULL_BODY_HEALTH_40,
        variantIndex: 3,
        label: "Full Body C (Health 40+)",
      },
    ],
    rotationSequence: ["FB_A", "FB_B", "FB_C"],
  },

  UPPER_LOWER: {
    track: "UPPER_LOWER",
    label: "Upper/Lower",
    dayTypes: [
      {
        dayType: "UL_UPPER_A",
        systemRoutineId: SYSTEM_ROUTINE_IDS.UPPER_LOWER_INTERMEDIATE,
        variantIndex: 1,
        label: "Upper A",
      },
      {
        dayType: "UL_LOWER_A",
        systemRoutineId: SYSTEM_ROUTINE_IDS.UPPER_LOWER_INTERMEDIATE,
        variantIndex: 1,
        label: "Lower A",
      },
      // Limitación v1: usamos el mismo system_routine para todas las variantes
      {
        dayType: "UL_UPPER_B",
        systemRoutineId: SYSTEM_ROUTINE_IDS.UPPER_LOWER_INTERMEDIATE,
        variantIndex: 2,
        label: "Upper B",
      },
      {
        dayType: "UL_LOWER_B",
        systemRoutineId: SYSTEM_ROUTINE_IDS.UPPER_LOWER_INTERMEDIATE,
        variantIndex: 2,
        label: "Lower B",
      },
    ],
    rotationSequence: ["UL_UPPER_A", "UL_LOWER_A", "UL_UPPER_B", "UL_LOWER_B"],
  },

  PPL: {
    track: "PPL",
    label: "Push/Pull/Legs",
    // IMPORTANTE: systemRoutineId es placeholder - se obtiene via RPC
    // NO usar estos IDs directamente, siempre usar getProgramDayWorkout()
    dayTypes: [
      {
        dayType: "PPL_PUSH",
        systemRoutineId: "RPC_REQUIRED", // Placeholder - obtener via RPC
        variantIndex: 1,
        label: "Push",
      },
      {
        dayType: "PPL_PULL",
        systemRoutineId: "RPC_REQUIRED", // Placeholder - obtener via RPC
        variantIndex: 1,
        label: "Pull",
      },
      {
        dayType: "PPL_LEGS_A",
        systemRoutineId: "RPC_REQUIRED", // Placeholder - obtener via RPC
        variantIndex: 1,
        label: "Legs A (Quad Focus)",
      },
      {
        dayType: "PPL_LEGS_B",
        systemRoutineId: "RPC_REQUIRED", // Placeholder - obtener via RPC
        variantIndex: 2,
        label: "Legs B (Hamstring Focus)",
      },
    ],
    // PPL típico: Push, Pull, Legs, Push, Pull, Legs
    rotationSequence: ["PPL_PUSH", "PPL_PULL", "PPL_LEGS_A", "PPL_PUSH", "PPL_PULL", "PPL_LEGS_B"],
  },

  CARDIO: {
    track: "CARDIO",
    label: "Cardio",
    dayTypes: [
      {
        dayType: "CARDIO_A",
        systemRoutineId: SYSTEM_ROUTINE_IDS.CARDIO_OUTDOOR,
        variantIndex: 1,
        label: "Cardio Outdoor",
      },
    ],
    rotationSequence: ["CARDIO_A"],
  },

  REGEN: {
    track: "REGEN",
    label: "Recuperación",
    dayTypes: [
      {
        dayType: "REGEN_A",
        systemRoutineId: SYSTEM_ROUTINE_IDS.MOBILITY_GENERAL,
        variantIndex: 1,
        label: "Mobility General",
      },
      {
        dayType: "REGEN_B",
        systemRoutineId: SYSTEM_ROUTINE_IDS.BACK_HIPS_MOBILITY,
        variantIndex: 2,
        label: "Back & Hips",
      },
    ],
    rotationSequence: ["REGEN_A", "REGEN_B"],
  },
};

// ============================================
// HELPERS
// ============================================

export function getTrackConfig(track: Track): TrackConfig {
  return TRACK_CATALOG[track];
}

export function getDayTypeConfig(track: Track, dayType: DayType): DayTypeConfig | undefined {
  const trackConfig = TRACK_CATALOG[track];
  return trackConfig.dayTypes.find((dt) => dt.dayType === dayType);
}

export function getSystemRoutineIdForDayType(track: Track, dayType: DayType): string | undefined {
  const config = getDayTypeConfig(track, dayType);
  return config?.systemRoutineId;
}

export function getNextDayType(track: Track, currentDayType: DayType): DayType {
  const trackConfig = TRACK_CATALOG[track];
  const sequence = trackConfig.rotationSequence;
  const currentIndex = sequence.indexOf(currentDayType);
  
  if (currentIndex === -1) {
    return sequence[0];
  }
  
  const nextIndex = (currentIndex + 1) % sequence.length;
  return sequence[nextIndex];
}

export function getFirstDayType(track: Track): DayType {
  return TRACK_CATALOG[track].rotationSequence[0];
}

export function isValidDayTypeForTrack(track: Track, dayType: DayType): boolean {
  const trackConfig = TRACK_CATALOG[track];
  return trackConfig.dayTypes.some((dt) => dt.dayType === dayType);
}

export function getAlternativeDayTypes(track: Track, currentDayType: DayType): DayTypeConfig[] {
  const trackConfig = TRACK_CATALOG[track];
  return trackConfig.dayTypes.filter((dt) => dt.dayType !== currentDayType);
}

export function getAllTracks(): Track[] {
  return Object.keys(TRACK_CATALOG) as Track[];
}

export function getTrackLabel(track: Track): string {
  return TRACK_CATALOG[track].label;
}

// ============================================
// PPL RPC HELPERS
// ============================================

import { isPplDayType, uiDayTypeToDbDayKey, uiDayTypeShortLabel, PPL_PROGRAM_KEY } from "./pplMapping";
import type { UiPplDayType } from "./pplMapping";

/**
 * Check if a track uses RPC for fetching routines (instead of static IDs)
 */
export function trackUsesRpc(track: Track): boolean {
  return track === "PPL";
}

/**
 * Get the program key for RPC calls (only for tracks that use RPC)
 */
export function getTrackProgramKey(track: Track): string | null {
  if (track === "PPL") return PPL_PROGRAM_KEY;
  return null;
}

/**
 * Get DB day_key for a PPL day type
 */
export function getPplDbDayKey(dayType: DayType): string | null {
  if (isPplDayType(dayType)) {
    return uiDayTypeToDbDayKey(dayType as UiPplDayType);
  }
  return null;
}

/**
 * Get short label for PPL day type (e.g., "Push", "Legs A")
 */
export function getPplShortLabel(dayType: DayType): string | null {
  if (isPplDayType(dayType)) {
    return uiDayTypeShortLabel(dayType as UiPplDayType);
  }
  return null;
}

/**
 * Format track badge label with day type
 * e.g., "Push/Pull/Legs · Push"
 */
export function formatTrackBadgeLabel(track: Track, dayType: DayType): string {
  const trackLabel = getTrackLabel(track);
  
  if (track === "PPL" && isPplDayType(dayType)) {
    const shortLabel = uiDayTypeShortLabel(dayType as UiPplDayType);
    return `${trackLabel} · ${shortLabel}`;
  }
  
  const dayConfig = getDayTypeConfig(track, dayType);
  return `${trackLabel} · ${dayConfig?.label || dayType}`;
}
