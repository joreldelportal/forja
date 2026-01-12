import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  getUserRoutine,
  getUserRoutineBlocks,
  updateUserRoutine,
  updateUserRoutineBlock,
  deleteUserRoutineBlock,
  replaceBlockExercise,
  reorderBlock,
  getSelectableExercises,
  type UserRoutine,
  type UserRoutineBlockWithExercise,
  type SelectableExercise,
  MUSCLE_GROUPS,
} from "../../services/customRoutineService";
import {
  createWorkoutSessionFromUserRoutine,
} from "../../services/workoutSessionService";
import styles from "./CustomRoutineEditor.module.css";

type BlockType = "WARMUP" | "STANDARD" | "FINISHER" | "CARDIO" | "REGEN";

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

export default function CustomRoutineEditorPage() {
  const navigate = useNavigate();
  const { routineId } = useParams<{ routineId: string }>();
  const { user } = useAuthStore();

  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [blocks, setBlocks] = useState<UserRoutineBlockWithExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Edit title
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // Edit block
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockEdits, setBlockEdits] = useState<{
    sets: number;
    reps: number;
    rest_seconds: number;
  } | null>(null);

  // Replace exercise modal
  const [replacingBlockId, setReplacingBlockId] = useState<string | null>(null);
  const [selectableExercises, setSelectableExercises] = useState<SelectableExercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [loadingExercises, setLoadingExercises] = useState(false);

  // Reordering
  const [reordering, setReordering] = useState(false);

  // Skip warmup
  const [skipWarmup, setSkipWarmup] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadRoutine = async () => {
      if (!routineId || !user) return;

      setLoading(true);
      setError(null);

      const [routineRes, blocksRes] = await Promise.all([
        getUserRoutine(routineId),
        getUserRoutineBlocks(routineId),
      ]);

      if (routineRes.error) {
        setError(routineRes.error);
        setLoading(false);
        return;
      }

      if (blocksRes.error) {
        setError(blocksRes.error);
        setLoading(false);
        return;
      }

      setRoutine(routineRes.data);
      setTitleValue(routineRes.data?.title || "");
      setBlocks(blocksRes.data || []);
      setLoading(false);
    };

    loadRoutine();
  }, [routineId, user]);

  // Auto-save cuando cambian los edits del bloque
  const saveBlockEdits = useCallback(async () => {
    if (!editingBlockId || !blockEdits) return;

    const result = await updateUserRoutineBlock(editingBlockId, blockEdits);

    if (result.error) {
      setError(result.error);
      return;
    }

    setBlocks(prev => prev.map(b =>
      b.id === editingBlockId
        ? { ...b, ...blockEdits }
        : b
    ));
  }, [editingBlockId, blockEdits]);

  // Cerrar edición y guardar
  const closeEditing = useCallback(async () => {
    if (editingBlockId && blockEdits) {
      await saveBlockEdits();
    }
    setEditingBlockId(null);
    setBlockEdits(null);
  }, [editingBlockId, blockEdits, saveBlockEdits]);

  // Click fuera del bloque editando
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!editingBlockId) return;
      
      const target = event.target as HTMLElement;
      
      if (containerRef.current && containerRef.current.contains(target)) {
        const clickedOnExercise = target.closest(`.${styles.exerciseItem}`);
        if (!clickedOnExercise) {
          closeEditing();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingBlockId, closeEditing]);

  const calculateTotalDuration = useCallback(() => {
    let total = 0;
    for (const block of blocks) {
      if (block.block_type === "WARMUP" && skipWarmup) continue;
      
      const sets = block.sets || 1;
      const reps = block.reps || 0;
      const rest = block.rest_seconds || 0;
      const workSec = block.work_seconds;
      const secPerRep = block.seconds_per_rep || SECONDS_PER_REP;

      let workTime = workSec || (reps * secPerRep) || 30;
      total += (workTime * sets) + (rest * Math.max(0, sets - 1));
    }
    return total;
  }, [blocks, skipWarmup]);

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}min` : `${hrs}h`;
  };

  const hasExpiredBlocks = blocks.some(b => b.is_expired);
  const hasWarmup = blocks.some(b => b.block_type === "WARMUP");

  // Agrupar bloques por tipo
  const warmupBlocks = blocks.filter(b => b.block_type === "WARMUP");
  const otherBlocks = blocks.filter(b => b.block_type !== "WARMUP");

  const handleBack = () => {
    navigate("/custom-routine/list");
  };

  const handleSaveTitle = async () => {
    if (!routine) return;
    
    setSavingTitle(true);
    const result = await updateUserRoutine(routine.id, { title: titleValue.trim() });
    setSavingTitle(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setRoutine(result.data);
    setEditingTitle(false);
  };

  const handleEditBlock = async (block: UserRoutineBlockWithExercise) => {
    if (block.is_expired) {
      setError("Reemplaza este ejercicio expirado antes de editarlo");
      return;
    }

    if (editingBlockId && editingBlockId !== block.id) {
      await closeEditing();
    }

    setEditingBlockId(block.id);
    setBlockEdits({
      sets: block.sets || 3,
      reps: block.reps || 10,
      rest_seconds: block.rest_seconds || 60,
    });
  };

  const handleEditChange = useCallback((field: "sets" | "reps" | "rest_seconds", delta: number) => {
    if (!blockEdits) return;

    const limits = {
      sets: { min: 1, max: 10 },
      reps: { min: 1, max: 50 },
      rest_seconds: { min: 0, max: 300, step: 15 },
    };

    let newValue: number;
    if (field === "rest_seconds") {
      newValue = Math.max(limits[field].min, Math.min(limits[field].max, blockEdits[field] + delta * 15));
    } else {
      newValue = Math.max(limits[field].min, Math.min(limits[field].max, blockEdits[field] + delta));
    }

    setBlockEdits({ ...blockEdits, [field]: newValue });
  }, [blockEdits]);

  const handleDeleteBlock = async (blockId: string) => {
    if (editingBlockId === blockId) {
      setEditingBlockId(null);
      setBlockEdits(null);
    }

    const result = await deleteUserRoutineBlock(blockId);
    
    if (result.error) {
      setError(result.error);
      return;
    }

    setBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const handleMoveBlock = async (blockId: string, direction: "up" | "down") => {
    if (!routineId || reordering) return;

    // Encontrar índice actual en otherBlocks
    const currentIdx = otherBlocks.findIndex(b => b.id === blockId);
    if (currentIdx === -1) return;

    const targetIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= otherBlocks.length) return;

    const currentBlock = otherBlocks[currentIdx];
    const targetBlock = otherBlocks[targetIdx];

    // 1. OPTIMISTIC UPDATE - Actualizar UI inmediatamente
    const previousBlocks = [...blocks];
    
    setBlocks(prev => {
      const newBlocks = [...prev];
      
      // Encontrar índices en el array completo (incluyendo warmup)
      const fullCurrentIdx = newBlocks.findIndex(b => b.id === currentBlock.id);
      const fullTargetIdx = newBlocks.findIndex(b => b.id === targetBlock.id);
      
      if (fullCurrentIdx === -1 || fullTargetIdx === -1) return prev;
      
      // Swap order_index values
      const tempOrderIndex = newBlocks[fullCurrentIdx].order_index;
      newBlocks[fullCurrentIdx] = {
        ...newBlocks[fullCurrentIdx],
        order_index: newBlocks[fullTargetIdx].order_index
      };
      newBlocks[fullTargetIdx] = {
        ...newBlocks[fullTargetIdx],
        order_index: tempOrderIndex
      };
      
      // Ordenar por order_index
      return newBlocks.sort((a, b) => a.order_index - b.order_index);
    });

    // 2. BACKGROUND - Actualizar BD (sin bloquear UI)
    setReordering(true);
    
    const result = await reorderBlock(routineId, blockId, direction);

    setReordering(false);

    // 3. Si falló, REVERTIR al estado anterior
    if (result.error) {
      setBlocks(previousBlocks);
      setError(result.error);
    }
  };

  const handleOpenReplaceModal = async (blockId: string) => {
    if (!user) return;
    
    await closeEditing();
    
    setReplacingBlockId(blockId);
    setExerciseSearch("");
    setLoadingExercises(true);

    const result = await getSelectableExercises(user.id);
    
    if (result.error) {
      setError(result.error);
      setReplacingBlockId(null);
    } else {
      setSelectableExercises(result.data || []);
    }
    
    setLoadingExercises(false);
  };

  const handleReplaceExercise = async (exercise: SelectableExercise) => {
    if (!replacingBlockId) return;

    const result = await replaceBlockExercise(
      replacingBlockId,
      exercise.id,
      exercise.isCustom
    );

    if (result.error) {
      setError(result.error);
      return;
    }

    setBlocks(prev => prev.map(b =>
      b.id === replacingBlockId
        ? {
            ...b,
            exercise_id: exercise.isCustom ? null : exercise.id,
            user_exercise_id: exercise.isCustom ? exercise.id : null,
            exercise_name: exercise.name,
            is_custom: exercise.isCustom,
            is_expired: false,
          }
        : b
    ));

    setReplacingBlockId(null);
  };

  const handleStartWorkout = async () => {
    if (!routine || !user || hasExpiredBlocks) return;

    await closeEditing();

    setStarting(true);
    setError(null);

    const result = await createWorkoutSessionFromUserRoutine(
      user.id,
      routine.id
    );

    if (result.error || !result.data) {
      setError(result.error || "Error al crear sesión");
      setStarting(false);
      return;
    }

    // Filtrar warmup si está skipped
    const filteredBlocks = skipWarmup 
      ? blocks.filter(b => b.block_type !== "WARMUP")
      : blocks;

    const workoutBlocks = filteredBlocks.map(b => ({
      id: b.id,
      order_index: b.order_index,
      block_type: b.block_type,
      exercise_id: b.exercise_id,
      sets: b.sets,
      reps: b.reps,
      seconds_per_rep: b.seconds_per_rep,
      work_seconds: b.work_seconds,
      rest_seconds: b.rest_seconds,
      exercise: b.exercise_name ? {
        id: b.exercise_id || b.user_exercise_id || "",
        name: b.exercise_name,
        instructions_short: null,
      } : undefined,
    }));

    navigate(`/workout/${result.data.sessionId}`, {
      state: {
        workoutData: {
          title: routine.title,
          blocks: workoutBlocks,
          source: "custom" as const,
          userRoutineId: routine.id,
        },
      },
    });
  };

  const filteredExercises = selectableExercises.filter(ex =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const groupedFilteredExercises = MUSCLE_GROUPS.reduce((acc, group) => {
    const exercises = filteredExercises.filter(
      ex => ex.category === group.key
    );
    if (exercises.length > 0) {
      acc[group.key] = { label: group.label, exercises };
    }
    return acc;
  }, {} as Record<string, { label: string; exercises: SelectableExercise[] }>);

  // Para ejercicios que NO son warmup, obtener índices relativos
  const getOtherBlockIndex = (blockId: string) => {
    return otherBlocks.findIndex(b => b.id === blockId);
  };

  const canMoveUp = (blockId: string) => {
    const idx = getOtherBlockIndex(blockId);
    return idx > 0;
  };

  const canMoveDown = (blockId: string) => {
    const idx = getOtherBlockIndex(blockId);
    return idx < otherBlocks.length - 1;
  };

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

  if (!routine) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <span>⚠️</span>
          <p>Rutina no encontrada</p>
          <button className={styles.secondaryBtn} onClick={handleBack}>
            Volver a mis rutinas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.content}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Volver
          </button>
          
          {editingTitle ? (
            <div className={styles.titleEdit}>
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                className={styles.titleInput}
                autoFocus
              />
              <button
                className={styles.saveTitleBtn}
                onClick={handleSaveTitle}
                disabled={savingTitle}
              >
                {savingTitle ? "..." : "✓"}
              </button>
              <button
                className={styles.cancelTitleBtn}
                onClick={() => setEditingTitle(false)}
              >
                ✕
              </button>
            </div>
          ) : (
            <h1 className={styles.title}>
              {routine.title}
              <button className={styles.editTitleBtn} onClick={() => setEditingTitle(true)}>
                ✏️
              </button>
            </h1>
          )}

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              ⏱️ Tiempo aprox. {formatDuration(calculateTotalDuration())}
            </span>
            <span className={styles.metaItem}>
              💪 {otherBlocks.length} ejercicios
            </span>
          </div>

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

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠️</span> {error}
            <button className={styles.dismissBtn} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {hasExpiredBlocks && (
          <div className={styles.warningBanner}>
            <span>⚠️</span> 
            Esta rutina tiene ejercicios expirados. Reemplázalos para poder iniciar.
          </div>
        )}

        <div className={styles.blocks}>
          {/* Grupo Calentamiento */}
          {warmupBlocks.length > 0 && (
            <div className={`${styles.blockGroup} ${skipWarmup ? styles.skipped : ""}`}>
              <div className={styles.blockHeader}>
                <span className={styles.blockIcon}>{BLOCK_TYPE_ICONS.WARMUP}</span>
                <h3 className={styles.blockTitle}>
                  {BLOCK_TYPE_LABELS.WARMUP}
                  {skipWarmup && <span className={styles.skippedLabel}> (omitido)</span>}
                </h3>
                <span className={styles.blockCount}>
                  {warmupBlocks.length} ejercicio{warmupBlocks.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className={styles.exerciseList}>
                {warmupBlocks.map((block, idx) => (
                  <div 
                    key={block.id} 
                    className={`${styles.exerciseItem} ${editingBlockId === block.id ? styles.editing : ""} ${block.is_expired ? styles.expired : ""}`}
                  >
                    {editingBlockId === block.id && blockEdits ? (
                      <div className={styles.editMode}>
                        <div className={styles.editHeader}>
                          <span className={styles.exerciseNum}>{idx + 1}</span>
                          <span className={styles.exerciseNameEdit}>
                            {block.exercise_name || "Ejercicio"}
                          </span>
                        </div>

                        <div className={styles.editRow}>
                          <label className={styles.editLabel}>Descanso</label>
                          <div className={styles.editInputGroup}>
                            <button
                              className={styles.editBtnMinus}
                              onClick={() => handleEditChange("rest_seconds", -1)}
                            >
                              −15s
                            </button>
                            <span className={styles.editValue}>{blockEdits.rest_seconds}s</span>
                            <button
                              className={styles.editBtnPlus}
                              onClick={() => handleEditChange("rest_seconds", 1)}
                            >
                              +15s
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.viewMode} onClick={() => handleEditBlock(block)}>
                        <span className={styles.exerciseNum}>{idx + 1}</span>
                        <div className={styles.exerciseInfo}>
                          <span className={styles.exerciseName}>
                            {block.exercise_name || "Ejercicio"}
                          </span>
                          <span className={styles.exerciseDetails}>
                            {block.work_seconds ? `${block.work_seconds}s` : `${Math.round((block.work_seconds || 300) / 60)} min`} · {block.rest_seconds || 60}s descanso
                          </span>
                        </div>
                        <span className={styles.editIcon}>✏️</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grupo Principal (y otros tipos) */}
          {otherBlocks.length > 0 && (
            <div className={styles.blockGroup}>
              <div className={styles.blockHeader}>
                <span className={styles.blockIcon}>{BLOCK_TYPE_ICONS.STANDARD}</span>
                <h3 className={styles.blockTitle}>{BLOCK_TYPE_LABELS.STANDARD}</h3>
                <span className={styles.blockCount}>
                  {otherBlocks.length} ejercicio{otherBlocks.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className={styles.exerciseList}>
                {otherBlocks.map((block, idx) => (
                  <div 
                    key={block.id} 
                    className={`${styles.exerciseItem} ${editingBlockId === block.id ? styles.editing : ""} ${block.is_expired ? styles.expired : ""}`}
                  >
                    {/* Flechas siempre visibles */}
                    <div className={styles.reorderColumn}>
                      <button
                        className={`${styles.reorderBtn} ${!canMoveUp(block.id) ? styles.disabled : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveBlock(block.id, "up");
                        }}
                        disabled={!canMoveUp(block.id) || reordering}
                      >
                        ↑
                      </button>
                      <button
                        className={`${styles.reorderBtn} ${!canMoveDown(block.id) ? styles.disabled : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveBlock(block.id, "down");
                        }}
                        disabled={!canMoveDown(block.id) || reordering}
                      >
                        ↓
                      </button>
                    </div>

                    <div className={styles.exerciseContent}>
                      {editingBlockId === block.id && blockEdits ? (
                        <div className={styles.editMode}>
                          <div className={styles.editHeader}>
                            <span className={styles.exerciseNum}>{idx + 1}</span>
                            <span className={styles.exerciseNameEdit}>
                              {block.exercise_name || "Ejercicio"}
                              {block.is_custom && <span className={styles.customBadge}>Custom</span>}
                            </span>
                          </div>

                          <div className={styles.editRow}>
                            <label className={styles.editLabel}>Series</label>
                            <div className={styles.editInputGroup}>
                              <button
                                className={styles.editBtnMinus}
                                onClick={() => handleEditChange("sets", -1)}
                              >
                                −
                              </button>
                              <span className={styles.editValue}>{blockEdits.sets}</span>
                              <button
                                className={styles.editBtnPlus}
                                onClick={() => handleEditChange("sets", 1)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          
                          {blockEdits.sets > 6 && (
                            <div className={styles.warningBanner}>
                              ⚠️ Más de 6 series puede ser excesivo para un ejercicio.
                            </div>
                          )}

                          <div className={styles.editRow}>
                            <label className={styles.editLabel}>Repeticiones</label>
                            <div className={styles.editInputGroup}>
                              <button
                                className={styles.editBtnMinus}
                                onClick={() => handleEditChange("reps", -1)}
                              >
                                −
                              </button>
                              <span className={styles.editValue}>{blockEdits.reps}</span>
                              <button
                                className={styles.editBtnPlus}
                                onClick={() => handleEditChange("reps", 1)}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {blockEdits.reps > 15 && (
                            <div className={styles.warningBanner}>
                              ⚠️ Más de 15 reps puede comprometer la técnica. Procede con precaución.
                            </div>
                          )}

                          <div className={styles.editCalc}>
                            = {blockEdits.reps * SECONDS_PER_REP}s por serie
                          </div>

                          <div className={styles.editRow}>
                            <label className={styles.editLabel}>Descanso</label>
                            <div className={styles.editInputGroup}>
                              <button
                                className={styles.editBtnMinus}
                                onClick={() => handleEditChange("rest_seconds", -1)}
                              >
                                −15s
                              </button>
                              <span className={styles.editValue}>{blockEdits.rest_seconds}s</span>
                              <button
                                className={styles.editBtnPlus}
                                onClick={() => handleEditChange("rest_seconds", 1)}
                              >
                                +15s
                              </button>
                            </div>
                          </div>

                          {/* Acciones: Reemplazar y Eliminar */}
                          <div className={styles.blockExtraActions}>
                            <button
                              className={styles.replaceBtn}
                              onClick={() => handleOpenReplaceModal(block.id)}
                            >
                              🔄 Reemplazar
                            </button>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDeleteBlock(block.id)}
                            >
                              🗑 Eliminar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.viewMode} onClick={() => handleEditBlock(block)}>
                          <span className={styles.exerciseNum}>{idx + 1}</span>
                          <div className={styles.exerciseInfo}>
                            <span className={styles.exerciseName}>
                              {block.exercise_name || "Ejercicio"}
                              {block.is_expired && <span className={styles.expiredTag}> (Expirado)</span>}
                            </span>
                            <span className={styles.exerciseDetails}>
                              {block.sets || 3} series × {block.reps || 10} reps · {block.rest_seconds || 60}s descanso
                            </span>
                          </div>
                          <span className={styles.editIcon}>✏️</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.primaryBtn}
            onClick={handleStartWorkout}
            disabled={starting || hasExpiredBlocks || blocks.length === 0}
          >
            {starting ? "Preparando..." : "Empezar ahora"}
          </button>
        </div>
      </div>

      {/* Replace exercise modal */}
      {replacingBlockId && (
        <div className={styles.modalOverlay} onClick={() => setReplacingBlockId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Reemplazar ejercicio</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setReplacingBlockId(null)}
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              className={styles.modalSearch}
              placeholder="🔍 Buscar ejercicio..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
            />

            {loadingExercises ? (
              <div className={styles.modalLoading}>
                <span className={styles.spinner}></span>
                <p>Cargando ejercicios...</p>
              </div>
            ) : (
              <div className={styles.modalExerciseList}>
                {Object.entries(groupedFilteredExercises).map(([key, group]) => (
                  <div key={key} className={styles.exerciseGroup}>
                    <h4 className={styles.groupLabel}>{group.label}</h4>
                    {group.exercises.map(ex => (
                      <button
                        key={ex.id}
                        className={`${styles.exerciseOption} ${ex.isCustom ? styles.custom : ""}`}
                        onClick={() => handleReplaceExercise(ex)}
                      >
                        <span className={styles.exerciseOptionName}>{ex.name}</span>
                        {ex.isCustom && <span className={styles.customBadge}>Custom</span>}
                      </button>
                    ))}
                  </div>
                ))}
                {Object.keys(groupedFilteredExercises).length === 0 && (
                  <p className={styles.noResults}>No se encontraron ejercicios</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
