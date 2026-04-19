// Seed product catalog. Replace placeholder images with real Instagram product photography.
// Image tag convention: src/assets/product-*.jpg are flagged [PLACEHOLDER — REPLACE].

import mensTee from "@/assets/product-mens-tee.jpg";
import mensShorts from "@/assets/product-mens-shorts.jpg";
import mensHoodie from "@/assets/product-mens-hoodie.jpg";
import womensLeggings from "@/assets/product-womens-leggings.jpg";
import womensBra from "@/assets/product-womens-bra.jpg";
import womensTee from "@/assets/product-womens-tee.jpg";

export type Gender = "men" | "women";
export type Category =
  | "tops"
  | "bottoms"
  | "outerwear"
  | "bras"
  | "shorts"
  | "leggings"
  | "tees";

export interface Product {
  id: string;
  slug: string;
  name: string;
  gender: Gender;
  category: Category;
  price: number;          // USD cents
  compareAt?: number;     // USD cents (for "was" pricing)
  colors: { name: string; hex: string }[];
  sizes: string[];
  image: string;
  imageAlt: string;
  badge?: "NEW" | "BESTSELLER" | "LOW STOCK";
  tag: "[PLACEHOLDER — REPLACE]";
}

const PH = "[PLACEHOLDER — REPLACE]" as const;

export const products: Product[] = [
  // ============ MEN ============
  {
    id: "m-001",
    slug: "apex-compression-tee",
    name: "Apex Compression Tee",
    gender: "men",
    category: "tops",
    price: 4800,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Graphite", hex: "#4B4B4B" },
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: mensTee,
    imageAlt: "Men's Apex Compression Tee in black",
    badge: "BESTSELLER",
    tag: PH,
  },
  {
    id: "m-002",
    slug: "grind-training-shorts",
    name: "Grind Training Shorts 7\"",
    gender: "men",
    category: "shorts",
    price: 5200,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Olive", hex: "#3F4A2E" },
    ],
    sizes: ["S", "M", "L", "XL"],
    image: mensShorts,
    imageAlt: "Men's Grind Training Shorts in black",
    tag: PH,
  },
  {
    id: "m-003",
    slug: "vault-heavyweight-hoodie",
    name: "Vault Heavyweight Hoodie",
    gender: "men",
    category: "outerwear",
    price: 9800,
    compareAt: 11800,
    colors: [
      { name: "Charcoal", hex: "#3A3A3A" },
      { name: "Black", hex: "#0A0A0A" },
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: mensHoodie,
    imageAlt: "Men's Vault Heavyweight Hoodie in charcoal",
    badge: "NEW",
    tag: PH,
  },
  {
    id: "m-004",
    slug: "rep-oversized-tee",
    name: "Rep Oversized Tee",
    gender: "men",
    category: "tees",
    price: 4200,
    colors: [
      { name: "Bone", hex: "#FAFAFA" },
      { name: "Black", hex: "#0A0A0A" },
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: mensTee,
    imageAlt: "Men's Rep Oversized Tee",
    tag: PH,
  },
  {
    id: "m-005",
    slug: "tempo-tech-jogger",
    name: "Tempo Tech Jogger",
    gender: "men",
    category: "bottoms",
    price: 8800,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Graphite", hex: "#4B4B4B" },
    ],
    sizes: ["S", "M", "L", "XL"],
    image: mensShorts,
    imageAlt: "Men's Tempo Tech Joggers",
    badge: "LOW STOCK",
    tag: PH,
  },
  {
    id: "m-006",
    slug: "core-seamless-tank",
    name: "Core Seamless Tank",
    gender: "men",
    category: "tops",
    price: 4400,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Lime", hex: "#C6FF00" },
    ],
    sizes: ["S", "M", "L", "XL"],
    image: mensTee,
    imageAlt: "Men's Core Seamless Tank",
    tag: PH,
  },

  // ============ WOMEN ============
  {
    id: "w-001",
    slug: "sculpt-high-waist-legging",
    name: "Sculpt High-Waist Legging 25\"",
    gender: "women",
    category: "leggings",
    price: 6800,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Graphite", hex: "#4B4B4B" },
      { name: "Mocha", hex: "#5A4231" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    image: womensLeggings,
    imageAlt: "Women's Sculpt High-Waist Legging in black",
    badge: "BESTSELLER",
    tag: PH,
  },
  {
    id: "w-002",
    slug: "pulse-seamless-bra",
    name: "Pulse Seamless Sports Bra",
    gender: "women",
    category: "bras",
    price: 4400,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Bone", hex: "#FAFAFA" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    image: womensBra,
    imageAlt: "Women's Pulse Seamless Sports Bra in black",
    tag: PH,
  },
  {
    id: "w-003",
    slug: "rep-cropped-tee",
    name: "Rep Cropped Training Tee",
    gender: "women",
    category: "tees",
    price: 3800,
    colors: [
      { name: "Heather Grey", hex: "#9C9C9C" },
      { name: "Black", hex: "#0A0A0A" },
    ],
    sizes: ["XS", "S", "M", "L"],
    image: womensTee,
    imageAlt: "Women's Rep Cropped Training Tee",
    badge: "NEW",
    tag: PH,
  },
  {
    id: "w-004",
    slug: "flow-bike-short",
    name: "Flow Bike Short 5\"",
    gender: "women",
    category: "shorts",
    price: 4200,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Olive", hex: "#3F4A2E" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    image: womensLeggings,
    imageAlt: "Women's Flow Bike Short",
    tag: PH,
  },
  {
    id: "w-005",
    slug: "vault-cropped-hoodie",
    name: "Vault Cropped Hoodie",
    gender: "women",
    category: "outerwear",
    price: 8800,
    colors: [
      { name: "Charcoal", hex: "#3A3A3A" },
      { name: "Bone", hex: "#FAFAFA" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    image: mensHoodie,
    imageAlt: "Women's Vault Cropped Hoodie",
    tag: PH,
  },
  {
    id: "w-006",
    slug: "tempo-flare-pant",
    name: "Tempo Flare Pant",
    gender: "women",
    category: "bottoms",
    price: 7800,
    compareAt: 9200,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Graphite", hex: "#4B4B4B" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    image: womensLeggings,
    imageAlt: "Women's Tempo Flare Pant",
    badge: "LOW STOCK",
    tag: PH,
  },
];

export const formatPrice = (cents: number) =>
  `$${(cents / 100).toFixed(2)}`;

export const getProductsByGender = (gender: Gender) =>
  products.filter((p) => p.gender === gender);

export const getProductBySlug = (slug: string) =>
  products.find((p) => p.slug === slug);
