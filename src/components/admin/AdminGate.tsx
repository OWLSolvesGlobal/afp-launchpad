import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogIn } from "lucide-react";

/** Wrap admin pages: requires a signed-in user with the `admin` role. */
export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "anon" | "ok" | "forbidden">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const evaluate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setEmail(null);
          setState("anon");
        }
        return;
      }
      if (!cancelled) setEmail(session.user.email ?? null);
      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (cancelled) return;
      setState(role ? "ok" : "forbidden");
    };

    // Initial check
    evaluate();

    // Re-evaluate on auth changes (sign out in another tab, token refresh, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (cancelled) return;
        // Aggressively clear any locally cached supabase session keys so a
        // stale token can't be reused by other tabs / scripts.
        try {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("sb-")) localStorage.removeItem(key);
          }
        } catch { /* storage may be unavailable */ }
        setEmail(null);
        setState("anon");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setTimeout(() => { if (!cancelled) evaluate(); }, 0);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return <div className="min-h-screen grid place-items-center text-graphite eyebrow">Checking access…</div>;
  }
  if (state === "anon") {
    return (
      <UnauthorizedScreen
        icon={<LogIn className="w-8 h-8" />}
        title="Sign in required"
        message="The admin area is restricted. Please sign in with an admin account to continue."
        primary={{ label: "Sign in", to: `/auth?next=${encodeURIComponent(window.location.pathname)}` }}
        secondary={{ label: "Back to storefront", to: "/" }}
      />
    );
  }
  if (state === "forbidden") {
    return (
      <UnauthorizedScreen
        icon={<ShieldAlert className="w-8 h-8" />}
        title="Admins only"
        message={
          email
            ? `Your account (${email}) doesn't have admin permissions. Contact an existing admin to be added to the allowlist.`
            : "Your account doesn't have admin permissions."
        }
        primary={{ label: "Back to storefront", to: "/" }}
        secondary={{
          label: "Switch account",
          onClick: async () => { await supabase.auth.signOut(); },
        }}
      />
    );
  }
  return <>{children}</>;
}

function UnauthorizedScreen({
  icon, title, message, primary, secondary,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  primary: { label: string; to?: string; onClick?: () => void };
  secondary?: { label: string; to?: string; onClick?: () => void };
}) {
  const renderBtn = (b: { label: string; to?: string; onClick?: () => void }, variant: "afp-primary" | "outline") => {
    if (b.to) return <Link to={b.to}><Button variant={variant} size="afp">{b.label}</Button></Link>;
    return <Button variant={variant} size="afp" onClick={b.onClick}>{b.label}</Button>;
  };
  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="max-w-md w-full border border-border bg-card p-8 text-center">
        <div className="mx-auto w-12 h-12 grid place-items-center border border-border rounded-full text-graphite mb-4">
          {icon}
        </div>
        <div className="eyebrow text-graphite mb-2">Access denied</div>
        <h1 className="display-sm mb-3">{title}</h1>
        <p className="text-sm text-graphite mb-6">{message}</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {renderBtn(primary, "afp-primary")}
          {secondary && renderBtn(secondary, "outline")}
        </div>
      </div>
    </div>
  );
}