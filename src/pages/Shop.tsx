import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { ShopFilters, defaultFilters, type FilterState } from "@/components/site/ShopFilters";
import { getProductsByGender, products as allProducts, type Gender } from "@/data/products";

export default function Shop() {
  const { gender } = useParams<{ gender: Gender }>();
  const isWomen = gender === "women";
  const list = useMemo(() => getProductsByGender(isWomen ? "women" : "men"), [isWomen]);

  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  useEffect(() => {
    setFilters(defaultFilters);
    document.title = isWomen
      ? "Shop Women — AFP Performance Apparel"
      : "Shop Men — AFP Performance Apparel";
  }, [isWomen]);

  const facets = useMemo(() => {
    const cats = new Set<string>();
    const sizes = new Set<string>();
    const colors = new Map<string, string>();
    list.forEach((p) => {
      cats.add(p.category);
      p.sizes.forEach((s) => sizes.add(s));
      p.colors.forEach((c) => colors.set(c.name, c.hex));
    });
    return {
      categories: [...cats],
      sizes: [...sizes],
      colors: [...colors].map(([name, hex]) => ({ name, hex })),
    };
  }, [list]);

  const filtered = useMemo(() => {
    let out = list.filter((p) => {
      if (filters.categories.length && !filters.categories.includes(p.category)) return false;
      if (filters.sizes.length && !p.sizes.some((s) => filters.sizes.includes(s))) return false;
      if (filters.colors.length && !p.colors.some((c) => filters.colors.includes(c.name))) return false;
      if (p.price / 100 > filters.priceMax) return false;
      return true;
    });
    switch (filters.sort) {
      case "price-asc":
        out = [...out].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        out = [...out].sort((a, b) => b.price - a.price);
        break;
      case "new":
        out = [...out].sort((a, b) => (a.badge === "NEW" ? -1 : 1));
        break;
    }
    return out;
  }, [list, filters]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Page hero — slim */}
      <section className="pt-20 md:pt-24 pb-8 md:pb-12 bg-background">
        <div className="container">
          <div className="eyebrow text-graphite mb-3">
            Shop / {isWomen ? "Women" : "Men"}
          </div>
          <h1 className="display-lg">
            {isWomen ? "Women" : "Men"}<span className="text-safety">.</span>
          </h1>
          <p className="mt-3 text-sm md:text-base text-graphite max-w-xl">
            {isWomen
              ? "Sculpted, supportive, second-skin. Engineered for every rep."
              : "Tested under load. Built for the heaviest sets and longest miles."}
          </p>
        </div>
      </section>

      <main id="main" className="container pb-24 flex flex-col lg:flex-row gap-8 lg:gap-12 flex-1">
        <ShopFilters
          value={filters}
          onChange={setFilters}
          facets={facets}
          totalCount={list.length}
          resultCount={filtered.length}
        />

        <section className="flex-1">
          <div className="hidden lg:flex items-center justify-between pb-6">
            <div className="eyebrow text-graphite">
              {filtered.length} of {list.length} products
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-24 text-center">
              <div className="eyebrow text-graphite mb-2">No matches</div>
              <p className="text-sm">Try loosening the filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
