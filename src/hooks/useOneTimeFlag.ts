// ============================================
// useOneTimeFlag.ts
// Hook para manejar flags que solo se muestran una vez
// Usa localStorage con claves versionadas
// ============================================

import { useState, useCallback } from "react";

const STORAGE_PREFIX = "forja.";

export type FlagKey =
  | "audioOnboardingDone"
  | "playerPauseTipDismissed"
  | "coachTipsDismissed"
  | "backgroundPauseTipDismissed";

/**
 * Hook para manejar un flag persistente que solo se muestra una vez
 */
export function useOneTimeFlag(key: FlagKey): [boolean, () => void] {
  const storageKey = STORAGE_PREFIX + key;

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "true");
      setIsDismissed(true);
    } catch (e) {
      console.error("Error saving flag to localStorage:", e);
    }
  }, [storageKey]);

  return [isDismissed, dismiss];
}

/**
 * Funciones helper para uso fuera de componentes
 */
export function getFlag(key: FlagKey): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === "true";
  } catch {
    return false;
  }
}

export function setFlag(key: FlagKey, value: boolean = true): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value ? "true" : "false");
  } catch (e) {
    console.error("Error saving flag:", e);
  }
}

export function clearFlag(key: FlagKey): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (e) {
    console.error("Error clearing flag:", e);
  }
}
