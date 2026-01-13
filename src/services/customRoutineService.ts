// ============================================
// CUSTOM ROUTINE SERVICE
// CRUD for user routines and custom exercises
// ============================================

import { supabase } from "./supabaseClient";

// ============================================
// TYPES
// ============================================

export type UserExercise = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  type: string | null;
  notes: string | null;
  instructions_short: string | null;
  expires_at: string | null;
  created_at: string;
};

export type CatalogExercise = {
  id: string;
  name: string;
  category: string | null;
  type: string | null;
  media_url: string | null;
  instructions_short: string | null;
};

export type SelectableExercise = {
  id: string;
  name: string;
  category: string | null;
  type: string | null;
  isCustom: boolean;
  isExpired?: boolean;
};

export type UserRoutine = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRoutineBlock = {
  id: string;
  user_routine_id: string;
  order_index: number;
  block_type: "WARMUP" | "STANDARD" | "FINISHER" | "CARDIO" | "REGEN";
  exercise_id: string | null;
  user_exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  seconds_per_rep: number | null;
  work_seconds: number | null;
  rest_seconds: number | null;
};

export type UserRoutineBlockWithExercise = UserRoutineBlock & {
  exercise_name: string | null;
  is_custom: boolean;
  is_expired: boolean;
};

// ============================================
// CONSTANTS
// ============================================

const MAX_ACTIVE_CUSTOM_EXERCISES = 5;
const MAX_EXERCISES_PER_ROUTINE = 12;
const CUSTOM_EXERCISE_EXPIRY_DAYS = 7;

export { MAX_ACTIVE_CUSTOM_EXERCISES, MAX_EXERCISES_PER_ROUTINE, CUSTOM_EXERCISE_EXPIRY_DAYS };

// ============================================
// MUSCLE GROUPS FOR UI (mapped from DB exercise_category enum)
// DB enum values: CHEST, BACK, LEGS_GLUTES, SHOULDERS, ARMS_BICEPS, ARMS_TRICEPS, CORE, CARDIO, MOBILITY
// ============================================

export const MUSCLE_GROUPS = [
  { key: "CHEST", label: "Pecho", dbCategory: "CHEST" },
  { key: "BACK", label: "Espalda", dbCategory: "BACK" },
  { key: "SHOULDERS", label: "Hombros", dbCategory: "SHOULDERS" },
  { key: "ARMS_BICEPS", label: "Bíceps", dbCategory: "ARMS_BICEPS" },
  { key: "ARMS_TRICEPS", label: "Tríceps", dbCategory: "ARMS_TRICEPS" },
  { key: "QUADS", label: "Cuádriceps", dbCategory: "LEGS_GLUTES" },
  { key: "HAMSTRINGS_GLUTES", label: "Isquios / Glúteos", dbCategory: "LEGS_GLUTES" },
  { key: "CORE", label: "Core", dbCategory: "CORE" },
  { key: "CARDIO", label: "Cardio", dbCategory: "CARDIO" },
  { key: "MOBILITY", label: "Movilidad", dbCategory: "MOBILITY" },
] as const;

// Keywords to split LEGS_GLUTES into Quads vs Hamstrings/Glutes
const QUAD_KEYWORDS = ["squat", "leg press", "leg extension", "lunge", "hack", "front squat", "sissy", "split squat"];
const HAMSTRING_GLUTE_KEYWORDS = ["romanian", "rdl", "deadlift", "leg curl", "hip thrust", "glute bridge", "hamstring", "good morning", "kickback"];

/**
 * Determine UI group key based on DB category and exercise name
 * Special handling for LEGS_GLUTES which splits into QUADS or HAMSTRINGS_GLUTES
 */
export function getUiGroupKey(category: string | null, exerciseName: string): string {
  if (!category) return "";
  
  const normalizedCategory = category.toUpperCase();
  
  if (normalizedCategory === "LEGS_GLUTES") {
    const nameLower = exerciseName.toLowerCase();
    
    if (HAMSTRING_GLUTE_KEYWORDS.some(kw => nameLower.includes(kw))) {
      return "HAMSTRINGS_GLUTES";
    }
    
    if (QUAD_KEYWORDS.some(kw => nameLower.includes(kw))) {
      return "QUADS";
    }
    
    return "QUADS";
  }
  
  const validCategories = ["CHEST", "BACK", "SHOULDERS", "ARMS_BICEPS", "ARMS_TRICEPS", "CORE", "CARDIO", "MOBILITY"];
  if (validCategories.includes(normalizedCategory)) {
    return normalizedCategory;
  }
  
  return "";
}

