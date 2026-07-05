-- Restrict product_stock read access to authenticated users (hide inventory quantities from public/anon scrapers)
DROP POLICY IF EXISTS "Anyone can view stock" ON public.product_stock;
REVOKE SELECT ON public.product_stock FROM anon;
GRANT SELECT ON public.product_stock TO authenticated;
CREATE POLICY "Authenticated users can view stock"
  ON public.product_stock
  FOR SELECT
  TO authenticated
  USING (true);

-- Switch has_role() from SECURITY DEFINER to SECURITY INVOKER.
-- Safe because authenticated already has SELECT on user_roles, and the
-- "Users can view their own roles" RLS policy permits the auth.uid() = user_id
-- read that has_role performs.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;