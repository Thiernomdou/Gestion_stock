-- =====================================================================
-- 0001_init.sql — Schéma initial multi-tenant
-- Quincaillerie : plomberie · électricité · luminaires
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.member_role     as enum ('owner','manager','cashier','storekeeper');
create type public.movement_type   as enum ('opening','purchase','sale','sale_cancel','customer_return',
                                            'adjustment','loss','transfer_in','transfer_out');
create type public.sale_status     as enum ('completed','cancelled');
create type public.purchase_status as enum ('draft','ordered','received','cancelled');
create type public.payment_kind    as enum ('sale','credit_repayment','refund');

-- ---------------------------------------------------------------------
-- Organisations et membres
-- ---------------------------------------------------------------------
create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  currency        text not null default 'GNF',
  timezone        text not null default 'Africa/Conakry',
  country         text not null default 'GN',
  phone           text,
  address         text,
  logo_url        text,
  settings        jsonb not null default jsonb_build_object(
                    'payment_methods', jsonb_build_array('cash','orange_money','mtn_momo','bank'),
                    'units', jsonb_build_array('pièce','mètre','rouleau','carton','paquet','lot'),
                    'allow_negative_stock', true,
                    'cashier_can_discount', false,
                    'max_discount_percent', 10,
                    'receipt', jsonb_build_object('width_mm', 80, 'header', '', 'footer', 'Merci de votre confiance'),
                    'expense_categories', jsonb_build_array('Loyer','Salaires','Électricité / carburant','Transport','Téléphone / internet','Divers')
                  ),
  plan            text not null default 'pilot',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  role            public.member_role not null default 'cashier',
  display_name    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Invitations : le patron invite une adresse e-mail avec un rôle ; la personne
-- rejoint l'organisation en se connectant avec cette adresse (accept_invitations).
create table public.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  email           text not null check (email = lower(trim(email)) and email like '%_@_%'),
  role            public.member_role not null default 'cashier',
  display_name    text,
  invited_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  accepted_by     uuid
);
create unique index organization_invitations_pending_uq
  on public.organization_invitations (organization_id, email) where accepted_at is null;

-- Fonctions d'aide pour la RLS
create or replace function public.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members
                 where organization_id = p_org and user_id = auth.uid() and is_active);
$$;

create or replace function public.has_role(p_org uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members
                 where organization_id = p_org and user_id = auth.uid() and is_active
                   and role = any(p_roles));
$$;

create or replace function public.is_owner(p_org uuid) returns boolean
language sql stable set search_path = public as $$ select public.has_role(p_org, array['owner']::public.member_role[]); $$;

create or replace function public.is_manager(p_org uuid) returns boolean
language sql stable set search_path = public as $$ select public.has_role(p_org, array['owner','manager']::public.member_role[]); $$;

create or replace function public.can_stock(p_org uuid) returns boolean
language sql stable set search_path = public as $$ select public.has_role(p_org, array['owner','manager','storekeeper']::public.member_role[]); $$;

-- ---------------------------------------------------------------------
-- Référentiels
-- ---------------------------------------------------------------------
create table public.stores (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name            text not null,
  address         text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  parent_id       uuid references public.categories on delete set null,
  name            text not null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  category_id     uuid references public.categories on delete set null,
  sku             text,
  barcode         text,
  name            text not null,
  description     text,
  brand           text,
  unit            text not null default 'pièce',
  allow_decimal_qty boolean not null default false,
  sale_price      bigint not null default 0 check (sale_price >= 0),
  wholesale_price bigint check (wholesale_price >= 0),
  min_stock       numeric(14,3) not null default 0,
  photo_url       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index products_org_sku_uq     on public.products (organization_id, sku)     where sku is not null;
create unique index products_org_barcode_uq on public.products (organization_id, barcode) where barcode is not null;
create index products_org_name_idx on public.products (organization_id, lower(name));

-- Coûts : table séparée, lisible uniquement par owner/manager
create table public.product_costs (
  product_id      uuid primary key references public.products on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  avg_cost        numeric(18,2) not null default 0,
  last_cost       numeric(18,2),
  updated_at      timestamptz not null default now()
);

create table public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name            text not null,
  country         text,
  city            text,
  currency        text not null default 'GNF',
  phone           text,
  wechat          text,
  email           text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name            text not null,
  phone           text,
  customer_type   text not null default 'particulier', -- particulier | artisan | entreprise
  credit_limit    bigint,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index customers_org_idx on public.customers (organization_id, lower(name));

-- ---------------------------------------------------------------------
-- Mouvements de stock (seule source de vérité du stock)
-- ---------------------------------------------------------------------
create table public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  store_id        uuid not null references public.stores,
  product_id      uuid not null references public.products,
  type            public.movement_type not null,
  quantity        numeric(14,3) not null check (quantity <> 0), -- signé : + entrée, - sortie
  reference_type  text,   -- 'sale' | 'purchase' | 'inventory' | 'manual'
  reference_id    uuid,
  note            text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
create index stock_mov_product_idx on public.stock_movements (organization_id, product_id, store_id);
create index stock_mov_date_idx    on public.stock_movements (organization_id, created_at);

-- ---------------------------------------------------------------------
-- Journées de caisse
-- ---------------------------------------------------------------------
create table public.cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  store_id        uuid not null references public.stores,
  status          text not null default 'open' check (status in ('open','closed')),
  opened_by       uuid default auth.uid(),
  opened_at       timestamptz not null default now(),
  opening_float   bigint not null default 0,
  closed_by       uuid,
  closed_at       timestamptz,
  expected_cash   bigint,
  counted_cash    bigint,
  difference      bigint,
  notes           text
);
create unique index cash_sessions_one_open_per_store on public.cash_sessions (store_id) where status = 'open';

-- ---------------------------------------------------------------------
-- Ventes
-- ---------------------------------------------------------------------
create table public.sales (
  id              uuid primary key,                       -- généré côté client (hors ligne)
  organization_id uuid not null references public.organizations on delete cascade,
  store_id        uuid not null references public.stores,
  cash_session_id uuid references public.cash_sessions,
  customer_id     uuid references public.customers,
  number          text not null,
  status          public.sale_status not null default 'completed',
  subtotal        bigint not null default 0,
  discount_total  bigint not null default 0,
  total           bigint not null default 0,
  paid_amount     bigint not null default 0,
  balance_due     bigint generated always as (total - paid_amount) stored,
  note            text,
  created_by      uuid,
  created_at      timestamptz not null,                   -- heure réelle de la vente (client)
  synced_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  cancelled_at    timestamptz,
  cancelled_by    uuid,
  cancel_reason   text,
  unique (organization_id, number)
);
create index sales_org_date_idx on public.sales (organization_id, created_at);
create index sales_customer_idx on public.sales (customer_id);
create index sales_session_idx  on public.sales (cash_session_id);

