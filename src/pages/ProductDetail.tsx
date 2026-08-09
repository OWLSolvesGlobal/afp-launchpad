import { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Minus, Plus, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import {
  formatPrice,
  isSoldOut,
  productImageUrl,
  sizeStock,
  useProduct,
  useProducts,
} from "@/lib/catalog";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ProductDetailSkeleton } from "@/components/site/skeletons/ProductDetailSkeleton";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug);
  const { data: all } = useProducts();
  const { addItem } = useCart();

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product) return;
    document.title = `${product.name} — AFP Performance Apparel`;
    // One-size items don't need a size decision; pre-select it.
    setSelectedSize(product.sizes.length === 1 ? product.sizes[0] : "");
    setQty(1);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [product?.sku]);

  const related = useMemo(() => {
    if (!product) return [];
    return [...all]
      .filter((p) => p.sku !== product.sku)
      .sort((a, b) => {
        const aScore = (a.category === product.category ? 0 : 2) + (a.gender === product.gender ? 0 : 1);
        const bScore = (b.category === product.category ? 0 : 2) + (b.gender === product.gender ? 0 : 1);
        return aScore - bScore;
      })
      .slice(0, 4);
  }, [product?.sku, all]);

  if (isLoading) return <ProductDetailSkeleton />;
  if (!product) return <Navigate to="/" replace />;

  const soldOut = isSoldOut(product);
  const variantQty = selectedSize ? sizeStock(product, selectedSize) : 0;
  const lowStock = variantQty > 0 && variantQty < 5;
  const sizeSoldOut = !!selectedSize && variantQty <= 0;
  const shopGender = product.gender === "men" ? "men" : "women";

  const handleAdd = () => {
    if (soldOut) return;
    if (!selectedSize) {
      toast.error("Please select a size");
      return;
    }
    if (variantQty < qty) {
      toast.error(sizeSoldOut ? "Sold out in this size" : `Only ${variantQty} left`);
      return;
    }
    addItem(product, { size: selectedSize, quantity: qty });
    toast.success(`${product.name} added to bag`, {
      description: `${product.color ? `${product.color} · ` : ""}Size ${selectedSize} · Qty ${qty}`,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main id="main" className="pt-24 md:pt-28">
        {/* Breadcrumb */}
        <nav className="container py-4 text-xs text-graphite flex items-center gap-1.5">
          <Link to="/" className="hover:text-ink transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to={`/shop/${shopGender}`} className="hover:text-ink transition-colors capitalize">
            {shopGender}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-ink truncate">{product.name}</span>
        </nav>

        {/* Product */}
        <section className="container grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 pb-20">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="aspect-[4/5] overflow-hidden bg-muted relative">
              <img
                src={productImageUrl(product.image)}
                alt={product.imageAlt}
                width={1200}
                height={1500}
                className="w-full h-full object-cover"
              />
              {soldOut && (
                <span className="absolute top-3 left-3 font-stencil uppercase text-[10px] tracking-wider px-2 py-1 bg-ink text-bone">
                  Sold out
                </span>
              )}
            </div>
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:py-4"
          >
            {product.badge && !soldOut && (
              <span
                className={cn(
                  "inline-block font-stencil uppercase text-[10px] tracking-wider px-2 py-1 mb-4",
                  product.badge === "LOW STOCK" ? "bg-safety text-bone" : "bg-ink text-bone"
                )}
              >
                {product.badge}
              </span>
            )}

            <div className="eyebrow text-graphite mb-2 capitalize">
              {product.gender} · {product.category}
            </div>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl leading-tight mb-4">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-2xl font-medium">{formatPrice(product.priceCents)}</span>
              {product.compareAtCents && (
                <span className="text-base text-graphite line-through">
                  {formatPrice(product.compareAtCents)}
                </span>
              )}
            </div>

            {/* Owner-written copy from the Sheet's description column.
                Blank renders nothing — no placeholder text. */}
            {product.description && (
              <p className="text-sm text-graphite leading-relaxed mb-8 max-w-md whitespace-pre-line">
                {product.description}
              </p>
            )}

            {/* Color */}
            {product.color && (
              <div className="mb-6 flex items-center justify-between max-w-md">
                <span className="eyebrow">Color</span>
                <span className="text-xs text-graphite">{product.color}</span>
              </div>
            )}

            {/* Size — sold-out sizes stay visible but disabled */}
            <div className="mb-6">
              <div className="eyebrow mb-3">Size</div>
              <div
                className={cn(
                  "grid gap-2",
                  product.sizes.length === 1 ? "grid-cols-2" : "grid-cols-5"
                )}
              >
                {product.sizes.map((s) => {
                  const out = sizeStock(product, s) === 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      disabled={out}
                      className={cn(
                        "h-11 border text-sm font-medium transition-colors disabled:opacity-30 disabled:line-through disabled:cursor-not-allowed",
                        selectedSize === s
                          ? "bg-ink text-bone border-ink"
                          : "bg-background border-border hover:border-ink"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {selectedSize && lowStock && (
                <p className="mt-2 text-xs text-safety">Only {variantQty} left</p>
              )}
              {soldOut && (
                <p className="mt-2 text-xs text-graphite">
                  Sold out — message us on WhatsApp to hear when it's back.
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="mb-6">
              <div className="eyebrow mb-3">Quantity</div>
              <div className="inline-flex items-center border border-border">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-11 flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center text-sm font-medium">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(10, q + 1))}
                  className="w-10 h-11 flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={handleAdd}
              disabled={soldOut || sizeSoldOut}
              className="w-full bg-ink text-bone py-4 eyebrow hover:bg-safety transition-colors mb-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink"
            >
              {soldOut
                ? "Sold Out"
                : `Add to Bag — ${formatPrice(product.priceCents * qty)}`}
            </button>
            {!soldOut && (
              <Link
                to="/checkout"
                onClick={handleAdd}
                className="block w-full text-center border border-ink text-ink py-4 eyebrow hover:bg-ink hover:text-bone transition-colors"
              >
                Buy Now
              </Link>
            )}

            {/* Perks */}
            <div className="mt-8 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-graphite">
              <div className="flex items-start gap-2">
                <Truck className="w-4 h-4 mt-0.5 shrink-0 text-ink" />
                <div><div className="text-ink font-medium mb-0.5">Free shipping</div>On orders over BDS $300</div>
              </div>
              <div className="flex items-start gap-2">
                <RotateCcw className="w-4 h-4 mt-0.5 shrink-0 text-ink" />
                <div><div className="text-ink font-medium mb-0.5">30-day returns</div>No questions asked</div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-ink" />
                <div><div className="text-ink font-medium mb-0.5">Lifetime quality</div>Built to last</div>
              </div>
            </div>

            {/* Details accordion-lite */}
            <div className="mt-10 space-y-6">
              <div>
                <h2 className="eyebrow mb-2">Fabric & Care</h2>
                <p className="text-sm text-graphite leading-relaxed">
                  82% recycled polyester, 18% elastane. Machine wash cold, tumble dry low.
                  Do not bleach. Designed and tested by athletes.
                </p>
              </div>
              <div>
                <h2 className="eyebrow mb-2">Fit</h2>
                <p className="text-sm text-graphite leading-relaxed">
                  True to size. For a relaxed fit, size up.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Related */}
        {related.length > 0 && (
          <section className="container pb-24 border-t border-border pt-16">
            <div className="flex items-end justify-between mb-10">
              <h2 className="font-display text-2xl md:text-3xl">You may also like</h2>
              <Link
                to={`/shop/${shopGender}`}
                className="text-xs uppercase tracking-wider underline underline-offset-4 hover:text-safety"
              >
                Shop all
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {related.map((p, i) => (
                <ProductCard key={p.sku} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
