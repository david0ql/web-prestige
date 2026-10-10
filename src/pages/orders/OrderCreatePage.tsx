import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Calculator, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { GlobalSummaryRow, Product, ProductionOrder } from '@/lib/api/types'
import { useMaterials, useProducts } from '@/lib/hooks/useMasters'
import { usePermission } from '@/lib/auth/store'
import { STANDARD_BASIS } from '@/lib/labels'
import { formatGrams, formatNumber, formatPurity, todayIso } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { notify } from '@/components/ui/Toaster'
import { estimateRequirements, PRIORITY_OPTIONS } from './components/orderUtils'

interface ExtraRow {
  key: number
  materialId: string
  requiredGrams: string
  tolerancePct: string
}

const addDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** P06 · Nueva orden de producción (RF-007/008, RN-006). */
export default function OrderCreatePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canInventory = usePermission('inventory.read')
  const products = useProducts()
  const materials = useMaterials()
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [workshopId, setWorkshopId] = useState('')
  const [grams, setGrams] = useState('')
  const [units, setUnits] = useState('')
  const [commitmentDate, setCommitmentDate] = useState(addDays(15))
  const [priority, setPriority] = useState('NORMAL')
  const [notes, setNotes] = useState('')
  const [extras, setExtras] = useState<ExtraRow[]>([])
  const [submitted, setSubmitted] = useState(false)

  const product = useQuery({ queryKey: ['products', 'detail', productId], queryFn: () => api.get<Product>(`/products/${productId}`), enabled: !!productId })
  const summary = useQuery({ queryKey: ['inventory', 'summary'], queryFn: () => api.get<GlobalSummaryRow[]>('/inventory/summary'), enabled: canInventory, staleTime: 30_000 })
  const p = product.data
  const enabledWorkshops = (p?.workshops ?? []).filter((w) => w.enabled && w.workshop.status === 'ACTIVE')
  const variants = (p?.variants ?? []).filter((v) => v.status === 'ACTIVE')

  const g = Number(grams) || 0
  const u = units ? Number(units) : null
  const available = useMemo(() => new Map((summary.data ?? []).map((r) => [r.material.id, r.available])), [summary.data])

  const preview = useMemo(() => {
    if (!p) return []
    const std = estimateRequirements(p.standards ?? [], { grams: g, units: u, variantId: variantId || null }).map((r) => ({
      materialId: r.standard.materialId,
      name: r.standard.material.name,
      code: r.standard.material.code,
      purity: r.standard.material.purity,
      basis: STANDARD_BASIS[r.standard.basis] ?? r.standard.basis,
      detail: r.standard.basis === 'PER_LOT' ? `${formatNumber(r.standard.quantity, 4)} g / lote de ${formatGrams(r.standard.lotSizeGrams, 0)}` : `${formatNumber(r.standard.quantity, 4)} ${r.standard.basis === 'PER_UNIT' ? 'g/u' : 'g/g'}`,
      requiredGrams: r.requiredGrams,
      tolerancePct: r.standard.tolerancePct,
      manual: false,
      variant: !!r.standard.variantId,
    }))
    const map = new Map(std.map((r) => [r.materialId, r]))
    for (const e of extras) {
      if (!e.materialId || !Number(e.requiredGrams)) continue
      const m = materials.data?.find((x) => x.id === e.materialId)
      map.set(e.materialId, {
        materialId: e.materialId,
        name: m?.name ?? '—',
        code: m?.code ?? '',
        purity: m?.purity ?? null,
        basis: 'Manual',
        detail: map.has(e.materialId) ? 'Reemplaza el estándar' : 'Insumo adicional',
        requiredGrams: Number(e.requiredGrams),
        tolerancePct: e.tolerancePct ? Number(e.tolerancePct) : 5,
        manual: true,
        variant: false,
      })
    }
    return [...map.values()].filter((r) => r.requiredGrams > 0 || !r.manual)
  }, [p, g, u, variantId, extras, materials.data])

  const shortfalls = canInventory ? preview.filter((r) => r.requiredGrams > (available.get(r.materialId) ?? 0)) : []
  const totalRequired = preview.reduce((s, r) => s + r.requiredGrams, 0)

  const errors = {
    product: !productId ? 'Selecciona el producto' : undefined,
    workshop: !workshopId ? 'Selecciona el taller' : undefined,
    grams: g < 1 ? 'Indica el peso objetivo (≥ 1 g)' : undefined,
    units: units && Number(units) < 1 ? 'Debe ser ≥ 1' : undefined,
    commitment: !commitmentDate ? 'Indica la fecha compromiso' : commitmentDate < todayIso() ? 'La fecha no puede ser pasada' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  const create = useMutation({
    mutationFn: () =>
      api.post<ProductionOrder>('/orders', {
        productId,
        variantId: variantId || null,
        workshopId,
        targetGrams: g,
        targetUnits: u,
        commitmentDate,
        priority,
        notes: notes.trim() || null,
        extraRequirements: extras
          .filter((e) => e.materialId && Number(e.requiredGrams) > 0)
          .map((e) => ({ materialId: e.materialId, requiredGrams: Number(e.requiredGrams), tolerancePct: e.tolerancePct ? Number(e.tolerancePct) : undefined })),
      }),
    onSuccess: (o) => {
      notify.success(`Orden ${o.number} creada en borrador`)
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void navigate({ to: '/ordenes/$orderId', params: { orderId: o.id } })
    },
  })

  const submit = () => {
    setSubmitted(true)
    if (valid) create.mutate()
  }
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)

  return (
    <div>
      <PageHeader
        code="P06"
        title="Nueva orden de producción"
        description="Define qué fabricar, cuánto, en qué taller y para cuándo. El sistema estima los insumos según los estándares del producto (RF-008)."
        breadcrumbs={[{ label: 'Órdenes', to: '/ordenes' }, { label: 'Nueva' }]}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-4">
          <Card title="Producto y taller">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Producto" required error={err('product')} className="md:col-span-2">
                <NativeSelect
                  data-testid="order-product"
                  value={productId}
                  placeholder="Selecciona un producto…"
                  onChange={(e) => {
                    setProductId(e.target.value)
                    setVariantId('')
                    setWorkshopId('')
                  }}
                  options={(products.data ?? []).filter((x) => x.status === 'ACTIVE').map((x) => ({ value: x.id, label: `${x.code} · ${x.name}` }))}
                />
              </FormField>
              <FormField label="Variante" hint={p && !variants.length ? 'El producto no tiene variantes' : undefined}>
                <NativeSelect
                  data-testid="order-variant"
                  value={variantId}
                  disabled={!variants.length}
                  onChange={(e) => setVariantId(e.target.value)}
                  options={[{ value: '', label: 'Sin variante (estándar general)' }, ...variants.map((v) => ({ value: v.id, label: v.standardWeight ? `${v.name} · ${formatGrams(v.standardWeight)}` : v.name }))]}
                />
              </FormField>
              <FormField label="Taller" required error={err('workshop')} hint={p ? `${enabledWorkshops.length} taller(es) habilitado(s) para este producto` : 'Primero elige el producto'}>
                <NativeSelect
                  data-testid="order-workshop"
                  value={workshopId}
                  disabled={!p}
                  placeholder={p && !enabledWorkshops.length ? 'Ningún taller habilitado' : 'Selecciona un taller…'}
                  onChange={(e) => setWorkshopId(e.target.value)}
                  options={enabledWorkshops.map((w) => ({ value: w.workshopId, label: `${w.workshop.code} · ${w.workshop.name}` }))}
                />
              </FormField>
            </div>
            {p && (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-sunken/60 px-3 py-2 text-[12px] text-ink-secondary">
                <span>Familia: <b className="font-medium text-ink">{p.family?.name}</b></span>
                {p.standardWeight ? <span>Peso estándar: <b className="font-medium text-ink">{formatGrams(p.standardWeight)}</b> / u</span> : null}
                {p.targetPurity ? <span>Ley objetivo: <b className="font-medium text-ink">{formatPurity(p.targetPurity)}</b> ± {formatNumber(p.purityTolerance, 2)}</span> : null}
                <span>Tolerancia de merma: <b className="font-medium text-ink">{formatNumber(p.lossTolerancePct, 2)} %</b></span>
                <span>Ficha técnica: <b className="font-medium text-ink">v{p.currentSheetVersion}</b></span>
              </div>
            )}
          </Card>

          <Card title="Objetivo y compromiso">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FormField label="Gramos objetivo" required error={err('grams')}>
                <Input data-testid="order-grams" type="number" min={1} step="0.01" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="Ej. 250" />
              </FormField>
              <FormField label="Unidades objetivo" error={err('units')} hint={p?.standardWeight && g ? `≈ ${formatNumber(g / p.standardWeight, 1)} u según peso estándar` : 'Opcional'}>
                <Input data-testid="order-units" type="number" min={1} step="1" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="Ej. 10" />
              </FormField>
              <FormField label="Fecha compromiso" required error={err('commitment')}>
                <Input data-testid="order-commitment" type="date" min={todayIso()} value={commitmentDate} onChange={(e) => setCommitmentDate(e.target.value)} />
              </FormField>
              <FormField label="Prioridad">
                <NativeSelect data-testid="order-priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTIONS} />
              </FormField>
            </div>
            <FormField label="Observaciones" className="mt-4">
              <Textarea data-testid="order-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cliente, referencia de pedido, indicaciones al taller…" />
            </FormField>
          </Card>

          <Card
            title="Insumos adicionales (manuales)"
            actions={
              <Button variant="secondary" size="sm" data-testid="order-add-extra" onClick={() => setExtras((x) => [...x, { key: Date.now(), materialId: '', requiredGrams: '', tolerancePct: '' }])}>
                <Plus className="size-3.5" /> Agregar insumo
              </Button>
            }
          >
            {extras.length === 0 ? (
              <p className="text-[12px] text-ink-muted">Opcional. Agrega insumos que no estén en el estándar o reemplaza la cantidad estándar de un material (queda marcado como manual).</p>
            ) : (
              <div className="space-y-2">
                {extras.map((e, i) => (
                  <div key={e.key} className="grid grid-cols-[1fr_120px_100px_auto] items-end gap-2">
                    <FormField label={i === 0 ? 'Material' : ' '}>
                      <NativeSelect
                        data-testid={`order-extra-material-${i}`}
                        value={e.materialId}
                        placeholder="Material…"
                        onChange={(ev) => setExtras((x) => x.map((r) => (r.key === e.key ? { ...r, materialId: ev.target.value } : r)))}
                        options={(materials.data ?? []).filter((m) => m.status === 'ACTIVE').map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))}
                      />
                    </FormField>
                    <FormField label={i === 0 ? 'Gramos' : ' '}>
                      <Input data-testid={`order-extra-grams-${i}`} type="number" min={0} step="0.01" value={e.requiredGrams} onChange={(ev) => setExtras((x) => x.map((r) => (r.key === e.key ? { ...r, requiredGrams: ev.target.value } : r)))} />
                    </FormField>
                    <FormField label={i === 0 ? 'Tol. %' : ' '}>
                      <Input type="number" min={0} max={100} step="0.1" placeholder="5" value={e.tolerancePct} onChange={(ev) => setExtras((x) => x.map((r) => (r.key === e.key ? { ...r, tolerancePct: ev.target.value } : r)))} />
                    </FormField>
                    <Button variant="ghost" iconOnly aria-label="Quitar" onClick={() => setExtras((x) => x.filter((r) => r.key !== e.key))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card title="Estimación de insumos (RF-008)" actions={<Calculator className="size-4 text-brand-600" />}>
            {!p ? (
              <EmptyState icon={Calculator} title="Selecciona un producto" description="La estimación se calcula en vivo con los estándares de consumo." />
            ) : preview.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-ink-muted">El producto no tiene estándares activos. Agrega insumos manuales si es necesario.</p>
            ) : (
              <div className="-mx-4">
                <table className="w-full text-[12.5px]" data-testid="order-preview">
                  <thead>
                    <tr className="border-y border-border bg-sunken/60">
                      <th className="eyebrow px-4 py-1.5 text-left">Material</th>
                      <th className="eyebrow px-2 py-1.5 text-right">Requerido</th>
                      {canInventory && <th className="eyebrow px-4 py-1.5 text-right">Disponible</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => {
                      const avail = available.get(r.materialId) ?? 0
                      const short = canInventory && r.requiredGrams > avail
                      return (
                        <tr key={r.materialId} className="border-b border-border/70 last:border-0">
                          <td className="px-4 py-2">
                            <p className="font-medium text-ink">
                              {r.name} {r.purity ? <span className="text-ink-muted">· {formatPurity(r.purity)}</span> : null}
                            </p>
                            <p className="text-[11px] text-ink-muted">
                              {r.manual ? <span className="font-medium text-brand-700">Manual</span> : r.basis} · {r.detail} · tol. {formatNumber(r.tolerancePct, 2)} %{r.variant ? ' · estándar de variante' : ''}
                            </p>
                          </td>
                          <td className="px-2 py-2 text-right font-semibold tnum">{formatGrams(r.requiredGrams)}</td>
                          {canInventory && (
                            <td className={cn('px-4 py-2 text-right tnum', short ? 'text-danger' : 'text-ink-secondary')}>
                              {formatGrams(avail)}
                              {short && <p className="text-[11px] font-medium">Falta {formatGrams(r.requiredGrams - avail)}</p>}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-sunken/40">
                      <td className="px-4 py-2 font-semibold">Total insumos</td>
                      <td className="px-2 py-2 text-right font-semibold tnum">{formatGrams(totalRequired)}</td>
                      {canInventory && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {p && g > 0 && canInventory && preview.length > 0 && (
              <div className={cn('mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-[12px]', shortfalls.length ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success')}>
                {shortfalls.length ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
                <span>
                  {shortfalls.length
                    ? `Insuficiencia en ${shortfalls.map((s) => s.name).join(', ')}. La orden quedará "Pendiente de materiales" al planificarla (RN-008).`
                    : 'Hay existencia suficiente en Oficina Madre para el objetivo planificado.'}
                </span>
              </div>
            )}
            {!g && p && <p className="mt-2 text-[11px] text-ink-muted">Ingresa los gramos objetivo para calcular las cantidades.</p>}
          </Card>

          <div className="flex justify-end gap-2">
            <Link to="/ordenes">
              <Button variant="secondary">Cancelar</Button>
            </Link>
            <Button data-testid="order-create-submit" size="lg" loading={create.isPending} onClick={submit}>
              Crear orden en borrador
            </Button>
          </div>
          {submitted && !valid && <p className="text-right text-[12px] text-danger">Revisa los campos obligatorios.</p>}
        </div>
      </div>
    </div>
  )
}
