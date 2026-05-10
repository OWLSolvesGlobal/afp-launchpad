import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useProducts } from "@/lib/catalog";
import { ProductCard } from "./ProductCard";

export const FeaturedCarousel = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: products = [] } = useProducts();

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  // Pull a featured mix: prefer badged items, then alternate genders
  const ranked = [...products].sort((a, b) => {
    const score = (p: typeof products[number]) =>
      p.badge === "BESTSELLER" ? 0 : p.badge === "NEW" ? 1 : p.badge ? 2 : 3;
    return score(a) - score(b);
  });
  const featured = ranked.slice(0, 8);

  return (
    <section className="bg-[hsl(var(--sand))] text-foreground py-24 md:py-40">
      <div className="container">
        <div className="flex items-end justify-between mb-12 md:mb-20">
          <div>
            <div className="eyebrow text-graphite mb-3">— Just Landed</div>
            <h2 className="display-md">New <em className="italic">arrivals.</em></h2>
          </div>
          <div className="flex gap-2">
            <button
              aria-label="Previous"
              onClick={() => scrollBy(-1)}
              className="w-10 h-10 grid place-items-center border border-foreground/30 hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              aria-label="Next"
              onClick={() => scrollBy(1)}
              className="w-10 h-10 grid place-items-center border border-foreground/30 hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3 md:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 px-5 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {featured.map((p, i) => (
          <div
            key={p.id}
            className="snap-start shrink-0 w-[72%] sm:w-[44%] md:w-[32%] lg:w-[24%]"
          >
            <ProductCard product={p} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
};
