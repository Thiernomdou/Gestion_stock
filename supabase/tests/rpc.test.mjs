import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

// Applique toutes les migrations dans l'ordre, comme sur Supabase.
const MIG_DIR = new URL('../migrations/', import.meta.url);
const MIGRATIONS = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
const db = new PGlite();

// --- Stubs Supabase ---
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to public;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to authenticated;
`);
for (const file of MIGRATIONS) {
  await db.exec(fs.readFileSync(new URL(file, MIG_DIR), 'utf8').replace(/create extension[^;]*;/, ''));
  console.log('✔ migration appliquée :', file);
}
await db.exec(`grant all on all tables in schema public to authenticated, service_role;`);

const U = { owner: '11111111-1111-1111-1111-111111111111', cashier: '22222222-2222-2222-2222-222222222222',
            ownerB: '33333333-3333-3333-3333-333333333333', stock: '44444444-4444-4444-4444-444444444444' };
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users values ($1, $2, now())', [id, k + '@test.gn']);

let fails = 0;
async function as(uid, q, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return (await db.query(q, params)).rows; } finally { await db.exec('reset role'); }
}
async function ok(label, fn) {
  try { const r = await fn(); console.log('✔', label); return r; }
  catch (e) { fails++; console.log('✘', label, '→', e.message); }
}
async function ko(label, fn, re) {
  try { await fn(); fails++; console.log('✘', label, '→ aucune erreur'); }
  catch (e) {
    if (re && !re.test(e.message)) { fails++; console.log('✘', label, '→ mauvaise erreur :', e.message); }
    else console.log('✔', label, '→', e.message);
  }
}
const eq = (a, b, label) => { if (String(a) !== String(b)) throw new Error(`${label}: attendu ${b}, obtenu ${a}`); };
const uuid = () => crypto.randomUUID();
const one = async (uid, q, p) => (await as(uid, q, p))[0];

// --- Organisation A ---
const org = (await one(U.owner, `select create_organization('Quincaillerie A','qa') as id`)).id;
const store = (await one(U.owner, `select id from stores where organization_id=$1`, [org])).id;
await as(U.owner, `insert into organization_members(organization_id,user_id,role) values ($1,$2,'cashier'),($1,$3,'storekeeper')`, [org, U.cashier, U.stock]);
const orgB = (await one(U.ownerB, `select create_organization('Quincaillerie B','qb') as id`)).id;
const storeB = (await one(U.ownerB, `select id from stores where organization_id=$1`, [orgB])).id;

const P1 = uuid(), P2 = uuid();
await as(U.owner, `insert into products(id,organization_id,name,sale_price,wholesale_price) values ($1,$3,'Robinet',10000,9000),($2,$3,'Câble 2,5mm',5000,null)`, [P1, P2, org]);

// --- Stock d'ouverture et CMP ---
const depot = (await one(U.owner, `insert into stores(organization_id,name) values ($1,'Dépôt') returning id`, [org])).id;
await ok('stock d\'ouverture dans deux boutiques + CMP', async () => {
  await as(U.owner, `select set_opening_stock($1,$2,$3,10,6000)`, [org, store, P1]);
  await as(U.owner, `select set_opening_stock($1,$2,$3,10,8000)`, [org, depot, P1]);
  await as(U.owner, `select set_opening_stock($1,$2,$3,100,2000)`, [org, store, P2]);
  eq((await one(U.owner, `select avg_cost from product_costs where product_id=$1`, [P1])).avg_cost, '7000.00', 'CMP');
});
await ko('stock d\'ouverture saisi deux fois dans la même boutique',
  () => as(U.owner, `select set_opening_stock($1,$2,$3,5,6000)`, [org, store, P1]), /déjà saisi/);
await ko('stock d\'ouverture dans une boutique d\'une autre org', () => as(U.owner, `select set_opening_stock($1,$2,$3,1,1)`, [org, storeB, P1]), /Boutique inconnue/);
await ko('vendeur : pas de stock d\'ouverture', () => as(U.cashier, `select set_opening_stock($1,$2,$3,1,1)`, [org, store, P1]), /Accès refusé/);

// --- Caisse et ventes ---
const sess = (await one(U.cashier, `select open_cash_session($1,$2,50000) as id`, [org, store])).id;
const sale = (o = {}) => JSON.stringify({ id: uuid(), organization_id: org, store_id: store, cash_session_id: sess,
  items: [{ product_id: P1, quantity: 2, unit_price: 10000 }], payments: [{ method: 'cash', amount: 20000 }], ...o });

const s1 = sale();
await ok('vente au comptant', () => as(U.cashier, `select create_sale($1::jsonb)`, [s1]));
await ok('renvoi idempotent (pas de doublon, pas de trou de numéro)', async () => {
  await as(U.cashier, `select create_sale($1::jsonb)`, [s1]);
  eq((await one(U.owner, `select count(*) c from sales where organization_id=$1`, [org])).c, 1, 'nb ventes');
  eq((await one(U.owner, `select max(number) n from sales where organization_id=$1`, [org])).n, 'V-000001', 'numéro');
});
await ok('vente au prix de gros par le vendeur', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ items: [{ product_id: P1, quantity: 1, unit_price: 9000 }], payments: [{ method: 'orange_money', amount: 9000 }] })]));
await ok('câble au mètre (12,5 m)', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ items: [{ product_id: P2, quantity: 12.5, unit_price: 5000 }], payments: [{ method: 'cash', amount: 62500 }] })]));
await ko('vendeur : prix arbitraire', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ items: [{ product_id: P1, quantity: 1, unit_price: 1 }], payments: [{ method: 'cash', amount: 1 }] })]), /Prix non autorisé/);
await ko('remise globale négative', () => as(U.cashier, `select create_sale($1::jsonb)`, [sale({ global_discount: -5000 })]), /Remise invalide/);
await ko('vendeur : remise interdite par les paramètres', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ global_discount: 1000, payments: [{ method: 'cash', amount: 19000 }] })]), /Remise non autorisée/);
await ok('gérant : prix libre', () => as(U.owner, `select create_sale($1::jsonb)`,
  [sale({ items: [{ product_id: P1, quantity: 1, unit_price: 7500 }], payments: [{ method: 'cash', amount: 7500 }] })]));

await as(U.owner, `update organizations set settings = settings || '{"cashier_can_discount":true}' where id=$1`, [org]);
await ok('vendeur : remise de 10 % autorisée', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ global_discount: 2000, payments: [{ method: 'cash', amount: 18000 }] })]));
await ko('vendeur : remise de 15 % refusée', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ global_discount: 3000, payments: [{ method: 'cash', amount: 17000 }] })]), /maximum autorisé/);
await ko('mode de paiement inconnu', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ payments: [{ method: 'bitcoin', amount: 20000 }] })]), /Mode de paiement non autorisé/);

// Ancien prix accepté pour une vente faite avant le changement de prix
const before = new Date(Date.now() - 60000).toISOString();
await as(U.owner, `update products set sale_price = 11000 where id=$1`, [P1]);
await ok('hors ligne : ancien prix accepté si la vente précède le changement', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ created_at: before })]));
await ko('ancien prix refusé pour une vente après le changement', () => as(U.cashier, `select create_sale($1::jsonb)`, [sale()]), /Prix non autorisé/);

// Crédit
const C1 = uuid();
await as(U.cashier, `insert into customers(id,organization_id,name) values ($1,$2,'Mamadou plombier')`, [C1, org]);
await as(U.owner, `update customers set credit_limit = 30000 where id=$1`, [C1]);
await ko('crédit sans client', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ items: [{ product_id: P1, quantity: 1, unit_price: 11000 }], payments: [] })]), /client obligatoire/);
await ok('crédit avec client', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ customer_id: C1, items: [{ product_id: P1, quantity: 2, unit_price: 11000 }], payments: [{ method: 'cash', amount: 2000 }] })]));
await ko('plafond de crédit dépassé', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ customer_id: C1, items: [{ product_id: P1, quantity: 1, unit_price: 11000 }], payments: [] })]), /Plafond de crédit/);
const rep = uuid();
await ok('remboursement de crédit + renvoi idempotent', async () => {
  await as(U.cashier, `select record_credit_repayment($1,$2,$3,$4,$5,'mtn_momo',5000)`, [rep, org, store, sess, C1]);
  await as(U.cashier, `select record_credit_repayment($1,$2,$3,$4,$5,'mtn_momo',5000)`, [rep, org, store, sess, C1]);
  eq((await one(U.cashier, `select balance from customer_balances where customer_id=$1`, [C1])).balance, 15000, 'solde client');
});

// Dépenses
const e1 = JSON.stringify({ id: uuid(), organization_id: org, store_id: store, cash_session_id: sess, category: 'Électricité / carburant', amount: 15000 });
await ok('dépense espèces + renvoi idempotent', async () => {
  await as(U.cashier, `select record_expense($1::jsonb)`, [e1]);
  await as(U.cashier, `select record_expense($1::jsonb)`, [e1]);
  eq((await one(U.owner, `select count(*) c from expenses where organization_id=$1`, [org])).c, 1, 'nb dépenses');
});
await ko('vendeur : insertion directe de dépense interdite', () => as(U.cashier,
  `insert into expenses(organization_id,store_id,category,amount,expense_date) values ($1,$2,'Divers',1,current_date)`, [org, store]));

// Clôture
const z = await ok('clôture de caisse', () => one(U.cashier, `select expected_cash, difference from close_cash_session($1, 100000)`, [sess]));
if (z) console.log('   attendu =', z.expected_cash, '· écart =', z.difference);
await ko('modifier une dépense d\'une caisse clôturée', () => as(U.owner, `update expenses set amount = 1 where organization_id=$1`, [org]), /clôturée/);

// Vente hors ligne synchronisée après la clôture
const late = sale({ created_at: before, items: [{ product_id: P2, quantity: 1, unit_price: 5000 }], payments: [{ method: 'cash', amount: 5000 }] });
await ok('vente tardive sans caisse ouverte → aucune session', async () => {
  await as(U.cashier, `select create_sale($1::jsonb)`, [late]);
  eq((await one(U.owner, `select cash_session_id from sales where id=$1`, [JSON.parse(late).id])).cash_session_id, null, 'session');
});
const sess2 = (await one(U.cashier, `select open_cash_session($1,$2,0) as id`, [org, store])).id;
const late2 = sale({ items: [{ product_id: P2, quantity: 1, unit_price: 5000 }], payments: [{ method: 'cash', amount: 5000 }] });
await ok('vente tardive → rattachée à la caisse ouverte + audit', async () => {
  await as(U.cashier, `select create_sale($1::jsonb)`, [late2]);
  eq((await one(U.owner, `select cash_session_id from sales where id=$1`, [JSON.parse(late2).id])).cash_session_id, sess2, 'session');
  eq((await one(U.owner, `select count(*) c from audit_log where action='sale.session_reassigned'`)).c, 2, 'audits');
});
await ko('session d\'une autre boutique', () => as(U.ownerB, `select record_expense($1::jsonb)`,
  [JSON.stringify({ id: uuid(), organization_id: orgB, store_id: storeB, cash_session_id: sess2, category: 'Divers', amount: 1 })]), /Session de caisse inconnue/);

// Stock négatif interdit
await as(U.owner, `update organizations set settings = settings || '{"allow_negative_stock":false}' where id=$1`, [org]);
await ko('stock insuffisant', () => as(U.cashier, `select create_sale($1::jsonb)`,
  [sale({ cash_session_id: sess2, items: [{ product_id: P2, quantity: 1000, unit_price: 5000 }], payments: [{ method: 'cash', amount: 5000000 }] })]), /Stock insuffisant/);

// Annulation
await ko('vendeur : annulation interdite', () => as(U.cashier, `select cancel_sale($1,'erreur')`, [JSON.parse(s1).id]), /gérant/);
await ok('gérant : annulation → stock remis + remboursement', async () => {
  const before = (await one(U.owner, `select quantity from product_stock where product_id=$1 and store_id=$2`, [P1, store])).quantity;
  await as(U.owner, `select cancel_sale($1,'erreur de saisie')`, [JSON.parse(s1).id]);
  const after = (await one(U.owner, `select quantity from product_stock where product_id=$1 and store_id=$2`, [P1, store])).quantity;
  eq(Number(after) - Number(before), 2, 'stock remis');
  eq((await one(U.owner, `select sum(amount) s from payments where sale_id=$1`, [JSON.parse(s1).id])).s, 0, 'solde paiements');
});

// Ajustements
await ok('perte saisie en positif → sortie de stock', async () => {
  await as(U.stock, `select record_stock_adjustment($1,$2,$3,3,'loss','casse')`, [org, store, P2]);
  eq((await one(U.owner, `select quantity from stock_movements where type='loss'`)).quantity, '-3.000', 'signe');
});

// Achats
const PU = uuid();
await as(U.owner, `insert into purchases(id,organization_id,store_id,origin,currency,exchange_rate) values ($1,$2,$3,'import','CNY',1200)`, [PU, org, store]);
await as(U.owner, `insert into purchase_items(organization_id,purchase_id,product_id,quantity,unit_price_foreign) values ($1,$2,$3,10,5)`, [org, PU, P1]);
await as(U.owner, `insert into purchase_costs(organization_id,purchase_id,label,amount) values ($1,$2,'Fret',30000)`, [org, PU]);
await ko('réception directe par update interdite', () => as(U.owner, `update purchases set status='received' where id=$1`, [PU]), /receive_purchase/);
await ok('réception : coût de revient = 5 × 1200 × (1 + 30000/60000) = 9000', async () => {
  await as(U.owner, `select receive_purchase($1)`, [PU]);
  eq((await one(U.owner, `select landed_unit_cost from purchase_items where purchase_id=$1`, [PU])).landed_unit_cost, '9000.00', 'coût');
});
await ko('achat réceptionné : retour en brouillon interdit', () => as(U.owner, `update purchases set status='draft' where id=$1`, [PU]), /modification impossible/);
await ko('achat réceptionné : ajout de ligne interdit', () => as(U.owner,
  `insert into purchase_items(organization_id,purchase_id,product_id,quantity,unit_price_foreign) values ($1,$2,$3,1,1)`, [org, PU, P1]), /modification impossible/);
await ko('autre org : ligne d\'achat vers un produit de A', async () => {
  const PB = uuid();
  await as(U.ownerB, `insert into purchases(id,organization_id,store_id) values ($1,$2,$3)`, [PB, orgB, storeB]);
  await as(U.ownerB, `insert into purchase_items(organization_id,purchase_id,product_id,quantity,unit_price_foreign) values ($1,$2,$3,1,1)`, [orgB, PB, P1]);
}, /Référence invalide/);
await ko('vendeur : lecture des coûts', async () => {
  const r = await as(U.cashier, `select * from product_costs`);
  if (r.length === 0) throw new Error('0 ligne visible');
}, /0 ligne/);

// Inventaire : vente entre comptage et validation
await as(U.owner, `update organizations set settings = settings || '{"allow_negative_stock":true}' where id=$1`, [org]);
const IC = uuid();
await as(U.stock, `insert into inventory_counts(id,organization_id,store_id) values ($1,$2,$3)`, [IC, org, store]);
const stockNow = Number((await one(U.owner, `select quantity from product_stock where product_id=$1 and store_id=$2`, [P2, store])).quantity);
await as(U.stock, `insert into inventory_count_items(organization_id,count_id,product_id,counted_qty) values ($1,$2,$3,$4)`, [org, IC, P2, stockNow - 1]);
await as(U.cashier, `select create_sale($1::jsonb)`, [sale({ cash_session_id: sess2, items: [{ product_id: P2, quantity: 2, unit_price: 5000 }], payments: [{ method: 'cash', amount: 10000 }] })]);
await ko('magasinier : validation directe interdite', () => as(U.stock, `update inventory_counts set status='validated' where id=$1`, [IC]), /validate_inventory/);
await ok('inventaire : écart = -1 malgré la vente de 2 pendant le comptage', async () => {
  await as(U.owner, `select validate_inventory($1)`, [IC]);
  eq((await one(U.owner, `select quantity from stock_movements where reference_id=$1`, [IC])).quantity, '-1.000', 'écart');
});
await ko('inventaire validé : réouverture interdite', () => as(U.stock, `update inventory_counts set status='open' where id=$1`, [IC]), /modification impossible/);

// Import de produits (0002)
const importRows = (rows) => JSON.stringify(rows);
await ok('import : création, catégories, stock d\'ouverture', async () => {
  const r = (await one(U.owner, `select import_products($1,$2,$3::jsonb) r`, [org, store, importRows([
    { name: 'Tuyau PVC 32', sku: 'PVC-32', category: 'Plomberie', unit: 'mètre', allow_decimal_qty: true,
      sale_price: 12000, opening_qty: 50, unit_cost: 7000 },
    { name: 'Ampoule LED 9W', barcode: '6901234567890', category: 'plomberie ', sale_price: 15000, opening_qty: 30 },
    { name: 'Disjoncteur 16A', category: 'Électricité', sale_price: 45000, wholesale_price: 40000, min_stock: 5 },
  ])])).r;
  eq(JSON.stringify(r), JSON.stringify({ created: 3, updated: 0, stock_entries: 2, stock_skipped: 0, categories_created: 2 }), 'résultat');
  eq((await one(U.owner, `select avg_cost from product_costs pc join products p on p.id=pc.product_id where p.sku='PVC-32'`)).avg_cost, '7000.00', 'coût');
});
await ok('réimport du même fichier : mise à jour sans doubler le stock', async () => {
  const r = (await one(U.owner, `select import_products($1,$2,$3::jsonb) r`, [org, store, importRows([
    { name: 'Tuyau PVC 32 mm', sku: 'PVC-32', sale_price: 12500, opening_qty: 50 },
  ])])).r;
  eq(r.updated, 1, 'mis à jour'); eq(r.stock_skipped, 1, 'stock ignoré');
  const p = await one(U.owner, `select p.name, p.sale_price, p.unit, s.quantity from products p join product_stock s on s.product_id=p.id where p.sku='PVC-32'`);
  eq(p.name, 'Tuyau PVC 32 mm', 'nom'); eq(p.sale_price, 12500, 'prix'); eq(p.unit, 'mètre', 'unité conservée'); eq(p.quantity, '50.000', 'stock');
});
await ko('import : tout ou rien si une ligne est invalide', async () => {
  try {
    await as(U.owner, `select import_products($1,$2,$3::jsonb)`, [org, store, importRows([
      { name: 'Produit OK', sku: 'OK-1', sale_price: 1000 }, { name: '', sale_price: 1 },
    ])]);
  } finally {
    eq((await one(U.owner, `select count(*) c from products where sku='OK-1'`)).c, 0, 'aucune ligne importée');
  }
}, /Ligne 2 : nom obligatoire/);
await ko('import : prix non numérique', () => as(U.owner, `select import_products($1,$2,$3::jsonb)`,
  [org, store, importRows([{ name: 'X', sale_price: 'douze' }])]), /Ligne 1 : valeur invalide/);
await ko('import : code-barres déjà pris par un autre produit', () => as(U.owner, `select import_products($1,$2,$3::jsonb)`,
  [org, store, importRows([{ name: 'Autre', sku: 'NEW-9', barcode: '6901234567890' }, { name: 'Tuyau', sku: 'PVC-32', barcode: '6901234567890' }])]),
  /Ligne 2 : référence ou code-barres déjà utilisé/);
await ko('vendeur : import interdit', () => as(U.cashier, `select import_products($1,$2,$3::jsonb)`,
  [org, store, importRows([{ name: 'X' }])]), /Accès refusé/);
await ko('anon : import interdit', () => as(null, `select import_products($1,$2,$3::jsonb)`,
  [org, store, importRows([{ name: 'X' }])]), /permission denied/);

// Invitations
const U5 = '55555555-5555-5555-5555-555555555555', U6 = '66666666-6666-6666-6666-666666666666';
await db.query(`insert into auth.users values ($1, 'aminata@test.gn', now()), ($2, 'faux@test.gn', null)`, [U5, U6]);
await ko('vendeur : invitation interdite', () => as(U.cashier,
  `insert into organization_invitations(organization_id,email,role) values ($1,'x@test.gn','cashier')`, [org]));
await ok('patron : invitation + acceptation à la connexion', async () => {
  await as(U.owner, `insert into organization_invitations(organization_id,email,role,display_name) values ($1,'aminata@test.gn','cashier','Aminata')`, [org]);
  eq((await one(U5, `select accept_invitations() n`)).n, 1, 'organisations rejointes');
  eq((await one(U5, `select role, display_name from organization_members where user_id=$1`, [U5])).display_name, 'Aminata', 'nom');
  eq((await one(U5, `select accept_invitations() n`)).n, 0, 'deuxième appel');
});
await ok('e-mail non confirmé : invitation non acceptée', async () => {
  await as(U.owner, `insert into organization_invitations(organization_id,email) values ($1,'faux@test.gn')`, [org]);
  eq((await one(U6, `select accept_invitations() n`)).n, 0, 'organisations rejointes');
});
await ko('invitation en double', () => as(U.owner, `insert into organization_invitations(organization_id,email) values ($1,'faux@test.gn')`, [org]), /duplicate|unique/);
await ko('e-mail mal formé', () => as(U.owner, `insert into organization_invitations(organization_id,email) values ($1,'Pas Un Email')`, [org]), /check/);
await ko('slug déjà utilisé', () => as(U5, `select create_organization('Autre','qa')`), /déjà utilisé/);

// Membres, audit, droits
await ko('dernier patron : rétrogradation interdite', () => as(U.owner, `update organization_members set role='manager' where user_id=$1`, [U.owner]), /patron/);
await ok('journal d\'audit invisible pour un gérant', async () => {
  await as(U.owner, `update organization_members set role='manager' where user_id=$1`, [U.cashier]);
  eq((await as(U.cashier, `select * from audit_log`)).length, 0, 'lignes visibles');
  await as(U.owner, `update organization_members set role='cashier' where user_id=$1`, [U.cashier]);
});
await ko('anon : create_sale interdit', () => as(null, `select create_sale($1::jsonb)`, [sale()]), /permission denied/);
await ko('connecté : next_number interdit', () => as(U.cashier, `select next_number($1,'sale','V-')`, [org]), /permission denied/);
await ko('isolation : B ne voit rien de A', async () => {
  const r = await as(U.ownerB, `select (select count(*) from sales where organization_id=$1) + (select count(*) from products where organization_id=$1) c`, [org]);
  if (Number(r[0].c) === 0) throw new Error('0 ligne');
}, /0 ligne/);

// --- Photos des produits (Storage) ---
const photo = (o) => `${o}/${P1}/${uuid()}.webp`;
await ok('patron : photo dans le dossier de son organisation', () =>
  as(U.owner, `insert into storage.objects(bucket_id,name) values ('product-photos',$1)`, [photo(org)]));
await ko('vendeur : envoi de photo interdit', () =>
  as(U.cashier, `insert into storage.objects(bucket_id,name) values ('product-photos',$1)`, [photo(org)]), /row-level security/);
await ko('autre organisation : envoi dans le dossier de A interdit', () =>
  as(U.ownerB, `insert into storage.objects(bucket_id,name) values ('product-photos',$1)`, [photo(org)]), /row-level security/);
await ko('chemin sans organisation interdit', () =>
  as(U.owner, `insert into storage.objects(bucket_id,name) values ('product-photos','divers/photo.webp')`), /row-level security/);
await ko('autre organisation : suppression de la photo de A sans effet', async () => {
  await as(U.ownerB, `delete from storage.objects where bucket_id='product-photos'`);
  const r = await one(U.owner, `select count(*) c from storage.objects`);
  if (Number(r.c) === 1) throw new Error('photo conservée');
}, /photo conservée/);

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent');
process.exit(fails ? 1 : 0);
