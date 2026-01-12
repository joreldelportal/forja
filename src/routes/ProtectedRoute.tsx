// src/routes/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useProfileStatus } from "../hooks/useProfileStatus";

export function ProtectedRoute() {
  const { user, loading: authLoading } = useAuthStore();
  const { loading, hasProfile } = useProfileStatus();

  if (authLoading || loading) return null; // loader luego

  if (!user) return <Navigate to="/auth" replace />;

  if (!hasProfile) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
