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

import igGolfDress from "@/assets/afp-golf-dress.jpg";
import igLime from "@/assets/afp-lime-romper.jpg";
import igPinkPool from "@/assets/afp-pink-pool.jpg";
import igMensBlack from "@/assets/afp-mens-black.jpg";
import igMensWhite from "@/assets/afp-mens-white.jpg";
import igPurple from "@/assets/afp-purple-romper.jpg";
import igBlueRomper from "@/assets/afp-blue-romper.jpg";
import igBlackJump from "@/assets/afp-black-jumpsuit.jpg";
import igGolfDuo from "@/assets/ig-golf-duo.png";

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
  { src: igLime,       alt: "AFP athlete in lime green seamless romper",        caption: "Lime season.",        likes: "4.2k", href: IG_URL, real: true },
  { src: igGolfDress,  alt: "AFP athlete in navy golf dress",                   caption: "On the green.",       likes: "3.1k", href: IG_URL, real: true },
  { src: igPinkPool,   alt: "AFP athlete in pink set poolside",                 caption: "Pool day energy.",    likes: "5.4k", href: IG_URL, real: true },
  { src: igMensWhite,  alt: "AFP male athlete in white tee and black shorts",   caption: "The clean fit.",      likes: "2.8k", href: IG_URL, real: true },
  { src: igPurple,     alt: "AFP athlete in purple zip romper",                 caption: "Signature romper.",   likes: "6.1k", href: IG_URL, real: true },
  { src: igBlueRomper, alt: "AFP athlete in sky blue romper against terracotta wall", caption: "Sun-soaked.",   likes: "3.7k", href: IG_URL, real: true },
  { src: igMensBlack,  alt: "AFP male athlete head to toe in black",            caption: "All black everything.", likes: "2.2k", href: IG_URL, real: true },
  { src: igGolfDuo,    alt: "Two athletes on the green in AFP visors and sets", caption: "Off the platform.",   likes: "1.9k", href: IG_URL, real: true },
  { src: igBlackJump,  alt: "AFP athlete in black halter jumpsuit in courtyard",caption: "Built to wear.",      likes: "4.0k", href: IG_URL, real: true },
];

export const InstagramGrid = () => {
  return (
    <section className="bg-bone py-24 md:py-40">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12 md:mb-20">
          <div>
            <div className="eyebrow text-graphite mb-3">— On the 'Gram</div>
            <h2 className="display-md">
              <em className="italic">@alofitnesspro</em>
            </h2>
            <p className="mt-3 text-sm text-graphite max-w-md">
              Tag <span className="text-foreground">#AFPlife</span> to be featured.
              The community wears it best.
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
            className="inline-flex items-center gap-3 bg-foreground text-background px-6 py-3 eyebrow hover:bg-graphite transition-colors"
          >
            <Instagram className="w-4 h-4" /> See it all on Instagram
          </a>
        </div>
      </div>
    </section>
  );
};
