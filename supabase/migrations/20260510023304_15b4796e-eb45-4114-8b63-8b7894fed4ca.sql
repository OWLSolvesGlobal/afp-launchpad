-- Partner codes
create table public.partner_codes (
  code text primary key,
  influencer_user_id uuid not null,
  credit_value_cents integer not null check (credit_value_cents > 0),
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partner_codes enable row level security;

create policy "Admins manage partner codes"
on public.partner_codes for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Authenticated can read active codes"
on public.partner_codes for select to authenticated
using (active = true);

create trigger trg_partner_codes_updated_at
before update on public.partner_codes
for each row execute function public.update_updated_at_column();

-- Credit ledger (append-only)
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount_cents integer not null, -- positive = credit added, negative = spent
  reason text not null check (reason in ('earn_purchase','earn_referral','spend','expire','adjust')),
  order_ref text,
  source_code text,
  unlocks_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 months'),
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;

create index credit_ledger_user_idx on public.credit_ledger(user_id);

create policy "Users view own ledger"
on public.credit_ledger for select to authenticated
using (auth.uid() = user_id);

create policy "Admins view all ledger"
on public.credit_ledger for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins write ledger"
on public.credit_ledger for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'));

-- Balance helper
create or replace function public.available_credit_cents(_user_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(amount_cents), 0)::int
  from public.credit_ledger
  where user_id = _user_id
    and unlocks_at <= now()
    and expires_at > now();
$$;