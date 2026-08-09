import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import { ComingSoonCard, LIME, ProductCard, TURQUOISE, waLink } from "@/lib/afp-catalog";
import { categorySlug, useCatalog, visibleProducts } from "@/lib/catalog";
import { LogoLoader } from "@/components/site/LogoLoader";

/**
 * Collection pages are the Sheet's categories. Adding or retiring a category
 * is purely a Sheet edit — nothing here is hardcoded.
 */
export default function Collection() {
  const { slug } = useParams<{ slug: string }>();
  const { data: catalog, isLoading } = useCatalog();

  const category = catalog?.categories.find((c) => categorySlug(c) === slug) ?? null;
  const items = category
    ? visibleProducts(catalog!.products).filter((p) => p.category === category)
    : [];

  useEffect(() => {
    if (category) {
      document.title = `${category} — Alo Fitness Pro`;
    }
  }, [category]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white">
        <LogoLoader label="Loading" />
      </div>
    );
  }
  if (!category) return <Navigate to="/" replace />;

  return (
    <div className="bg-white text-neutral-900 min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1">
        <section className="container pt-24 md:pt-32 pb-8 md:pb-12">
          <Link
            to="/"
            aria-label="Back to home page"
            className="flex w-fit items-center gap-2 text-sm text-neutral-500 hover:text-black mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </Link>
          <span
            className="block text-[11px] font-bold tracking-[0.2em] uppercase"
            style={{ color: TURQUOISE }}
          >
            Collection
          </span>
          <h1 className="mt-2 text-4xl md:text-6xl font-black tracking-tight">
            {category}
            <span style={{ color: TURQUOISE }}>.</span>
          </h1>
        </section>

        <section className="container pb-20 md:pb-28">
          {items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <ComingSoonCard collectionLabel={category} />
              <div className="sm:col-span-1 lg:col-span-2 rounded-3xl bg-neutral-50 p-8 md:p-12 flex flex-col justify-center">
                <div
                  className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3"
                  style={{ color: TURQUOISE }}
                >
                  Get first dibs
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
                  New {category} pieces are landing soon.
                </h2>
                <p className="text-neutral-600 mb-6 max-w-md">
                  DM us on WhatsApp and we'll message you the moment they drop —
                  before they hit the site.
                </p>
                <a
                  href={waLink(`Hi! Please notify me when new ${category} pieces drop.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-bold text-black w-fit"
                  style={{ background: LIME }}
                >
                  <MessageCircle className="w-4 h-4" /> Notify me on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {items.map((p) => (
                <ProductCard key={p.sku} p={p} />
              ))}
            </div>
            <p className="mt-10 text-center text-sm text-neutral-500">
              More {category} pieces landing soon —{" "}
              <a
                href={waLink(`Hi! Notify me when new ${category} drops.`)}
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold text-black hover:opacity-70"
              >
                get notified on WhatsApp
              </a>
              .
            </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
