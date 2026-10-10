import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ClipboardCheck, FlaskConical, Paperclip, Plus, Scale, Trash2, XCircle } from 'lucide-react'
import { ApiError, api } from '@/lib/api/client'
import type { MediaFile, OrderDetail, ProductionReceipt, SystemParameter, Weighing } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { PURITY_METHOD, RECEIPT_LINE } from '@/lib/labels'
import { formatDate, formatDateTime, formatGrams, formatNumber, formatPercent, formatPurity, todayIso } from '@/lib/format'
import { cn } from '@/lib/cn'
import { WeighingCapture } from '@/components/domain/WeighingCapture'
import { MediaUploader } from '@/components/domain/MediaUploader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'
import { DEFAULT_CHECKLIST, PARTIAL_RECEIPT } from './orderUtils'
import { KV, MiniTable, Notice, useInvalidateOrders } from './bits'

export const useParameters = () => useQuery({ queryKey: ['parameters'], queryFn: () => api.get<SystemParameter[]>('/parameters'), staleTime: 5 * 60_000 })
const paramValue = <T,>(params: SystemParameter[] | undefined, key: string, fallback: T): T => {
  const p = params?.find((x) => x.key === key)
  return p ? (p.value as T) : fallback
}

/** Objetivo de ley de la orden: ficha técnica asociada o producto. */
export function purityTarget(o: OrderDetail) {
  const target = o.technicalSheet?.targetPurity ?? o.product.targetPurity
  const tol = o.technicalSheet?.purityTolerance ?? o.product.purityTolerance ?? 0
  return { target, tol }
}

/** P11 · Recepción y control de calidad / ley (RF-019/020/044, RN-021, CA-013). */
export function ReceptionTab({ o }: { o: OrderDetail }) {
  const canReceive = usePermission('orders.receive')
  const canWeigh = usePermission('scale.weigh')
  const canFinal = o.status === 'FINISHED_BY_WORKSHOP'
  const canPartial = PARTIAL_RECEIPT.includes(o.status)
  const showForm = canReceive && canWeigh && (canFinal || canPartial)
  const finishedReceipts = o.receipts.filter((r) => r.lines.some((l) => l.lineType === 'FINISHED_PRODUCT'))
  const { target, tol } = purityTarget(o)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusTile okText="Aprobado" badText="Rechazado" label="Control de calidad" required={o.product.requiresQualityCheck} state={qualityState(o)} />
        <StatusTile okText="Conforme" badText="No conforme" label="Ley / pureza" required={o.product.requiresPurityCheck} state={purityState(o)} hint={target ? `Objetivo ${formatPurity(target)} ± ${formatNumber(tol, 2)}` : undefined} />
        <div className="rounded-md border border-border bg-surface p-3 shadow-card">
          <p className="eyebrow">Producto recibido</p>
          <p className="mt-1 text-[18px] font-semibold tnum">{formatGrams(finishedReceipts.reduce((s, r) => s + r.lines.filter((l) => l.lineType === 'FINISHED_PRODUCT').reduce((a, l) => a + l.grams, 0), 0))}</p>
          <p className="text-[11.5px] text-ink-muted">{o.receipts.length} recepción(es) · {finishedReceipts.length} con producto</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3 shadow-card">
          <p className="eyebrow">Declarado por el taller</p>
          {o.declarations.find((d) => d.current) ? (
            <>
              <p className="mt-1 text-[18px] font-semibold tnum">{formatGrams(o.declarations.find((d) => d.current)!.grams)}</p>
              <p className="text-[11.5px] text-ink-muted">{o.declarations.find((d) => d.current)!.units ?? '—'} unidades</p>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-ink-muted">Sin declaración</p>
          )}
        </div>
      </div>

      {showForm && <ReceiptForm o={o} allowFinal={canFinal} />}
      {!showForm && o.receipts.length === 0 && (
        <EmptyState icon={Scale} title="Sin recepciones" description={['DRAFT', 'PENDING_MATERIALS', 'READY_FOR_DISPATCH', 'DISPATCHED'].includes(o.status) ? 'La recepción se habilita cuando el taller acepta la entrega y produce.' : 'No hay recepciones registradas para esta orden.'} />
      )}

      {o.receipts.map((r) => (
        <ReceiptCard key={r.id} o={o} r={r} />
      ))}
    </div>
  )
}

