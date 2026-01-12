import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { getMyProfile } from "../../services/profileService";
import type { Profile } from "../../services/profileService";
import { getStreak } from "../../services/calendarService";
import {
  labelAge,
  labelExp,
  labelContext,
  labelPriority,
} from "../../lib/labels";
import styles from "./ProfilePage.module.css";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [trainedThisWeek, setTrainedThisWeek] = useState(0);
  const [_totalWorkouts, setTotalWorkouts] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      const result = await getMyProfile(user.id);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (!result.data) {
        navigate("/onboarding", { replace: true });
        return;
      }

      setProfile(result.data);

      // Fetch streak data
      const streakRes = await getStreak(user.id);
      if (streakRes.data) {
        setStreak(streakRes.data.streak);
        setTrainedThisWeek(streakRes.data.trainedThisWeek);
        // TODO: Agregar totalWorkouts cuando esté disponible en el servicio
        setTotalWorkouts(streakRes.data.trainedThisWeek * 4); // Placeholder
      }

      setLoading(false);
    };

    fetchData();
  }, [user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleEditProfile = () => {
    navigate("/onboarding", { state: { isEditing: true } });
  };

  // Navegar a páginas legales
  const handleOpenTerms = () => {
    navigate("/legal?tab=terms");
  };

  const handleOpenPrivacy = () => {
    navigate("/legal?tab=privacy");
  };

  const handleOpenDisclaimer = () => {
    navigate("/legal?tab=disclaimer");
  };

  // Obtener inicial del email para avatar
  const getInitial = () => {
    if (!user?.email) return "?";
    return user.email.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <span className={styles.spinner}></span>
          <p>Cargando perfil...</p>
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
        {/* Header con avatar */}
        <div className={styles.header}>
          <div className={styles.avatar}>
            <span className={styles.avatarInitial}>{getInitial()}</span>
          </div>
          <h1 className={styles.title}>Mi Perfil</h1>
          <p className={styles.email}>{user?.email}</p>
        </div>

        {/* Stats */}
        <div className={styles.statsSection}>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>🔥</span>
            <span className={styles.statValue}>{streak}</span>
            <span className={styles.statLabel}>Racha actual</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>💪</span>
            <span className={styles.statValue}>{trainedThisWeek}</span>
            <span className={styles.statLabel}>Esta semana</span>
          </div>
        </div>

        {/* Perfil Fitness */}
        {profile && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Perfil Fitness</h2>
              <button className={styles.editBtn} onClick={handleEditProfile}>
                Editar
              </button>
            </div>

            <div className={styles.profileCard}>
              <div className={styles.profileRow}>
                <span className={styles.profileIcon}>🎯</span>
                <div className={styles.profileInfo}>
                  <span className={styles.profileLabel}>Objetivo principal</span>
                  <span className={styles.profileValue}>{labelPriority(profile.priority1)}</span>
                </div>
              </div>

              {profile.priority2 && (
                <div className={styles.profileRow}>
                  <span className={styles.profileIcon}>🎯</span>
                  <div className={styles.profileInfo}>
                    <span className={styles.profileLabel}>Objetivo secundario</span>
                    <span className={styles.profileValue}>{labelPriority(profile.priority2)}</span>
                  </div>
                </div>
              )}

              <div className={styles.profileRow}>
                <span className={styles.profileIcon}>💪</span>
                <div className={styles.profileInfo}>
                  <span className={styles.profileLabel}>Experiencia</span>
                  <span className={styles.profileValue}>{labelExp(profile.experience_range)}</span>
                </div>
              </div>

              <div className={styles.profileRow}>
                <span className={styles.profileIcon}>🏋️</span>
                <div className={styles.profileInfo}>
                  <span className={styles.profileLabel}>Entreno en</span>
                  <span className={styles.profileValue}>{labelContext(profile.training_context)}</span>
                </div>
              </div>

              <div className={styles.profileRow}>
                <span className={styles.profileIcon}>📅</span>
                <div className={styles.profileInfo}>
                  <span className={styles.profileLabel}>Edad</span>
                  <span className={styles.profileValue}>{labelAge(profile.age_range)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuración */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Configuración</h2>

          <div className={styles.menuList}>
            <button className={styles.menuItem} onClick={handleOpenTerms}>
              <span className={styles.menuIcon}>📜</span>
              <span className={styles.menuText}>Términos de servicio</span>
              <span className={styles.menuArrow}>›</span>
            </button>

            <button className={styles.menuItem} onClick={handleOpenPrivacy}>
              <span className={styles.menuIcon}>🔒</span>
              <span className={styles.menuText}>Política de privacidad</span>
              <span className={styles.menuArrow}>›</span>
            </button>

            <button className={styles.menuItem} onClick={handleOpenDisclaimer}>
              <span className={styles.menuIcon}>⚠️</span>
              <span className={styles.menuText}>Disclaimer de salud</span>
              <span className={styles.menuArrow}>›</span>
            </button>

            <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleSignOut}>
              <span className={styles.menuIcon}>🚪</span>
              <span className={styles.menuText}>Cerrar sesión</span>
              <span className={styles.menuArrow}>›</span>
            </button>
          </div>
        </div>

        {/* Footer con versión */}
        <div className={styles.footer}>
          <p className={styles.version}>Forja v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
