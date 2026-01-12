// ============================================
// AudioEnableModal.tsx
// Modal para activar audio en primer uso (iOS requirement)
// ============================================

import styles from "./AudioEnableModal.module.css";

type AudioEnableModalProps = {
  onEnable: () => void;
  onSkip: () => void;
};

export default function AudioEnableModal({ onEnable, onSkip }: AudioEnableModalProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.icon}>🔊</div>
        <h2 className={styles.title}>Activa el sonido</h2>
        <p className={styles.text}>
          Esta app usa beeps para guiarte en cambios de serie y descanso. Recomendado usar audífonos.
        </p>
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={onEnable}>
            Activar sonido
          </button>
          <button className={styles.secondaryBtn} onClick={onSkip}>
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
