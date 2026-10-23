# CLAUDE.md — Application de gestion de quincaillerie (plomberie · électricité · luminaires)

> Nom provisoire : **[NOM_APP]**. Langue de l'interface : **français**. Devise par défaut : **GNF**.

## 1. Le projet en une phrase

Une application web installable (PWA), utilisable sur ordinateur et sur téléphone, qui permet à un commerçant de quincaillerie de :
- saisir tout son stock ;
- enregistrer ses achats (en Chine et chez les fournisseurs locaux) avec leur coût de revient réel ;
- vendre à la caisse ;
- savoir **exactement, chaque jour**, ce qu'il a vendu, encaissé, dépensé et gagné.

**Stratégie produit** : un premier client pilote à Conakry, puis une revente en abonnement (SaaS) à d'autres commerçants du même secteur. **L'application est donc multi-clients (multi-tenant) dès le premier jour.** Rien ne doit être codé « en dur » pour le client pilote : tout ce qui varie d'un commerçant à l'autre passe par les paramètres de l'organisation.

## 2. Contraintes terrain (non négociables)

- **Internet et électricité instables** : la caisse doit fonctionner **hors ligne**. Les ventes, les dépenses et les remboursements de crédit sont enregistrés localement, puis synchronisés au retour du réseau.
- **Téléphones Android d'entrée de gamme** : bundle léger, peu d'animations, aucune dépendance lourde. On teste à 360 px de large.
- **Utilisateurs peu habitués aux logiciels** : gros boutons, peu de texte, icônes claires, montants très lisibles, confirmation avant toute action irréversible.
- **Montants en GNF très élevés** (des millions) : affichage avec séparateur d'espaces, par exemple `1 250 000 GNF`, sans décimales.
- **Paiements** : espèces, Orange Money, MTN MoMo, virement, et **vente à crédit** (très fréquente avec les artisans).

## 3. Stack technique

