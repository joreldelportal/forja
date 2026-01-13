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
import { getUserRoutines, type UserRoutine } from "../../services/customRoutineService";
import styles from "./PlanPage.module.css";

export default function PlanPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [programState, setProgramState] = useState<UserProgramState | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [systemRoutine, setSystemRoutine] = useState<SystemRoutine | null>(null);
  const [programDayWorkout, setProgramDayWorkout] = useState<ProgramDayWorkout | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchOptions, setSwitchOptions] = useState<DayTypeConfig[]>([]);
  
  const [showTrainedWarning, setShowTrainedWarning] = useState(false);
  const [alreadyTrainedToday, setAlreadyTrainedToday] = useState(false);
  
  // User custom routines
  const [userRoutines, setUserRoutines] = useState<UserRoutine[]>([]);

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
          const trainedToday = marksRes.data.some(m => m.mark_type === "TRAINED");
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

        // 7. Cargar rutinas del usuario
        const routinesRes = await getUserRoutines(user.id);
        if (routinesRes.data) {
          setUserRoutines(routinesRes.data);
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

    const newAssignment = getNextAssignment(
      programState,
      profile,
      dayTypeConfig.dayType
    );

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
          <div className={styles.card}>
            <div className={styles.errorBanner}>
              <span>⚠️</span>
              {error}
            </div>
            <button className={styles.secondaryBtn} onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Entrenar</h1>
          <p className={styles.subtitle}>
            Elige qué entrenar hoy
          </p>
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
              <p className={styles.modalText}>
                Elige otra opción de tu programa:
              </p>
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
              <button
                className={styles.secondaryBtn}
                onClick={() => setShowSwitchModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Sección RUTINA RECOMENDADA */}
        <div className={styles.sectionLabel}>RUTINA RECOMENDADA</div>

        {/* Card Rutina Recomendada - HERO */}
        <div className={styles.recommendedCard}>
          <div className={styles.recommendedHeader}>
            <span className={styles.recommendedBadge}>
              ✨ Para ti
            </span>
            {alreadyTrainedToday && (
              <span className={styles.trainedBadge}>✓ Entrenaste hoy</span>
            )}
          </div>

          <div className={styles.recommendedContent}>
            {programState && assignment && (
              <span className={styles.programBadge}>
                {formatTrackBadgeLabel(programState.active_track, assignment.dayType)}
              </span>
            )}

            <h2 className={styles.routineTitle}>
              {systemRoutine?.title || "Tu rutina del día"}
            </h2>

            <div className={styles.routineMeta}>
              <span className={styles.metaItem}>
                <span className={styles.metaIcon}>⏱️</span>
                {formatDuration(estimatedDuration)}
              </span>
              <span className={styles.metaDivider}>•</span>
              <span className={styles.metaItem}>
                <span className={styles.metaIcon}>🔥</span>
                Calentamiento
              </span>
            </div>
          </div>

          <div className={styles.recommendedActions}>
            <button className={styles.startBtn} onClick={handleStartNow}>
              <span>Empezar ahora</span>
              <span className={styles.startArrow}>→</span>
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

        {/* Sección MIS RUTINAS - Mejorada */}
        <div className={styles.myRoutinesSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>⭐</span>
              Mis Rutinas
            </h2>
            <button 
              className={styles.newRoutineBtn}
              onClick={() => navigate("/custom-routine/builder")}
            >
              + Nueva
            </button>
          </div>

          {userRoutines.length === 0 ? (
            <div className={styles.emptyRoutines}>
              <div className={styles.emptyIcon}>🎯</div>
              <h3 className={styles.emptyTitle}>Crea tu primera rutina</h3>
              <p className={styles.emptyText}>
                Diseña entrenamientos personalizados con tus ejercicios favoritos
              </p>
              <button 
                className={styles.createRoutineBtn}
                onClick={() => navigate("/custom-routine/builder")}
              >
                <span>✨</span> Crear rutina personalizada
              </button>
            </div>
          ) : (
            <div className={styles.routinesList}>
              {userRoutines.slice(0, 3).map((routine) => {
                const updatedDate = new Date(routine.updated_at);
                const isToday = updatedDate.toDateString() === new Date().toDateString();
                const timeLabel = isToday ? "Hoy" : updatedDate.toLocaleDateString("es", { day: "numeric", month: "short" });
                
                return (
                  <div key={routine.id} className={styles.routineCard}>
                    <div className={styles.routineCardContent}>
                      <h4 className={styles.routineCardTitle}>{routine.title}</h4>
                      <span className={styles.routineCardDate}>{timeLabel}</span>
                    </div>
                    <div className={styles.routineCardActions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => navigate(`/custom-routine/${routine.id}`)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className={styles.playBtn}
                        onClick={() => navigate(`/custom-routine/${routine.id}`)}
                        title="Entrenar"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {userRoutines.length > 3 && (
                <button 
                  className={styles.viewAllBtn}
                  onClick={() => navigate("/custom-routine/list")}
                >
                  Ver todas ({userRoutines.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
