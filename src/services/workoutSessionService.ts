import { supabase } from "./supabaseClient";
import { getOrCloneSystemRoutine, getSystemRoutineById } from "./routineService";
import { markAsTrained } from "./calendarService";

// ============================================
// TIPOS
// ============================================

export type SessionStatus = "STARTED" | "PAUSED" | "FINISHED" | "ABORTED";

export type WorkoutMeta = {
  track: string;
  day_type: string;
  variant_index: number;
  system_routine_id: string;
  reps_seconds: number;
  warmup_skipped: boolean;
  override_used: boolean;
  override_from_day_type: string | null;
  override_to_day_type: string | null;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  routine_id: string;
  started_at: string;
  finished_at: string | null;
  status: SessionStatus;
  total_elapsed_sec: number;
  meta: WorkoutMeta | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutSessionState = {
  session_id: string;
  state: Record<string, unknown>;
  updated_at: string;
};

// ============================================
// NUEVO: Tipo para calendario
// ============================================

export type WorkoutDay = {
  id: string;
  workout_date: string;
  source: string;
  label: string | null;
  day_label: string | null;
  program_key: string | null;
  day_key: string | null;
  duration_seconds: number | null;
  meta: Record<string, unknown> | null;
};

// ============================================
// FUNCIONES BÁSICAS
// ============================================

export async function createWorkoutSession(
  userId: string,
  routineId: string,
  meta?: WorkoutMeta
): Promise<{
  data: WorkoutSession | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      routine_id: routineId,
      started_at: new Date().toISOString(),
      status: "STARTED",
      total_elapsed_sec: 0,
      meta: meta || null,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as WorkoutSession, error: null };
}

export async function updateWorkoutSession(
  sessionId: string,
  updates: Partial<Pick<WorkoutSession, "status" | "total_elapsed_sec" | "finished_at" | "meta">>
): Promise<{
  data: WorkoutSession | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as WorkoutSession, error: null };
}

export async function finishWorkoutSession(
  sessionId: string,
  totalElapsedSec: number
): Promise<{
  data: WorkoutSession | null;
  error: string | null;
}> {
  return updateWorkoutSession(sessionId, {
    status: "FINISHED",
    finished_at: new Date().toISOString(),
    total_elapsed_sec: totalElapsedSec,
  });
}

export async function getWorkoutSession(sessionId: string): Promise<{
  data: WorkoutSession | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as WorkoutSession, error: null };
}

export async function getRecentSessions(
  userId: string,
  limit: number = 10
): Promise<{
  data: WorkoutSession[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as WorkoutSession[], error: null };
}

// ============================================
// NUEVO: GET WORKOUTS FOR WEEK (para calendario)
// Lee directamente de workout_sessions
// ============================================

export async function getWorkoutsForWeek(
  userId: string,
  referenceDate: string
): Promise<{
  data: WorkoutDay[] | null;
  error: string | null;
}> {
  // Calcular inicio de semana (lunes)
  const refDate = new Date(referenceDate);
  const currentDay = refDate.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + mondayOffset);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const startDate = monday.toISOString().split("T")[0];
  const endDate = sunday.toISOString().split("T")[0];

  // Query simplificado - solo columnas básicas que seguro existen
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("workout_date", startDate)
    .lte("workout_date", endDate)
    .order("workout_date", { ascending: true });

  if (error) {
    console.error("[getWorkoutsForWeek] Error:", error);
    return { data: null, error: error.message };
  }

  // Mapear a WorkoutDay
  const workoutDays: WorkoutDay[] = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    workout_date: row.workout_date as string,
    source: (row.source as string) || "recommended",
    label: (row.label as string) || (row.day_label as string) || null,
    day_label: (row.day_label as string) || null,
    program_key: (row.program_key as string) || null,
    day_key: (row.day_key as string) || null,
    duration_seconds: (row.duration_seconds as number) || null,
    meta: (row.meta as Record<string, unknown>) || null,
  }));

  return { data: workoutDays, error: null };
}

// ============================================
// NUEVO: GET WORKOUTS FOR DATE RANGE (para historial)
// ============================================

