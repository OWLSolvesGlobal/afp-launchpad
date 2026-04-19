import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import menImg from "@/assets/category-men.jpg";
import womenImg from "@/assets/category-women.jpg";

const tiles = [
  { to: "/shop/men", label: "Men's Range", img: menImg, count: "Built to lift" },
  { to: "/shop/women", label: "Women's Range", img: womenImg, count: "Seamless + strong" },
  { to: "/shop/men?sort=new", label: "New Iron", img: menImg, count: "Just landed" },
  { to: "/shop/women?sort=best", label: "The Drop List", img: womenImg, count: "Top of the rack" },
];

export const CategoryTiles = () => {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container">
        <div className="flex items-end justify-between mb-8 md:mb-12">
          <div>
            <div className="eyebrow text-graphite mb-3">01 — Shop the Rack</div>
            <h2 className="display-md">Pick Your Weight.</h2>
          </div>
          <Link to="/shop/men" className="hidden md:inline-flex eyebrow link-safety">
            View all →
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
                className="group relative block aspect-[3/4] overflow-hidden bg-ink"
              >
                <img
                  src={t.img}
                  alt={`Shop ${t.label}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700 ease-out-expo"
                />
                <div className="absolute inset-0 bg-gradient-card-hover" />
                <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-between text-bone">
                  <ArrowUpRight className="w-5 h-5 self-end opacity-0 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-300" />
                  <div>
                    <div className="eyebrow text-safety mb-1">{t.count}</div>
                    <h3 className="font-display uppercase text-3xl md:text-4xl leading-none tracking-tight">
                      {t.label}
                    </h3>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
