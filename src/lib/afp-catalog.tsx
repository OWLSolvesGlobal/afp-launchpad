import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import blueFront from "@/assets/product-blue-aura-set-front.webp";
import blueBack from "@/assets/product-blue-aura-set-back.webp";
import twoPieceFront from "@/assets/product-two-piece-set-black-red-front.webp";
import twoPieceBack from "@/assets/product-two-piece-set-black-red-back.webp";
import vbackFront from "@/assets/product-vback-sets-3colors-front.webp";
import vbackBack from "@/assets/product-vback-sets-3colors-back.webp";
import zipFront from "@/assets/product-zip-jacket-sets-duo-front.webp";
import zipBack from "@/assets/product-zip-jacket-sets-duo-back.webp";
import longsleeve from "@/assets/product-longsleeve-shorts-sets-duo.webp";
import babydoll from "@/assets/product-babydoll-romper-card.webp";
import shaker from "@/assets/product-afp-shaker-bottles.webp";
import mensBlackSet from "@/assets/afp-mens-black.webp";
import mensWhiteSet from "@/assets/afp-mens-white.webp";
import ashleeApple from "@/assets/ashlee-apple.webp";

export const WA = "https://wa.me/12468364327";
export const waLink = (msg: string) => `${WA}?text=${encodeURIComponent(msg)}`;
export const TURQUOISE = "#00b5e2";
export const LIME = "#c5e86c";

export type CollectionSlug = "alobabes" | "afplounge" | "afp-men" | "add-ons";

export type Product = {
  name: string;
  price: string;
  image: string;
  gallery?: string[];
  colors?: { name: string; hex: string }[];
  sizes: string[];
  tag?: string;
  collections: CollectionSlug[];
};

export const products: Product[] = [
  {
    name: "Blue Aura Set",
    price: "DM for price",
    image: blueFront,
    gallery: [blueBack],
    colors: [{ name: "Turquoise", hex: TURQUOISE }],
    sizes: ["S", "M", "L", "XL"],
    tag: "NEW",
    collections: ["alobabes"],
  },
  {
    name: "Two Piece Set",
    price: "$100",
    image: twoPieceFront,
    gallery: [twoPieceBack],
    colors: [
      { name: "Black", hex: "#111" },
      { name: "Red", hex: "#e63946" },
    ],
    sizes: ["S", "M", "L", "XL"],
    collections: ["alobabes"],
  },
  {
    name: "V-Back Set",
    price: "DM for price",
    image: vbackFront,
    gallery: [vbackBack],
    colors: [
      { name: "Lime", hex: LIME },
      { name: "Blue", hex: "#1e63e0" },
      { name: "Black", hex: "#111" },
    ],
    sizes: ["S", "M", "L"],
    tag: "BESTSELLER",
    collections: ["alobabes"],
  },
  {
    name: "Zip Jacket Set",
    price: "DM for price",
    image: zipFront,
    gallery: [zipBack],
    colors: [
      { name: "Black", hex: "#111" },
      { name: "Lime", hex: LIME },
    ],
    sizes: ["S", "M", "L", "XL"],
    collections: ["alobabes"],
  },
  {
    name: "Long-Sleeve + Shorts Set",
    price: "DM for price",
    image: longsleeve,
    colors: [
      { name: "Black", hex: "#111" },
      { name: "Lime", hex: LIME },
    ],
    sizes: ["S", "M", "L", "XL"],
    collections: ["alobabes"],
  },
  {
    name: "Babydoll Romper",
    price: "DM for price",
    image: babydoll,
    colors: [
      { name: "Black", hex: "#111" },
      { name: "Chocolate", hex: "#5b3a1e" },
      { name: "Dark Turquoise", hex: "#0891b2" },
    ],
    sizes: ["S", "M", "L", "XL"],
    tag: "SCULPT · LIFT · FLATTER",
    collections: ["alobabes"],
  },
  {
    name: "AFP Shaker Bottle",
    price: "$40",
    image: shaker,
    colors: [
      { name: "Green", hex: "#7fb069" },
      { name: "Grey", hex: "#8b8078" },
      { name: "Mustard", hex: "#e9a23b" },
      { name: "Forest", hex: "#2f5233" },
      { name: "Pink", hex: "#f2b6b6" },
    ],
    sizes: ["One size"],
    collections: ["add-ons"],
  },
  {
    name: "AFP Lime Romper",
    price: "DM for price",
    image: ashleeApple,
    colors: [{ name: "Lime", hex: LIME }],
    sizes: ["S", "M", "L"],
    tag: "SIGNATURE",
    collections: ["alobabes"],
  },
  {
    name: "AFP MEN Performance Set — Black",
    price: "DM for price",
    image: mensBlackSet,
    gallery: [mensWhiteSet],
    colors: [
      { name: "Black", hex: "#111" },
      { name: "White", hex: "#f5f5f5" },
    ],
    sizes: ["S", "M", "L", "XL"],
    tag: "NEW",
    collections: ["afp-men"],
  },
  {
    name: "AFP MEN Tee + Shorts — White",
    price: "DM for price",
    image: mensWhiteSet,
    gallery: [mensBlackSet],
    colors: [
      { name: "White", hex: "#f5f5f5" },
      { name: "Black", hex: "#111" },
    ],
    sizes: ["S", "M", "L", "XL"],
    collections: ["afp-men"],
  },
];

export const productsByCollection = (slug: CollectionSlug) =>
  products.filter((p) => p.collections.includes(slug));

export const COLLECTIONS: Record<
  CollectionSlug,
  { label: string; tagline: string; description: string }
> = {
  alobabes: {
    label: "AloBabes",
    tagline: "For the woman who doesn't stop.",
    description:
      "Sculpting sets, rompers and second-skin fits engineered for every rep — and every mirror selfie after.",
  },
  afplounge: {
    label: "AFPLounge",
    tagline: "Soft power. Off-duty essentials.",
    description:
      "Loungewear built for rest days, travel days, and everything in between. New colourways dropping soon.",
  },
  "afp-men": {
    label: "AFP MEN",
    tagline: "Built for the grind.",
    description:
      "Performance basics for the men who train heavy and dress sharp. Full collection landing soon.",
  },
  "add-ons": {
    label: "Add-Ons",
    tagline: "Fuel the routine.",
    description: "Shakers and accessories to complete the AFP kit.",
  },
};

export function ProductCard({ p }: { p: Product }) {
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

export function ComingSoonCard({ collectionLabel }: { collectionLabel: string }) {
  return (
    <a
      href={waLink(`Hi! When are more ${collectionLabel} pieces dropping?`)}
      target="_blank"
      rel="noreferrer"
      className="group rounded-3xl border-2 border-dashed border-neutral-300 bg-white flex flex-col items-center justify-center text-center p-8 aspect-[4/5] sm:aspect-auto sm:min-h-[520px] hover:border-black transition-colors"
    >
      <span
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: LIME }}
      >
        <Sparkles className="w-6 h-6 text-black" />
      </span>
      <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mb-2">
        Coming Soon
      </div>
      <div className="font-semibold text-lg mb-2">More {collectionLabel} drops on the way</div>
      <div className="text-sm text-neutral-500 max-w-[22ch]">
        Tap to DM us and get first access when they land.
      </div>
    </a>
  );
}