import { useEffect, useState } from "react";
import { Instagram, MessageCircle, MapPin, Clock, ArrowRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import blueFront from "@/assets/product-blue-aura-set-front.jpg.asset.json";
import blueBack from "@/assets/product-blue-aura-set-back.jpg.asset.json";
import twoPieceBack from "@/assets/product-two-piece-set-black-red-back.jpg.asset.json";
import vbackFront from "@/assets/product-vback-sets-3colors-front.jpg.asset.json";
import vbackBack from "@/assets/product-vback-sets-3colors-back.jpg.asset.json";
import zipFront from "@/assets/product-zip-jacket-sets-duo-front.jpg.asset.json";
import zipBack from "@/assets/product-zip-jacket-sets-duo-back.jpg.asset.json";
import longsleeve from "@/assets/product-longsleeve-shorts-sets-duo.jpg.asset.json";
import babydoll from "@/assets/product-babydoll-romper-card.jpg.asset.json";
import shaker from "@/assets/product-afp-shaker-bottles.jpg.asset.json";
import loungie from "@/assets/afp-lime-romper.jpg";
import lockers from "@/assets/hero-iron.jpg";
import mensTile from "@/assets/afp-mens-black.jpg";
import aloBabesTile from "@/assets/ashlee-blue.jpg";

const WA = "https://wa.me/12462520102";
const waLink = (msg: string) => `${WA}?text=${encodeURIComponent(msg)}`;

const TURQUOISE = "#00b5e2";
const LIME = "#c5e86c";

type Product = {
  name: string;
  price: string; // "$100" or "DM for price"
  image: string;
  gallery?: string[];
  colors?: { name: string; hex: string }[];
  sizes: string[];
  tag?: string;
};

const products: Product[] = [
  {
    name: "Blue Aura Set",
    price: "DM for price",
    image: blueFront.url,
    gallery: [blueBack.url],
    colors: [{ name: "Turquoise", hex: TURQUOISE }],
    sizes: ["S", "M", "L", "XL"],
    tag: "NEW",
  },
  {
    name: "Two Piece Set",
    price: "$100",
    image: twoPieceBack.url,
    colors: [
      { name: "Black", hex: "#111" },
      { name: "Red", hex: "#e63946" },
    ],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    name: "V-Back Set",
    price: "DM for price",
    image: vbackFront.url,
    gallery: [vbackBack.url],
    colors: [
      { name: "Lime", hex: LIME },
      { name: "Blue", hex: "#1e63e0" },
      { name: "Black", hex: "#111" },
    ],
    sizes: ["S", "M", "L"],
    tag: "BESTSELLER",
  },
  {
    name: "Zip Jacket Set",
    price: "DM for price",
    image: zipFront.url,
    gallery: [zipBack.url],
    colors: [
      { name: "Black", hex: "#111" },
      { name: "Lime", hex: LIME },
    ],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    name: "Long-Sleeve + Shorts Set",
    price: "DM for price",
    image: longsleeve.url,
    colors: [
      { name: "Black", hex: "#111" },
      { name: "Lime", hex: LIME },
    ],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    name: "Babydoll Romper",
    price: "DM for price",
    image: babydoll.url,
    colors: [
      { name: "Black", hex: "#111" },
      { name: "Chocolate", hex: "#5b3a1e" },
      { name: "Dark Turquoise", hex: "#0891b2" },
    ],
    sizes: ["S", "M", "L", "XL"],
    tag: "SCULPT · LIFT · FLATTER",
  },
];

const accessories: Product[] = [
  {
    name: "AFP Shaker Bottle",
    price: "$40",
    image: shaker.url,
    colors: [
      { name: "Green", hex: "#7fb069" },
      { name: "Grey", hex: "#8b8078" },
      { name: "Mustard", hex: "#e9a23b" },
      { name: "Forest", hex: "#2f5233" },
      { name: "Pink", hex: "#f2b6b6" },
    ],
    sizes: ["One size"],
  },
];

function ProductCard({ p }: { p: Product }) {
  const [size, setSize] = useState(p.sizes[0]);
  const [hovered, setHovered] = useState(false);
  const secondary = p.gallery?.[0];
  const msg = `Hi! I'd like to order the ${p.name} (Size: ${size})`;
  return (
    <article className="group rounded-3xl bg-white overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_40px_rgba(0,181,226,0.15)] transition-shadow flex flex-col">
      <div
        className="relative aspect-[4/5] bg-neutral-50 overflow-hidden"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img
          src={p.image}
          alt={p.name}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${hovered && secondary ? "opacity-0" : "opacity-100"}`}
        />
        {secondary && (
          <img
            src={secondary}
            alt={`${p.name} back view`}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${hovered ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {p.tag && (
          <span
            className="absolute top-4 left-4 text-[10px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full text-black"
            style={{ background: LIME }}
          >
            {p.tag}
          </span>
        )}
      </div>
      <div className="p-5 md:p-6 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-lg leading-tight">{p.name}</h3>
          <span
            className="text-sm font-bold whitespace-nowrap"
            style={{ color: p.price.startsWith("$") ? "#111" : TURQUOISE }}
          >
            {p.price}
          </span>
        </div>

        {p.colors && p.colors.length > 0 && (
          <div className="flex items-center gap-2">
            {p.colors.map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="w-5 h-5 rounded-full ring-1 ring-black/10"
                style={{ background: c.hex }}
              />
            ))}
            <span className="text-xs text-neutral-500 ml-1">
              {p.colors.length} colour{p.colors.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {p.sizes.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`min-w-[44px] h-9 px-3 rounded-full text-xs font-semibold border transition-all ${
                size === s
                  ? "border-black bg-black text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <a
          href={waLink(msg)}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex items-center justify-center gap-2 h-12 rounded-full font-semibold text-black transition-transform hover:scale-[1.02]"
          style={{ background: LIME }}
        >
          <MessageCircle className="w-4 h-4" />
          Order on WhatsApp
        </a>
      </div>
    </article>
  );
}

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

  const collections = [
    { label: "AloBabes", img: aloBabesTile, href: waLink("Hi! Tell me about AloBabes.") },
    { label: "AFPLounge", img: loungie, href: waLink("Hi! I'm interested in AFPLounge pieces.") },
    { label: "AFP MEN", img: mensTile, href: waLink("Hi! Show me the AFP MEN collection.") },
    { label: "Add-Ons", img: shaker.url, href: waLink("Hi! I'd like to see AFP add-ons.") },
  ];

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
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
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
              </a>
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
              {products.map((p) => (
                <ProductCard key={p.name} p={p} />
              ))}
            </div>
          </div>
        </section>

        {/* LIFESTYLE BAND */}
        <section className="relative h-[420px] md:h-[520px] overflow-hidden">
          <img
            src={lockers}
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
            {accessories.map((p) => (
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
