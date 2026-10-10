import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Circle, ListChecks, PackageOpen, Plus, ShieldAlert, Trash2, Truck } from 'lucide-react'
import { api, ApiError, errorMessage, type Paginated } from '@/lib/api/client'
import type { GlobalSummaryRow, InsufficiencyLine, MaterialDispatch, ProductionOrder, Weighing } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useMaterials, useWorkshops } from '@/lib/hooks/useMasters'
import { formatDate, formatGrams } from '@/lib/format'
import { DISPATCH_STATUS, ORDER_STATUS } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { WeighingCapture } from '@/components/domain/WeighingCapture'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { ReasonDialog } from '@/components/domain/ReasonDialog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/components/ui/Toaster'
import { InsufficiencyDialog, type InsufficiencyDecision, type InsufficiencyDetails } from './components/InsufficiencyDialog'

const DISPATCHABLE = ['PENDING_MATERIALS', 'READY_FOR_DISPATCH', 'DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'REJECTED_ADJUSTMENT']

interface Line { key: number; materialId: string; weighing: Weighing | null; suggestedGrams?: number }
interface Sufficiency {
  lines: { materialId: string; materialCode: string; materialName: string; requiredGrams: number; dispatchedGrams: number; pendingGrams: number; availableInOffice: number; shortfallGrams: number; sufficient: boolean }[]
  sufficient: boolean
}
interface SubmitVars { decision?: InsufficiencyDecision; overrideReason?: string }

let seq = 0
const newLine = (materialId = '', suggestedGrams?: number): Line => ({ key: ++seq, materialId, weighing: null, suggestedGrams })

/** P05 · Asignación (despacho) de material a taller (RF-009/010, RN-003/005/008, Escenarios A y C, CA-003). */
export default function DispatchPage() {
  const qc = useQueryClient()
  const canOverride = usePermission('inventory.override')
  const canModifyOrder = usePermission('orders.authorize_changes')
  const { data: materials = [] } = useMaterials()
  const { data: workshops = [] } = useWorkshops()

  const [workshopId, setWorkshopId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [touched, setTouched] = useState(false)
  const [result, setResult] = useState<MaterialDispatch | null>(null)
  const [insufficiency, setInsufficiency] = useState<InsufficiencyDetails | null>(null)
  const [stockIssue, setStockIssue] = useState<{ message: string; vars: SubmitVars } | null>(null)

  // Enlace profundo desde la orden (/asignaciones?orderId=…): preselecciona taller y orden.
  const search = useSearch({ strict: false }) as { orderId?: string }
  const linkedOrder = useQuery({
    queryKey: ['order', search.orderId],
    queryFn: () => api.get<ProductionOrder>(`/orders/${search.orderId}`),
    enabled: !!search.orderId,
  })
  useEffect(() => {
    if (linkedOrder.data && !workshopId) {
      setWorkshopId(linkedOrder.data.workshopId)
      setOrderId(linkedOrder.data.id)
    }
  }, [linkedOrder.data, workshopId])

  const orders = useQuery({
    queryKey: ['orders', 'dispatchable', workshopId],
    queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { workshopId, status: DISPATCHABLE, pageSize: 100 }),
    enabled: !!workshopId,
  })
  const order = orders.data?.items.find((o) => o.id === orderId) ?? null
  const sufficiency = useQuery({
    queryKey: ['orders', orderId, 'sufficiency'],
    queryFn: () => api.get<Sufficiency>(`/orders/${orderId}/sufficiency`),
    enabled: !!orderId,
  })
  const summary = useQuery({ queryKey: ['inventory', 'summary'], queryFn: () => api.get<GlobalSummaryRow[]>('/inventory/summary') })
  const officeByMaterial = useMemo(() => new Map((summary.data ?? []).map((r) => [r.material.id, r.office])), [summary.data])

  // Precarga de líneas sugeridas (pendiente por despachar) al elegir una orden.
  const preloadedFor = useRef<string>('')
  useEffect(() => {
    if (!orderId || !sufficiency.data || preloadedFor.current === orderId) return
    preloadedFor.current = orderId
    const pending = sufficiency.data.lines.filter((l) => l.pendingGrams > 0)
    if (!pending.length) return
    setLines((prev) => {
      const weighed = prev.filter((l) => l.weighing)
      const suggested = pending.filter((p) => !weighed.some((w) => w.materialId === p.materialId)).map((p) => newLine(p.materialId, p.pendingGrams))
      return [...weighed, ...suggested].length ? [...weighed, ...suggested] : [newLine()]
    })
  }, [orderId, sufficiency.data])

  const weighedLines = lines.filter((l) => l.materialId && l.weighing)
  const previewPayload = weighedLines.map((l) => ({ materialId: l.materialId, grams: l.weighing!.currentNetGrams }))
  const preview = useQuery({
    queryKey: ['dispatch-preview', orderId, previewPayload],
    queryFn: () => api.post<{ insufficient: InsufficiencyLine[]; ok: boolean }>('/dispatches/preview', { orderId, lines: previewPayload }),
    enabled: !!orderId,
  })

  // Validación de existencias (RN-003) contra Oficina Madre.
  const gramsByMaterial = new Map<string, number>()
  weighedLines.forEach((l) => gramsByMaterial.set(l.materialId, (gramsByMaterial.get(l.materialId) ?? 0) + l.weighing!.currentNetGrams))
  const overStock = [...gramsByMaterial.entries()].filter(([id, g]) => g > (officeByMaterial.get(id) ?? 0) + 0.00001)
  const totalGrams = [...gramsByMaterial.values()].reduce((s, g) => s + g, 0)

  const checks = {
    workshop: !!workshopId,
    purpose: purpose.trim().length >= 3,
    lines: lines.length > 0 && lines.every((l) => l.materialId && l.weighing),
  }
  const ready = checks.workshop && checks.purpose && checks.lines

  const submit = useMutation({
    mutationFn: (vars: SubmitVars) =>
      api.post<MaterialDispatch>('/dispatches', {
        orderId: orderId || undefined,
        workshopId: orderId ? undefined : workshopId,
        purpose: purpose.trim(),
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({ materialId: l.materialId, weighingId: l.weighing!.id })),
        insufficiencyDecision: vars.decision,
        overrideReason: vars.overrideReason,
      }),
    meta: { silent: true },
    onSuccess: (d) => {
      setInsufficiency(null)
      setStockIssue(null)
      setResult(d)
      notify.success(`Despacho ${d.number} generado · pendiente de aceptación del taller`)
      for (const k of ['inventory', 'dispatches', 'orders', 'weighings', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] })
    },
    onError: (e, vars) => {
      if (e instanceof ApiError && e.code === 'INSUFFICIENT_FOR_ORDER') {
        setInsufficiency(e.details as InsufficiencyDetails)
        return
      }
      if (e instanceof ApiError && e.code === 'INSUFFICIENT_STOCK' && canOverride) {
        setInsufficiency(null)
        setStockIssue({ message: e.message, vars })
        return
      }
      notify.error(errorMessage(e))
    },
  })

  const send = () => {
    setTouched(true)
    if (ready) submit.mutate({})
  }

  const reset = () => {
    setOrderId('')
    setPurpose('')
    setNotes('')
    setLines([newLine()])
    setTouched(false)
    setResult(null)
    preloadedFor.current = ''
  }

  const updateLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const completeFromInventory = (missing: InsufficiencyLine[]) => {
    setLines((ls) => {
      let next = [...ls]
      for (const m of missing) {
        const open = next.find((l) => l.materialId === m.materialId && !l.weighing)
        if (open) next = next.map((l) => (l.key === open.key ? { ...l, suggestedGrams: m.shortfallGrams } : l))
        else next.push(newLine(m.materialId, m.shortfallGrams))
      }
      return next
    })
    setInsufficiency(null)
    notify.info('Pesa el faltante en las líneas agregadas y vuelve a despachar.')
  }

  if (result) return <DispatchResult dispatch={result} onNew={reset} />

  return (
    <div>
      <PageHeader
        code="P05"
        title="Asignación a taller"
        description="Entrega material pesado en la Balanza Madre a un taller. Queda en tránsito hasta que el taller lo acepte con firma digital; después pasa a su custodia."
        actions={
          <Link to="/despachos">
            <Button variant="secondary"><Truck className="size-4" /> Ver despachos</Button>
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card title="Destino y propósito">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Taller" required error={touched && !checks.workshop ? 'Selecciona el taller destino' : undefined}>
                <NativeSelect
                  data-testid="dispatch-workshop"
                  placeholder="Selecciona el taller…"
                  options={workshops.filter((w) => w.status === 'ACTIVE').map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))}
                  value={workshopId}
                  onChange={(e) => {
                    setWorkshopId(e.target.value)
                    setOrderId('')
                    preloadedFor.current = ''
                  }}
                />
              </FormField>
              <FormField label="Orden de producción" hint={workshopId && orders.data && !orders.data.items.length ? 'El taller no tiene órdenes despachables.' : 'Opcional (RN-005: cuando aplique).'}>
                <NativeSelect
                  data-testid="dispatch-order"
                  placeholder={!workshopId ? 'Primero elige el taller' : orders.isLoading ? 'Cargando…' : 'Sin orden (entrega general)'}
                  disabled={!workshopId}
                  options={(orders.data?.items ?? []).map((o) => ({ value: o.id, label: `${o.number} · ${o.product.name} · ${ORDER_STATUS[o.status]?.label ?? o.status}` }))}
                  value={orderId}
                  onChange={(e) => {
                    setOrderId(e.target.value)
                    preloadedFor.current = ''
                  }}
                />
              </FormField>
              <FormField label="Propósito / motivo" required error={touched && !checks.purpose ? 'Indica el propósito de la entrega (mínimo 3 caracteres)' : undefined} className="sm:col-span-2">
                <Textarea data-testid="dispatch-purpose" rows={2} maxLength={1000} placeholder="Ej. Fabricación de 10 anillos clásicos talla 7" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </FormField>
              <FormField label="Observaciones" className="sm:col-span-2">
                <Textarea data-testid="dispatch-notes" rows={2} maxLength={2000} placeholder="Instrucciones para el taller (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormField>
            </div>
          </Card>

          {order && <OrderRequirements order={order} sufficiency={sufficiency.data} loading={sufficiency.isLoading} />}

          <Card
            title="Líneas de material"
            actions={
              <Button size="sm" variant="secondary" data-testid="dispatch-add-line" onClick={() => setLines((ls) => [...ls, newLine()])}>
                <Plus className="size-3.5" /> Agregar línea
              </Button>
            }
          >
            <p className="-mt-1 mb-3 text-[12px] text-ink-muted">El peso de cada línea proviene del pesaje de salida en la Balanza Madre (RF-010).</p>
            <ol className="space-y-3">
              {lines.map((l, i) => {
                const office = l.materialId ? officeByMaterial.get(l.materialId) : undefined
                const over = overStock.some(([id]) => id === l.materialId)
                return (
                  <li key={l.key} className={cn('rounded-md border p-3', over ? 'border-warning/60 bg-warning-bg/40' : 'border-border bg-page/50')} data-testid={`dispatch-line-${i}`}>
                    <div className="mb-2.5 flex flex-wrap items-end gap-3">
                      <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-800">{i + 1}</span>
                      <FormField label="Material" className="min-w-[240px] flex-1" error={touched && !l.materialId ? 'Selecciona el material' : undefined}>
                        <NativeSelect
                          data-testid={`dispatch-line-material-${i}`}
                          placeholder="Selecciona el material…"
                          disabled={!!l.weighing}
                          options={materials.filter((m) => m.status === 'ACTIVE').map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))}
                          value={l.materialId}
                          onChange={(e) => updateLine(l.key, { materialId: e.target.value })}
                        />
                      </FormField>
                      <div className="pb-1 text-[12px] leading-tight">
                        <p className="text-ink-muted">Disponible en oficina</p>
                        <p className={cn('font-semibold tnum', over ? 'text-warning' : 'text-ink')}>{office !== undefined ? formatGrams(office) : '—'}</p>
                      </div>
                      {l.suggestedGrams !== undefined && (
                        <div className="pb-1 text-[12px] leading-tight">
                          <p className="text-ink-muted">Sugerido</p>
                          <p className="font-semibold text-brand-700 tnum">{formatGrams(l.suggestedGrams)}</p>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label="Quitar línea"
                        data-testid={`dispatch-line-remove-${i}`}
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {l.materialId ? (
                      <WeighingCapture purpose="DISPATCH" compact materialId={l.materialId} value={l.weighing} onCaptured={(w) => updateLine(l.key, { weighing: w })} testId={`dispatch-line-weighing-${i}`} label={`Balanza Madre · línea ${i + 1}`} />
                    ) : (
                      <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-[12px] text-ink-muted">Selecciona el material para habilitar el pesaje.</p>
                    )}
                    {touched && l.materialId && !l.weighing && <p className="mt-1.5 text-[12px] text-danger">Captura el peso de esta línea.</p>}
                    {over && <p className="mt-1.5 flex items-center gap-1 text-[12px] text-warning"><AlertTriangle className="size-3.5" /> Lo pesado supera la existencia en Oficina Madre (RN-003).</p>}
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card title="Validación previa">
            <ul className="space-y-2 text-[13px]">
              <Check ok={checks.workshop} label={workshopId ? `Taller ${workshops.find((w) => w.id === workshopId)?.name ?? ''}` : 'Taller destino'} />
              <Check ok={checks.purpose} label="Propósito de la entrega" />
              <Check ok={checks.lines} label={`Líneas pesadas ${lines.filter((l) => l.weighing).length}/${lines.length}`} />
              <Check ok={overStock.length === 0} warn label={overStock.length ? 'Supera la existencia en oficina' : 'Existencia en Oficina Madre'} />
              {orderId && (
                <Check
                  ok={!!preview.data?.ok}
                  warn
                  loading={preview.isFetching}
                  label={preview.data?.ok ? 'Suficiente para el objetivo de la orden' : 'Insuficiente para el objetivo de la orden'}
                />
              )}
            </ul>
            {orderId && preview.data && !preview.data.ok && (
              <div data-testid="dispatch-preview-insufficient" className="mt-3 space-y-1.5 rounded-md border border-warning/40 bg-warning-bg/60 px-3 py-2">
                {preview.data.insufficient.map((i) => (
                  <div key={i.materialId} className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-ink-secondary">{i.materialName}</span>
                    <span className="font-semibold text-danger tnum">faltan {formatGrams(i.shortfallGrams)}</span>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-ink-muted">Al despachar podrás completar, solicitar fabricación o despachar parcialmente.</p>
              </div>
            )}
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-ink-muted">Total a despachar</span>
                <span className="text-[22px] font-semibold text-ink tnum">{formatGrams(totalGrams)}</span>
              </div>
              {gramsByMaterial.size > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {[...gramsByMaterial.entries()].map(([id, g]) => {
                    const m = materials.find((x) => x.id === id)
                    return (
                      <li key={id} className="flex justify-between text-[12px] text-ink-secondary">
                        <span>{m?.code} · {m?.name}</span>
                        <span className="tnum">{formatGrams(g)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <Button data-testid="dispatch-submit" size="lg" className="mt-4 w-full" loading={submit.isPending} disabled={touched && !ready} onClick={send}>
              <Truck className="size-4" /> Despachar al taller
            </Button>
            <p className="mt-2 text-center text-[11px] text-ink-muted">El taller deberá aceptar el despacho con firma digital.</p>
          </Card>
        </div>
      </div>

      <InsufficiencyDialog
        data={insufficiency}
        orderNumber={order?.number}
        canModifyOrder={canModifyOrder}
        workshops={workshops}
        loading={submit.isPending}
        onClose={() => setInsufficiency(null)}
        onCompleteFromInventory={completeFromInventory}
        onConfirm={(decision) => submit.mutate({ decision })}
      />
      <ReasonDialog
        open={!!stockIssue}
        onOpenChange={(o) => !o && setStockIssue(null)}
        title="Autorización excepcional (RN-003)"
        description={`${stockIssue?.message ?? ''}. Puedes autorizar el despacho por encima de la existencia; quedará auditado con tu usuario y motivo.`}
        label="Motivo de la autorización"
        confirmLabel="Autorizar y despachar"
        danger
        loading={submit.isPending}
        onConfirm={(reason) => submit.mutate({ ...stockIssue!.vars, overrideReason: reason })}
      />
    </div>
  )
}

function Check({ ok, label, warn, loading }: { ok: boolean; label: string; warn?: boolean; loading?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {loading ? (
        <Spinner size="sm" />
      ) : ok ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" />
      ) : warn ? (
        <AlertTriangle className="size-4 shrink-0 text-warning" />
      ) : (
        <Circle className="size-4 shrink-0 text-ink-placeholder" />
      )}
      <span className={cn(ok ? 'text-ink' : warn ? 'text-warning' : 'text-ink-muted')}>{label}</span>
    </li>
  )
}

function OrderRequirements({ order, sufficiency, loading }: { order: ProductionOrder; sufficiency?: Sufficiency; loading: boolean }) {
  return (
    <Card
      flush
      title={`Requerimientos de ${order.number}`}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge map={ORDER_STATUS} value={order.status} />
          {sufficiency && (sufficiency.sufficient ? <Badge variant="success">Inventario suficiente</Badge> : <Badge variant="danger">Faltante en inventario</Badge>)}
        </div>
      }
    >
      <p className="-mt-1 px-4 pb-3 text-[12px] text-ink-muted">
        {order.product.name}
        {order.variant && ` · ${order.variant.name}`} · objetivo {formatGrams(order.targetGrams)}
        {order.targetUnits ? ` · ${order.targetUnits} u` : ''} · compromiso {formatDate(order.commitmentDate)}
      </p>
      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="overflow-x-auto">
          <table data-testid="dispatch-requirements" className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-border bg-sunken/60">
                {['Insumo', 'Requerido', 'Despachado', 'Pendiente', 'En oficina', 'Estado'].map((h, i) => (
                  <th key={h} className={cn('eyebrow px-3 py-2 whitespace-nowrap', i === 0 ? 'text-left' : i === 5 ? 'text-center' : 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sufficiency?.lines ?? []).map((l) => (
                <tr key={l.materialId} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2"><span className="font-medium text-ink">{l.materialName}</span> <span className="text-[11px] text-ink-muted">{l.materialCode}</span></td>
                  <td className="px-3 py-2 text-right tnum">{formatGrams(l.requiredGrams)}</td>
                  <td className="px-3 py-2 text-right text-ink-secondary tnum">{formatGrams(l.dispatchedGrams)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-ink tnum">{formatGrams(l.pendingGrams)}</td>
                  <td className="px-3 py-2 text-right text-ink-secondary tnum">{formatGrams(l.availableInOffice)}</td>
                  <td className="px-3 py-2 text-center">
                    {l.pendingGrams <= 0 ? <Badge variant="neutral">Completo</Badge> : l.sufficient ? <Badge variant="success">Alcanza</Badge> : <Badge variant="danger">Faltan {formatGrams(l.shortfallGrams)}</Badge>}
                  </td>
                </tr>
              ))}
              {sufficiency && sufficiency.lines.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-ink-muted">La orden no tiene requerimientos calculados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function DispatchResult({ dispatch, onNew }: { dispatch: MaterialDispatch; onNew: () => void }) {
  const total = dispatch.lines.reduce((s, l) => s + l.grams, 0)
  return (
    <div>
      <PageHeader code="P05" title="Asignación a taller" />
      <Card className="border-success/30">
        <div data-testid="dispatch-success" className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-bg">
              <CheckCircle2 className="size-6 text-success" />
            </span>
            <div>
              <p className="eyebrow">Despacho generado</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[22px] font-semibold text-ink">
                <span data-testid="dispatch-number">{dispatch.number}</span>
                <StatusBadge map={DISPATCH_STATUS} value={dispatch.status} />
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                {formatGrams(total)} a <b className="font-semibold text-ink">{dispatch.workshop.name}</b>
                {dispatch.order && <> · orden {dispatch.order.number}</>} · {dispatch.purpose}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-muted">El material queda en tránsito hasta que el taller lo acepte con firma digital; luego pasa a su custodia (RN-004).</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onNew} data-testid="dispatch-new">
              <Plus className="size-4" /> Nueva asignación
            </Button>
            {dispatch.orderId && (
              <Link to="/ordenes/$orderId" params={{ orderId: dispatch.orderId }}>
                <Button variant="secondary"><ListChecks className="size-4" /> Ver orden</Button>
              </Link>
            )}
            <Link to="/despachos">
              <Button><PackageOpen className="size-4" /> Ver despachos</Button>
            </Link>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-sunken/60">
                {['Material', 'Lote', 'Pesaje', 'Gramos'].map((h, i) => (
                  <th key={h} className={cn('eyebrow px-3 py-2', i === 3 ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatch.lines.map((l) => (
                <tr key={l.id} className="border-t border-border/70">
                  <td className="px-3 py-2">{l.material.code} · {l.material.name}</td>
                  <td className="px-3 py-2">{l.lot?.code ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-secondary">
                    {l.weighing?.number ?? '—'}
                    {l.overrideApplied && <Badge variant="danger" className="ml-2"><ShieldAlert className="size-3" /> Autorización excepcional</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-ink tnum">{formatGrams(l.grams)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
