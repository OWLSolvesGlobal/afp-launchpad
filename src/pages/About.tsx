import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Instagram, MessageCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import ashleePink from "@/assets/ashlee-pink.webp";
import ashleeApple from "@/assets/ashlee-apple.webp";
import ashleeBlue from "@/assets/ashlee-blue.webp";
import ashleePool from "@/assets/ashlee-pool.jpg";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, waLink } from "@/lib/brand";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
};

export default function About() {
  useEffect(() => {
    document.title = "About — Alo Fitness Pro";
    const meta = document.querySelector('meta[name="description"]');
    const content =
      "The story behind Alo Fitness Pro — activewear designed in Barbados for the life you live.";
    if (meta) meta.setAttribute("content", content);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main id="main">
        {/* ============ HERO ============ */}
        <section className="relative overflow-hidden pt-20 md:pt-24">
          <div className="container grid md:grid-cols-2 gap-8 md:gap-12 items-center py-10 md:py-20">
            <div className="order-2 md:order-1">
              <div className="eyebrow text-accent mb-6">Meet the founder</div>
              <motion.h1 {...fadeUp} className="display-lg max-w-xl">
                Made for the life{" "}
                <em className="font-serif italic font-light">you</em> live.
              </motion.h1>
              <motion.p
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.1 }}
                className="mt-6 max-w-md text-base md:text-lg text-graphite"
              >
                AFP wasn't built in a boardroom. It started in training spaces
                and early mornings — and grew into something made for movement,
                rest and everything in between.
              </motion.p>
            </div>

            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.15 }}
              className="order-1 md:order-2 relative aspect-[4/5] overflow-hidden bg-muted"
            >
              <img
                src={ashleePink}
                alt="Ashlee, founder of AFP, in the signature pink zip-front romper"
                className="absolute inset-0 w-full h-full object-cover"
                width={832}
                height={1216}
              />
            </motion.div>
          </div>
        </section>

        {/* ============ VALUES MARQUEE ============ */}
        <section
          className="border-y border-ink bg-ink text-bone overflow-hidden py-5"
          aria-labelledby="marquee-label"
        >
          <p id="marquee-label" className="sr-only">
            AFP values: Discipline, Sweat, Style, Strength, Self-Belief, Showtime.
          </p>
          <div
            aria-hidden="true"
            className="flex gap-12 whitespace-nowrap animate-[scroll_40s_linear_infinite] motion-reduce:animate-none uppercase text-lg md:text-xl tracking-[0.25em] font-medium"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-12 shrink-0 items-center">
                <span>Discipline</span>
                <span className="text-accent">·</span>
                <span>Sweat</span>
                <span className="text-accent">·</span>
                <span>Style</span>
                <span className="text-accent">·</span>
                <span>Strength</span>
                <span className="text-accent">·</span>
                <span>Self-Belief</span>
                <span className="text-accent">·</span>
                <span>Showtime</span>
                <span className="text-accent">·</span>
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
            <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/45 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="container">
                <div className="max-w-xl text-bone">
                  <div className="eyebrow text-accent mb-5">The standard</div>
                  <h2 className="display-md mb-5">
                    We provide pieces we actually live in, train in, move in
                    and unwind in.
                  </h2>
                  <p className="font-serif italic text-xl md:text-2xl leading-snug text-bone/90">
                    Nothing leaves the rack until it earns its place in my
                    routine.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ LETTER TO THE READER ============ */}
        <section className="bg-bone py-20 md:py-28">
          <div className="container grid grid-cols-12 gap-8 md:gap-14 items-center">
            <motion.div
              {...fadeUp}
              className="col-span-12 md:col-span-6 md:order-2"
            >
              <div className="relative">
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  <img
                    src={ashleeApple}
                    alt="Ashlee in the AFP lime-green romper, holding a green apple"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    width={832}
                    height={1216}
                  />
                </div>
                <div className="hidden md:block absolute -bottom-6 -left-6 w-32 lg:w-40 aspect-[4/5] overflow-hidden border-4 border-background shadow-xl">
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
              <div className="eyebrow text-accent">A letter to you</div>
              <motion.h2
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.05 }}
                className="mt-4 display-md mb-8 max-w-xl"
              >
                If you're reading this, you're already one of us.
              </motion.h2>

              <motion.div
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.1 }}
                className="space-y-5 text-base md:text-lg text-graphite leading-relaxed max-w-xl"
              >
                <p>
                  I started AFP because I was tired of choosing between clothes
                  that performed and clothes that{" "}
                  <em className="text-ink not-italic font-medium">
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
                  <span className="text-ink font-medium">
                    Activewear for the life you live.
                  </span>
                </p>
                <p>
                  Whether you're chasing a podium, a personal best, or just
                  the version of yourself who shows up — AFP is for you. Wear
                  it loud. Wear it sweaty. Wear it proud.
                </p>
                <p className="pt-2 eyebrow text-graphite">
                  — Ashlee · Founder, Alo Fitness Pro
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="bg-ink text-bone py-20 md:py-28">
          <div className="container text-center">
            <div className="eyebrow text-accent mb-6">Join the movement</div>
            <h2 className="display-lg mb-10 max-w-3xl mx-auto">
              Are you <em className="font-serif italic font-light">in?</em>
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/shop/women"
                className="inline-flex items-center justify-center gap-2 bg-bone text-ink px-8 py-4 eyebrow hover:bg-accent hover:text-bone transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/60"
              >
                Shop Women <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/shop/men"
                className="inline-flex items-center justify-center gap-2 border border-bone text-bone px-8 py-4 eyebrow hover:bg-bone hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/60"
              >
                Shop Men <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" />
              </Link>
              <a
                href={waLink("Hi AFP! I have a question about your story.")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with AFP on WhatsApp (opens in a new tab)"
                className="inline-flex items-center justify-center gap-2 border border-bone text-bone px-8 py-4 eyebrow hover:bg-bone hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/60"
              >
                <MessageCircle aria-hidden="true" className="w-3.5 h-3.5" /> WhatsApp us
              </a>
            </div>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow AFP on Instagram (opens in a new tab)"
              className="mt-8 inline-flex items-center gap-2 text-sm text-bone/70 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/60 px-2 py-1"
            >
              <Instagram aria-hidden="true" className="w-4 h-4" /> {INSTAGRAM_HANDLE}
            </a>
          </div>
        </section>
      </main>

      <Footer />

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
