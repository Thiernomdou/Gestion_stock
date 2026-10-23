import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Contenu imprimable (ticket 58/80 mm, rapport Z) : invisible à l'écran, seul visible à l'impression
 * (voir .print-area dans index.css). On imprime avec window.print() : aucune dépendance.
 */
export function PrintArea({ widthMm, children }: { widthMm: 58 | 80; children: ReactNode }) {
  return createPortal(
    <div className="print-area" style={{ width: `${widthMm}mm` }}>
      <style>{`@page { size: ${widthMm}mm auto; margin: 0; }`}</style>
      {children}
    </div>,
    document.body,
  )
}
