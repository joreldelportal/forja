// ============================================
// LegalPage.tsx
// Página con tabs para Terms, Privacy, Disclaimer
// ============================================

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./LegalPage.module.css";

type Tab = "terms" | "privacy" | "disclaimer";

// Versión legal actual - actualizar cuando cambien los términos
export const LEGAL_VERSION = "2026-01-11";

export default function LegalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const initialTab = (searchParams.get("tab") as Tab) || "terms";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Volver
          </button>
          <h1 className={styles.title}>Legal</h1>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "terms" ? styles.active : ""}`}
            onClick={() => setActiveTab("terms")}
          >
            Términos
          </button>
          <button
            className={`${styles.tab} ${activeTab === "privacy" ? styles.active : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            Privacidad
          </button>
          <button
            className={`${styles.tab} ${activeTab === "disclaimer" ? styles.active : ""}`}
            onClick={() => setActiveTab("disclaimer")}
          >
            Disclaimer
          </button>
        </div>

        {/* Content */}
        <div className={styles.legalContent}>
          {activeTab === "terms" && <TermsContent />}
          {activeTab === "privacy" && <PrivacyContent />}
          {activeTab === "disclaimer" && <DisclaimerContent />}
        </div>

        <div className={styles.version}>
          Versión: {LEGAL_VERSION}
        </div>
      </div>
    </div>
  );
}

// ============================================
// TÉRMINOS DE SERVICIO
// ============================================
function TermsContent() {
  return (
    <div className={styles.section}>
      <h2>Términos de Servicio</h2>
      <p className={styles.updated}>Última actualización: {LEGAL_VERSION}</p>

      <h3>1. Aceptación de Términos</h3>
      <p>
        Al acceder y utilizar Forja ("la App"), aceptas cumplir con estos Términos de Servicio.
        Si no estás de acuerdo con alguna parte de estos términos, no debes usar la App.
      </p>

      <h3>2. Descripción del Servicio</h3>
      <p>
        Forja es una aplicación de fitness que proporciona rutinas de entrenamiento guiadas
        mediante temporizadores y señales de audio. La App está diseñada para uso personal
        y no comercial.
      </p>

      <h3>3. Cuenta de Usuario</h3>
      <p>
        Para usar Forja, debes crear una cuenta proporcionando información veraz y actualizada.
        Eres responsable de mantener la confidencialidad de tu cuenta y contraseña.
      </p>

      <h3>4. Uso Aceptable</h3>
      <p>Te comprometes a:</p>
      <ul>
        <li>Usar la App solo para fines personales de fitness</li>
        <li>No compartir tu cuenta con terceros</li>
        <li>No intentar hackear, modificar o dañar la App</li>
        <li>No usar la App para actividades ilegales</li>
      </ul>

      <h3>5. Propiedad Intelectual</h3>
      <p>
        Todo el contenido de Forja, incluyendo rutinas, diseño, código y marcas,
        son propiedad de Forja o sus licenciantes. No puedes copiar, modificar
        o distribuir este contenido sin autorización.
      </p>

      <h3>6. Limitación de Responsabilidad</h3>
      <p>
        Forja se proporciona "tal cual" sin garantías de ningún tipo.
        No nos hacemos responsables de lesiones, daños o pérdidas que puedan
        resultar del uso de la App.
      </p>

      <h3>7. Modificaciones</h3>
      <p>
        Podemos modificar estos términos en cualquier momento. Te notificaremos
        sobre cambios significativos. El uso continuado de la App después de
        dichos cambios constituye tu aceptación.
      </p>

      <h3>8. Terminación</h3>
      <p>
        Podemos suspender o terminar tu acceso a la App en cualquier momento
        por violación de estos términos o por cualquier otra razón.
      </p>

      <h3>9. Contacto</h3>
      <p>
        Para preguntas sobre estos términos, contáctanos en: soporte@forja.app
      </p>
    </div>
  );
}

