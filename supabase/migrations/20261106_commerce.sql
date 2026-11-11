-- Migration additive AD Shop.
-- Ne remplace pas et ne modifie pas le schéma newsroom déjà exécuté.
-- À appliquer manuellement uniquement après validation du propriétaire.

begin;

create table if not exists public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.product_categories (name, slug, description, sort_order)
values
  ('Vêtements', 'vetements', 'Vêtements et pièces de sélection mode.', 1),
  ('Accessoires', 'accessoires', 'Accessoires et articles de clientes et clients.', 2),
  ('Nouveautés', 'editions-numeriques', 'Produits numériques à télécharger après achat.', 3)
on conflict (slug) do nothing;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  sku text unique,
  summary text not null default '',
  description text not null default '',
  product_type text not null check (product_type in ('physical', 'digital')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  price_xof integer not null check (price_xof >= 0),
  compare_at_price_xof integer check (compare_at_price_xof is null or compare_at_price_xof >= price_xof),
  inventory_tracked boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  name text not null default '',
  options jsonb not null default '{}'::jsonb,
  price_xof integer check (price_xof is null or price_xof >= 0),
  inventory_tracked boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.digital_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null default 'SN',
  region_name text not null,
  carrier_name text not null default '',
  shipping_fee_xof integer not null check (shipping_fee_xof >= 0),
  estimated_min_days integer check (estimated_min_days is null or estimated_min_days >= 0),
  estimated_max_days integer check (estimated_max_days is null or estimated_max_days >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, region_name),
  check (estimated_max_days is null or estimated_min_days is null or estimated_max_days >= estimated_min_days)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key text not null unique,
  customer_email text not null,
  customer_phone text not null,
  customer_name text not null,
  currency char(3) not null default 'XOF' check (currency = 'XOF'),
  subtotal_xof integer not null default 0 check (subtotal_xof >= 0),
  shipping_xof integer not null default 0 check (shipping_xof >= 0),
  total_xof integer not null default 0 check (total_xof >= 0),
  shipping_address jsonb,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'cancelled', 'refunded', 'failed')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_provider text,
  provider_reference text,
  provider_token text,
  provider_checkout_url text,
  paid_at timestamptz,
  inventory_released_at timestamptz,
  tracking_reference text,
  tracking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists provider_session_status text not null default 'none' check (provider_session_status in ('none', 'creating', 'created', 'failed')),
  add column if not exists provider_checkout_claim_id uuid,
  add column if not exists provider_checkout_started_at timestamptz;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_type text not null check (product_type in ('physical', 'digital')),
  product_name_snapshot text not null,
  variant_name_snapshot text not null default '',
  sku_snapshot text,
  unit_price_xof integer not null check (unit_price_xof >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total_xof integer not null check (line_total_xof >= 0),
  inventory_tracked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  amount_xof integer,
  currency char(3),
  processing_status text not null default 'received' check (processing_status in ('received', 'applied', 'rejected')),
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text not null default '',
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.digital_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  download_count integer not null default 0 check (download_count >= 0),
  max_downloads integer not null default 5 check (max_downloads between 1 and 100),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists products_catalog_idx on public.products (status, is_featured desc, created_at desc);
create index if not exists products_category_status_idx on public.products (category_id, status, created_at desc);
create index if not exists products_search_idx on public.products using gin (
  to_tsvector('french'::regconfig, coalesce(name, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(description, ''))
);
create index if not exists product_variants_product_active_idx on public.product_variants (product_id, is_active, sort_order);
create index if not exists product_images_product_order_idx on public.product_images (product_id, sort_order);
create index if not exists digital_assets_product_idx on public.digital_assets (product_id);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (payment_status, fulfillment_status, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists payment_events_order_idx on public.payment_events (order_id, received_at desc);
create index if not exists shipping_zones_active_idx on public.shipping_zones (country_code, is_active);

create or replace function public.set_store_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_categories_set_updated_at on public.product_categories;
create trigger product_categories_set_updated_at before update on public.product_categories
for each row execute function public.set_store_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_store_updated_at();
drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_store_updated_at();
drop trigger if exists shipping_zones_set_updated_at on public.shipping_zones;
create trigger shipping_zones_set_updated_at before update on public.shipping_zones
for each row execute function public.set_store_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_store_updated_at();

create or replace view public.storefront_products as
select
  p.id, p.category_id, p.name, p.slug, p.summary, p.description, p.product_type,
  p.price_xof, p.compare_at_price_xof, p.is_featured,
  (not p.inventory_tracked or p.stock_quantity > 0) as is_available,
  p.created_at, c.name as category_name, c.slug as category_slug
from public.products p
left join public.product_categories c on c.id = p.category_id
where p.status = 'published' and (c.id is null or c.is_active = true);

create or replace view public.storefront_variants as
select pv.id, pv.product_id, pv.sku, pv.name, pv.options, pv.price_xof, pv.sort_order
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.product_categories c on c.id = p.category_id
where pv.is_active = true and p.status = 'published' and (c.id is null or c.is_active = true);

create or replace view public.storefront_product_images as
select pi.id, pi.product_id, pi.storage_path, pi.alt_text, pi.sort_order
from public.product_images pi
join public.products p on p.id = pi.product_id
left join public.product_categories c on c.id = p.category_id
where p.status = 'published' and (c.id is null or c.is_active = true);

alter table public.store_admins enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.digital_assets enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;
alter table public.order_status_events enable row level security;
alter table public.digital_entitlements enable row level security;

revoke all on table public.store_admins, public.product_categories, public.products,
  public.product_variants, public.product_images, public.digital_assets, public.shipping_zones,
  public.orders, public.order_items, public.payment_events, public.order_status_events,
  public.digital_entitlements from public, anon, authenticated;
grant all privileges on table public.store_admins, public.product_categories, public.products,
  public.product_variants, public.product_images, public.digital_assets, public.shipping_zones,
  public.orders, public.order_items, public.payment_events, public.order_status_events,
  public.digital_entitlements to service_role;

grant select on public.storefront_products, public.storefront_variants,
  public.storefront_product_images to anon, authenticated;

create or replace function public.create_store_order(
  p_idempotency_key text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_name text,
  p_country_code text,
  p_shipping_address jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_existing public.orders%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_line jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price integer;
  v_line_total integer;
  v_subtotal integer := 0;
  v_shipping integer := 0;
  v_has_physical boolean := false;
  v_inventory_tracked boolean;
  v_variant_name text;
  v_sku text;
  v_country text;
  v_region text;
begin
  if length(coalesce(p_idempotency_key, '')) < 16 or length(p_idempotency_key) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if coalesce(p_customer_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_EMAIL';
  end if;
  if length(coalesce(p_customer_phone, '')) < 7 or length(p_customer_phone) > 32 then
    raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_PHONE';
  end if;
  if length(coalesce(p_customer_name, '')) < 2 or length(p_customer_name) > 160 then
    raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_NAME';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception using errcode = '22023', message = 'INVALID_CART_ITEMS';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'subtotal_xof', v_existing.subtotal_xof, 'shipping_xof', v_existing.shipping_xof,
      'total_xof', v_existing.total_xof, 'payment_status', v_existing.payment_status
    );
  end if;

  v_country := upper(coalesce(nullif(p_country_code, ''), 'SN'));
  if v_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'INVALID_COUNTRY_CODE';
  end if;
  v_order_number := 'SP-' || to_char(now() at time zone 'UTC', 'YYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.orders (
    order_number, idempotency_key, customer_email, customer_phone, customer_name,
    currency, shipping_address
  ) values (
    v_order_number, p_idempotency_key, lower(trim(p_customer_email)), trim(p_customer_phone),
    trim(p_customer_name), 'XOF', p_shipping_address
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_items) as items(value) loop
    begin
      v_product_id := (v_line ->> 'product_id')::uuid;
      v_variant_id := nullif(v_line ->> 'variant_id', '')::uuid;
      v_quantity := (v_line ->> 'quantity')::integer;
    exception when others then
      raise exception using errcode = '22023', message = 'INVALID_CART_ITEM';
    end;
    if v_quantity < 1 or v_quantity > 10 then
      raise exception using errcode = '22023', message = 'INVALID_QUANTITY';
    end if;

    select p.* into v_product
    from public.products p
    where p.id = v_product_id and p.status = 'published'
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE';
    end if;

    if v_variant_id is not null then
      select pv.* into v_variant
      from public.product_variants pv
      where pv.id = v_variant_id and pv.product_id = v_product.id and pv.is_active = true
      for update;
      if not found then
        raise exception using errcode = 'P0001', message = 'VARIANT_UNAVAILABLE';
      end if;
      v_unit_price := coalesce(v_variant.price_xof, v_product.price_xof);
      v_inventory_tracked := v_variant.inventory_tracked;
      v_variant_name := v_variant.name;
      v_sku := v_variant.sku;
      if v_inventory_tracked then
        if v_variant.stock_quantity < v_quantity then
          raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
        end if;
        update public.product_variants set stock_quantity = stock_quantity - v_quantity where id = v_variant.id;
      end if;
    else
      if exists (select 1 from public.product_variants pv where pv.product_id = v_product.id and pv.is_active = true) then
        raise exception using errcode = 'P0001', message = 'VARIANT_REQUIRED';
      end if;
      v_unit_price := v_product.price_xof;
      v_inventory_tracked := v_product.inventory_tracked;
      v_variant_name := '';
      v_sku := v_product.sku;
      if v_inventory_tracked then
        if v_product.stock_quantity < v_quantity then
          raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
        end if;
        update public.products set stock_quantity = stock_quantity - v_quantity where id = v_product.id;
      end if;
    end if;

    v_line_total := v_unit_price * v_quantity;
    v_subtotal := v_subtotal + v_line_total;
    v_has_physical := v_has_physical or v_product.product_type = 'physical';
    insert into public.order_items (
      order_id, product_id, variant_id, product_type, product_name_snapshot,
      variant_name_snapshot, sku_snapshot, unit_price_xof, quantity, line_total_xof, inventory_tracked
    ) values (
      v_order_id, v_product.id, v_variant_id, v_product.product_type, v_product.name,
      v_variant_name, v_sku, v_unit_price, v_quantity, v_line_total, v_inventory_tracked
    );
  end loop;

  if v_has_physical then
    if coalesce(jsonb_typeof(p_shipping_address), '') <> 'object'
       or length(coalesce(p_shipping_address ->> 'address_line1', '')) < 4
       or length(coalesce(p_shipping_address ->> 'city', '')) < 2 then
      raise exception using errcode = '22023', message = 'SHIPPING_ADDRESS_REQUIRED';
    end if;
    v_region := coalesce(nullif(trim(p_shipping_address ->> 'region'), ''), trim(p_shipping_address ->> 'city'));
    select z.shipping_fee_xof into v_shipping
    from public.shipping_zones z
    where z.country_code = v_country and z.is_active = true
      and (z.region_name = '*' or lower(z.region_name) = lower(v_region))
    order by (z.region_name = '*') asc
    limit 1;
    if v_shipping is null then
      raise exception using errcode = 'P0001', message = 'SHIPPING_NOT_CONFIGURED';
    end if;
  end if;

  update public.orders
  set subtotal_xof = v_subtotal, shipping_xof = v_shipping, total_xof = v_subtotal + v_shipping
  where id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_number,
    'subtotal_xof', v_subtotal, 'shipping_xof', v_shipping,
    'total_xof', v_subtotal + v_shipping, 'payment_status', 'pending'
  );
end;
$$;

create or replace function public.cancel_store_order(p_order_id uuid, p_note text default 'Commande annulée')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.payment_status <> 'pending' then
    return jsonb_build_object('cancelled', false, 'payment_status', v_order.payment_status);
  end if;
  if v_order.inventory_released_at is null then
    for v_item in select * from public.order_items where order_id = v_order.id loop
      if v_item.inventory_tracked then
        if v_item.variant_id is not null then
          update public.product_variants set stock_quantity = stock_quantity + v_item.quantity where id = v_item.variant_id;
        elsif v_item.product_id is not null then
          update public.products set stock_quantity = stock_quantity + v_item.quantity where id = v_item.product_id;
        end if;
      end if;
    end loop;
  end if;
  update public.orders
  set payment_status = 'cancelled', fulfillment_status = 'cancelled', provider_session_status = 'failed',
      inventory_released_at = coalesce(inventory_released_at, now())
  where id = v_order.id;
  insert into public.order_status_events (order_id, from_status, to_status, note)
  values (v_order.id, v_order.fulfillment_status, 'cancelled', left(coalesce(p_note, ''), 500));
  return jsonb_build_object('cancelled', true, 'payment_status', 'cancelled');
end;
$$;

create or replace function public.claim_paytech_checkout(p_order_id uuid)
returns table(claimed boolean, claim_id uuid, checkout_url text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_claim_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.payment_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PAYABLE';
  end if;
  if v_order.provider_checkout_url is not null then
    return query select false, v_order.provider_checkout_claim_id, v_order.provider_checkout_url;
    return;
  end if;
  if v_order.provider_session_status = 'creating' then
    return query select false, v_order.provider_checkout_claim_id, null::text;
    return;
  end if;
  if v_order.provider_session_status = 'created' then
    raise exception using errcode = 'P0001', message = 'PAYTECH_SESSION_STATE_CORRUPT';
  end if;

  v_claim_id := gen_random_uuid();
  update public.orders
  set provider_session_status = 'creating', provider_checkout_claim_id = v_claim_id,
      provider_checkout_started_at = now(), payment_provider = 'paytech', provider_reference = order_number
  where id = v_order.id;
  return query select true, v_claim_id, null::text;
end;
$$;

create or replace function public.apply_paytech_event(
  p_order_number text,
  p_provider_event_id text,
  p_event_type text,
  p_amount_xof integer,
  p_currency text,
  p_provider_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_event_id uuid;
  v_event_status text;
  v_item public.order_items%rowtype;
begin
  if p_event_type not in ('sale_complete', 'sale_canceled', 'refund_complete') then
    raise exception using errcode = '22023', message = 'UNSUPPORTED_PAYMENT_EVENT';
  end if;
  select * into v_order from public.orders where order_number = p_order_number for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  insert into public.payment_events (
    order_id, provider, provider_event_id, event_type, amount_xof, currency, payload
  ) values (
    v_order.id, 'paytech', p_provider_event_id, p_event_type,
    p_amount_xof, upper(coalesce(p_currency, '')), coalesce(p_payload, '{}'::jsonb)
  ) on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    select processing_status into v_event_status
    from public.payment_events
    where provider = 'paytech' and provider_event_id = p_provider_event_id;
    return jsonb_build_object(
      'accepted', v_event_status = 'applied', 'duplicate', true,
      'payment_status', v_order.payment_status,
      'reason', case when v_event_status = 'rejected' then 'PREVIOUSLY_REJECTED' else null end
    );
  end if;

  if v_order.provider_session_status <> 'created'
     or nullif(p_provider_token, '') is distinct from v_order.provider_token then
    update public.payment_events set processing_status = 'rejected', processed_at = now() where id = v_event_id;
    return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', 'CHECKOUT_SESSION_MISMATCH');
  end if;

  if p_event_type = 'sale_complete' then
    if upper(coalesce(p_currency, '')) <> 'XOF' or p_amount_xof is null or p_amount_xof <> v_order.total_xof then
      update public.payment_events set processing_status = 'rejected', processed_at = now() where id = v_event_id;
      return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', 'AMOUNT_OR_CURRENCY_MISMATCH');
    end if;
    if v_order.payment_status = 'paid' then
      update public.payment_events set processing_status = 'rejected', processed_at = now() where id = v_event_id;
      return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', 'ORDER_ALREADY_PAID');
    end if;
    if v_order.payment_status = 'pending' then
      update public.orders
      set payment_status = 'paid', payment_provider = 'paytech', provider_reference = p_order_number,
          provider_token = nullif(p_provider_token, ''), paid_at = now()
      where id = v_order.id;
      insert into public.digital_entitlements (order_item_id)
      select oi.id from public.order_items oi
      where oi.order_id = v_order.id and oi.product_type = 'digital'
      on conflict (order_item_id) do nothing;
    elsif v_order.payment_status <> 'paid' then
      update public.payment_events set processing_status = 'rejected', processed_at = now() where id = v_event_id;
      return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', 'ORDER_NOT_PAYABLE');
    end if;
  elsif p_event_type = 'sale_canceled' then
    if v_order.payment_status <> 'pending' then
      update public.payment_events set processing_status = 'rejected', processed_at = now() where id = v_event_id;
      return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', 'ORDER_NOT_CANCELLABLE');
    end if;
    if v_order.inventory_released_at is null then
      for v_item in select * from public.order_items where order_id = v_order.id loop
        if v_item.inventory_tracked then
          if v_item.variant_id is not null then
            update public.product_variants set stock_quantity = stock_quantity + v_item.quantity where id = v_item.variant_id;
          elsif v_item.product_id is not null then
            update public.products set stock_quantity = stock_quantity + v_item.quantity where id = v_item.product_id;
          end if;
        end if;
      end loop;
    end if;
    update public.orders
    set payment_status = 'cancelled', fulfillment_status = 'cancelled', provider_session_status = 'failed',
        inventory_released_at = coalesce(inventory_released_at, now())
    where id = v_order.id;
  elsif p_event_type = 'refund_complete' then
    if v_order.payment_status <> 'paid' then
      update public.payment_events set processing_status = 'rejected', processed_at = now() where id = v_event_id;
      return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', 'ORDER_NOT_REFUNDABLE');
    end if;
    update public.orders set payment_status = 'refunded' where id = v_order.id;
  end if;

  update public.payment_events set processing_status = 'applied', processed_at = now() where id = v_event_id;
  select * into v_order from public.orders where id = v_order.id;
  return jsonb_build_object('accepted', true, 'duplicate', false, 'payment_status', v_order.payment_status);
end;
$$;

revoke all on function public.create_store_order(text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.cancel_store_order(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_paytech_checkout(uuid) from public, anon, authenticated;
revoke all on function public.apply_paytech_event(text, text, text, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_store_order(text, text, text, text, text, jsonb, jsonb) to service_role;
grant execute on function public.cancel_store_order(uuid, text) to service_role;
grant execute on function public.claim_paytech_checkout(uuid) to service_role;
grant execute on function public.apply_paytech_event(text, text, text, integer, text, text, jsonb) to service_role;

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('product-images', 'product-images', true, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('digital-files', 'digital-files', false, array['application/pdf', 'application/zip', 'application/epub+zip', 'audio/mpeg', 'audio/mp4', 'video/mp4'])
on conflict (id) do update set public = false, allowed_mime_types = excluded.allowed_mime_types;

commit;
