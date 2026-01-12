import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import styles from "./AuthPage.module.css";

type Mode = "login" | "signup" | "confirmEmail";

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, loading } = useAuthStore();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  // UI feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showUserExistsRecovery, setShowUserExistsRecovery] = useState(false);

  const isSignup = mode === "signup";
  const isConfirmEmail = mode === "confirmEmail";

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowUserExistsRecovery(false);
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    clearMessages();
    setRepeatPassword("");
  };

  const validate = (): string | null => {
    const e = email.trim();
    const p = password.trim();
    const r = repeatPassword.trim();

    if (!e) return "Ingresa un email.";
    if (!e.includes("@")) return "Email inválido.";
    if (!p) return "Ingresa una contraseña.";
    if (p.length < 6) return "La contraseña debe tener al menos 6 caracteres.";

    if (isSignup) {
      if (!r) return "Repite la contraseña.";
      if (p !== r) return "Las contraseñas no coinciden.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (isSignup) {
      const result = await signUp(trimmedEmail, trimmedPassword);

      if (result.userExists) {
        setErrorMsg("Este correo ya está registrado. Inicia sesión o recupera tu contraseña.");
        setShowUserExistsRecovery(true);
      } else if (!result.ok) {
        setErrorMsg(result.error || "Error al crear cuenta.");
      } else if (result.needsEmailConfirmation) {
        // Mostrar pantalla de confirmación
        setMode("confirmEmail");
      } else {
        // Usuario creado y logueado automáticamente (sin confirmación requerida)
        setSuccessMsg("¡Cuenta creada exitosamente!");
        navigate("/");
      }
    } else {
      const result = await signIn(trimmedEmail, trimmedPassword);
      if (result.ok) {
        navigate("/");
      } else {
        setErrorMsg(result.error || "Credenciales inválidas.");
      }
    }
  };

  const handleForgotPassword = async () => {
    clearMessages();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setErrorMsg("Ingresa un email válido para recuperar tu contraseña.");
      return;
    }

    const result = await resetPassword(trimmedEmail);
    if (result.ok) {
      setSuccessMsg("Te enviamos un link de recuperación. Revisa tu correo.");
    } else {
      setErrorMsg(result.error || "Error al enviar el link.");
    }
  };

  const handleSendRecoveryFromSignup = async () => {
    clearMessages();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setErrorMsg("Ingresa un email válido.");
      return;
    }

    const result = await resetPassword(trimmedEmail);
    if (result.ok) {
      setSuccessMsg("Link de recuperación enviado. Revisa tu correo.");
      setShowUserExistsRecovery(false);
      switchMode("login");
    } else {
      setErrorMsg(result.error || "Error al enviar el link.");
    }
  };

  const handleBackToLogin = () => {
    setPassword("");
    setRepeatPassword("");
    switchMode("login");
  };

  // ========================================
  // PANTALLA DE CONFIRMACIÓN DE EMAIL
  // ========================================
  if (isConfirmEmail) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.confirmEmailScreen}>
            <div className={styles.confirmEmailIcon}>✉️</div>
            <h2 className={styles.confirmEmailTitle}>¡Revisa tu correo!</h2>
            <p className={styles.confirmEmailText}>
              Te enviamos un enlace de confirmación a:
            </p>
            <p className={styles.confirmEmailAddress}>{email}</p>
            <p className={styles.confirmEmailHint}>
              Haz clic en el enlace del correo para activar tu cuenta. 
              Revisa también la carpeta de spam.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleBackToLogin}
            >
              Ir a iniciar sesión
            </button>
            <p className={styles.confirmEmailFooter}>
              ¿No recibiste el correo?{" "}
              <button
                type="button"
                className={styles.inlineLink}
                onClick={() => switchMode("signup")}
              >
                Intentar de nuevo
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // PANTALLA NORMAL (LOGIN / SIGNUP)
  // ========================================
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Logo / Branding */}
        <div className={styles.brand}>
          <div className={styles.logo}>⚡</div>
          <h1 className={styles.title}>Forja</h1>
          <p className={styles.subtitle}>Tu entrenamiento, tu poder</p>
        </div>

        {/* Toggle Login / Signup */}
        <div className={styles.toggle}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${mode === "login" ? styles.active : ""}`}
            onClick={() => switchMode("login")}
            disabled={loading}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${mode === "signup" ? styles.active : ""}`}
            onClick={() => switchMode("signup")}
            disabled={loading}
          >
            Crear cuenta
          </button>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className={styles.errorBanner}>
            <span className={styles.bannerIcon}>⚠️</span>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className={styles.successBanner}>
            <span className={styles.bannerIcon}>✓</span>
            {successMsg}
          </div>
        )}

        {/* User exists recovery CTA */}
        {showUserExistsRecovery && (
          <button
            type="button"
            className={styles.recoveryBtn}
            onClick={handleSendRecoveryFromSignup}
            disabled={loading}
          >
            Enviar link de recuperación
          </button>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className={styles.input}
              disabled={loading}
            />
          </div>

          {/* Repeat password (signup only) */}
          {isSignup && (
            <div className={styles.inputGroup}>
              <label htmlFor="repeatPassword" className={styles.label}>
                Repetir contraseña
              </label>
              <input
                id="repeatPassword"
                type="password"
                placeholder="Confirma tu contraseña"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                autoComplete="new-password"
                className={styles.input}
                disabled={loading}
              />
            </div>
          )}

          {/* Primary action */}
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.spinner}></span>
            ) : isSignup ? (
              "Crear cuenta"
            ) : (
              "Entrar"
            )}
          </button>

          {/* Forgot password (login only) */}
          {!isSignup && (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={handleForgotPassword}
              disabled={loading}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </form>

        {/* Footer */}
        <p className={styles.footer}>
          {isSignup
            ? "¿Ya tienes cuenta? "
            : "¿No tienes cuenta? "}
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            disabled={loading}
          >
            {isSignup ? "Inicia sesión" : "Regístrate"}
          </button>
        </p>
      </div>
    </div>
  );
}
