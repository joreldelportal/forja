import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";
import styles from "./ResetPasswordPage.module.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  // Verificar que el usuario llegó con un token válido de recuperación
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      // Si hay sesión, significa que el token de recovery fue válido
      // Supabase automáticamente crea una sesión temporal al seguir el link
      if (data.session) {
        setIsValidSession(true);
      } else {
        setIsValidSession(false);
        setErrorMsg("Link inválido o expirado. Solicita un nuevo link de recuperación.");
      }
    };

    checkSession();
  }, []);

  const validate = (): string | null => {
    const p = password.trim();
    const r = repeatPassword.trim();

    if (!p) return "Ingresa la nueva contraseña.";
    if (p.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    if (!r) return "Confirma la contraseña.";
    if (p !== r) return "Las contraseñas no coinciden.";

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password.trim(),
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || "Error al actualizar la contraseña.");
    } else {
      setSuccessMsg("¡Contraseña actualizada! Redirigiendo...");
      // Sign out para que inicie sesión con la nueva contraseña
      await supabase.auth.signOut();
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    }
  };

  const handleBackToLogin = () => {
    navigate("/auth");
  };

  // Estado de carga inicial
  if (isValidSession === null) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loadingState}>
            <span className={styles.spinner}></span>
            <p>Verificando enlace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.brand}>
          <div className={styles.logo}>🔐</div>
          <h1 className={styles.title}>Nueva Contraseña</h1>
          <p className={styles.subtitle}>Ingresa tu nueva contraseña</p>
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

        {/* Form - only show if valid session */}
        {isValidSession && !successMsg && (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="newPassword" className={styles.label}>
                Nueva contraseña
              </label>
              <input
                id="newPassword"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={styles.input}
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Repite la contraseña"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                autoComplete="new-password"
                className={styles.input}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.spinner}></span>
              ) : (
                "Actualizar contraseña"
              )}
            </button>
          </form>
        )}

        {/* Back to login button */}
        <button
          type="button"
          className={styles.linkBtn}
          onClick={handleBackToLogin}
        >
          ← Volver a iniciar sesión
        </button>
      </div>
    </div>
  );
}
