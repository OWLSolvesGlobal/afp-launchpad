import { describe, it, expect, vi } from "vitest";
import {
  buildLoyverseSnapshot,
  deriveGender,
  normaliseSize,
  variantPriceCents,
  ONE_SIZE,
  type LoyverseItem,
  type SiteSettings,
} from "@/lib/loyverse-core";
import { isPurchasable, visibleProducts } from "@/lib/catalog-core";
import worker, { fetchAllPages, syncCatalog, KV_KEY, STATUS_KEY } from "../../worker/index";
import siteSettings from "@/data/site-settings.json";

const fixed = (id: string, size: string | null, price: number) => ({
  variant_id: id,
  option1_value: size,
  default_pricing_type: "FIXED",
  default_price: price,
});
const variable = (id: string, size: string) => ({
  variant_id: id,
  option1_value: size,
  default_pricing_type: "VARIABLE",
  default_price: null,
});

const CATEGORIES = [
  { id: "c-romp", name: "Rompers" },
  { id: "c-add", name: "Add Ons" },
  { id: "c-vest", name: "Vests" },
];
const SETTINGS: SiteSettings = { accessoryCategories: ["Add Ons"], uncategorisedLabel: "More" };

const build = (
  items: LoyverseItem[],
  inventory: { variant_id: string; in_stock: number }[] = [],
  settings: SiteSettings = SETTINGS,
) => buildLoyverseSnapshot(items, CATEGORIES, inventory, settings, "2026-11-24T00:00:00.000Z");

describe("normaliseSize", () => {
  it("maps Loyverse size words to standard codes", () => {
    expect(normaliseSize("Large")).toBe("L");
    expect(normaliseSize("MEDIUM")).toBe("M");
    expect(normaliseSize("Smll")).toBe("S");
    expect(normaliseSize(" xs ")).toBe("XS");
    expect(normaliseSize("XL")).toBe("XL");
  });
  it("treats a blank option as one size", () => {
    expect(normaliseSize(null)).toBe(ONE_SIZE);
    expect(normaliseSize("")).toBe(ONE_SIZE);
  });
});

describe("variantPriceCents", () => {
  it("reads a fixed price as integer cents", () => {
    expect(variantPriceCents(fixed("v", "Small", 130))).toBe(13000);
    expect(variantPriceCents(fixed("v", "Small", 19.99))).toBe(1999);
  });
  it("never invents a price for Variable pricing", () => {
    expect(variantPriceCents(variable("v", "Small"))).toBe(0);
    expect(
      variantPriceCents({ variant_id: "v", default_pricing_type: "VARIABLE", default_price: 50 }),
    ).toBe(0);
  });
  it("falls back to a store-level fixed price", () => {
    expect(
      variantPriceCents({
        variant_id: "v",
        default_pricing_type: "VARIABLE",
        default_price: null,
        stores: [{ pricing_type: "FIXED", price: 90 }],
      }),
    ).toBe(9000);
  });
});

describe("deriveGender", () => {
  it("sorts items into men, women and accessories", () => {
    expect(deriveGender("Shorts Men’s Black", "Pants", SETTINGS)).toBe("men");
    expect(deriveGender("Jacket Men's White", "Jacket", SETTINGS)).toBe("men");
    expect(deriveGender("Women Jacket Black", "Jacket", SETTINGS)).toBe("women");
    expect(deriveGender("Babydoll Romper BLACK", "Rompers", SETTINGS)).toBe("women");
    expect(deriveGender("Socks", "Add Ons", SETTINGS)).toBe("unisex");
  });
  it("lets the settings file override the rule", () => {
    expect(deriveGender("Vest Powder Blue", "Vests", SETTINGS, "men")).toBe("men");
  });
});

