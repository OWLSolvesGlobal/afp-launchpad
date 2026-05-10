import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Wrap admin pages: requires a signed-in user with the `admin` role. */
export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "anon" | "ok" | "forbidden">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          toast.error("Please sign in to access the admin area.");
          setState("anon");
        }
        return;
      }
      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (cancelled) return;
      if (!role) {
        toast.error("Admin access only — redirected to storefront.");
        setState("forbidden");
      } else {
        setState("ok");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") {
    return <div className="min-h-screen grid place-items-center text-graphite eyebrow">Loading…</div>;
  }
  if (state === "anon") return <Navigate to="/auth" replace />;
  if (state === "forbidden") return <Navigate to="/" replace />;
  return <>{children}</>;
}