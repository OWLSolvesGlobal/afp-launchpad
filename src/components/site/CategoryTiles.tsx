import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import womenImg from "@/assets/afp-purple-romper.jpg";
import menImg from "@/assets/afp-mens-white.jpg.asset.json";
import setImg from "@/assets/afp-black-jumpsuit.jpg";
import accImg from "@/assets/afp-golf-dress.jpg";

const tiles = [
  { to: "/shop/women",          label: "Women",     img: womenImg, count: "32 styles", tint: "hsl(var(--lilac))" },
  { to: "/shop/men",            label: "Men",       img: menImg.url,   count: "18 styles", tint: "hsl(var(--sand))"  },
  { to: "/shop/women?sort=new", label: "Sets",      img: setImg,   count: "Match top to bottom", tint: "hsl(var(--sand))" },
  { to: "/shop/women?sort=best",label: "Tennis & Golf", img: accImg, count: "Court ready", tint: "hsl(var(--sky))" },
];

export const CategoryTiles = () => {
  return (
    <section className="bg-bone py-24 md:py-40">
      <div className="container">
        <div className="flex items-end justify-between mb-12 md:mb-20">
          <div>
            <div className="eyebrow text-graphite mb-3">— Shop the Edit</div>
            <h2 className="display-md">Find your <em className="italic">fit.</em></h2>
          </div>
          <Link to="/shop/women" className="hidden md:inline-flex eyebrow link-safety">
            Shop everything →
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {tiles.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                to={t.to}
                className="group block"
              >
                <div
                  className="relative aspect-[3/4] overflow-hidden"
                  style={{ backgroundColor: t.tint }}
                >
                  <img
                    src={t.img}
                    alt={`Shop ${t.label}`}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 w-9 h-9 grid place-items-center bg-background/0 group-hover:bg-background transition-colors">
                    <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-foreground" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <h3 className="font-serif text-xl md:text-2xl text-foreground">{t.label}</h3>
                  <span className="eyebrow text-graphite text-[10px]">{t.count}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
