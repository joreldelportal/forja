// ============================================
// WORKOUT CALENDAR
// Lee directamente de workout_sessions (NO calendar_marks)
// Muestra 🔥 + label para días entrenados
// ============================================

import { useEffect, useState } from "react";
import { getWorkoutsForWeek, type WorkoutDay } from "../../services/workoutSessionService";
import styles from "./WorkoutCalendar.module.css";

interface WorkoutCalendarProps {
  userId: string;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function WorkoutCalendar({ userId }: WorkoutCalendarProps) {
  const [workouts, setWorkouts] = useState<WorkoutDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekDays, setWeekDays] = useState<Date[]>([]);

  useEffect(() => {
    // Calcular los 7 días de la semana actual (Lun-Dom)
    const today = new Date();
    const currentDay = today.getDay(); // 0=Dom, 1=Lun, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      days.push(day);
    }
    setWeekDays(days);

    // Cargar workouts de la semana
    const loadWorkouts = async () => {
      setLoading(true);
      const todayStr = today.toISOString().split("T")[0];
      const result = await getWorkoutsForWeek(userId, todayStr);
      
      if (result.data) {
        setWorkouts(result.data);
      }
      setLoading(false);
    };

    loadWorkouts();
  }, [userId]);

  // Verificar si un día tiene workout
  const getWorkoutForDay = (date: Date): WorkoutDay | undefined => {
    const dateStr = date.toISOString().split("T")[0];
    return workouts.find(w => w.workout_date === dateStr);
  };

  // Verificar si es hoy
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Verificar si es futuro
  const isFuture = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  // Formatear label corto para el calendario
  const formatShortLabel = (workout: WorkoutDay): string => {
    // Si tiene label, usarlo
    if (workout.label) {
      // Acortar si es muy largo (ej: "PPL · Pull" -> "Pull")
      const parts = workout.label.split(" · ");
      if (parts.length > 1) {
        return parts[1]; // Mostrar solo la segunda parte
      }
      return workout.label.length > 8 ? workout.label.slice(0, 8) + "…" : workout.label;
    }
    
    // Fallback: usar day_label o program_key
    if (workout.day_label) {
      return workout.day_label.length > 8 ? workout.day_label.slice(0, 8) + "…" : workout.day_label;
    }
    
    if (workout.program_key) {
      return workout.program_key;
    }
    
    return "Entreno";
  };

  if (loading) {
    return (
      <div className={styles.calendar}>
        <div className={styles.loading}>
          <span className={styles.spinner}></span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.weekGrid}>
        {weekDays.map((date, index) => {
          const workout = getWorkoutForDay(date);
          const today = isToday(date);
          const future = isFuture(date);
          const dayName = DAY_NAMES[(index + 1) % 7]; // Ajustar para empezar en Lun
          
          return (
            <div
              key={date.toISOString()}
              className={`
                ${styles.dayCell}
                ${today ? styles.today : ""}
                ${workout ? styles.trained : ""}
                ${future ? styles.future : ""}
              `}
            >
              {/* Nombre del día */}
              <span className={styles.dayName}>{dayName}</span>
              
              {/* Número del día */}
              <span className={styles.dayNumber}>{date.getDate()}</span>
              
              {/* Indicador de entrenamiento */}
              <div className={styles.indicator}>
                {workout ? (
                  <>
                    <span className={styles.fireIcon}>🔥</span>
                    <span className={styles.workoutLabel}>
                      {formatShortLabel(workout)}
                    </span>
                  </>
                ) : future ? (
                  <span className={styles.emptyDot}>○</span>
                ) : (
                  <span className={styles.restDot}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
