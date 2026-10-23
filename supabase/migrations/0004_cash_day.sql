-- =====================================================================
-- 0004_cash_day.sql — Journée de caisse : droits, traçabilité, rapport Z
-- =====================================================================

-- Rôles qui tiennent la caisse (le magasinier n'encaisse pas).
create or replace function public.can_sell(p_org uuid) returns boolean
language sql stable set search_path = public as $$ select public.has_role(p_org, array['owner','manager','cashier']::public.member_role[]); $$;

-- ---------------------------------------------------------------------
-- Ouverture : réservée aux rôles de caisse, tracée dans le journal d'audit.
-- Idempotente : si la boutique a déjà une caisse ouverte, on la renvoie.
-- ---------------------------------------------------------------------
create or replace function public.open_cash_session(p_org uuid, p_store uuid, p_opening_float bigint default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_sell(p_org) then raise exception 'Accès refusé'; end if;
  if not exists (select 1 from stores where id = p_store and organization_id = p_org and is_active) then
    raise exception 'Boutique inconnue';
  end if;
  if coalesce(p_opening_float, 0) < 0 then raise exception 'Fond de caisse invalide'; end if;
  -- verrou par boutique : deux ouvertures simultanées ne créent qu'une session
  perform pg_advisory_xact_lock(hashtextextended('cash:' || p_store::text, 0));
  select id into v_id from cash_sessions where store_id = p_store and status = 'open';
  if found then return v_id; end if;
  insert into cash_sessions(organization_id, store_id, opened_by, opening_float)
  values (p_org, p_store, auth.uid(), coalesce(p_opening_float, 0))
  returning id into v_id;

  insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
  values (p_org, auth.uid(), 'cash.open', 'cash_sessions', v_id,
          jsonb_build_object('store_id', p_store, 'opening_float', coalesce(p_opening_float, 0)));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Clôture : même calcul qu'en 0001, réservée aux rôles de caisse.
-- ---------------------------------------------------------------------
create or replace function public.close_cash_session(p_session uuid, p_counted_cash bigint, p_notes text default null)
returns public.cash_sessions language plpgsql security definer set search_path = public as $$
declare v_s cash_sessions%rowtype; v_expected bigint;
begin
  select * into v_s from cash_sessions where id = p_session for update;
  if not found then raise exception 'Session introuvable'; end if;
  if not public.can_sell(v_s.organization_id) then raise exception 'Accès refusé'; end if;
  if v_s.status = 'closed' then raise exception 'Caisse déjà clôturée'; end if;
  if p_counted_cash is null or p_counted_cash < 0 then raise exception 'Montant compté invalide'; end if;

  v_expected := public.session_expected_cash(p_session);

  update cash_sessions
     set status = 'closed', closed_by = auth.uid(), closed_at = now(),
         expected_cash = v_expected, counted_cash = p_counted_cash,
         difference = p_counted_cash - v_expected, notes = nullif(trim(p_notes), '')
   where id = p_session
  returning * into v_s;

  insert into audit_log(organization_id, user_id, action, entity, entity_id, data)
  values (v_s.organization_id, auth.uid(), 'cash.close', 'cash_sessions', p_session,
          jsonb_build_object('expected', v_expected, 'counted', p_counted_cash, 'difference', v_s.difference));
  return v_s;
end $$;

-- Espèces attendues dans le tiroir : fond de caisse + encaissements nets en espèces − dépenses en espèces.
create or replace function public.session_expected_cash(p_session uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select s.opening_float
       + coalesce((select sum(amount) from payments where cash_session_id = s.id and method = 'cash'), 0)
       - coalesce((select sum(amount) from expenses where cash_session_id = s.id and method = 'cash'), 0)
    from cash_sessions s where s.id = p_session
$$;

-- ---------------------------------------------------------------------
-- Résumé d'une journée de caisse (écran de clôture et rapport Z).
-- Aucun coût ni marge : lisible par le vendeur.
-- ---------------------------------------------------------------------
create or replace function public.cash_session_summary(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_s cash_sessions%rowtype; v_result jsonb;
begin
  select * into v_s from cash_sessions where id = p_session;
  if not found then raise exception 'Session introuvable'; end if;
  if not public.is_member(v_s.organization_id) then raise exception 'Accès refusé'; end if;

  select jsonb_build_object(
    'session', to_jsonb(v_s),
    'store_name', (select name from stores where id = v_s.store_id),
    'opened_by_name', (select display_name from organization_members
                        where organization_id = v_s.organization_id and user_id = v_s.opened_by),
    'closed_by_name', (select display_name from organization_members
                        where organization_id = v_s.organization_id and user_id = v_s.closed_by),
    'sales_count',     (select count(*) from sales where cash_session_id = p_session and status = 'completed'),
    'sales_total',     (select coalesce(sum(total), 0) from sales where cash_session_id = p_session and status = 'completed'),
    'discounts',       (select coalesce(sum(discount_total), 0) from sales where cash_session_id = p_session and status = 'completed'),
    'credit_given',    (select coalesce(sum(balance_due), 0) from sales where cash_session_id = p_session and status = 'completed'),
    'cancelled_count', (select count(*) from sales where cash_session_id = p_session and status = 'cancelled'),
    'payments', coalesce((
        select jsonb_agg(t.row order by t.method)
          from (select method, jsonb_build_object(
                         'method', method,
                         'sales',      coalesce(sum(amount) filter (where kind = 'sale'), 0),
                         'repayments', coalesce(sum(amount) filter (where kind = 'credit_repayment'), 0),
                         'refunds',    coalesce(sum(amount) filter (where kind = 'refund'), 0),
                         'net',        sum(amount)) as row
                  from payments where cash_session_id = p_session group by method) t), '[]'::jsonb),
    'expenses_cash', (select coalesce(sum(amount), 0) from expenses where cash_session_id = p_session and method = 'cash'),
    'expected_cash', case when v_s.status = 'closed' then v_s.expected_cash else public.session_expected_cash(p_session) end
  ) into v_result;
  return v_result;
end $$;


-- ---------------------------------------------------------------------
-- Ventes, remboursements de crédit, dépenses : réservés aux rôles de caisse
-- (CLAUDE.md §4 : le magasinier ne vend pas). Corps identique à 0001, seul
-- le contrôle d'accès change : is_member → can_sell.
-- ---------------------------------------------------------------------
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
  if not public.can_sell(v_org) then raise exception 'Accès refusé'; end if;
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

create or replace function public.record_credit_repayment(p_id uuid, p_org uuid, p_store uuid, p_session uuid,
                                                          p_customer uuid, p_method text, p_amount bigint,
                                                          p_reference text default null,
                                                          p_created_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_rows int;
begin
  if p_id is null then raise exception 'Identifiant manquant'; end if;
  if not public.can_sell(p_org) then raise exception 'Accès refusé'; end if;
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
  if not public.can_sell(v_org) then raise exception 'Accès refusé'; end if;
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

revoke execute on function public.session_expected_cash(uuid) from public, anon, authenticated;
revoke execute on function public.can_sell(uuid) from public, anon;
grant  execute on function public.can_sell(uuid) to authenticated, service_role;
revoke execute on function public.cash_session_summary(uuid) from public, anon;
grant  execute on function public.cash_session_summary(uuid) to authenticated, service_role;
revoke execute on function public.open_cash_session(uuid, uuid, bigint) from public, anon;
grant  execute on function public.open_cash_session(uuid, uuid, bigint) to authenticated, service_role;
revoke execute on function public.close_cash_session(uuid, bigint, text) from public, anon;
grant  execute on function public.close_cash_session(uuid, bigint, text) to authenticated, service_role;
