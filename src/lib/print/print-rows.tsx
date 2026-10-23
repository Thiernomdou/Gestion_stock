import { cn } from '@/lib/utils'

/** Ligne « libellé ……… montant » d'un ticket imprimé. */
export function PrintRow({ label, value, bold }: { label: string; value: string; bold?: boolean | undefined }) {
  return (
    <div className={cn('flex justify-between gap-2', bold && 'font-bold')}>
      <span>{label}</span><span className="whitespace-nowrap">{value}</span>
    </div>
  )
}

/** Séparateur pointillé d'un ticket imprimé. */
export function PrintRule() {
  return <div className="my-1.5 border-t border-dashed border-black" />
}
