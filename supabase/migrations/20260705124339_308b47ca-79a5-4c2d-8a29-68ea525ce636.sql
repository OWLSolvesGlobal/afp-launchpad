
-- Hide raw stock quantities. Restrict base table reads to admins.
DROP POLICY IF EXISTS "Authenticated users can view stock" ON public.product_stock;

CREATE POLICY "Admins can view stock"
  ON public.product_stock FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public availability view exposes only booleans, never quantities.
CREATE OR REPLACE VIEW public.product_stock_availability AS
  SELECT product_id, size, color, (quantity > 0) AS in_stock
  FROM public.product_stock;

GRANT SELECT ON public.product_stock_availability TO anon, authenticated;