describe("buildLoyverseSnapshot", () => {
  const romper: LoyverseItem = {
    id: "item-1",
    item_name: "Babydoll Romper TEAL",
    category_id: "c-romp",
    variants: [fixed("v-l", "Large", 130), fixed("v-m", "Medium", 130), fixed("v-s", "Small", 130)],
  };

  it("maps an item to one product with ordered sizes and stock", () => {
    const { snapshot } = build(
      [romper],
      [
        { variant_id: "v-l", in_stock: 0 },
        { variant_id: "v-m", in_stock: -1 },
        { variant_id: "v-s", in_stock: 2 },
      ],
    );
    const p = snapshot.products[0];
    expect(p.name).toBe("Babydoll Romper TEAL");
    expect(p.slug).toBe("babydoll-romper-teal");
    expect(p.category).toBe("Rompers");
    expect(p.gender).toBe("women");
    expect(p.priceCents).toBe(13000);
    expect(p.sizes).toEqual(["S", "M", "L"]);
    // Negative stock reads as sold out, never as negative or unlimited.
    expect(p.stock).toEqual({ S: 2, M: 0, L: 0 });
    expect(isPurchasable(p)).toBe(true);
    expect(snapshot.categories).toEqual(["Rompers"]);
  });

  it("keeps an item with only Variable prices off the site", () => {
    const { snapshot, warnings } = build([
      { id: "i", item_name: "Brown Butter Set", variants: [variable("a", "Small"), variable("b", "Large")] },
    ]);
    expect(snapshot.products[0].priceCents).toBe(0);
    expect(visibleProducts(snapshot.products)).toHaveLength(0);
    expect(warnings.join(" ")).toContain("no fixed price");
  });

  it("drops only the unpriced size when the rest are priced", () => {
    const { snapshot, warnings } = build([
      {
        id: "i",
        item_name: "Two Tone Leggings Set BLUE",
        variants: [fixed("a", "Small", 130), fixed("b", "Medium", 130), variable("c", "XL")],
      },
    ]);
    expect(snapshot.products[0].sizes).toEqual(["S", "M"]);
    expect(warnings.join(" ")).toContain("without a fixed price");
  });

  it("shows one price per product and leaves out sizes priced differently", () => {
    const { snapshot, warnings } = build([
      {
        id: "i",
        item_name: "Compressed Tee BLACK",
        variants: [fixed("a", "Small", 50), fixed("b", "Medium", 60), fixed("c", "Large", 60)],
      },
    ]);
    const p = snapshot.products[0];
    expect(p.priceCents).toBe(6000);
    expect(p.sizes).toEqual(["M", "L"]);
    expect(warnings.join(" ")).toContain("priced differently");
  });

  it("handles a single-variant item as one size", () => {
    const { snapshot } = build(
      [{ id: "i", item_name: "Towels", category_id: "c-add", variants: [fixed("t", null, 25)] }],
      [{ variant_id: "t", in_stock: 5 }],
    );
    const p = snapshot.products[0];
    expect(p.sizes).toEqual([ONE_SIZE]);
    expect(p.stock[ONE_SIZE]).toBe(5);
    expect(p.gender).toBe("unisex");
  });

  it("skips deleted items and deleted variants", () => {
    const { snapshot } = build([
      { ...romper, id: "gone", deleted_at: "2026-11-24T00:00:00Z" },
      {
        id: "kept",
        item_name: "Kept",
        variants: [fixed("a", "Small", 10), { ...fixed("b", "Large", 10), deleted_at: "x" }],
      },
    ]);
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].sizes).toEqual(["S"]);
  });

  it("applies website settings by item name, ignoring case", () => {
    const settings: SiteSettings = {
      ...SETTINGS,
      items: {
        "babydoll romper teal": { image: "x.webp", description: "Soft.", hidden: true },
        "No Such Item": { hidden: true },
      },
    };
    const { snapshot, warnings } = build([romper], [], settings);
    const p = snapshot.products[0];
    expect(p.image).toBe("x.webp");
    expect(p.description).toBe("Soft.");
    expect(p.active).toBe(false);
    expect(isPurchasable(p)).toBe(false);
    expect(warnings.join(" ")).toContain("no such item");
  });

  it("labels uncategorised items and keeps slugs unique", () => {
    const { snapshot } = build([
      { id: "aaaa1111", item_name: "Same Name", variants: [fixed("a", "Small", 10)] },
      { id: "bbbb2222", item_name: "Same Name", variants: [fixed("b", "Small", 10)] },
    ]);
    expect(snapshot.products.map((p) => p.category)).toEqual(["More", "More"]);
    expect(new Set(snapshot.products.map((p) => p.slug)).size).toBe(2);
  });

  it("keeps payment paths off unless literally true", () => {
    const { snapshot } = build([romper], [], {
      ...SETTINGS,
      config: { paymentsTransferEnabled: "yes" as unknown as boolean },
    });
    expect(snapshot.config.paymentsTransferEnabled).toBe(false);
    expect(snapshot.config.paymentsCardEnabled).toBe(false);
  });
});

describe("bundled site-settings.json", () => {
  it("only references photos that exist in src/assets", async () => {
    const files = Object.keys(import.meta.glob("../assets/*")).map((p) => p.split("/").pop());
    const items = (siteSettings as unknown as SiteSettings).items ?? {};
    for (const [name, s] of Object.entries(items)) {
      if (s.image) expect(files, `${name} -> ${s.image}`).toContain(s.image);
    }
  });
  // Bank QR code was switched on deliberately (25 Nov 2026). The card path is
  // a stub and must stay off until a processor is wired in and reviewed.
  it("ships with the card path off", () => {
    const c = (siteSettings as unknown as SiteSettings).config ?? {};
    expect(c.paymentsCardEnabled).toBe(false);
  });
});

