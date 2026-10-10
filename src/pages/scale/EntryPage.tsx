import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Boxes, CheckCircle2, History, PackagePlus, Plus, Scale, SlidersHorizontal } from 'lucide-react'
import { api, errorMessage, type Paginated } from '@/lib/api/client'
import type { InventoryMovement, Material, ProductionOrder, Weighing } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useCustomers, useMaterials } from '@/lib/hooks/useMasters'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatDateTime, formatGrams, formatMoney, formatPurity } from '@/lib/format'
import { MOVEMENT_TYPE, ORDER_STATUS, WEIGHING_PURPOSE } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { WeighingCapture } from '@/components/domain/WeighingCapture'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { notify } from '@/components/ui/Toaster'
import { WeighingAdjustDialog, WeighingDetailDrawer } from './components/WeighingDialogs'

type Association = 'NONE' | 'ORDER' | 'CUSTOMER'

const emptyForm = {
  materialId: '',
  origin: '',
  reference: '',
  lotCode: '',
  purity: '',
  unitCost: '',
  association: 'NONE' as Association,
  productionOrderId: '',
  customerId: '',
  notes: '',
}

/** P03 · Entrada de material pesada en la Balanza Madre (RF-001/002/003/004, RN-019, CA-001). */
export default function EntryPage() {
  const qc = useQueryClient()
  const canAdjust = usePermission('scale.adjust')
  const { data: materials = [] } = useMaterials()
  const [form, setForm] = useState(emptyForm)
  const [weighing, setWeighing] = useState<Weighing | null>(null)
  const [touched, setTouched] = useState(false)
  const [saved, setSaved] = useState<InventoryMovement | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const debouncedCustomer = useDebounced(customerSearch)
  const customers = useCustomers(debouncedCustomer)
  const orders = useQuery({
    queryKey: ['orders', 'open-for-entry'],
    queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { open: 'true', pageSize: 100 }),
    enabled: form.association === 'ORDER',
  })

  const set = <K extends keyof typeof emptyForm>(k: K, v: (typeof emptyForm)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const material = materials.find((m) => m.id === form.materialId) ?? null
  const purityDiffers = form.purity !== '' && material?.purity != null && Number(form.purity) !== material.purity

  const errors = {
    materialId: !form.materialId ? 'Selecciona el material' : undefined,
    origin: form.origin.trim().length < 2 ? 'Indica el origen o proveedor' : undefined,
    weighing: !weighing ? 'Captura el peso en la Balanza Madre' : undefined,
    productionOrderId: form.association === 'ORDER' && !form.productionOrderId ? 'Selecciona la orden' : undefined,
    customerId: form.association === 'CUSTOMER' && !form.customerId ? 'Selecciona el cliente' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  const save = useMutation({
    mutationFn: () =>
      api.post<InventoryMovement>('/inventory/entries', {
        materialId: form.materialId,
        weighingId: weighing!.id,
        origin: form.origin.trim(),
        reference: form.reference.trim() || undefined,
        lotCode: form.lotCode.trim() || undefined,
        purity: form.purity !== '' ? Number(form.purity) : undefined,
        unitCost: form.unitCost !== '' ? Number(form.unitCost) : undefined,
        productionOrderId: form.association === 'ORDER' ? form.productionOrderId : undefined,
        customerId: form.association === 'CUSTOMER' ? form.customerId : undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (mv) => {
      setSaved(mv)
      notify.success(`Entrada ${mv.number} registrada en Oficina Madre`)
      for (const k of ['inventory', 'weighings', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] })
    },
  })

  const submit = () => {
    setTouched(true)
    if (valid) save.mutate()
  }

  const reset = () => {
    setForm(emptyForm)
    setWeighing(null)
    setTouched(false)
    setSaved(null)
  }

  const materialOptions = useMemo(
    () => materials.filter((m) => m.status === 'ACTIVE').map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` })),
    [materials],
  )

  return (
    <div>
      <PageHeader
        code="P03"
        title="Entrada / Balanza Madre"
        description="Registra todo material que ingresa a Prestige Gold. El peso se toma siempre de la Balanza Madre; la captura manual exige motivo y queda auditada."
        actions={
          <Link to="/inventario">
            <Button variant="secondary"><Boxes className="size-4" /> Ver inventario</Button>
          </Link>
        }
      />

      {saved ? (
        <EntrySuccess movement={saved} weighing={weighing} material={material} onNew={reset} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card title="Datos de la entrada">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Material" required error={touched ? errors.materialId : undefined} hint={weighing ? 'Para cambiar el material vuelve a pesar.' : undefined} className="sm:col-span-2">
                <NativeSelect
                  data-testid="entry-material"
                  placeholder="Selecciona el material…"
                  options={materialOptions}
                  value={form.materialId}
                  disabled={!!weighing}
                  onChange={(e) => set('materialId', e.target.value)}
                />
              </FormField>
              {material && <MaterialFacts material={material} />}
              <FormField label="Origen / proveedor" required error={touched ? errors.origin : undefined}>
                <Input data-testid="entry-origin" placeholder="Ej. Compra Fundición Andina" value={form.origin} onChange={(e) => set('origin', e.target.value)} maxLength={160} />
              </FormField>
              <FormField label="Referencia / documento" hint="Factura, remisión o acta de ingreso">
                <Input data-testid="entry-reference" placeholder="Ej. FAC-10293" value={form.reference} onChange={(e) => set('reference', e.target.value)} maxLength={120} />
              </FormField>
              <FormField label="Lote" hint={material?.tracksLots ? 'Este material se controla por lote.' : 'Opcional. Se crea si no existe.'}>
                <Input data-testid="entry-lot" placeholder="Ej. L-2026-031" value={form.lotCode} onChange={(e) => set('lotCode', e.target.value)} maxLength={40} />
              </FormField>
              <FormField label="Ley (‰) si difiere del maestro" hint={material?.purity != null ? `Ley del maestro: ${formatPurity(material.purity)}` : 'Milésimas de pureza'}>
                <Input data-testid="entry-purity" type="number" min="0" max="1000" step="0.01" placeholder={material?.purity != null ? String(material.purity) : '—'} value={form.purity} onChange={(e) => set('purity', e.target.value)} />
              </FormField>
              <FormField label="Costo por gramo" hint={material ? `Costo de referencia: ${formatMoney(material.referenceCost)}` : 'Opcional'}>
                <Input data-testid="entry-unit-cost" type="number" min="0" step="1" placeholder="Opcional" value={form.unitCost} onChange={(e) => set('unitCost', e.target.value)} />
              </FormField>
              <FormField label="Asociar a" hint="RF-004: vincula la entrada a una orden o cliente">
                <NativeSelect
                  data-testid="entry-association"
                  options={[
                    { value: 'NONE', label: 'Solo Oficina Madre' },
                    { value: 'ORDER', label: 'Orden de producción' },
                    { value: 'CUSTOMER', label: 'Cliente' },
                  ]}
                  value={form.association}
                  onChange={(e) => setForm((f) => ({ ...f, association: e.target.value as Association, productionOrderId: '', customerId: '' }))}
                />
              </FormField>
              {form.association === 'ORDER' && (
                <FormField label="Orden de producción" required error={touched ? errors.productionOrderId : undefined} className="sm:col-span-2">
                  <NativeSelect
                    data-testid="entry-order"
                    placeholder={orders.isLoading ? 'Cargando órdenes…' : 'Selecciona la orden…'}
                    options={(orders.data?.items ?? []).map((o) => ({ value: o.id, label: `${o.number} · ${o.product.name} · ${o.workshop.code} · ${ORDER_STATUS[o.status]?.label ?? o.status}` }))}
                    value={form.productionOrderId}
                    onChange={(e) => set('productionOrderId', e.target.value)}
                  />
                </FormField>
              )}
              {form.association === 'CUSTOMER' && (
                <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[200px_1fr]">
                  <FormField label="Buscar cliente">
                    <Input placeholder="Nombre o documento" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                  </FormField>
                  <FormField label="Cliente" required error={touched ? errors.customerId : undefined}>
                    <NativeSelect
                      data-testid="entry-customer"
                      placeholder={customers.isLoading ? 'Buscando…' : 'Selecciona el cliente…'}
                      options={(customers.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.documentNumber}` }))}
                      value={form.customerId}
                      onChange={(e) => set('customerId', e.target.value)}
                    />
                  </FormField>
                </div>
              )}
              <FormField label="Observaciones" className="sm:col-span-2">
                <Textarea data-testid="entry-notes" rows={2} maxLength={1000} placeholder="Condición del material, empaque, sellos…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </FormField>
            </div>
          </Card>

          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <Card title="Pesaje de entrada">
              {!form.materialId && !weighing && <p className="mb-2 text-[12px] text-ink-muted">Selecciona primero el material para asociarlo al pesaje.</p>}
              <WeighingCapture purpose="ENTRY" materialId={form.materialId || null} value={weighing} onCaptured={setWeighing} testId="entry-weighing" />
              {touched && errors.weighing && <p className="mt-2 text-[12px] text-danger" role="alert">{errors.weighing}</p>}
            </Card>
            <Card>
              <dl className="space-y-1.5 text-[13px]">
                <SummaryRow label="Material" value={material ? `${material.code} · ${material.name}` : '—'} />
                <SummaryRow label="Destino" value="Oficina Madre" />
                <SummaryRow label="Ley" value={formatPurity(form.purity !== '' ? form.purity : material?.purity)} warn={purityDiffers} />
                <SummaryRow label="Peso neto" value={weighing ? formatGrams(weighing.currentNetGrams, 2) : '—'} strong />
              </dl>
              <Button data-testid="entry-submit" size="lg" className="mt-4 w-full" loading={save.isPending} disabled={touched && !valid} onClick={submit}>
                <PackagePlus className="size-4" /> Guardar entrada
              </Button>
              {save.error && <p className="mt-2 text-[12px] text-danger">{errorMessage(save.error)}</p>}
            </Card>
          </div>
        </div>
      )}

      <RecentActivity canAdjust={canAdjust} />
    </div>
  )
}

