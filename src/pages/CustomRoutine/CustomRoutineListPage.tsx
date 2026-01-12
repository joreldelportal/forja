import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  getUserRoutines,
  deleteUserRoutine,
  routineHasExpiredExercises,
  type UserRoutine,
} from "../../services/customRoutineService";
import styles from "./CustomRoutineList.module.css";

type RoutineWithStatus = UserRoutine & {
  hasExpired: boolean;
  expiredCount: number;
};

export default function CustomRoutineListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [routines, setRoutines] = useState<RoutineWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const loadRoutines = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      const result = await getUserRoutines(user.id);
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Check for expired exercises in each routine
      const routinesWithStatus: RoutineWithStatus[] = [];
      
      for (const routine of result.data || []) {
        const expiredCheck = await routineHasExpiredExercises(routine.id);
        routinesWithStatus.push({
          ...routine,
          hasExpired: expiredCheck.hasExpired,
          expiredCount: expiredCheck.expiredCount,
        });
      }

      setRoutines(routinesWithStatus);
      setLoading(false);
    };

    loadRoutines();
  }, [user]);

  const handleCreateNew = () => {
    navigate("/custom-routine/builder");
  };

  const handleEdit = (routineId: string) => {
    navigate(`/custom-routine/${routineId}`);
  };

  const handleStart = (routineId: string, hasExpired: boolean) => {
    if (hasExpired) {
      setError("Esta rutina tiene ejercicios expirados. Edítala para reemplazarlos.");
      return;
    }
    navigate(`/custom-routine/${routineId}/start`);
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

    setRoutines(prev => prev.filter(r => r.id !== showDeleteConfirm));
    setDeletingId(null);
  };

  const handleBack = () => {
    navigate("/plan");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <span className={styles.spinner}></span>
          <p>Cargando tus rutinas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Volver
          </button>
          <h1 className={styles.title}>Mis Rutinas</h1>
          <p className={styles.subtitle}>
            Tus rutinas personalizadas
          </p>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠️</span> {error}
            <button className={styles.dismissBtn} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <button className={styles.createBtn} onClick={handleCreateNew}>
          <span className={styles.createIcon}>+</span>
          Crear nueva rutina
        </button>

        {routines.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📋</div>
            <h3 className={styles.emptyTitle}>No tienes rutinas</h3>
            <p className={styles.emptyText}>
              Crea tu primera rutina personalizada seleccionando tus ejercicios favoritos.
            </p>
          </div>
        ) : (
          <div className={styles.routineList}>
            {routines.map(routine => (
              <div 
                key={routine.id} 
                className={`${styles.routineCard} ${routine.hasExpired ? styles.hasExpired : ""}`}
              >
                <div className={styles.routineInfo}>
                  <h3 className={styles.routineName}>{routine.title}</h3>
                  <p className={styles.routineDate}>
                    Creada: {formatDate(routine.created_at)}
                  </p>
                  {routine.hasExpired && (
                    <div className={styles.expiredWarning}>
                      ⚠️ {routine.expiredCount} ejercicio(s) expirado(s)
                    </div>
                  )}
                </div>
                
                <div className={styles.routineActions}>
                  <button
                    className={styles.startBtn}
                    onClick={() => handleStart(routine.id, routine.hasExpired)}
                    disabled={routine.hasExpired || deletingId === routine.id}
                  >
                    ▶
                  </button>
                  <button
                    className={styles.editBtn}
                    onClick={() => handleEdit(routine.id)}
                    disabled={deletingId === routine.id}
                  >
                    ✏️
                  </button>
                  <button
                    className={styles.deleteBtn}
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

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>🗑</div>
            <h3 className={styles.modalTitle}>¿Eliminar rutina?</h3>
            <p className={styles.modalText}>
              Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalDeleteBtn}
                onClick={handleConfirmDelete}
              >
                Sí, eliminar
              </button>
              <button
                className={styles.modalCancelBtn}
                onClick={() => setShowDeleteConfirm(null)}
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
