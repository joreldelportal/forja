import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "../../stores/authStore";
import {
  getCatalogExercises,
  getUiGroupKey,
  MUSCLE_GROUPS,
  type CatalogExercise,
} from "../../services/customRoutineService";
import styles from "./ExplorePage.module.css";

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

type ExerciseWithGroup = CatalogExercise & {
  uiGroupKey: string;
};

export default function ExplorePage() {
  const { user } = useAuthStore();

  const [exercises, setExercises] = useState<ExerciseWithGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Bottom sheet for muscle group
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // Exercise detail modal
  const [selectedExercise, setSelectedExercise] = useState<ExerciseWithGroup | null>(null);

  useEffect(() => {
    const loadExercises = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      const result = await getCatalogExercises();

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Enrich exercises with UI group key
      const enriched: ExerciseWithGroup[] = (result.data || [])
        .map((ex) => ({
          ...ex,
          uiGroupKey: getUiGroupKey(ex.category, ex.name),
        }))
        .filter((ex) => ex.uiGroupKey !== "");

      setExercises(enriched);
      setLoading(false);
    };

    loadExercises();
  }, [user]);

  // Group exercises by UI category
  const groupedExercises = useMemo(() => {
    const groups: Record<string, ExerciseWithGroup[]> = {};

    for (const group of MUSCLE_GROUPS) {
      groups[group.key] = [];
    }

    for (const ex of exercises) {
      if (groups[ex.uiGroupKey]) {
        groups[ex.uiGroupKey].push(ex);
      }
    }

    return groups;
  }, [exercises]);

  // Get config for active group
  const activeGroupConfig = useMemo(() => {
    return MUSCLE_GROUPS.find((g) => g.key === activeGroup);
  }, [activeGroup]);

  // Filtered exercises for active group
  const filteredGroupExercises = useMemo(() => {
    if (!activeGroup) return [];

    const groupExercises = groupedExercises[activeGroup] || [];

    if (!searchTerm) return groupExercises;

    return groupExercises.filter((ex) =>
      ex.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groupedExercises, activeGroup, searchTerm]);

  // Global search results
  const globalSearchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];

    return exercises
      .filter((ex) => ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10);
  }, [exercises, searchTerm]);

  const handleOpenGroup = (groupKey: string) => {
    setActiveGroup(groupKey);
    setSearchTerm("");
  };

  const handleCloseGroup = () => {
    setActiveGroup(null);
    setSearchTerm("");
  };

  const handleSelectExercise = (exercise: ExerciseWithGroup) => {
    setSelectedExercise(exercise);
  };

  const handleCloseDetail = () => {
    setSelectedExercise(null);
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

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <span className={styles.errorIcon}>⚠️</span>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Explorar</h1>
          <p className={styles.subtitle}>Descubre ejercicios para tu entrenamiento</p>
        </div>

        {/* Global Search */}
        <div className={styles.searchSection}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Buscar ejercicio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            {searchTerm && (
              <button className={styles.clearBtn} onClick={() => setSearchTerm("")}>
                ✕
              </button>
            )}
          </div>

          {/* Global Search Results */}
          {globalSearchResults.length > 0 && !activeGroup && (
            <div className={styles.searchResults}>
              {globalSearchResults.map((ex) => (
                <button
                  key={ex.id}
                  className={styles.searchResultItem}
                  onClick={() => handleSelectExercise(ex)}
                >
                  <span className={styles.resultIcon}>{GROUP_ICONS[ex.uiGroupKey] || "💪"}</span>
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{ex.name}</span>
                    <span className={styles.resultCategory}>
                      {MUSCLE_GROUPS.find((g) => g.key === ex.uiGroupKey)?.label || ex.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Muscle Groups Grid */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Grupos Musculares</h2>
          <div className={styles.groupsGrid}>
            {MUSCLE_GROUPS.map((group) => {
              const exerciseCount = (groupedExercises[group.key] || []).length;

              return (
                <button
                  key={group.key}
                  className={styles.groupCard}
                  onClick={() => handleOpenGroup(group.key)}
                >
                  <span className={styles.groupIcon}>{GROUP_ICONS[group.key] || "💪"}</span>
                  <span className={styles.groupName}>{group.label}</span>
                  <span className={styles.groupCount}>{exerciseCount}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Popular Exercises */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Populares</h2>
          <div className={styles.popularList}>
            {exercises.slice(0, 6).map((ex) => (
              <button
                key={ex.id}
                className={styles.popularItem}
                onClick={() => handleSelectExercise(ex)}
              >
                <span className={styles.popularIcon}>{GROUP_ICONS[ex.uiGroupKey] || "💪"}</span>
                <div className={styles.popularInfo}>
                  <span className={styles.popularName}>{ex.name}</span>
                  <span className={styles.popularCategory}>
                    {MUSCLE_GROUPS.find((g) => g.key === ex.uiGroupKey)?.label || ex.category}
                  </span>
                </div>
                <span className={styles.popularArrow}>›</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Sheet - Exercise List by Group */}
      {activeGroup && (
        <div className={styles.sheetOverlay} onClick={handleCloseGroup}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle}></div>

            <div className={styles.sheetHeader}>
              <div className={styles.sheetTitleRow}>
                <span className={styles.sheetIcon}>{GROUP_ICONS[activeGroup] || "💪"}</span>
                <h2 className={styles.sheetTitle}>{activeGroupConfig?.label || "Ejercicios"}</h2>
              </div>
              <button className={styles.sheetClose} onClick={handleCloseGroup}>
                ✕
              </button>
            </div>

            <div className={styles.sheetSearch}>
              <input
                type="text"
                placeholder="Buscar en este grupo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.sheetSearchInput}
              />
            </div>

            <div className={styles.sheetContent}>
              {filteredGroupExercises.length === 0 ? (
                <p className={styles.emptyMessage}>
                  {searchTerm ? "No se encontraron ejercicios" : "No hay ejercicios en este grupo"}
                </p>
              ) : (
                <div className={styles.exerciseList}>
                  {filteredGroupExercises.map((ex) => (
                    <button
                      key={ex.id}
                      className={styles.exerciseItem}
                      onClick={() => handleSelectExercise(ex)}
                    >
                      <span className={styles.exerciseName}>{ex.name}</span>
                      <span className={styles.exerciseArrow}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exercise Detail Modal */}
      {selectedExercise && (
        <div className={styles.modalOverlay} onClick={handleCloseDetail}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={handleCloseDetail}>
              ✕
            </button>

            <div className={styles.modalHeader}>
              <span className={styles.modalIcon}>
                {GROUP_ICONS[selectedExercise.uiGroupKey] || "💪"}
              </span>
              <h2 className={styles.modalTitle}>{selectedExercise.name}</h2>
              <span className={styles.modalCategory}>
                {MUSCLE_GROUPS.find((g) => g.key === selectedExercise.uiGroupKey)?.label ||
                  selectedExercise.category}
              </span>
            </div>

            <div className={styles.modalContent}>
              {selectedExercise.instructions_short ? (
                <div className={styles.instructions}>
                  <h3>Instrucciones</h3>
                  <p>{selectedExercise.instructions_short}</p>
                </div>
              ) : (
                <div className={styles.noInstructions}>
                  <p>Instrucciones no disponibles aún.</p>
                </div>
              )}

              {selectedExercise.type && (
                <div className={styles.exerciseType}>
                  <span className={styles.typeLabel}>Tipo:</span>
                  <span className={styles.typeValue}>{selectedExercise.type}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
