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
  
  const startedAtRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const stepStartedAtRef = useRef<number>(0);
  const stepDurationRef = useRef<number>(0);
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
  
  // Modal de audio unlock
  const [showAudioModal, setShowAudioModal] = useState(false);
  
  // Modal de pausa por background
  const [showResumeModal, setShowResumeModal] = useState(false);
  const pausedByBackgroundRef = useRef(false);

  useEffect(() => {
    if (!showWarmupPrompt && blocks.length > 0) {
      const generatedSteps = buildSteps(blocks, skipWarmup);
      setSteps(generatedSteps);
      if (generatedSteps.length > 0) {
        setStepRemaining(generatedSteps[0].durationSec);
        stepDurationRef.current = generatedSteps[0].durationSec;
      }
    }
  }, [blocks, skipWarmup, showWarmupPrompt]);

  // Detectar cuando la app pierde/gana foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && status === "RUNNING") {
        // Pausar cuando se va al background
        pausedByBackgroundRef.current = true;
        handlePause();
      } else if (document.visibilityState === "visible" && status === "PAUSED" && pausedByBackgroundRef.current) {
        // Mostrar modal de resume cuando vuelve
        setShowResumeModal(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status]);

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
      
      const totalNow = accumulatedRef.current + (now - startedAtRef.current) / 1000;
      setTotalElapsed(Math.floor(totalNow));
      
      const stepElapsedNow = (now - stepStartedAtRef.current) / 1000;
      const remaining = Math.max(0, stepDurationRef.current - stepElapsedNow);
      const remainingCeil = Math.ceil(remaining);
      setStepRemaining(remainingCeil);
      
      // Audio beeps
      if (soundEnabled && remainingCeil !== lastBeepSecondRef.current) {
        lastBeepSecondRef.current = remainingCeil;
        
        if (remainingCeil === 3 || remainingCeil === 2 || remainingCeil === 1) {
          beepOnce(`countdown-${currentStepIndex}-${remainingCeil}`, beepShort);
        }
      }
      
      if (remaining <= 0) {
        goToNextStep();
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [status, currentStepIndex, steps]);

  const handleWarmupChoice = (skip: boolean) => {
    setSkipWarmup(skip);
    setShowWarmupPrompt(false);
  };

  // ============================================
  // INICIO CON MODAL DE AUDIO
  // ============================================
  const handleStartAttempt = () => {
    // Si no ha visto el onboarding de audio, mostrar modal
    if (!audioOnboardingDone) {
      setShowAudioModal(true);
    } else {
      handleStart();
    }
  };

  const handleAudioEnable = async () => {
    dismissAudioOnboarding();
    setShowAudioModal(false);
    
    // Activar sonido
    setSoundEnabledState(true);
    setSoundEnabled(true);
    
    // Iniciar
    await handleStart();
  };

  const handleAudioSkip = async () => {
    dismissAudioOnboarding();
    setShowAudioModal(false);
    
    // Desactivar sonido
    setSoundEnabledState(false);
    setSoundEnabled(false);
    
    // Iniciar igual
    await handleStart();
  };

  const handleStart = useCallback(async () => {
    // Initialize audio with error handling (don't let it block workout start)
    let audioOk = false;
    try {
      audioOk = await initAudio();
      console.log("[WorkoutPlayer] Audio init result:", audioOk);
    } catch (error) {
      console.error("[WorkoutPlayer] Audio init error (continuing anyway):", error);
      audioOk = false;
    }
    
    setAudioReady(audioOk);
    resetBeepGuard();
    lastBeepSecondRef.current = -1;
    lastStepIndexRef.current = -1;
    
    const now = Date.now();
    startedAtRef.current = now;
    stepStartedAtRef.current = now;
    accumulatedRef.current = 0;
    
    if (steps.length > 0) {
      stepDurationRef.current = steps[0].durationSec;
      setStepRemaining(steps[0].durationSec);
    }
    
    setStatus("RUNNING");
    updateWorkoutSession(sessionId, { status: "STARTED" });
    
    // Try to beep, but don't crash if it fails
    if (audioOk && soundEnabled) {
      try {
        beepStartWork();
      } catch (e) {
        console.error("[WorkoutPlayer] Beep failed:", e);
      }
    }
  }, [sessionId, steps, soundEnabled]);

  const handlePause = useCallback(() => {
    const now = Date.now();
    
    accumulatedRef.current += (now - startedAtRef.current) / 1000;
    
    const stepElapsed = (now - stepStartedAtRef.current) / 1000;
    stepDurationRef.current = Math.max(0, stepDurationRef.current - stepElapsed);
    
    setStatus("PAUSED");
    updateWorkoutSession(sessionId, { 
      status: "PAUSED", 
      total_elapsed_sec: Math.floor(accumulatedRef.current) 
    });
  }, [sessionId]);

  const handleResume = useCallback(async () => {
    // Force unlock audio on resume (important for iOS PWA)
    try {
      await forceUnlock();
    } catch (error) {
      console.error("[WorkoutPlayer] forceUnlock failed:", error);
    }
    
    const now = Date.now();
    startedAtRef.current = now;
    stepStartedAtRef.current = now;
    
    pausedByBackgroundRef.current = false;
    setShowResumeModal(false);
    setStatus("RUNNING");
    updateWorkoutSession(sessionId, { status: "STARTED" });
  }, [sessionId]);

  // Resume desde el modal de background
  const handleResumeFromModal = () => {
    handleResume();
  };

  // Finalizar desde el modal de background
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
    stepStartedAtRef.current = now;
    stepDurationRef.current = nextStep.durationSec;
    setStepRemaining(nextStep.durationSec);
    
    lastBeepSecondRef.current = -1;
    
    if (soundEnabled && lastStepIndexRef.current !== nextIndex) {
      lastStepIndexRef.current = nextIndex;
      
      if (nextStep.kind === "WORK") {
        beepOnce(`transition-work-${nextIndex}`, beepStartWork);
      } else if (nextStep.kind === "REST") {
        beepOnce(`transition-rest-${nextIndex}`, beepStartRest);
      } else if (nextStep.kind === "COUNTDOWN") {
        beepOnce(`transition-countdown-${nextIndex}`, beepShort);
      }
    }
    
    setCurrentStepIndex(nextIndex);
  }, [currentStepIndex, steps, soundEnabled]);

  const handleSkipStep = useCallback(() => {
    goToNextStep();
  }, [goToNextStep]);

  const handleFinish = useCallback(async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setStatus("FINISHED");
    
    if (soundEnabled) {
      beepFinishWorkout();
    }
    
    const finalElapsed = Math.floor(accumulatedRef.current + 
      (status === "RUNNING" ? (Date.now() - startedAtRef.current) / 1000 : 0));
    
    const generateLabel = (): string => {
      if (source === "custom") {
        return `Custom · ${routineTitle}`;
      }
      if (programKey && dayKey) {
        const formattedDay = dayKey
          .split("_")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        return `${programKey} · ${formattedDay}`;
      }
      if (programKey) {
        return programKey;
      }
      return routineTitle || "Entrenamiento";
    };

    const params: FinalizeSessionParams = {
      sessionId,
      userId,
      totalElapsedSec: finalElapsed,
      source: source || "recommended",
      label: generateLabel(),
      programKey: programKey,
      dayKey: dayKey,
      systemRoutineId: systemRoutineId,
      userRoutineId: userRoutineId,
    };

    await finalizeWorkoutSession(params);
  }, [sessionId, userId, status, soundEnabled, source, programKey, dayKey, systemRoutineId, userRoutineId, routineTitle]);

  const handleAbort = useCallback(async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setStatus("ABORTED");
    await updateWorkoutSession(sessionId, { status: "ABORTED" });
    navigate("/");
  }, [sessionId, navigate]);

  const handleToggleSound = useCallback(async () => {
    const newValue = !soundEnabled;
    setSoundEnabledState(newValue);
    
    try {
      await setSoundEnabled(newValue);
      
      // Force unlock if enabling sound (iOS PWA fix)
      if (newValue) {
        await forceUnlock();
      }
    } catch (error) {
      console.error("[WorkoutPlayer] Toggle sound error:", error);
    }
  }, [soundEnabled]);

  const handleExit = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleDismissPauseTip = () => {
    dismissPauseTip();
  };

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
        {/* Modal de Audio Unlock */}
        {showAudioModal && (
          <AudioEnableModal
            onEnable={handleAudioEnable}
            onSkip={handleAudioSkip}
          />
        )}

        <div className={styles.readyCard}>
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
      {/* Modal de Resume (pausado por background) */}
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
