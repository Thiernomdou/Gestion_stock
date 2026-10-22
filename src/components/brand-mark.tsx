import { cn } from '@/lib/utils'

/** Logo de l'application : cartons empilés, sur pastille sarcelle (même dessin que favicon.svg). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn('size-10 shrink-0', className)}>
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.56 0.1 186)" />
          <stop offset="1" stopColor="oklch(0.42 0.09 192)" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#brand-bg)" />
      <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round">
        <path d="M24 11.5 34 16.5v11L24 32.5 14 27.5v-11z" fill="oklch(1 0 0 / 0.14)" />
        <path d="m14 16.5 10 5 10-5M24 21.5v11" />
      </g>
      <path d="M13 36.5h22" stroke="oklch(1 0 0 / 0.55)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
