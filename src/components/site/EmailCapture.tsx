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
    <section className="bg-background border-t border-border">
      <div className="container py-16 md:py-24 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div>
          <div className="eyebrow text-graphite mb-3">— Insiders Only</div>
          <h2 className="display-md text-foreground">
            Get <em className="italic">10% off</em><br />your first order.
          </h2>
          <p className="mt-4 text-sm md:text-base max-w-md text-graphite leading-relaxed">
            Early access to new drops, restocks, and members-only colorways.
            One email a week. No spam, ever.
          </p>
        </div>

        <form onSubmit={submit} className="flex w-full items-stretch border-b-2 border-foreground">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 bg-transparent px-2 py-4 outline-none placeholder:text-graphite/50 text-base text-foreground"
            aria-label="Email address"
          />
          <button
            type="submit"
            className="text-foreground px-4 eyebrow flex items-center gap-2 hover:text-graphite transition-colors"
          >
            {done ? <Check className="w-4 h-4" /> : <>Join <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </section>
  );
};
