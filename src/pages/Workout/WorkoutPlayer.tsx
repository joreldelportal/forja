import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  updateWorkoutSession,
  finalizeWorkoutSession,
  type FinalizeSessionParams,
} from "../../services/workoutSessionService";
import type { BlockType } from "../../services/routineService";
import {
  initAudio,
  forceUnlock,
  isAudioReady,
  isSoundEnabled,
  setSoundEnabled,
  beepShort,
  beepStartWork,
  beepStartRest,
  beepFinishWorkout,
  beepOnce,
  resetBeepGuard,
} from "../../lib/workoutAudio";
import {
  loadWorkoutSession,
  saveWorkoutSession,
  clearWorkoutSession,
  generateStepsSignature,
  calculateStepRemaining,
  type PersistedWorkoutSession,
} from "../../lib/workoutSessionStorage";
import { useOneTimeFlag } from "../../hooks/useOneTimeFlag";
import AudioEnableModal from "../../components/AudioEnableModal/AudioEnableModal";
import styles from "./WorkoutPlayer.module.css";

// ============================================
// TIPOS
// ============================================

type StepKind = "COUNTDOWN" | "WORK" | "REST";

type Step = {
  stepIndex: number;
  kind: StepKind;
  blockType: BlockType;
  exerciseId: string | null;
  exerciseName: string;
  durationSec: number;
  setNumber?: number;
  totalSets?: number;
  reps?: number;
  isLastSetOfExercise?: boolean;
};

type PlayerStatus = "READY" | "RUNNING" | "PAUSED" | "FINISHED" | "ABORTED";

type RoutineBlock = {
  id: string;
  order_index: number;
  block_type: BlockType;
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  seconds_per_rep: number | null;
  work_seconds: number | null;
  rest_seconds: number | null;
  exercise?: {
    id: string;
    name: string;
    instructions_short: string | null;
  };
};

type WorkoutPlayerProps = {
  sessionId: string;
  userId: string;
  routineTitle: string;
  blocks: RoutineBlock[];
  hasWarmup: boolean;
  initialSkipWarmup?: boolean;
  source?: "recommended" | "custom";
  programKey?: string;
  dayKey?: string;
  systemRoutineId?: string;
  userRoutineId?: string;
};

// ============================================
// CONSTANTES
// ============================================

const SECONDS_PER_REP = 2;
const COUNTDOWN_BETWEEN_EXERCISES = 3;
const PERSIST_INTERVAL_MS = 5000;

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  WARMUP: "Calentamiento",
  STANDARD: "Ejercicio",
  FINISHER: "Finisher",
  CARDIO: "Cardio",
  REGEN: "Recuperación",
};

// ============================================
// HELPERS
// ============================================

function buildSteps(blocks: RoutineBlock[], skipWarmup: boolean): Step[] {
  const steps: Step[] = [];
  let stepIndex = 0;

  const activeBlocks = skipWarmup
    ? blocks.filter((b) => b.block_type !== "WARMUP")
    : blocks;

  if (activeBlocks.length === 0) return steps;

  for (let blockIdx = 0; blockIdx < activeBlocks.length; blockIdx++) {
    const block = activeBlocks[blockIdx];
    const sets = block.sets || 1;
    const reps = block.reps || 0;
    const restSec = block.rest_seconds || 60;
    
    let workDuration: number;
    if (block.work_seconds) {
      workDuration = block.work_seconds;
    } else if (reps > 0) {
      workDuration = reps * SECONDS_PER_REP;
    } else {
      workDuration = 30;
    }

    const exerciseName = block.exercise?.name || "Ejercicio";
    const isFirstBlock = blockIdx === 0;
    const isLastBlock = blockIdx === activeBlocks.length - 1;

    if (isFirstBlock) {
      steps.push({
        stepIndex: stepIndex++,
        kind: "COUNTDOWN",
        blockType: block.block_type,
        exerciseId: block.exercise_id,
        exerciseName: exerciseName,
        durationSec: COUNTDOWN_BETWEEN_EXERCISES,
      });
    }

    for (let setNum = 1; setNum <= sets; setNum++) {
      const isLastSet = setNum === sets;

      steps.push({
        stepIndex: stepIndex++,
        kind: "WORK",
        blockType: block.block_type,
        exerciseId: block.exercise_id,
        exerciseName,
        durationSec: workDuration,
        setNumber: setNum,
        totalSets: sets,
        reps: reps > 0 ? reps : undefined,
        isLastSetOfExercise: isLastSet,
      });

      if (!isLastSet && restSec > 0) {
        steps.push({
          stepIndex: stepIndex++,
          kind: "REST",
          blockType: block.block_type,
          exerciseId: block.exercise_id,
          exerciseName: exerciseName,
          durationSec: restSec,
        });
      }

      if (isLastSet && !isLastBlock) {
        const nextBlock = activeBlocks[blockIdx + 1];
        const nextExerciseName = nextBlock.exercise?.name || "Ejercicio";

        if (restSec > 0) {
          steps.push({
            stepIndex: stepIndex++,
            kind: "REST",
            blockType: block.block_type,
            exerciseId: block.exercise_id,
            exerciseName: exerciseName,
            durationSec: restSec,
          });
        }

        steps.push({
          stepIndex: stepIndex++,
          kind: "COUNTDOWN",
          blockType: nextBlock.block_type,
          exerciseId: nextBlock.exercise_id,
          exerciseName: nextExerciseName,
          durationSec: COUNTDOWN_BETWEEN_EXERCISES,
        });
      }
    }
  }

  return steps;
}

