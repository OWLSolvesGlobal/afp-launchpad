import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { formatPrice, useProducts } from "@/lib/catalog";
import { LIME, TURQUOISE } from "@/lib/afp-catalog";

export function FeaturedCarousel() {
  const { data: products = [], isLoading } = useProducts();

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="container py-16 md:py-24">
      <div className="flex items-end justify-between mb-8 md:mb-10 gap-4">
        <div>
          <span
            className="text-[11px] font-bold tracking-[0.2em] uppercase"
            style={{ color: TURQUOISE }}
          >
            Featured
          </span>
          <h2 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">
            Straight from the rack.
          </h2>
        </div>
        <Link
          to="/collection/alobabes"
          className="hidden md:inline-flex items-center gap-2 text-sm font-semibold hover:opacity-70"
        >
          Shop all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <Carousel opts={{ align: "start", loop: false }} className="relative">
        <CarouselContent className="-ml-4">
          {(isLoading ? Array.from({ length: 4 }) : products).map((p: any, i: number) => (
            <CarouselItem
              key={p?.id ?? i}
              className="pl-4 basis-[80%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
            >
              {isLoading ? (
                <div className="rounded-3xl bg-neutral-100 aspect-[4/5] animate-pulse" />
              ) : (
                <Link
                  to={`/product/${p.slug}`}
                  className="group block rounded-3xl bg-white overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_40px_rgba(0,181,226,0.15)] transition-shadow"
                >
                  <div className="relative aspect-[4/5] bg-neutral-50 overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.imageAlt}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {p.badge && (
                      <span
                        className="absolute top-4 left-4 text-[10px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full text-black"
                        style={{ background: LIME }}
                      >
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold leading-tight">{p.name}</h3>
                      <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mt-1">
                        {p.gender === "men" ? "Men" : p.gender === "women" ? "Women" : "Unisex"}
                      </p>
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap">
                      {formatPrice(p.price)}
                    </span>
                  </div>
                </Link>
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-4" />
        <CarouselNext className="hidden md:flex -right-4" />
      </Carousel>
    </section>
  );
}