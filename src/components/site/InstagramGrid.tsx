import { Instagram, Heart, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

// ============================================================
// INSTAGRAM FEED — CURATED LIFESTYLE GRID
// Real @alofitnesspro pulls require Meta IG Graph API + a
// long-lived access token (Facebook Business account required).
// Until that's wired, these tiles mix:
//   - 3 real screenshots from @alofitnesspro (uploaded by AFP)
//   - 6 [PLACEHOLDER — REPLACE WITH AFP INSTAGRAM CONTENT] shots
// All tiles deep-link to the live IG profile.
// ============================================================

import igGolfDuo from "@/assets/ig-golf-duo.png";        // real
import igWhiteTee from "@/assets/ig-white-tee.png";      // real
import igBlackSet from "@/assets/ig-black-set.png";      // real
import igDeadlift from "@/assets/ig-deadlift.jpg";       // placeholder
import igFlatlay from "@/assets/ig-flatlay.jpg";         // placeholder
import igResort from "@/assets/ig-resort.jpg";           // placeholder
import igDuoStudio from "@/assets/ig-duo-studio.jpg";    // placeholder
import igBeachRun from "@/assets/ig-beach-run.jpg";      // placeholder
import heroImg from "@/assets/hero-iron.jpg";            // placeholder

type Tile = {
  src: string;
  alt: string;
  caption: string;
  likes: string;
  href: string;
  real?: boolean;
};

const IG_URL = "https://www.instagram.com/alofitnesspro/";

const tiles: Tile[] = [
  { src: igGolfDuo,    alt: "Two athletes on the green in AFP visors and sets",        caption: "Off the platform.",   likes: "2.1k", href: IG_URL, real: true },
  { src: igWhiteTee,   alt: "Athlete in white AFP performance tee and black shorts",    caption: "The clean fit.",      likes: "1.8k", href: IG_URL, real: true },
  { src: igBlackSet,   alt: "Athlete in head-to-toe black AFP training set",            caption: "All black, all day.", likes: "3.4k", href: IG_URL, real: true },
  { src: igDeadlift,   alt: "Lifter pulling a deadlift in a moody industrial gym",      caption: "Iron over everything.", likes: "4.2k", href: IG_URL },
  { src: igDuoStudio,  alt: "Two athletes back to back in matching AFP black fits",     caption: "Built together.",     likes: "1.5k", href: IG_URL },
  { src: igResort,     alt: "Athlete poolside in white AFP seamless set",               caption: "Off-season ≠ off-duty.", likes: "2.7k", href: IG_URL },
  { src: heroImg,      alt: "Loaded barbell on the platform under tungsten light",      caption: "Set the bar.",        likes: "5.6k", href: IG_URL },
  { src: igBeachRun,   alt: "Athlete running at sunrise on a tropical beach",           caption: "Mileage everywhere.", likes: "3.1k", href: IG_URL },
  { src: igFlatlay,    alt: "AFP black training kit flat-lay on bone background",       caption: "The kit.",            likes: "1.2k", href: IG_URL },
];

export const InstagramGrid = () => {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-12">
          <div>
            <div className="eyebrow text-graphite mb-3">03 — Lived In</div>
            <h2 className="display-md">
              The Life. <span className="text-safety">@alofitnesspro</span>
            </h2>
            <p className="mt-3 text-sm text-graphite max-w-md">
              Not just kit. A way of moving through the world.
            </p>
          </div>
          <a
            href={IG_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 eyebrow link-safety self-start md:self-auto"
          >
            <Instagram className="w-4 h-4" /> Follow on Instagram
          </a>
        </div>

        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
          {tiles.map((t, idx) => (
            <motion.a
              key={idx}
              href={t.href}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (idx % 3) * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="group relative aspect-square overflow-hidden bg-muted block"
              aria-label={`View on Instagram: ${t.caption}`}
            >
              <img
                src={t.src}
                alt={t.alt}
                loading="lazy"
                width={1024}
                height={1024}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
              />

              {/* Hover overlay — lifestyle-first */}
              <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/65 transition-colors duration-300" />
              <div className="absolute inset-0 p-2 sm:p-3 md:p-4 flex flex-col justify-between text-bone opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-bone/90 text-[9px] sm:text-[10px]">
                    @alofitnesspro
                  </span>
                  <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <p className="font-display uppercase tracking-[0.02em] text-sm sm:text-base md:text-lg leading-tight">
                    {t.caption}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] sm:text-xs text-bone/80">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-3 h-3" /> {t.likes}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Persistent IG corner mark for non-hover (mobile) */}
              <div className="absolute top-1.5 right-1.5 md:hidden bg-ink/55 backdrop-blur-sm rounded-full p-1">
                <Instagram className="w-3 h-3 text-bone" />
              </div>
            </motion.a>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a
            href={IG_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 bg-ink text-bone px-6 py-3 eyebrow hover:bg-safety transition-colors"
          >
            <Instagram className="w-4 h-4" /> See it all on Instagram
          </a>
        </div>
      </div>
    </section>
  );
};
