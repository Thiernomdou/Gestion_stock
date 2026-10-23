import { zodResolver } from '@hookform/resolvers/zod'
import { Barcode, Boxes, Camera, Loader2, Lock, PackageSearch, Tag, Trash2, Wallet } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MoneyInput, QuantityInput } from '@/components/amount-input'
import { EmptyState } from '@/components/empty-state'
import { FormField } from '@/components/form-field'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useCurrentOrg } from '@/features/organization/context'
import { hueStyle } from '@/lib/category-color'
import { errorMessage } from '@/lib/errors'
import { formatQty } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { compressImage } from '@/lib/image'
import { formatMoney } from '@/lib/money'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  type PhotoChange, type Product, productPhotoUrl, useCategories, useProductCosts, useProducts, useSaveProduct, useStock,
} from '../api'
import { productSchema, type ProductFormInput, type ProductFormValues } from '../schema'
import { ProductThumb } from './ProductThumb'

const t = fr.products.form
const NO_CATEGORY = '__none'
// Unités vendues au détail : la caisse accepte alors 12,5 (proposé, modifiable).
const DECIMAL_UNIT = /m[eè]tre|^m$|kg|kilo|litre|^l$/i

function Section({ icon: Icon, title, children }: { icon: typeof Tag; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-3xl p-4 surface sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight">
        <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" aria-hidden /></span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function ToggleRow({ id, title, hint, control }: { id: string; title: string; hint: string; control: ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-muted/70 p-3.5 transition-colors hover:bg-muted">
      <span>
        <span className="block text-base font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      {control}
    </label>
  )
}

export function ProductFormPage() {
  const { id } = useParams()
  const { org } = useCurrentOrg()
  const products = useProducts(org.id)
  const categories = useCategories(org.id)

  if (products.isPending || categories.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4">
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    )
  }
  const product = id ? products.data?.find((p) => p.id === id) : null
  if (id && !product) {
    return <EmptyState icon={PackageSearch} title={t.notFound} action={<Button asChild variant="outline" size="lg"><Link to="/produits">{fr.app.back}</Link></Button>} />
  }
  return <ProductForm key={product?.id ?? 'new'} product={product ?? null} />
}

/** Photo choisie : aperçu local immédiat, compression avant envoi. */
function PhotoPicker({ name, shown, categoryId, onPick, onRemove, disabled }: {
  name: string; shown: string | null; categoryId: string | null
  onPick: (blob: Blob) => void; onRemove: () => void; disabled: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      onPick(await compressImage(file))
    } catch {
      toast.error(t.photoError)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || busy}
        aria-label={shown ? t.changePhoto : t.addPhoto}
        style={hueStyle(categoryId)}
        className="group relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl tint-soft ring-1 ring-foreground/5 transition-transform active:scale-[0.97] disabled:active:scale-100"
      >
        {shown ? (
          <img src={shown} alt="" className="size-full object-cover" />
        ) : name.trim().length > 1 ? (
          <span className="text-2xl font-extrabold uppercase">{name.trim().slice(0, 2)}</span>
        ) : (
          <Camera className="size-8" aria-hidden />
        )}
        <span className="absolute right-1.5 bottom-1.5 grid size-8 place-items-center rounded-xl bg-card text-foreground shadow-card">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
        </span>
      </button>
      <div className="grid gap-1.5">
        <p className="text-base font-semibold">{t.photo}</p>
        <p className="text-sm text-muted-foreground">{t.photoHint}</p>
        {!disabled && shown && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-9 items-center gap-1.5 justify-self-start rounded-lg px-2 -ml-2 text-sm font-semibold text-destructive hover:bg-destructive-soft"
          >
            <Trash2 className="size-4" aria-hidden /> {t.removePhoto}
          </button>
        )}
      </div>
      {/* accept="image/*" : sur Android, propose directement l'appareil photo */}
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  )
}

