import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

export const EmailCapture = () => {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email.");
      return;
    }
    setDone(true);
    toast.success("You're on the roster.");
  };

  return (
    <section className="bg-ink text-bone border-y border-steel">
      <div className="container py-12 md:py-16 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="eyebrow text-safety mb-3">— The Roster</div>
          <h2 className="display-md">Join The Roster.</h2>
          <p className="mt-3 text-sm md:text-base max-w-md text-bone/70">
            10% off your first order. Early access to drops, restocks,
            and athlete-only releases. No fluff.
          </p>
        </div>

        <form onSubmit={submit} className="flex w-full items-stretch border border-bone/40">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 bg-transparent px-4 py-4 outline-none placeholder:text-bone/40 text-base text-bone"
            aria-label="Email address"
          />
          <button
            type="submit"
            className="bg-safety text-bone px-5 md:px-8 eyebrow flex items-center gap-2 hover:bg-safety-deep transition-colors"
          >
            {done ? <Check className="w-4 h-4" /> : <>Join <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </section>
  );
};
