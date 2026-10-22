// Lecture / écriture CSV pour la saisie initiale du magasin.
// Compatible Excel français : séparateur « ; », BOM UTF-8, guillemets, virgule décimale.

/** Découpe un texte CSV en lignes de cellules. Séparateur détecté automatiquement (; , tabulation). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\ufeff/, '')
  const delimiter = detectDelimiter(src)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
    } else if (c === '"' && cell === '') {
      quoted = true
    } else if (c === delimiter) {
      row.push(cell); cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (d: string) => firstLine.split(d).length - 1
  return [';', '\t', ','].reduce((best, d) => (count(d) > count(best) ? d : best), ';')
}

/** Génère un CSV lisible par Excel (BOM + « ; »). */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\ufeff' + rows.map((r) => r.map(escape).join(';')).join('\r\n') + '\r\n'
}

/** « 12 000 », « 12000,50 », « 1.250.000 », « 15 000 GNF » → nombre ; null si vide ; NaN si illisible. */
export function parseLooseNumber(input: string | undefined): number | null {
  let s = (input ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(/(gnf|xof|fcfa|cfa|usd|eur|cny|rmb|€|\$)$/i, '')
  if (s === '') return null
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')       // 1.250.000 : points de milliers
  else if (/^\d{1,3}(,\d{3})+$/.test(s) && s.split(',').length > 2) s = s.replace(/,/g, '')
  s = s.replace(',', '.')
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN
}

// ---------------------------------------------------------------------
// Correspondance des colonnes
// ---------------------------------------------------------------------

export type ImportField =
  | 'name' | 'sku' | 'barcode' | 'category' | 'brand' | 'unit' | 'allow_decimal_qty'
  | 'sale_price' | 'wholesale_price' | 'min_stock' | 'opening_qty' | 'unit_cost'

const ALIASES: Record<ImportField, string[]> = {
  name: ['nom', 'designation', 'libelle', 'produit', 'article', 'name', 'nomduproduit'],
  sku: ['reference', 'ref', 'sku', 'code', 'codearticle', 'codeproduit'],
  barcode: ['codebarre', 'codebarres', 'codeabarres', 'codeabarre', 'ean', 'ean13', 'barcode', 'gencod'],
  category: ['categorie', 'famille', 'rayon', 'category', 'groupe'],
  brand: ['marque', 'brand', 'fabricant'],
  unit: ['unite', 'unit', 'conditionnement'],
  allow_decimal_qty: ['decimal', 'quantitedecimale', 'ventedecimale', 'aumetre'],
  sale_price: ['prix', 'prixvente', 'prixdevente', 'prixdetail', 'prixdedetail', 'pv', 'prixunitaire', 'saleprice', 'prixventedetail'],
  wholesale_price: ['prixgros', 'prixdegros', 'prixventegros', 'wholesale', 'wholesaleprice'],
  min_stock: ['seuil', 'seuilalerte', 'seuildalerte', 'stockmin', 'stockminimum', 'minstock', 'alerte'],
  opening_qty: ['stock', 'quantite', 'qte', 'qty', 'stockinitial', 'stockouverture', 'stockdouverture', 'stockactuel', 'quantiteenstock'],
  unit_cost: ['cout', 'coutunitaire', 'prixachat', 'prixdachat', 'pa', 'cost', 'prixderevient', 'coutderevient', 'cmp'],
}

// « Prix de vente (GNF) » → « prixdevente » : on ignore ce qui est entre parenthèses.
const normalizeHeader = (h: string) =>
  h.replace(/\(.*?\)/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const FIELD_BY_ALIAS = new Map(Object.entries(ALIASES).flatMap(([field, aliases]) => aliases.map((a) => [a, field as ImportField])))

export interface ImportRow {
  line: number                      // numéro de ligne dans le fichier (en-tête = 1)
  name: string
  sku: string | null
  barcode: string | null
  category: string | null
  brand: string | null
  unit: string | null
  allow_decimal_qty: boolean | null
  sale_price: number | null
  wholesale_price: number | null
  min_stock: number | null
  opening_qty: number | null
  unit_cost: number | null
}

export interface ImportIssue { line: number; message: string }

export interface ImportPreview {
  columns: Array<{ header: string; field: ImportField | null }>
  rows: ImportRow[]
  errors: ImportIssue[]
}

const MONEY_FIELDS = ['sale_price', 'wholesale_price'] as const
const QTY_FIELDS = ['min_stock', 'opening_qty', 'unit_cost'] as const
export const FIELD_LABELS: Record<ImportField, string> = {
  name: 'nom', sku: 'référence', barcode: 'code-barres', category: 'catégorie', brand: 'marque', unit: 'unité',
  allow_decimal_qty: 'décimal', sale_price: 'prix de vente', wholesale_price: 'prix de gros', min_stock: 'seuil',
  opening_qty: 'stock', unit_cost: 'coût',
}

const parseBool = (v: string) => {
  const s = normalizeHeader(v)
  if (['oui', 'o', 'yes', 'y', 'vrai', 'true', '1', 'x'].includes(s)) return true
  if (['non', 'n', 'no', 'faux', 'false', '0'].includes(s)) return false
  return null
}

/** Analyse le fichier : reconnaît les colonnes, convertit les valeurs, liste les erreurs par ligne. */
export function buildImportPreview(table: string[][]): ImportPreview {
  const [header = [], ...body] = table
  const used = new Set<ImportField>()
  const columns = header.map((h) => {
    const field = FIELD_BY_ALIAS.get(normalizeHeader(h)) ?? null
    if (!field || used.has(field)) return { header: h.trim(), field: null }
    used.add(field)
    return { header: h.trim(), field }
  })

  const errors: ImportIssue[] = []
  if (!used.has('name')) errors.push({ line: 1, message: 'Colonne « Nom » introuvable dans la première ligne' })

  const rows: ImportRow[] = body.map((cells, i) => {
    const line = i + 2
    const get = (field: ImportField) => {
      const idx = columns.findIndex((c) => c.field === field)
      return idx >= 0 ? (cells[idx] ?? '').trim() : ''
    }
    const text = (field: ImportField) => get(field) || null
    const row: ImportRow = {
      line, name: get('name'), sku: text('sku'), barcode: text('barcode'), category: text('category'),
      brand: text('brand'), unit: text('unit'), allow_decimal_qty: null,
      sale_price: null, wholesale_price: null, min_stock: null, opening_qty: null, unit_cost: null,
    }
    if (used.has('name') && !row.name) errors.push({ line, message: 'Nom manquant' })

    for (const field of MONEY_FIELDS) {
      const n = parseLooseNumber(get(field))
      if (Number.isNaN(n)) errors.push({ line, message: `${FIELD_LABELS[field]} illisible : « ${get(field)} »` })
      else row[field] = n === null ? null : Math.round(n)
    }
    for (const field of QTY_FIELDS) {
      const n = parseLooseNumber(get(field))
      if (Number.isNaN(n)) errors.push({ line, message: `${FIELD_LABELS[field]} illisible : « ${get(field)} »` })
      else row[field] = n === null ? null : Math.round(n * 1000) / 1000
    }
    const decimal = get('allow_decimal_qty')
    if (decimal) {
      row.allow_decimal_qty = parseBool(decimal)
      if (row.allow_decimal_qty === null) errors.push({ line, message: `décimal : « ${decimal} » (attendu oui / non)` })
    }
    if (row.opening_qty !== null && !Number.isInteger(row.opening_qty) && row.allow_decimal_qty !== true) {
      // une quantité décimale implique une unité vendue au détail (mètre…)
      row.allow_decimal_qty = true
    }
    return row
  })

  // Même référence ou code-barres sur deux lignes : probablement une erreur de saisie.
  for (const key of ['sku', 'barcode'] as const) {
    const seen = new Map<string, number>()
    for (const r of rows) {
      const v = r[key]
      if (!v) continue
      const first = seen.get(v)
      if (first) errors.push({ line: r.line, message: `${FIELD_LABELS[key]} « ${v} » déjà présent ligne ${first}` })
      else seen.set(v, r.line)
    }
  }

  return { columns, rows, errors: errors.sort((a, b) => a.line - b.line) }
}

/** Fichier modèle à remplir dans Excel. */
export function importTemplateCsv(currency: string): string {
  return toCsv([
    ['Nom', 'Référence', 'Code-barres', 'Catégorie', 'Marque', 'Unité', `Prix de vente (${currency})`,
      `Prix de gros (${currency})`, "Seuil d'alerte", 'Stock', `Coût unitaire (${currency})`],
    ['Robinet mélangeur lavabo', 'ROB-001', '6901234567890', 'Plomberie', 'Grohe', 'pièce', 185000, 170000, 3, 12, 120000],
    ['Câble électrique 2,5 mm²', 'CAB-25', '', 'Électricité', 'Nexans', 'mètre', 6500, 6000, 50, 400, 4200],
  ])
}
