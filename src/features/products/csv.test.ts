import { describe, expect, it } from 'vitest'
import { buildImportPreview, importTemplateCsv, parseCsv, parseLooseNumber, toCsv } from './csv'

describe('parseCsv', () => {
  it('lit un export Excel français (BOM, « ; », guillemets, CRLF)', () => {
    const text = '\ufeffNom;Prix\r\n"Robinet ; chromé";185 000\r\n"Câble ""2,5""";6500\r\n\r\n'
    expect(parseCsv(text)).toEqual([['Nom', 'Prix'], ['Robinet ; chromé', '185 000'], ['Câble "2,5"', '6500']])
  })
  it('détecte la virgule et la tabulation', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('relit ce que toCsv écrit', () => {
    const rows = [['Nom', 'Note'], ['Vis "6x40"', 'a;b']]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('parseLooseNumber', () => {
  it('accepte les formats de saisie courants', () => {
    expect(parseLooseNumber('12 000')).toBe(12000)
    expect(parseLooseNumber('1.250.000')).toBe(1250000)
    expect(parseLooseNumber('15 000 GNF')).toBe(15000)
    expect(parseLooseNumber('12,5')).toBe(12.5)
    expect(parseLooseNumber('')).toBeNull()
    expect(parseLooseNumber('douze')).toBeNaN()
  })
})

describe('buildImportPreview', () => {
  it('reconnaît les colonnes du modèle et convertit les valeurs', () => {
    const p = buildImportPreview(parseCsv(importTemplateCsv('GNF')))
    expect(p.errors).toEqual([])
    expect(p.columns.every((c) => c.field !== null)).toBe(true)
    expect(p.rows[1]).toMatchObject({ name: 'Câble électrique 2,5 mm²', unit: 'mètre', sale_price: 6500, opening_qty: 400, barcode: null })
  })
  it('signale les lignes invalides avec leur numéro', () => {
    const p = buildImportPreview([['Désignation', 'PV', 'Réf'], ['', '100', 'A'], ['Vis', 'cent', 'A']])
    expect(p.errors).toEqual([
      { line: 2, message: 'Nom manquant' },
      { line: 3, message: 'prix de vente illisible : « cent »' },
      { line: 3, message: 'référence « A » déjà présent ligne 2' },
    ])
  })
  it('exige une colonne Nom', () => {
    expect(buildImportPreview([['Prix'], ['10']]).errors[0]?.message).toMatch(/Nom/)
  })
  it('ignore les colonnes inconnues et passe en décimal si le stock l’est', () => {
    const p = buildImportPreview([['Nom', 'Couleur', 'Stock'], ['Gaine', 'rouge', '12,5']])
    expect(p.columns[1]).toEqual({ header: 'Couleur', field: null })
    expect(p.rows[0]).toMatchObject({ opening_qty: 12.5, allow_decimal_qty: true })
  })
})
