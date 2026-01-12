import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  getSelectableExercises,
  createRoutineWithExercises,
  createCustomExercise,
  getActiveCustomExerciseCount,
  MUSCLE_GROUPS,
  DB_EXERCISE_CATEGORIES,
  MAX_EXERCISES_PER_ROUTINE,
  MAX_ACTIVE_CUSTOM_EXERCISES,
  type SelectableExercise,
} from "../../services/customRoutineService";
import styles from "./CustomRoutineBuilder.module.css";

// Iconos por grupo muscular
const GROUP_ICONS: Record<string, string> = {
  CHEST: "💪",
  BACK: "🔙",
  SHOULDERS: "🎯",
  ARMS_BICEPS: "💪",
  ARMS_TRICEPS: "💪",
  QUADS: "🦵",
  HAMSTRINGS_GLUTES: "🍑",
  CORE: "🔥",
  CARDIO: "❤️",
  MOBILITY: "🧘",
};

export default function CustomRoutineBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [exercises, setExercises] = useState<SelectableExercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bottom sheet for muscle group
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // Custom exercise modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("CHEST");
  const [customExerciseCount, setCustomExerciseCount] = useState(0);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Routine name modal
  const [showNameModal, setShowNameModal] = useState(false);
  const [routineName, setRoutineName] = useState("Mi rutina personalizada");
  const [includeWarmup, setIncludeWarmup] = useState(true);

  useEffect(() => {
    const loadExercises = async () => {
      if (!user) return;
      
      setLoading(true);
      setError(null);

      const [exercisesRes, countRes] = await Promise.all([
        getSelectableExercises(user.id),
        getActiveCustomExerciseCount(user.id),
      ]);

      if (exercisesRes.error) {
        setError(exercisesRes.error);
      } else {
        setExercises(exercisesRes.data || []);
      }

      setCustomExerciseCount(countRes.count);
      setLoading(false);
    };

    loadExercises();
  }, [user]);

  // Group exercises by category
  const groupedExercises = useMemo(() => {
    const groups: Record<string, SelectableExercise[]> = {};
    
    for (const group of MUSCLE_GROUPS) {
      groups[group.key] = [];
    }

    for (const ex of exercises) {
      const groupKey = ex.category;
      if (groupKey && groups[groupKey]) {
        groups[groupKey].push(ex);
      }
    }

    return groups;
  }, [exercises]);

  // Filtered exercises for active group
  const filteredGroupExercises = useMemo(() => {
    if (!activeGroup) return [];
    
    const groupExercises = groupedExercises[activeGroup] || [];
    
    if (!searchTerm) return groupExercises;
    
    return groupExercises.filter(ex =>
      ex.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groupedExercises, activeGroup, searchTerm]);

  const selectedExercises = useMemo(() => {
    return exercises.filter(ex => selectedIds.has(ex.id));
  }, [exercises, selectedIds]);

  // Count selected per group
  const getGroupSelectedCount = (groupKey: string) => {
    const groupExercises = groupedExercises[groupKey] || [];
    return groupExercises.filter(ex => selectedIds.has(ex.id)).length;
  };

  const toggleExercise = (exerciseId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        if (next.size >= MAX_EXERCISES_PER_ROUTINE) {
          setError(`Máximo ${MAX_EXERCISES_PER_ROUTINE} ejercicios por rutina`);
          return prev;
        }
        next.add(exerciseId);
        setError(null);
      }
      return next;
    });
  };

  const handleOpenGroup = (groupKey: string) => {
    setActiveGroup(groupKey);
    setSearchTerm("");
  };

  const handleCloseGroup = () => {
    setActiveGroup(null);
    setSearchTerm("");
  };

  const handleContinue = () => {
    if (selectedIds.size === 0) {
      setError("Selecciona al menos 1 ejercicio");
      return;
    }
    setShowNameModal(true);
  };

  const handleCreateRoutine = async () => {
    if (!user) return;
    
    setCreating(true);
    setError(null);

    const exerciseList = selectedExercises.map(ex => ({
      id: ex.id,
      isCustom: ex.isCustom,
    }));

    const result = await createRoutineWithExercises(
      user.id,
      routineName.trim() || "Mi rutina personalizada",
      exerciseList,
      includeWarmup
    );

    setCreating(false);

    if (result.error) {
      setError(result.error);
      setShowNameModal(false);
      return;
    }

    navigate(`/custom-routine/${result.data!.id}`, { replace: true });
  };

  const handleOpenCustomModal = () => {
    if (customExerciseCount >= MAX_ACTIVE_CUSTOM_EXERCISES) {
      setError(`Plan Free: máximo ${MAX_ACTIVE_CUSTOM_EXERCISES} ejercicios custom activos`);
      return;
    }
    setCustomName("");
    setCustomCategory("CHEST");
    setCustomError(null);
    setShowCustomModal(true);
  };

  const handleCreateCustomExercise = async () => {
    if (!user) return;
    if (!customName.trim()) {
      setCustomError("Ingresa un nombre");
      return;
    }

    setCreatingCustom(true);
    setCustomError(null);

    const result = await createCustomExercise(
      user.id,
      customName.trim(),
      customCategory,
      null
    );

    setCreatingCustom(false);

    if (result.error) {
      setCustomError(result.error);
      return;
    }

    if (result.data) {
      const newExercise: SelectableExercise = {
        id: result.data.id,
        name: result.data.name,
        category: result.data.category || "CHEST",
        type: result.data.type,
        isCustom: true,
      };
      
      setExercises(prev => [...prev, newExercise]);
      setSelectedIds(prev => new Set(prev).add(result.data!.id));
      setCustomExerciseCount(prev => prev + 1);
    }

    setShowCustomModal(false);
  };

  const handleBack = () => {
    navigate("/plan");
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(exerciseId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <span className={styles.spinner}></span>
          <p>Cargando ejercicios...</p>
        </div>
      </div>
    );
  }

  const activeGroupConfig = MUSCLE_GROUPS.find(g => g.key === activeGroup);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Volver
          </button>
          <h1 className={styles.title}>Crear rutina</h1>
          <p className={styles.subtitle}>
            Elige los grupos musculares que quieres trabajar
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className={styles.errorBanner}>
            <span>⚠️</span> {error}
            <button className={styles.dismissBtn} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Counter pill */}
        <div className={styles.counterPill}>
          <span className={styles.counterIcon}>🏋️</span>
          <span className={styles.counterText}>
            <strong>{selectedIds.size}</strong> / {MAX_EXERCISES_PER_ROUTINE} ejercicios
          </span>
          <button
            className={styles.addCustomChip}
            onClick={handleOpenCustomModal}
            disabled={customExerciseCount >= MAX_ACTIVE_CUSTOM_EXERCISES}
          >
            + Custom ({customExerciseCount}/{MAX_ACTIVE_CUSTOM_EXERCISES})
          </button>
        </div>

        {/* Muscle Groups Grid */}
        <div className={styles.groupsGrid}>
          {MUSCLE_GROUPS.map(group => {
            const exerciseCount = (groupedExercises[group.key] || []).length;
            const selectedCount = getGroupSelectedCount(group.key);
            
            return (
              <button
                key={group.key}
                className={`${styles.groupCard} ${selectedCount > 0 ? styles.hasSelected : ""}`}
                onClick={() => handleOpenGroup(group.key)}
              >
                <span className={styles.groupIcon}>{GROUP_ICONS[group.key] || "💪"}</span>
                <span className={styles.groupName}>{group.label}</span>
                <span className={styles.groupCount}>{exerciseCount} ejercicios</span>
                {selectedCount > 0 && (
                  <span className={styles.groupBadge}>{selectedCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected exercises preview */}
        {selectedIds.size > 0 && (
          <div className={styles.selectedSection}>
            <h3 className={styles.selectedTitle}>Tu selección</h3>
            <div className={styles.selectedChips}>
              {selectedExercises.map((ex, idx) => (
                <div key={ex.id} className={styles.selectedChip}>
                  <span className={styles.chipIndex}>{idx + 1}</span>
                  <span className={styles.chipName}>{ex.name}</span>
                  <button
                    className={styles.chipRemove}
                    onClick={() => handleRemoveExercise(ex.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className={styles.footer}>
        <button
          className={styles.continueBtn}
          onClick={handleContinue}
          disabled={selectedIds.size === 0}
        >
          {selectedIds.size === 0 
            ? "Selecciona ejercicios" 
            : `Continuar con ${selectedIds.size} ejercicios`}
        </button>
      </div>

      {/* Bottom Sheet - Exercise Selection */}
      {activeGroup && (
        <div className={styles.sheetOverlay} onClick={handleCloseGroup}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle}></div>
            
            <div className={styles.sheetHeader}>
              <div className={styles.sheetTitleRow}>
                <span className={styles.sheetIcon}>{GROUP_ICONS[activeGroup] || "💪"}</span>
                <h2 className={styles.sheetTitle}>{activeGroupConfig?.label || "Ejercicios"}</h2>
              </div>
              <button className={styles.sheetClose} onClick={handleCloseGroup}>✕</button>
            </div>

            <div className={styles.sheetSearch}>
              <input
                type="text"
                placeholder="Buscar ejercicio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.sheetContent}>
              {filteredGroupExercises.length === 0 ? (
                <p className={styles.emptyMessage}>
                  {searchTerm ? "No se encontraron ejercicios" : "No hay ejercicios en este grupo"}
                </p>
              ) : (
                <div className={styles.exerciseList}>
                  {filteredGroupExercises.map(ex => {
                    const isSelected = selectedIds.has(ex.id);
                    return (
                      <button
                        key={ex.id}
                        className={`${styles.exerciseItem} ${isSelected ? styles.selected : ""} ${ex.isCustom ? styles.custom : ""}`}
                        onClick={() => toggleExercise(ex.id)}
                      >
                        <div className={styles.exerciseInfo}>
                          <span className={styles.exerciseName}>{ex.name}</span>
                          {ex.isCustom && <span className={styles.customBadge}>Custom</span>}
                        </div>
                        <div className={styles.exerciseCheck}>
                          {isSelected ? "✓" : "+"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.sheetFooter}>
              <button className={styles.sheetDoneBtn} onClick={handleCloseGroup}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Exercise Modal */}
      {showCustomModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Nuevo ejercicio custom</h3>
            <p className={styles.modalSubtitle}>
              Válido por 7 días (Plan Free)
            </p>

            {customError && (
              <div className={styles.modalError}>
                <span>⚠️</span> {customError}
              </div>
            )}

            <div className={styles.modalField}>
              <label>Nombre del ejercicio</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ej: Press inclinado con mancuernas"
                maxLength={100}
              />
            </div>

            <div className={styles.modalField}>
              <label>Grupo muscular</label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              >
                {DB_EXERCISE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.modalPrimaryBtn}
                onClick={handleCreateCustomExercise}
                disabled={creatingCustom}
              >
                {creatingCustom ? "Creando..." : "Crear ejercicio"}
              </button>
              <button
                className={styles.modalSecondaryBtn}
                onClick={() => setShowCustomModal(false)}
                disabled={creatingCustom}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Routine Name Modal */}
      {showNameModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Nombra tu rutina</h3>

            <div className={styles.modalField}>
              <label>Nombre</label>
              <input
                type="text"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="Mi rutina personalizada"
                maxLength={100}
              />
            </div>

            <div className={styles.modalCheckbox}>
              <input
                type="checkbox"
                id="includeWarmup"
                checked={includeWarmup}
                onChange={(e) => setIncludeWarmup(e.target.checked)}
              />
              <label htmlFor="includeWarmup">Incluir calentamiento (5 min)</label>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.modalPrimaryBtn}
                onClick={handleCreateRoutine}
                disabled={creating}
              >
                {creating ? "Creando..." : "Crear rutina"}
              </button>
              <button
                className={styles.modalSecondaryBtn}
                onClick={() => setShowNameModal(false)}
                disabled={creating}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
