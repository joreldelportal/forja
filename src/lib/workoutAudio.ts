// ============================================
// WORKOUT AUDIO MODULE
// Professional audio beeps for workout timer
// Uses Web Audio API - no external dependencies
// FIXED: iOS PWA standalone mode audio unlock
// ============================================

const STORAGE_KEY = "workout_sound_enabled";

// Audio context and state
let audioContext: AudioContext | null = null;
let isEnabled: boolean = true;
let isUnlocked: boolean = false;

// Detect if running as installed PWA (standalone)
function isStandalonePWA(): boolean {
  try {
    return (
      (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      (typeof navigator !== "undefined" && (navigator as any).standalone === true) ||
      (typeof document !== "undefined" && document.referrer.includes("android-app://"))
    );
  } catch {
    return false;
  }
}

// Load preference from localStorage
function loadPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // localStorage not available
  }
  return true; // default ON
}

// Save preference to localStorage
function savePreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // localStorage not available
  }
}

// Initialize on module load
isEnabled = loadPreference();

/**
 * Create AudioContext if needed
 */
function getOrCreateContext(): AudioContext | null {
  if (!audioContext) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        console.log("[WorkoutAudio] AudioContext created, state:", audioContext.state);
      }
    } catch (error) {
      console.error("[WorkoutAudio] Failed to create AudioContext:", error);
      return null;
    }
  }
  return audioContext;
}

/**
 * Play a silent buffer to unlock audio on iOS
 * This must be called from a user gesture (click/touch)
 */
async function playSilentBuffer(): Promise<void> {
  const ctx = getOrCreateContext();
  if (!ctx) return;

  try {
    // Create a tiny silent buffer
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    
    console.log("[WorkoutAudio] Silent buffer played for unlock");
  } catch (error) {
    console.error("[WorkoutAudio] Silent buffer failed:", error);
  }
}

/**
 * Initialize and unlock audio (must be called from user gesture)
 * Returns true if audio is ready, false if blocked
 */
export async function initAudio(): Promise<boolean> {
  const ctx = getOrCreateContext();
  if (!ctx) return false;

  try {
    // Always try to resume on iOS PWA
    if (ctx.state === "suspended") {
      console.log("[WorkoutAudio] Resuming suspended context...");
      await ctx.resume();
    }

    // Play silent buffer to fully unlock on iOS
    await playSilentBuffer();

    // Double-check state after operations
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    isUnlocked = ctx.state === "running";

    console.log("[WorkoutAudio] Init complete:", {
      state: ctx.state,
      isUnlocked,
      isEnabled,
      isPWA: isStandalonePWA(),
    });

    return isUnlocked;
  } catch (error) {
    console.error("[WorkoutAudio] Init failed:", error);
    return false;
  }
}

/**
 * Force unlock audio - call this on ANY user interaction if audio isn't working
 * Useful for iOS PWA where audio can get suspended unexpectedly
 */
export async function forceUnlock(): Promise<boolean> {
  const ctx = getOrCreateContext();
  if (!ctx) return false;

  try {
    if (ctx.state !== "running") {
      await ctx.resume();
      await playSilentBuffer();
    }
    
    isUnlocked = ctx.state === "running";
    return isUnlocked;
  } catch (error) {
    console.error("[WorkoutAudio] Force unlock failed:", error);
    return false;
  }
}

/**
 * Check if audio is initialized and running
 */
export function isAudioReady(): boolean {
  return isUnlocked && audioContext?.state === "running";
}

/**
 * Get current enabled state
 */
export function isSoundEnabled(): boolean {
  return isEnabled;
}

/**
 * Set enabled state and persist to localStorage
 * Also tries to unlock audio if enabling
 */
export async function setSoundEnabled(enabled: boolean): Promise<void> {
  isEnabled = enabled;
  savePreference(enabled);
  console.log("[WorkoutAudio] Sound enabled:", enabled);

  // If enabling sound, try to unlock audio
  if (enabled && !isAudioReady()) {
    await forceUnlock();
  }
}

/**
 * Toggle sound and persist
 */
export async function toggleSound(): Promise<boolean> {
  await setSoundEnabled(!isEnabled);
  return isEnabled;
}

// ============================================
// BEEP FUNCTIONS
// ============================================

/**
 * Play a tone with envelope (attack/decay to avoid clicking)
 */
