
-- Drop the broad SELECT policy; public buckets serve files via getPublicUrl without needing this.
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;

-- has_role is intended to be called from RLS policies (which run as the table owner) and from
-- authenticated server-side code only. Revoke direct execute from anon.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
