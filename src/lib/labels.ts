// src/lib/labels.ts
// Mapea enums de Supabase -> labels para UI

export type AgeRange = "R16_24" | "R25_39" | "R40_54" | "R55_PLUS";
export type ExperienceRange = "LT_1Y" | "Y1_3Y" | "GT_3Y";
export type TrainingContext = "HOME" | "GYM" | "OUTDOOR";
export type PriorityType = "HEALTH" | "STRENGTH" | "AESTHETICS" | "ENDURANCE" | "REGEN";

// Opciones en orden UI
export const AGE_OPTIONS: AgeRange[] = ["R16_24", "R25_39", "R40_54", "R55_PLUS"];
export const EXPERIENCE_OPTIONS: ExperienceRange[] = ["LT_1Y", "Y1_3Y", "GT_3Y"];
export const CONTEXT_OPTIONS: TrainingContext[] = ["HOME", "GYM", "OUTDOOR"];
export const PRIORITY_OPTIONS: PriorityType[] = ["HEALTH", "STRENGTH", "AESTHETICS", "ENDURANCE", "REGEN"];

// Labels
export const AGE_LABELS: Record<AgeRange, string> = {
  R16_24: "16–24 años",
  R25_39: "25–39 años",
  R40_54: "40–54 años",
  R55_PLUS: "55+ años",
};

export const EXPERIENCE_LABELS: Record<ExperienceRange, string> = {
  LT_1Y: "Menos de 1 año",
  Y1_3Y: "1–3 años",
  GT_3Y: "3+ años",
};

export const CONTEXT_LABELS: Record<TrainingContext, string> = {
  HOME: "Casa",
  GYM: "Gimnasio",
  OUTDOOR: "Exterior",
};

export const PRIORITY_LABELS: Record<PriorityType, string> = {
  HEALTH: "Salud",
  STRENGTH: "Fuerza",
  AESTHETICS: "Estética",
  ENDURANCE: "Resistencia",
  REGEN: "Recuperación",
};

// ============================================
// ICONOS para SelectableCardGroup
// ============================================

export const AGE_ICONS: Record<AgeRange, string> = {
  R16_24: "🔥",
  R25_39: "💪",
  R40_54: "🎯",
  R55_PLUS: "🏆",
};

export const EXPERIENCE_ICONS: Record<ExperienceRange, string> = {
  LT_1Y: "🌱",
  Y1_3Y: "📈",
  GT_3Y: "⭐",
};

export const CONTEXT_ICONS: Record<TrainingContext, string> = {
  HOME: "🏠",
  GYM: "🏋️",
  OUTDOOR: "🌳",
};

export const PRIORITY_ICONS: Record<PriorityType, string> = {
  HEALTH: "❤️",
  STRENGTH: "💪",
  AESTHETICS: "✨",
  ENDURANCE: "🏃",
  REGEN: "🧘",
};

// Para priority2 (opcional)
export const PRIORITY2_OPTIONS: Array<"" | PriorityType> = ["", ...PRIORITY_OPTIONS];
export const PRIORITY2_LABEL = (v: "" | PriorityType) => (v === "" ? "Ninguno" : PRIORITY_LABELS[v]);
export const PRIORITY2_ICON = (v: "" | PriorityType) => (v === "" ? "🚫" : PRIORITY_ICONS[v]);

// Helpers seguros
export const labelAge = (v: string) => (AGE_LABELS as Record<string, string>)[v] ?? v;
export const labelExp = (v: string) => (EXPERIENCE_LABELS as Record<string, string>)[v] ?? v;
export const labelContext = (v: string) => (CONTEXT_LABELS as Record<string, string>)[v] ?? v;
export const labelPriority = (v: string) => (PRIORITY_LABELS as Record<string, string>)[v] ?? v;
