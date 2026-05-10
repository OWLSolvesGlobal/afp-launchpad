
alter table public.products
  add column if not exists images text[] not null default array[]::text[];

create or replace function public.sync_product_primary_image()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.images is not null and array_length(new.images, 1) > 0 then
    new.image_url := new.images[1];
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_product_primary_image on public.products;
create trigger trg_sync_product_primary_image
before insert or update of images on public.products
for each row execute function public.sync_product_primary_image();

-- Backfill: seed images[] from existing image_url where missing
update public.products
set images = array[image_url]
where (images is null or array_length(images, 1) is null)
  and image_url is not null and image_url <> '';
