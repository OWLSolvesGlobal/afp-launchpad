import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { ComingSoonCard } from "@/components/site/ComingSoonCard";
import { waLink } from "@/lib/brand";
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
      <div className="min-h-[60vh] flex items-center justify-center bg-background">
        <LogoLoader label="Loading" />
      </div>
    );
  }
  if (!category) return <Navigate to="/" replace />;

  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1">
        <section className="container pt-24 md:pt-32 pb-8 md:pb-12">
          <Link
            to="/"
            aria-label="Back to home page"
            className="flex w-fit items-center gap-2 text-sm text-graphite hover:text-ink mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </Link>
          <div className="eyebrow text-accent">Collection</div>
          <h1 className="mt-3 display-lg">
            {category}
            <span className="text-accent">.</span>
          </h1>
        </section>

        <section className="container pb-20 md:pb-28">
          {items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <ComingSoonCard collectionLabel={category} />
              <div className="sm:col-span-1 lg:col-span-2 bg-bone p-8 md:p-12 flex flex-col justify-center">
                <div className="eyebrow text-accent mb-4">Get first dibs</div>
                <h2 className="display-md mb-4">
                  New {category} pieces are landing soon.
                </h2>
                <p className="text-graphite mb-8 max-w-md">
                  Message us on WhatsApp and we'll tell you the moment they
                  drop — before they hit the site.
                </p>
                <a
                  href={waLink(`Hi! Please notify me when new ${category} pieces drop.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-ink text-bone px-8 py-4 eyebrow hover:bg-accent transition-colors w-fit"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Notify me on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {items.map((p, i) => (
                  <ProductCard key={p.sku} product={p} index={i} />
                ))}
              </div>
              <p className="mt-10 text-center text-sm text-graphite">
                More {category} pieces landing soon —{" "}
                <a
                  href={waLink(`Hi! Notify me when new ${category} drops.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 font-medium text-ink hover:text-accent transition-colors"
                >
                  get notified on WhatsApp
                </a>
                .
              </p>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