export async function getWorkoutsForDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{
  data: WorkoutDay[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("workout_date", startDate)
    .lte("workout_date", endDate)
    .order("workout_date", { ascending: false });

  if (error) {
    console.error("[getWorkoutsForDateRange] Error:", error);
    return { data: null, error: error.message };
  }

  // Mapear a WorkoutDay
  const workoutDays: WorkoutDay[] = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    workout_date: row.workout_date as string,
    source: (row.source as string) || "recommended",
    label: (row.label as string) || (row.day_label as string) || null,
    day_label: (row.day_label as string) || null,
    program_key: (row.program_key as string) || null,
    day_key: (row.day_key as string) || null,
    duration_seconds: (row.duration_seconds as number) || null,
    meta: (row.meta as Record<string, unknown>) || null,
  }));

  return { data: workoutDays, error: null };
}

// ============================================
// SESSION STATE
// ============================================

export async function saveSessionState(
  sessionId: string,
  state: Record<string, unknown>
): Promise<{
  error: string | null;
}> {
  const { error } = await supabase
    .from("workout_session_state")
    .upsert(
      {
        session_id: sessionId,
        state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function getSessionState(sessionId: string): Promise<{
  data: WorkoutSessionState | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("workout_session_state")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as WorkoutSessionState | null, error: null };
}

// ============================================
// CREATE SESSION FROM SYSTEM ROUTINE
// ============================================

export type CreateSessionFromSystemParams = {
  userId: string;
  systemRoutineId: string;
  meta: WorkoutMeta;
};

export async function createWorkoutSessionFromSystemRoutine(
  params: CreateSessionFromSystemParams
): Promise<{
  data: { session: WorkoutSession; clonedRoutineId: string } | null;
  error: string | null;
}> {
  const { userId, systemRoutineId, meta } = params;

  // 1. Obtener título de la system_routine
  const routineRes = await getSystemRoutineById(systemRoutineId);
  if (routineRes.error || !routineRes.data) {
    return { data: null, error: routineRes.error || "System routine not found" };
  }

  const routineTitle = routineRes.data.title;

  // 2. Clonar (o reutilizar si ya existe)
  const cloneRes = await getOrCloneSystemRoutine(userId, systemRoutineId, routineTitle);
  
  if (cloneRes.error || !cloneRes.data) {
    return { data: null, error: cloneRes.error || "Failed to clone routine" };
  }

  const clonedRoutineId = cloneRes.data.routineId;

  // 3. Crear la sesión de workout
  const sessionRes = await createWorkoutSession(userId, clonedRoutineId, meta);
  
  if (sessionRes.error || !sessionRes.data) {
    return { data: null, error: sessionRes.error || "Failed to create session" };
  }

  return {
    data: {
      session: sessionRes.data,
      clonedRoutineId,
    },
    error: null,
  };
}

// ============================================
// FINALIZE SESSION (ACTUALIZADO)
// Guarda label, source, program_key, day_key para el calendario
// ============================================

export type FinalizeSessionParams = {
  sessionId: string;
  userId: string;
  totalElapsedSec: number;
  // Nuevos campos para calendario
  source: "recommended" | "custom";
  label: string;           // Ej: "PPL · Pull", "Upper · A", "Custom · Brazos"
  programKey?: string;     // Ej: "PPL", "UPPER_LOWER", "FULL_BODY"
  dayKey?: string;         // Ej: "push", "pull", "upper_a"
  systemRoutineId?: string;
  userRoutineId?: string;
};

export async function finalizeWorkoutSession(
  params: FinalizeSessionParams
): Promise<{
  data: WorkoutSession | null;
  error: string | null;
}> {
  const {
    sessionId,
    userId,
    totalElapsedSec,
    source,
    label,
    programKey,
    dayKey,
    systemRoutineId,
    userRoutineId,
  } = params;

  const today = new Date().toISOString().split("T")[0];

  // Construir objeto de actualización dinámicamente
  // Solo incluir campos que sabemos que existen
  const updateData: Record<string, unknown> = {
    status: "FINISHED",
    finished_at: new Date().toISOString(),
    total_elapsed_sec: totalElapsedSec,
    duration_seconds: totalElapsedSec,
    workout_date: today,
    session_date: today,
    label: label,
    day_label: label,
    program_key: programKey || null,
    day_key: dayKey || null,
    system_routine_id: systemRoutineId || null,
    user_routine_id: userRoutineId || null,
    meta: {
      track: programKey || null,
      dayType: dayKey || null,
      source: source,
      finishedAt: new Date().toISOString(),
    },
  };

  // Intentar con source primero
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({ ...updateData, source: source })
    .eq("id", sessionId)
    .select()
    .single();

  // Si falla por source, intentar sin source
  if (error && error.message.includes("source")) {
    console.warn("[finalizeWorkoutSession] source column issue, trying without it");
    const { data: dataRetry, error: errorRetry } = await supabase
      .from("workout_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .select()
      .single();

    if (errorRetry) {
      console.error("[finalizeWorkoutSession] Error:", errorRetry);
      return { data: null, error: errorRetry.message };
    }

    return { data: dataRetry as WorkoutSession, error: null };
  }

  if (error) {
    console.error("[finalizeWorkoutSession] Error:", error);
    return { data: null, error: error.message };
  }

  // Actualizar last_completed_at en user_program_state
  const { error: stateError } = await supabase
    .from("user_program_state")
    .update({
      last_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (stateError) {
    console.error("[finalizeWorkoutSession] Error updating program state:", stateError);
  }

  // Marcar en el calendario como TRAINED
  const markResult = await markAsTrained(userId, sessionId);
  if (markResult.error) {
    console.error("[finalizeWorkoutSession] Error marking as trained:", markResult.error);
  }

  return { data: data as WorkoutSession, error: null };
}

// ============================================
// LEGACY: Para compatibilidad (DEPRECATED)
// ============================================

/** @deprecated Use finalizeWorkoutSession with params instead */
export async function finalizeWorkoutSessionLegacy(
  sessionId: string,
  totalElapsedSec: number,
  userId: string
): Promise<{
  data: WorkoutSession | null;
  error: string | null;
}> {
  const finishRes = await finishWorkoutSession(sessionId, totalElapsedSec);
  
  if (finishRes.error) {
    return finishRes;
  }

  // Actualizar last_completed_at en user_program_state
  const { error: stateError } = await supabase
    .from("user_program_state")
    .update({
      last_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (stateError) {
    console.error("Error updating program state:", stateError);
  }

  return finishRes;
}

// ============================================
// CREATE SESSION FROM USER ROUTINE
// ============================================

export async function createWorkoutSessionFromUserRoutine(
  userId: string,
  userRoutineId: string
): Promise<{
  data: { sessionId: string } | null;
  error: string | null;
}> {
  // Obtener título de la user_routine
  const { data: userRoutine, error: routineError } = await supabase
    .from("user_routines")
    .select("title")
    .eq("id", userRoutineId)
    .single();

  if (routineError || !userRoutine) {
    console.error("[createWorkoutSessionFromUserRoutine] Error fetching user routine:", routineError);
    return { data: null, error: "No se encontró la rutina" };
  }

  // Buscar si ya existe una rutina con este título
  const { data: existingRoutine } = await supabase
    .from("routines")
    .select("id")
    .eq("user_id", userId)
    .eq("title", userRoutine.title)
    .maybeSingle();

  let routineId: string;

  if (existingRoutine) {
    routineId = existingRoutine.id;
  } else {
    // Crear sin 'source' para evitar problemas de schema cache
    const { data: routine, error: createRoutineError } = await supabase
      .from("routines")
      .insert({
        user_id: userId,
        title: userRoutine.title,
        is_active: true,
      })
      .select("id")
      .single();

    if (createRoutineError || !routine) {
      console.error("[createWorkoutSessionFromUserRoutine] Error creating routine entry:", createRoutineError);
      return { data: null, error: "Error al preparar la sesión" };
    }
    
    routineId = routine.id;
  }

  // Crear la sesión SIN 'source' - se guarda en meta temporalmente
  // El source se agregará al finalizar la sesión
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      routine_id: routineId,
      started_at: new Date().toISOString(),
      status: "STARTED",
      total_elapsed_sec: 0,
      meta: {
        source: "custom",
        user_routine_id: userRoutineId,
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createWorkoutSessionFromUserRoutine] Error:", error);
    return { data: null, error: error.message };
  }

  return { data: { sessionId: data.id }, error: null };
}