create table public.sale_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  sale_id         uuid not null references public.sales on delete cascade,
  product_id      uuid not null references public.products,
  quantity        numeric(14,3) not null check (quantity > 0),
  unit_price      bigint not null check (unit_price >= 0),
  discount        bigint not null default 0 check (discount >= 0),
  line_total      bigint not null
);
create index sale_items_sale_idx    on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (organization_id, product_id);

-- Coût figé au moment de la vente (owner/manager uniquement)
create table public.sale_costs (
  sale_item_id    uuid primary key references public.sale_items on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  sale_id         uuid not null references public.sales on delete cascade,
  unit_cost       numeric(18,2) not null,
  total_cost      numeric(18,2) not null
);
create index sale_costs_sale_idx on public.sale_costs (sale_id);

-- ---------------------------------------------------------------------
-- Encaissements (ventes, remboursements de crédit, remboursements clients)
-- ---------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  store_id        uuid not null references public.stores,
  cash_session_id uuid references public.cash_sessions,
  sale_id         uuid references public.sales,
  customer_id     uuid references public.customers,
  kind            public.payment_kind not null,
  method          text not null,          -- cash | orange_money | mtn_momo | bank | ...
  amount          bigint not null,        -- négatif pour un remboursement
  reference       text,                   -- n° de transaction Mobile Money, etc.
  created_by      uuid,
  created_at      timestamptz not null default now()
);
create index payments_org_date_idx on public.payments (organization_id, created_at);
create index payments_session_idx  on public.payments (cash_session_id);
create index payments_customer_idx on public.payments (customer_id);

-- ---------------------------------------------------------------------
-- Dépenses (écriture via la RPC record_expense)
-- ---------------------------------------------------------------------
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  store_id        uuid not null references public.stores,
  cash_session_id uuid references public.cash_sessions,
  category        text not null,
  description     text,
  amount          bigint not null check (amount > 0),
  method          text not null default 'cash',
  expense_date    date not null,           -- date locale de l'organisation, fixée par record_expense
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
create index expenses_org_date_idx on public.expenses (organization_id, expense_date);
create index expenses_session_idx  on public.expenses (cash_session_id);

-- ---------------------------------------------------------------------
-- Achats et arrivages (owner/manager uniquement)
-- ---------------------------------------------------------------------
create table public.purchases (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  store_id        uuid not null references public.stores,          -- boutique ou dépôt de réception
  supplier_id     uuid references public.suppliers,
  number          text,
  supplier_ref    text,
  origin          text not null default 'local' check (origin in ('local','import')),
  currency        text not null default 'GNF',
  exchange_rate   numeric(18,6) not null default 1 check (exchange_rate > 0), -- GNF pour 1 unité de devise
  status          public.purchase_status not null default 'draft',
  ordered_at      date,
  received_at     timestamptz,
  notes           text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.purchase_items (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations on delete cascade,
  purchase_id        uuid not null references public.purchases on delete cascade,
  product_id         uuid not null references public.products,
  quantity           numeric(14,3) not null check (quantity > 0),
  unit_price_foreign numeric(18,4) not null check (unit_price_foreign >= 0),
  landed_unit_cost   numeric(18,2)   -- calculé à la réception
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

create table public.purchase_costs (   -- fret, douane, transport, manutention...
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  purchase_id     uuid not null references public.purchases on delete cascade,
  label           text not null,
  amount          bigint not null check (amount >= 0)   -- dans la devise de l'organisation
);

-- ---------------------------------------------------------------------
-- Inventaires physiques
-- ---------------------------------------------------------------------
create table public.inventory_counts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  store_id        uuid not null references public.stores,
  status          text not null default 'open' check (status in ('open','validated','cancelled')),
  notes           text,
  started_by      uuid default auth.uid(),
  started_at      timestamptz not null default now(),
  validated_by    uuid,
  validated_at    timestamptz
);

create table public.inventory_count_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  count_id        uuid not null references public.inventory_counts on delete cascade,
  product_id      uuid not null references public.products,
  expected_qty    numeric(14,3),           -- stock théorique à l'instant du comptage (calculé à la validation)
  counted_qty     numeric(14,3),
  counted_at      timestamptz,             -- fixé par le serveur à chaque saisie de counted_qty
  unique (count_id, product_id)
);

-- ---------------------------------------------------------------------
-- Numérotation et audit
-- ---------------------------------------------------------------------
create table public.document_counters (
  organization_id uuid not null references public.organizations on delete cascade,
  doc_type        text not null,
  last_value      bigint not null default 0,
  primary key (organization_id, doc_type)
);

create table public.audit_log (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid,
  action          text not null,
  entity          text,
  entity_id       uuid,
  data            jsonb,
  created_at      timestamptz not null default now()
);
create index audit_org_date_idx on public.audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at automatique (pour la synchro hors ligne)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','stores','categories','products','suppliers','customers','sales','purchases'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   t || '_set_updated_at', t);
  end loop;
end $$;

-- Changement de prix de vente → audit
create or replace function public.audit_price_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sale_price is distinct from old.sale_price then
    insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
    values (new.organization_id, auth.uid(), 'product.price_change', 'products', new.id,
            jsonb_build_object('name', new.name, 'old', old.sale_price, 'new', new.sale_price));
  end if;
  return new;
end $$;
create trigger products_audit_price after update on public.products
  for each row execute function public.audit_price_change();

-- =====================================================================
-- Garde-fous (triggers)
-- Les écritures directes depuis l'API arrivent avec le rôle 'authenticated'.
-- Dans une RPC security definer, current_user est le propriétaire de la
-- fonction : les gardes ci-dessous ne visent donc que les écritures directes.
-- =====================================================================

-- Une référence vers une autre table doit appartenir à la même organisation.
-- Arguments : paires (table_cible, colonne).
create or replace function public.check_org_refs() returns trigger
language plpgsql security definer set search_path = public as $$
declare i int := 0; v_ref uuid; v_ok boolean;
begin
  while i < tg_nargs loop
    v_ref := (to_jsonb(new) ->> tg_argv[i+1])::uuid;
    if v_ref is not null then
      execute format('select exists (select 1 from public.%I where id = $1 and organization_id = $2)', tg_argv[i])
         into v_ok using v_ref, new.organization_id;
      if not v_ok then raise exception 'Référence invalide : %', tg_argv[i+1]; end if;
    end if;
    i := i + 2;
  end loop;
  return new;
