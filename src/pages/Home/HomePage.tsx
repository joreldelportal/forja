// ============================================
// HOME PAGE - Tab Inicio
// Rol: Estado del usuario + motivación + memoria
// NO es para elegir rutina, solo punto de entrada
// ============================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { getMyProfile } from "../../services/profileService";
import type { Profile } from "../../services/profileService";
import { getWorkoutsForWeek, type WorkoutDay } from "../../services/workoutSessionService";
import WorkoutCalendar from "../../components/WorkoutCalendar/WorkoutCalendar";
import CoachTipsCarousel from "../../components/CoachTipsCarousel/CoachTipsCarousel";
import styles from "./HomePage.module.css";

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [_profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Stats de la semana
  const [trainedThisWeek, setTrainedThisWeek] = useState(0);
  const [streak, setStreak] = useState(0);
  
  // Workout de hoy (si existe)
  const [todayWorkout, setTodayWorkout] = useState<WorkoutDay | null>(null);

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

        // 2. Obtener workouts de la semana (de workout_sessions)
        const today = new Date().toISOString().split("T")[0];
        const weekWorkouts = await getWorkoutsForWeek(user.id, today);
        
        if (weekWorkouts.data) {
          // Contar entrenamientos de la semana
          setTrainedThisWeek(weekWorkouts.data.length);
          
          // Verificar si entrenó hoy
          const todayEntry = weekWorkouts.data.find(w => w.workout_date === today);
          if (todayEntry) {
            setTodayWorkout(todayEntry);
          }
          
          // Calcular racha (simplificado: días consecutivos hasta hoy)
          setStreak(calculateStreak(weekWorkouts.data, today));
        }

      } catch (err) {
        console.error("Error loading home:", err);
        setError("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  // Calcular racha de días consecutivos
  const calculateStreak = (workouts: WorkoutDay[], today: string): number => {
    if (workouts.length === 0) return 0;
    
    const sortedDates = workouts
      .map(w => w.workout_date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    let streak = 0;
    const todayDate = new Date(today);
    
    for (let i = 0; i < sortedDates.length; i++) {
      const expectedDate = new Date(todayDate);
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedStr = expectedDate.toISOString().split("T")[0];
      
      if (sortedDates.includes(expectedStr)) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  // Saludo dinámico según hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  // Navegar al tab Entrenar (NO inicia rutina directamente)
  const handleGoToTrain = () => {
    navigate("/train");
  };

  // Mensaje contextual según si entrenó hoy
  const getContextMessage = () => {
    if (todayWorkout) {
      return {
        title: "¡Buen trabajo! 💪",
        subtitle: `Hoy entrenaste ${todayWorkout.label || "tu rutina"}`,
        buttonText: "Entrenar de nuevo",
      };
    }
    return {
      title: "¿Listo para entrenar?",
      subtitle: "Hoy aún no entrenas",
      buttonText: "Empezar entrenamiento",
    };
  };

  const contextMessage = getContextMessage();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <span className={styles.spinner}></span>
          <p>Cargando...</p>
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
          <span className={styles.greeting}>{getGreeting()}</span>
          <h1 className={styles.title}>{contextMessage.title}</h1>
          <p className={styles.subtitle}>{contextMessage.subtitle}</p>
        </div>

        {/* Quick Stats */}
        {(streak > 0 || trainedThisWeek > 0) && (
          <div className={styles.statsRow}>
            {streak > 0 && (
              <div className={styles.statBadge}>
                <span className={styles.statIcon}>🔥</span>
                <span className={styles.statValue}>{streak}</span>
                <span className={styles.statLabel}>racha</span>
              </div>
            )}
            {trainedThisWeek > 0 && (
              <div className={styles.statBadge}>
                <span className={styles.statIcon}>💪</span>
                <span className={styles.statValue}>{trainedThisWeek}</span>
                <span className={styles.statLabel}>esta semana</span>
              </div>
            )}
          </div>
        )}

        {/* ========================================
            TARJETA CTA PRINCIPAL
            ======================================== */}
        <div className={styles.ctaCard} onClick={handleGoToTrain}>
          <div className={styles.ctaCardContent}>
            <div className={styles.ctaIconWrapper}>
              <span className={styles.ctaIconBg}>💪</span>
            </div>
            <div className={styles.ctaTextWrapper}>
              <h2 className={styles.ctaTitle}>{contextMessage.buttonText}</h2>
              <p className={styles.ctaSubtitle}>
                {todayWorkout 
                  ? "¿Otra ronda? ¡Vamos!" 
                  : "Tu rutina del día te espera"
                }
              </p>
            </div>
            <span className={styles.ctaArrow}>→</span>
          </div>
          <div className={styles.ctaGlow}></div>
        </div>

        {/* ========================================
            CARRUSEL FUNCIONALIDADES ÚNICAS
            ======================================== */}
        <CoachTipsCarousel />

        {/* Calendario Semanal con Labels */}
        {user && (
          <div className={styles.calendarSection}>
            <h2 className={styles.sectionTitle}>Tu semana</h2>
            <WorkoutCalendar userId={user.id} />
            
            {trainedThisWeek === 0 && (
              <p className={styles.calendarHint}>
                Completa tu primer entrenamiento y empieza tu racha 🔥
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
