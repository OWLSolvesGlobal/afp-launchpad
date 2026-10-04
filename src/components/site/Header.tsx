import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Instagram, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import afpLogo from "@/assets/afp-logo.png";
import { useCart } from "@/context/CartContext";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, PHONE_DISPLAY, waLink } from "@/lib/brand";
import { categorySlug, productImageUrl, useCatalog, visibleProducts } from "@/lib/catalog";

/**
 * Minimal header: a single menu button (3-bar), centered logo, cart.
 * All navigation lives in the full-screen menu, where the category list is
 * derived from the Sheet — women-first, never hardcoded.
 */
export const Header = ({ transparent = false }: { transparent?: boolean }) => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { count, openCart } = useCart();
  const { data: catalog } = useCatalog();

  const categories = (catalog?.categories ?? []).map((c) => ({
    to: `/collection/${categorySlug(c)}`,
    label: c,
  }));
  const announcement = catalog?.config.announcementBar ?? "";

  // One inviting image inside the menu (desktop) — the Sheet's hero pick,
  // else the first live product.
  const menuImage = useMemo(() => {
    const products = catalog ? visibleProducts(catalog.products) : [];
    const bySku = new Map(products.map((p) => [p.sku, p]));
    for (const sku of catalog?.config.heroOrder ?? []) {
      const p = bySku.get(sku);
      if (p?.image) return { src: productImageUrl(p.image), alt: p.imageAlt };
    }
    const first = products.find((p) => p.image);
    return first
      ? { src: productImageUrl(first.image), alt: first.imageAlt }
      : null;
  }, [catalog]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Lock page scroll and close on Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Always light header on the bone-white site
  void transparent;
  const elevated = scrolled;

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        elevated
          ? "bg-background/90 backdrop-blur-md text-foreground border-b border-border"
          : "bg-background text-foreground border-b border-transparent"
      )}
    >
      {announcement && (
        <div className="bg-ink text-bone text-center text-[11px] uppercase tracking-[0.24em] py-1.5 px-4 truncate">
          {announcement}
        </div>
      )}
      <div className="container relative flex items-center justify-between h-14 md:h-16">
        <button
          aria-label="Open menu"
          aria-expanded={open}
          className="group inline-flex items-center gap-3 p-2 -ml-2 hover:opacity-70 transition-opacity"
          onClick={() => setOpen(true)}
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
          <span className="hidden md:inline eyebrow">Menu</span>
        </button>

        <Link
          to="/"
          aria-label="Alo Fitness Pro — Home"
          className="absolute left-1/2 -translate-x-1/2 flex items-center"
        >
          <img src={afpLogo} alt="Alo Fitness Pro" className="h-8 md:h-10 w-auto" />
        </Link>

        <button
          aria-label={`Cart (${count} ${count === 1 ? "item" : "items"})`}
          onClick={openCart}
          className="group inline-flex items-center gap-3 p-2 -mr-2 hover:opacity-70 transition-opacity relative"
        >
          <span className="hidden md:inline eyebrow">Bag</span>
          <span className="relative">
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-accent text-bone text-[10px] font-medium min-w-4 h-4 px-1 grid place-items-center rounded-full">
                {count}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Full-screen menu — all viewports */}
      {open && (
        <div className="fixed inset-0 z-50 bg-background text-foreground overflow-y-auto animate-fade-up">
          <div className="container flex items-center justify-between h-14 md:h-16">
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-3 p-2 -ml-2 hover:opacity-70 transition-opacity"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
              <span className="hidden md:inline eyebrow">Close</span>
            </button>
            <Link
              to="/"
              aria-label="Alo Fitness Pro — Home"
              className="absolute left-1/2 -translate-x-1/2 flex items-center"
            >
              <img src={afpLogo} alt="Alo Fitness Pro" className="h-8 md:h-10 w-auto" />
            </Link>
            <span className="w-9" aria-hidden="true" />
          </div>

          <div className="container grid grid-cols-12 gap-8 md:gap-12 pt-10 md:pt-16 pb-16 min-h-[calc(100dvh-4rem)] content-start">
            <nav className="col-span-12 md:col-span-7 lg:col-span-6 flex flex-col">
              <div className="eyebrow text-accent mb-6">Shop</div>
              <div className="flex flex-col gap-4 md:gap-5">
                {[
                  { to: "/shop/women", label: "Women" },
                  { to: "/shop/men", label: "Men" },
                  ...categories,
                ].map((n, i) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    className="group flex items-baseline gap-4 w-fit animate-fade-up"
                    style={{ animationDelay: `${60 + i * 45}ms` }}
                  >
                    <span className="font-serif text-3xl md:text-5xl tracking-tight leading-none group-hover:italic group-hover:text-accent transition-colors">
                      {n.label}
                    </span>
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent" />
                  </Link>
                ))}
              </div>

              <div className="eyebrow text-graphite mt-12 mb-5">More</div>
              <div className="flex flex-col gap-3">
                {[
                  { to: "/about", label: "About" },
                  { to: "/faq", label: "FAQ" },
                  { to: "/contact", label: "Contact" },
                ].map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    className="w-fit text-sm uppercase tracking-[0.2em] text-graphite hover:text-accent transition-colors"
                  >
                    {n.label}
                  </Link>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-border flex flex-col gap-3">
                <a
                  href={waLink("Hi AFP! I'd like to place an order.")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 eyebrow text-graphite hover:text-accent transition-colors w-fit"
                >
                  <MessageCircle className="w-4 h-4" /> {PHONE_DISPLAY}
                </a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 eyebrow text-graphite hover:text-accent transition-colors w-fit"
                >
                  <Instagram className="w-4 h-4" /> {INSTAGRAM_HANDLE}
                </a>
              </div>
            </nav>

            {menuImage && (
              <Link
                to="/shop/women"
                className="hidden md:block md:col-span-5 lg:col-span-5 lg:col-start-8 group"
                aria-label="Shop the collection"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  <img
                    src={menuImage.src}
                    alt={menuImage.alt}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-card-hover" />
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-bone">
                    <span className="eyebrow">Shop the collection</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