end $$;

create trigger categories_org_refs before insert or update on public.categories
  for each row execute function public.check_org_refs('categories','parent_id');
create trigger products_org_refs before insert or update on public.products
  for each row execute function public.check_org_refs('categories','category_id');
create trigger purchases_org_refs before insert or update on public.purchases
  for each row execute function public.check_org_refs('stores','store_id','suppliers','supplier_id');
create trigger purchase_items_org_refs before insert or update on public.purchase_items
  for each row execute function public.check_org_refs('purchases','purchase_id','products','product_id');
create trigger purchase_costs_org_refs before insert or update on public.purchase_costs
  for each row execute function public.check_org_refs('purchases','purchase_id');
create trigger inventory_counts_org_refs before insert or update on public.inventory_counts
  for each row execute function public.check_org_refs('stores','store_id');
create trigger inventory_count_items_org_refs before insert or update on public.inventory_count_items
  for each row execute function public.check_org_refs('inventory_counts','count_id','products','product_id');

-- Achat réceptionné ou annulé : figé. La réception passe par receive_purchase.
create or replace function public.guard_purchases() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' then
      if new.status = 'received' then raise exception 'Un achat se réceptionne via receive_purchase'; end if;
    else
      if old.status in ('received','cancelled') then
        raise exception 'Achat réceptionné ou annulé : modification impossible';
      end if;
      if tg_op = 'UPDATE' and new.status = 'received' then
        raise exception 'Un achat se réceptionne via receive_purchase';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger purchases_guard before insert or update or delete on public.purchases
  for each row execute function public.guard_purchases();

create or replace function public.guard_purchase_lines() returns trigger
language plpgsql set search_path = public as $$
declare v_ids uuid[];
begin
  if current_user in ('authenticated','anon') then
    v_ids := case tg_op when 'INSERT' then array[new.purchase_id]
                        when 'DELETE' then array[old.purchase_id]
                        else array[new.purchase_id, old.purchase_id] end;
    if exists (select 1 from purchases where id = any(v_ids) and status in ('received','cancelled')) then
      raise exception 'Achat réceptionné ou annulé : modification impossible';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger purchase_items_guard before insert or update or delete on public.purchase_items
  for each row execute function public.guard_purchase_lines();
create trigger purchase_costs_guard before insert or update or delete on public.purchase_costs
  for each row execute function public.guard_purchase_lines();

-- Inventaire : seul l'état 'open' est modifiable ; la validation passe par validate_inventory.
create or replace function public.guard_inventory_counts() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' then
      if new.status <> 'open' then raise exception 'Un inventaire commence à l''état ouvert'; end if;
      new.validated_by := null;
      new.validated_at := null;
    else
      if old.status <> 'open' then raise exception 'Inventaire clôturé : modification impossible'; end if;
      if new.status = 'validated' then raise exception 'Un inventaire se valide via validate_inventory'; end if;
      if new.store_id <> old.store_id then raise exception 'Boutique non modifiable'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger inventory_counts_guard before insert or update on public.inventory_counts
  for each row execute function public.guard_inventory_counts();

create or replace function public.guard_inventory_items() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    if exists (select 1 from inventory_counts where id = new.count_id and status <> 'open') then
      raise exception 'Inventaire clôturé : modification impossible';
    end if;
    if tg_op = 'UPDATE' and new.count_id <> old.count_id then
      raise exception 'Inventaire non modifiable';
    end if;
    -- le stock théorique est calculé par le serveur à la validation
    new.expected_qty := case when tg_op = 'UPDATE' then old.expected_qty end;
  end if;
  if tg_op = 'INSERT' then
    new.counted_at := case when new.counted_qty is not null then now() end;
  elsif new.counted_qty is distinct from old.counted_qty then
    new.counted_at := now();
  end if;
  return new;
end $$;
create trigger inventory_count_items_guard before insert or update on public.inventory_count_items
  for each row execute function public.guard_inventory_items();

-- Dépense rattachée à une caisse clôturée : figée (le rapport Z ne doit plus bouger).
create or replace function public.guard_expenses() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    if exists (select 1 from cash_sessions where id = old.cash_session_id and status = 'closed') then
      raise exception 'Dépense rattachée à une caisse clôturée : modification impossible';
    end if;
    if tg_op = 'UPDATE' and (new.cash_session_id is distinct from old.cash_session_id
                             or new.store_id <> old.store_id
                             or new.method <> old.method) then
      raise exception 'Caisse, boutique et mode de paiement non modifiables';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger expenses_guard before update or delete on public.expenses
  for each row execute function public.guard_expenses();

-- Une organisation garde toujours au moins un patron actif.
create or replace function public.guard_last_owner() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon')
     and old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active)
     and not exists (select 1 from organization_members m
                      where m.organization_id = old.organization_id and m.user_id <> old.user_id
                        and m.role = 'owner' and m.is_active) then
    raise exception 'L''organisation doit garder au moins un patron actif';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger organization_members_last_owner before update or delete on public.organization_members
  for each row execute function public.guard_last_owner();

-- =====================================================================
-- Sécurité : Row Level Security
-- =====================================================================
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.document_counters    enable row level security;  -- aucune policy : accès via RPC uniquement

create policy org_select on public.organizations for select using (public.is_member(id));
create policy org_update on public.organizations for update using (public.is_owner(id));

create policy members_select on public.organization_members for select using (public.is_member(organization_id));
create policy members_insert on public.organization_members for insert with check (public.is_owner(organization_id));
create policy members_update on public.organization_members for update using (public.is_owner(organization_id));
create policy members_delete on public.organization_members for delete using (public.is_owner(organization_id));

alter table public.organization_invitations enable row level security;
create policy invitations_select on public.organization_invitations for select using (public.is_owner(organization_id));
create policy invitations_insert on public.organization_invitations for insert
  with check (public.is_owner(organization_id) and accepted_at is null);
create policy invitations_delete on public.organization_invitations for delete
  using (public.is_owner(organization_id) and accepted_at is null);

