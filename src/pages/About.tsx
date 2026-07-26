import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Instagram, MessageCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import ashleePink from "@/assets/ashlee-pink.jpg";
import ashleeApple from "@/assets/ashlee-apple.jpg";
import ashleeBlue from "@/assets/ashlee-blue.jpg";
import ashleePool from "@/assets/ashlee-pool.jpg";
import { LIME, TURQUOISE, waLink } from "@/lib/afp-catalog";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
};

export default function About() {
  useEffect(() => {
    document.title = "About — AFP | Alo Fitness Pro";
    const meta = document.querySelector('meta[name="description"]');
    const content = "The story behind Alo Fitness Pro — an athlete-turned-entrepreneur building fitness fashion for the unstoppable.";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Header />

      <main id="main">
        {/* ============ HERO — matches Index hero pattern ============ */}
        <section className="relative overflow-hidden bg-white pt-20 md:pt-24">
          <div className="container grid md:grid-cols-2 gap-8 md:gap-12 items-center py-10 md:py-20">
            <div className="order-2 md:order-1">
              <span
                className="inline-block text-[11px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full"
                style={{ background: LIME }}
              >
                Meet the Founder
              </span>
              <motion.h1
                {...fadeUp}
                className="mt-5 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight"
              >
                Built by the
                <br />
                <span style={{ color: TURQUOISE }}>unstoppable.</span>
                <br />
                Worn by the{" "}
                <em className="italic font-serif font-normal">relentless.</em>
              </motion.h1>
              <motion.p
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.1 }}
                className="mt-6 max-w-md text-base md:text-lg text-neutral-600"
              >
                AFP wasn't built in a boardroom. It started in training spaces
                and early mornings — and grew into something made for movement,
                rest and everything in between.
              </motion.p>
            </div>

            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.15 }}
              className="order-1 md:order-2 relative"
            >
              <div
                className="absolute -inset-6 md:-inset-10 rounded-[2.5rem] -z-0"
                style={{ background: `linear-gradient(135deg, ${TURQUOISE}22, ${LIME}44)` }}
              />
              <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-neutral-100">
                <img
                  src={ashleePink}
                  alt="Ashlee, founder of AFP, in the signature pink zip-front romper"
                  className="absolute inset-0 w-full h-full object-cover"
                  width={832}
                  height={1216}
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============ MARQUEE (kept, restyled to match brand) ============ */}
        <section
          className="border-y border-black overflow-hidden py-5"
          style={{ background: LIME }}
          aria-labelledby="marquee-label"
        >
          <p id="marquee-label" className="sr-only">
            AFP values: Discipline, Sweat, Style, Strength, Self-Belief, Showtime.
          </p>
          <div
            aria-hidden="true"
            className="flex gap-12 whitespace-nowrap animate-[scroll_40s_linear_infinite] motion-reduce:animate-none uppercase text-xl md:text-2xl tracking-[0.25em] font-black text-black"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-12 shrink-0 items-center">
                <span>Discipline</span>
                <span>·</span>
                <span>Sweat</span>
                <span>·</span>
                <span>Style</span>
                <span>·</span>
                <span>Strength</span>
                <span>·</span>
                <span>Self-Belief</span>
                <span>·</span>
                <span>Showtime</span>
                <span>·</span>
              </div>
            ))}
          </div>
        </section>

        {/* ============ THE STANDARD ============ */}
        <section className="relative">
          <div className="relative aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/9] overflow-hidden">
            <img
              src={ashleeBlue}
              alt="AFP powder-blue romper against a sun-warmed wall"
              loading="lazy"
              className="w-full h-full object-cover object-[60%_15%]"
              width={1408}
              height={896}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="container">
                <div className="max-w-xl text-white">
                  <span
                    className="inline-block text-[11px] font-bold tracking-[0.25em] uppercase mb-5"
                    style={{ color: LIME }}
                  >
                    The Standard
                  </span>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-5">
                    We provide pieces we actually live in, train in, move in
                    and unwind in.
                  </h2>
                  <p className="font-serif italic text-xl md:text-2xl leading-snug text-white/90">
                    Nothing leaves the rack until it earns its place in my
                    routine.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ LETTER TO THE READER ============ */}
        <section className="bg-neutral-50 py-20 md:py-28">
          <div className="container grid grid-cols-12 gap-8 md:gap-14 items-center">
            <motion.div
              {...fadeUp}
              className="col-span-12 md:col-span-6 md:order-2"
            >
              <div className="relative">
                <div
                  className="absolute -inset-4 md:-inset-6 rounded-[2rem] -z-0"
                  style={{ background: `linear-gradient(135deg, ${LIME}66, ${TURQUOISE}22)` }}
                />
                <div className="relative aspect-[4/5] rounded-[1.75rem] overflow-hidden bg-neutral-100">
                  <img
                    src={ashleeApple}
                    alt="Ashlee in the AFP lime-green romper, holding a green apple"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    width={832}
                    height={1216}
                  />
                </div>
                <div className="hidden md:block absolute -bottom-6 -left-6 w-32 lg:w-40 aspect-[4/5] overflow-hidden rounded-2xl border-4 border-white shadow-xl">
                  <img
                    src={ashleePool}
                    alt="AFP pink poolside set"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    width={400}
                    height={500}
                  />
                </div>
              </div>
            </motion.div>

            <div className="col-span-12 md:col-span-6 md:order-1">
              <span
                className="text-[11px] font-bold tracking-[0.2em] uppercase"
                style={{ color: TURQUOISE }}
              >
                A Letter to You
              </span>
              <motion.h2
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.05 }}
                className="mt-3 text-3xl md:text-5xl font-black tracking-tight leading-[1.05] mb-8 max-w-xl"
              >
                If you're reading this,
                <br />
                you're already{" "}
                <span style={{ color: TURQUOISE }}>one of us.</span>
              </motion.h2>

              <motion.div
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.1 }}
                className="space-y-5 text-base md:text-lg text-neutral-700 leading-relaxed max-w-xl"
              >
                <p>
                  I started AFP because I was tired of choosing between clothes
                  that performed and clothes that{" "}
                  <em className="text-black not-italic font-semibold">
                    felt like me
                  </em>
                  . Tired of activewear designed for someone else's body,
                  someone else's life.
                </p>
                <p>
                  So I built it myself. Every fabric is chosen for the woman
                  pushing through a 6 a.m. lift, the man chasing a PR, the kid
                  lacing up for their first practice, the entrepreneur
                  squeezing yoga between meetings.{" "}
                  <span className="text-black font-semibold">
                    Fitness fashion for the unstoppable you.
                  </span>
                </p>
                <p>
                  Whether you're chasing a podium, a personal best, or just
                  the version of yourself who shows up — AFP is for you. Wear
                  it loud. Wear it sweaty. Wear it proud.
                </p>
                <p className="pt-2 text-xs font-bold tracking-[0.25em] uppercase text-neutral-500">
                  — Ashlee · Founder, Alo Fitness Pro
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="bg-black text-white py-20 md:py-28">
          <div className="container text-center">
            <span
              className="inline-block text-[11px] font-bold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full text-black mb-6"
              style={{ background: LIME }}
            >
              Join the Movement
            </span>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95] mb-10 max-w-3xl mx-auto">
              Are you{" "}
              <em className="italic font-serif font-normal" style={{ color: TURQUOISE }}>
                in?
              </em>
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/collection/alobabes"
                className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-bold text-black transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
                style={{ background: LIME }}
              >
                Shop Women <ArrowRight aria-hidden="true" className="w-4 h-4" />
              </Link>
              <Link
                to="/collection/afp-men"
                className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-bold text-white border-2 border-white hover:bg-white hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
              >
                Shop Men <ArrowRight aria-hidden="true" className="w-4 h-4" />
              </Link>
              <a
                href={waLink("Hi AFP! I have a question about your story.")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with AFP on WhatsApp (opens in a new tab)"
                className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-bold text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
                style={{ background: "#25D366" }}
              >
                <MessageCircle aria-hidden="true" className="w-4 h-4" /> WhatsApp Us
              </a>
            </div>
            <a
              href="https://instagram.com/alofitnesspro"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow AFP on Instagram (opens in a new tab)"
              className="mt-8 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full px-2 py-1"
            >
              <Instagram aria-hidden="true" className="w-4 h-4" /> @alofitnesspro
            </a>
          </div>
        </section>
      </main>

      {/* Marquee keyframes */}
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