function ProductForm({ product }: { product: Product | null }) {
  const navigate = useNavigate()
  const { org, role, store, activeStores, settings } = useCurrentOrg()
  const categories = useCategories(org.id)
  const stock = useStock(org.id)
  const canEdit = can(role, 'manage_products')
  const canSeeCost = can(role, 'view_costs')
  const costs = useProductCosts(org.id, canSeeCost)
  const save = useSaveProduct(org.id)
  // Identifiant fixé à l'ouverture : renvoyer après une erreur ne crée pas de doublon.
  const [productId] = useState(() => product?.id ?? crypto.randomUUID())
  const [photo, setPhoto] = useState<PhotoChange>()
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const units = Array.from(new Set([...settings.units, product?.unit ?? settings.units[0] ?? 'pièce']))
  const { register, control, handleSubmit, setValue, formState: { errors, isDirty } } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      category_id: product?.category_id ?? null,
      brand: product?.brand ?? '',
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      description: product?.description ?? '',
      unit: product?.unit ?? units[0]!,
      allow_decimal_qty: product?.allow_decimal_qty ?? false,
      sale_price: product?.sale_price ?? null,
      wholesale_price: product?.wholesale_price ?? null,
      min_stock: product ? Number(product.min_stock) : null,
      is_active: product?.is_active ?? true,
      opening_qty: null,
      opening_cost: null,
    },
  })

  const [name, categoryId, unit, decimal, salePrice, wholesalePrice] = useWatch({
    control, name: ['name', 'category_id', 'unit', 'allow_decimal_qty', 'sale_price', 'wholesale_price'],
  })
  const storeStock = store ? stock.data?.get(store.id) : undefined
  // Stock d'ouverture : seulement si le produit n'a encore aucun mouvement dans la boutique en cours.
  const canOpen = canEdit && store !== null && (!product || (stock.data !== undefined && !storeStock?.has(product.id)))
  const avgCost = product ? costs.data?.get(product.id) : undefined
  const margin = avgCost !== undefined && avgCost > 0 && salePrice ? salePrice - avgCost : null
  const dirty = isDirty || photo !== undefined
  const categoryLabel = categories.data?.find((c) => c.id === categoryId)?.name
  const shownPhoto = photo === 'remove' ? null : preview ?? productPhotoUrl(product?.photo_url)

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      {
        id: productId, isNew: !product, values, storeId: canOpen ? store?.id ?? null : null,
        photo, previousPhoto: product?.photo_url ?? null,
      },
      {
        onSuccess: () => {
          toast.success(product ? fr.app.saved : t.created)
          navigate('/produits')
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    ),
  )

  const submitLabel = save.isPending ? <><Loader2 className="animate-spin" /> {fr.app.loading}</> : product ? fr.app.save : t.create

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4">
      <PageHeader back="/produits" title={product ? product.name : fr.products.new} />

      {!canEdit && (
        <p className="flex items-center gap-2 rounded-2xl bg-muted p-3.5 text-base font-medium">
          <Lock className="size-5 shrink-0 text-muted-foreground" aria-hidden /> {t.readOnly}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6">
        <fieldset disabled={!canEdit || save.isPending} className="grid min-w-0 gap-4">
          <Section icon={Tag} title={t.identity}>
            <PhotoPicker
              name={name}
              shown={shownPhoto}
              categoryId={categoryId}
              onPick={(blob) => { setPreview(URL.createObjectURL(blob)); setPhoto({ blob }) }}
              onRemove={() => { setPreview(null); setPhoto(product?.photo_url ? 'remove' : undefined) }}
              disabled={!canEdit || save.isPending}
            />
            <FormField id="name" label={t.name} error={errors.name?.message}>
              <Input id="name" placeholder={t.namePlaceholder} className="h-13 text-lg font-semibold" autoFocus={!product} {...register('name')} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="category" label={t.category}>
                <Controller control={control} name="category_id" render={({ field }) => (
                  <Select value={field.value ?? NO_CATEGORY} onValueChange={(v) => field.onChange(v === NO_CATEGORY ? null : v)} disabled={!canEdit}>
                    <SelectTrigger id="category" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY} className="text-muted-foreground">{t.noCategory}</SelectItem>
                      {categories.data?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span aria-hidden style={hueStyle(c.id)} className="size-2.5 rounded-full tint-solid" />
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </FormField>
              <FormField id="brand" label={t.brand} error={errors.brand?.message}>
                <Input id="brand" {...register('brand')} />
              </FormField>
            </div>
          </Section>

          <Section icon={Wallet} title={t.prices}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="sale_price" label={t.salePrice} error={errors.sale_price?.message}>
                <Controller control={control} name="sale_price" render={({ field }) => (
                  <MoneyInput id="sale_price" value={field.value} onChange={field.onChange} onBlur={field.onBlur} suffix={org.currency} aria-invalid={!!errors.sale_price} />
                )} />
              </FormField>
              <FormField id="wholesale_price" label={t.wholesalePrice} hint={t.wholesaleHint} error={errors.wholesale_price?.message}>
                <Controller control={control} name="wholesale_price" render={({ field }) => (
                  <MoneyInput id="wholesale_price" value={field.value} onChange={field.onChange} onBlur={field.onBlur} suffix={org.currency} />
                )} />
              </FormField>
            </div>
            {canSeeCost && avgCost !== undefined && avgCost > 0 && (
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/70 p-3.5 lg:hidden" title={t.costHint}>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t.avgCost}</p>
                  <p className="text-lg font-bold tabular-nums">{formatMoney(avgCost, org.currency)}</p>
                </div>
                {margin !== null && salePrice && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t.margin}</p>
                    <p className={cn('text-lg font-bold tabular-nums', margin < 0 ? 'text-destructive' : 'text-success')}>
                      {Math.round((margin / salePrice) * 100)} % · {formatMoney(margin, org.currency)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section icon={Boxes} title={t.stockSection}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="unit" label={t.unit} error={errors.unit?.message}>
                <Controller control={control} name="unit" render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => { field.onChange(v); if (DECIMAL_UNIT.test(v)) setValue('allow_decimal_qty', true, { shouldDirty: true }) }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="unit" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </FormField>
              <FormField id="min_stock" label={t.minStock} hint={t.minStockHint}>
                <Controller control={control} name="min_stock" render={({ field }) => (
                  <QuantityInput id="min_stock" value={field.value} onChange={field.onChange} onBlur={field.onBlur} suffix={unit} decimal={decimal} />
                )} />
              </FormField>
            </div>
            <ToggleRow id="allow_decimal_qty" title={t.decimal} hint={t.decimalHint} control={
              <Controller control={control} name="allow_decimal_qty" render={({ field }) => (
                <Switch id="allow_decimal_qty" checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} />
              )} />
            } />

            {product && activeStores.length > 0 && stock.data && (
              <ul className="grid gap-2 sm:grid-cols-2 lg:hidden">
                {activeStores.map((s) => {
                  const q = stock.data.get(s.id)?.get(product.id)
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-2xl border p-3.5">
                      <span className="truncate text-sm font-medium text-muted-foreground">{t.currentStock(s.name)}</span>
                      <span className="text-base font-bold tabular-nums">{q === undefined ? '—' : formatQty(q, product.unit)}</span>
                    </li>
                  )
                })}
              </ul>
            )}

            {canOpen && store && (
              <div className="grid gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-accent/50 p-4">
                <div>
                  <p className="text-base font-bold">{t.opening}</p>
                  <p className="text-sm text-muted-foreground">{t.openingHint(store.name)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField id="opening_qty" label={t.openingQty} error={errors.opening_qty?.message}>
                    <Controller control={control} name="opening_qty" render={({ field }) => (
                      <QuantityInput id="opening_qty" value={field.value} onChange={field.onChange} onBlur={field.onBlur} decimal={decimal} />
                    )} />
                  </FormField>
                  <FormField id="opening_cost" label={t.openingCost} error={errors.opening_cost?.message}>
                    <Controller control={control} name="opening_cost" render={({ field }) => (
                      <MoneyInput id="opening_cost" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    )} />
                  </FormField>
                </div>
              </div>
            )}
          </Section>

          <Section icon={Barcode} title={t.codes}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="sku" label={t.sku} error={errors.sku?.message}>
                <Input id="sku" autoCapitalize="characters" className="font-mono" {...register('sku')} />
              </FormField>
              <FormField id="barcode" label={t.barcode} error={errors.barcode?.message}>
                <Input id="barcode" inputMode="numeric" className="font-mono tabular-nums" {...register('barcode')} />
              </FormField>
            </div>
            <FormField id="description" label={t.description} error={errors.description?.message}>
              <textarea
                id="description"
                rows={3}
                className="min-h-24 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-base transition-[border-color,box-shadow] outline-none hover:border-[oklch(0.8_0.015_220)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                {...register('description')}
              />
            </FormField>
            {product && (
              <ToggleRow id="is_active" title={t.active} hint={t.activeHint} control={
                <Controller control={control} name="is_active" render={({ field }) => (
                  <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} />
                )} />
              } />
            )}
          </Section>
        </fieldset>

        {/* Aperçu (grand écran) : la fiche telle qu'elle apparaîtra, mise à jour pendant la saisie */}
        <aside className="sticky top-24 hidden gap-4 lg:grid" aria-label={t.summary}>
          <div className="overflow-hidden rounded-3xl surface">
            <div style={hueStyle(categoryId)} className="grid place-items-center bg-[oklch(0.9_0.05_var(--hue))] p-6">
              {shownPhoto ? (
                <img src={shownPhoto} alt="" className="size-28 rounded-3xl object-cover shadow-card" />
              ) : (
                <ProductThumb name={name || '?'} photo={null} categoryId={categoryId} className="size-28 rounded-3xl shadow-card" />
              )}
            </div>
            <div className="grid gap-3 p-5">
              <div>
                {categoryLabel && (
                  <span style={hueStyle(categoryId)} className="mb-1.5 inline-flex h-7 items-center rounded-full px-2.5 text-xs font-bold tint-soft">{categoryLabel}</span>
                )}
                <p className="text-lg leading-snug font-bold break-words">{name || t.namePlaceholder}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-[1.75rem] leading-none font-extrabold tracking-tight tabular-nums">{formatMoney(salePrice ?? 0, org.currency)}</p>
                {wholesalePrice ? <p className="text-sm text-muted-foreground">{t.wholesalePrice} : <span className="font-semibold tabular-nums">{formatMoney(wholesalePrice, org.currency)}</span></p> : null}
              </div>
              {canSeeCost && avgCost !== undefined && avgCost > 0 && (
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/70 p-3" title={t.costHint}>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t.avgCost}</p>
                    <p className="font-bold tabular-nums">{formatMoney(avgCost, org.currency)}</p>
                  </div>
                  {margin !== null && salePrice && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t.margin}</p>
                      <p className={cn('font-bold tabular-nums', margin < 0 ? 'text-destructive' : 'text-success')}>
                        {Math.round((margin / salePrice) * 100)} %
                      </p>
                    </div>
                  )}
                </div>
              )}
              {product && stock.data && activeStores.length > 0 && (
                <ul className="grid gap-1.5 border-t pt-3">
                  {activeStores.map((s) => {
                    const q = stock.data.get(s.id)?.get(product.id)
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-muted-foreground">{s.name}</span>
                        <span className="font-bold tabular-nums">{q === undefined ? '—' : formatQty(q, unit)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
          {canEdit && (
            <Button type="submit" size="lg" className="w-full" disabled={save.isPending || (!!product && !dirty)}>{submitLabel}</Button>
          )}
          {canEdit && product && dirty && <p className="text-center text-sm font-medium text-warning">{t.unsaved}</p>}
        </aside>
      </div>

      {/* Téléphone : barre d'enregistrement visible dès qu'il y a quelque chose à enregistrer */}
      {canEdit && (!product || dirty) && (
        <div className="sticky animate-rise bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-20 -mx-1 rounded-[1.4rem] bg-background/95 p-1 md:bottom-4 lg:hidden">
          <Button type="submit" size="lg" className="w-full" disabled={save.isPending || (!!product && !dirty)}>{submitLabel}</Button>
        </div>
      )}
    </form>
  )
}
