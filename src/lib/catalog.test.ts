import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchCatalog, productImageUrl } from "@/lib/catalog";
import seed from "@/data/seed-catalog.json";
import worker, { KV_KEY, type Env } from "../../worker/index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCatalog — seed fallback", () => {
  it("returns the live snapshot when /api/catalog serves JSON", async () => {
    const snapshot = { ...seed, generatedAt: "2026-08-05T09:00:00.000Z" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(snapshot), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const out = await fetchCatalog();
    expect(out.generatedAt).toBe("2026-08-05T09:00:00.000Z");
  });

  it("falls back to the bundled seed when the endpoint errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const out = await fetchCatalog();
    expect(out.generatedAt).toBe(seed.generatedAt);
    expect(out.products).toHaveLength(19);
  });

  it("falls back when the dev server answers with index.html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
      ),
    );
    const out = await fetchCatalog();
    expect(out.generatedAt).toBe(seed.generatedAt);
  });

  it("falls back when fetch itself throws (offline)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network down"); }));
    const out = await fetchCatalog();
    expect(out.products).toHaveLength(19);
  });
});

describe("seed catalog contract", () => {
  it("ships every seed SKU inactive with price 0 — prices are never invented", () => {
    expect(seed.products).toHaveLength(19);
    for (const p of seed.products) {
      expect(p.priceCents).toBe(0);
      expect(p.active).toBe(false);
    }
  });

  it("derives no categories while nothing is purchasable", () => {
    expect(seed.categories).toEqual([]);
  });
});

describe("productImageUrl", () => {
  it("resolves a known asset filename to a bundled URL", () => {
    const url = productImageUrl("ashlee-pink.webp");
    expect(url).not.toBe("/placeholder.svg");
    expect(url).toContain("ashlee-pink");
  });

  it("falls back to the placeholder for blank or unknown filenames", () => {
    expect(productImageUrl("")).toBe("/placeholder.svg");
    expect(productImageUrl("no-such-file.webp")).toBe("/placeholder.svg");
  });
});

describe("worker /api/catalog — KV-empty seed fallback", () => {
  const request = new Request("https://afp.example/api/catalog");

  const envWith = (kv: Env["AFP_CATALOG"]): Env =>
    ({ ASSETS: { fetch: vi.fn() } as unknown as Env["ASSETS"], AFP_CATALOG: kv });

  it("serves the bundled seed when KV has no snapshot", async () => {
    const kv = { get: vi.fn(async () => null) } as unknown as NonNullable<Env["AFP_CATALOG"]>;
    const res = await worker.fetch(request, envWith(kv));
    expect(res.headers.get("x-afp-catalog-source")).toBe("seed");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    const body = await res.json();
    expect(body.products).toHaveLength(19);
  });

  it("serves the bundled seed when the KV binding is missing entirely", async () => {
    const res = await worker.fetch(request, envWith(undefined));
    expect(res.headers.get("x-afp-catalog-source")).toBe("seed");
    const body = await res.json();
    expect(body.generatedAt).toBe(seed.generatedAt);
  });

  it("serves the stored snapshot once the sync has written one", async () => {
    const stored = JSON.stringify({ ...seed, generatedAt: "2026-08-05T10:05:00.000Z" });
    const kv = { get: vi.fn(async (key: string) => (key === KV_KEY ? stored : null)) };
    const res = await worker.fetch(request, envWith(kv as unknown as NonNullable<Env["AFP_CATALOG"]>));
    expect(res.headers.get("x-afp-catalog-source")).toBe("kv");
    const body = await res.json();
    expect(body.generatedAt).toBe("2026-08-05T10:05:00.000Z");
  });

  it("passes every other path through to static assets untouched", async () => {
    const assetResponse = new Response("asset");
    const assets = { fetch: vi.fn(async () => assetResponse) };
    const env: Env = { ASSETS: assets as unknown as Env["ASSETS"] };
    const req = new Request("https://afp.example/shop/women");
    const res = await worker.fetch(req, env);
    expect(assets.fetch).toHaveBeenCalledWith(req);
    expect(res).toBe(assetResponse);
  });
});