do $$
declare t text;
begin
  -- Référentiels : lecture par tous les membres, écriture par owner/manager
  foreach t in array array['stores','categories','products','suppliers','customers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_member(organization_id))', t||'_select', t);
    execute format('create policy %I on public.%I for insert with check (public.is_manager(organization_id))', t||'_insert', t);
    execute format('create policy %I on public.%I for update using (public.is_manager(organization_id))', t||'_update', t);
    execute format('create policy %I on public.%I for delete using (public.is_owner(organization_id))', t||'_delete', t);
  end loop;

  -- Achats : owner/manager uniquement
  foreach t in array array['purchases','purchase_items','purchase_costs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all using (public.is_manager(organization_id)) with check (public.is_manager(organization_id))', t||'_all', t);
  end loop;

  -- Coûts : lecture owner/manager, écriture via RPC uniquement
  foreach t in array array['product_costs','sale_costs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_manager(organization_id))', t||'_select', t);
  end loop;

  -- Registres : lecture par les membres, écriture via RPC uniquement
  foreach t in array array['stock_movements','sales','sale_items','payments','cash_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_member(organization_id))', t||'_select', t);
  end loop;

  -- Inventaires : owner/manager/magasinier
  foreach t in array array['inventory_counts','inventory_count_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_member(organization_id))', t||'_select', t);
    execute format('create policy %I on public.%I for insert with check (public.can_stock(organization_id))', t||'_insert', t);
    execute format('create policy %I on public.%I for update using (public.can_stock(organization_id))', t||'_update', t);
  end loop;
end $$;

-- Journal d'audit : patron uniquement, écriture via RPC/triggers
alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log for select using (public.is_owner(organization_id));

-- Les vendeurs peuvent créer des clients depuis la caisse
create policy customers_insert_staff on public.customers for insert with check (public.is_member(organization_id));

-- Dépenses : saisie via record_expense (idempotente), correction par owner/manager
alter table public.expenses enable row level security;
create policy expenses_select on public.expenses for select using (public.is_member(organization_id));
create policy expenses_update on public.expenses for update using (public.is_manager(organization_id));
create policy expenses_delete on public.expenses for delete using (public.is_manager(organization_id));

-- =====================================================================
-- Fonctions internes (appelées uniquement par les RPC)
-- =====================================================================

