// src/hooks/useProfileStatus.ts
import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useAuthStore } from "../stores/authStore";

export function useProfileStatus() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Profile check error:", error);
      }

      setHasProfile(!!data);
      setLoading(false);
    };

    checkProfile();
  }, [user]);

  return { loading, hasProfile };
}