// Valid DB categories for the custom exercise modal dropdown
export const DB_EXERCISE_CATEGORIES = [
  { value: "CHEST", label: "Pecho" },
  { value: "BACK", label: "Espalda" },
  { value: "SHOULDERS", label: "Hombros" },
  { value: "ARMS_BICEPS", label: "Bíceps" },
  { value: "ARMS_TRICEPS", label: "Tríceps" },
  { value: "LEGS_GLUTES", label: "Piernas / Glúteos" },
  { value: "CORE", label: "Core" },
  { value: "CARDIO", label: "Cardio" },
  { value: "MOBILITY", label: "Movilidad" },
] as const;

// UI categories for the custom exercise modal (more granular)
// These map to DB categories but show separate options for legs
export const UI_EXERCISE_CATEGORIES = [
  { value: "CHEST", label: "Pecho", dbCategory: "CHEST" },
  { value: "BACK", label: "Espalda", dbCategory: "BACK" },
  { value: "SHOULDERS", label: "Hombros", dbCategory: "SHOULDERS" },
  { value: "ARMS_BICEPS", label: "Bíceps", dbCategory: "ARMS_BICEPS" },
  { value: "ARMS_TRICEPS", label: "Tríceps", dbCategory: "ARMS_TRICEPS" },
  { value: "QUADS", label: "Cuádriceps", dbCategory: "LEGS_GLUTES" },
  { value: "HAMSTRINGS_GLUTES", label: "Isquios / Glúteos", dbCategory: "LEGS_GLUTES" },
  { value: "CORE", label: "Core", dbCategory: "CORE" },
  { value: "CARDIO", label: "Cardio", dbCategory: "CARDIO" },
  { value: "MOBILITY", label: "Movilidad", dbCategory: "MOBILITY" },
] as const;

// Helper to get DB category from UI category
export function getDbCategoryFromUi(uiCategory: string): string {
  const found = UI_EXERCISE_CATEGORIES.find(c => c.value === uiCategory);
  return found?.dbCategory || uiCategory;
}

// Helper to get UI category from notes (if stored) or use getUiGroupKey
export function getUiCategoryFromExercise(
  category: string | null, 
  name: string, 
  notes: string | null
): string {
  // First check if UI category is stored in notes
  if (notes && notes.startsWith("ui_category:")) {
    return notes.replace("ui_category:", "");
  }
  // Otherwise use the standard logic
  return getUiGroupKey(category, name);
}

// ============================================
// CATALOG EXERCISES
// ============================================

export async function getCatalogExercises(): Promise<{
  data: CatalogExercise[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, category, type, media_url, instructions_short")
    .eq("is_system", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[getCatalogExercises] Error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as CatalogExercise[], error: null };
}

// ============================================
// USER CUSTOM EXERCISES
// ============================================

export async function getActiveCustomExercises(userId: string): Promise<{
  data: UserExercise[] | null;
  error: string | null;
}> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from("user_exercises")
    .select("*")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getActiveCustomExercises] Error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as UserExercise[], error: null };
}

export async function getActiveCustomExerciseCount(userId: string): Promise<{
  count: number;
  error: string | null;
}> {
  const now = new Date().toISOString();
  
  const { count, error } = await supabase
    .from("user_exercises")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error) {
    console.error("[getActiveCustomExerciseCount] Error:", error);
    return { count: 0, error: error.message };
  }

  return { count: count || 0, error: null };
}

