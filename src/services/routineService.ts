import { supabase } from "./supabaseClient";
import type { Profile } from "./profileService";

// ============================================
// TIPOS
// ============================================

export type BlockType = "WARMUP" | "STANDARD" | "FINISHER" | "CARDIO" | "REGEN";
export type PriorityType = "HEALTH" | "STRENGTH" | "AESTHETICS" | "ENDURANCE" | "REGEN";
export type TrainingContext = "HOME" | "GYM" | "OUTDOOR";

export type SystemRoutine = {
  id: string;
  title: string;
  description: string | null;
  target_priority: PriorityType;
  target_context: TrainingContext | null;
  estimated_duration_sec: number;
  created_at: string;
};

export type SystemRoutineBlock = {
  id: string;
  system_routine_id: string;
  order_index: number;
  block_type: BlockType;
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  seconds_per_rep: number | null;
  work_seconds: number | null;
  rest_seconds: number | null;
  exercise?: Exercise;
};

export type Exercise = {
  id: string;
  name: string;
  category: string;
  type: string;
  media_url: string | null;
  instructions_short: string | null;
};

export type RoutineWithBlocks = SystemRoutine & {
  blocks: SystemRoutineBlock[];
};

// ============================================
// SYSTEM ROUTINES FUNCTIONS
// ============================================

export async function getSystemRoutines(): Promise<{
  data: SystemRoutine[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("system_routines")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as SystemRoutine[], error: null };
}

export async function getSystemRoutineById(id: string): Promise<{
  data: SystemRoutine | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("system_routines")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as SystemRoutine, error: null };
}

export async function getSystemRoutineBlocks(systemRoutineId: string): Promise<{
  data: SystemRoutineBlock[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("system_routine_blocks")
    .select(`
      *,
      exercise:exercises(*)
    `)
    .eq("system_routine_id", systemRoutineId)
    .order("order_index", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as SystemRoutineBlock[], error: null };
}

export async function getSystemRoutineWithBlocks(id: string): Promise<{
  data: RoutineWithBlocks | null;
  error: string | null;
}> {
  const routineRes = await getSystemRoutineById(id);
  if (routineRes.error || !routineRes.data) {
    return { data: null, error: routineRes.error };
  }

  const blocksRes = await getSystemRoutineBlocks(id);
  if (blocksRes.error) {
    return { data: null, error: blocksRes.error };
  }

  return {
    data: {
      ...routineRes.data,
      blocks: blocksRes.data || [],
    },
    error: null,
  };
}

export async function fetchSystemRoutineWithBlocks(systemRoutineId: string): Promise<{
  data: RoutineWithBlocks | null;
  error: string | null;
}> {
  return getSystemRoutineWithBlocks(systemRoutineId);
}

// ============================================
// RECOMMENDED ROUTINE (legacy)
// ============================================

export async function getRecommendedRoutine(profile: Profile): Promise<{
  data: SystemRoutine | null;
  error: string | null;
}> {
  let { data, error } = await supabase
    .from("system_routines")
    .select("*")
    .eq("target_context", profile.training_context)
    .eq("target_priority", profile.priority1)
    .order("estimated_duration_sec", { ascending: true })
    .limit(1);

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && data.length > 0) {
    return { data: data[0] as SystemRoutine, error: null };
  }

  ({ data, error } = await supabase
    .from("system_routines")
    .select("*")
    .eq("target_context", profile.training_context)
    .eq("target_priority", "HEALTH")
    .order("estimated_duration_sec", { ascending: true })
    .limit(1));

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && data.length > 0) {
    return { data: data[0] as SystemRoutine, error: null };
  }

  ({ data, error } = await supabase
    .from("system_routines")
    .select("*")
    .eq("target_priority", profile.priority1)
    .order("estimated_duration_sec", { ascending: true })
    .limit(1));

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && data.length > 0) {
    return { data: data[0] as SystemRoutine, error: null };
  }

  ({ data, error } = await supabase
    .from("system_routines")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1));

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data?.[0] as SystemRoutine ?? null, error: null };
}

// ============================================
// CLONE SYSTEM ROUTINE (RPC)
// ============================================

