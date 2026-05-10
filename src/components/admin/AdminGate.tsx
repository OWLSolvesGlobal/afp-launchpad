import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Wrap admin pages: requires a signed-in user with the `admin` role. */
export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "anon" | "ok" | "forbidden">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!cancelled) setState("anon"); return; }
      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (cancelled) return;
      setState(role ? "ok" : "forbidden");
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") {
    return <div className="min-h-screen grid place-items-center text-graphite eyebrow">Loading…</div>;
  }
  if (state === "anon") return <Navigate to="/auth" replace />;
  if (state === "forbidden") {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <div className="eyebrow text-safety mb-2">Access denied</div>
          <p className="text-sm text-graphite max-w-md">
            Your account doesn't have the <code>admin</code> role.
            Ask the project owner to grant it in the database (table <code>user_roles</code>).
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}