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
    toast.success("You're in. Watch your inbox.");
  };

  return (
    <section className="bg-lime text-ink">
      <div className="container py-12 md:py-16 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="eyebrow mb-3">— Drop List</div>
          <h2 className="display-md">Get The Drop First.</h2>
          <p className="mt-3 text-sm md:text-base max-w-md text-ink/80">
            Early access to launches, restocks and athlete-only discounts.
            No spam, only sweat.
          </p>
        </div>

        <form onSubmit={submit} className="flex w-full items-stretch border border-ink">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 bg-transparent px-4 py-4 outline-none placeholder:text-ink/50 text-base"
            aria-label="Email address"
          />
          <button
            type="submit"
            className="bg-ink text-bone px-5 md:px-8 eyebrow flex items-center gap-2 hover:bg-ink-soft transition-colors"
          >
            {done ? <Check className="w-4 h-4" /> : <>Join <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </section>
  );
};