| Couche | Choix |
|---|---|
| Front | React 18+ · Vite · TypeScript (strict) |
| UI | Tailwind CSS · shadcn/ui · lucide-react |
| Routing | React Router |
| Données serveur | Supabase (PostgreSQL, Auth, Storage, RPC) via `@supabase/supabase-js` |
| Données locales / hors ligne | Dexie.js (IndexedDB) + file de synchronisation maison (voir §6) |
| État et requêtes | TanStack Query (cache) + Zustand (panier de caisse, session) |
| Formulaires | react-hook-form + zod |
| PWA | vite-plugin-pwa (Workbox) |
| Scan code-barres | html5-qrcode |
| Impression | ticket 58/80 mm via CSS d'impression + react-to-print ; PDF A4 pour factures et rapports |
| Graphiques | Recharts |
| Dates | date-fns (fuseau de l'organisation, `Africa/Conakry` par défaut) |
| Tests | Vitest + Testing Library ; tests SQL des fonctions RPC sur PGlite (`supabase/tests/rpc.test.mjs`, toutes les migrations dans l’ordre) |
| Hébergement | Vercel ou Netlify (front) + Supabase (back) |

## 4. Architecture multi-tenant

- Chaque client de l'application est une **organisation** (`organizations`).
- Un utilisateur appartient à une ou plusieurs organisations via `organization_members`, avec un rôle.
- **Toutes** les tables métier ont une colonne `organization_id`. La sécurité est assurée par la **RLS de Postgres** : on ne filtre jamais seulement côté front.
- Une organisation peut avoir plusieurs **boutiques ou dépôts** (`stores`). Le stock est suivi par boutique.
- Les paramètres propres à chaque client sont dans `organizations.settings` (jsonb) :
  - `payment_methods` : liste des modes de paiement proposés ;
  - `units` : unités disponibles (pièce, mètre, rouleau, carton, paquet…) ;
  - `allow_negative_stock` : booléen ;
  - `cashier_can_discount` et `max_discount_percent` ;
  - `receipt` : en-tête, pied de page, largeur 58 ou 80 mm ;
  - `expense_categories`.
- Le logo et le nom de l'organisation apparaissent sur les tickets et factures (marque blanche légère).
- Un nouveau client s'inscrit, puis appelle la RPC `create_organization`, qui crée l'organisation, le rattache comme propriétaire et crée une boutique par défaut.

### Rôles

| Rôle | Peut faire |
|---|---|
| `owner` (patron) | Tout, y compris voir les coûts et les marges, gérer les utilisateurs et les paramètres |
| `manager` (gérant) | Tout sauf gérer les utilisateurs et supprimer des données |
| `cashier` (vendeur) | Caisse, clients, encaissement des crédits, dépenses. **Ne voit jamais les prix d'achat ni les marges** |
| `storekeeper` (magasinier) | Consultation du stock, inventaires, ajustements de stock |

Les coûts sont stockés dans des tables séparées (`product_costs`, `sale_costs`, `purchases*`) que seuls `owner` et `manager` peuvent lire. On ne met **jamais** de coût dans une table lisible par un vendeur.

## 5. Règles métier fondamentales

1. **Le stock n'est jamais modifié directement.** Chaque entrée ou sortie est une ligne dans `stock_movements` (quantité signée). Le stock correspond à la vue `product_stock` (somme des mouvements). Types de mouvements : `opening`, `purchase`, `sale`, `sale_cancel`, `customer_return`, `adjustment`, `loss`, `transfer_in`, `transfer_out`.
2. **Montants en entiers (`bigint`) dans la devise de l'organisation.** Les coûts unitaires peuvent avoir 2 décimales (`numeric`). Aucun `float` en JavaScript pour l'argent : on arrondit à l'entier à chaque calcul.
3. **Quantités en `numeric(14,3)`**, pour pouvoir vendre du câble au mètre (par exemple 12,5 m).
4. **Coût de revient d'un arrivage** (Chine ou local) :
   - prix unitaire en devise × taux de change, enregistré sur l'achat ;
   - plus les frais (fret, dédouanement, transport, manutention…) **répartis au prorata de la valeur des articles** ;
   - formule : `coût_unitaire = prix_devise × taux × (1 + total_frais / valeur_marchandises)`.
5. **Coût moyen pondéré (CMP)** recalculé à chaque réception d'achat (RPC `receive_purchase`). Le coût d'une vente est le CMP **au moment de la vente**, figé dans `sale_costs`.
6. **Bénéfice brut** = total de la vente − somme des coûts des articles. **Bénéfice net du jour** = bénéfice brut − dépenses du jour.
7. **Une vente n'est jamais supprimée** : elle est annulée (`cancel_sale`) par un gérant, avec un motif obligatoire. L'annulation remet le stock et crée un remboursement.
8. **Vente à crédit** : un client est obligatoire. Solde client = ventes validées − paiements reçus (vue `customer_balances`).
9. **Toute opération sensible est tracée** dans `audit_log` : annulation, clôture de caisse, réception d'achat, ajustement de stock, changement de prix.
10. **Les écritures critiques passent par des fonctions RPC** (`security definer`), jamais par des `insert` directs depuis le front. Ces fonctions sont : `create_sale`, `cancel_sale`, `receive_purchase`, `open_cash_session`, `close_cash_session`, `record_credit_repayment`, `record_expense`, `set_opening_stock`, `record_stock_adjustment`, `validate_inventory`.
11. **Les règles de l'organisation sont vérifiées côté serveur**, pas seulement dans l'interface. Pour un vendeur, `create_sale` impose :
    - un prix égal au prix de détail ou de gros, ou à l'ancien prix si la vente précède un changement de prix ;
    - les remises définies par `cashier_can_discount` et `max_discount_percent` ;
    - le plafond de crédit du client.

    Pour tous les rôles, elle impose aussi `allow_negative_stock` et `payment_methods`.
12. **Documents figés** : un achat réceptionné ou annulé, un inventaire validé, une dépense d'une caisse clôturée ne sont plus modifiables (triggers `guard_*`). Toute référence vers une autre table (`store_id`, `product_id`…) doit appartenir à la même organisation (trigger `check_org_refs`).

## 6. Mode hors ligne

- Tous les identifiants sont des **UUID générés côté client** (`crypto.randomUUID()`), ce qui permet d'enregistrer hors ligne sans conflit.
- **Données de référence** (produits, prix, stock, clients, catégories) :
  - copiées dans Dexie ;
  - rafraîchies au démarrage, puis toutes les quelques minutes quand le réseau est disponible (filtre `updated_at > dernière_synchro`).
- **Opérations** (ventes, dépenses, remboursements de crédit) :
  - écrites d'abord dans une table Dexie `outbox` (`{id, type, payload, created_at, attempts, last_error}`) ;
  - un « synchroniseur » envoie chaque opération à sa RPC, dans l'ordre ;
  - les RPC sont **idempotentes** : renvoyer la même vente ne la duplique pas.
- Le stock affiché hors ligne vaut : stock serveur − quantités des ventes encore en attente dans l'outbox.
- **Indicateurs à l'écran** :
  - badge « Hors ligne » ;
  - nombre d'opérations en attente ;
  - date de la dernière synchronisation.
- **Rattachement à la journée de caisse** (ventes, remboursements, dépenses en espèces) : une opération synchronisée en retard est rattachée à sa session d'origine si elle est encore ouverte, sinon à la session ouverte de la boutique (ou à aucune). Ce changement est tracé dans `audit_log` (`*.session_reassigned`) pour alerter le gérant. Un rapport Z clôturé ne bouge jamais.
- **Numérotation des ventes** : le numéro définitif (`V-000123`) est attribué par le serveur. Hors ligne, le ticket affiche un numéro provisoire (6 premiers caractères de l'UUID).
- On ne perd **jamais** une opération : en cas d'erreur serveur, elle reste dans l'outbox avec l'erreur, visible par le gérant.

## 7. Modules (écrans)

1. **Tableau de bord du jour** (page d'accueil du patron)
   - Chiffre d'affaires du jour, nombre de ventes, panier moyen.
   - Bénéfice brut, dépenses, bénéfice net.
   - Encaissements par mode de paiement.
   - Crédits accordés et crédits recouvrés.
   - Top 10 des produits vendus du jour.
   - Alertes de stock bas.
   - Sélecteur de période (jour, semaine, mois, personnalisé) et de boutique.
2. **Caisse (point de vente)**
   - Recherche rapide ou scan, catégories en tuiles, panier.
   - Quantité décimale si l'unité le permet.
   - Remise par ligne ou globale, selon les droits.
   - Paiement mixte (par exemple une partie en espèces et une partie en Orange Money), ou à crédit.
   - Ticket imprimé, ou envoyé par WhatsApp (lien ou PDF).
3. **Journée de caisse**
   - **Ouverture** avec fond de caisse.
   - **Clôture** : le vendeur compte ses espèces, l'application calcule l'attendu et affiche l'écart.
   - **Rapport de clôture (Z)** imprimable et partageable.
   - Historique des journées avec leurs écarts.
4. **Journal des ventes** : liste filtrable (date, vendeur, client, mode de paiement, statut), détail, réimpression, annulation (gérant).
5. **Produits** : fiche (référence, code-barres, photo, catégorie, unité, prix détail et gros, seuil d'alerte), import et export CSV/Excel pour la **saisie initiale du magasin**, étiquettes code-barres imprimables.
6. **Stock** : état par boutique, valeur du stock au CMP (patron uniquement), historique des mouvements par produit, ajustements et pertes, transferts entre boutiques.
7. **Inventaire physique** : session de comptage au téléphone (scan puis quantité), écarts, validation qui crée les ajustements.
8. **Achats et arrivages** : achat local ou import (Chine), devise, taux de change, lignes, frais annexes, réception qui calcule le coût de revient et met le stock à jour.
9. **Fournisseurs** : coordonnées (dont WeChat), historique des achats.
10. **Clients et crédits** : fiche, solde dû, historique, encaissement d'un remboursement, relance par WhatsApp.
11. **Dépenses** : par catégorie (loyer, salaires, carburant du groupe électrogène, transport…), rattachées à la journée de caisse si elles sont payées en espèces.
12. **Rapports**
    - Ventes par jour, par produit, par catégorie, par vendeur.
    - Marges par produit.
    - Produits dormants (non vendus depuis X jours).
    - Ruptures.
    - Créances clients.
    - Export Excel et PDF.
13. **Paramètres** : organisation, boutiques, utilisateurs et rôles, modes de paiement, unités, ticket, catégories de dépenses.
14. **Journal d'audit** (patron).

## 8. Conventions de code

- Structure :
  ```
  src/
    app/            # routes, layout, providers
    features/       # un dossier par module : pos/, products/, stock/, purchases/, sales/, cash/, customers/, expenses/, reports/, settings/
      <module>/components, hooks, api.ts, schema.ts
    lib/            # supabase.ts, db.ts (Dexie), sync/, money.ts, format.ts, print/
    components/ui/  # shadcn
  supabase/
    migrations/     # SQL versionné, jamais modifier une migration déjà appliquée
  ```
- Types générés : `supabase gen types typescript` → `src/lib/database.types.ts`.
- Formatage de l'argent **uniquement** via `lib/money.ts` (`formatMoney(amount, currency)`).
- Toute la logique de calcul métier côté serveur se trouve dans les fonctions SQL. Le front ne fait que des aperçus (total du panier).
- Mobile-first : on conçoit d'abord à 360 px, puis on élargit. La caisse doit tenir sur un écran de téléphone sans scroll horizontal.
- Textes de l'interface centralisés (`src/lib/i18n/fr.ts`) pour pouvoir traduire plus tard (anglais pour d'autres pays).
- Accessibilité : zones tactiles d'au moins 44 px, contrastes forts (écrans utilisés en plein soleil).

## 9. Feuille de route

**Phase 1 — Pilote (MVP)**
1. Authentification, organisation, boutiques, rôles.
2. Produits et catégories, import CSV, stock d'ouverture.
3. Caisse en ligne, avec journée de caisse (ouverture et clôture).
4. Tableau de bord du jour et journal des ventes.
5. Achats et arrivages avec coût de revient et CMP.
6. Clients et crédits, dépenses.
7. Mode hors ligne complet, PWA installable.
8. Rapports et exports.

**Phase 2 — Revente (SaaS)**
- Inscription en libre-service et assistant de démarrage.
- Abonnements (paiement Mobile Money via un agrégateur local, à choisir).
- Super-admin pour gérer les clients.
- Multi-langue.
- Personnalisation avancée par secteur.
- Sauvegardes et export complet des données du client.

## 10. À ne pas faire

- Pas de `float` pour l'argent. Pas de stock modifiable « à la main » hors mouvements.
- Pas de suppression physique de ventes, paiements ou mouvements.
- Pas de clé `service_role` dans le front.
- Pas de logique spécifique au client pilote codée en dur : tout passe par un paramètre de l'organisation.
- Ne pas modifier une migration déjà appliquée : en créer une nouvelle.
