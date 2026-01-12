import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { getMyProfile, upsertMyProfile } from "../../services/profileService";
import { syncTrackWithProfile } from "../../lib/routineEngine";
import SelectableCardGroup from "../../components/SelectableCardGroup/SelectableCardGroup";
import type { CardOption } from "../../components/SelectableCardGroup/SelectableCardGroup";
import styles from "./OnboardingPage.module.css";

import {
  AGE_OPTIONS,
  EXPERIENCE_OPTIONS,
  CONTEXT_OPTIONS,
  PRIORITY_OPTIONS,
  PRIORITY2_OPTIONS,
  AGE_LABELS,
  EXPERIENCE_LABELS,
  CONTEXT_LABELS,
  PRIORITY_LABELS,
  AGE_ICONS,
  EXPERIENCE_ICONS,
  CONTEXT_ICONS,
  PRIORITY_ICONS,
  PRIORITY2_LABEL,
  PRIORITY2_ICON,
  type AgeRange,
  type ExperienceRange,
  type TrainingContext,
  type PriorityType,
} from "../../lib/labels";

// Versión legal actual - debe coincidir con LegalPage
const LEGAL_VERSION = "2026-01-11";

// Construir opciones para cada CardGroup
const ageCardOptions: CardOption<AgeRange>[] = AGE_OPTIONS.map((v) => ({
  value: v,
  label: AGE_LABELS[v],
  icon: AGE_ICONS[v],
}));

const experienceCardOptions: CardOption<ExperienceRange>[] = EXPERIENCE_OPTIONS.map((v) => ({
  value: v,
  label: EXPERIENCE_LABELS[v],
  icon: EXPERIENCE_ICONS[v],
}));

const contextCardOptions: CardOption<TrainingContext>[] = CONTEXT_OPTIONS.map((v) => ({
  value: v,
  label: CONTEXT_LABELS[v],
  icon: CONTEXT_ICONS[v],
}));

