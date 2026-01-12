// ============================================
// ROUTINE ENGINE v1
// Motor de selección, rotación y switch de rutinas
// ============================================

import { supabase } from "../services/supabaseClient";
import type { Profile } from "../services/profileService";
import {
  type Track,
  type DayType,
  type DayTypeConfig,
 // TRACK_CATALOG,
  getFirstDayType,
  getNextDayType,
  getDayTypeConfig,
  isValidDayTypeForTrack,
  getAlternativeDayTypes,
} from "./routineCatalog";

// ============================================
// TIPOS
// ============================================

export type UserProgramState = {
  user_id: string;
  active_track: Track;
  next_day_type: DayType;
  last_assigned_system_routine_id: string | null;
  last_completed_at: string | null;
  rotation_counter: number;
  created_at: string;
  updated_at: string;
};

export type Assignment = {
  track: Track;
  dayType: DayType;
  variantIndex: number;
  systemRoutineId: string;
  overrideUsed: boolean;
  overrideFromDayType: DayType | null;
  overrideToDayType: DayType | null;
};

export type WorkoutMeta = {
  track: Track;
  day_type: DayType;
  variant_index: number;
  system_routine_id: string;
  reps_seconds: number;
  warmup_skipped: boolean;
  override_used: boolean;
  override_from_day_type: string | null;
  override_to_day_type: string | null;
};

// ============================================
// TRACK RECOMMENDATION
// ============================================

export function recommendTrack(profile: Profile): Track {
  const { age_range, experience_range, training_context, priority1 } = profile;

  // Regla 1: Si priority1 es REGEN, usar track REGEN
  if (priority1 === "REGEN") {
    return "REGEN";
  }

  // Regla 2: Si priority1 es ENDURANCE, preferir CARDIO
  if (priority1 === "ENDURANCE") {
    return "CARDIO";
  }

  // Regla 3: Edad 55+ solo puede FULL_BODY o UPPER_LOWER (no PPL)
  if (age_range === "R55_PLUS") {
    // Para mayores, preferir FULL_BODY por simplicidad
    return "FULL_BODY";
  }

  // Regla 4: Experiencia < 1 año preferir FULL_BODY
  if (experience_range === "LT_1Y") {
    return "FULL_BODY";
  }

  // Regla 5: Para STRENGTH o AESTHETICS con experiencia
  if (priority1 === "STRENGTH" || priority1 === "AESTHETICS") {
    // Si tiene más de 3 años y contexto GYM, puede hacer PPL
    if (experience_range === "GT_3Y" && training_context === "GYM") {
      return "PPL";
    }
    // Si tiene 1-3 años, UPPER_LOWER es buena opción
    if (experience_range === "Y1_3Y") {
      return training_context === "GYM" ? "UPPER_LOWER" : "FULL_BODY";
    }
  }

  // Regla 6: Para HEALTH, FULL_BODY suele ser mejor
  if (priority1 === "HEALTH") {
    return "FULL_BODY";
  }

  // Regla 7: Contexto HOME/OUTDOOR preferir FULL_BODY (más versátil)
  if (training_context === "HOME" || training_context === "OUTDOOR") {
    return "FULL_BODY";
  }

  // Default: FULL_BODY
  return "FULL_BODY";
}

// ============================================
// PROGRAM STATE MANAGEMENT
// ============================================

export async function getOrInitProgramState(
  userId: string,
  profile: Profile
): Promise<{ data: UserProgramState | null; error: string | null }> {
  // Intentar obtener estado existente
  const { data: existing, error: fetchError } = await supabase
    .from("user_program_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    return { data: null, error: fetchError.message };
  }

  // Si existe, retornarlo
  if (existing) {
    return { data: existing as UserProgramState, error: null };
  }

  // Si no existe, crear uno nuevo con upsert para evitar race conditions
  const recommendedTrack = recommendTrack(profile);
  const firstDayType = getFirstDayType(recommendedTrack);

  const newState = {
    user_id: userId,
    active_track: recommendedTrack,
    next_day_type: firstDayType,
    last_assigned_system_routine_id: null,
    last_completed_at: null,
    rotation_counter: 0,
  };

  const { data: upserted, error: upsertError } = await supabase
    .from("user_program_state")
    .upsert(newState, { onConflict: "user_id" })
    .select()
    .single();

  if (upsertError) {
    return { data: null, error: upsertError.message };
  }

  return { data: upserted as UserProgramState, error: null };
}

export async function updateProgramState(
  userId: string,
  updates: Partial<Omit<UserProgramState, "user_id" | "created_at">>
): Promise<{ data: UserProgramState | null; error: string | null }> {
  const { data, error } = await supabase
    .from("user_program_state")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as UserProgramState, error: null };
}

// ============================================
// ASSIGNMENT LOGIC
// ============================================

