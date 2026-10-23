import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fr } from '@/lib/i18n/fr'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Lien de retour (chaque page a une sortie). */
  back?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, back, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end gap-x-4 gap-y-3 pb-1">
      <div className="min-w-0 flex-1 basis-60">
        {back && (
          <Link
            to={back}
            className="group mb-2 -ml-1 inline-flex h-10 items-center gap-1.5 rounded-xl pr-3 pl-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="grid size-8 place-items-center rounded-lg surface transition-transform group-hover:-translate-x-0.5">
              <ArrowLeft className="size-4" aria-hidden />
            </span>
            {fr.app.back}
          </Link>
        )}
        <h1 className="text-[1.75rem] leading-[1.1] font-extrabold tracking-[-0.025em] sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-prose text-base text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
