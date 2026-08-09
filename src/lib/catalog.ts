/**
 * Catalog data layer for the storefront.
 *
 * The site reads one thing: the JSON snapshot at /api/catalog (served by the
 * site Worker from KV, refreshed from the Google Sheet every 5 minutes). It
 * never talks to Google directly. If the endpoint is unavailable — local dev
 * without the Worker, or a brand-new deployment with an empty KV — the
 * bundled seed snapshot keeps the site rendering instead of white-screening.
 */
import { useQuery } from "@tanstack/react-query";
import {
  type CatalogProduct,
  type CatalogSnapshot,
  visibleProducts,
} from "@/lib/catalog-core";
import seedCatalog from "@/data/seed-catalog.json";

// Lives in public/, copied to the site root verbatim — not a bundled asset.
const placeholder = "/placeholder.svg";

export type { CatalogProduct as Product, CatalogSnapshot, Gender } from "@/lib/catalog-core";
export {
  categorySlug,
  deriveCategories,
  firstAvailableSize,
  formatBbd,
  formatBbd as formatPrice,
  isPurchasable,
  isSoldOut,
  makeOrderId,
  newOrderId,
  sizeStock,
  totalStock,
  visibleProducts,
} from "@/lib/catalog-core";

const seed = seedCatalog as unknown as CatalogSnapshot;

// The Sheet's `image` column holds a filename from src/assets (never a URL).
// Vite fingerprints those files at build time; this registry maps the plain
// filename back to the hashed URL that actually exists in the bundle.
const assetUrls = import.meta.glob("../assets/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const assetsByName: Record<string, string> = {};
for (const [path, url] of Object.entries(assetUrls)) {
  const base = path.split("/").pop();
  if (base) assetsByName[base] = url;
}

/** Resolve a Sheet image filename to a servable URL, or the placeholder. */
export function productImageUrl(filename: string): string {
  return (filename && assetsByName[filename]) || placeholder;
}

export async function fetchCatalog(): Promise<CatalogSnapshot> {
  try {
    const res = await fetch("/api/catalog", { headers: { accept: "application/json" } });
    const contentType = res.headers.get("content-type") ?? "";
    // The Vite dev server has no /api route and answers with index.html; treat
    // that (and any error status) as "endpoint unavailable" and use the seed.
    if (!res.ok || !contentType.includes("json")) throw new Error(`unavailable: ${res.status}`);
    const snapshot = (await res.json()) as CatalogSnapshot;
    if (!Array.isArray(snapshot.products)) throw new Error("malformed snapshot");
    return snapshot;
  } catch {
    return seed;
  }
}

export const useCatalog = () =>
  useQuery({
    queryKey: ["catalog"],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });

/** Purchasable products only — active with a real price. */
export const useProducts = () => {
  const query = useCatalog();
  return { ...query, data: query.data ? visibleProducts(query.data.products) : [] };
};

/** Look up one purchasable product by slug (or sku, case-insensitive). */
export const useProduct = (slug: string | undefined) => {
  const query = useCatalog();
  let product: CatalogProduct | null = null;
  if (slug && query.data) {
    const needle = slug.toLowerCase();
    product =
      visibleProducts(query.data.products).find(
        (p) => p.slug === needle || p.sku.toLowerCase() === needle,
      ) ?? null;
  }
  return { ...query, data: product };
};
