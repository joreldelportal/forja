// ============================================
// workoutSessionStorage.ts
// Persistencia local de sesiones de workout
// para sobrevivir background/crashes en iOS PWA
// ============================================

const STORAGE_PREFIX = "forja_workout_session_";
const MAX_SESSION_AGE_MS = 4 * 60 * 60 * 1000; // 4 horas

// ============================================
// TIPOS
// ============================================

export type PersistedSessionStatus = "RUNNING" | "PAUSED";

export type PersistedWorkoutSession = {
  sessionId: string;
  status: PersistedSessionStatus;
  currentStepIndex: number;
  skipWarmup: boolean;
  stepsSignature: string;
  
  // Timestamps para cálculo preciso
  workoutStartedAtMs: number;      // Cuando inició el workout
  totalAccumulatedMs: number;      // Tiempo activo total acumulado (sin pausas)
  stepStartedAtMs: number;         // Cuando inició el step actual
  stepOriginalDurationSec: number; // Duración original del step
  stepAccumulatedMs: number;       // Tiempo activo en este step
  
  updatedAtMs: number;
};

// ============================================
// HELPERS
// ============================================

/**
 * Genera una firma única de los bloques para detectar si la rutina cambió
 */
export function generateStepsSignature(
  blocks: Array<{ id: string }>,
  skipWarmup: boolean
): string {
  const ids = blocks.map(b => b.id).join(",");
  return `${skipWarmup ? "skip" : "warm"}_${blocks.length}_${ids}`;
}

/**
 * Verifica si una sesión es demasiado vieja
 */
export function isSessionStale(
  updatedAtMs: number,
  maxAgeMs: number = MAX_SESSION_AGE_MS
): boolean {
  return Date.now() - updatedAtMs > maxAgeMs;
}

/**
 * Obtiene la key de storage para un sessionId
 */
function getStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Carga una sesión persistida del localStorage
 */
export function loadWorkoutSession(
  sessionId: string
): PersistedWorkoutSession | null {
  try {
    const key = getStorageKey(sessionId);
    console.log("[workoutSessionStorage] Loading from key:", key);
    
    const stored = localStorage.getItem(key);
    console.log("[workoutSessionStorage] Raw stored value:", stored ? `${stored.substring(0, 100)}...` : null);
    
    if (!stored) {
      console.log("[workoutSessionStorage] No stored session found");
      return null;
    }
    
    const parsed = JSON.parse(stored) as PersistedWorkoutSession;
    console.log("[workoutSessionStorage] Parsed session:", { sessionId: parsed.sessionId, status: parsed.status, stepIndex: parsed.currentStepIndex });
    
    // Validar que tenga los campos necesarios
    if (
      !parsed.sessionId ||
      !parsed.status ||
      typeof parsed.currentStepIndex !== "number" ||
      typeof parsed.skipWarmup !== "boolean" ||
      !parsed.stepsSignature ||
      typeof parsed.workoutStartedAtMs !== "number" ||
      typeof parsed.updatedAtMs !== "number"
    ) {
      console.warn("[workoutSessionStorage] Invalid session data, clearing");
      clearWorkoutSession(sessionId);
      return null;
    }
    
    // Verificar si es muy vieja
    if (isSessionStale(parsed.updatedAtMs)) {
      console.warn("[workoutSessionStorage] Session is stale, clearing");
      clearWorkoutSession(sessionId);
      return null;
    }
    
    console.log("[workoutSessionStorage] Valid session found!");
    return parsed;
  } catch (error) {
    console.error("[workoutSessionStorage] Error loading session:", error);
    return null;
  }
}

/**
 * Guarda una sesión en localStorage
 */
export function saveWorkoutSession(
  sessionId: string,
  data: PersistedWorkoutSession
): void {
  try {
    const key = getStorageKey(sessionId);
    const toStore: PersistedWorkoutSession = {
      ...data,
      updatedAtMs: Date.now(),
    };
    console.log("[workoutSessionStorage] Saving to key:", key, { status: toStore.status, stepIndex: toStore.currentStepIndex });
    localStorage.setItem(key, JSON.stringify(toStore));
    console.log("[workoutSessionStorage] Saved successfully!");
  } catch (error) {
    console.error("[workoutSessionStorage] Error saving session:", error);
  }
}

/**
 * Elimina una sesión del localStorage
 */
export function clearWorkoutSession(sessionId: string): void {
  try {
    const key = getStorageKey(sessionId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error("[workoutSessionStorage] Error clearing session:", error);
  }
}

/**
 * Limpia todas las sesiones viejas (mantenimiento)
 */
export function cleanupStaleSessions(): void {
  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as PersistedWorkoutSession;
            if (isSessionStale(parsed.updatedAtMs)) {
              keysToRemove.push(key);
            }
          } catch {
            // JSON inválido, eliminar
            keysToRemove.push(key);
          }
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (keysToRemove.length > 0) {
      console.log(`[workoutSessionStorage] Cleaned up ${keysToRemove.length} stale sessions`);
    }
  } catch (error) {
    console.error("[workoutSessionStorage] Error cleaning up sessions:", error);
  }
}

// ============================================
// HELPERS PARA CÁLCULOS DE TIEMPO
// ============================================

/**
 * Calcula el tiempo restante del step actual basado en timestamps
 */
export function calculateStepRemaining(
  session: PersistedWorkoutSession,
  nowMs: number = Date.now()
): number {
  const { stepOriginalDurationSec, stepStartedAtMs, stepAccumulatedMs, status } = session;
  
  // Tiempo total que debería durar el step en ms
  const stepDurationMs = stepOriginalDurationSec * 1000;
  
  // Si está pausado, el tiempo acumulado es lo que cuenta
  if (status === "PAUSED") {
    const remainingMs = stepDurationMs - stepAccumulatedMs;
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }
  
  // Si está corriendo, calcular con el tiempo actual
  const currentStepElapsedMs = stepAccumulatedMs + (nowMs - stepStartedAtMs);
  const remainingMs = stepDurationMs - currentStepElapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Calcula el tiempo total transcurrido del workout
 */
export function calculateTotalElapsed(
  session: PersistedWorkoutSession,
  nowMs: number = Date.now()
): number {
  const { totalAccumulatedMs, workoutStartedAtMs, status } = session;
  
  if (status === "PAUSED") {
    return Math.floor(totalAccumulatedMs / 1000);
  }
  
  // Si está corriendo, añadir el tiempo desde el último resume
  const currentRunMs = nowMs - workoutStartedAtMs;
  return Math.floor((totalAccumulatedMs + currentRunMs) / 1000);
}
