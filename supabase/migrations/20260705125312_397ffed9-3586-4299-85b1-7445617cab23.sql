
CREATE OR REPLACE FUNCTION public.available_credit_cents(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_cents), 0)::int
  FROM public.credit_ledger
  WHERE user_id = _user_id
    AND _user_id = auth.uid()
    AND unlocks_at <= now()
    AND expires_at > now();
$$;

REVOKE ALL ON FUNCTION public.available_credit_cents(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.available_credit_cents(uuid) TO authenticated, service_role;
