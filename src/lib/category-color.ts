// Teinte stable par catégorie : le même rayon garde la même couleur partout (liste, caisse, tuiles).
// Teintes choisies loin du rouge (rupture) et de l'ambre (stock bas) pour ne pas brouiller les alertes.
const HUES = [188, 235, 155, 280, 210, 320, 120, 45] as const

export function categoryHue(categoryId: string | null | undefined): number {
  if (!categoryId) return 220
  let hash = 0
  for (let i = 0; i < categoryId.length; i++) hash = (hash * 31 + categoryId.charCodeAt(i)) | 0
  return HUES[Math.abs(hash) % HUES.length]!
}

/** Style à poser sur un élément qui utilise les utilitaires tint-soft / tint-solid. */
export function hueStyle(categoryId: string | null | undefined): React.CSSProperties {
  return { '--hue': categoryHue(categoryId) } as React.CSSProperties
}
