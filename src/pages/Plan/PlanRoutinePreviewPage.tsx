import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  fetchSystemRoutineWithBlocks,
  type RoutineWithBlocks,
  type SystemRoutineBlock,
  type BlockType,
  type ProgramDayWorkout,
} from "../../services/routineService";
import {
  createWorkoutSessionFromSystemRoutine,
  type WorkoutMeta,
} from "../../services/workoutSessionService";
import {
  assignAndAdvance,
  buildWorkoutMeta,
  getOrInitProgramState,
  type Assignment,
} from "../../lib/routineEngine";
import { getMyProfile } from "../../services/profileService";
import styles from "./PlanRoutinePreviewPage.module.css";

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  WARMUP: "Calentamiento",
  STANDARD: "Principal",
  FINISHER: "Finisher",
  CARDIO: "Cardio",
  REGEN: "Recuperación",
};

const BLOCK_TYPE_ICONS: Record<BlockType, string> = {
  WARMUP: "🔥",
  STANDARD: "💪",
  FINISHER: "⚡",
  CARDIO: "🏃",
  REGEN: "🧘",
};

const SECONDS_PER_REP = 2;
const MAX_SETS_WARNING = 6;
const MAX_REPS_WARNING = 15;

type EditableBlock = SystemRoutineBlock & {
  isEditing?: boolean;
  editSets: number;
  editReps: number;
  editRestSeconds: number;
  showSetsWarning?: boolean;
  showRepsWarning?: boolean;
};

type LocationState = {
  assignment?: Assignment;
  fromEngine?: boolean;
  programDayWorkout?: ProgramDayWorkout;
};

