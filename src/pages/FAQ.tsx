import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Minus, Truck, RotateCcw, Ruler, ShieldCheck, MessageCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PHONE_DISPLAY, waLink } from "@/lib/brand";

const sections = [
  {
    id: "shipping",
    icon: Truck,
    title: "Ordering & Delivery",
    items: [
      {
        q: "How do I place an order?",
        a: "Add your pieces to the bag and head to checkout — it builds a WhatsApp message with your items, totals, and an order reference. Press send and we confirm everything in chat, including payment and delivery details.",
      },
      {
        q: "How much is delivery?",
        a: "Island-wide delivery across Barbados is BDS $15, and free on orders over BDS $300. We arrange the delivery day with you on WhatsApp after you order.",
      },
      {
        q: "Can I pick up instead?",
        a: "Yes — pickup is free. Choose Store Pickup at checkout: AFP HQ in St Michael (by appointment) or a Bridgetown meet-up, both confirmed via WhatsApp.",
      },
      {
        q: "Do you ship outside Barbados?",
        a: `Right now we deliver within Barbados. If you're overseas, message us on WhatsApp (${PHONE_DISPLAY}) and we'll see what we can arrange.`,
      },
    ],
  },
  {
    id: "returns",
    icon: RotateCcw,
    title: "Returns & Exchanges",
    items: [
      {
        q: "Something doesn't fit — what now?",
        a: "Message us on WhatsApp and we'll arrange a size exchange. Pieces need to be unworn and unwashed with tags attached.",
      },
      {
        q: "How do exchanges work?",
        a: "We confirm the new size is in stock, then arrange the swap at delivery or pickup — all coordinated in the same WhatsApp chat as your order.",
      },
    ],
  },
  {
    id: "sizing",
    icon: Ruler,
    title: "Sizing & Fit",
    items: [
      {
        q: "How do AFP pieces fit?",
        a: "Most styles are true to size with a sculpting, compressive feel — if you're between sizes or prefer a relaxed fit, size up. Each product page shows exactly which sizes are available for that piece.",
      },
      {
        q: "What sizes do you carry?",
        a: "Most pieces run S–XL, with selected styles in XS–XL. The size buttons on each product page show live availability — if a size is crossed out, it's out of stock.",
      },
      {
        q: "Not sure which size to order?",
        a: "Message us on WhatsApp with your usual size and the piece you're eyeing — we know how every style fits and we'll steer you right.",
      },
    ],
  },
  {
    id: "care",
    icon: ShieldCheck,
    title: "Product & Care",
    items: [
      {
        q: "How should I wash my AFP pieces?",
        a: "We recommend a cold machine wash and low tumble dry or hang dry. Skip bleach and fabric softener, and wash seamless and compression pieces inside out to keep their colour and stretch.",
      },
      {
        q: "How do I keep seamless sets looking new?",
        a: "Wash them with similar fabrics (no zips or velcro that can snag), and avoid high heat — it breaks down elastane over time.",
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
        className="w-full flex items-start justify-between gap-6 py-5 text-left hover:text-accent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="text-base md:text-lg font-medium leading-snug">{q}</span>
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
  const { hash } = useLocation();

  useEffect(() => {
    document.title = "FAQ — Alo Fitness Pro";
    const meta = document.querySelector('meta[name="description"]');
    const content =
      "Frequently asked questions about Alo Fitness Pro — ordering on WhatsApp, delivery across Barbados, sizing, and care.";
    if (meta) meta.setAttribute("content", content);
  }, []);

  // Support deep links like /faq#returns (used by the footer).
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      // Let the page lay out first, then scroll.
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [hash]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main id="main" className="pt-24 md:pt-28">
        <section className="container py-12 md:py-20">
          <div className="eyebrow text-graphite mb-4">— Help Center</div>
          <h1 className="display-lg max-w-3xl">
            Answers,<br />
            <span className="font-serif italic font-light">on the record.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base md:text-lg text-graphite leading-relaxed">
            Everything you need to know about ordering, delivery across Barbados,
            sizing, and caring for your AFP pieces.
            Still stuck? <Link to="/contact" className="text-ink underline underline-offset-4 hover:text-accent">Talk to a human</Link>.
          </p>
        </section>

        <section className="container pb-20 md:pb-32 space-y-12 md:space-y-16">
          {sections.map((s, si) => (
            <motion.div
              key={s.title}
              id={s.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-12 gap-6 md:gap-10 scroll-mt-28"
            >
              <div className="col-span-12 md:col-span-4">
                <div className="md:sticky md:top-28 flex md:block items-center gap-4">
                  <s.icon className="w-6 h-6 md:w-8 md:h-8 text-ink mb-0 md:mb-4" />
                  <h2 className="display-md">{s.title}</h2>
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
            <MessageCircle className="w-8 h-8 mx-auto text-accent mb-4" />
            <h2 className="display-md mb-4">
              Still have questions?
            </h2>
            <p className="text-bone/85 mb-8">
              Message us on WhatsApp — {PHONE_DISPLAY} — and a real person will
              get back to you.
            </p>
            <a
              href={waLink("Hi AFP! I have a question.")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-bone text-ink px-8 py-4 eyebrow hover:bg-accent hover:text-bone transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Chat with us
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