export async function cloneSystemRoutine(systemRoutineId: string): Promise<{
  data: { routineId: string } | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("clone_system_routine", {
    p_system_routine_id: systemRoutineId,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: { routineId: data as string }, error: null };
}

export async function rpcCloneSystemRoutine(systemRoutineId: string): Promise<{
  data: { routineId: string } | null;
  error: string | null;
}> {
  return cloneSystemRoutine(systemRoutineId);
}

// ============================================
// USER ROUTINES
// ============================================

export async function getUserRoutineByTitle(
  userId: string,
  title: string
): Promise<{
  data: { id: string; title: string } | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("routines")
    .select("id, title")
    .eq("user_id", userId)
    .eq("title", title)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function getOrCloneSystemRoutine(
  userId: string,
  systemRoutineId: string,
  routineTitle: string
): Promise<{
  data: { routineId: string } | null;
  error: string | null;
}> {
  const cloneRes = await cloneSystemRoutine(systemRoutineId);
  
  if (cloneRes.data?.routineId) {
    return { data: { routineId: cloneRes.data.routineId }, error: null };
  }

  if (cloneRes.error?.includes("duplicate") || cloneRes.error?.includes("unique")) {
    const existingRes = await getUserRoutineByTitle(userId, routineTitle);
    
    if (existingRes.data) {
      return { data: { routineId: existingRes.data.id }, error: null };
    }
  }

  return { data: null, error: cloneRes.error };
}

// ============================================
// PROGRAM DAY WORKOUT (RPC)
// ============================================

export type ProgramDayBlock = {
  system_routine_id: string;
  routine_title: string;
  order_index: number;
  block_type: BlockType;
  exercise_ref_type: string | null;
  exercise_id: string | null;
  exercise_name: string | null;
  sets: number | null;
  reps: number | null;
  seconds_per_rep: number | null;
  work_seconds: number | null;
  rest_seconds: number | null;
};

export type ProgramDayWorkout = {
  routineId: string;
  routineTitle: string;
  blocks: ProgramDayBlock[];
  estimatedDurationSec: number;
};

/**
 * Fetch workout data for a specific program day using RPC
 * THIS IS THE ONLY SOURCE OF TRUTH FOR PPL ROUTINES
 * @param programKey - e.g., "ppl_advanced_gym"
 * @param dayKey - e.g., "push", "pull", "lega", "legb"
 * @param weekNum - optional week number for periodization
 */
export async function getProgramDayWorkout(
  programKey: string,
  dayKey: string,
  weekNum?: number
): Promise<{
  data: ProgramDayWorkout | null;
  error: string | null;
}> {
  // DEBUG LOG - temporary
  console.log("[getProgramDayWorkout] Request:", { programKey, dayKey, weekNum });

  const { data, error } = await supabase.rpc("get_program_day_workout", {
    p_program_key: programKey,
    p_day_key: dayKey,
    p_week_num: weekNum ?? null,
  });

  if (error) {
    console.error("[getProgramDayWorkout] RPC error:", error);
    return { data: null, error: `Error al cargar rutina: ${error.message}` };
  }

  if (!data || data.length === 0) {
    console.error("[getProgramDayWorkout] No data returned for:", { programKey, dayKey });
    return { data: null, error: `No se encontró rutina para ${programKey}/${dayKey}` };
  }

  // Sort blocks by order_index
  const sortedBlocks = (data as ProgramDayBlock[]).sort(
    (a, b) => a.order_index - b.order_index
  );

  // Calculate estimated duration
  const SECONDS_PER_REP = 2;
  let totalDuration = 0;
  
  for (const block of sortedBlocks) {
    const sets = block.sets || 1;
    const reps = block.reps || 0;
    const restSec = block.rest_seconds || 0;
    
    let workTime: number;
    if (block.work_seconds) {
      workTime = block.work_seconds;
    } else if (reps > 0) {
      workTime = reps * SECONDS_PER_REP;
    } else {
      workTime = 30;
    }
    
    totalDuration += (workTime * sets) + (restSec * Math.max(0, sets - 1));
  }

  const result: ProgramDayWorkout = {
    routineId: sortedBlocks[0].system_routine_id,
    routineTitle: sortedBlocks[0].routine_title,
    blocks: sortedBlocks,
    estimatedDurationSec: totalDuration,
  };

  // DEBUG LOG - temporary
  console.log("[getProgramDayWorkout] Success:", {
    programKey,
    dayKey,
    routineId: result.routineId,
    routineTitle: result.routineTitle,
    blockCount: result.blocks.length,
    exercises: result.blocks.map(b => b.exercise_name).filter(Boolean),
  });

  return { data: result, error: null };
}

/**
 * Get just the routine ID for a program day (lighter call)
 */
export async function getProgramDayRoutineId(
  programKey: string,
  dayKey: string,
  weekNum?: number
): Promise<{
  data: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("get_program_day_routine_id", {
    p_program_key: programKey,
    p_day_key: dayKey,
    p_week_num: weekNum ?? null,
  });

  if (error) {
    console.error("RPC get_program_day_routine_id error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as string, error: null };
}

// ============================================
// PPL WORKOUT HELPER
// Single function to get PPL workout with proper mapping
// ============================================

import { 
  isPplDayType, 
  uiDayTypeToDbDayKey, 
  PPL_PROGRAM_KEY,
  type UiPplDayType 
} from "../lib/pplMapping";

/**
 * Get workout for a PPL day type
 * THIS IS THE CANONICAL WAY TO FETCH PPL WORKOUTS
 * Maps UI dayType -> DB dayKey and calls RPC
 * 
 * @param uiDayType - "PPL_PUSH" | "PPL_PULL" | "PPL_LEGS_A" | "PPL_LEGS_B"
 * @param weekNum - optional week number for periodization
 */
export async function getWorkoutForPplDay(
  uiDayType: string,
  weekNum?: number
): Promise<{
  data: ProgramDayWorkout | null;
  error: string | null;
}> {
  // Validate it's a PPL day type
  if (!isPplDayType(uiDayType)) {
    console.error("[getWorkoutForPplDay] Invalid PPL day type:", uiDayType);
    return { data: null, error: `${uiDayType} no es un día PPL válido` };
  }

  // Map UI day type to DB day key
  const dbDayKey = uiDayTypeToDbDayKey(uiDayType as UiPplDayType);
  
  // DEBUG LOG
  console.log("[getWorkoutForPplDay] Mapping:", { 
    uiDayType, 
    dbDayKey, 
    programKey: PPL_PROGRAM_KEY,
    weekNum 
  });

  // Call RPC with mapped values
  return getProgramDayWorkout(PPL_PROGRAM_KEY, dbDayKey, weekNum);
}
