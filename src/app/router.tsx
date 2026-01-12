import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

// Layout
import MainLayout from "../components/MainLayout/MainLayout";

// Auth pages (sin tabs)
import AuthPage from "../pages/Auth/AuthPage";
import ResetPasswordPage from "../pages/Auth/ResetPasswordPage";

// Main pages (con tabs)
import HomePage from "../pages/Home/HomePage";
import TrainPage from "../pages/Train/TrainPage";
import ExplorePage from "../pages/Explore/ExplorePage";
import ProfilePage from "../pages/Profile/ProfilePage";

// Flow pages (sin tabs - pantalla completa)
import OnboardingPage from "../pages/Onboarding/OnboardingPage";
import PlanRoutinePreviewPage from "../pages/Plan/PlanRoutinePreviewPage";
import WorkoutPage from "../pages/Workout/WorkoutPage";

// Custom Routine pages (sin tabs - flujo de edición)
import CustomRoutineBuilderPage from "../pages/CustomRoutine/CustomRoutineBuilderPage";
import CustomRoutineEditorPage from "../pages/CustomRoutine/CustomRoutineEditorPage";

// Legal pages (sin tabs)
import LegalPage from "../pages/Legal/LegalPage";

// ============================================
// PROTECTED ROUTE WRAPPER
// ============================================

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0a0a0a",
          color: "#fff",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "#22c55e",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ opacity: 0.6 }}>Cargando...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// ============================================
// ROUTER CONFIGURATION
// ============================================

export const router = createBrowserRouter([
  // ==========================================
  // AUTH ROUTES (públicas, sin tabs)
  // ==========================================
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },

  // ==========================================
  // ONBOARDING (protegida, sin tabs)
  // ==========================================
  {
    path: "/onboarding",
    element: (
      <Protected>
        <OnboardingPage />
      </Protected>
    ),
  },

  // ==========================================
  // LEGAL (protegida, sin tabs)
  // ==========================================
  {
    path: "/legal",
    element: (
      <Protected>
        <LegalPage />
      </Protected>
    ),
  },

  // ==========================================
  // MAIN TABS (protegidas, con TabBar)
  // ==========================================
  {
    element: (
      <Protected>
        <MainLayout />
      </Protected>
    ),
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/train",
        element: <TrainPage />,
      },
      {
        path: "/explore",
        element: <ExplorePage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
    ],
  },

  // ==========================================
  // FLOW ROUTES (protegidas, sin tabs)
  // Pantallas de flujo que requieren atención completa
  // ==========================================

  // Preview de rutina antes de entrenar
  {
    path: "/plan/routine/:id",
    element: (
      <Protected>
        <PlanRoutinePreviewPage />
      </Protected>
    ),
  },

  // Player de entrenamiento
  {
    path: "/workout/:sessionId",
    element: (
      <Protected>
        <WorkoutPage />
      </Protected>
    ),
  },

  // ==========================================
  // CUSTOM ROUTINE ROUTES (protegidas, sin tabs)
  // Flujo de creación/edición de rutinas
  // ==========================================

  // Builder de rutina personalizada
  {
    path: "/custom-routine/builder",
    element: (
      <Protected>
        <CustomRoutineBuilderPage />
      </Protected>
    ),
  },

  // Editor de rutina personalizada
  {
    path: "/custom-routine/:routineId",
    element: (
      <Protected>
        <CustomRoutineEditorPage />
      </Protected>
    ),
  },

  // ==========================================
  // LEGACY REDIRECTS
  // Mantener compatibilidad con rutas antiguas
  // ==========================================
  {
    path: "/plan",
    element: <Navigate to="/train" replace />,
  },
  {
    path: "/custom-routine/list",
    element: <Navigate to="/train" replace />,
  },

  // ==========================================
  // CATCH-ALL
  // ==========================================
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