type CheckState = 'ok' | 'bad' | 'pending' | 'na'
function qualityState(o: OrderDetail): CheckState {
  if (!o.product.requiresQualityCheck) return 'na'
  if (!o.quality.length) return 'pending'
  const last = [...o.quality].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0]
  return last.result === 'APPROVED' ? 'ok' : 'bad'
}
function purityState(o: OrderDetail): CheckState {
  if (!o.product.requiresPurityCheck) return 'na'
  if (!o.purity.length) return 'pending'
  const last = [...o.purity].sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))[0]
  return last.conforming ? 'ok' : 'bad'
}

function StatusTile({ label, required, state, hint, okText, badText }: { label: string; required: boolean; state: CheckState; hint?: string; okText: string; badText: string }) {
  const map = {
    ok: { text: okText, cls: 'border-success/30 bg-success-bg text-success', icon: CheckCircle2 },
    bad: { text: badText, cls: 'border-danger/30 bg-danger-bg text-danger', icon: XCircle },
    pending: { text: 'Pendiente', cls: 'border-warning/30 bg-warning-bg text-warning', icon: AlertTriangle },
    na: { text: 'No requerido', cls: 'border-border bg-sunken text-ink-muted', icon: CheckCircle2 },
  }[state]
  const Icon = map.icon
  return (
    <div className={cn('rounded-md border p-3', map.cls)}>
      <p className="text-[11px] font-bold tracking-wider uppercase opacity-80">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold">
        <Icon className="size-4" /> {map.text}
      </p>
      <p className="text-[11.5px] opacity-80">{required ? (hint ?? 'Obligatorio antes de aprobar (RN-021)') : 'El producto no tiene este control configurado'}</p>
    </div>
  )
}

interface Line {
  key: number
  lineType: string
  materialId: string
  units: string
  weighing: Weighing | null
}

