import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import ashleePink from "@/assets/ashlee-pink.jpg";
import ashleeApple from "@/assets/ashlee-apple.jpg";
import ashleeBlue from "@/assets/ashlee-blue.jpg";
import ashleePool from "@/assets/ashlee-pool.jpg";
import ashleeGolf from "@/assets/ashlee-golf.jpg";

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
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main id="main">
        {/* ============ HERO ============ */}
        <section className="relative pt-28 md:pt-36 pb-16 md:pb-24 overflow-hidden">
          <div className="container grid grid-cols-12 gap-6 md:gap-10 items-end">
            <div className="col-span-12 md:col-span-7 lg:col-span-6">
              <motion.div {...fadeUp} className="eyebrow text-graphite mb-6">
                — Our Story · Est. by an Athlete
              </motion.div>
              <motion.h1
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.05 }}
                className="font-display text-[10vw] md:text-[6.5vw] lg:text-[5.5vw] leading-[0.92] tracking-tight"
              >
                Built by the<br />
                <span className="italic font-light">unstoppable.</span><br />
                Worn by the<br />
                <span className="bg-ink text-bone px-3 inline-block">relentless.</span>
              </motion.h1>
              <motion.p
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.15 }}
                className="mt-8 max-w-md text-base md:text-lg text-graphite leading-relaxed"
              >
                AFP wasn't drawn up in a boardroom. It was built in the chalk dust of high-school
                weight rooms, on rain-soaked tracks at 5 a.m., and in the quiet moments between
                reps when a young girl decided she'd never stop chasing strong.
              </motion.p>
            </div>

            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.2 }}
              className="col-span-12 md:col-span-5 lg:col-span-6"
            >
              <div className="relative">
                <div className="aspect-[3/4] overflow-hidden bg-muted">
                  <img
                    src={ashleePink}
                    alt="Ashlee Lowe, founder of AFP / Alo Fitness Pro, in the signature pink AFP zip-front romper"
                    className="w-full h-full object-cover"
                    width={832}
                    height={1216}
                  />
                </div>
                <div className="absolute -bottom-4 -left-4 md:-left-8 bg-bone text-ink px-4 py-2 font-stencil uppercase text-[10px] tracking-widest border border-ink">
                  Ashlee Lowe
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============ MARQUEE ============ */}
        <section className="border-y border-border bg-ink text-bone overflow-hidden py-6">
          <div className="flex gap-12 whitespace-nowrap animate-[scroll_40s_linear_infinite] font-stencil uppercase text-2xl md:text-3xl tracking-widest">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-12 shrink-0">
                <span>Discipline</span>
                <span>Sweat</span>
                <span>Style</span>
                <span>Strength</span>
                <span>Self-Belief</span>
                <span>Showtime</span>
              </div>
            ))}
          </div>
        </section>

        {/* ============ ORIGIN STORY — split editorial ============ */}
        <section className="py-20 md:py-32">
          <div className="container grid grid-cols-12 gap-6 md:gap-10">
            <motion.div {...fadeUp} className="col-span-12 md:col-span-5 md:sticky md:top-28 self-start">
              <div className="aspect-[4/5] overflow-hidden bg-muted">
                <img
                  src={ashleeGolf}
                  alt="Ashlee Lowe at the golf course in the AFP white tennis-style dress"
                  loading="lazy"
                  className="w-full h-full object-cover"
                  width={1216}
                  height={832}
                />
              </div>
              <div className="mt-3 text-xs text-graphite italic">
                On the green — sport has always been the through-line.
              </div>
            </motion.div>

            <div className="col-span-12 md:col-span-7 md:pl-10 lg:pl-16">
              <motion.div {...fadeUp} className="eyebrow text-safety mb-4">— Chapter One</motion.div>
              <motion.h2
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.05 }}
                className="font-display text-3xl md:text-5xl leading-[1.05] mb-8"
              >
                A girl, a track, and a stopwatch that wouldn't lie.
              </motion.h2>

              <motion.div
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.1 }}
                className="space-y-6 text-base md:text-lg text-graphite leading-relaxed max-w-xl"
              >
                <p>
                  Before there was a brand, there was a kid who couldn't sit still. Sneakers worn
                  thin at the toes. Knees always a little bruised. The kind of energy that made
                  coaches smile and parents tired.
                </p>
                <p className="border-l-2 border-ink pl-5 italic text-ink">
                  "Sport didn't just shape my body. It shaped how I show up — for myself, and for
                  the women coming up behind me."
                </p>
                <p>
                  From elementary track meets to high-school championships, she learned the
                  thing every athlete eventually learns: <span className="text-ink font-medium">
                  the work is the prize</span>. The medals fade. The discipline doesn't.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============ FULL-BLEED B/W TRAINING IMAGE ============ */}
        <section className="relative">
          <div className="relative aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/9] overflow-hidden">
            <img
              src={ashleeBlue}
              alt="Ashlee Lowe in the AFP powder-blue romper against a sun-warmed wall"
              loading="lazy"
              className="w-full h-full object-cover object-[60%_15%]"
              width={1408}
              height={896}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/50 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="container">
                <div className="max-w-xl text-bone">
                  <div className="font-stencil uppercase text-xs md:text-sm tracking-[0.3em] mb-4 text-safety">
                    — The Standard
                  </div>
                  <h2 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.95] mb-6">
                    The Standard
                  </h2>
                  <p className="font-display text-xl md:text-2xl lg:text-3xl leading-[1.15] italic text-bone/95">
                    "I make clothes I'd actually train in. Nothing leaves the rack
                    until it survives my worst workout."
                  </p>
                  <p className="mt-5 font-stencil uppercase text-[10px] md:text-xs tracking-[0.3em] text-bone/80">
                    — Ashlee Lowe
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ APPLE / LETTER TO THE READER ============ */}
        <section className="py-20 md:py-32">
          <div className="container grid grid-cols-12 gap-6 md:gap-12 items-center">
            <motion.div {...fadeUp} className="col-span-12 md:col-span-6 lg:col-span-5 md:order-2">
              <div className="relative">
                <div className="aspect-[4/5] overflow-hidden bg-muted">
                  <img
                    src={ashleeApple}
                    alt="Ashlee Lowe in the AFP lime-green romper, biting into a fresh green apple"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    width={832}
                    height={1216}
                  />
                </div>
                {/* Small inset — pool look */}
                <div className="hidden md:block absolute -bottom-8 -left-8 w-32 lg:w-40 aspect-[4/5] overflow-hidden border-4 border-bone shadow-lg">
                  <img
                    src={ashleePool}
                    alt="Ashlee Lowe in the AFP pink poolside set"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    width={400}
                    height={500}
                  />
                </div>
              </div>
            </motion.div>

            <div className="col-span-12 md:col-span-6 lg:col-span-7 md:order-1">
              <motion.div {...fadeUp} className="eyebrow text-graphite mb-4">— A Letter to You</motion.div>
              <motion.h2
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.05 }}
                className="font-display text-3xl md:text-5xl leading-[1.05] mb-8 max-w-xl"
              >
                If you're reading this, you're already one of us.
              </motion.h2>

              <motion.div
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.1 }}
                className="space-y-5 text-base md:text-lg text-graphite leading-relaxed max-w-xl"
              >
                <p>
                  I started AFP because I was tired of choosing between clothes that performed
                  and clothes that <em className="text-ink not-italic font-medium">felt like me</em>.
                  Tired of activewear designed for someone else's body, someone else's life.
                </p>
                <p>
                  So I built it myself. Every fabric is chosen for the woman pushing through a
                  6 a.m. lift, the man chasing a PR, the kid lacing up for their first practice,
                  the entrepreneur squeezing yoga between meetings. <span className="text-ink font-medium">
                  Fitness fashion for the unstoppable you.</span>
                </p>
                <p>
                  Whether you're chasing a podium, a personal best, or just the version of
                  yourself who shows up — AFP is for you. Wear it loud. Wear it sweaty. Wear it
                  proud.
                </p>
                <p className="font-display text-2xl text-ink mt-8">
                  See you at the start line.
                </p>
                <p className="font-stencil uppercase text-xs tracking-widest text-graphite">
                  — Ashlee Lowe, AFP / Alo Fitness Pro
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="bg-ink text-bone py-20 md:py-32">
          <div className="container text-center">
            <motion.div {...fadeUp} className="eyebrow text-safety mb-4">— Join the Movement</motion.div>
            <motion.h2
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.05 }}
              className="font-display text-4xl md:text-6xl lg:text-7xl leading-[0.95] mb-10 max-w-3xl mx-auto"
            >
              The unstoppable wear AFP.<br />
              <span className="italic font-light">Are you in?</span>
            </motion.h2>
            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                to="/shop/women"
                className="bg-bone text-ink px-8 py-4 eyebrow hover:bg-safety hover:text-bone transition-colors"
              >
                Shop Women
              </Link>
              <Link
                to="/shop/men"
                className="border border-bone text-bone px-8 py-4 eyebrow hover:bg-bone hover:text-ink transition-colors"
              >
                Shop Men
              </Link>
            </motion.div>
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
