import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-iron.jpg";
import afpLogo from "@/assets/afp-logo.png";

export const Hero = () => {
  const imgRef = useRef<HTMLDivElement>(null);

  // Subtle parallax
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = window.scrollY;
      el.style.transform = `translate3d(0, ${y * 0.25}px, 0) scale(1.08)`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-ink text-bone grain">
      {/* [PLACEHOLDER — REPLACE WITH AFP INSTAGRAM CONTENT] */}
      <div ref={imgRef} className="absolute inset-0 will-change-transform">
        <img
          src={heroImg}
          alt="Loaded barbell on platform in industrial gym, chalk dust suspended in tungsten light"
          width={1920}
          height={1280}
          className="w-full h-full object-cover object-center opacity-85"
          fetchPriority="high"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-hero" />

      {/* Oversized barbell watermark */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <motion.img
          src={afpLogo}
          alt=""
          aria-hidden="true"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 0.18, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-[120%] md:w-[85%] lg:w-[70%] max-w-none invert"
        />
      </div>

      <div className="relative h-full container flex flex-col justify-end pb-16 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="eyebrow text-safety mb-4"
        >
          Drop 01 / SS26 — Live Now
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="display-xl text-bone max-w-[14ch]"
        >
          Iron Over<br />Everything.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 max-w-md text-bone/70 text-sm md:text-base font-body"
        >
          Strength-built apparel for the rack, the platform, and everything in between.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4"
        >
          <Link
            to="/shop/men"
            className="group inline-flex items-center justify-between gap-6 bg-safety text-bone px-6 py-4 eyebrow hover:bg-safety-deep transition-colors"
          >
            Shop Men
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/shop/women"
            className="group inline-flex items-center justify-between gap-6 border border-bone/40 hover:border-bone text-bone px-6 py-4 eyebrow transition-colors"
          >
            Shop Women
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-6 right-4 md:right-8 eyebrow text-bone/70 hidden sm:block"
      >
        <span className="inline-block rotate-90 origin-right">Scroll —</span>
      </motion.div>
    </section>
  );
};