// ============================================
// POLÍTICA DE PRIVACIDAD
// ============================================
function PrivacyContent() {
  return (
    <div className={styles.section}>
      <h2>Política de Privacidad</h2>
      <p className={styles.updated}>Última actualización: {LEGAL_VERSION}</p>

      <h3>1. Información que Recopilamos</h3>
      <p>Recopilamos la siguiente información:</p>
      <ul>
        <li><strong>Datos de cuenta:</strong> Email y contraseña (encriptada)</li>
        <li><strong>Perfil de fitness:</strong> Edad, experiencia, objetivos, contexto de entrenamiento</li>
        <li><strong>Datos de uso:</strong> Entrenamientos completados, duración, progreso</li>
        <li><strong>Preferencias:</strong> Configuración de sonido, rutinas personalizadas</li>
      </ul>

      <h3>2. Cómo Usamos tu Información</h3>
      <p>Utilizamos tu información para:</p>
      <ul>
        <li>Personalizar tus rutinas de entrenamiento</li>
        <li>Guardar tu progreso y estadísticas</li>
        <li>Mejorar la experiencia de la App</li>
        <li>Enviarte comunicaciones importantes sobre tu cuenta</li>
      </ul>

      <h3>3. Almacenamiento y Seguridad</h3>
      <p>
        Tus datos se almacenan de forma segura utilizando Supabase con encriptación.
        Las contraseñas nunca se almacenan en texto plano.
        Implementamos medidas de seguridad estándar de la industria.
      </p>

      <h3>4. Compartición de Datos</h3>
      <p>
        No vendemos ni compartimos tu información personal con terceros,
        excepto cuando sea necesario para:
      </p>
      <ul>
        <li>Cumplir con obligaciones legales</li>
        <li>Proteger nuestros derechos o seguridad</li>
        <li>Proveer el servicio (ej: almacenamiento en la nube)</li>
      </ul>

      <h3>5. Tus Derechos</h3>
      <p>Tienes derecho a:</p>
      <ul>
        <li>Acceder a tus datos personales</li>
        <li>Corregir información incorrecta</li>
        <li>Solicitar la eliminación de tu cuenta y datos</li>
        <li>Exportar tus datos</li>
      </ul>

      <h3>6. Cookies y Almacenamiento Local</h3>
      <p>
        Usamos localStorage para guardar preferencias de la App como
        configuración de sonido y tips mostrados. No usamos cookies de
        seguimiento de terceros.
      </p>

      <h3>7. Retención de Datos</h3>
      <p>
        Mantenemos tus datos mientras tu cuenta esté activa.
        Puedes solicitar la eliminación de tu cuenta en cualquier momento.
        Tras la eliminación, tus datos serán borrados en un plazo de 30 días.
      </p>

      <h3>8. Cambios a esta Política</h3>
      <p>
        Podemos actualizar esta política. Te notificaremos sobre cambios
        significativos a través de la App o por email.
      </p>

      <h3>9. Contacto</h3>
      <p>
        Para preguntas sobre privacidad: privacidad@forja.app
      </p>
    </div>
  );
}

// ============================================
// DISCLAIMER DE SALUD
// ============================================
function DisclaimerContent() {
  return (
    <div className={styles.section}>
      <h2>Disclaimer de Salud</h2>
      <p className={styles.updated}>Última actualización: {LEGAL_VERSION}</p>

      <div className={styles.warningBox}>
        <span className={styles.warningIcon}>⚠️</span>
        <p>
          <strong>IMPORTANTE:</strong> Esta aplicación no proporciona consejo médico.
          Consulta a un profesional de la salud antes de comenzar cualquier programa de ejercicio.
        </p>
      </div>

      <h3>1. No es Consejo Médico</h3>
      <p>
        El contenido de Forja, incluyendo rutinas, ejercicios y recomendaciones,
        es solo para fines informativos y educativos. No constituye consejo médico,
        diagnóstico ni tratamiento.
      </p>

      <h3>2. Consulta Profesional</h3>
      <p>
        Antes de comenzar cualquier programa de ejercicio, debes:
      </p>
      <ul>
        <li>Consultar con tu médico, especialmente si tienes condiciones de salud preexistentes</li>
        <li>Evaluar tu condición física actual con un profesional</li>
        <li>Informar a un entrenador certificado sobre cualquier limitación</li>
      </ul>

      <h3>3. Riesgo de Lesiones</h3>
      <p>
        El ejercicio físico conlleva riesgos inherentes de lesión. Al usar Forja,
        reconoces y aceptas que:
      </p>
      <ul>
        <li>Participas en las actividades bajo tu propio riesgo</li>
        <li>Eres responsable de usar técnica correcta</li>
        <li>Debes detenerte si sientes dolor, mareo o malestar</li>
        <li>Forja no es responsable de lesiones resultantes del uso de la App</li>
      </ul>

      <h3>4. Limitaciones</h3>
      <p>
        Las estimaciones de tiempo y repeticiones son aproximadas.
        Cada persona es diferente y debes adaptar los ejercicios a tu capacidad.
        No intentes ejercicios que estén más allá de tu nivel actual.
      </p>

      <h3>5. Señales de Advertencia</h3>
      <p>
        Detén el ejercicio inmediatamente y busca atención médica si experimentas:
      </p>
      <ul>
        <li>Dolor en el pecho o dificultad para respirar</li>
        <li>Mareos o desmayos</li>
        <li>Dolor agudo en articulaciones o músculos</li>
        <li>Náuseas o vómitos</li>
        <li>Cualquier síntoma inusual</li>
      </ul>

      <h3>6. Hidratación y Nutrición</h3>
      <p>
        Mantén una hidratación adecuada antes, durante y después del ejercicio.
        Una nutrición apropiada es esencial para un entrenamiento seguro.
      </p>

      <h3>7. Equipo y Entorno</h3>
      <p>
        Asegúrate de:
      </p>
      <ul>
        <li>Usar equipo en buen estado y apropiado para cada ejercicio</li>
        <li>Entrenar en un espacio seguro y adecuado</li>
        <li>Usar calzado deportivo apropiado</li>
        <li>Tener supervisión si realizas ejercicios con pesos pesados</li>
      </ul>

      <h3>8. Aceptación</h3>
      <p>
        Al usar Forja, confirmas que has leído y comprendido este disclaimer,
        y aceptas entrenar bajo tu propia responsabilidad.
      </p>
    </div>
  );
}
