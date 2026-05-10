
-- Allow-list of emails that auto-receive the admin role on signup
create table if not exists public.admin_allowlist (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

create policy "Admins can manage allowlist"
on public.admin_allowlist
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Seed the owner
insert into public.admin_allowlist (email, note)
values ('ashlee_lowe@yahoo.com', 'Owner — auto admin on signup')
on conflict (email) do nothing;

-- Trigger function: on new auth user, if email is allow-listed, grant admin
create or replace function public.handle_new_user_admin_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.admin_allowlist
    where lower(email) = lower(new.email)
  ) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_admin_grant on auth.users;
create trigger on_auth_user_created_admin_grant
after insert on auth.users
for each row execute function public.handle_new_user_admin_grant();

-- Also retro-grant if Ashlee already exists in auth.users (no-op otherwise)
insert into public.user_roles (user_id, role)
select u.id, 'admin'::app_role
from auth.users u
join public.admin_allowlist a on lower(a.email) = lower(u.email)
on conflict (user_id, role) do nothing;
