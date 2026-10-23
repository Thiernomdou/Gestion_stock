import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Panneau qui monte du bas de l'écran sur téléphone (à portée de pouce), fenêtre centrée sur grand écran.
 * Contenu défilant, pied fixe pour le bouton d'action principal.
 */
export function BottomSheet({ open, onOpenChange, title, description, children, footer, className }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'top-auto bottom-0 flex max-h-[92dvh] w-full max-w-full translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0',
          'data-open:slide-in-from-bottom-8 sm:top-1/2 sm:bottom-auto sm:max-h-[88dvh] sm:max-w-lg sm:-translate-y-1/2 sm:rounded-3xl',
          className,
        )}
      >
        <div className="px-5 pt-3 pb-3 sm:pt-5">
          <span aria-hidden className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-muted sm:hidden" />
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription className="mt-1 text-base">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t bg-card px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </DialogContent>
    </Dialog>
  )
}