create or replace function public.next_number(p_org uuid, p_type text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into document_counters(organization_id, doc_type, last_value) values (p_org, p_type, 1)
  on conflict (organization_id, doc_type)
    do update set last_value = document_counters.last_value + 1
  returning last_value into v;
  return p_prefix || lpad(v::text, 6, '0');
end $$;

-- Le mode de paiement doit figurer dans settings.payment_methods
create or replace function public.assert_payment_method(p_org uuid, p_method text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_method is null or not exists (
       select 1 from organizations
        where id = p_org and coalesce(settings->'payment_methods', '[]'::jsonb) ? p_method) then
    raise exception 'Mode de paiement non autorisé : %', coalesce(p_method, '(vide)');
  end if;
end $$;

-- Session de caisse à laquelle rattacher une opération (vente, remboursement, dépense).
-- Règle hors ligne : la session d'origine si elle est encore ouverte, sinon la session
-- ouverte de la boutique (ou aucune). Le verrou empêche une clôture concurrente
-- d'oublier l'opération.
create or replace function public.resolve_cash_session(p_org uuid, p_store uuid, p_session uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_status text; v_store uuid; v_open uuid;
begin
  if not exists (select 1 from stores where id = p_store and organization_id = p_org) then
    raise exception 'Boutique inconnue';
  end if;
  if p_session is not null then
    select status, store_id into v_status, v_store
      from cash_sessions where id = p_session and organization_id = p_org for share;
    if not found then raise exception 'Session de caisse inconnue'; end if;
    if v_store <> p_store then raise exception 'Session de caisse d''une autre boutique'; end if;
    if v_status = 'open' then return p_session; end if;
  end if;
  select id into v_open from cash_sessions where store_id = p_store and status = 'open' for share;
  return v_open;
end $$;

-- =====================================================================
-- Fonctions RPC (toutes les écritures critiques)
-- =====================================================================

-- Création d'une organisation (inscription d'un nouveau client)
create or replace function public.create_organization(p_name text, p_slug text, p_store_name text default 'Boutique principale')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nom obligatoire'; end if;
  if exists (select 1 from organizations where slug = p_slug) then raise exception 'Identifiant déjà utilisé'; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into organizations(name, slug) values (trim(p_name), p_slug) returning id into v_org;
  insert into organization_members(organization_id, user_id, role, display_name) values (v_org, auth.uid(), 'owner', v_email);
  insert into stores(organization_id, name) values (v_org, coalesce(nullif(trim(p_store_name), ''), 'Boutique principale'));
  return v_org;
end $$;

-- Rattache l'utilisateur connecté aux organisations qui l'ont invité.
-- Seule une adresse e-mail confirmée peut accepter une invitation.
create or replace function public.accept_invitations()
returns int language plpgsql security definer set search_path = public as $$
declare v_email text; v_count int;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;

  insert into organization_members(organization_id, user_id, role, display_name)
  select i.organization_id, auth.uid(), i.role, coalesce(nullif(trim(i.display_name), ''), v_email)
    from organization_invitations i
   where i.email = v_email and i.accepted_at is null
  on conflict (organization_id, user_id) do nothing;
  get diagnostics v_count = row_count;

  update organization_invitations set accepted_at = now(), accepted_by = auth.uid()
   where email = v_email and accepted_at is null;
  return v_count;
end $$;

-- Stock d'ouverture (saisie initiale du magasin) : entrée en stock + CMP
create or replace function public.set_opening_stock(p_org uuid, p_store uuid, p_product uuid,
                                                    p_qty numeric, p_unit_cost numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_stock numeric; v_old numeric;
begin
  if not public.is_manager(p_org) then raise exception 'Accès refusé'; end if;
  if not exists (select 1 from stores where id = p_store and organization_id = p_org) then
    raise exception 'Boutique inconnue';
  end if;
  if not exists (select 1 from products where id = p_product and organization_id = p_org) then
    raise exception 'Produit inconnu';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;
  if p_unit_cost < 0 then raise exception 'Coût invalide'; end if;

  select greatest(coalesce(sum(quantity), 0), 0) into v_stock
    from stock_movements where organization_id = p_org and product_id = p_product;
  select avg_cost into v_old from product_costs where product_id = p_product;

  insert into stock_movements(organization_id, store_id, product_id, type, quantity, reference_type, note, created_by)
  values (p_org, p_store, p_product, 'opening', p_qty, 'manual', 'Stock d''ouverture', auth.uid());

  if p_unit_cost is not null then
    insert into product_costs(product_id, organization_id, avg_cost, last_cost)
    values (p_product, p_org, round(p_unit_cost, 2), round(p_unit_cost, 2))
    on conflict (product_id) do update set
      avg_cost   = round((v_stock * coalesce(v_old, 0) + p_qty * p_unit_cost) / (v_stock + p_qty), 2),
      last_cost  = round(p_unit_cost, 2),
      updated_at = now();
  end if;

  insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
  values (p_org, auth.uid(), 'stock.opening', 'products', p_product,
          jsonb_build_object('quantity', p_qty, 'unit_cost', p_unit_cost, 'store_id', p_store));
end $$;

-- Ajustement / perte / casse / retour client
-- Le signe est imposé par le type : perte = sortie, retour client = entrée, ajustement = signé.
create or replace function public.record_stock_adjustment(p_org uuid, p_store uuid, p_product uuid,
                                                          p_qty numeric, p_type public.movement_type, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_qty numeric;
begin
  if not public.can_stock(p_org) then raise exception 'Accès refusé'; end if;
  if p_type not in ('adjustment','loss','customer_return') then raise exception 'Type de mouvement non autorisé'; end if;
  if coalesce(trim(p_note),'') = '' then raise exception 'Motif obligatoire'; end if;
  if p_qty is null or p_qty = 0 then raise exception 'Quantité invalide'; end if;
  if not exists (select 1 from stores where id = p_store and organization_id = p_org) then
    raise exception 'Boutique inconnue';
  end if;
  if not exists (select 1 from products where id = p_product and organization_id = p_org) then
    raise exception 'Produit inconnu';
  end if;

  v_qty := case p_type when 'loss' then -abs(p_qty)
                       when 'customer_return' then abs(p_qty)
                       else p_qty end;

  insert into stock_movements(organization_id, store_id, product_id, type, quantity, reference_type, note, created_by)
  values (p_org, p_store, p_product, p_type, v_qty, 'manual', p_note, auth.uid());
  insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
  values (p_org, auth.uid(), 'stock.' || p_type::text, 'products', p_product,
          jsonb_build_object('quantity', v_qty, 'note', p_note, 'store_id', p_store));
end $$;

-- Ouverture de caisse
create or replace function public.open_cash_session(p_org uuid, p_store uuid, p_opening_float bigint default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_member(p_org) then raise exception 'Accès refusé'; end if;
  if not exists (select 1 from stores where id = p_store and organization_id = p_org) then
    raise exception 'Boutique inconnue';
  end if;
  if coalesce(p_opening_float, 0) < 0 then raise exception 'Fond de caisse invalide'; end if;
  select id into v_id from cash_sessions where store_id = p_store and status = 'open';
  if found then return v_id; end if;
  insert into cash_sessions(organization_id, store_id, opened_by, opening_float)
  values (p_org, p_store, auth.uid(), coalesce(p_opening_float,0))
  returning id into v_id;
  return v_id;
end $$;

-- Clôture de caisse : calcule l'attendu en espèces et l'écart
create or replace function public.close_cash_session(p_session uuid, p_counted_cash bigint, p_notes text default null)
returns public.cash_sessions language plpgsql security definer set search_path = public as $$
declare v_s cash_sessions%rowtype; v_expected bigint;
begin
  select * into v_s from cash_sessions where id = p_session for update;
  if not found then raise exception 'Session introuvable'; end if;
  if not public.is_member(v_s.organization_id) then raise exception 'Accès refusé'; end if;
  if v_s.status = 'closed' then raise exception 'Caisse déjà clôturée'; end if;
  if p_counted_cash is null or p_counted_cash < 0 then raise exception 'Montant compté invalide'; end if;

  v_expected := v_s.opening_float
    + coalesce((select sum(amount) from payments where cash_session_id = p_session and method = 'cash'), 0)
    - coalesce((select sum(amount) from expenses where cash_session_id = p_session and method = 'cash'), 0);

  update cash_sessions
     set status = 'closed', closed_by = auth.uid(), closed_at = now(),
         expected_cash = v_expected, counted_cash = p_counted_cash,
         difference = p_counted_cash - v_expected, notes = p_notes
   where id = p_session
  returning * into v_s;

  insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
  values (v_s.organization_id, auth.uid(), 'cash.close', 'cash_sessions', p_session,
          jsonb_build_object('expected', v_expected, 'counted', p_counted_cash, 'difference', v_s.difference));
  return v_s;
end $$;

-- Création d'une vente (idempotente, compatible hors ligne)
-- p = { id, organization_id, store_id, cash_session_id?, customer_id?, created_at?, note?, global_discount?,
--       items: [{ id?, product_id, quantity, unit_price, discount? }],
--       payments: [{ method, amount, reference? }] }
-- Contrôles pour un non-gérant : prix = prix de détail ou de gros (ou ancien prix si la
-- vente est antérieure au changement), remises selon settings, plafond de crédit client.
create or replace function public.create_sale(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id          uuid := (p->>'id')::uuid;
  v_org         uuid := (p->>'organization_id')::uuid;
  v_store       uuid := (p->>'store_id')::uuid;
  v_req_session uuid := nullif(p->>'cash_session_id','')::uuid;
  v_customer    uuid := nullif(p->>'customer_id','')::uuid;
  v_created     timestamptz := coalesce(nullif(p->>'created_at','')::timestamptz, now());
  v_global      bigint := coalesce((p->>'global_discount')::bigint, 0);
  v_session     uuid;
  v_settings    jsonb;
  v_is_manager  boolean;
  v_rows        int;
  v_item jsonb; v_pay jsonb; v_method text; v_amount bigint;
  v_item_id uuid; v_product uuid; v_qty numeric; v_price bigint; v_disc bigint; v_gross bigint;
  v_sale_price bigint; v_wholesale bigint; v_cost numeric;
  v_subtotal bigint := 0; v_discount bigint := 0; v_total bigint; v_paid bigint := 0;
  v_limit bigint; v_balance bigint; v_short uuid;
begin
  if v_id is null then raise exception 'Identifiant de vente manquant'; end if;
  if not public.is_member(v_org) then raise exception 'Accès refusé'; end if;
  if exists (select 1 from sales where id = v_id and organization_id = v_org) then
    return v_id;                                                       -- déjà synchronisée
  end if;

  select settings into v_settings from organizations where id = v_org;
  v_is_manager := public.is_manager(v_org);
  v_session    := public.resolve_cash_session(v_org, v_store, v_req_session);

  if v_customer is not null and not exists (select 1 from customers where id = v_customer and organization_id = v_org) then
    raise exception 'Client inconnu';
  end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'Vente sans article'; end if;
  if v_global < 0 then raise exception 'Remise invalide'; end if;

  insert into sales(id, organization_id, store_id, cash_session_id, customer_id, number, note, created_by, created_at)
  values (v_id, v_org, v_store, v_session, v_customer, public.next_number(v_org, 'sale', 'V-'),
          p->>'note', auth.uid(), v_created)
  on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then                                                   -- envoi concurrent du même identifiant
    if exists (select 1 from sales where id = v_id and organization_id = v_org) then return v_id; end if;
    raise exception 'Identifiant de vente invalide';
  end if;

  for v_item in select value from jsonb_array_elements(p->'items') loop
    v_item_id := coalesce(nullif(v_item->>'id','')::uuid, gen_random_uuid());
    v_product := (v_item->>'product_id')::uuid;
    v_qty     := (v_item->>'quantity')::numeric;
    v_price   := (v_item->>'unit_price')::bigint;
    v_disc    := coalesce((v_item->>'discount')::bigint, 0);
    if v_qty is null or v_qty <= 0 then raise exception 'Quantité invalide'; end if;
    if v_price is null or v_price < 0 or v_disc < 0 then raise exception 'Prix ou remise invalide'; end if;

    select pr.sale_price, pr.wholesale_price, coalesce(pc.avg_cost, 0)
      into v_sale_price, v_wholesale, v_cost
      from products pr left join product_costs pc on pc.product_id = pr.id
     where pr.id = v_product and pr.organization_id = v_org;
    if not found then raise exception 'Produit inconnu : %', v_product; end if;

    if not v_is_manager
       and v_price <> v_sale_price
       and v_price is distinct from v_wholesale
       and not exists (select 1 from audit_log a                        -- prix en vigueur au moment de la vente
                        where a.organization_id = v_org and a.entity_id = v_product
                          and a.action = 'product.price_change' and a.created_at > v_created
                          and (a.data->>'old')::bigint = v_price) then
      raise exception 'Prix non autorisé pour ce produit : %', v_product;
    end if;

    v_gross := round(v_qty * v_price)::bigint;
    if v_disc > v_gross then raise exception 'Remise supérieure au montant de la ligne'; end if;

    insert into sale_items(id, organization_id, sale_id, product_id, quantity, unit_price, discount, line_total)
    values (v_item_id, v_org, v_id, v_product, v_qty, v_price, v_disc, v_gross - v_disc);

    insert into sale_costs(sale_item_id, organization_id, sale_id, unit_cost, total_cost)
    values (v_item_id, v_org, v_id, v_cost, round(v_cost * v_qty, 2));

    insert into stock_movements(organization_id, store_id, product_id, type, quantity, reference_type, reference_id, created_by, created_at)
    values (v_org, v_store, v_product, 'sale', -v_qty, 'sale', v_id, auth.uid(), v_created);

    v_subtotal := v_subtotal + v_gross;
    v_discount := v_discount + v_disc;
  end loop;

  v_discount := v_discount + v_global;
  v_total := v_subtotal - v_discount;
  if v_total < 0 then raise exception 'Total négatif'; end if;

  if v_discount > 0 and not v_is_manager then
    if not coalesce((v_settings->>'cashier_can_discount')::boolean, false) then
      raise exception 'Remise non autorisée pour un vendeur';
    end if;
    if v_discount * 100 > v_subtotal * coalesce((v_settings->>'max_discount_percent')::numeric, 0) then
      raise exception 'Remise supérieure au maximum autorisé (% %%)', v_settings->>'max_discount_percent';
    end if;
  end if;

  if not coalesce((v_settings->>'allow_negative_stock')::boolean, true) then
    select m.product_id into v_short
      from stock_movements m
     where m.organization_id = v_org and m.store_id = v_store
       and m.product_id in (select product_id from sale_items where sale_id = v_id)
     group by m.product_id
    having sum(m.quantity) < 0
     limit 1;
    if found then
      raise exception 'Stock insuffisant : %', (select name from products where id = v_short);
    end if;
  end if;

  for v_pay in select value from jsonb_array_elements(coalesce(p->'payments','[]'::jsonb)) loop
    v_method := v_pay->>'method';
    v_amount := (v_pay->>'amount')::bigint;
    if v_amount is null or v_amount <= 0 then raise exception 'Montant de paiement invalide'; end if;
    perform public.assert_payment_method(v_org, v_method);
    insert into payments(organization_id, store_id, cash_session_id, sale_id, customer_id, kind, method, amount, reference, created_by, created_at)
    values (v_org, v_store, v_session, v_id, v_customer, 'sale', v_method,
            v_amount, v_pay->>'reference', auth.uid(), v_created);
    v_paid := v_paid + v_amount;
  end loop;

  if v_paid > v_total then raise exception 'Montant payé supérieur au total (la monnaie se rend côté caisse)'; end if;
  if v_paid < v_total and v_customer is null then raise exception 'Vente à crédit : client obligatoire'; end if;

  update sales set subtotal = v_subtotal, discount_total = v_discount, total = v_total, paid_amount = v_paid
   where id = v_id;

  if v_paid < v_total and not v_is_manager then
    select credit_limit into v_limit from customers where id = v_customer;
    if v_limit is not null then
      select balance into v_balance from customer_balances where customer_id = v_customer;
      if v_balance > v_limit then
        raise exception 'Plafond de crédit dépassé pour ce client (plafond %, solde après vente %)', v_limit, v_balance;
      end if;
    end if;
  end if;

  if v_req_session is not null and v_session is distinct from v_req_session then
    insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
    values (v_org, auth.uid(), 'sale.session_reassigned', 'sales', v_id,
            jsonb_build_object('requested_session', v_req_session, 'assigned_session', v_session));
  end if;

  return v_id;
end $$;

-- Annulation d'une vente (gérant, motif obligatoire)
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sale sales%rowtype; v_open uuid;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if not public.is_manager(v_sale.organization_id) then raise exception 'Seul un gérant peut annuler une vente'; end if;
  if v_sale.status = 'cancelled' then return; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'Motif obligatoire'; end if;

  update sales set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_sale_id;

  insert into stock_movements(organization_id, store_id, product_id, type, quantity, reference_type, reference_id, created_by)
  select si.organization_id, v_sale.store_id, si.product_id, 'sale_cancel', si.quantity, 'sale', p_sale_id, auth.uid()
    from sale_items si where si.sale_id = p_sale_id;

  v_open := public.resolve_cash_session(v_sale.organization_id, v_sale.store_id, null);

  insert into payments(organization_id, store_id, cash_session_id, sale_id, customer_id, kind, method, amount, reference, created_by)
  select pm.organization_id, pm.store_id, v_open, pm.sale_id, pm.customer_id, 'refund', pm.method, -pm.amount,
         'Annulation ' || v_sale.number, auth.uid()
    from payments pm where pm.sale_id = p_sale_id and pm.kind = 'sale';

  insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
  values (v_sale.organization_id, auth.uid(), 'sale.cancel', 'sales', p_sale_id,
          jsonb_build_object('number', v_sale.number, 'total', v_sale.total, 'reason', p_reason));
end $$;

-- Remboursement d'un crédit client (idempotent via p_id, compatible hors ligne)
create or replace function public.record_credit_repayment(p_id uuid, p_org uuid, p_store uuid, p_session uuid,
                                                          p_customer uuid, p_method text, p_amount bigint,
                                                          p_reference text default null,
                                                          p_created_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_rows int;
begin
  if p_id is null then raise exception 'Identifiant manquant'; end if;
  if not public.is_member(p_org) then raise exception 'Accès refusé'; end if;
  if exists (select 1 from payments where id = p_id and organization_id = p_org) then return p_id; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;
  if not exists (select 1 from customers where id = p_customer and organization_id = p_org) then
    raise exception 'Client inconnu';
  end if;
  perform public.assert_payment_method(p_org, p_method);
  v_session := public.resolve_cash_session(p_org, p_store, p_session);

  insert into payments(id, organization_id, store_id, cash_session_id, customer_id, kind, method, amount, reference, created_by, created_at)
  values (p_id, p_org, p_store, v_session, p_customer, 'credit_repayment', p_method, p_amount, p_reference,
          auth.uid(), coalesce(p_created_at, now()))
  on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 and not exists (select 1 from payments where id = p_id and organization_id = p_org) then
    raise exception 'Identifiant de paiement invalide';
  end if;

  if p_session is not null and v_session is distinct from p_session then
    insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
    values (p_org, auth.uid(), 'payment.session_reassigned', 'payments', p_id,
            jsonb_build_object('requested_session', p_session, 'assigned_session', v_session));
  end if;
  return p_id;
end $$;

-- Enregistrement d'une dépense (idempotent, compatible hors ligne)
-- p = { id, organization_id, store_id, cash_session_id?, category, description?, amount,
--       method?, expense_date?, created_at? }
-- Seules les dépenses en espèces sont rattachées à la journée de caisse.
create or replace function public.record_expense(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id          uuid := (p->>'id')::uuid;
  v_org         uuid := (p->>'organization_id')::uuid;
  v_store       uuid := (p->>'store_id')::uuid;
  v_req_session uuid := nullif(p->>'cash_session_id','')::uuid;
  v_method      text := coalesce(nullif(p->>'method',''), 'cash');
  v_amount      bigint := (p->>'amount')::bigint;
  v_created     timestamptz := coalesce(nullif(p->>'created_at','')::timestamptz, now());
  v_session     uuid;
  v_date        date;
  v_rows        int;
begin
  if v_id is null then raise exception 'Identifiant de dépense manquant'; end if;
  if not public.is_member(v_org) then raise exception 'Accès refusé'; end if;
  if exists (select 1 from expenses where id = v_id and organization_id = v_org) then return v_id; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'Montant invalide'; end if;
  if coalesce(trim(p->>'category'),'') = '' then raise exception 'Catégorie obligatoire'; end if;
  perform public.assert_payment_method(v_org, v_method);
  v_session := public.resolve_cash_session(v_org, v_store, v_req_session);
  if v_method <> 'cash' then v_session := null; end if;

  select coalesce(nullif(p->>'expense_date','')::date, (v_created at time zone o.timezone)::date)
    into v_date from organizations o where o.id = v_org;

  insert into expenses(id, organization_id, store_id, cash_session_id, category, description, amount, method,
                       expense_date, created_by, created_at)
  values (v_id, v_org, v_store, v_session, trim(p->>'category'), p->>'description', v_amount, v_method,
          v_date, auth.uid(), v_created)
  on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 and not exists (select 1 from expenses where id = v_id and organization_id = v_org) then
    raise exception 'Identifiant de dépense invalide';
  end if;

  if v_method = 'cash' and v_req_session is not null and v_session is distinct from v_req_session then
    insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
    values (v_org, auth.uid(), 'expense.session_reassigned', 'expenses', v_id,
            jsonb_build_object('requested_session', v_req_session, 'assigned_session', v_session));
  end if;
  return v_id;
end $$;

-- Réception d'un achat : coût de revient + CMP + entrée en stock
create or replace function public.receive_purchase(p_purchase_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_p purchases%rowtype; v_item record;
  v_goods numeric; v_fees numeric; v_landed numeric; v_stock numeric; v_old numeric;
begin
  select * into v_p from purchases where id = p_purchase_id for update;
  if not found then raise exception 'Achat introuvable'; end if;
  if not public.is_manager(v_p.organization_id) then raise exception 'Accès refusé'; end if;
  if v_p.status in ('received','cancelled') then raise exception 'Achat déjà réceptionné ou annulé'; end if;

  select coalesce(sum(quantity * unit_price_foreign * v_p.exchange_rate), 0) into v_goods
    from purchase_items where purchase_id = p_purchase_id;
  if v_goods <= 0 then raise exception 'Aucun article valorisé dans cet achat'; end if;

  select coalesce(sum(amount), 0) into v_fees from purchase_costs where purchase_id = p_purchase_id;

  for v_item in select * from purchase_items where purchase_id = p_purchase_id order by id loop
    -- frais répartis au prorata de la valeur
    v_landed := v_item.unit_price_foreign * v_p.exchange_rate * (1 + v_fees / v_goods);
    update purchase_items set landed_unit_cost = round(v_landed, 2) where id = v_item.id;

    select greatest(coalesce(sum(quantity), 0), 0) into v_stock
      from stock_movements where organization_id = v_p.organization_id and product_id = v_item.product_id;
    select avg_cost into v_old from product_costs where product_id = v_item.product_id;

    insert into product_costs(product_id, organization_id, avg_cost, last_cost, updated_at)
    values (v_item.product_id, v_p.organization_id, round(v_landed, 2), round(v_landed, 2), now())
    on conflict (product_id) do update set
      avg_cost   = round((v_stock * coalesce(v_old, 0) + v_item.quantity * v_landed) / (v_stock + v_item.quantity), 2),
      last_cost  = round(v_landed, 2),
      updated_at = now();

    insert into stock_movements(organization_id, store_id, product_id, type, quantity, reference_type, reference_id, created_by)
    values (v_p.organization_id, v_p.store_id, v_item.product_id, 'purchase', v_item.quantity, 'purchase', p_purchase_id, auth.uid());
  end loop;

  update purchases
     set status = 'received', received_at = now(),
         number = coalesce(number, public.next_number(v_p.organization_id, 'purchase', 'A-'))
   where id = p_purchase_id;

  insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
  values (v_p.organization_id, auth.uid(), 'purchase.receive', 'purchases', p_purchase_id,
          jsonb_build_object('goods_value', round(v_goods), 'fees', v_fees, 'currency', v_p.currency, 'rate', v_p.exchange_rate));
end $$;

-- Validation d'un inventaire : crée les ajustements d'écart.
-- Le stock théorique est celui à l'instant du comptage de chaque ligne (counted_at) :
-- les ventes faites entre le comptage et la validation ne faussent pas l'écart.
create or replace function public.validate_inventory(p_count uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c inventory_counts%rowtype;
begin
  select * into v_c from inventory_counts where id = p_count for update;
  if not found then raise exception 'Inventaire introuvable'; end if;
  if not public.is_manager(v_c.organization_id) then raise exception 'Seul un gérant peut valider'; end if;
  if v_c.status <> 'open' then raise exception 'Inventaire déjà clôturé'; end if;

  update inventory_count_items i
     set expected_qty = coalesce((select sum(m.quantity) from stock_movements m
                                   where m.organization_id = v_c.organization_id
                                     and m.product_id = i.product_id and m.store_id = v_c.store_id
                                     and m.created_at <= coalesce(i.counted_at, now())), 0)
   where i.count_id = p_count;

  insert into stock_movements(organization_id, store_id, product_id, type, quantity, reference_type, reference_id, note, created_by)
  select i.organization_id, v_c.store_id, i.product_id, 'adjustment', i.counted_qty - i.expected_qty,
         'inventory', p_count, 'Écart d''inventaire', auth.uid()
    from inventory_count_items i
   where i.count_id = p_count and i.counted_qty is not null and i.counted_qty <> i.expected_qty;

  update inventory_counts set status = 'validated', validated_by = auth.uid(), validated_at = now() where id = p_count;

  insert into audit_log(organization_id, user_id, action, entity, entity_id)
  values (v_c.organization_id, auth.uid(), 'inventory.validate', 'inventory_counts', p_count);
end $$;

-- =====================================================================
-- Vues de reporting (security_invoker : la RLS s'applique)
-- =====================================================================

-- Stock actuel par boutique
create view public.product_stock with (security_invoker = true) as
select organization_id, store_id, product_id, sum(quantity) as quantity
  from public.stock_movements
 group by organization_id, store_id, product_id;

-- Solde des clients (ce qu'ils doivent)
create view public.customer_balances with (security_invoker = true) as
select c.organization_id, c.id as customer_id, c.name, c.phone,
       coalesce((select sum(s.total) from public.sales s where s.customer_id = c.id and s.status = 'completed'), 0)
     - coalesce((select sum(p.amount) from public.payments p where p.customer_id = c.id), 0) as balance
  from public.customers c;

-- Ventes par jour
create view public.daily_sales with (security_invoker = true) as
select s.organization_id, s.store_id,
       (s.created_at at time zone o.timezone)::date as day,
       count(*) filter (where s.status = 'completed')                         as sales_count,
       coalesce(sum(s.total)          filter (where s.status = 'completed'), 0) as revenue,
       coalesce(sum(s.discount_total) filter (where s.status = 'completed'), 0) as discounts,
       coalesce(sum(s.balance_due)    filter (where s.status = 'completed'), 0) as credit_given,
       count(*) filter (where s.status = 'cancelled')                         as cancelled_count
  from public.sales s join public.organizations o on o.id = s.organization_id
 group by s.organization_id, s.store_id, (s.created_at at time zone o.timezone)::date;

-- Encaissements par jour et par mode de paiement
create view public.daily_payments with (security_invoker = true) as
select p.organization_id, p.store_id,
       (p.created_at at time zone o.timezone)::date as day,
       p.kind, p.method, sum(p.amount) as amount, count(*) as count
  from public.payments p join public.organizations o on o.id = p.organization_id
 group by p.organization_id, p.store_id, (p.created_at at time zone o.timezone)::date, p.kind, p.method;

-- Marge brute par jour (owner/manager : sale_costs filtrée par la RLS)
create view public.daily_margin with (security_invoker = true) as
select s.organization_id, s.store_id,
       (s.created_at at time zone o.timezone)::date as day,
       sum(s.total)                as revenue,
       sum(c.cost)                 as cost,
       sum(s.total) - sum(c.cost)  as gross_margin
  from public.sales s
  join public.organizations o on o.id = s.organization_id
  join (select sale_id, sum(total_cost) as cost from public.sale_costs group by sale_id) c on c.sale_id = s.id
 where s.status = 'completed'
 group by s.organization_id, s.store_id, (s.created_at at time zone o.timezone)::date;

-- Dépenses par jour
create view public.daily_expenses with (security_invoker = true) as
select organization_id, store_id, expense_date as day, category, sum(amount) as amount, count(*) as count
  from public.expenses
 group by organization_id, store_id, expense_date, category;

-- Ce qui a été vendu, produit par produit, chaque jour
create view public.daily_product_sales with (security_invoker = true) as
select s.organization_id, s.store_id,
       (s.created_at at time zone o.timezone)::date as day,
       si.product_id, sum(si.quantity) as quantity, sum(si.line_total) as revenue, count(distinct s.id) as sales_count
  from public.sale_items si
  join public.sales s on s.id = si.sale_id and s.status = 'completed'
  join public.organizations o on o.id = s.organization_id
 group by s.organization_id, s.store_id, (s.created_at at time zone o.timezone)::date, si.product_id;

-- =====================================================================
-- Droits
-- En Postgres, EXECUTE est accordé à PUBLIC par défaut (et donc à anon) :
-- on le retire à PUBLIC, puis on le rend explicitement aux rôles connectés.
-- =====================================================================
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;

-- Fonctions internes : appelées uniquement depuis les RPC security definer
revoke execute on function public.next_number(uuid, text, text)           from authenticated;
revoke execute on function public.assert_payment_method(uuid, text)       from authenticated;
revoke execute on function public.resolve_cash_session(uuid, uuid, uuid)  from authenticated;
