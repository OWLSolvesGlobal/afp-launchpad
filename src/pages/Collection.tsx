import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Header } from "@/components/site/Header";
import {
  COLLECTIONS,
  ComingSoonCard,
  LIME,
  ProductCard,
  TURQUOISE,
  productsByCollection,
  waLink,
  type CollectionSlug,
} from "@/lib/afp-catalog";

const VALID: CollectionSlug[] = ["alobabes", "afplounge", "afp-men", "add-ons"];

export default function Collection() {
  const { slug } = useParams<{ slug: string }>();
  const isValid = slug && (VALID as string[]).includes(slug);
  const collection = isValid ? COLLECTIONS[slug as CollectionSlug] : null;
  const items = isValid ? productsByCollection(slug as CollectionSlug) : [];

  useEffect(() => {
    if (collection) {
      document.title = `${collection.label} — Alo Fitness Pro`;
    }
  }, [collection]);

  if (!isValid || !collection) return <Navigate to="/" replace />;

  return (
    <div className="bg-white text-neutral-900 min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1">
        <section className="container pt-24 md:pt-32 pb-8 md:pb-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-black mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <span
            className="text-[11px] font-bold tracking-[0.2em] uppercase"
            style={{ color: TURQUOISE }}
          >
            Collection
          </span>
          <h1 className="mt-2 text-4xl md:text-6xl font-black tracking-tight">
            {collection.label}
            <span style={{ color: TURQUOISE }}>.</span>
          </h1>
          <p className="mt-3 font-serif italic text-xl md:text-2xl text-neutral-700">
            {collection.tagline}
          </p>
          <p className="mt-4 max-w-xl text-neutral-600">{collection.description}</p>
        </section>

        <section className="container pb-20 md:pb-28">
          {items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <ComingSoonCard collectionLabel={collection.label} />
              <div className="sm:col-span-1 lg:col-span-2 rounded-3xl bg-neutral-50 p-8 md:p-12 flex flex-col justify-center">
                <div
                  className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3"
                  style={{ color: TURQUOISE }}
                >
                  Get first dibs
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
                  New {collection.label} pieces are landing soon.
                </h2>
                <p className="text-neutral-600 mb-6 max-w-md">
                  DM us on WhatsApp and we'll message you the moment they drop —
                  before they hit the site.
                </p>
                <a
                  href={waLink(`Hi! Please notify me when new ${collection.label} pieces drop.`)}
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
                <ProductCard key={p.name} p={p} />
              ))}
            </div>
            <p className="mt-10 text-center text-sm text-neutral-500">
              More {collection.label} pieces landing soon —{" "}
              <a
                href={waLink(`Hi! Notify me when new ${collection.label} drops.`)}
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