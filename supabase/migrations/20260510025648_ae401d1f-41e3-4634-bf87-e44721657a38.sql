
CREATE TABLE public.influencer_profiles (
  user_id uuid PRIMARY KEY,
  full_name text,
  birthday date,
  instagram_handle text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage influencer profiles"
  ON public.influencer_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Influencers view own profile"
  ON public.influencer_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_influencer_profiles_updated_at
  BEFORE UPDATE ON public.influencer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
