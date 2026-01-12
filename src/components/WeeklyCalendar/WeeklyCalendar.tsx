import { useEffect, useState } from "react";
import styles from "./WeeklyCalendar.module.css";
import type { CalendarMark, CalendarMarkType } from "../../services/calendarService";
import { getWeekMarks, upsertMark } from "../../services/calendarService";

type DayData = {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNum: number;
  mark: CalendarMarkType | null;
  isToday: boolean;
};

type Props = {
  userId: string;
  onMarkChange?: () => void;
};

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const MARK_ICONS: Record<CalendarMarkType, string> = {
  TRAINED: "💪",
  REST: "😴",
  ACTIVE_REST: "🚶",
};

//const MARK_LABELS: Record<CalendarMarkType, string> = {
  //TRAINED: "Entrenado",
  //REST: "Descanso",
  //ACTIVE_REST: "Descanso activo",
//};

export default function WeeklyCalendar({ userId, onMarkChange }: Props) {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [marks, setMarks] = useState<Map<string, CalendarMarkType>>(new Map());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  useEffect(() => {
    buildWeek();
  }, []);

  useEffect(() => {
    if (days.length > 0) {
      fetchMarks();
    }
  }, [days, userId]);

  const buildWeek = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Obtener inicio de semana (domingo)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const weekDays: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push({
        date: d,
        dateStr: d.toISOString().split("T")[0],
        dayName: DAY_NAMES[d.getDay()],
        dayNum: d.getDate(),
        mark: null,
        isToday: d.toDateString() === today.toDateString(),
      });
    }

    setDays(weekDays);
  };

  const fetchMarks = async () => {
    if (!userId || days.length === 0) return;

    setLoading(true);
    const startDate = days[0].dateStr;
    const endDate = days[days.length - 1].dateStr;

    const res = await getWeekMarks(userId, startDate, endDate);
    
    if (res.data) {
      const markMap = new Map<string, CalendarMarkType>();
      res.data.forEach((m: CalendarMark) => {
        markMap.set(m.date, m.mark_type);
      });
      setMarks(markMap);
    }

    setLoading(false);
  };

  const handleDayClick = (day: DayData) => {
    // Solo permitir marcar días pasados o hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day.date > today) return;

    setSelectedDay(day);
    const existingMark = marks.get(day.dateStr);
    
    if (existingMark === "TRAINED") {
      setConfirmOverwrite(true);
    } else {
      setShowMarkModal(true);
    }
  };

  const handleMarkSelect = async (markType: CalendarMarkType) => {
    if (!selectedDay) return;

    const res = await upsertMark(userId, selectedDay.dateStr, markType);
    
    if (!res.error) {
      setMarks((prev) => {
        const next = new Map(prev);
        next.set(selectedDay.dateStr, markType);
        return next;
      });
      onMarkChange?.();
    }

    setShowMarkModal(false);
    setConfirmOverwrite(false);
    setSelectedDay(null);
  };

  const handleCancelModal = () => {
    setShowMarkModal(false);
    setConfirmOverwrite(false);
    setSelectedDay(null);
  };

  const getMarkIcon = (mark: CalendarMarkType | null) => {
    if (!mark) return null;
    return MARK_ICONS[mark];
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Esta semana</h3>
      </div>

      <div className={styles.week}>
        {days.map((day) => {
          const mark = marks.get(day.dateStr) || null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isFuture = day.date > today;

          return (
            <div
              key={day.dateStr}
              className={`${styles.day} ${day.isToday ? styles.today : ""} ${mark ? styles.marked : ""} ${isFuture ? styles.future : ""}`}
              onClick={() => handleDayClick(day)}
            >
              <span className={styles.dayName}>{day.dayName}</span>
              <span className={styles.dayNum}>{day.dayNum}</span>
              {loading ? (
                <span className={styles.dayMark}>·</span>
              ) : mark ? (
                <span className={styles.dayMark}>{getMarkIcon(mark)}</span>
              ) : (
                <span className={styles.dayMark}>·</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de selección de marca */}
      {showMarkModal && selectedDay && (
        <div className={styles.modalOverlay} onClick={handleCancelModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 className={styles.modalTitle}>
              Marcar {selectedDay.dayName} {selectedDay.dayNum}
            </h4>
            <div className={styles.markOptions}>
              <button
                className={styles.markOption}
                onClick={() => handleMarkSelect("REST")}
              >
                <span className={styles.markIcon}>😴</span>
                <span>Descanso</span>
              </button>
              <button
                className={styles.markOption}
                onClick={() => handleMarkSelect("ACTIVE_REST")}
              >
                <span className={styles.markIcon}>🚶</span>
                <span>Descanso activo</span>
              </button>
            </div>
            <button className={styles.cancelBtn} onClick={handleCancelModal}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación para sobrescribir TRAINED */}
      {confirmOverwrite && selectedDay && (
        <div className={styles.modalOverlay} onClick={handleCancelModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 className={styles.modalTitle}>¿Cambiar marca?</h4>
            <p className={styles.modalText}>
              Este día ya está marcado como entrenado. ¿Quieres cambiar la marca?
            </p>
            <div className={styles.markOptions}>
              <button
                className={styles.markOption}
                onClick={() => handleMarkSelect("REST")}
              >
                <span className={styles.markIcon}>😴</span>
                <span>Descanso</span>
              </button>
              <button
                className={styles.markOption}
                onClick={() => handleMarkSelect("ACTIVE_REST")}
              >
                <span className={styles.markIcon}>🚶</span>
                <span>Descanso activo</span>
              </button>
            </div>
            <button className={styles.cancelBtn} onClick={handleCancelModal}>
              Mantener entrenado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
