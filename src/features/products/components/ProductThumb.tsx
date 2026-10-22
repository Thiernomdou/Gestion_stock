import { useState } from 'react'
import { hueStyle } from '@/lib/category-color'
import { cn } from '@/lib/utils'
import { productPhotoUrl } from '../api'

/** Vignette d'un produit : sa photo, sinon ses initiales sur la couleur de sa catégorie. */
export function ProductThumb({ name, photo, categoryId, className }: {
  name: string; photo: string | null; categoryId: string | null; className?: string
}) {
  const [broken, setBroken] = useState(false)
  const url = productPhotoUrl(photo)
  return (
    <span aria-hidden style={hueStyle(categoryId)} className={cn('grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl tint-soft', className)}>
      {url && !broken ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="size-full object-cover" />
      ) : (
        <span className="text-base font-extrabold tracking-tight uppercase">{name.trim().slice(0, 2)}</span>
      )}
    </span>
  )
}
