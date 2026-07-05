import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Instagram, MessageCircle, MapPin, Clock, ArrowRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import blueFront from "@/assets/product-blue-aura-set-front.jpg.asset.json";
import loungie from "@/assets/accent-new-loungie-colors.jpg.asset.json";
import lockers from "@/assets/accent-gym-lockers-lifestyle.jpg.asset.json";
import mensTile from "@/assets/afp-mens-black.jpg.asset.json";
import aloBabesTile from "@/assets/ashlee-blue.jpg";
import {
  LIME,
  ProductCard,
  TURQUOISE,
  products,
  productsByCollection,
  waLink,
  type CollectionSlug,
} from "@/lib/afp-catalog";

const Index = () => {
  useEffect(() => {
    document.title = "Alo Fitness Pro — Fitness Fashion for the Unstoppable YOU";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        "AFP — Alo Fitness Pro. Stylish everyday athletic wear for women and men. Order on WhatsApp. Based in St Michael, Barbados."
      );
  }, []);

  const collections: { slug: CollectionSlug; label: string; img: string }[] = [
    { slug: "alobabes", label: "AloBabes", img: aloBabesTile },
    { slug: "afplounge", label: "AFPLounge", img: loungie.url },
    { slug: "afp-men", label: "AFP MEN", img: mensTile.url },
    { slug: "add-ons", label: "Add-Ons", img: productsByCollection("add-ons")[0]?.image ?? loungie.url },
  ];

  const featured = products.filter((p) => p.collections.includes("alobabes"));
  const addOns = productsByCollection("add-ons");

  return (
    <div className="bg-white text-neutral-900">
      <Header />

      <main id="main">
        {/* HERO */}
        <section className="relative overflow-hidden bg-white pt-20 md:pt-24">
          <div className="container grid md:grid-cols-2 gap-8 md:gap-12 items-center py-8 md:py-16">
            <div className="order-2 md:order-1">
              <span
                className="inline-block text-[11px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full"
                style={{ background: LIME }}
              >
                New Drop · SS26
              </span>
              <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight">
                Fitness Fashion
                <br />
                for the{" "}
                <span style={{ color: TURQUOISE }}>Unstoppable</span>
                <br />
                <em className="italic font-serif font-normal">YOU.</em>
              </h1>
              <p className="mt-6 text-base md:text-lg text-neutral-600 max-w-md">
                Stylish everyday athletic wear designed in Barbados. Sculpting fits,
                bold colour, made for the woman who doesn't stop.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#shop"
                  className="inline-flex items-center gap-2 h-14 px-8 rounded-full font-bold text-white transition-transform hover:scale-[1.02]"
                  style={{ background: TURQUOISE }}
                >
                  Shop the Collection <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href={waLink("Hi AFP! I'd like to place an order.")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 h-14 px-8 rounded-full font-bold border-2 border-black hover:bg-black hover:text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp Us
                </a>
              </div>
            </div>

            <div className="order-1 md:order-2 relative">
              <div
                className="absolute -inset-6 md:-inset-10 rounded-[2.5rem] -z-0"
                style={{ background: `linear-gradient(135deg, ${TURQUOISE}22, ${LIME}44)` }}
              />
              <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-neutral-100">
                <img
                  src={blueFront.url}
                  alt="AFP Blue Aura Set"
                  fetchPriority="high"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* COLLECTIONS STRIP */}
        <section className="container py-12 md:py-16">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Collections</h2>
            <span className="text-xs tracking-[0.2em] uppercase text-neutral-500">
              Explore
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {collections.map((c) => (
              <Link
                key={c.slug}
                to={`/collection/${c.slug}`}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-100"
              >
                <img
                  src={c.img}
                  alt={c.label}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                  <span className="text-white font-bold text-lg tracking-tight">
                    {c.label}
                  </span>
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-black"
                    style={{ background: LIME }}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* FEATURED PRODUCTS */}
        <section id="shop" className="bg-neutral-50 py-16 md:py-24">
          <div className="container">
            <div className="flex items-end justify-between mb-8 md:mb-10">
              <div>
                <span
                  className="text-[11px] font-bold tracking-[0.2em] uppercase"
                  style={{ color: TURQUOISE }}
                >
                  Shop
                </span>
                <h2 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">
                  Featured Fits
                </h2>
              </div>
              <a
                href={waLink("Hi! Send me the full AFP catalog.")}
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex items-center gap-2 text-sm font-semibold hover:opacity-70"
              >
                See full catalog <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {featured.map((p) => (
                <ProductCard key={p.name} p={p} />
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-neutral-500">
              More AloBabes drops on the way —{" "}
              <a
                href={waLink("Hi! Notify me when new AloBabes pieces drop.")}
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold text-black hover:opacity-70"
              >
                get first access on WhatsApp
              </a>
              .
            </p>
          </div>
        </section>

        {/* AFP MEN BAND */}
        <section className="container py-4 md:py-8">
          <Link
            to="/collection/afp-men"
            className="group relative block overflow-hidden rounded-3xl bg-black text-white min-h-[320px] md:min-h-[420px]"
          >
            <img
              src={mensTile.url}
              alt="AFP MEN — built for the grind"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            <div className="relative h-full p-8 md:p-14 flex flex-col justify-center max-w-xl">
              <span
                className="text-[11px] font-bold tracking-[0.25em] uppercase mb-3"
                style={{ color: LIME }}
              >
                Now Open · AFP MEN
              </span>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
                Built for
                <br />
                the grind.
              </h2>
              <p className="mt-4 text-white/80 max-w-sm">
                Performance basics for the men who train heavy and dress sharp.
                First pieces landing — be first in line.
              </p>
              <span
                className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full font-bold text-black w-fit"
                style={{ background: LIME }}
              >
                Shop AFP MEN <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        </section>

        {/* LIFESTYLE BAND */}
        <section className="relative h-[420px] md:h-[520px] overflow-hidden">
          <img
            src={lockers.url}
            alt="AFP lifestyle"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative h-full container flex flex-col items-center justify-center text-center text-white">
            <span
              className="text-[11px] font-bold tracking-[0.25em] uppercase mb-4"
              style={{ color: LIME }}
            >
              @alofitnesspro
            </span>
            <p className="font-serif italic text-3xl md:text-6xl max-w-3xl leading-tight">
              What are you doing this Tuesday?
            </p>
            <a
              href="https://instagram.com/alofitnesspro"
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 h-12 px-6 rounded-full font-bold text-black"
              style={{ background: LIME }}
            >
              <Instagram className="w-4 h-4" /> Follow the movement
            </a>
          </div>
        </section>

        {/* ACCESSORIES */}
        <section className="container py-16 md:py-24">
          <div className="mb-8">
            <span
              className="text-[11px] font-bold tracking-[0.2em] uppercase"
              style={{ color: TURQUOISE }}
            >
              Add-Ons
            </span>
            <h2 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">
              Fuel the routine.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {addOns.map((p) => (
              <ProductCard key={p.name} p={p} />
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-black text-white">
        <div
          className="w-full py-4 text-center text-black text-sm font-bold tracking-widest uppercase"
          style={{ background: LIME }}
        >
          Shake. Mix. Thrive. · Fuel your day.
        </div>
        <div className="container py-14 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="text-2xl font-black tracking-tight">
              ALO FITNESS <span style={{ color: TURQUOISE }}>PRO</span>
            </div>
            <p className="mt-3 text-sm text-white/70 max-w-sm">
              Fitness Fashion for the Unstoppable YOU. Designed in Barbados,
              worn everywhere.
            </p>
          </div>
          <div>
            <div className="text-xs font-bold tracking-[0.2em] uppercase text-white/50 mb-3">
              Visit
            </div>
            <ul className="space-y-2 text-sm text-white/80">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: LIME }} />
                St Michael, Barbados
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: LIME }} />
                Mon–Sat · 8AM – 6PM
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold tracking-[0.2em] uppercase text-white/50 mb-3">
              Order · Follow
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={waLink("Hi AFP!")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:opacity-80"
                  style={{ color: LIME }}
                >
                  <MessageCircle className="w-4 h-4" /> +1 (246) 252-0102
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/alofitnesspro"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-white/80 hover:text-white"
                >
                  <Instagram className="w-4 h-4" /> @alofitnesspro
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container py-5 text-xs text-white/50 flex flex-col md:flex-row items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} Alo Fitness Pro. All rights reserved.</span>
            <span>Ships across Barbados & worldwide.</span>
          </div>
        </div>
      </footer>

      {/* Sticky WhatsApp */}
      <a
        href={waLink("Hi AFP! I have a question.")}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-white hover:scale-110 transition-transform"
        style={{ background: "#25D366" }}
      >
        <MessageCircle className="w-6 h-6" />
      </a>
    </div>
  );
};

export default Index;
