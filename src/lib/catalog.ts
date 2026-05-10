import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import placeholder from "@/assets/product-mens-tee.jpg";

export type Gender = "men" | "women" | "unisex";

export interface Product {
  id: string;
  slug: string;
  name: string;
  gender: Gender;
  category: string;
  price: number; // cents
  compareAt?: number;
  colors: { name: string; hex: string }[];
  sizes: string[];
  image: string;
  imageAlt: string;
  badge?: string | null;
}

export interface StockEntry {
  size: string;
  color: string;
  quantity: number;
}

export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const mapProduct = (row: any): Product => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  gender: row.gender,
  category: row.category,
  price: row.price_cents,
  compareAt: row.compare_at_cents ?? undefined,
  colors: Array.isArray(row.colors) ? row.colors : [],
  sizes: Array.isArray(row.sizes) ? row.sizes : [],
  image: row.image_url || placeholder,
  imageAlt: row.image_alt || row.name,
  badge: row.badge ?? null,
});

export const useProducts = () =>
  useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapProduct);
    },
    staleTime: 60_000,
  });

export const useProduct = (slug: string | undefined) =>
  useQuery({
    queryKey: ["product", slug],
    enabled: !!slug,
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug!)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProduct(data) : null;
    },
    staleTime: 60_000,
  });

export const useStock = (productId: string | undefined) =>
  useQuery({
    queryKey: ["stock", productId],
    enabled: !!productId,
    queryFn: async (): Promise<StockEntry[]> => {
      const { data, error } = await supabase
        .from("product_stock")
        .select("size,color,quantity")
        .eq("product_id", productId!);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

/** Helpers for variant availability */
export const stockFor = (stock: StockEntry[], size: string, color: string) =>
  stock.find((s) => s.size === size && s.color === color)?.quantity ?? 0;

export const sizeAvailable = (stock: StockEntry[], size: string) =>
  stock.some((s) => s.size === size && s.quantity > 0);

export const colorAvailable = (stock: StockEntry[], color: string, size?: string) =>
  stock.some(
    (s) => s.color === color && s.quantity > 0 && (!size || s.size === size),
  );