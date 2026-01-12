// ============================================
// WORKOUT PAGE
// Container del WorkoutPlayer
// Pasa meta info para persistencia correcta
// ============================================

import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../services/supabaseClient";
import { getWorkoutSession, type WorkoutSession, type WorkoutMeta } from "../../services/workoutSessionService";
import type { BlockType } from "../../services/routineService";
import WorkoutPlayer from "./WorkoutPlayer";
import styles from "./WorkoutPage.module.css";

// Tipos
type RoutineBlock = {
  id: string;
  order_index: number;
  block_type: BlockType;
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  seconds_per_rep: number | null;
  work_seconds: number | null;
  rest_seconds: number | null;
  exercise?: {
    id: string;
    name: string;
    instructions_short: string | null;
  };
};

type SavedWorkoutData = {
  title?: string;
  blocks: RoutineBlock[];
  warmupSkipped?: boolean;
  // Nuevos campos para persistencia
  source?: "recommended" | "custom";
  programKey?: string;
  dayKey?: string;
  systemRoutineId?: string;
  userRoutineId?: string;
};

type LocationState = {
  workoutData?: SavedWorkoutData;
};

export default function WorkoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuthStore();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [routineTitle, setRoutineTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWarmup, setHasWarmup] = useState(false);
  const [warmupSkipped, setWarmupSkipped] = useState(false);
  
  // Meta info para persistencia
  const [workoutMeta, setWorkoutMeta] = useState<{
    source: "recommended" | "custom";
    programKey?: string;
    dayKey?: string;
    systemRoutineId?: string;
    userRoutineId?: string;
  }>({ source: "recommended" });

  useEffect(() => {
    const loadData = async () => {
      if (!sessionId || !user) return;

      setLoading(true);
      setError(null);

      // 1. Obtener sesión
      const sessionRes = await getWorkoutSession(sessionId);
      if (sessionRes.error || !sessionRes.data) {
        setError(sessionRes.error || "Sesión no encontrada");
        setLoading(false);
        return;
      }

      setSession(sessionRes.data);

      // Extraer meta de la sesión si existe
      const sessionMeta = sessionRes.data.meta as WorkoutMeta | null;
      if (sessionMeta) {
        setWorkoutMeta({
          source: sessionMeta.system_routine_id ? "recommended" : "custom",
          programKey: sessionMeta.track || undefined,
          dayKey: sessionMeta.day_type || undefined,
          systemRoutineId: sessionMeta.system_routine_id || undefined,
        });
        
        if (sessionMeta.warmup_skipped) {
          setWarmupSkipped(true);
        }
      }

      // 2. PRIORIDAD 1: Datos pasados via navigate state
      const locationState = location.state as LocationState | null;
      if (locationState?.workoutData) {
        console.log("Usando datos de navigation state");
        const { 
          title, 
          blocks: stateBlocks, 
          warmupSkipped: stateWarmupSkipped,
          source,
          programKey,
          dayKey,
          systemRoutineId,
          userRoutineId,
        } = locationState.workoutData;
        
        setBlocks(stateBlocks);
        setRoutineTitle(title || "Entrenamiento");
        
        if (stateWarmupSkipped !== undefined) {
          setWarmupSkipped(stateWarmupSkipped);
        }
        
        // Guardar meta del state
        if (source || programKey || dayKey) {
          setWorkoutMeta({
            source: source || "recommended",
            programKey,
            dayKey,
            systemRoutineId,
            userRoutineId,
          });
        }
        
        const warmupBlocks = stateBlocks.filter((b: RoutineBlock) => b.block_type === "WARMUP");
        setHasWarmup(warmupBlocks.length > 0);
        
        setLoading(false);
        return;
      }

      // 3. PRIORIDAD 2: Datos en localStorage
      const storageKey = `workout_blocks_${sessionId}`;
      const savedDataJson = localStorage.getItem(storageKey);
      
      if (savedDataJson) {
        try {
          console.log("Usando datos de localStorage");
          const savedData: SavedWorkoutData | RoutineBlock[] = JSON.parse(savedDataJson);
          
          let loadedBlocks: RoutineBlock[];
          let loadedTitle: string | null = null;
          
          if (Array.isArray(savedData)) {
            loadedBlocks = savedData;
          } else {
            loadedBlocks = savedData.blocks;
            loadedTitle = savedData.title || null;
            if (savedData.warmupSkipped !== undefined) {
              setWarmupSkipped(savedData.warmupSkipped);
            }
            // Cargar meta del localStorage
            if (savedData.source || savedData.programKey || savedData.dayKey) {
              setWorkoutMeta({
                source: savedData.source || "recommended",
                programKey: savedData.programKey,
                dayKey: savedData.dayKey,
                systemRoutineId: savedData.systemRoutineId,
                userRoutineId: savedData.userRoutineId,
              });
            }
          }
          
          setBlocks(loadedBlocks);
          
          if (loadedTitle) {
            setRoutineTitle(loadedTitle);
          } else {
            const { data: routineData } = await supabase
              .from("routines")
              .select("title")
              .eq("id", sessionRes.data.routine_id)
              .single();
            setRoutineTitle(routineData?.title || "Entrenamiento");
          }
          
          const warmupBlocks = loadedBlocks.filter((b: RoutineBlock) => b.block_type === "WARMUP");
          setHasWarmup(warmupBlocks.length > 0);
          
          setLoading(false);
          return;
        } catch (e) {
          console.error("Error parsing saved blocks", e);
        }
      }

      // 4. FALLBACK: Cargar desde DB
      console.log("No hay datos en state ni localStorage, cargando desde DB...");
      
      const { data: routineData, error: routineError } = await supabase
        .from("routines")
        .select("title")
        .eq("id", sessionRes.data.routine_id)
        .single();

      if (routineError) {
        setError(routineError.message);
        setLoading(false);
        return;
      }

      setRoutineTitle(routineData.title);

      const { data: blocksData, error: blocksError } = await supabase
        .from("routine_blocks")
        .select(`
          *,
          exercise:exercises(id, name, instructions_short)
        `)
        .eq("routine_id", sessionRes.data.routine_id)
        .order("order_index", { ascending: true });

      if (blocksError) {
        setError(blocksError.message);
        setLoading(false);
        return;
      }

      setBlocks(blocksData as RoutineBlock[]);

      const warmupBlocks = blocksData.filter((b: RoutineBlock) => b.block_type === "WARMUP");
      setHasWarmup(warmupBlocks.length > 0);

      setLoading(false);
    };

    loadData();

    // Cleanup localStorage al desmontar
    return () => {
      if (sessionId) {
        localStorage.removeItem(`workout_blocks_${sessionId}`);
      }
    };
  }, [sessionId, user, location.state]);

  const handleExit = () => {
    navigate("/");
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <span className={styles.spinner}></span>
          <p>Preparando tu entrenamiento...</p>
        </div>
      </div>
    );
  }

  if (error || !session || !user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorBanner}>
            <span>⚠️</span>
            {error || "Error al cargar la sesión"}
          </div>
          <button className={styles.secondaryBtn} onClick={handleExit}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <WorkoutPlayer
      sessionId={session.id}
      userId={user.id}
      routineTitle={routineTitle}
      blocks={blocks}
      hasWarmup={hasWarmup && !warmupSkipped}
      initialSkipWarmup={warmupSkipped}
      // Nuevos props para persistencia
      source={workoutMeta.source}
      programKey={workoutMeta.programKey}
      dayKey={workoutMeta.dayKey}
      systemRoutineId={workoutMeta.systemRoutineId}
      userRoutineId={workoutMeta.userRoutineId}
    />
  );
}