export function getNextAssignment(
  state: UserProgramState,
  _profile: Profile,
  overrideToDayType?: DayType
): Assignment {
  const track = state.active_track;
  let dayType = state.next_day_type;
  let overrideUsed = false;
  let overrideFromDayType: DayType | null = null;
  let overrideToDayTypeResult: DayType | null = null;

  // Si hay override, validar que sea un day_type válido para el track
  if (overrideToDayType && isValidDayTypeForTrack(track, overrideToDayType)) {
    overrideUsed = true;
    overrideFromDayType = dayType;
    overrideToDayTypeResult = overrideToDayType;
    dayType = overrideToDayType;
  }

  // Obtener configuración del day_type
  const dayTypeConfig = getDayTypeConfig(track, dayType);
  
  if (!dayTypeConfig) {
    // Fallback: usar el primer day_type del track
    const firstDayType = getFirstDayType(track);
    const fallbackConfig = getDayTypeConfig(track, firstDayType)!;
    
    return {
      track,
      dayType: firstDayType,
      variantIndex: fallbackConfig.variantIndex,
      systemRoutineId: fallbackConfig.systemRoutineId,
      overrideUsed,
      overrideFromDayType,
      overrideToDayType: overrideToDayTypeResult,
    };
  }

  return {
    track,
    dayType,
    variantIndex: dayTypeConfig.variantIndex,
    systemRoutineId: dayTypeConfig.systemRoutineId,
    overrideUsed,
    overrideFromDayType,
    overrideToDayType: overrideToDayTypeResult,
  };
}

export function advanceState(
  state: UserProgramState,
  chosenDayType: DayType
): Partial<UserProgramState> {
  const track = state.active_track;
  const nextDayType = getNextDayType(track, chosenDayType);
  
  return {
    next_day_type: nextDayType,
    rotation_counter: state.rotation_counter + 1,
  };
}

// ============================================
// ASSIGNMENT + PERSIST (usado al crear sesión)
// ============================================

export async function assignAndAdvance(
  userId: string,
  state: UserProgramState,
  assignment: Assignment,
  systemRoutineId: string
): Promise<{ data: UserProgramState | null; error: string | null }> {
  const advancedState = advanceState(state, assignment.dayType);
  
  return updateProgramState(userId, {
    ...advancedState,
    last_assigned_system_routine_id: systemRoutineId,
  });
}

export async function markCompleted(
  userId: string
): Promise<{ data: UserProgramState | null; error: string | null }> {
  return updateProgramState(userId, {
    last_completed_at: new Date().toISOString(),
  });
}

// ============================================
// SWITCH HELPERS
// ============================================

export function getAvailableSwitchOptions(
  state: UserProgramState
): DayTypeConfig[] {
  return getAlternativeDayTypes(state.active_track, state.next_day_type);
}

// ============================================
// TRACK SWITCH (para cambiar de programa completo)
// ============================================

export async function switchTrack(
  userId: string,
  newTrack: Track
): Promise<{ data: UserProgramState | null; error: string | null }> {
  const firstDayType = getFirstDayType(newTrack);
  
  return updateProgramState(userId, {
    active_track: newTrack,
    next_day_type: firstDayType,
    rotation_counter: 0,
  });
}

// ============================================
// SYNC TRACK WITH PROFILE
// Recalcula el track recomendado y actualiza si cambió
// Llamar después de que el usuario actualice su perfil
// ============================================

export async function syncTrackWithProfile(
  userId: string,
  profile: Profile
): Promise<{ data: UserProgramState | null; error: string | null; trackChanged: boolean }> {
  // 1. Obtener estado actual (si existe)
  const { data: currentState, error: fetchError } = await supabase
    .from("user_program_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    return { data: null, error: fetchError.message, trackChanged: false };
  }

  // 2. Calcular el track recomendado según el nuevo perfil
  const recommendedTrack = recommendTrack(profile);
  const firstDayType = getFirstDayType(recommendedTrack);

  // 3. Si no existe estado, crear uno nuevo
  if (!currentState) {
    const newState = {
      user_id: userId,
      active_track: recommendedTrack,
      next_day_type: firstDayType,
      last_assigned_system_routine_id: null,
      last_completed_at: null,
      rotation_counter: 0,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("user_program_state")
      .upsert(newState, { onConflict: "user_id" })
      .select()
      .single();

    if (insertError) {
      return { data: null, error: insertError.message, trackChanged: false };
    }

    return { data: inserted as UserProgramState, error: null, trackChanged: true };
  }

  // 4. Si el track actual es diferente al recomendado, actualizar
  if (currentState.active_track !== recommendedTrack) {
    const { data: updated, error: updateError } = await supabase
      .from("user_program_state")
      .update({
        active_track: recommendedTrack,
        next_day_type: firstDayType,
        rotation_counter: 0, // Reset rotation cuando cambia el track
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      return { data: null, error: updateError.message, trackChanged: false };
    }

    return { data: updated as UserProgramState, error: null, trackChanged: true };
  }

  // 5. Si el track es el mismo, no hacer nada
  return { data: currentState as UserProgramState, error: null, trackChanged: false };
}

// ============================================
// META BUILDER
// ============================================

export function buildWorkoutMeta(
  assignment: Assignment,
  warmupSkipped: boolean
): WorkoutMeta {
  return {
    track: assignment.track,
    day_type: assignment.dayType,
    variant_index: assignment.variantIndex,
    system_routine_id: assignment.systemRoutineId,
    reps_seconds: 2, // Constante global
    warmup_skipped: warmupSkipped,
    override_used: assignment.overrideUsed,
    override_from_day_type: assignment.overrideFromDayType,
    override_to_day_type: assignment.overrideToDayType,
  };
}