export async function createCustomExercise(
  userId: string,
  name: string,
  category: string | null,
  type?: string | null
): Promise<{
  data: UserExercise | null;
  error: string | null;
}> {
  const { count, error: countError } = await getActiveCustomExerciseCount(userId);
  if (countError) {
    return { data: null, error: countError };
  }

  if (count >= MAX_ACTIVE_CUSTOM_EXERCISES) {
    return { 
      data: null, 
      error: `Plan Free: máximo ${MAX_ACTIVE_CUSTOM_EXERCISES} ejercicios custom activos. Espera a que expiren o elimina algunos.` 
    };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CUSTOM_EXERCISE_EXPIRY_DAYS);

  // type es NOT NULL en la BD, usar "FREE_WEIGHT" como valor por defecto
  const exerciseType = type || "FREE_WEIGHT";

  // Mapear categoría UI a categoría de BD
  const uiCategory = category || "CHEST";
  const dbCategory = getDbCategoryFromUi(uiCategory);
  
  // Guardar la categoría UI en notes si es diferente de la de BD
  // Esto permite recuperar QUADS vs HAMSTRINGS_GLUTES
  const notes = uiCategory !== dbCategory ? `ui_category:${uiCategory}` : null;

  const { data, error } = await supabase
    .from("user_exercises")
    .insert({
      user_id: userId,
      name: name.trim(),
      category: dbCategory,
      type: exerciseType,
      notes: notes,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[createCustomExercise] Error:", error);
    
    // Mensaje amigable para duplicados
    if (error.message.includes("unique") || error.code === "23505") {
      return { data: null, error: "Ya tienes un ejercicio con ese nombre" };
    }
    
    return { data: null, error: error.message };
  }

  return { data: data as UserExercise, error: null };
}

export async function deleteCustomExercise(exerciseId: string): Promise<{
  error: string | null;
}> {
  const { error } = await supabase
    .from("user_exercises")
    .delete()
    .eq("id", exerciseId);

  if (error) {
    console.error("[deleteCustomExercise] Error:", error);
    return { error: error.message };
  }

  return { error: null };
}

// ============================================
// COMBINED EXERCISE LIST FOR BUILDER
// ============================================

export async function getSelectableExercises(userId: string): Promise<{
  data: SelectableExercise[] | null;
  error: string | null;
}> {
  // Fetch catalog exercises
  const [catalogRes, customRes] = await Promise.all([
    getCatalogExercises(),
    getActiveCustomExercises(userId),
  ]);

  if (catalogRes.error) {
    return { data: null, error: catalogRes.error };
  }

  const now = new Date();
  const catalog: SelectableExercise[] = (catalogRes.data || []).map(ex => ({
    id: ex.id,
    name: ex.name,
    category: getUiGroupKey(ex.category, ex.name),
    type: ex.type,
    isCustom: false,
  }));

  const custom: SelectableExercise[] = (customRes.data || []).map(ex => ({
    id: ex.id,
    name: ex.name,
    category: getUiCategoryFromExercise(ex.category, ex.name, ex.notes),
    type: ex.type,
    isCustom: true,
    isExpired: ex.expires_at ? new Date(ex.expires_at) < now : false,
  }));

  // Custom first, then catalog
  return { data: [...custom, ...catalog], error: null };
}

// ============================================
// USER ROUTINES
// ============================================

export async function getUserRoutines(userId: string): Promise<{
  data: UserRoutine[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("user_routines")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[getUserRoutines] Error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as UserRoutine[], error: null };
}

export async function getUserRoutine(routineId: string): Promise<{
  data: UserRoutine | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("user_routines")
    .select("*")
    .eq("id", routineId)
    .maybeSingle();

  if (error) {
    console.error("[getUserRoutine] Error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as UserRoutine | null, error: null };
}

export async function createUserRoutine(
  userId: string,
  title: string
): Promise<{
  data: UserRoutine | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("user_routines")
    .insert({
      user_id: userId,
      title: title.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("[createUserRoutine] Error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as UserRoutine, error: null };
}

export async function updateUserRoutine(
  routineId: string,
  updates: { title?: string; description?: string }
): Promise<{
  data: UserRoutine | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("user_routines")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", routineId)
    .select()
    .single();

  if (error) {
    console.error("[updateUserRoutine] Error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as UserRoutine, error: null };
}

export async function deleteUserRoutine(routineId: string): Promise<{
  error: string | null;
}> {
  const { error } = await supabase
    .from("user_routines")
    .delete()
    .eq("id", routineId);

  if (error) {
    console.error("[deleteUserRoutine] Error:", error);
    return { error: error.message };
  }

  return { error: null };
}

// ============================================
// USER ROUTINE BLOCKS
// ============================================

export async function getUserRoutineBlocks(routineId: string): Promise<{
  data: UserRoutineBlockWithExercise[] | null;
  error: string | null;
}> {
  const now = new Date().toISOString();

  const { data: blocks, error: blocksError } = await supabase
    .from("user_routine_blocks")
    .select("*")
    .eq("user_routine_id", routineId)
    .order("order_index", { ascending: true });

  if (blocksError) {
    console.error("[getUserRoutineBlocks] Error:", blocksError);
    return { data: null, error: blocksError.message };
  }

  if (!blocks || blocks.length === 0) {
    return { data: [], error: null };
  }

  const catalogIds = blocks
    .filter(b => b.exercise_id)
    .map(b => b.exercise_id);
  
  const customIds = blocks
    .filter(b => b.user_exercise_id)
    .map(b => b.user_exercise_id);

  let catalogMap: Record<string, string> = {};
  let customMap: Record<string, { name: string; expires_at: string | null }> = {};

  if (catalogIds.length > 0) {
    const { data: catalogExercises } = await supabase
      .from("exercises")
      .select("id, name")
      .in("id", catalogIds);
    
    if (catalogExercises) {
      for (const ex of catalogExercises) {
        catalogMap[ex.id] = ex.name;
      }
    }
  }

  if (customIds.length > 0) {
    const { data: customExercises } = await supabase
      .from("user_exercises")
      .select("id, name, expires_at")
      .in("id", customIds);
    
    if (customExercises) {
      for (const ex of customExercises) {
        customMap[ex.id] = { name: ex.name, expires_at: ex.expires_at };
      }
    }
  }

  const result: UserRoutineBlockWithExercise[] = blocks.map(block => {
    let exerciseName: string | null = null;
    let isCustom = false;
    let isExpired = false;

    if (block.exercise_id && catalogMap[block.exercise_id]) {
      exerciseName = catalogMap[block.exercise_id];
      isCustom = false;
    } else if (block.user_exercise_id && customMap[block.user_exercise_id]) {
      const custom = customMap[block.user_exercise_id];
      exerciseName = custom.name;
      isCustom = true;
      isExpired = custom.expires_at ? new Date(custom.expires_at) < new Date(now) : false;
    }

    return {
      ...block,
      exercise_name: exerciseName,
      is_custom: isCustom,
      is_expired: isExpired,
    } as UserRoutineBlockWithExercise;
  });

  return { data: result, error: null };
}

export async function createUserRoutineBlocks(
  routineId: string,
  exercises: { id: string; isCustom: boolean }[],
  includeWarmup: boolean = true
): Promise<{
  error: string | null;
}> {
  const blocks: Record<string, unknown>[] = [];
  let orderIndex = 1;

  if (includeWarmup) {
    // WARMUP usa SYSTEM como ref_type (el constraint lo permite)
    blocks.push({
      user_routine_id: routineId,
      order_index: orderIndex++,
      block_type: "WARMUP",
      exercise_id: null,
      user_exercise_id: null,
      exercise_ref_type: "SYSTEM",
      sets: 1,
      reps: null,
      seconds_per_rep: null,
      work_seconds: 300,
      rest_seconds: 60,
    });
  }

  for (const ex of exercises) {
    blocks.push({
      user_routine_id: routineId,
      order_index: orderIndex++,
      block_type: "STANDARD",
      exercise_id: ex.isCustom ? null : ex.id,
      user_exercise_id: ex.isCustom ? ex.id : null,
      exercise_ref_type: ex.isCustom ? "USER" : "SYSTEM",
      sets: 3,
      reps: 10,
      seconds_per_rep: 2,
      work_seconds: null,
      rest_seconds: 60,
    });
  }

  const { error } = await supabase
    .from("user_routine_blocks")
    .insert(blocks);

  if (error) {
    console.error("[createUserRoutineBlocks] Error:", error);
    return { error: error.message };
  }

  return { error: null };
}

export async function updateUserRoutineBlock(
  blockId: string,
  updates: {
    sets?: number;
    reps?: number;
    rest_seconds?: number;
    work_seconds?: number;
    seconds_per_rep?: number;
  }
): Promise<{
  error: string | null;
}> {
  const { error } = await supabase
    .from("user_routine_blocks")
    .update(updates)
    .eq("id", blockId);

  if (error) {
    console.error("[updateUserRoutineBlock] Error:", error);
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteUserRoutineBlock(blockId: string): Promise<{
  error: string | null;
}> {
  const { error } = await supabase
    .from("user_routine_blocks")
    .delete()
    .eq("id", blockId);

  if (error) {
    console.error("[deleteUserRoutineBlock] Error:", error);
    return { error: error.message };
  }

  return { error: null };
}

export async function replaceBlockExercise(
  blockId: string,
  newExerciseId: string,
  isCustom: boolean
): Promise<{
  error: string | null;
}> {
  const updates = isCustom
    ? { exercise_id: null, user_exercise_id: newExerciseId, exercise_ref_type: "USER" }
    : { exercise_id: newExerciseId, user_exercise_id: null, exercise_ref_type: "SYSTEM" };

  const { error } = await supabase
    .from("user_routine_blocks")
    .update(updates)
    .eq("id", blockId);

  if (error) {
    console.error("[replaceBlockExercise] Error:", error);
    return { error: error.message };
  }

  return { error: null };
}

// ============================================
// REORDER BLOCKS
// ============================================

/**
 * Swap the order_index of two specific blocks
 * Uses a temporary negative value to avoid unique constraint violation
 */
export async function swapBlocks(
  blockId1: string,
  blockId2: string
): Promise<{
  error: string | null;
}> {
  // Get the two blocks
  const { data: blocks, error: fetchError } = await supabase
    .from("user_routine_blocks")
    .select("id, order_index")
    .in("id", [blockId1, blockId2]);

  if (fetchError) {
    console.error("[swapBlocks] Fetch error:", fetchError);
    return { error: fetchError.message };
  }

  if (!blocks || blocks.length !== 2) {
    return { error: "No se encontraron los bloques" };
  }

  const block1 = blocks.find(b => b.id === blockId1);
  const block2 = blocks.find(b => b.id === blockId2);

  if (!block1 || !block2) {
    return { error: "Bloque no encontrado" };
  }

  // Use a 3-step swap to avoid unique constraint violation
  const tempValue = -9999;

  // Step 1: Move block1 to temp
  const { error: error1 } = await supabase
    .from("user_routine_blocks")
    .update({ order_index: tempValue })
    .eq("id", block1.id);

  if (error1) {
    console.error("[swapBlocks] Step 1 error:", error1);
    return { error: error1.message };
  }

  // Step 2: Move block2 to block1's position
  const { error: error2 } = await supabase
    .from("user_routine_blocks")
    .update({ order_index: block1.order_index })
    .eq("id", block2.id);

  if (error2) {
    console.error("[swapBlocks] Step 2 error:", error2);
    // Rollback step 1
    await supabase
      .from("user_routine_blocks")
      .update({ order_index: block1.order_index })
      .eq("id", block1.id);
    return { error: error2.message };
  }

  // Step 3: Move block1 to block2's position
  const { error: error3 } = await supabase
    .from("user_routine_blocks")
    .update({ order_index: block2.order_index })
    .eq("id", block1.id);

  if (error3) {
    console.error("[swapBlocks] Step 3 error:", error3);
    return { error: error3.message };
  }

  return { error: null };
}

/**
 * Reorder blocks by swapping two adjacent blocks
 * Uses a temporary negative value to avoid unique constraint violation
 * @param routineId - The routine ID
 * @param blockId - The block to move
 * @param direction - "up" or "down"
 */
export async function reorderBlock(
  routineId: string,
  blockId: string,
  direction: "up" | "down"
): Promise<{
  error: string | null;
}> {
  // Get current blocks (excluding warmup for reordering)
  const { data: blocks, error: fetchError } = await supabase
    .from("user_routine_blocks")
    .select("id, order_index, block_type")
    .eq("user_routine_id", routineId)
    .neq("block_type", "WARMUP")
    .order("order_index", { ascending: true });

  if (fetchError) {
    console.error("[reorderBlock] Fetch error:", fetchError);
    return { error: fetchError.message };
  }

  if (!blocks || blocks.length < 2) {
    return { error: null }; // Nothing to reorder
  }

  // Find current index within non-warmup blocks
  const currentIdx = blocks.findIndex(b => b.id === blockId);
  if (currentIdx === -1) {
    return { error: "Bloque no encontrado" };
  }

  // Calculate target index
  const targetIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;

  // Check bounds
  if (targetIdx < 0 || targetIdx >= blocks.length) {
    return { error: null }; // Can't move further, not an error
  }

  const currentBlock = blocks[currentIdx];
  const targetBlock = blocks[targetIdx];

  // Use swapBlocks
  return swapBlocks(currentBlock.id, targetBlock.id);
}

/**
 * Reorder multiple blocks at once (batch update)
 * @param updates - Array of { id, order_index }
 */
export async function reorderBlocksBatch(
  updates: { id: string; order_index: number }[]
): Promise<{
  error: string | null;
}> {
  // Update each block's order_index
  for (const update of updates) {
    const { error } = await supabase
      .from("user_routine_blocks")
      .update({ order_index: update.order_index })
      .eq("id", update.id);

    if (error) {
      console.error("[reorderBlocksBatch] Error:", error);
      return { error: error.message };
    }
  }

  return { error: null };
}

// ============================================
// FULL ROUTINE CREATION FLOW
// ============================================

export async function createRoutineWithExercises(
  userId: string,
  title: string,
  exercises: { id: string; isCustom: boolean }[],
  includeWarmup: boolean = true
): Promise<{
  data: UserRoutine | null;
  error: string | null;
}> {
  if (exercises.length > MAX_EXERCISES_PER_ROUTINE) {
    return { 
      data: null, 
      error: `Máximo ${MAX_EXERCISES_PER_ROUTINE} ejercicios por rutina` 
    };
  }

  if (exercises.length === 0) {
    return { data: null, error: "Selecciona al menos 1 ejercicio" };
  }

  const routineRes = await createUserRoutine(userId, title);
  if (routineRes.error || !routineRes.data) {
    return { data: null, error: routineRes.error };
  }

  const blocksRes = await createUserRoutineBlocks(
    routineRes.data.id,
    exercises,
    includeWarmup
  );

  if (blocksRes.error) {
    await deleteUserRoutine(routineRes.data.id);
    return { data: null, error: blocksRes.error };
  }

  return { data: routineRes.data, error: null };
}

// ============================================
// CHECK FOR EXPIRED EXERCISES IN ROUTINE
// ============================================

export async function routineHasExpiredExercises(routineId: string): Promise<{
  hasExpired: boolean;
  expiredCount: number;
  error: string | null;
}> {
  const blocksRes = await getUserRoutineBlocks(routineId);
  if (blocksRes.error) {
    return { hasExpired: false, expiredCount: 0, error: blocksRes.error };
  }

  const expiredCount = blocksRes.data?.filter(b => b.is_expired).length || 0;
  
  return { 
    hasExpired: expiredCount > 0, 
    expiredCount, 
    error: null 
  };
}

// ============================================
// ADD EXERCISE TO EXISTING ROUTINE
// ============================================

export async function addExerciseToRoutine(
  routineId: string,
  exerciseId: string,
  isCustom: boolean
): Promise<{
  data: UserRoutineBlock | null;
  error: string | null;
}> {
  // 1. Contar ejercicios actuales (excluyendo warmup)
  const blocksRes = await getUserRoutineBlocks(routineId);
  if (blocksRes.error) {
    return { data: null, error: blocksRes.error };
  }

  const currentBlocks = blocksRes.data || [];
  const nonWarmupBlocks = currentBlocks.filter(b => b.block_type !== "WARMUP");
  
  if (nonWarmupBlocks.length >= MAX_EXERCISES_PER_ROUTINE) {
    return { 
      data: null, 
      error: `Máximo ${MAX_EXERCISES_PER_ROUTINE} ejercicios por rutina` 
    };
  }

  // 2. Obtener el mayor order_index
  const maxOrderIndex = currentBlocks.length > 0 
    ? Math.max(...currentBlocks.map(b => b.order_index))
    : 0;

  // 3. Crear el nuevo bloque
  const newBlock = {
    user_routine_id: routineId,
    order_index: maxOrderIndex + 1,
    block_type: "STANDARD" as const,
    exercise_id: isCustom ? null : exerciseId,
    user_exercise_id: isCustom ? exerciseId : null,
    exercise_ref_type: isCustom ? "USER" : "SYSTEM",
    sets: 3,
    reps: 10,
    seconds_per_rep: 2,
    work_seconds: null,
    rest_seconds: 60,
  };

  const { data, error } = await supabase
    .from("user_routine_blocks")
    .insert(newBlock)
    .select()
    .single();

  if (error) {
    console.error("[addExerciseToRoutine] Error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as UserRoutineBlock, error: null };
}

// ============================================
// GET ROUTINE EXERCISE COUNT
// ============================================

export async function getRoutineExerciseCount(routineId: string): Promise<{
  count: number;
  maxAllowed: number;
  error: string | null;
}> {
  const blocksRes = await getUserRoutineBlocks(routineId);
  if (blocksRes.error) {
    return { count: 0, maxAllowed: MAX_EXERCISES_PER_ROUTINE, error: blocksRes.error };
  }

  const nonWarmupCount = blocksRes.data?.filter(b => b.block_type !== "WARMUP").length || 0;
  
  return { 
    count: nonWarmupCount, 
    maxAllowed: MAX_EXERCISES_PER_ROUTINE, 
    error: null 
  };
}
