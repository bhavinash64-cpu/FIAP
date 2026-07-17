import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  isSuperAdmin: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function applySession(nextSession: Session | null) {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      const role = await loadRole(nextSession.user.id);
      if (!active) return;
      setIsSuperAdmin(role);
      setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      void applySession(nextSession);
    });

    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, user, isSuperAdmin, loading }), [session, user, isSuperAdmin, loading]);

  return createElement(AuthContext.Provider, { value }, children);
}

async function loadRole(uid: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .eq("role", "super_admin")
    .maybeSingle();

  if (error) return false;
  return data?.role === "super_admin";
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside AuthProvider");
  return state;
}