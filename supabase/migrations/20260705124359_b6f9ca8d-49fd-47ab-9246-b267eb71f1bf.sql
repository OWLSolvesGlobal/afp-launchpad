
DROP VIEW IF EXISTS public.product_stock_availability;

CREATE OR REPLACE FUNCTION public.get_product_availability(_product_id text)
RETURNS TABLE (size text, color text, in_stock boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT size, color, (quantity > 0) AS in_stock
  FROM public.product_stock
  WHERE product_id = _product_id;
$$;

REVOKE ALL ON FUNCTION public.get_product_availability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_availability(text) TO anon, authenticated;
