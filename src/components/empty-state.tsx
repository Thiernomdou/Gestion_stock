import { CloudOff, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  text?: string
  action?: ReactNode
}

/** Écran vide composé : dit quoi faire ensuite au lieu d'afficher une liste vide. */
export function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="flex animate-rise flex-col items-center gap-3 rounded-3xl surface px-6 pt-10 pb-8 text-center">
      <div className="relative mb-2">
        <span aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rotate-6 rounded-2xl bg-accent" />
        <span className="relative grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-primary">
          <Icon className="size-8" aria-hidden />
        </span>
      </div>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {text && <p className="max-w-sm text-base text-muted-foreground">{text}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Erreur de chargement, avec bouton pour réessayer. */
export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="flex animate-rise flex-col items-center gap-3 rounded-3xl bg-destructive-soft px-6 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-card text-destructive shadow-card">
        <CloudOff className="size-6" aria-hidden />
      </span>
      <p className="max-w-sm text-base font-semibold text-destructive">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="h-11 rounded-xl bg-card px-5 text-base font-semibold shadow-card transition-transform active:scale-[0.98]">
          {retryLabel}
        </button>
      )}
    </div>
  )
}
