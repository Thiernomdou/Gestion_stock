import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { fr } from '@/lib/i18n/fr'

/**
 * Mise en page des écrans hors application (connexion, inscription, création du commerce).
 * Téléphone : bandeau de marque, carte du formulaire qui le chevauche. Grand écran : deux colonnes.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative overflow-hidden bg-linear-to-br from-ink via-ink to-ink-2 px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-20 text-white md:flex md:flex-col md:justify-between md:p-12">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full bg-[radial-gradient(circle,oklch(0.7_0.12_180/0.4),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(oklch(1_0_0/0.045)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/0.045)_1px,transparent_1px)] mask-[linear-gradient(to_bottom,black,transparent_85%)] bg-size-[32px_32px]" />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-11 ring-1 ring-white/20 rounded-[14px]" />
          <span className="text-xl font-extrabold tracking-tight">{fr.app.name}</span>
        </div>

        <div className="relative mt-8 md:mt-0 md:max-w-md">
          <p className="text-[1.6rem] leading-[1.15] font-extrabold tracking-[-0.02em] md:text-[2.6rem]">{fr.auth.tagline}</p>
          <ul className="mt-6 hidden gap-3 md:grid">
            {fr.auth.features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-lg text-white/85">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/12"><Check className="size-4" aria-hidden /></span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <span aria-hidden className="hidden md:block" />
      </aside>

      <main className="relative -mt-12 flex justify-center px-4 pb-10 md:mt-0 md:items-center md:p-10">
        <div className="w-full max-w-md animate-rise">{children}</div>
      </main>
    </div>
  )
}
