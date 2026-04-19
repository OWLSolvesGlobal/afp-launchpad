import { Instagram } from "lucide-react";
import { motion } from "framer-motion";

// 9-up Instagram feed grid. Using product imagery as placeholder until IG Graph API connects.
import a from "@/assets/category-men.jpg";
import b from "@/assets/category-women.jpg";
import c from "@/assets/product-mens-tee.jpg";
import d from "@/assets/product-womens-leggings.jpg";
import e from "@/assets/product-mens-hoodie.jpg";
import f from "@/assets/product-womens-bra.jpg";
import g from "@/assets/product-mens-shorts.jpg";
import h from "@/assets/product-womens-tee.jpg";
import i from "@/assets/hero-athlete.jpg";

const tiles = [a, b, c, d, e, f, g, h, i];

export const InstagramGrid = () => {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-12">
          <div>
            <div className="eyebrow text-graphite mb-3">03 — From the Feed</div>
            <h2 className="display-md">Tag <span className="text-lime">@alofitnesspro</span></h2>
          </div>
          <a
            href="https://instagram.com/alofitnesspro"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 eyebrow link-lime"
          >
            <Instagram className="w-4 h-4" /> Follow on Instagram
          </a>
        </div>

        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
          {tiles.map((src, idx) => (
            <motion.a
              key={idx}
              href="https://instagram.com/alofitnesspro"
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (idx % 3) * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="group relative aspect-square overflow-hidden bg-muted"
            >
              <img
                src={src}
                alt={`Instagram post ${idx + 1}`}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/40 transition-colors grid place-items-center">
                <Instagram className="w-6 h-6 text-bone opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};
