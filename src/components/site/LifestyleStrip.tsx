import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import pinkPool from "@/assets/afp-pink-pool.jpg";
import blackJumpsuit from "@/assets/afp-black-jumpsuit.jpg";
import blueRomper from "@/assets/afp-blue-romper.jpg";
import purpleRomper from "@/assets/afp-purple-romper.jpg";

const scenes = [
  { img: pinkPool,       label: "Poolside",   subtitle: "Recovery days",       tint: "hsl(var(--blush))" },
  { img: blueRomper,     label: "Courtyard",  subtitle: "Off-duty staples",    tint: "hsl(var(--sky))"   },
  { img: blackJumpsuit,  label: "Garden",     subtitle: "Seamless silhouettes", tint: "hsl(var(--sand))" },
  { img: purpleRomper,   label: "Studio",     subtitle: "Signature fit",       tint: "hsl(var(--lilac))" },
];

export const LifestyleStrip = () => {
  return (
    <section className="bg-foreground text-background py-24 md:py-40">
      <div className="container">
        <div className="max-w-2xl mb-12 md:mb-20">
          <div className="eyebrow text-background/60 mb-4">— A Way of Living</div>
          <h2 className="display-lg">
            Wear it <em className="italic">anywhere.</em>
          </h2>
          <p className="mt-5 text-background/70 text-base md:text-lg leading-relaxed max-w-md">
            From the squat rack to the resort, the same set carries you.
            Designed for women and men who refuse a wardrobe split.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {scenes.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group"
            >
              <div
                className="relative aspect-[3/4] overflow-hidden"
                style={{ backgroundColor: s.tint }}
              >
                <img
                  src={s.img}
                  alt={`AFP ${s.label.toLowerCase()} lifestyle`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="font-serif text-xl md:text-2xl">{s.label}</div>
                <div className="eyebrow text-background/50 text-[10px]">{s.subtitle}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 md:mt-16 text-center">
          <Link
            to="/shop/women"
            className="inline-flex items-center gap-3 border border-background/30 hover:border-background text-background px-8 py-4 eyebrow transition-colors"
          >
            Explore the Lookbook →
          </Link>
        </div>
      </div>
    </section>
  );
};