describe("sync worker", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("follows the cursor through every page", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ items: [{ id: "1" }], cursor: "next" }))
      .mockResolvedValueOnce(json({ items: [{ id: "2" }] }));
    const rows = await fetchAllPages<{ id: string }>("items", "items", "t", fetchImpl as typeof fetch);
    expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(String(fetchImpl.mock.calls[1][0])).toContain("cursor=next");
    // Read-only: the sync must never send anything but GET.
    for (const call of fetchImpl.mock.calls) expect(call[1]?.method).toBeUndefined();
  });

  const makeKv = () => {
    const store = new Map<string, string>();
    return { store, kv: { put: async (k: string, v: string) => void store.set(k, v) } };
  };
  const route = (items: unknown[]) => async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/items")) return json({ items });
    if (url.includes("/categories")) return json({ categories: CATEGORIES });
    return json({ inventory_levels: [{ variant_id: "v-s", in_stock: 3 }] });
  };

  it("writes a snapshot to KV", async () => {
    const { store, kv } = makeKv();
    const items = [{ id: "i", item_name: "Capri Romper Blue", category_id: "c-romp", variants: [fixed("v-s", "Small", 140)] }];
    await syncCatalog({ AFPWebsite: "t", AFP_CATALOG: kv } as never, route(items) as typeof fetch);
    const snapshot = JSON.parse(store.get(KV_KEY) as string);
    expect(snapshot.products[0].priceCents).toBe(14000);
    expect(snapshot.products[0].stock.S).toBe(3);
  });

  it("keeps the last snapshot when Loyverse returns nothing or errors", async () => {
    const empty = makeKv();
    await syncCatalog({ AFPWebsite: "t", AFP_CATALOG: empty.kv } as never, route([]) as typeof fetch);
    expect(empty.store.has(KV_KEY)).toBe(false);

    const failing = makeKv();
    await syncCatalog(
      { AFPWebsite: "t", AFP_CATALOG: failing.kv } as never,
      (async () => json({}, 401)) as typeof fetch,
    );
    expect(failing.store.has(KV_KEY)).toBe(false);
  });

  it("never publishes an empty shop when no item comes out sellable", async () => {
    const { store, kv } = makeKv();
    const items = [{ id: "i", item_name: "Unpriced", variants: [variable("v-s", "Small")] }];
    await syncCatalog({ AFPWebsite: "t", AFP_CATALOG: kv } as never, route(items) as typeof fetch);
    expect(store.has(KV_KEY)).toBe(false);
    expect(JSON.parse(store.get(STATUS_KEY) as string).outcome).toBe("aborted");
  });

  it("calls nothing without a token and records why", async () => {
    const { store, kv } = makeKv();
    const fetchImpl = vi.fn();
    await syncCatalog({ AFP_CATALOG: kv } as never, fetchImpl as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(store.has(KV_KEY)).toBe(false);
    expect(JSON.parse(store.get(STATUS_KEY) as string).outcome).toBe("skipped");
  });

  it("reads the token from a Secrets Store binding", async () => {
    const { store, kv } = makeKv();
    const seen: string[] = [];
    const items = [{ id: "i", item_name: "Capri Romper Blue", category_id: "c-romp", variants: [fixed("v-s", "Small", 140)] }];
    const inner = route(items);
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String((init?.headers as Record<string, string>).authorization));
      return inner(input);
    }) as typeof fetch;
    await syncCatalog(
      { AFPWebsite: { get: async () => " store-token " }, AFP_CATALOG: kv } as never,
      fetchImpl,
    );
    expect(seen[0]).toBe("Bearer store-token");
    expect(store.has(KV_KEY)).toBe(true);
  });

  it("records it when the Secrets Store cannot be read", async () => {
    const { store, kv } = makeKv();
    const fetchImpl = vi.fn();
    await syncCatalog(
      { AFPWebsite: { get: async () => { throw new Error("secret not found"); } }, AFP_CATALOG: kv } as never,
      fetchImpl as typeof fetch,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.parse(store.get(STATUS_KEY) as string).detail).toContain("secret not found");
  });

  it("records a failed sync without leaking the token", async () => {
    const { store, kv } = makeKv();
    await syncCatalog(
      { AFPWebsite: "super-secret-token", AFP_CATALOG: kv } as never,
      (async () => json({ errors: ["nope"] }, 401)) as typeof fetch,
    );
    const raw = store.get(STATUS_KEY) as string;
    expect(JSON.parse(raw).outcome).toBe("failed");
    expect(JSON.parse(raw).detail).toContain("401");
    expect(raw).not.toContain("super-secret-token");
  });

  it("serves the latest status at /api/catalog/status", async () => {
    const kv = { get: async (k: string) => (k === STATUS_KEY ? '{"outcome":"ok"}' : null) };
    const res = await worker.fetch(
      new Request("https://x.test/api/catalog/status"),
      { AFP_CATALOG: kv, ASSETS: { fetch: async () => new Response("asset") } } as never,
    );
    expect(await res.json()).toEqual({ outcome: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
