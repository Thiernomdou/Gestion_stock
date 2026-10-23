import { Check, FolderTree, Pencil, Plus, Trash2, X } from 'lucide-react'
import { type CSSProperties, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentOrg } from '@/features/organization/context'
import { hueStyle } from '@/lib/category-color'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { can } from '@/lib/permissions'
import { type Category, useCategories, useDeleteCategory, useProducts, useSaveCategory } from '../api'
import { categorySchema } from '../schema'

const t = fr.products.categoriesPage
const onError = (e: unknown) => toast.error(errorMessage(e))

export function CategoriesPage() {
  const { org, role } = useCurrentOrg()
  const categories = useCategories(org.id)
  const products = useProducts(org.id)
  const save = useSaveCategory(org.id)
  const [name, setName] = useState('')

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products.data ?? []) if (p.category_id && p.is_active) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1)
    return m
  }, [products.data])

  if (!can(role, 'manage_products')) return <Navigate to="/produits" replace />

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = categorySchema.safeParse({ name })
    if (!parsed.success) return
    save.mutate({ id: null, name: parsed.data.name }, { onSuccess: () => setName(''), onError })
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-4">
      <PageHeader back="/produits" title={t.title} description={t.description} />

      <form onSubmit={add} className="flex gap-2 rounded-3xl p-2 surface">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.newPlaceholder}
               aria-label={t.newPlaceholder} className="h-12 border-transparent bg-transparent text-base font-semibold" maxLength={60} />
        <Button type="submit" className="h-12 shrink-0 rounded-2xl px-4" disabled={!name.trim() || save.isPending}>
          <Plus className="size-5" /> <span className="hidden sm:inline">{fr.app.add}</span><span className="sr-only sm:hidden">{fr.app.add}</span>
        </Button>
      </form>

      {categories.error ? (
        <ErrorState message={errorMessage(categories.error)} onRetry={() => void categories.refetch()} retryLabel={fr.app.retry} />
      ) : categories.isPending ? (
        <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[4.5rem] rounded-3xl" />)}</div>
      ) : categories.data.length === 0 ? (
        <EmptyState icon={FolderTree} title={t.emptyTitle} text={t.emptyText} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.data.map((c, i) => <CategoryRow key={c.id} index={i} category={c} count={counts.get(c.id) ?? 0} canDelete={can(role, 'manage_organization')} />)}
        </ul>
      )}
    </div>
  )
}

function CategoryRow({ category, count, canDelete, index }: { category: Category; count: number; canDelete: boolean; index: number }) {
  const { org } = useCurrentOrg()
  const save = useSaveCategory(org.id)
  const remove = useDeleteCategory(org.id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = categorySchema.safeParse({ name })
    if (!parsed.success) return
    save.mutate({ id: category.id, name: parsed.data.name }, { onSuccess: () => setEditing(false), onError })
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={submit} className="flex items-center gap-2 rounded-3xl p-2 surface ring-2 ring-ring/40">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label={fr.settings.rename}
                 className="h-11 border-transparent text-base font-semibold" maxLength={60} />
          <Button type="submit" size="icon" aria-label={fr.app.save} disabled={save.isPending}><Check /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label={fr.app.cancel} onClick={() => { setName(category.name); setEditing(false) }}><X /></Button>
        </form>
      </li>
    )
  }

  return (
    <li style={{ ...hueStyle(category.id), '--i': index } as CSSProperties} className="flex stagger items-center gap-3 rounded-3xl p-2.5 surface">
      <Link to={`/produits?categorie=${category.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl text-base font-extrabold uppercase tint-soft">
          {category.name.trim().slice(0, 2)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-bold">{category.name}</span>
          <span className="text-sm text-muted-foreground">{t.products(count)}</span>
        </span>
      </Link>
      <Button variant="ghost" size="icon" aria-label={`${fr.settings.rename} ${category.name}`} onClick={() => setEditing(true)}><Pencil /></Button>
      {canDelete && (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="icon" aria-label={`${t.delete} ${category.name}`} className="text-destructive"><Trash2 /></Button>}
          title={t.delete}
          description={t.deleteConfirm(category.name)}
          confirmLabel={t.delete}
          destructive
          onConfirm={() => remove.mutate(category.id, { onError })}
        />
      )}
    </li>
  )
}
