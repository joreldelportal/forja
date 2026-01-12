import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { getMyProfile } from "../../services/profileService";
import type { Profile } from "../../services/profileService";
import { getWeekMarks } from "../../services/calendarService";
import {
  getOrInitProgramState,
  getNextAssignment,
  getAvailableSwitchOptions,
  type UserProgramState,
  type Assignment,
} from "../../lib/routineEngine";
import {
  trackUsesRpc,
  formatTrackBadgeLabel,
  type DayTypeConfig,
} from "../../lib/routineCatalog";
import {
  fetchSystemRoutineWithBlocks,
  getWorkoutForPplDay,
  type SystemRoutine,
  type ProgramDayWorkout,
} from "../../services/routineService";
import {
  getUserRoutines,
  routineHasExpiredExercises,
  deleteUserRoutine,
  type UserRoutine,
} from "../../services/customRoutineService";
import styles from "./TrainPage.module.css";

type RoutineWithStatus = UserRoutine & {
  hasExpired: boolean;
  expiredCount: number;
};

export default function TrainPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Estado programa recomendado
  const [profile, setProfile] = useState<Profile | null>(null);
  const [programState, setProgramState] = useState<UserProgramState | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [systemRoutine, setSystemRoutine] = useState<SystemRoutine | null>(null);
  const [programDayWorkout, setProgramDayWorkout] = useState<ProgramDayWorkout | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);

  // Estado rutinas custom
  const [customRoutines, setCustomRoutines] = useState<RoutineWithStatus[]>([]);

  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchOptions, setSwitchOptions] = useState<DayTypeConfig[]>([]);
  const [showTrainedWarning, setShowTrainedWarning] = useState(false);
  const [alreadyTrainedToday, setAlreadyTrainedToday] = useState(false);

  // Delete custom routine
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        // 1. Obtener perfil
        const profileRes = await getMyProfile(user.id);
        if (profileRes.error) {
          setError(profileRes.error);
          setLoading(false);
          return;
        }

        if (!profileRes.data) {
          navigate("/onboarding", { replace: true });
          return;
        }

        setProfile(profileRes.data);

        // 2. Verificar si ya entrenó hoy
        const today = new Date().toISOString().split("T")[0];
        const marksRes = await getWeekMarks(user.id, today, today);
        if (marksRes.data && marksRes.data.length > 0) {
          const trainedToday = marksRes.data.some((m) => m.mark_type === "TRAINED");
          setAlreadyTrainedToday(trainedToday);
        }

        // 3. Obtener o inicializar estado del programa
        const stateRes = await getOrInitProgramState(user.id, profileRes.data);
        if (stateRes.error || !stateRes.data) {
          setError(stateRes.error || "Error al cargar programa");
          setLoading(false);
          return;
        }

        setProgramState(stateRes.data);

        // 4. Calcular asignación del día
        const todayAssignment = getNextAssignment(stateRes.data, profileRes.data);
        setAssignment(todayAssignment);

        // 5. Cargar rutina del sistema
        if (trackUsesRpc(stateRes.data.active_track)) {
          const workoutRes = await getWorkoutForPplDay(todayAssignment.dayType);

          if (workoutRes.error || !workoutRes.data) {
            setError(workoutRes.error || "Error al cargar rutina PPL");
            setLoading(false);
            return;
          }

          setProgramDayWorkout(workoutRes.data);
          setEstimatedDuration(workoutRes.data.estimatedDurationSec);

          setSystemRoutine({
            id: workoutRes.data.routineId,
            title: workoutRes.data.routineTitle,
            description: null,
            target_priority: "AESTHETICS",
            target_context: "GYM",
            estimated_duration_sec: workoutRes.data.estimatedDurationSec,
            created_at: new Date().toISOString(),
          });
        } else {
          const routineRes = await fetchSystemRoutineWithBlocks(todayAssignment.systemRoutineId);
          if (routineRes.error || !routineRes.data) {
            setError(routineRes.error || "Error al cargar rutina");
            setLoading(false);
            return;
          }

          setSystemRoutine(routineRes.data);
          setEstimatedDuration(routineRes.data.estimated_duration_sec);
        }

        // 6. Preparar opciones de switch
        const options = getAvailableSwitchOptions(stateRes.data);
        setSwitchOptions(options);

        // 7. Cargar rutinas custom del usuario
        const customRes = await getUserRoutines(user.id);
        if (!customRes.error && customRes.data) {
          // Check expired exercises
          const routinesWithStatus: RoutineWithStatus[] = [];
          for (const routine of customRes.data) {
            const expiredCheck = await routineHasExpiredExercises(routine.id);
            routinesWithStatus.push({
              ...routine,
              hasExpired: expiredCheck.hasExpired,
              expiredCount: expiredCheck.expiredCount,
            });
          }
          setCustomRoutines(routinesWithStatus);
        }
      } catch (err) {
        console.error("Error loading plan:", err);
        setError("Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}min` : `${hrs}h`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;

    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  };

  const handleStartNow = () => {
    if (alreadyTrainedToday && !showTrainedWarning) {
      setShowTrainedWarning(true);
      return;
    }
    goToPreview();
  };

  const goToPreview = () => {
    if (!assignment || !systemRoutine) return;

    navigate(`/plan/routine/${systemRoutine.id}`, {
      state: {
        assignment,
        fromEngine: true,
        programDayWorkout: programDayWorkout,
      },
    });
  };

  const handleConfirmTrain = () => {
    setShowTrainedWarning(false);
    goToPreview();
  };

  const handleCancelWarning = () => {
    setShowTrainedWarning(false);
  };

  const handleShowSwitch = () => {
    setShowSwitchModal(true);
  };

  const handleSelectSwitch = async (dayTypeConfig: DayTypeConfig) => {
    if (!profile || !programState) return;

    const newAssignment = getNextAssignment(programState, profile, dayTypeConfig.dayType);

    setShowSwitchModal(false);

    if (trackUsesRpc(programState.active_track)) {
      const workoutRes = await getWorkoutForPplDay(dayTypeConfig.dayType);

      if (workoutRes.error || !workoutRes.data) {
        setError(workoutRes.error || "Error al cargar rutina");
        return;
      }

      navigate(`/plan/routine/${workoutRes.data.routineId}`, {
        state: {
          assignment: {
            ...newAssignment,
            systemRoutineId: workoutRes.data.routineId,
          },
          fromEngine: true,
          programDayWorkout: workoutRes.data,
        },
      });
      return;
    }

    navigate(`/plan/routine/${newAssignment.systemRoutineId}`, {
      state: {
        assignment: newAssignment,
        fromEngine: true,
      },
    });
  };

  const handleViewRoutine = () => {
    if (!assignment || !systemRoutine) return;
    navigate(`/plan/routine/${systemRoutine.id}`, {
      state: {
        assignment,
        fromEngine: true,
        programDayWorkout: programDayWorkout,
      },
    });
  };

  // Custom routine handlers
  const handleCreateCustom = () => {
    navigate("/custom-routine/builder");
  };

  const handleEditCustom = (routineId: string) => {
    navigate(`/custom-routine/${routineId}`);
  };

  const handleStartCustom = (routineId: string, hasExpired: boolean) => {
    if (hasExpired) {
      setError("Esta rutina tiene ejercicios expirados. Edítala para reemplazarlos.");
      return;
    }
    navigate(`/custom-routine/${routineId}`);
  };

  const handleDeleteClick = (routineId: string) => {
    setShowDeleteConfirm(routineId);
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm) return;

    setDeletingId(showDeleteConfirm);
    setShowDeleteConfirm(null);

    const result = await deleteUserRoutine(showDeleteConfirm);

    if (result.error) {
      setError(result.error);
      setDeletingId(null);
      return;
    }

    setCustomRoutines((prev) => prev.filter((r) => r.id !== showDeleteConfirm));
    setDeletingId(null);
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

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.errorCard}>
            <span className={styles.errorIcon}>⚠️</span>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={() => setError(null)}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Entrenar</h1>
          <p className={styles.subtitle}>Elige qué entrenar hoy</p>
        </div>

        {/* Modal de advertencia - ya entrenaste */}
        {showTrainedWarning && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalIcon}>💪</div>
              <h3 className={styles.modalTitle}>¡Ya entrenaste hoy!</h3>
              <p className={styles.modalText}>
                Completaste una sesión hoy. ¿Quieres entrenar de nuevo?
              </p>
              <div className={styles.modalActions}>
                <button className={styles.primaryBtn} onClick={handleConfirmTrain}>
                  Sí, vamos otra vez
                </button>
                <button className={styles.secondaryBtn} onClick={handleCancelWarning}>
                  Mejor descanso
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de cambio de rutina */}
        {showSwitchModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalIcon}>🔄</div>
              <h3 className={styles.modalTitle}>Cambiar rutina</h3>
              <p className={styles.modalText}>Elige otra opción de tu programa:</p>
              <div className={styles.switchOptions}>
                {switchOptions.map((option) => (
                  <button
                    key={option.dayType}
                    className={styles.switchOption}
                    onClick={() => handleSelectSwitch(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button className={styles.secondaryBtn} onClick={() => setShowSwitchModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Modal de eliminar rutina custom */}
        {showDeleteConfirm && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalIcon}>🗑</div>
              <h3 className={styles.modalTitle}>¿Eliminar rutina?</h3>
              <p className={styles.modalText}>Esta acción no se puede deshacer.</p>
              <div className={styles.modalActions}>
                <button className={styles.dangerBtn} onClick={handleConfirmDelete}>
                  Sí, eliminar
                </button>
                <button className={styles.secondaryBtn} onClick={() => setShowDeleteConfirm(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sección: Rutina Recomendada */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Rutina Recomendada</h2>

          <div className={styles.recommendedCard}>
            <div className={styles.recommendedHeader}>
              <span className={styles.recommendedBadge}>✨ Para ti</span>
              {alreadyTrainedToday && <span className={styles.trainedBadge}>✓ Entrenado</span>}
            </div>

            <div className={styles.recommendedContent}>
              {programState && assignment && (
                <span className={styles.programBadge}>
                  {formatTrackBadgeLabel(programState.active_track, assignment.dayType)}
                </span>
              )}

              <h3 className={styles.routineTitle}>{systemRoutine?.title || "Tu rutina del día"}</h3>

              <div className={styles.routineMeta}>
                <span className={styles.metaItem}>⏱️ {formatDuration(estimatedDuration)}</span>
                <span className={styles.metaDivider}>•</span>
                <span className={styles.metaItem}>🔥 Calentamiento</span>
              </div>
            </div>

            <div className={styles.recommendedActions}>
              <button className={styles.startBtn} onClick={handleStartNow}>
                Empezar
              </button>
              <button className={styles.previewBtn} onClick={handleViewRoutine}>
                Ver ejercicios
              </button>
            </div>

            {switchOptions.length > 0 && (
              <button className={styles.switchBtn} onClick={handleShowSwitch}>
                🔄 Cambiar rutina del día
              </button>
            )}
          </div>
        </div>

        {/* Sección: Mis Rutinas Custom */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Mis Rutinas</h2>
            <button className={styles.createBtn} onClick={handleCreateCustom}>
              + Nueva
            </button>
          </div>

          {customRoutines.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📋</span>
              <p className={styles.emptyText}>
                Crea tu primera rutina personalizada con tus ejercicios favoritos.
              </p>
              <button className={styles.emptyBtn} onClick={handleCreateCustom}>
                Crear rutina
              </button>
            </div>
          ) : (
            <div className={styles.customList}>
              {customRoutines.map((routine) => (
                <div
                  key={routine.id}
                  className={`${styles.customCard} ${routine.hasExpired ? styles.hasExpired : ""}`}
                >
                  <div
                    className={styles.customInfo}
                    onClick={() =>
                      routine.hasExpired
                        ? handleEditCustom(routine.id)
                        : handleStartCustom(routine.id, routine.hasExpired)
                    }
                  >
                    <h3 className={styles.customName}>{routine.title}</h3>
                    <span className={styles.customDate}>{formatDate(routine.created_at)}</span>
                    {routine.hasExpired && (
                      <span className={styles.expiredBadge}>⚠️ {routine.expiredCount} expirado(s)</span>
                    )}
                  </div>

                  <div className={styles.customActions}>
                    <button
                      className={styles.customEditBtn}
                      onClick={() => handleEditCustom(routine.id)}
                      disabled={deletingId === routine.id}
                    >
                      ✏️
                    </button>
                    <button
                      className={styles.customDeleteBtn}
                      onClick={() => handleDeleteClick(routine.id)}
                      disabled={deletingId === routine.id}
                    >
                      {deletingId === routine.id ? "..." : "🗑"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
