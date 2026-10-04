import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Instagram, MessageCircle, MapPin, Clock } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, PHONE_DISPLAY, waLink } from "@/lib/brand";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

export default function Contact() {
  useEffect(() => {
    document.title = "Contact — Alo Fitness Pro";
    const meta = document.querySelector('meta[name="description"]');
    const content =
      "Get in touch with Alo Fitness Pro on WhatsApp or Instagram — questions about orders, sizing, pickup, or just to say hello.";
    if (meta) meta.setAttribute("content", content);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main id="main" className="pt-24 md:pt-28">
        {/* Hero */}
        <section className="container py-12 md:py-20">
          <motion.div {...fadeUp} className="eyebrow text-graphite mb-4">— Get in Touch</motion.div>
          <motion.h1
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
            className="display-lg max-w-4xl"
          >
            Let's talk.<br />
            <span className="font-serif italic font-light">We're listening.</span>
          </motion.h1>
          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="mt-6 max-w-xl text-base md:text-lg text-graphite leading-relaxed"
          >
            Order question, sizing help, or just want to share your AFP fit?
            Message us — a real human reads every message.
          </motion.p>
        </section>

        {/* Contact channels */}
        <section className="container pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {[
              {
                icon: MessageCircle,
                eyebrow: "WhatsApp — fastest",
                title: PHONE_DISPLAY,
                body: "Orders, sizing, pickup, everything. This is where we live.",
                href: waLink("Hi AFP! I have a question."),
              },
              {
                icon: Instagram,
                eyebrow: "Instagram",
                title: INSTAGRAM_HANDLE,
                body: "DMs, fit pics & shoutouts.",
                href: INSTAGRAM_URL,
              },
            ].map((c, i) => (
              <motion.a
                key={c.title}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="group block border border-border bg-card p-6 hover:border-ink hover:shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <div className="flex items-center justify-between mb-4">
                  <c.icon className="w-5 h-5 text-ink" />
                  <span className="eyebrow text-graphite">{c.eyebrow}</span>
                </div>
                <div className="text-xl font-medium tracking-tight mb-1 group-hover:text-accent transition-colors">
                  {c.title}
                </div>
                <div className="text-sm text-graphite">{c.body}</div>
              </motion.a>
            ))}
          </div>
        </section>

        {/* WhatsApp CTA + sidebar */}
        <section className="container pb-20 md:pb-32 grid grid-cols-12 gap-6 md:gap-12">
          <motion.div {...fadeUp} className="col-span-12 lg:col-span-7">
            <div className="border border-border bg-card p-6 md:p-10">
              <h2 className="display-md mb-4">Message us on WhatsApp</h2>
              <p className="text-graphite leading-relaxed mb-8 max-w-md">
                It's how every AFP order happens — and the fastest way to get an
                answer about sizing, stock, delivery, or pickup. Tap below and
                the chat opens ready to go.
              </p>
              <a
                href={waLink("Hi AFP! I have a question.")}
                target="_blank"
                rel="noreferrer"
                aria-label="Chat with AFP on WhatsApp (opens in a new tab)"
                className="inline-flex items-center justify-center gap-2 bg-ink text-bone py-4 px-8 eyebrow hover:bg-accent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <MessageCircle className="w-4 h-4" /> Start a chat
              </a>
              <p className="mt-6 text-sm text-graphite">
                Prefer to dial or save the number? {PHONE_DISPLAY}
              </p>
            </div>
          </motion.div>

          <motion.aside
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="col-span-12 lg:col-span-5 space-y-6"
          >
            <div className="bg-ink text-bone p-6 md:p-8">
              <div className="eyebrow text-accent mb-4">— Studio HQ</div>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                  <div>
                    <div className="font-medium text-bone mb-0.5">St Michael, Barbados</div>
                    <div className="text-bone/80">
                      Pickups by appointment — arranged on WhatsApp.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                  <div>
                    <div className="font-medium text-bone mb-0.5">Hours</div>
                    <div className="text-bone/80">Mon–Sat · 8am – 6pm</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-border bg-bone p-6 md:p-8">
              <div className="eyebrow text-graphite mb-3">— Quick Answers</div>
              <p className="text-sm text-graphite leading-relaxed mb-4">
                Most questions about delivery, exchanges, and sizing are
                answered on our FAQ.
              </p>
              <Link
                to="/faq"
                className="inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4 hover:text-accent transition-colors"
              >
                Visit the FAQ →
              </Link>
            </div>
          </motion.aside>
        </section>
      </main>

      <Footer />
    </div>
  );
}
