// ============================================
// CoachTipsCarousel.tsx
// Carrusel horizontal de funcionalidades únicas
// Auto-scroll cada 4 segundos con loop infinito
// ============================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useOneTimeFlag } from "../../hooks/useOneTimeFlag";
import styles from "./CoachTipsCarousel.module.css";

type Tip = {
  icon: string;
  title: string;
  description: string;
};

const TIPS: Tip[] = [
  {
    icon: "🔔",
    title: "Audio guía tu entrenamiento",
    description: "Beeps te avisan cambios de serie y descanso. Usa audífonos para mejor experiencia.",
  },
  {
    icon: "⏱️",
    title: "El timer controla todo",
    description: "No cuentas reps manualmente. El timer estima 2 seg por rep para mantener el flow.",
  },
  {
    icon: "📱",
    title: "Pausa automática",
    description: "Si sales de la app, tu rutina se pausa. Al volver, continúas donde quedaste.",
  },
  {
    icon: "🎯",
    title: "Rutinas personalizadas",
    description: "El sistema elige tu rutina según tu perfil, objetivos y contexto de entrenamiento.",
  },
];

const AUTO_SCROLL_INTERVAL = 4000; // 4 segundos

export default function CoachTipsCarousel() {
  const [isDismissed, dismiss] = useOneTimeFlag("coachTipsDismissed");
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll al índice actual
  const scrollToIndex = useCallback((index: number) => {
    if (!carouselRef.current) return;
    const cards = carouselRef.current.children;
    if (cards[index]) {
      const card = cards[index] as HTMLElement;
      carouselRef.current.scrollTo({
        left: card.offsetLeft - 8,
        behavior: "smooth",
      });
    }
  }, []);

  // Ir al siguiente (con loop)
  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = (prev + 1) % TIPS.length;
      return next;
    });
  }, []);

  // Ir al anterior (con loop)
  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev === 0 ? TIPS.length - 1 : prev - 1;
      return next;
    });
  }, []);

  // Toggle pausa
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (isDismissed || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      goNext();
    }, AUTO_SCROLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isDismissed, isPaused, goNext]);

  // Scroll cuando cambia el índice
  useEffect(() => {
    scrollToIndex(currentIndex);
  }, [currentIndex, scrollToIndex]);

  if (isDismissed) {
    return null;
  }

  const handleDismissClick = () => {
    setShowDismissConfirm(true);
  };

  const handleConfirmDismiss = () => {
    dismiss();
  };

  const handleCancelDismiss = () => {
    setShowDismissConfirm(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>✨</span>
        <span className={styles.headerTitle}>Funcionalidades únicas</span>
        <button className={styles.dismissBtn} onClick={handleDismissClick}>
          ✕
        </button>
      </div>

      <div className={styles.carousel} ref={carouselRef}>
        {TIPS.map((tip, index) => (
          <div 
            key={index} 
            className={`${styles.card} ${index === currentIndex ? styles.activeCard : ""}`}
          >
            <span className={styles.cardIcon}>{tip.icon}</span>
            <h3 className={styles.cardTitle}>{tip.title}</h3>
            <p className={styles.cardDesc}>{tip.description}</p>
          </div>
        ))}
      </div>

      {/* Controles del carrusel */}
      <div className={styles.controls}>
        <button className={styles.controlBtn} onClick={goPrev} aria-label="Anterior">
          ←
        </button>
        <div className={styles.indicators}>
          {TIPS.map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${index === currentIndex ? styles.activeDot : ""}`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Ir a tip ${index + 1}`}
            />
          ))}
        </div>
        <button 
          className={`${styles.controlBtn} ${isPaused ? styles.pausedBtn : ""}`} 
          onClick={togglePause}
          aria-label={isPaused ? "Reanudar" : "Pausar"}
        >
          {isPaused ? "▶" : "⏸"}
        </button>
        <button className={styles.controlBtn} onClick={goNext} aria-label="Siguiente">
          →
        </button>
      </div>

      {showDismissConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.confirmText}>¿Ocultar tips permanentemente?</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmYes} onClick={handleConfirmDismiss}>
                Sí, ocultar
              </button>
              <button className={styles.confirmNo} onClick={handleCancelDismiss}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
