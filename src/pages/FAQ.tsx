import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Minus, Truck, RotateCcw, Ruler, ShieldCheck, Mail } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

const sections = [
  {
    icon: Truck,
    title: "Shipping",
    items: [
      {
        q: "How long does shipping take?",
        a: "Standard US orders ship in 1–2 business days and arrive in 3–5 business days. Express options are available at checkout. International orders typically take 7–14 business days depending on customs.",
      },
      {
        q: "Do you offer free shipping?",
        a: "Yes — free standard US shipping on all orders over $150.",
      },
      {
        q: "Can I pick up locally?",
        a: "We offer free pickup at two locations: Downtown and Westside. Choose 'Store Pickup' at checkout to see address and ready-time details.",
      },
      {
        q: "Do you ship internationally?",
        a: "We ship worldwide. Duties and taxes are calculated at checkout for most regions.",
      },
    ],
  },
  {
    icon: RotateCcw,
    title: "Returns & Exchanges",
    items: [
      {
        q: "What's your return policy?",
        a: "30 days, no questions asked. Items must be unworn, with tags attached. Initiate a return from your order email or contact us.",
      },
      {
        q: "Are exchanges free?",
        a: "Size exchanges within 30 days are free in the US. We'll send the new size as soon as the original ships back.",
      },
      {
        q: "What about sale items?",
        a: "Sale items are eligible for store credit only. Final-sale items are clearly marked at checkout.",
      },
    ],
  },
  {
    icon: Ruler,
    title: "Sizing & Fit",
    items: [
      {
        q: "How do AFP pieces fit?",
        a: "Most styles are true to size. Compression pieces (Apex, Sculpt, Pulse) fit snug — size up for a relaxed feel. Oversized styles are intentionally roomy; size down if you prefer a closer fit.",
      },
      {
        q: "Where can I find a size guide?",
        a: "Each product page has a 'Size guide' link next to the size selector with measurements in inches and cm.",
      },
      {
        q: "What if it doesn't fit?",
        a: "Free size exchanges within 30 days (US). Reach out and we'll make it right.",
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Product & Care",
    items: [
      {
        q: "What are AFP pieces made from?",
        a: "Most styles use 82% recycled polyester and 18% elastane for four-way stretch and moisture-wicking performance. Heavyweight pieces use a brushed cotton-poly blend.",
      },
      {
        q: "How should I wash my gear?",
        a: "Machine wash cold, tumble dry low. No bleach, no fabric softener. Wash compression pieces inside out to preserve color.",
      },
      {
        q: "Are your products tested?",
        a: "Every style is athlete-tested through real workouts before it makes the line. If it doesn't survive a brutal session, it doesn't ship.",
      },
    ],
  },
];

function Item({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-6 py-5 text-left hover:text-safety transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="font-display text-base md:text-lg leading-snug">{q}</span>
        <span className="shrink-0 mt-1 text-ink">
          {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </span>
      </button>
      {open && (
        <div className="pb-5 pr-10 text-sm text-graphite leading-relaxed">{a}</div>
      )}
    </div>
  );
}

export default function FAQ() {
  useEffect(() => {
    document.title = "FAQ — AFP | Alo Fitness Pro";
    const meta = document.querySelector('meta[name="description"]');
    const content = "Frequently asked questions about Alo Fitness Pro — shipping, returns, sizing, and care.";
    if (meta) meta.setAttribute("content", content);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="pt-24 md:pt-28">
        <section className="container py-12 md:py-20">
          <div className="eyebrow text-graphite mb-4">— Help Center</div>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight max-w-3xl">
            Answers,<br />
            <span className="italic font-light">on the record.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base md:text-lg text-graphite leading-relaxed">
            Everything you need to know about ordering, sizing, and caring for your AFP gear.
            Still stuck? <Link to="/contact" className="text-ink underline underline-offset-4 hover:text-safety">Talk to a human</Link>.
          </p>
        </section>

        <section className="container pb-20 md:pb-32 space-y-12 md:space-y-16">
          {sections.map((s, si) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-12 gap-6 md:gap-10"
            >
              <div className="col-span-12 md:col-span-4">
                <div className="md:sticky md:top-28 flex md:block items-center gap-4">
                  <s.icon className="w-6 h-6 md:w-8 md:h-8 text-ink mb-0 md:mb-4" />
                  <h2 className="font-display text-2xl md:text-4xl">{s.title}</h2>
                </div>
              </div>
              <div className="col-span-12 md:col-span-8">
                {s.items.map((it, i) => (
                  <Item key={it.q} q={it.q} a={it.a} defaultOpen={si === 0 && i === 0} />
                ))}
              </div>
            </motion.div>
          ))}
        </section>

        {/* CTA */}
        <section className="bg-ink text-bone py-16 md:py-24">
          <div className="container text-center max-w-2xl mx-auto">
            <Mail className="w-8 h-8 mx-auto text-safety mb-4" />
            <h2 className="font-display text-3xl md:text-5xl leading-[1.05] mb-4">
              Still have questions?
            </h2>
            <p className="text-bone/85 mb-8">
              Reach out — a real person will get back to you within 24 hours.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-bone text-ink px-8 py-4 eyebrow hover:bg-safety hover:text-bone transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone"
            >
              Contact Us →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
