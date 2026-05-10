import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type RoleState = {
  loading: boolean;
  session: Session | null;
  isAdmin: boolean;
};

/** Tracks the current session and whether the signed-in user has the `admin` role. */
export function useUserRole(): RoleState {
  const [state, setState] = useState<RoleState>({ loading: true, session: null, isAdmin: false });

  useEffect(() => {
    let cancelled = false;

    const resolve = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) setState({ loading: false, session: null, isAdmin: false });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      setState({ loading: false, session, isAdmin: !!data });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      // Defer DB read out of the auth callback to avoid deadlocks.
      setTimeout(() => resolve(session), 0);
    });
    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** Where to send a user after they sign in, based on their role. */
export function landingPathForRole(isAdmin: boolean) {
  return isAdmin ? "/admin/images" : "/";
}