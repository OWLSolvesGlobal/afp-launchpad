import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { products } from "@/data/products";
import { ProductCard } from "./ProductCard";

export const FeaturedCarousel = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  // Pull a featured mix
  const featured = [
    products.find((p) => p.id === "w-001")!,
    products.find((p) => p.id === "m-003")!,
    products.find((p) => p.id === "w-002")!,
    products.find((p) => p.id === "m-001")!,
    products.find((p) => p.id === "w-005")!,
    products.find((p) => p.id === "m-005")!,
  ];

  return (
    <section className="bg-ink text-bone py-16 md:py-24">
      <div className="container">
        <div className="flex items-end justify-between mb-8 md:mb-12">
          <div>
            <div className="eyebrow text-lime mb-3">02 — Featured</div>
            <h2 className="display-md">Built for Battle.</h2>
          </div>
          <div className="flex gap-2">
            <button
              aria-label="Previous"
              onClick={() => scrollBy(-1)}
              className="w-10 h-10 grid place-items-center border border-bone/30 hover:border-lime hover:text-lime transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              aria-label="Next"
              onClick={() => scrollBy(1)}
              className="w-10 h-10 grid place-items-center border border-bone/30 hover:border-lime hover:text-lime transition-colors"
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
            {/* invert ProductCard onto dark bg by overriding card token via wrapper */}
            <div className="text-bone [&_.bg-card]:bg-transparent [&_.text-graphite]:text-bone/60">
              <ProductCard product={p} index={i} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