function playTone(
  frequency: number,
  duration: number,
  volume: number = 0.3,
  type: OscillatorType = "sine"
): void {
  if (!isEnabled) return;

  const ctx = audioContext;
  
  // Try to resume if suspended (can happen on iOS PWA)
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  if (!ctx || ctx.state !== "running") {
    console.warn("[WorkoutAudio] Context not running, state:", ctx?.state);
    return;
  }

  try {
    const now = ctx.currentTime;

    // Create oscillator
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    // Create gain node for envelope
    const gainNode = ctx.createGain();
    
    // Attack/Decay envelope to avoid clicking
    const attackTime = 0.01;
    const sustainLevel = volume;
    const releaseTime = 0.05;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime);
    gainNode.gain.setValueAtTime(sustainLevel, now + duration - releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    // Connect and play
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.error("[WorkoutAudio] playTone error:", error);
  }
}

/**
 * Short countdown beep (3, 2, 1)
 * Quick, high-pitched blip
 */
export function beepShort(): void {
  playTone(880, 0.08, 0.25, "sine"); // A5, short
  triggerHaptic(50);
}

/**
 * Start WORK beep
 * Longer, higher pitch - energizing
 */
export function beepStartWork(): void {
  playTone(1046.5, 0.4, 0.35, "sine"); // C6, longer duration
  triggerHaptic(100);
}

/**
 * Start REST beep
 * Longer, lower pitch - calming
 */
export function beepStartRest(): void {
  playTone(523.25, 0.5, 0.3, "sine"); // C5, longer duration
  triggerHaptic(80);
}

/**
 * Workout complete celebration pattern
 */
export function beepFinishWorkout(): void {
  if (!isEnabled || !audioContext || audioContext.state !== "running") {
    return;
  }

  // Victory fanfare: C5 - E5 - G5 - C6
  const notes = [
    { freq: 523.25, delay: 0 },      // C5
    { freq: 659.25, delay: 0.12 },   // E5
    { freq: 783.99, delay: 0.24 },   // G5
    { freq: 1046.5, delay: 0.36 },   // C6
  ];

  notes.forEach(({ freq, delay }) => {
    setTimeout(() => {
      playTone(freq, 0.15, 0.3, "sine");
    }, delay * 1000);
  });

  // Long vibration for completion
  triggerHaptic(300);
}

// ============================================
// HAPTIC FEEDBACK
// ============================================

/**
 * Trigger haptic vibration if supported and sound is enabled
 */
function triggerHaptic(durationMs: number): void {
  if (!isEnabled) return;
  
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Vibration not supported or blocked
  }
}

// ============================================
// BEEP GUARD (prevent double-beeps)
// ============================================

let lastBeepKey: string = "";

/**
 * Play beep only if the key hasn't been played yet
 * Use unique keys like "countdown-3" or "transition-work-5"
 */
export function beepOnce(key: string, beepFn: () => void): void {
  if (key === lastBeepKey) {
    return; // Already played this beep
  }
  lastBeepKey = key;
  beepFn();
}

/**
 * Reset the beep guard (call on workout start/restart)
 */
export function resetBeepGuard(): void {
  lastBeepKey = "";
}

// ============================================
// AUTO-UNLOCK ON USER INTERACTION (iOS PWA fix)
// ============================================

let autoUnlockSetup = false;

/**
 * Setup automatic audio unlock on first user interaction
 * Call this once when the app loads
 */
export function setupAutoUnlock(): void {
  // Prevent multiple setups
  if (autoUnlockSetup) return;
  autoUnlockSetup = true;

  try {
    const unlockEvents = ["touchstart", "touchend", "click", "keydown"];
    
    const handleUnlock = async () => {
      try {
        if (!isUnlocked || audioContext?.state !== "running") {
          console.log("[WorkoutAudio] Auto-unlock triggered by user interaction");
          await forceUnlock();
        }
        
        // Remove listeners after successful unlock
        if (audioContext?.state === "running") {
          unlockEvents.forEach((event) => {
            document.removeEventListener(event, handleUnlock, true);
          });
          console.log("[WorkoutAudio] Auto-unlock listeners removed");
        }
      } catch (error) {
        console.error("[WorkoutAudio] Auto-unlock handler error:", error);
      }
    };

    // Add listeners with capture to catch early
    unlockEvents.forEach((event) => {
      document.addEventListener(event, handleUnlock, true);
    });

    console.log("[WorkoutAudio] Auto-unlock listeners added");
  } catch (error) {
    console.error("[WorkoutAudio] setupAutoUnlock failed:", error);
  }
}

// DO NOT auto-setup - let the app call setupAutoUnlock() manually if needed
// This prevents crashes in PWA mode
