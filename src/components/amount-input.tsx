import { type ComponentProps, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatQty, parseQuantity } from '@/lib/format'
import { parseMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

type BaseProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined
  onChange: (value: number | null) => void
  /** Texte affiché à droite du champ (devise, unité). */
  suffix?: string | undefined
}

const toText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : formatQty(value).replace(/\u00a0/g, ' ')

const groupDigits = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n).replace(/[\u202f\u00a0]/g, ' ')

function Suffixed({ suffix, children }: { suffix?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}

/** Montant entier (GNF…) : affiche « 1 250 000 » pendant la saisie, clavier numérique. */
export function MoneyInput({ value, onChange, suffix, className, ...props }: BaseProps) {
  return (
    <Suffixed suffix={suffix}>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn('text-right text-lg font-semibold tabular-nums', suffix && 'pr-16', className)}
        value={value === null || value === undefined ? '' : groupDigits(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits === '' ? null : parseMoney(digits))
        }}
      />
    </Suffixed>
  )
}

/** Quantité, décimale si l'unité le permet (« 12,5 m »). */
export function QuantityInput({ value, onChange, suffix, className, decimal = true, ...props }: BaseProps & { decimal?: boolean }) {
  // Texte local : permet de taper « 12, » avant le chiffre suivant.
  const [text, setText] = useState(() => toText(value))
  // Valeur changée de l'extérieur (réinitialisation du formulaire) : on resynchronise le texte.
  useEffect(() => {
    setText((current) => (parseQuantity(current) === (value ?? null) ? current : toText(value)))
  }, [value])

  return (
    <Suffixed suffix={suffix}>
      <Input
        {...props}
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        className={cn('text-right text-lg font-semibold tabular-nums', suffix && 'pr-20', className)}
        value={text}
        onChange={(e) => {
          const raw = decimal ? e.target.value.replace(/[^\d.,\s]/g, '') : e.target.value.replace(/\D/g, '')
          setText(raw)
          onChange(raw.trim() === '' ? null : parseQuantity(raw))
        }}
      />
    </Suffixed>
  )
}