// ============================================
// COMPONENTE
// ============================================

export default function WorkoutPlayer({
  sessionId,
  userId,
  routineTitle,
  blocks,
  hasWarmup,
  initialSkipWarmup = false,
  source = "recommended",
  programKey,
  dayKey,
  systemRoutineId,
  userRoutineId,
}: WorkoutPlayerProps) {
  const navigate = useNavigate();

  const [status, setStatus] = useState<PlayerStatus>("READY");
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [skipWarmup, setSkipWarmup] = useState(initialSkipWarmup);
  const [showWarmupPrompt, setShowWarmupPrompt] = useState(hasWarmup && !initialSkipWarmup);

  const [stepRemaining, setStepRemaining] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  
  // Refs para timestamps (modelo timestamp-driven)
  const workoutStartedAtRef = useRef<number>(0);
  const totalAccumulatedRef = useRef<number>(0);
  const stepStartedAtRef = useRef<number>(0);
  const stepOriginalDurationRef = useRef<number>(0);
  const stepAccumulatedRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Audio state
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled());
  const [_audioReady, setAudioReady] = useState(isAudioReady());
  const lastBeepSecondRef = useRef<number>(-1);
  const lastStepIndexRef = useRef<number>(-1);

  // ============================================
  // ONE-TIME FLAGS Y MODALES
  // ============================================
  const [audioOnboardingDone, dismissAudioOnboarding] = useOneTimeFlag("audioOnboardingDone");
  const [pauseTipDismissed, dismissPauseTip] = useOneTimeFlag("backgroundPauseTipDismissed");
  
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const pausedByBackgroundRef = useRef(false);

  // ============================================
  // REHIDRATACIÓN - Estado
  // ============================================
  const [showRehydrateModal, setShowRehydrateModal] = useState(false);
  const [pendingRehydration, setPendingRehydration] = useState<PersistedWorkoutSession | null>(null);
  const hasCheckedPersistedRef = useRef(false);
  const persistIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ============================================
  // PERSISTENCIA - Helpers
  // ============================================
  
  const persistCurrentState = useCallback((
    overrideStatus?: "RUNNING" | "PAUSED",
    overrideStepIndex?: number
  ) => {
    const now = Date.now();
    const currentStatus = overrideStatus || (status === "RUNNING" ? "RUNNING" : "PAUSED");
    const stepIndex = overrideStepIndex ?? currentStepIndex;
    
    let currentTotalAccumulated = totalAccumulatedRef.current;
    let currentStepAccumulated = stepAccumulatedRef.current;
    
    if (status === "RUNNING" && !overrideStatus) {
      currentTotalAccumulated += now - workoutStartedAtRef.current;
      currentStepAccumulated += now - stepStartedAtRef.current;
    }
    
    const data: PersistedWorkoutSession = {
      sessionId,
      status: currentStatus,
      currentStepIndex: stepIndex,
      skipWarmup,
      stepsSignature: generateStepsSignature(blocks, skipWarmup),
      workoutStartedAtMs: workoutStartedAtRef.current,
      totalAccumulatedMs: currentTotalAccumulated,
      stepStartedAtMs: stepStartedAtRef.current,
      stepOriginalDurationSec: stepOriginalDurationRef.current,
      stepAccumulatedMs: currentStepAccumulated,
      updatedAtMs: now,
    };
    
    console.log("[WorkoutPlayer] Persisting state:", { sessionId, status: currentStatus, stepIndex });
    saveWorkoutSession(sessionId, data);
  }, [sessionId, status, currentStepIndex, skipWarmup, blocks]);

  const clearPersistedState = useCallback(() => {
    clearWorkoutSession(sessionId);
    if (persistIntervalRef.current) {
      clearInterval(persistIntervalRef.current);
      persistIntervalRef.current = null;
    }
  }, [sessionId]);

  const rehydrateFromPersisted = useCallback((persisted: PersistedWorkoutSession) => {
    const now = Date.now();
    const rehydratedSteps = buildSteps(blocks, persisted.skipWarmup);
    
    if (persisted.currentStepIndex >= rehydratedSteps.length) {
      console.warn("[WorkoutPlayer] Invalid step index in persisted session");
      clearPersistedState();
      return false;
    }
    
    setSkipWarmup(persisted.skipWarmup);
    setSteps(rehydratedSteps);
    setCurrentStepIndex(persisted.currentStepIndex);
    
    workoutStartedAtRef.current = now;
    totalAccumulatedRef.current = persisted.totalAccumulatedMs;
    stepStartedAtRef.current = now;
    stepOriginalDurationRef.current = persisted.stepOriginalDurationSec;
    stepAccumulatedRef.current = persisted.stepAccumulatedMs;
    
    const remaining = calculateStepRemaining(persisted, now);
    setStepRemaining(remaining);
    setTotalElapsed(Math.floor(persisted.totalAccumulatedMs / 1000));
    
    resetBeepGuard();
    lastBeepSecondRef.current = -1;
    lastStepIndexRef.current = persisted.currentStepIndex;
    
    setStatus("PAUSED");
    setShowResumeModal(true);
    
    console.log("[WorkoutPlayer] Rehydrated from persisted session", {
      stepIndex: persisted.currentStepIndex,
      remaining,
    });
    
    return true;
  }, [blocks, clearPersistedState]);

  // ============================================
  // EFFECTS
  // ============================================

  // Verificar sesión persistida al montar
  useEffect(() => {
    console.log("[WorkoutPlayer] Checking for persisted session...", { sessionId, hasChecked: hasCheckedPersistedRef.current });
    
    if (hasCheckedPersistedRef.current) return;
    hasCheckedPersistedRef.current = true;
    
    const persisted = loadWorkoutSession(sessionId);
    console.log("[WorkoutPlayer] Loaded persisted session:", persisted);
    
    if (persisted) {
      const currentSignature = generateStepsSignature(blocks, persisted.skipWarmup);
      console.log("[WorkoutPlayer] Signatures:", { stored: persisted.stepsSignature, current: currentSignature });
      
      if (persisted.stepsSignature !== currentSignature) {
        console.warn("[WorkoutPlayer] Steps signature mismatch, clearing");
        clearPersistedState();
        return;
      }
      
      setPendingRehydration(persisted);
      setShowRehydrateModal(true);
    }
  }, [sessionId, blocks, clearPersistedState]);

  // Construir steps
  useEffect(() => {
    if (!showWarmupPrompt && !showRehydrateModal && blocks.length > 0 && steps.length === 0) {
      const generatedSteps = buildSteps(blocks, skipWarmup);
      setSteps(generatedSteps);
      if (generatedSteps.length > 0) {
        setStepRemaining(generatedSteps[0].durationSec);
        stepOriginalDurationRef.current = generatedSteps[0].durationSec;
      }
    }
  }, [blocks, skipWarmup, showWarmupPrompt, showRehydrateModal, steps.length]);

  // Visibilitychange
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && status === "RUNNING") {
        persistCurrentState("PAUSED");
        pausedByBackgroundRef.current = true;
        handlePause();
      } else if (document.visibilityState === "visible" && status === "PAUSED" && pausedByBackgroundRef.current) {
        setShowResumeModal(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [status, persistCurrentState]);

  // Animation frame loop
  useEffect(() => {
    if (status !== "RUNNING") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const tick = () => {
      const now = Date.now();
      
      const totalNowMs = totalAccumulatedRef.current + (now - workoutStartedAtRef.current);
      setTotalElapsed(Math.floor(totalNowMs / 1000));
      
      const stepElapsedMs = stepAccumulatedRef.current + (now - stepStartedAtRef.current);
      const stepDurationMs = stepOriginalDurationRef.current * 1000;
      const remainingMs = Math.max(0, stepDurationMs - stepElapsedMs);
      const remainingCeil = Math.ceil(remainingMs / 1000);
      setStepRemaining(remainingCeil);
      
      if (soundEnabled && remainingCeil !== lastBeepSecondRef.current) {
        lastBeepSecondRef.current = remainingCeil;
        if (remainingCeil === 3 || remainingCeil === 2 || remainingCeil === 1) {
          beepOnce(`countdown-${currentStepIndex}-${remainingCeil}`, beepShort);
        }
      }
      
      if (remainingMs <= 0) {
        goToNextStep();
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [status, currentStepIndex, soundEnabled]);

  // Auto-save periódico
  useEffect(() => {
    if (status === "RUNNING") {
      persistIntervalRef.current = setInterval(() => {
        persistCurrentState();
      }, PERSIST_INTERVAL_MS);
    } else {
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current);
        persistIntervalRef.current = null;
      }
    }
    
    return () => {
      if (persistIntervalRef.current) clearInterval(persistIntervalRef.current);
    };
  }, [status, persistCurrentState]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleWarmupChoice = (skip: boolean) => {
    setSkipWarmup(skip);
    setShowWarmupPrompt(false);
  };

  const handleContinueRehydration = async () => {
    setShowRehydrateModal(false);
    
    if (pendingRehydration) {
      try {
        await initAudio();
        await forceUnlock();
      } catch (error) {
        console.error("[WorkoutPlayer] Audio init on rehydrate failed:", error);
      }
      
      rehydrateFromPersisted(pendingRehydration);
      setPendingRehydration(null);
    }
  };

  const handleDiscardRehydration = async () => {
    setShowRehydrateModal(false);
    setPendingRehydration(null);
    clearPersistedState();
    await updateWorkoutSession(sessionId, { status: "ABORTED" });
    navigate("/");
  };

  const handleStartAttempt = () => {
    if (!audioOnboardingDone) {
      setShowAudioModal(true);
    } else {
      handleStart();
    }
  };

  const handleAudioEnable = async () => {
    dismissAudioOnboarding();
    setShowAudioModal(false);
    setSoundEnabledState(true);
    setSoundEnabled(true);
    await handleStart();
  };

  const handleAudioSkip = async () => {
    dismissAudioOnboarding();
    setShowAudioModal(false);
    setSoundEnabledState(false);
    setSoundEnabled(false);
    await handleStart();
  };

  const handleStart = useCallback(async () => {
    let audioOk = false;
    try {
      audioOk = await initAudio();
    } catch (error) {
      console.error("[WorkoutPlayer] Audio init error:", error);
    }
    
    setAudioReady(audioOk);
    resetBeepGuard();
    lastBeepSecondRef.current = -1;
    lastStepIndexRef.current = -1;
    
    const now = Date.now();
    workoutStartedAtRef.current = now;
    stepStartedAtRef.current = now;
    totalAccumulatedRef.current = 0;
    stepAccumulatedRef.current = 0;
    
    if (steps.length > 0) {
      stepOriginalDurationRef.current = steps[0].durationSec;
      setStepRemaining(steps[0].durationSec);
    }
    
    setStatus("RUNNING");
    updateWorkoutSession(sessionId, { status: "STARTED" });
    persistCurrentState("RUNNING", 0);
    
    if (audioOk && soundEnabled) {
      try { beepStartWork(); } catch (e) { console.error(e); }
    }
  }, [sessionId, steps, soundEnabled, persistCurrentState]);

  const handlePause = useCallback(() => {
    const now = Date.now();
    totalAccumulatedRef.current += now - workoutStartedAtRef.current;
    stepAccumulatedRef.current += now - stepStartedAtRef.current;
    
    setStatus("PAUSED");
    updateWorkoutSession(sessionId, { 
      status: "PAUSED", 
      total_elapsed_sec: Math.floor(totalAccumulatedRef.current / 1000) 
    });
    persistCurrentState("PAUSED");
  }, [sessionId, persistCurrentState]);

  const handleResume = useCallback(async () => {
    try { await forceUnlock(); } catch (e) { console.error(e); }
    
    const now = Date.now();
    workoutStartedAtRef.current = now;
    stepStartedAtRef.current = now;
    
    pausedByBackgroundRef.current = false;
    setShowResumeModal(false);
    setStatus("RUNNING");
    updateWorkoutSession(sessionId, { status: "STARTED" });
    persistCurrentState("RUNNING");
  }, [sessionId, persistCurrentState]);

  const handleResumeFromModal = () => handleResume();
  
  const handleFinishFromModal = () => {
    setShowResumeModal(false);
    pausedByBackgroundRef.current = false;
    handleFinish();
  };

  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    
    if (nextIndex >= steps.length) {
      handleFinish();
      return;
    }

    const nextStep = steps[nextIndex];
    const now = Date.now();
    
    stepAccumulatedRef.current = 0;
    stepStartedAtRef.current = now;
    stepOriginalDurationRef.current = nextStep.durationSec;
    setStepRemaining(nextStep.durationSec);
    
    lastBeepSecondRef.current = -1;
    
    if (soundEnabled && lastStepIndexRef.current !== nextIndex) {
      lastStepIndexRef.current = nextIndex;
      if (nextStep.kind === "WORK") beepOnce(`transition-work-${nextIndex}`, beepStartWork);
      else if (nextStep.kind === "REST") beepOnce(`transition-rest-${nextIndex}`, beepStartRest);
      else if (nextStep.kind === "COUNTDOWN") beepOnce(`transition-countdown-${nextIndex}`, beepShort);
    }
    
    setCurrentStepIndex(nextIndex);
    persistCurrentState("RUNNING", nextIndex);
  }, [currentStepIndex, steps, soundEnabled, persistCurrentState]);

  const handleSkipStep = useCallback(() => goToNextStep(), [goToNextStep]);

  const handleFinish = useCallback(async () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    clearPersistedState();
    setStatus("FINISHED");
    
    if (soundEnabled) beepFinishWorkout();
    
    const now = Date.now();
    let finalElapsedMs = totalAccumulatedRef.current;
    if (status === "RUNNING") finalElapsedMs += now - workoutStartedAtRef.current;
    const finalElapsed = Math.floor(finalElapsedMs / 1000);
    
    const generateLabel = (): string => {
      if (source === "custom") return `Custom · ${routineTitle}`;
      if (programKey && dayKey) {
        const formattedDay = dayKey.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        return `${programKey} · ${formattedDay}`;
      }
      if (programKey) return programKey;
      return routineTitle || "Entrenamiento";
    };

    const params: FinalizeSessionParams = {
      sessionId, userId,
      totalElapsedSec: finalElapsed,
      source: source || "recommended",
      label: generateLabel(),
      programKey, dayKey, systemRoutineId, userRoutineId,
    };

    await finalizeWorkoutSession(params);
  }, [sessionId, userId, status, soundEnabled, source, programKey, dayKey, systemRoutineId, userRoutineId, routineTitle, clearPersistedState]);

  const handleAbort = useCallback(async () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    clearPersistedState();
    setStatus("ABORTED");
    await updateWorkoutSession(sessionId, { status: "ABORTED" });
    navigate("/");
  }, [sessionId, navigate, clearPersistedState]);

  const handleToggleSound = useCallback(async () => {
    const newValue = !soundEnabled;
    setSoundEnabledState(newValue);
    try {
      await setSoundEnabled(newValue);
      if (newValue) await forceUnlock();
    } catch (e) { console.error(e); }
  }, [soundEnabled]);

  const handleExit = useCallback(() => navigate("/"), [navigate]);
  const handleDismissPauseTip = () => dismissPauseTip();

  // ============================================
  // RENDER HELPERS
  // ============================================

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentStep = steps[currentStepIndex];
  const nextStep = steps[currentStepIndex + 1];
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;
  const totalWorkSteps = steps.filter(s => s.kind === "WORK").length;

  // ============================================
  // RENDER: MODAL REHIDRATACIÓN
  // ============================================
  if (showRehydrateModal) {
    return (
      <div className={styles.container}>
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>⏸️</div>
            <h3 className={styles.modalTitle}>Sesión en curso</h3>
            <p className={styles.modalText}>
              Detectamos un entrenamiento en progreso. ¿Deseas continuar donde lo dejaste?
            </p>
            <div className={styles.modalActions}>
              <button className={styles.primaryBtn} onClick={handleContinueRehydration}>
                Continuar
              </button>
              <button className={styles.dangerBtn} onClick={handleDiscardRehydration}>
                Descartar y salir
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: WARMUP PROMPT
  // ============================================
  if (showWarmupPrompt) {
    return (
      <div className={styles.container}>
        <div className={styles.promptCard}>
          <div className={styles.promptIcon}>🔥</div>
          <h2 className={styles.promptTitle}>¿Hacer calentamiento?</h2>
          <p className={styles.promptText}>
            Esta rutina incluye un bloque de calentamiento para preparar tu cuerpo.
          </p>
          <div className={styles.promptActions}>
            <button
              className={styles.primaryBtn}
              onClick={() => handleWarmupChoice(false)}
            >
              Hacer calentamiento (recomendado)
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={() => handleWarmupChoice(true)}
            >
              Saltar calentamiento
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: FINISHED
  // ============================================
  if (status === "FINISHED") {
    return (
      <div className={styles.container}>
        <div className={styles.finishedCard}>
          <div className={styles.finishedIcon}>🎉</div>
          <h2 className={styles.finishedTitle}>¡Sesión completada!</h2>
          <div className={styles.finishedStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Duración real</span>
              <span className={styles.statValue}>{formatTime(totalElapsed)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Series</span>
              <span className={styles.statValue}>{totalWorkSteps}</span>
            </div>
          </div>
          <div className={styles.trainedBadge}>
            <span>✅</span> Marcado como entrenado
          </div>
          <button className={styles.primaryBtn} onClick={handleExit}>
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: READY (con modal de audio)
  // ============================================
  if (status === "READY") {
    const totalDuration = steps.reduce((acc, s) => acc + s.durationSec, 0);
    
    return (
      <div className={styles.container}>
        {showAudioModal && (
          <AudioEnableModal
            onEnable={handleAudioEnable}
            onSkip={handleAudioSkip}
          />
        )}

        <div className={styles.readyCard}>
          {/* MARCA DE VERSIÓN - QUITAR DESPUÉS */}
          <div style={{ position: "absolute", top: 8, right: 12, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            v1.1-persist
          </div>
          
          <div className={styles.readyIcon}>🏋️</div>
          <h2 className={styles.readyTitle}>{routineTitle}</h2>
          <p className={styles.readySubtitle}>
            {totalWorkSteps} series · ~{formatTime(totalDuration)}
          </p>
          <button className={styles.startBtn} onClick={handleStartAttempt}>
            ▶ Empezar
          </button>
          <button className={styles.cancelBtn} onClick={handleExit}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: PLAYER PRINCIPAL
  // ============================================
  return (
    <div className={styles.container}>
      {/* MARCA DE VERSIÓN - QUITAR DESPUÉS */}
      <div style={{ position: "fixed", top: 4, left: 8, fontSize: 10, color: "rgba(255,255,255,0.3)", zIndex: 9999 }}>
        v1.1-persist
      </div>

      {/* Modal de Resume */}
      {showResumeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>⏸️</div>
            <h3 className={styles.modalTitle}>Tu rutina fue pausada</h3>
            <p className={styles.modalText}>
              La rutina se pausó porque saliste de la app.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.primaryBtn} onClick={handleResumeFromModal}>
                Continuar
              </button>
              <button className={styles.secondaryBtn} onClick={handleFinishFromModal}>
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.player}>
        <div className={styles.playerHeader}>
          <button className={styles.exitBtn} onClick={handleAbort}>
            ✕
          </button>
          <div className={styles.headerInfo}>
            <span className={styles.routineName}>{routineTitle}</span>
            <span className={styles.totalTime}>{formatTime(totalElapsed)}</span>
          </div>
          <button 
            className={`${styles.soundBtn} ${!soundEnabled ? styles.soundOff : ""}`}
            onClick={handleToggleSound}
            aria-label={soundEnabled ? "Silenciar" : "Activar sonido"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>

        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        {/* Banner tip de pausa (one-time) */}
        {!pauseTipDismissed && status === "RUNNING" && (
          <div className={styles.tipBanner}>
            <span className={styles.tipIcon}>💡</span>
            <span className={styles.tipText}>Si sales de la app, la rutina se pausará automáticamente.</span>
            <button className={styles.tipDismiss} onClick={handleDismissPauseTip}>
              Entendido
            </button>
          </div>
        )}

        {/* Aviso sonido desactivado */}
        {!soundEnabled && status === "RUNNING" && (
          <div className={styles.soundWarning}>
            <span>🔇</span> Sonido desactivado. Actívalo para escuchar los beeps.
          </div>
        )}

        {currentStep && (
          <div className={styles.stepDisplay}>
            <span className={`${styles.stepKind} ${styles[currentStep.kind.toLowerCase()]}`}>
              {currentStep.kind === "COUNTDOWN" && "🔜 Prepárate"}
              {currentStep.kind === "WORK" && BLOCK_TYPE_LABELS[currentStep.blockType]}
              {currentStep.kind === "REST" && "😮‍💨 Descanso"}
            </span>
            
            <h2 className={styles.exerciseName}>
              {currentStep.exerciseName}
            </h2>
            
            {currentStep.kind === "WORK" && currentStep.totalSets && (
              <div className={styles.setsInfo}>
                Serie {currentStep.setNumber} de {currentStep.totalSets}
                {currentStep.reps && (
                  <span className={styles.repsInfo}> · {currentStep.reps} reps</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className={styles.timerContainer}>
          <div className={`${styles.timerCircle} ${currentStep?.kind === "REST" ? styles.rest : ""} ${currentStep?.kind === "COUNTDOWN" ? styles.countdown : ""}`}>
            <span className={styles.timerValue}>
              {currentStep?.kind === "COUNTDOWN" 
                ? stepRemaining 
                : formatTime(stepRemaining)
              }
            </span>
            <span className={styles.timerLabel}>
              {currentStep?.kind === "COUNTDOWN" ? "Empezamos en..." : "restante"}
            </span>
          </div>
        </div>

        {nextStep && status === "RUNNING" && (
          <div className={styles.nextPreview}>
            <span className={styles.nextLabel}>Siguiente:</span>
            <span className={styles.nextName}>
              {nextStep.kind === "REST" 
                ? `Descanso (${nextStep.durationSec}s)` 
                : nextStep.kind === "COUNTDOWN"
                  ? `Prepárate: ${nextStep.exerciseName}`
                  : `${nextStep.exerciseName}${nextStep.totalSets ? ` (Serie ${nextStep.setNumber})` : ""}`
              }
            </span>
          </div>
        )}

        <div className={styles.controls}>
          {status === "RUNNING" && (
            <>
              <button className={styles.pauseBtn} onClick={handlePause}>
                ⏸ Pausar
              </button>
              <button className={styles.nextBtn} onClick={handleSkipStep}>
                Siguiente ▶
              </button>
            </>
          )}

          {status === "PAUSED" && !showResumeModal && (
            <>
              <button className={styles.resumeBtn} onClick={handleResume}>
                ▶ Continuar
              </button>
              <button className={styles.finishBtn} onClick={handleFinish}>
                Finalizar
              </button>
            </>
          )}
        </div>

        <div className={styles.stepIndicators}>
          {steps.slice(0, 20).map((step, idx) => (
            <div
              key={idx}
              className={`${styles.stepDot} ${idx === currentStepIndex ? styles.active : ""} ${idx < currentStepIndex ? styles.completed : ""} ${step.kind === "REST" ? styles.restDot : ""} ${step.kind === "COUNTDOWN" ? styles.countdownDot : ""}`}
            />
          ))}
          {steps.length > 20 && <span className={styles.moreDots}>+{steps.length - 20}</span>}
        </div>
      </div>
    </div>
  );
}
