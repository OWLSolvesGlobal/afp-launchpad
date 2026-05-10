import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { landingPathForRole } from "@/hooks/useUserRole";

async function destinationForUser(userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return landingPathForRole(!!data);
}

export default function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Sign in — AFP";
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const to = await destinationForUser(data.session.user.id);
        nav(to, { replace: true });
      }
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm.");
      } else {
        const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        const to = signed.user ? await destinationForUser(signed.user.id) : "/";
        nav(to, { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container pt-28 pb-24 max-w-md">
        <h1 className="display-lg mb-2">{mode === "signup" ? "Create account" : "Sign in"}<span className="text-safety">.</span></h1>
        <p className="text-sm text-graphite mb-8">Admin access for the catalog sync and image uploads.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-6 text-sm text-graphite underline underline-offset-4"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </main>
      <Footer />
    </div>
  );
}