function MaterialFacts({ material }: { material: Material }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-md border border-brand-100 bg-brand-50/60 px-3 py-2 text-[12px] text-ink-secondary sm:col-span-2">
      <span>Categoría: <b className="font-medium text-ink">{material.category?.name ?? '—'}</b></span>
      <span>Ley: <b className="font-medium text-ink">{formatPurity(material.purity)}</b></span>
      {material.karat && <span>Quilataje: <b className="font-medium text-ink">{material.karat}K</b></span>}
      <span>Unidad base: <b className="font-medium text-ink">{material.baseUnit?.name ?? 'Gramo'}</b></span>
      {material.minStock > 0 && <span>Mínimo: <b className="font-medium text-ink">{formatGrams(material.minStock, 0)}</b></span>}
    </div>
  )
}

function SummaryRow({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn('text-right text-ink tnum', strong && 'text-[18px] font-semibold', warn && 'font-medium text-warning')}>{value}</dd>
    </div>
  )
}

function EntrySuccess({ movement, weighing, material, onNew }: { movement: InventoryMovement; weighing: Weighing | null; material: Material | null; onNew: () => void }) {
  return (
    <Card className="border-success/30">
      <div data-testid="entry-success" className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-bg">
            <CheckCircle2 className="size-6 text-success" />
          </span>
          <div>
            <p className="eyebrow">Entrada registrada</p>
            <p className="mt-0.5 text-[20px] font-semibold text-ink">
              {formatGrams(movement.grams, 2)} <span className="text-ink-muted">de</span> {movement.material?.name ?? material?.name}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Movimiento <b className="font-semibold text-ink">{movement.number}</b> · {movement.toLocation?.name ?? 'Oficina Madre'}
              {weighing && <> · pesaje {weighing.number}{weighing.source === 'MANUAL' && ' (manual)'}</>}
              {movement.lot && <> · lote {movement.lot.code}</>}
              {movement.reference && <> · ref. {movement.reference}</>}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">{formatDateTime(movement.createdAt)} · el inventario global ya refleja la entrada (CA-001).</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onNew} data-testid="entry-new">
            <Plus className="size-4" /> Registrar otra entrada
          </Button>
          <Link to="/asignaciones">
            <Button data-testid="entry-assign-now">Asignar a taller ahora <ArrowRight className="size-4" /></Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}

function RecentActivity({ canAdjust }: { canAdjust: boolean }) {
  const [tab, setTab] = useState('entries')
  const [entryPage, setEntryPage] = useState(1)
  const [wPage, setWPage] = useState(1)
  const [detail, setDetail] = useState<Weighing | null>(null)
  const [adjusting, setAdjusting] = useState<Weighing | null>(null)
  const entries = useQuery({
    queryKey: ['inventory', 'movements', 'ENTRY', entryPage],
    queryFn: () => api.get<Paginated<InventoryMovement>>('/inventory/movements', { type: 'ENTRY', page: entryPage, pageSize: 10 }),
  })
  const weighings = useQuery({
    queryKey: ['weighings', 'recent', wPage],
    queryFn: () => api.get<Paginated<Weighing & { material?: Material | null }>>('/weighings', { page: wPage, pageSize: 10 }),
  })

  const entryCols: Column<InventoryMovement>[] = [
    { key: 'number', header: 'Movimiento', cell: (r) => <span className="font-medium whitespace-nowrap text-ink">{r.number}</span> },
    { key: 'date', header: 'Fecha', cell: (r) => <span className="whitespace-nowrap text-ink-secondary">{formatDateTime(r.createdAt)}</span> },
    { key: 'material', header: 'Material', cell: (r) => <span>{r.material?.code} · {r.material?.name}</span> },
    { key: 'origin', header: 'Origen', cell: (r) => r.origin ?? '—', hideOnMobile: true },
    { key: 'ref', header: 'Referencia', cell: (r) => <span className="whitespace-nowrap">{r.reference ?? '—'}</span>, hideOnMobile: true },
    { key: 'lot', header: 'Lote', cell: (r) => r.lot?.code ?? '—', hideOnMobile: true },
    { key: 'purity', header: 'Ley', align: 'right', cell: (r) => <span className="whitespace-nowrap">{formatPurity(r.purity)}</span>, hideOnMobile: true },
    { key: 'grams', header: 'Gramos', align: 'right', cell: (r) => <span className="font-semibold whitespace-nowrap text-ink">{formatGrams(r.grams)}</span> },
    { key: 'status', header: 'Estado', cell: (r) => (r.status === 'REVERSED' ? <Badge variant="danger">Reversado</Badge> : <StatusBadge map={MOVEMENT_TYPE} value={r.type} />) },
    { key: 'resp', header: 'Responsable', cell: (r) => r.responsible?.fullName ?? '—', hideOnMobile: true },
  ]

  const wCols: Column<Weighing & { material?: Material | null }>[] = [
    { key: 'number', header: 'Pesaje', cell: (r) => <span className="font-medium whitespace-nowrap text-ink">{r.number}</span> },
    { key: 'date', header: 'Fecha', cell: (r) => <span className="whitespace-nowrap text-ink-secondary">{formatDateTime(r.capturedAt)}</span> },
    { key: 'purpose', header: 'Propósito', cell: (r) => WEIGHING_PURPOSE[r.purpose] ?? r.purpose, hideOnMobile: true },
    { key: 'material', header: 'Material', cell: (r) => (r.material ? `${r.material.code} · ${r.material.name}` : '—') },
    {
      key: 'source',
      header: 'Fuente',
      cell: (r) =>
        r.source === 'MANUAL' ? (
          <Badge variant="warning"><SlidersHorizontal className="size-3" /> Manual</Badge>
        ) : (
          <Badge variant="gold"><Scale className="size-3" /> Balanza</Badge>
        ),
    },
    { key: 'reason', header: 'Motivo manual', cell: (r) => <span className="line-clamp-1 max-w-[220px] text-ink-secondary" title={r.manualReason ?? ''}>{r.manualReason ?? '—'}</span>, hideOnMobile: true },
    {
      key: 'net',
      header: 'Neto',
      align: 'right',
      cell: (r) => (
        <div className="leading-tight">
          <span className="font-semibold whitespace-nowrap text-ink">{formatGrams(r.currentNetGrams)}</span>
          {Math.abs(r.currentNetGrams - r.netGrams) > 0.00001 && <p className="text-[11px] text-warning">Ajustado · orig. {formatGrams(r.netGrams)}</p>}
        </div>
      ),
    },
    { key: 'used', header: 'Uso', cell: (r) => (r.usedById ? <Badge variant="neutral">Utilizado</Badge> : <Badge variant="info">Disponible</Badge>) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        canAdjust && !r.usedById ? (
          <Button
            size="sm"
            variant="ghost"
            data-testid={`weighing-adjust-${r.number}`}
            onClick={(e) => {
              e.stopPropagation()
              setAdjusting(r)
            }}
          >
            Ajustar
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="mt-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-3 flex items-center gap-2">
          <History className="size-4 text-ink-muted" />
          <TabsList className="flex-1">
            <TabsTrigger value="entries" count={entries.data?.total}>Últimas entradas</TabsTrigger>
            <TabsTrigger value="weighings" count={weighings.data?.total}>Pesajes recientes</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="entries">
          <Card flush>
            <DataTable
              testId="entries-table"
              columns={entryCols}
              rows={entries.data?.items}
              rowKey={(r) => r.id}
              loading={entries.isLoading}
              empty={{ title: 'Sin entradas registradas', description: 'Las entradas pesadas en la Balanza Madre aparecerán aquí.' }}
              pagination={entries.data ? { page: entryPage, pageSize: 10, total: entries.data.total, onPageChange: setEntryPage } : undefined}
            />
          </Card>
        </TabsContent>
        <TabsContent value="weighings">
          <Card flush>
            <DataTable
              testId="weighings-table"
              columns={wCols}
              rows={weighings.data?.items}
              rowKey={(r) => r.id}
              loading={weighings.isLoading}
              onRowClick={setDetail}
              empty={{ title: 'Sin pesajes', description: 'Cada captura de la Balanza Madre queda registrada aquí.' }}
              pagination={weighings.data ? { page: wPage, pageSize: 10, total: weighings.data.total, onPageChange: setWPage } : undefined}
            />
          </Card>
        </TabsContent>
      </Tabs>
      <WeighingDetailDrawer weighingId={detail?.id ?? null} onClose={() => setDetail(null)} onAdjust={canAdjust ? (w) => setAdjusting(w) : undefined} />
      <WeighingAdjustDialog weighing={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  )
}
