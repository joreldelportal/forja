import { supabase } from "./supabaseClient";

// ============================================
// TIPOS
// ============================================

export type AgeRange = "R16_24" | "R25_39" | "R40_54" | "R55_PLUS";
export type ExperienceRange = "LT_1Y" | "Y1_3Y" | "GT_3Y";
export type TrainingContext = "HOME" | "GYM" | "OUTDOOR";
export type Priority = "HEALTH" | "STRENGTH" | "AESTHETICS" | "ENDURANCE" | "REGEN";

export type Profile = {
  id: string;
  age_range: AgeRange;
  experience_range: ExperienceRange;
  training_context: TrainingContext;
  priority1: Priority;
  priority2: Priority | null;
  created_at?: string;
  updated_at?: string;
  // Campos legales (opcionales - pueden no existir en perfiles antiguos)
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  disclaimer_accepted_at?: string | null;
  legal_version?: string | null;
};

// Payload para crear/actualizar perfil
export type ProfilePayload = {
  id: string;
  age_range: AgeRange;
  experience_range: ExperienceRange;
  training_context: TrainingContext;
  priority1: Priority;
  priority2: Priority | null;
  // Campos legales opcionales en el payload
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  disclaimer_accepted_at?: string | null;
  legal_version?: string | null;
};

// ============================================
// FUNCIONES
// ============================================

export async function getMyProfile(userId: string): Promise<{
  data: Profile | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Profile | null, error: null };
}

export async function upsertMyProfile(payload: ProfilePayload): Promise<{
  data: Profile | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        ...payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Profile, error: null };
}