function ReceiptForm({ o, allowFinal }: { o: OrderDetail; allowFinal: boolean }) {
  const invalidate = useInvalidateOrders()
  const params = useParameters()
  const tolPct = paramValue(params.data, 'production.receptionTolerancePct', 0.5)
  const declaration = o.declarations.find((d) => d.current)
  const [type, setType] = useState<'PARTIAL' | 'FINAL'>(allowFinal ? 'FINAL' : 'PARTIAL')
  const [lines, setLines] = useState<Line[]>([{ key: 1, lineType: 'FINISHED_PRODUCT', materialId: '', units: declaration?.units ? String(declaration.units) : '', weighing: null }])
  const [notes, setNotes] = useState('')
  const [warnings, setWarnings] = useState<string[] | null>(null)

  const custodyMaterials = o.custody.filter((c) => c.balance > 0)
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const productGrams = lines.filter((l) => l.lineType === 'FINISHED_PRODUCT').reduce((s, l) => s + (l.weighing?.currentNetGrams ?? 0), 0)
  const productUnits = lines.filter((l) => l.lineType === 'FINISHED_PRODUCT').reduce((s, l) => s + (Number(l.units) || 0), 0)
  const diff = declaration ? declaration.grams - productGrams : 0
  const diffPct = declaration && declaration.grams > 0 ? (diff / declaration.grams) * 100 : 0
  const outOfTol = Math.abs(diffPct) > tolPct

  const lineErrors = lines.map((l) => (!l.weighing ? 'Captura el peso' : l.lineType !== 'FINISHED_PRODUCT' && !l.materialId ? 'Selecciona el material' : null))
  const finalWithoutProduct = type === 'FINAL' && !lines.some((l) => l.lineType === 'FINISHED_PRODUCT')
  const valid = lines.length > 0 && lineErrors.every((e) => !e) && !finalWithoutProduct

  const submit = useMutation({
    mutationFn: (acknowledgeWarnings: boolean) =>
      api.post<ProductionReceipt>(`/orders/${o.id}/receipts`, {
        type,
        notes: notes.trim() || undefined,
        acknowledgeWarnings: acknowledgeWarnings || undefined,
        lines: lines.map((l) => ({
          lineType: l.lineType,
          materialId: l.lineType === 'FINISHED_PRODUCT' ? undefined : l.materialId,
          units: l.units ? Number(l.units) : undefined,
          weighingId: l.weighing!.id,
        })),
      }),
    meta: { silent: true },
    onSuccess: (r) => {
      notify.success(`Recepción ${r.number} registrada${type === 'FINAL' ? ' · orden en revisión' : ''}`)
      setWarnings(null)
      setLines([{ key: Date.now(), lineType: 'FINISHED_PRODUCT', materialId: '', units: '', weighing: null }])
      setNotes('')
      invalidate()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'PLAUSIBILITY_WARNING') {
        const w = (e.details as { warnings?: string[] } | null)?.warnings
        setWarnings(w?.length ? w : [e.message])
        return
      }
      notify.error(e.message)
    },
  })

  return (
    <Card title="Nueva recepción pesada (RF-019/020)" actions={<Scale className="size-4 text-brand-600" />}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-6">
          <FormField label="Tipo de recepción">
            <div data-testid="receipt-type">
              <RadioGroup
                orientation="horizontal"
                value={type}
                onValueChange={(v) => setType(v as 'PARTIAL' | 'FINAL')}
                options={[
                  { value: 'PARTIAL', label: 'Parcial' },
                  { value: 'FINAL', label: 'Final', disabled: !allowFinal },
                ]}
              />
            </div>
          </FormField>
          <p className="max-w-xl pb-1 text-[12px] text-ink-muted">
            {type === 'FINAL'
              ? 'La recepción final debe incluir el producto terminado y pasa la orden a "En revisión Prestige Gold".'
              : allowFinal
                ? 'Parcial: recibe una parte del producto, sobrantes o devoluciones sin cerrar la etapa del taller.'
                : 'La recepción final se habilita cuando el taller declara el producto terminado.'}
          </p>
        </div>

        <div className="space-y-3">
          {lines.map((l, i) => {
            const isProduct = l.lineType === 'FINISHED_PRODUCT'
            return (
              <div key={l.key} className="rounded-md border border-border bg-sunken/30 p-3" data-testid={`receipt-line-${i}`}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-ink-secondary">Línea {i + 1}</p>
                  {lines.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                      <Trash2 className="size-3.5" /> Quitar
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <div className="grid content-start gap-3 sm:grid-cols-2">
                    <FormField label="Tipo de línea" required>
                      <NativeSelect
                        data-testid={`receipt-line-type-${i}`}
                        value={l.lineType}
                        onChange={(e) => update(l.key, { lineType: e.target.value, materialId: '', weighing: null })}
                        options={Object.entries(RECEIPT_LINE).map(([value, label]) => ({ value, label }))}
                      />
                    </FormField>
                    {isProduct ? (
                      <FormField label="Unidades">
                        <Input data-testid={`receipt-line-units-${i}`} type="number" min={0} value={l.units} onChange={(e) => update(l.key, { units: e.target.value })} />
                      </FormField>
                    ) : (
                      <FormField label="Material" required hint={custodyMaterials.length ? undefined : 'No hay material en custodia para esta orden'}>
                        <NativeSelect
                          data-testid={`receipt-line-material-${i}`}
                          value={l.materialId}
                          placeholder="Material en custodia…"
                          onChange={(e) => update(l.key, { materialId: e.target.value, weighing: null })}
                          options={custodyMaterials.map((c) => ({ value: c.materialId, label: `${c.material.name} · ${formatGrams(c.balance)} en custodia` }))}
                        />
                      </FormField>
                    )}
                    {lineErrors[i] && <p className="text-[12px] text-warning sm:col-span-2">{lineErrors[i]}</p>}
                  </div>
                  <WeighingCapture
                    purpose="RECEPTION"
                    compact
                    materialId={isProduct ? null : l.materialId || null}
                    value={l.weighing}
                    onCaptured={(w) => update(l.key, { weighing: w })}
                    testId={`receipt-weighing-${i}`}
                    label={isProduct ? 'Balanza Madre · producto terminado' : 'Balanza Madre · retorno'}
                  />
                </div>
              </div>
            )
          })}
          <Button variant="secondary" size="sm" data-testid="receipt-add-line" onClick={() => setLines((ls) => [...ls, { key: Date.now(), lineType: custodyMaterials.length ? 'LEFTOVER' : 'FINISHED_PRODUCT', materialId: '', units: '', weighing: null }])}>
            <Plus className="size-3.5" /> Agregar línea (sobrante, no utilizado, devolución…)
          </Button>
        </div>

        {declaration && productGrams > 0 && (
          <div className="rounded-md border border-border" data-testid="receipt-comparison">
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              <div className="bg-surface px-3 py-2"><KV label="Declarado por taller"><span className="font-semibold tnum">{formatGrams(declaration.grams)}</span>{declaration.units ? <span className="text-ink-muted"> · {declaration.units} u</span> : null}</KV></div>
              <div className="bg-surface px-3 py-2"><KV label="Pesado en balanza"><span className="font-semibold tnum">{formatGrams(productGrams)}</span>{productUnits ? <span className="text-ink-muted"> · {productUnits} u</span> : null}</KV></div>
              <div className="bg-surface px-3 py-2"><KV label="Diferencia"><span className={cn('font-semibold tnum', outOfTol ? 'text-danger' : 'text-success')}>{formatGrams(diff)} ({formatPercent(diffPct, 2)})</span></KV></div>
              <div className="bg-surface px-3 py-2"><KV label="Tolerancia de recepción">{formatPercent(tolPct, 2)}</KV></div>
            </div>
            {type === 'FINAL' && outOfTol && <p className="border-t border-border bg-danger-bg px-3 py-2 text-[12px] text-danger">Fuera de tolerancia: al registrar se generará una diferencia de recepción pendiente de justificación y aprobación (RF-022).</p>}
          </div>
        )}

        <FormField label="Observaciones de la recepción">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>

        {warnings && (
          <Notice tone="warning" icon={<AlertTriangle />} title="Advertencias de plausibilidad" className="items-start">
            <ul className="list-disc space-y-0.5 pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Button size="sm" data-testid="receipt-acknowledge" loading={submit.isPending} onClick={() => submit.mutate(true)}>
                Confirmar y registrar de todas formas
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setWarnings(null)}>
                Revisar
              </Button>
            </div>
          </Notice>
        )}

        <div className="flex items-center justify-end gap-3">
          {finalWithoutProduct && <p className="text-[12px] text-danger">La recepción final debe incluir el producto terminado.</p>}
          <Button size="lg" data-testid="receipt-submit" disabled={!valid} loading={submit.isPending && !warnings} onClick={() => submit.mutate(false)}>
            Registrar recepción {type === 'FINAL' ? 'final' : 'parcial'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ReceiptCard({ o, r }: { o: OrderDetail; r: ProductionReceipt }) {
  const canVerify = usePermission('quality.verify')
  const hasProduct = r.lines.some((l) => l.lineType === 'FINISHED_PRODUCT')
  const quality = o.quality.filter((q) => q.receiptId === r.id).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
  const purity = o.purity.filter((p) => p.receiptId === r.id).sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))
  const open = !['APPROVED_CLOSED', 'CANCELLED'].includes(o.status)
  const [form, setForm] = useState<null | 'quality' | 'purity'>(null)
  const c = r.comparison as Record<string, number> | null

  return (
    <Card flush>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <p className="font-semibold text-ink">{r.number}</p>
        <Badge variant={r.type === 'FINAL' ? 'gold' : 'info'}>Recepción {r.type === 'FINAL' ? 'final' : 'parcial'}</Badge>
        {hasProduct && o.product.requiresQualityCheck && (
          <Badge variant={quality[0] ? (quality[0].result === 'APPROVED' ? 'success' : 'danger') : 'warning'}>{quality[0] ? (quality[0].result === 'APPROVED' ? 'Calidad aprobada' : 'Calidad rechazada') : 'Calidad pendiente'}</Badge>
        )}
        {hasProduct && o.product.requiresPurityCheck && (
          <Badge variant={purity[0] ? (purity[0].conforming ? 'success' : 'danger') : 'warning'}>{purity[0] ? (purity[0].conforming ? `Ley conforme ${formatPurity(purity[0].obtainedValue)}` : `Ley no conforme ${formatPurity(purity[0].obtainedValue)}`) : 'Ley pendiente'}</Badge>
        )}
        <span className="ml-auto text-[12px] text-ink-muted">{formatDateTime(r.createdAt)}</span>
      </div>
      <MiniTable head={[{ label: 'Tipo' }, { label: 'Material' }, { label: 'Pesaje' }, { label: 'Unidades', align: 'right' }, { label: 'Peso', align: 'right' }]}>
        {r.lines.map((l) => (
          <tr key={l.id}>
            <td>
              <Badge variant={l.lineType === 'FINISHED_PRODUCT' ? 'gold' : 'neutral'}>{RECEIPT_LINE[l.lineType] ?? l.lineType}</Badge>
            </td>
            <td className="font-medium">{l.material?.name ?? o.product.name}</td>
            <td className="ledger text-ink-secondary">{l.weighing ? `${l.weighing.number}${l.weighing.source === 'MANUAL' ? ' · manual' : ''}` : '—'}</td>
            <td className="text-right tnum">{l.units ?? '—'}</td>
            <td className="text-right font-semibold tnum">{formatGrams(l.grams)}</td>
          </tr>
        ))}
      </MiniTable>
      {c && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border bg-sunken/40 px-4 py-2 text-[12px] text-ink-secondary">
          <span>Declarado: <b className="text-ink tnum">{formatGrams(c.declaredGrams)}</b>{c.declaredUnits ? ` · ${c.declaredUnits} u` : ''}</span>
          <span>Recibido: <b className="text-ink tnum">{formatGrams(c.receivedGrams)}</b>{c.receivedUnits ? ` · ${c.receivedUnits} u` : ''}</span>
          <span className={cn(Math.abs(c.differencePct) > c.tolerancePct ? 'text-danger' : 'text-success')}>
            Diferencia: <b className="tnum">{formatGrams(c.differenceGrams)} ({formatPercent(c.differencePct, 2)})</b> · tolerancia {formatPercent(c.tolerancePct, 2)}
          </span>
        </div>
      )}
      {r.notes && <p className="border-t border-border px-4 py-2 text-[12px] text-ink-secondary">{r.notes}</p>}

      {hasProduct && (
        <div className="border-t border-border px-4 py-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow flex items-center gap-1.5"><ClipboardCheck className="size-3.5" /> Control de calidad</p>
                {canVerify && open && form !== 'quality' && (
                  <Button size="sm" variant={quality.length ? 'ghost' : 'secondary'} data-testid={`quality-open-${r.number}`} onClick={() => setForm('quality')}>
                    {quality.length ? 'Nuevo control' : 'Registrar control'}
                  </Button>
                )}
              </div>
              {form === 'quality' && <QualityForm o={o} r={r} onDone={() => setForm(null)} />}
              {quality.length === 0 && form !== 'quality' && <p className="text-[12px] text-ink-muted">Sin controles registrados.</p>}
              <ul className="space-y-2">
                {quality.map((q) => (
                  <li key={q.id} className="rounded-md border border-border p-2.5 text-[12px]">
                    <div className="flex items-center justify-between">
                      <Badge variant={q.result === 'APPROVED' ? 'success' : 'danger'}>{q.result === 'APPROVED' ? 'Aprobado' : 'Rechazado'}</Badge>
                      <span className="text-ink-muted">{formatDateTime(q.checkedAt)}</span>
                    </div>
                    <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {q.checklist.map((c) => (
                        <li key={c.item} className={cn('flex items-center gap-1', c.ok ? 'text-ink-secondary' : 'text-danger')}>
                          {c.ok ? <CheckCircle2 className="size-3 text-success" /> : <XCircle className="size-3" />} {c.item}
                          {c.note ? <span className="text-ink-muted"> · {c.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                    {q.notes && <p className="mt-1 text-ink-muted">{q.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow flex items-center gap-1.5"><FlaskConical className="size-3.5" /> Verificación de ley / pureza (RF-044)</p>
                {canVerify && open && form !== 'purity' && (
                  <Button size="sm" variant={purity.length ? 'ghost' : 'secondary'} data-testid={`purity-open-${r.number}`} onClick={() => setForm('purity')}>
                    {purity.length ? 'Nueva verificación' : 'Registrar verificación'}
                  </Button>
                )}
              </div>
              {form === 'purity' && <PurityForm o={o} r={r} onDone={() => setForm(null)} />}
              {purity.length === 0 && form !== 'purity' && <p className="text-[12px] text-ink-muted">{o.product.requiresPurityCheck ? 'Pendiente: obligatoria antes de aprobar (RN-021).' : 'No requerida para este producto.'}</p>}
              <ul className="space-y-2">
                {purity.map((p) => (
                  <li key={p.id} className={cn('rounded-md border p-2.5 text-[12px]', p.conforming ? 'border-success/30 bg-success-bg/40' : 'border-danger/30 bg-danger-bg/40')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-[16px] font-semibold tnum', p.conforming ? 'text-success' : 'text-danger')}>{formatPurity(p.obtainedValue)}</p>
                      <Badge variant={p.conforming ? 'success' : 'danger'}>{p.conforming ? 'Conforme' : 'No conforme'}</Badge>
                    </div>
                    <p className="text-ink-secondary">
                      Objetivo {formatPurity(p.targetValue)} ± {formatNumber(p.tolerance, 2)} · {PURITY_METHOD[p.method] ?? p.method}
                    </p>
                    <p className="text-ink-muted">
                      {p.supportReference ? `Soporte: ${p.supportReference} · ` : ''}
                      {formatDate(p.verifiedAt)}
                    </p>
                    {p.notes && <p className="mt-0.5 text-ink-muted">{p.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function QualityForm({ o, r, onDone }: { o: OrderDetail; r: ProductionReceipt; onDone: () => void }) {
  const invalidate = useInvalidateOrders()
  const params = useParameters()
  const items = useMemo(() => {
    const v = paramValue<unknown>(params.data, 'quality.checklist', DEFAULT_CHECKLIST)
    return Array.isArray(v) && v.length ? (v as string[]) : DEFAULT_CHECKLIST
  }, [params.data])
  const [checks, setChecks] = useState<Record<string, { ok: boolean; note: string }>>({})
  const [result, setResult] = useState<'APPROVED' | 'REJECTED' | ''>('')
  const [notes, setNotes] = useState('')
  const state = (item: string) => checks[item] ?? { ok: true, note: '' }
  const allOk = items.every((i) => state(i).ok)
  const effective = result || (allOk ? 'APPROVED' : 'REJECTED')
  const m = useMutation({
    mutationFn: () =>
      api.post(`/orders/${o.id}/receipts/${r.id}/quality`, {
        result: effective,
        checklist: items.map((item) => ({ item, ok: state(item).ok, note: state(item).note.trim() || undefined })),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      notify.success(`Control de calidad ${effective === 'APPROVED' ? 'aprobado' : 'rechazado'} registrado`)
      invalidate()
      onDone()
    },
  })
  return (
    <div className="mb-3 space-y-3 rounded-md border border-brand-200 bg-brand-50/40 p-3" data-testid="quality-form">
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
            <Checkbox
              label={item}
              checked={state(item).ok}
              onCheckedChange={(v) => setChecks((c) => ({ ...c, [item]: { ...state(item), ok: v === true } }))}
            />
            <Input inputSize="sm" placeholder="Observación" value={state(item).note} onChange={(e) => setChecks((c) => ({ ...c, [item]: { ...state(item), note: e.target.value } }))} />
          </li>
        ))}
      </ul>
      <FormField label="Resultado">
        <RadioGroup
          orientation="horizontal"
          value={effective}
          onValueChange={(v) => setResult(v as 'APPROVED' | 'REJECTED')}
          options={[
            { value: 'APPROVED', label: 'Aprobado' },
            { value: 'REJECTED', label: 'Rechazado' },
          ]}
        />
      </FormField>
      <FormField label="Notas">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDone}>Cancelar</Button>
        <Button size="sm" variant={effective === 'APPROVED' ? 'primary' : 'danger'} data-testid="quality-submit" loading={m.isPending} onClick={() => m.mutate()}>
          Registrar control {effective === 'APPROVED' ? 'aprobado' : 'rechazado'}
        </Button>
      </div>
    </div>
  )
}

function PurityForm({ o, r, onDone }: { o: OrderDetail; r: ProductionReceipt; onDone: () => void }) {
  const invalidate = useInvalidateOrders()
  const { target, tol } = purityTarget(o)
  const [method, setMethod] = useState('XRF')
  const [value, setValue] = useState('')
  const [support, setSupport] = useState('')
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [media, setMedia] = useState<MediaFile | null>(null)
  const v = Number(value)
  const hasValue = value !== '' && v >= 0 && v <= 1000
  const conforming = target !== null && hasValue ? Math.abs(v - target) <= tol + 1e-9 : null
  const m = useMutation({
    mutationFn: () =>
      api.post(`/orders/${o.id}/receipts/${r.id}/purity`, {
        method,
        obtainedValue: v,
        supportReference: support.trim() || undefined,
        supportMediaId: media?.id,
        verifiedAt: date || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      notify.success('Verificación de ley registrada')
      invalidate()
      onDone()
    },
  })
  return (
    <div className="mb-3 space-y-3 rounded-md border border-brand-200 bg-brand-50/40 p-3" data-testid="purity-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Método" required>
          <NativeSelect data-testid="purity-method" value={method} onChange={(e) => setMethod(e.target.value)} options={Object.entries(PURITY_METHOD).map(([value, label]) => ({ value, label }))} />
        </FormField>
        <FormField label="Valor obtenido (‰)" required hint={target ? `Objetivo ${formatPurity(target)} ± ${formatNumber(tol, 2)} ‰` : 'Sin ley objetivo configurada'}>
          <Input data-testid="purity-value" type="number" min={0} max={1000} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ej. 999.2" />
        </FormField>
        <FormField label="Soporte / referencia">
          <Input data-testid="purity-support" value={support} onChange={(e) => setSupport(e.target.value)} placeholder="N.º de ensayo, certificado…" />
        </FormField>
        <FormField label="Fecha de verificación">
          <Input type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      </div>
      {conforming !== null && (
        <div className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium', conforming ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger')} data-testid="purity-conformity">
          {conforming ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          {conforming ? 'Conforme frente al estándar' : 'No conforme: fuera de la tolerancia — bloqueará la aprobación (CA-013)'}
          <span className="ml-auto text-[12px] font-normal tnum">Desviación {formatNumber(v - (target ?? 0), 2)} ‰</span>
        </div>
      )}
      {media ? (
        <p className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
          <Paperclip className="size-3.5" /> Adjunto: {media.originalName}
          <button className="ml-2 text-danger hover:underline" onClick={() => setMedia(null)}>Quitar</button>
        </p>
      ) : (
        <MediaUploader compact accept="image/*,application/pdf" label="Adjuntar soporte (foto o PDF)" fields={{ purpose: 'PURITY_SUPPORT', productionOrderId: o.id, relatedType: 'ProductionReceipt', relatedId: r.id }} onUploaded={setMedia} testId="purity-media" />
      )}
      <FormField label="Notas">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDone}>Cancelar</Button>
        <Button size="sm" data-testid="purity-submit" disabled={!hasValue} loading={m.isPending} onClick={() => m.mutate()}>
          Registrar verificación
        </Button>
      </div>
    </div>
  )
}
