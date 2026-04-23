import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

interface Props {
  product: Product;
  index?: number;
}

export const ProductCard = ({ product, index = 0 }: Props) => {
  const { addItem } = useCart();

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast.success(`${product.name} added to bag`, {
      description: `${product.colors[0]?.name ?? ""} · ${product.sizes[Math.min(1, product.sizes.length - 1)] ?? "OS"}`,
    });
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <Link
        to={`/product/${product.slug}`}
        className="block card-lift bg-card"
        aria-label={`${product.name} — ${formatPrice(product.price)}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          <img
            src={product.image}
            alt={product.imageAlt}
            loading="lazy"
            width={800}
            height={1000}
            className="w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
          />

          {/* Placeholder tag — visible to admin/dev, easy to spot */}
          <span className="absolute top-2 left-2 bg-bone/90 backdrop-blur text-ink text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5">
            {product.tag}
          </span>

          {product.badge && (
            <span
              className={cn(
                "absolute top-2 right-2 font-stencil uppercase text-[10px] tracking-wider px-2 py-1",
                product.badge === "NEW" && "bg-bone text-ink",
                product.badge === "BESTSELLER" && "bg-ink text-bone",
                product.badge === "LOW STOCK" && "bg-safety text-bone"
              )}
            >
              {product.badge}
            </span>
          )}

          {/* Quick add bar — slides up on hover (desktop) */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out-expo hidden md:block">
            <button
              type="button"
              onClick={handleQuickAdd}
              className="w-full bg-ink text-bone py-3 eyebrow flex items-center justify-center gap-2 hover:bg-safety hover:text-bone transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Quick Add
            </button>
          </div>
        </div>

        <div className="pt-3 pb-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium truncate">{product.name}</h3>
            <div className="mt-1 flex items-center gap-1.5">
              {product.colors.slice(0, 4).map((c) => (
                <span
                  key={c.name}
                  title={c.name}
                  className="w-2.5 h-2.5 rounded-full border border-border"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {product.colors.length > 4 && (
                <span className="text-[10px] text-graphite">+{product.colors.length - 4}</span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-medium">{formatPrice(product.price)}</div>
            {product.compareAt && (
              <div className="text-xs text-graphite line-through">
                {formatPrice(product.compareAt)}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  );
};
