-- =====================================================================
-- 0002_products_import.sql — Produits : import en masse et stock d'ouverture unique
-- =====================================================================

-- Une catégorie racine porte un nom unique dans l'organisation (sert à l'import).
create unique index categories_org_root_name_uq
  on public.categories (organization_id, lower(name)) where parent_id is null;

-- Recherche rapide du stock d'ouverture d'un produit dans une boutique.
create index stock_mov_opening_idx
  on public.stock_movements (organization_id, product_id, store_id) where type = 'opening';

-- ---------------------------------------------------------------------
-- Stock d'ouverture : une seule saisie par produit et par boutique.
-- Une correction ultérieure passe par record_stock_adjustment (motif + audit).
-- ---------------------------------------------------------------------
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

  -- verrou par produit : deux saisies simultanées ne créent pas deux stocks d'ouverture
  perform pg_advisory_xact_lock(hashtextextended(p_product::text || p_store::text, 0));
  if exists (select 1 from stock_movements
              where organization_id = p_org and product_id = p_product and store_id = p_store and type = 'opening') then
    raise exception 'Stock d''ouverture déjà saisi pour ce produit dans cette boutique : utilisez un ajustement';
  end if;

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

-- ---------------------------------------------------------------------
-- Import de produits (saisie initiale du magasin depuis un fichier CSV / Excel)
-- p_rows = [{ name, sku?, barcode?, category?, brand?, unit?, allow_decimal_qty?,
--             sale_price?, wholesale_price?, min_stock?, opening_qty?, unit_cost? }]
-- Rapprochement : par référence (sku), sinon par code-barres ; sinon création.
-- Les catégories absentes sont créées. Tout ou rien : une ligne invalide annule l'import.
-- Le stock d'ouverture n'est saisi qu'une fois par produit et par boutique :
-- réimporter le même fichier ne double pas le stock.
-- ---------------------------------------------------------------------
create or replace function public.import_products(p_org uuid, p_store uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb; v_line int := 0;
  v_name text; v_sku text; v_barcode text; v_cat_name text; v_brand text; v_unit text; v_decimal boolean;
  v_price bigint; v_wholesale bigint; v_min numeric; v_qty numeric; v_cost numeric;
  v_cat uuid; v_product uuid;
  v_created int := 0; v_updated int := 0; v_stock int := 0; v_stock_skipped int := 0; v_cats int := 0;
begin
  if not public.is_manager(p_org) then raise exception 'Accès refusé'; end if;
  if not exists (select 1 from stores where id = p_store and organization_id = p_org and is_active) then
    raise exception 'Boutique inconnue';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Format d''import invalide'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Maximum 5000 lignes par import'; end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    begin
      v_name      := nullif(trim(v_row->>'name'), '');
      v_sku       := nullif(trim(v_row->>'sku'), '');
      v_barcode   := nullif(trim(v_row->>'barcode'), '');
      v_cat_name  := nullif(trim(v_row->>'category'), '');
      v_brand     := nullif(trim(v_row->>'brand'), '');
      v_unit      := nullif(trim(v_row->>'unit'), '');
      v_decimal   := (v_row->>'allow_decimal_qty')::boolean;
      v_price     := (v_row->>'sale_price')::bigint;
      v_wholesale := (v_row->>'wholesale_price')::bigint;
      v_min       := (v_row->>'min_stock')::numeric;
      v_qty       := (v_row->>'opening_qty')::numeric;
      v_cost      := (v_row->>'unit_cost')::numeric;
    exception when others then
      raise exception 'Ligne % : valeur invalide', v_line;
    end;

    if v_name is null then raise exception 'Ligne % : nom obligatoire', v_line; end if;
    if v_price < 0 or v_wholesale < 0 or v_min < 0 or v_qty < 0 or v_cost < 0 then
      raise exception 'Ligne % : valeur négative', v_line;
    end if;

    v_cat := null;
    if v_cat_name is not null then
      select id into v_cat from categories
       where organization_id = p_org and parent_id is null and lower(name) = lower(v_cat_name);
      if not found then
        insert into categories(organization_id, name) values (p_org, v_cat_name) returning id into v_cat;
        v_cats := v_cats + 1;
      end if;
    end if;

    v_product := null;
    if v_sku is not null then
      select id into v_product from products where organization_id = p_org and sku = v_sku;
    end if;
    if v_product is null and v_barcode is not null then
      select id into v_product from products where organization_id = p_org and barcode = v_barcode;
    end if;

    begin
      if v_product is null then
        insert into products(organization_id, category_id, sku, barcode, name, brand, unit, allow_decimal_qty,
                             sale_price, wholesale_price, min_stock)
        values (p_org, v_cat, v_sku, v_barcode, v_name, v_brand, coalesce(v_unit, 'pièce'), coalesce(v_decimal, false),
                coalesce(v_price, 0), v_wholesale, coalesce(v_min, 0))
        returning id into v_product;
        v_created := v_created + 1;
      else
        update products set
          name              = v_name,
          category_id       = coalesce(v_cat, category_id),
          sku               = coalesce(v_sku, sku),
          barcode           = coalesce(v_barcode, barcode),
          brand             = coalesce(v_brand, brand),
          unit              = coalesce(v_unit, unit),
          allow_decimal_qty = coalesce(v_decimal, allow_decimal_qty),
          sale_price        = coalesce(v_price, sale_price),
          wholesale_price   = coalesce(v_wholesale, wholesale_price),
          min_stock         = coalesce(v_min, min_stock)
         where id = v_product;
        v_updated := v_updated + 1;
      end if;
    exception when unique_violation then
      raise exception 'Ligne % : référence ou code-barres déjà utilisé par un autre produit', v_line;
    end;

    if v_qty > 0 then
      if exists (select 1 from stock_movements
                  where organization_id = p_org and product_id = v_product and store_id = p_store and type = 'opening') then
        v_stock_skipped := v_stock_skipped + 1;
      else
        perform public.set_opening_stock(p_org, p_store, v_product, v_qty, v_cost);
        v_stock := v_stock + 1;
      end if;
    end if;
  end loop;

  insert into audit_log(organization_id, user_id, action, entity, data)
  values (p_org, auth.uid(), 'products.import', 'products',
          jsonb_build_object('rows', v_line, 'created', v_created, 'updated', v_updated,
                             'stock_entries', v_stock, 'stock_skipped', v_stock_skipped,
                             'categories_created', v_cats, 'store_id', p_store));

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'stock_entries', v_stock,
                            'stock_skipped', v_stock_skipped, 'categories_created', v_cats);
end $$;

revoke execute on function public.import_products(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.import_products(uuid, uuid, jsonb) to authenticated, service_role;
