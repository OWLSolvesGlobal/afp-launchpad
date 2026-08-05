/**
 * Brand constants, WhatsApp helpers, and the editorial product cards used by
 * the landing and collection pages.
 *
 * No product data lives here — the catalog comes exclusively from
 * /api/catalog (see src/lib/catalog.ts), which mirrors the Google Sheet.
 */
import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import {
  firstAvailableSize,
  formatBbd,
  isSoldOut,
  productImageUrl,
  sizeStock,
  type Product,
} from "@/lib/catalog";
import { Link } from "react-router-dom";

export const WA = "https://wa.me/12468364327";
export const waLink = (msg: string) => `${WA}?text=${encodeURIComponent(msg)}`;
// Off-palette turquoise — known, parked. See CLAUDE.md "Unresolved".
export const TURQUOISE = "#00b5e2";
export const LIME = "#c5e86c";

export function ProductCard({ p }: { p: Product }) {
  const soldOut = isSoldOut(p);
  const [size, setSize] = useState(firstAvailableSize(p) ?? p.sizes[0]);
  const msg = `Hi! I'd like to order the ${p.name} (Size: ${size})`;
  return (
    <article className="group rounded-3xl bg-white overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_40px_rgba(0,181,226,0.15)] transition-shadow flex flex-col">
      <Link
        to={`/product/${p.slug}`}
        className="relative aspect-[4/5] bg-neutral-50 overflow-hidden block"
        aria-label={`View ${p.name}`}
      >
        <img
          src={productImageUrl(p.image)}
          alt={p.imageAlt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {soldOut ? (
          <span className="absolute top-4 left-4 text-[10px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full bg-neutral-900 text-white">
            SOLD OUT
          </span>
        ) : (
          p.badge && (
            <span
              className="absolute top-4 left-4 text-[10px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full text-black"
              style={{ background: LIME }}
            >
              {p.badge}
            </span>
          )
        )}
      </Link>
      <div className="p-5 md:p-6 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-lg leading-tight">{p.name}</h3>
          <span className="text-sm font-bold whitespace-nowrap text-neutral-900">
            {formatBbd(p.priceCents)}
          </span>
        </div>

        {p.color && (
          <div className="text-xs text-neutral-500">{p.color}</div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {p.sizes.map((s) => {
            const out = sizeStock(p, s) === 0;
            return (
              <button
                key={s}
                onClick={() => setSize(s)}
                disabled={out}
                className={`min-w-[44px] h-9 px-3 rounded-full text-xs font-semibold border transition-all disabled:opacity-30 disabled:line-through disabled:cursor-not-allowed ${
                  size === s && !out
                    ? "border-black bg-black text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        {soldOut ? (
          <span className="mt-auto inline-flex items-center justify-center gap-2 h-12 rounded-full font-semibold bg-neutral-100 text-neutral-400 cursor-not-allowed">
            Sold Out
          </span>
        ) : (
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
        )}
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
