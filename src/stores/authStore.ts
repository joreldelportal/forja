import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";

// URL base según entorno (producción vs desarrollo)
const SITE_URL = import.meta.env.PROD 
  ? "https://joreldelportal.com/forja" 
  : window.location.origin;

type SignUpResult = {
  ok: boolean;
  needsEmailConfirmation?: boolean;
  userExists?: boolean;
  error?: string;
};

type SignInResult = {
  ok: boolean;
  error?: string;
};

type ResetPasswordResult = {
  ok: boolean;
  error?: string;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<ResetPasswordResult>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  init: async () => {
    set({ loading: true, error: null });

    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      loading: false,
    });

    // Escucha cambios (login/logout/refresh/recovery)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signUp: async (email, password) => {
    const e = email.trim();
    const p = password.trim();

    set({ loading: true, error: null });

    const res = await supabase.auth.signUp({
      email: e,
      password: p,
      options: { emailRedirectTo: SITE_URL + "/" },
    });

    set({ loading: false });

    // Detectar si el usuario ya existe
    if (res.error) {
      const errMsg = res.error.message.toLowerCase();
      const userExists =
        errMsg.includes("already registered") ||
        errMsg.includes("already exists") ||
        errMsg.includes("user already") ||
        errMsg.includes("already been registered");

      set({ error: res.error.message });

      return {
        ok: false,
        userExists,
        error: res.error.message,
      };
    }

    // Caso: usuario ya existía (identities vacío, sin error explícito)
    if (
      res.data.user &&
      res.data.user.identities &&
      res.data.user.identities.length === 0
    ) {
      set({ error: "Este correo ya está registrado." });
      return {
        ok: false,
        userExists: true,
        error: "Este correo ya está registrado.",
      };
    }

    // Caso: signup OK pero requiere confirmación de email
    if (res.data.user && !res.data.session) {
      return {
        ok: true,
        needsEmailConfirmation: true,
      };
    }

    // Caso: signup OK y sesión creada (sin confirmación requerida)
    if (res.data.user && res.data.session) {
      set({
        user: res.data.user,
        session: res.data.session,
      });
      return {
        ok: true,
        needsEmailConfirmation: false,
      };
    }

    // Fallback
    return {
      ok: false,
      error: "Error desconocido al crear cuenta.",
    };
  },

  signIn: async (email, password) => {
    const e = email.trim();
    const p = password.trim();

    if (!e || !p) {
      const msg = "Email y password son obligatorios.";
      set({ error: msg });
      return { ok: false, error: msg };
    }

    set({ loading: true, error: null });

    const res = await supabase.auth.signInWithPassword({ email: e, password: p });

    console.log("SIGNIN RES:", res);

    if (res.error) {
      set({ loading: false, error: res.error.message });
      return { ok: false, error: res.error.message };
    }

    // ✅ FIX: Actualizar user y session en el estado
    set({
      loading: false,
      error: null,
      user: res.data.user,
      session: res.data.session,
    });

    return { ok: true };
  },

  signOut: async () => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signOut();
    set({
      loading: false,
      error: error?.message ?? null,
      session: null,
      user: null,
    });
  },

  resetPassword: async (email) => {
    const e = email.trim();
    if (!e) {
      const msg = "Ingresa tu email para recuperar contraseña.";
      set({ error: msg });
      return { ok: false, error: msg };
    }

    set({ loading: true, error: null });

    const { error } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: SITE_URL + "/reset-password",
    });

    set({ loading: false });

    if (error) {
      set({ error: error.message });
      return {
        ok: false,
        error: error.message,
      };
    }

    return { ok: true };
  },
}));