export default function PlanRoutinePreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const [routine, setRoutine] = useState<RoutineWithBlocks | null>(null);
  const [editableBlocks, setEditableBlocks] = useState<EditableBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [skipWarmup, setSkipWarmup] = useState(false);

  const [assignment, setAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    const fetchRoutine = async () => {
      if (!id || !user) {
        setError("ID de rutina no válido");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const locationState = location.state as LocationState | null;
      if (locationState?.assignment) {
        setAssignment(locationState.assignment);
      }

      // Si tenemos programDayWorkout del state, usarlo directamente
      // IMPORTANTE: Para PPL, esto es OBLIGATORIO - no hay fallback
      if (locationState?.programDayWorkout) {
        const workout = locationState.programDayWorkout;
        
        console.log("[PlanRoutinePreviewPage] Using programDayWorkout from state:", {
          routineId: workout.routineId,
          routineTitle: workout.routineTitle,
          blockCount: workout.blocks.length,
        });
        
        // Convertir ProgramDayWorkout blocks a SystemRoutineBlock format
        const convertedBlocks: SystemRoutineBlock[] = workout.blocks.map((block, idx) => ({
          id: `${block.system_routine_id}-${idx}`,
          system_routine_id: block.system_routine_id,
          order_index: block.order_index,
          block_type: block.block_type,
          exercise_id: block.exercise_id,
          sets: block.sets,
          reps: block.reps,
          seconds_per_rep: block.seconds_per_rep,
          work_seconds: block.work_seconds,
          rest_seconds: block.rest_seconds,
          exercise: block.exercise_id ? {
            id: block.exercise_id,
            name: block.exercise_name || "Ejercicio",
            category: "",
            type: "",
            media_url: null,
            instructions_short: null,
          } : undefined,
        }));

        setRoutine({
          id: workout.routineId,
          title: workout.routineTitle,
          description: null,
          target_priority: "AESTHETICS",
          target_context: "GYM",
          estimated_duration_sec: workout.estimatedDurationSec,
          created_at: new Date().toISOString(),
          blocks: convertedBlocks,
        });

        setEditableBlocks(
          convertedBlocks.map((block) => ({
            ...block,
            isEditing: false,
            editSets: block.sets || 1,
            editReps: block.reps || 0,
            editRestSeconds: block.rest_seconds || 60,
            showSetsWarning: false,
            showRepsWarning: false,
          }))
        );
        setLoading(false);
        return;
      }

      // Si es PPL y no tenemos programDayWorkout, es un error
      // No debemos hacer fallback porque cargaría la rutina incorrecta
      if (locationState?.assignment?.track === "PPL") {
        console.error("[PlanRoutinePreviewPage] PPL requires programDayWorkout but none provided");
        setError("Error: datos de rutina PPL no disponibles. Por favor vuelve a la pantalla anterior.");
        setLoading(false);
        return;
      }

      // Fallback: fetch de la DB (solo para tracks que NO son PPL)
      console.log("[PlanRoutinePreviewPage] Fallback: fetching from DB for id:", id);
      const res = await fetchSystemRoutineWithBlocks(id);
      if (res.error || !res.data) {
        setError(res.error || "Rutina no encontrada");
        setLoading(false);
        return;
      }

      setRoutine(res.data);
      setEditableBlocks(
        res.data.blocks.map((block) => ({
          ...block,
          isEditing: false,
          editSets: block.sets || 1,
          editReps: block.reps || 0,
          editRestSeconds: block.rest_seconds || 60,
          showSetsWarning: false,
          showRepsWarning: false,
        }))
      );
      setLoading(false);
    };

    fetchRoutine();
  }, [id, user, location.state]);

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}min` : `${hrs}h`;
  };

  const calculateBlockDuration = (block: EditableBlock) => {
    const sets = block.editSets;
    const reps = block.editReps;
    const restSeconds = block.editRestSeconds;
    
    if (block.work_seconds) {
      return block.work_seconds * sets + restSeconds * Math.max(0, sets - 1);
    }
    
    const workTime = reps * SECONDS_PER_REP;
    return (workTime * sets) + (restSeconds * Math.max(0, sets - 1));
  };

  const calculateTotalDuration = () => {
    const blocksToCount = skipWarmup 
      ? editableBlocks.filter(b => b.block_type !== "WARMUP")
      : editableBlocks;
    
    return blocksToCount.reduce((total, block) => {
      return total + calculateBlockDuration(block);
    }, 0);
  };

  const groupBlocksByType = (blocks: EditableBlock[]) => {
    const grouped: Record<BlockType, EditableBlock[]> = {
      WARMUP: [],
      STANDARD: [],
      FINISHER: [],
      CARDIO: [],
      REGEN: [],
    };

    blocks.forEach((block) => {
      grouped[block.block_type].push(block);
    });

    return grouped;
  };

  // Auto-save: al tocar otro ejercicio, cierra el actual (los cambios ya están guardados)
  const handleEditBlock = (blockId: string) => {
    setEditableBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        isEditing: block.id === blockId ? !block.isEditing : false,
        showSetsWarning: block.id === blockId ? block.showSetsWarning : false,
        showRepsWarning: block.id === blockId ? block.showRepsWarning : false,
      }))
    );
  };

  // Ya no se usa - los cambios se guardan automáticamente con handleFieldChange
  const handleSaveBlock = (blockId: string) => {
    setEditableBlocks((prev) =>
      prev.map((block) => {
        if (block.id === blockId) {
          return {
            ...block,
            isEditing: false,
            showSetsWarning: false,
            showRepsWarning: false,
          };
        }
        return block;
      })
    );
    setHasChanges(true);
  };

  // Ya no restaura valores - solo cierra (los cambios se mantienen)
  const handleCancelEdit = (blockId: string) => {
    setEditableBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? { ...block, isEditing: false, showSetsWarning: false, showRepsWarning: false }
          : block
      )
    );
  };

  const handleFieldChange = (
    blockId: string,
    field: "editSets" | "editReps" | "editRestSeconds",
    value: number
  ) => {
    setEditableBlocks((prev) =>
      prev.map((block) => {
        if (block.id === blockId) {
          const updates: Partial<EditableBlock> = { [field]: value };
          
          if (field === "editSets") {
            updates.showSetsWarning = value > MAX_SETS_WARNING;
          }
          if (field === "editReps") {
            updates.showRepsWarning = value > MAX_REPS_WARNING;
          }
          
          return { ...block, ...updates };
        }
        return block;
      })
    );
    setHasChanges(true); // Auto-save: marca cambios inmediatamente
  };

  const handleStartNow = async () => {
    if (!user || !routine || !id) return;

    setStarting(true);
    setError(null);

    try {
      // Construir assignment si no existe (acceso directo sin pasar por PlanPage)
      let currentAssignment = assignment;
      
      if (!currentAssignment) {
        const profileRes = await getMyProfile(user.id);
        if (profileRes.error || !profileRes.data) {
          setError("Error al obtener perfil");
          setStarting(false);
          return;
        }

        const stateRes = await getOrInitProgramState(user.id, profileRes.data);
        if (stateRes.error || !stateRes.data) {
          setError("Error al obtener estado del programa");
          setStarting(false);
          return;
        }

        // Crear assignment básico
        currentAssignment = {
          track: stateRes.data.active_track,
          dayType: stateRes.data.next_day_type,
          variantIndex: 1,
          systemRoutineId: id,
          overrideUsed: false,
          overrideFromDayType: null,
          overrideToDayType: null,
        };
      }

      // Construir meta
      const meta: WorkoutMeta = buildWorkoutMeta(currentAssignment, skipWarmup);

      // Crear sesión desde system routine
      const sessionRes = await createWorkoutSessionFromSystemRoutine({
        userId: user.id,
        systemRoutineId: id,
        meta,
      });

      if (sessionRes.error || !sessionRes.data) {
        setError(sessionRes.error || "Error al crear sesión");
        setStarting(false);
        return;
      }

      // Avanzar estado del programa
      const profileRes = await getMyProfile(user.id);
      if (profileRes.data) {
        const stateRes = await getOrInitProgramState(user.id, profileRes.data);
        if (stateRes.data) {
          await assignAndAdvance(
            user.id,
            stateRes.data,
            currentAssignment,
            id
          );
        }
      }

      // Preparar bloques para el workout (con ediciones)
      // Incluir datos para persistencia correcta en calendario
      const blocksToSave = {
        title: routine.title,
        blocks: editableBlocks.map((b) => ({
          id: b.id,
          order_index: b.order_index,
          block_type: b.block_type,
          exercise_id: b.exercise_id,
          exercise: b.exercise,
          sets: b.editSets,
          reps: b.editReps,
          rest_seconds: b.editRestSeconds,
          work_seconds: b.work_seconds,
          seconds_per_rep: SECONDS_PER_REP,
        })),
        warmupSkipped: skipWarmup,
        // NUEVO: Datos para persistencia en calendario
        source: "recommended" as const,
        programKey: currentAssignment.track,
        dayKey: currentAssignment.dayType,
        systemRoutineId: id,
      };

      // Navegar al workout
      navigate(`/workout/${sessionRes.data.session.id}`, {
        state: { workoutData: blocksToSave },
      });
    } catch (err) {
      console.error("Error starting workout:", err);
      setError("Error inesperado al iniciar");
      setStarting(false);
    }
  };

  const handleBack = () => {
    navigate("/train");
  };

  const hasWarmup = editableBlocks.some(b => b.block_type === "WARMUP");

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <span className={styles.spinner}></span>
          <p>Cargando rutina...</p>
        </div>
      </div>
    );
  }

  if (error || !routine) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorBanner}>
            <span>⚠️</span>
            {error || "Rutina no encontrada"}
          </div>
          <button className={styles.secondaryBtn} onClick={handleBack}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  const groupedBlocks = groupBlocksByType(editableBlocks);
  const blockOrder: BlockType[] = ["WARMUP", "STANDARD", "FINISHER", "CARDIO", "REGEN"];
  const totalDuration = calculateTotalDuration();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Volver
          </button>
          <h1 className={styles.title}>{routine.title}</h1>
          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <span>⏱️</span> Tiempo aprox. {formatDuration(totalDuration)}
              {hasChanges && <span className={styles.editedBadge}>editado</span>}
            </span>
            {routine.target_priority && (
              <span className={styles.metaItem}>
                <span>🎯</span> {routine.target_priority}
              </span>
            )}
          </div>
          {routine.description && (
            <p className={styles.description}>{routine.description}</p>
          )}
          
          <div className={styles.infoBox}>
            <span className={styles.infoIcon}>ℹ️</span>
            <span>Cada repetición = {SECONDS_PER_REP}s. Toca un ejercicio para editar series, reps y descansos.</span>
          </div>

          {/* Toggle de skip warmup */}
          {hasWarmup && (
            <div className={styles.warmupToggle}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={skipWarmup}
                  onChange={(e) => setSkipWarmup(e.target.checked)}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
                <span className={styles.toggleText}>Saltar calentamiento</span>
              </label>
            </div>
          )}
        </div>

        <div className={styles.blocks}>
          {blockOrder.map((blockType) => {
            const blocks = groupedBlocks[blockType];
            if (blocks.length === 0) return null;

            const isWarmupAndSkipped = blockType === "WARMUP" && skipWarmup;

            return (
              <div 
                key={blockType} 
                className={`${styles.blockGroup} ${isWarmupAndSkipped ? styles.skipped : ""}`}
              >
                <div className={styles.blockHeader}>
                  <span className={styles.blockIcon}>
                    {BLOCK_TYPE_ICONS[blockType]}
                  </span>
                  <h3 className={styles.blockTitle}>
                    {BLOCK_TYPE_LABELS[blockType]}
                    {isWarmupAndSkipped && <span className={styles.skippedLabel}> (omitido)</span>}
                  </h3>
                  <span className={styles.blockCount}>
                    {blocks.length} ejercicio{blocks.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className={styles.exerciseList}>
                  {blocks.map((block, idx) => (
                    <div key={block.id} className={`${styles.exerciseItem} ${block.isEditing ? styles.editing : ""}`}>
                      {block.isEditing ? (
                        <div className={styles.editMode}>
                          <div className={styles.editHeader}>
                            <span className={styles.exerciseNum}>{idx + 1}</span>
                            <span className={styles.exerciseNameEdit}>
                              {block.exercise?.name || "Ejercicio"}
                            </span>
                          </div>

                          {!block.work_seconds && (
                            <>
                              <div className={styles.editRow}>
                                <label className={styles.editLabel}>Series</label>
                                <div className={styles.editInputGroup}>
                                  <button
                                    className={styles.editBtnMinus}
                                    onClick={() =>
                                      handleFieldChange(block.id, "editSets", Math.max(1, block.editSets - 1))
                                    }
                                  >
                                    −
                                  </button>
                                  <span className={styles.editValue}>{block.editSets}</span>
                                  <button
                                    className={styles.editBtnPlus}
                                    onClick={() =>
                                      handleFieldChange(block.id, "editSets", block.editSets + 1)
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              {block.showSetsWarning && (
                                <div className={styles.warningBanner}>
                                  ⚠️ Más de {MAX_SETS_WARNING} series puede ser excesivo.
                                </div>
                              )}

                              <div className={styles.editRow}>
                                <label className={styles.editLabel}>Repeticiones</label>
                                <div className={styles.editInputGroup}>
                                  <button
                                    className={styles.editBtnMinus}
                                    onClick={() =>
                                      handleFieldChange(block.id, "editReps", Math.max(1, block.editReps - 1))
                                    }
                                  >
                                    −
                                  </button>
                                  <span className={styles.editValue}>{block.editReps}</span>
                                  <button
                                    className={styles.editBtnPlus}
                                    onClick={() =>
                                      handleFieldChange(block.id, "editReps", block.editReps + 1)
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              {block.showRepsWarning && (
                                <div className={styles.warningBanner}>
                                  ⚠️ Más de {MAX_REPS_WARNING} reps puede comprometer la técnica.
                                </div>
                              )}

                              <div className={styles.editCalc}>
                                = {block.editReps * SECONDS_PER_REP}s por serie
                              </div>
                            </>
                          )}

                          <div className={styles.editRow}>
                            <label className={styles.editLabel}>Descanso</label>
                            <div className={styles.editInputGroup}>
                              <button
                                className={styles.editBtnMinus}
                                onClick={() =>
                                  handleFieldChange(block.id, "editRestSeconds", Math.max(0, block.editRestSeconds - 15))
                                }
                              >
                                −15s
                              </button>
                              <span className={styles.editValue}>{block.editRestSeconds}s</span>
                              <button
                                className={styles.editBtnPlus}
                                onClick={() =>
                                  handleFieldChange(block.id, "editRestSeconds", block.editRestSeconds + 15)
                                }
                              >
                                +15s
                              </button>
                            </div>
                          </div>

                          <div className={styles.editSummary}>
                            <span>Duración total:</span>
                            <strong>{formatDuration(calculateBlockDuration(block))}</strong>
                          </div>

                          <div className={styles.editActions}>
                            <button className={styles.saveBtn} onClick={() => handleSaveBlock(block.id)}>
                              ✓ Guardar
                            </button>
                            <button className={styles.cancelEditBtn} onClick={() => handleCancelEdit(block.id)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.viewMode} onClick={() => handleEditBlock(block.id)}>
                          <span className={styles.exerciseNum}>{idx + 1}</span>
                          <div className={styles.exerciseInfo}>
                            <span className={styles.exerciseName}>
                              {block.exercise?.name || "Ejercicio"}
                            </span>
                            <span className={styles.exerciseDetails}>
                              {block.work_seconds ? (
                                `${block.work_seconds}s`
                              ) : (
                                <>{block.editSets} series × {block.editReps} reps</>
                              )}
                              {block.editRestSeconds > 0 && ` · ${block.editRestSeconds}s descanso`}
                            </span>
                          </div>
                          <span className={styles.editIcon}>✏️</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleStartNow} disabled={starting}>
            {starting ? "Preparando..." : "Empezar ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
