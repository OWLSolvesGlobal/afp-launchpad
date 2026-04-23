import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Instagram, MessageCircle, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { toast } from "sonner";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Contact — AFP | Alo Fitness Pro";
    const meta = document.querySelector('meta[name="description"]');
    const content = "Get in touch with Alo Fitness Pro — questions about orders, sizing, partnerships, or just to say hello.";
    if (meta) meta.setAttribute("content", content);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulated submit — wire to backend when Cloud is enabled
    setTimeout(() => {
      setSubmitting(false);
      setSent(true);
      toast.success("Message received — we'll be in touch within 24 hours.");
    }, 700);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="pt-24 md:pt-28">
        {/* Hero */}
        <section className="container py-12 md:py-20">
          <motion.div {...fadeUp} className="eyebrow text-graphite mb-4">— Get in Touch</motion.div>
          <motion.h1
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight max-w-4xl"
          >
            Let's talk.<br />
            <span className="italic font-light">We're listening.</span>
          </motion.h1>
          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="mt-6 max-w-xl text-base md:text-lg text-graphite leading-relaxed"
          >
            Order question, sizing help, partnership pitch, or just want to share your AFP fit?
            Drop us a line — a real human reads every message.
          </motion.p>
        </section>

        {/* Quick contact tiles */}
        <section className="container pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              {
                icon: Mail,
                eyebrow: "Email",
                title: "hello@alofitnesspro.com",
                body: "Average reply: under 24 hours.",
                href: "mailto:hello@alofitnesspro.com",
              },
              {
                icon: Instagram,
                eyebrow: "DM",
                title: "@alofitnesspro",
                body: "Fastest for fit pics & shoutouts.",
                href: "https://instagram.com/alofitnesspro",
              },
              {
                icon: MessageCircle,
                eyebrow: "Press / Wholesale",
                title: "press@alofitnesspro.com",
                body: "Editorial, collabs, retail partners.",
                href: "mailto:press@alofitnesspro.com",
              },
            ].map((c, i) => (
              <motion.a
                key={c.title}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noreferrer" : undefined}
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
                <div className="font-display text-xl mb-1 group-hover:text-safety transition-colors">
                  {c.title}
                </div>
                <div className="text-sm text-graphite">{c.body}</div>
              </motion.a>
            ))}
          </div>
        </section>

        {/* Form + sidebar */}
        <section className="container pb-20 md:pb-32 grid grid-cols-12 gap-6 md:gap-12">
          <motion.div {...fadeUp} className="col-span-12 lg:col-span-7">
            <div className="border border-border bg-card p-6 md:p-10">
              <h2 className="font-display text-2xl md:text-3xl mb-2">Send us a message</h2>
              <p className="text-sm text-graphite mb-8">
                Fields marked <span className="text-safety">*</span> are required.
              </p>

              {sent ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-3 border border-ink bg-bone p-6"
                >
                  <CheckCircle2 className="w-5 h-5 text-safety mt-0.5 shrink-0" />
                  <div>
                    <div className="font-display text-lg mb-1">Message sent</div>
                    <p className="text-sm text-graphite">
                      Thanks for reaching out. We typically reply within 24 hours, Monday–Friday.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Name" id="name" required />
                    <Field label="Email" id="email" type="email" required />
                  </div>
                  <Field label="Subject" id="subject" required />
                  <div>
                    <label htmlFor="topic" className="eyebrow block mb-2">Topic</label>
                    <select
                      id="topic"
                      name="topic"
                      defaultValue="order"
                      className="w-full bg-background border border-border h-11 px-3 text-sm focus:outline-none focus:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <option value="order">Order / Shipping</option>
                      <option value="sizing">Sizing & Fit</option>
                      <option value="returns">Returns & Exchanges</option>
                      <option value="partnership">Partnership / Press</option>
                      <option value="other">Something else</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="message" className="eyebrow block mb-2">
                      Message <span className="text-safety">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={6}
                      className="w-full bg-background border border-border p-3 text-sm leading-relaxed focus:outline-none focus:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink resize-none"
                      placeholder="Tell us a bit about what you need…"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 bg-ink text-bone py-4 px-8 eyebrow hover:bg-safety transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? "Sending…" : "Send Message"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>

          <motion.aside
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="col-span-12 lg:col-span-5 space-y-6"
          >
            <div className="bg-ink text-bone p-6 md:p-8">
              <div className="eyebrow text-safety mb-4">— Studio HQ</div>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-safety" />
                  <div>
                    <div className="font-medium text-bone mb-0.5">By appointment only</div>
                    <div className="text-bone/80">Pop-up showroom locations rotate. Email to book.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0 text-safety" />
                  <div>
                    <div className="font-medium text-bone mb-0.5">Support hours</div>
                    <div className="text-bone/80">Mon–Fri · 9am – 6pm EST</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-border bg-[hsl(var(--sand))] p-6 md:p-8">
              <div className="eyebrow text-graphite mb-3">— Quick Answers</div>
              <p className="text-sm text-graphite leading-relaxed mb-4">
                Most questions about shipping, returns, and sizing are answered on our FAQ.
              </p>
              <a
                href="/faq"
                className="inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4 hover:text-safety transition-colors"
              >
                Visit the FAQ →
              </a>
            </div>
          </motion.aside>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Field({
  label, id, type = "text", required = false,
}: { label: string; id: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow block mb-2">
        {label} {required && <span className="text-safety">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={id === "email" ? "email" : id === "name" ? "name" : "off"}
        className="w-full bg-background border border-border h-11 px-3 text-sm focus:outline-none focus:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      />
    </div>
  );
}
