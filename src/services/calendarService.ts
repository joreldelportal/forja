import { supabase } from "./supabaseClient";

// ============================================
// TIPOS
// ============================================

export type CalendarMarkType = "TRAINED" | "REST" | "ACTIVE_REST";

export type CalendarMark = {
  id: string;
  user_id: string;
  date: string;
  mark_type: CalendarMarkType;
  source_session_id: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// FUNCIONES
// ============================================

export async function getWeekMarks(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{
  data: CalendarMark[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("calendar_marks")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as CalendarMark[], error: null };
}

export async function upsertMark(
  userId: string,
  date: string,
  markType: CalendarMarkType,
  sourceSessionId?: string
): Promise<{
  data: CalendarMark | null;
  error: string | null;
}> {
  // Primero intentamos buscar si ya existe una marca para ese día
  const { data: existing } = await supabase
    .from("calendar_marks")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    // Actualizar
    const { data, error } = await supabase
      .from("calendar_marks")
      .update({
        mark_type: markType,
        source_session_id: sourceSessionId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as CalendarMark, error: null };
  }

  // Insertar
  const { data, error } = await supabase
    .from("calendar_marks")
    .insert({
      user_id: userId,
      date,
      mark_type: markType,
      source_session_id: sourceSessionId ?? null,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as CalendarMark, error: null };
}

export async function markAsTrained(
  userId: string,
  sessionId: string
): Promise<{
  data: CalendarMark | null;
  error: string | null;
}> {
  const today = new Date().toISOString().split("T")[0];
  return upsertMark(userId, today, "TRAINED", sessionId);
}

export async function getStreak(userId: string): Promise<{
  data: { streak: number; trainedThisWeek: number } | null;
  error: string | null;
}> {
  // Obtener marcas de los últimos 30 días
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const { data, error } = await supabase
    .from("calendar_marks")
    .select("date, mark_type")
    .eq("user_id", userId)
    .eq("mark_type", "TRAINED")
    .gte("date", startDate.toISOString().split("T")[0])
    .lte("date", endDate.toISOString().split("T")[0])
    .order("date", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  // Calcular racha
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trainedDates = new Set((data || []).map((m) => m.date));

  // Empezar desde hoy y contar días consecutivos
  const checkDate = new Date(today);
  
  // Si hoy no está marcado, empezar desde ayer
  if (!trainedDates.has(checkDate.toISOString().split("T")[0])) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (trainedDates.has(checkDate.toISOString().split("T")[0])) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Calcular entrenos esta semana
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Domingo
  
  let trainedThisWeek = 0;
  (data || []).forEach((m) => {
    const markDate = new Date(m.date);
    if (markDate >= weekStart && markDate <= today) {
      trainedThisWeek++;
    }
  });

  return { data: { streak, trainedThisWeek }, error: null };
}