const priority1CardOptions: CardOption<PriorityType>[] = PRIORITY_OPTIONS.map((v) => ({
  value: v,
  label: PRIORITY_LABELS[v],
  icon: PRIORITY_ICONS[v],
}));

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Valores del formulario - SIN preselección (null = no seleccionado)
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [experienceRange, setExperienceRange] = useState<ExperienceRange | null>(null);
  const [trainingContext, setTrainingContext] = useState<TrainingContext | null>(null);
  const [priority1, setPriority1] = useState<PriorityType | null>(null);
  const [priority2, setPriority2] = useState<"" | PriorityType>("");

  // Checkboxes legales
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptDisclaimer, setAcceptDisclaimer] = useState(false);

  // Ya tiene perfil guardado?
  const [hasLegalAccepted, setHasLegalAccepted] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user) return;

      setLoading(true);
      setErrorMsg(null);

      const res = await getMyProfile(user.id);
      if (res.error) {
        setErrorMsg(res.error);
        setLoading(false);
        return;
      }

      if (res.data) {
        const p = res.data;
        setIsEdit(true);

        // Solo preseleccionar si existe perfil (modo edición)
        setAgeRange(p.age_range as AgeRange);
        setExperienceRange(p.experience_range as ExperienceRange);
        setTrainingContext(p.training_context as TrainingContext);
        setPriority1(p.priority1 as PriorityType);
        setPriority2((p.priority2 as PriorityType) ?? "");

        // Verificar si ya aceptó términos (usando any para evitar error de tipo)
        const profileAny = p as Record<string, unknown>;
        if (profileAny.terms_accepted_at) {
          setHasLegalAccepted(true);
          setAcceptTerms(true);
          setAcceptDisclaimer(true);
        }
      } else {
        // Modo nuevo usuario - todo sin preseleccionar
        setIsEdit(false);
        setAgeRange(null);
        setExperienceRange(null);
        setTrainingContext(null);
        setPriority1(null);
        setPriority2("");
      }

      setLoading(false);
    };

    run();
  }, [user]);

  // Opciones de priority2: permitimos "" (Ninguno) + todas excepto la elegida en priority1
  const priority2CardOptions = useMemo<CardOption<"" | PriorityType>[]>(() => {
    return PRIORITY2_OPTIONS.filter((p2) => p2 === "" || p2 !== priority1).map((v) => ({
      value: v,
      label: PRIORITY2_LABEL(v),
      icon: PRIORITY2_ICON(v),
    }));
  }, [priority1]);

  const onChangePriority1 = (v: PriorityType) => {
    setPriority1(v);
    setPriority2((prev) => (prev === v ? "" : prev));
    setErrorMsg(null);
  };

  const onChangePriority2 = (v: "" | PriorityType) => {
    setPriority2(v);
    setErrorMsg(null);
  };

  const validate = () => {
    if (!user) return "No hay usuario autenticado.";
    if (!ageRange) return "Selecciona tu rango de edad.";
    if (!experienceRange) return "Selecciona tu experiencia.";
    if (!trainingContext) return "Selecciona dónde entrenas.";
    if (!priority1) return "Selecciona tu objetivo principal.";

    if (priority2 && priority2 === priority1) {
      return "El objetivo secundario debe ser diferente al principal.";
    }

    // Validar términos solo si es nuevo usuario
    if (!isEdit && !hasLegalAccepted) {
      if (!acceptTerms) {
        return "Debes aceptar los Términos y Política de Privacidad.";
      }
      if (!acceptDisclaimer) {
        return "Debes aceptar el Disclaimer de Salud.";
      }
    }

    return null;
  };

  const handleSave = async () => {
    setErrorMsg(null);

    const effectivePriority2: "" | PriorityType =
      priority2 && priority2 === priority1 ? "" : priority2;

    if (effectivePriority2 !== priority2) {
      setPriority2(effectivePriority2);
    }

    const msg = validate();
    if (msg) {
      setErrorMsg(msg);
      return;
    }

    if (!user || !ageRange || !experienceRange || !trainingContext || !priority1) return;

    setSaving(true);

    const now = new Date().toISOString();

    // Construir payload base
    const payload: Record<string, unknown> = {
      id: user.id,
      age_range: ageRange,
      experience_range: experienceRange,
      training_context: trainingContext,
      priority1: priority1,
      priority2: effectivePriority2 === "" ? null : effectivePriority2,
    };

    // Agregar campos legales solo si es nuevo usuario y aceptó
    if (!isEdit && !hasLegalAccepted && acceptTerms && acceptDisclaimer) {
      payload.terms_accepted_at = now;
      payload.privacy_accepted_at = now;
      payload.disclaimer_accepted_at = now;
      payload.legal_version = LEGAL_VERSION;
    }

    const res = await upsertMyProfile(payload as Parameters<typeof upsertMyProfile>[0]);

    if (res.error) {
      setSaving(false);
      setErrorMsg(res.error);
      return;
    }

    // Sincronizar el track del programa con el nuevo perfil
    const profileForSync = {
      id: user.id,
      age_range: ageRange,
      experience_range: experienceRange,
      training_context: trainingContext,
      priority1: priority1,
      priority2: effectivePriority2 === "" ? null : effectivePriority2,
    };

    const syncRes = await syncTrackWithProfile(user.id, profileForSync as Parameters<typeof syncTrackWithProfile>[1]);
    
    if (syncRes.error) {
      console.error("Error syncing track with profile:", syncRes.error);
    }

    setSaving(false);
    navigate("/", { replace: true });
  };

  const handleOpenTerms = () => {
    window.open("/legal?tab=terms", "_blank");
  };

  const handleOpenPrivacy = () => {
    window.open("/legal?tab=privacy", "_blank");
  };

  const handleOpenDisclaimer = () => {
    window.open("/legal?tab=disclaimer", "_blank");
  };

  const title = isEdit ? "EDITAR PERFIL" : "CONFIGURA TU PERFIL";
  const subtitle = isEdit
    ? "Actualiza tu información de entrenamiento"
    : "Cuéntanos sobre ti para personalizar tu experiencia";

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loadingState}>
            <span className={styles.spinner}></span>
            <p>Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>⚡</div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        {errorMsg && (
          <div className={styles.errorBanner}>
            <span>⚠️</span>
            {errorMsg}
          </div>
        )}

        <div className={styles.form}>
          {/* Rango de Edad */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>RANGO DE EDAD</label>
            <SelectableCardGroup<AgeRange>
              options={ageCardOptions}
              value={ageRange}
              onChange={(v) => { setAgeRange(v); setErrorMsg(null); }}
              columns={4}
              disabled={saving}
              size="compact"
            />
          </div>

          {/* Experiencia */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>EXPERIENCIA (AÑOS ENTRENANDO)</label>
            <SelectableCardGroup<ExperienceRange>
              options={experienceCardOptions}
              value={experienceRange}
              onChange={(v) => { setExperienceRange(v); setErrorMsg(null); }}
              columns={3}
              disabled={saving}
            />
          </div>

          {/* Contexto de entrenamiento */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>¿DÓNDE ENTRENAS?</label>
            <SelectableCardGroup<TrainingContext>
              options={contextCardOptions}
              value={trainingContext}
              onChange={(v) => { setTrainingContext(v); setErrorMsg(null); }}
              columns={3}
              disabled={saving}
            />
          </div>

          {/* Objetivo Principal */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>OBJETIVO PRINCIPAL</label>
            <SelectableCardGroup<PriorityType>
              options={priority1CardOptions}
              value={priority1}
              onChange={onChangePriority1}
              columns={5}
              disabled={saving}
              size="compact"
            />
          </div>

          {/* Objetivo Secundario */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              OBJETIVO SECUNDARIO <span className={styles.optional}>(opcional)</span>
            </label>
            <SelectableCardGroup<"" | PriorityType>
              options={priority2CardOptions}
              value={priority2}
              onChange={onChangePriority2}
              columns={3}
              disabled={saving}
            />
          </div>

          {/* ============================================
              CHECKBOXES LEGALES - Solo para nuevos usuarios
              ============================================ */}
          {!isEdit && !hasLegalAccepted && (
            <div className={styles.legalSection}>
              <div className={styles.legalTitle}>Términos y Condiciones</div>

              {/* Checkbox términos y privacidad */}
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  disabled={saving}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxText}>
                  He leído y acepto los{" "}
                  <button type="button" className={styles.legalLink} onClick={handleOpenTerms}>
                    Términos de Servicio
                  </button>{" "}
                  y la{" "}
                  <button type="button" className={styles.legalLink} onClick={handleOpenPrivacy}>
                    Política de Privacidad
                  </button>
                </span>
              </label>

              {/* Checkbox disclaimer salud */}
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={acceptDisclaimer}
                  onChange={(e) => setAcceptDisclaimer(e.target.checked)}
                  disabled={saving}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxText}>
                  Entiendo que esta app no es consejo médico y entreno bajo mi propio riesgo.{" "}
                  <button type="button" className={styles.legalLink} onClick={handleOpenDisclaimer}>
                    Ver Disclaimer
                  </button>
                </span>
              </label>
            </div>
          )}

          <button
            className={styles.primaryBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : isEdit ? "GUARDAR CAMBIOS" : "CREAR PERFIL"}
          </button>

          {isEdit && (
            <button
              className={styles.secondaryBtn}
              onClick={() => navigate("/", { replace: true })}
              disabled={saving}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
