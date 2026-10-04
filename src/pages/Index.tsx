import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Instagram, MessageCircle, ArrowRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import blueFront from "@/assets/product-blue-aura-set-front.webp";
import lockers from "@/assets/accent-gym-lockers-lifestyle.webp";
import mensTile from "@/assets/afp-mens-black.webp";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, TAGLINE, waLink } from "@/lib/brand";
import {
  categorySlug,
  productImageUrl,
  useCatalog,
  visibleProducts,
} from "@/lib/catalog";

const Index = () => {
  const { data: catalog } = useCatalog();

  useEffect(() => {
    document.title = `Alo Fitness Pro — ${TAGLINE}`;
  }, []);

  const products = useMemo(
    () => (catalog ? visibleProducts(catalog.products) : []),
    [catalog],
  );

  // Category tiles are derived from the Sheet (women-first), never hardcoded.
  const collections = useMemo(
    () =>
      (catalog?.categories ?? []).slice(0, 4).map((category) => ({
        slug: categorySlug(category),
        label: category,
        img: productImageUrl(
          products.find((p) => p.category === category)?.image ?? "",
        ),
      })),
    [catalog, products],
  );

  // Featured grid: the Sheet's featured_skus config row, else newest-first
  // women's pieces.
  const featured = useMemo(() => {
    const bySku = new Map(products.map((p) => [p.sku, p]));
    const picked = (catalog?.config.featuredSkus ?? [])
      .map((sku) => bySku.get(sku))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (picked.length) return picked;
    return products.filter((p) => p.gender !== "men").slice(0, 6);
  }, [catalog, products]);

  // hero_order lets the owner pick the hero image straight from the Sheet.
  const heroImage = useMemo(() => {
    const bySku = new Map(products.map((p) => [p.sku, p]));
    for (const sku of catalog?.config.heroOrder ?? []) {
      const p = bySku.get(sku);
      if (p?.image) return { src: productImageUrl(p.image), alt: p.imageAlt };
    }
    return { src: blueFront, alt: "AFP Blue Aura Set" };
  }, [catalog, products]);

  return (
    <div className="bg-background text-foreground">
      <Header />

      <main id="main">
        {/* HERO */}
        <section className="relative overflow-hidden pt-20 md:pt-24">
          <div className="container grid md:grid-cols-2 gap-8 md:gap-12 items-center py-10 md:py-20">
            <div className="order-2 md:order-1">
              <div className="eyebrow text-accent mb-6">
                Designed in Barbados
              </div>
              <h1 className="display-lg max-w-xl">
                For the life{" "}
                <em className="font-serif italic font-light">you</em> live.
              </h1>
              <p className="mt-6 text-base md:text-lg text-graphite max-w-md">
                Rompers, seamless sets, and court-ready dresses made for every
                part of your day — the studio, the green, and everywhere in
                between.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href="#shop"
                  className="inline-flex items-center gap-2 bg-ink text-bone px-8 py-4 eyebrow hover:bg-accent transition-colors"
                >
                  Shop the collection <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href={waLink("Hi AFP! I'd like to place an order.")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-ink text-ink px-8 py-4 eyebrow hover:bg-ink hover:text-bone transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp us
                </a>
              </div>
              <Link
                to="/shop/men"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium link-accent group"
              >
                Shop AFP Men
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="order-1 md:order-2 relative aspect-[4/5] overflow-hidden bg-muted">
              <img
                src={heroImage.src}
                alt={heroImage.alt}
                fetchPriority="high"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* COLLECTIONS STRIP — categories straight from the Sheet */}
        {collections.length > 0 && (
          <section className="container py-14 md:py-20">
            <div className="flex items-end justify-between mb-8">
              <h2 className="display-md">Collections</h2>
              <span className="eyebrow text-graphite">Explore</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              {collections.map((c) => (
                <Link
                  key={c.slug}
                  to={`/collection/${c.slug}`}
                  className="group relative aspect-[3/4] overflow-hidden bg-muted"
                >
                  <img
                    src={c.img}
                    alt={c.label}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-card-hover" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <span className="text-bone font-medium tracking-tight">
                      {c.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-bone transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FEATURED SHOP */}
        <section id="shop" className="bg-bone py-16 md:py-24">
          <div className="container">
            <div className="flex items-end justify-between mb-8 md:mb-10">
              <div>
                <div className="eyebrow text-accent mb-3">Shop</div>
                <h2 className="display-md">Featured</h2>
              </div>
              <Link
                to="/shop/women"
                className="hidden md:inline-flex items-center gap-2 text-sm font-medium link-accent"
              >
                See full catalog <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {featured.length === 0 ? (
              <div className="bg-card p-10 md:p-16 text-center">
                <div className="eyebrow text-accent mb-4">New drop loading</div>
                <h3 className="display-md mb-4">
                  The next collection is landing soon.
                </h3>
                <p className="text-graphite mb-8 max-w-md mx-auto">
                  Message us on WhatsApp and we'll tell you the moment it drops.
                </p>
                <a
                  href={waLink("Hi! Notify me when the new AFP collection drops.")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-ink text-bone px-8 py-4 eyebrow hover:bg-accent transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Notify me on WhatsApp
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {featured.map((p, i) => (
                  <ProductCard key={p.sku} product={p} index={i} />
                ))}
              </div>
            )}
            <p className="mt-10 text-center text-sm text-graphite">
              More drops on the way —{" "}
              <a
                href={waLink("Hi! Notify me when new AFP pieces drop.")}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 font-medium text-ink hover:text-accent transition-colors"
              >
                get first access on WhatsApp
              </a>
              .
            </p>
          </div>
        </section>

        {/* AFP MEN BAND */}
        <section className="container py-6 md:py-10">
          <Link
            to="/shop/men"
            className="group relative block overflow-hidden bg-ink text-bone min-h-[320px] md:min-h-[420px]"
          >
            <img
              src={mensTile}
              alt="AFP Men performance basics"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-70 transition-transform duration-700 ease-out-expo group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent" />
            <div className="relative h-full p-8 md:p-14 flex flex-col justify-center max-w-xl">
              <div className="eyebrow text-accent mb-4">For him</div>
              <h2 className="display-md">
                AFP Men.
                <br />
                Train sharp.
              </h2>
              <p className="mt-4 text-bone/80 max-w-sm">
                Performance tees and shorts for the men who train heavy and
                dress sharp.
              </p>
              <span className="mt-8 inline-flex items-center gap-2 bg-bone text-ink px-8 py-4 eyebrow w-fit group-hover:bg-accent group-hover:text-bone transition-colors">
                Shop AFP Men <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>
        </section>

        {/* LIFESTYLE BAND */}
        <section className="relative h-[420px] md:h-[520px] overflow-hidden">
          <img
            src={lockers}
            alt="AFP lifestyle"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/55" />
          <div className="relative h-full container flex flex-col items-center justify-center text-center text-bone">
            <div className="eyebrow mb-5 text-bone/80">{INSTAGRAM_HANDLE}</div>
            <p className="font-serif italic text-3xl md:text-6xl max-w-3xl leading-tight">
              What are you doing this Tuesday?
            </p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-10 inline-flex items-center gap-2 bg-bone text-ink px-8 py-4 eyebrow hover:bg-accent hover:text-bone transition-colors"
            >
              <Instagram className="w-3.5 h-3.5" /> Follow along
            </a>
          </div>
        </section>
      </main>

      <Footer />

      {/* Sticky WhatsApp */}
      <a
        href={waLink("Hi AFP! I have a question.")}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full grid place-items-center bg-ink text-bone hover:bg-accent transition-colors shadow-lg"
      >
        <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
      </a>
    </div>
  );
};

export default Index;
