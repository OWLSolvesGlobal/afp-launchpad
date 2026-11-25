import { hasProductPhoto, productImageUrl, type Product } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * A product's photo, or a branded tile when no photo exists yet.
 *
 * The tile shows the real product name and category. It never stands in a
 * generated or borrowed picture for a garment we have no photo of: a customer
 * must not buy from an image of something that is not the actual item.
 */
export function ProductImage({
  product,
  width,
  height,
  eager = false,
  size = "card",
  className,
}: {
  product: Pick<Product, "name" | "category" | "image" | "imageAlt">;
  width: number;
  height: number;
  eager?: boolean;
  size?: "card" | "hero";
  className?: string;
}) {
  if (hasProductPhoto(product.image)) {
    return (
      <img
        src={productImageUrl(product.image)}
        alt={product.imageAlt}
        loading={eager ? "eager" : "lazy"}
        width={width}
        height={height}
        className={cn("w-full h-full object-cover", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${product.name}. Photo coming soon.`}
      className="w-full h-full flex flex-col justify-between bg-muted p-4 md:p-6"
    >
      <span className="eyebrow text-graphite">{product.category}</span>
      <span
        className={cn(
          "font-serif leading-[1.05] tracking-tight text-foreground break-words",
          size === "hero" ? "text-4xl md:text-6xl" : "text-2xl md:text-3xl",
        )}
      >
        {product.name}
      </span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-graphite">
        Photo coming soon
      </span>
    </div>
  );
}
