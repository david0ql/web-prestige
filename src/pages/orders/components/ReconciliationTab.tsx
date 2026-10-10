import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertOctagon, CheckCircle2, Coins, Gavel, Scale, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import { ApiError, api } from '@/lib/api/client'
import type { OrderDetail, Reconciliation } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { LABOR_BASIS } from '@/lib/labels'
import { formatDateTime, formatGrams, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { QueryState } from '@/components/domain/QueryState'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'
import { DiscrepancyTable } from './DiscrepancyTable'
import { KV, Meter, MiniTable, Notice, useInvalidateOrders } from './bits'

/** P12 · Conciliación de orden (RF-021/022, RN-010/011, CA-006/008) y aprobación final (RF-023/024). */
export function ReconciliationTab({ o }: { o: OrderDetail }) {
  const canReconcile = usePermission('orders.reconcile')
  const canApprove = usePermission('orders.approve')
  const invalidate = useInvalidateOrders()
  const q = useQuery({ queryKey: ['orders', 'reconciliation', o.id], queryFn: () => api.get<Reconciliation>(`/orders/${o.id}/reconciliation`) })
  const rec = q.data
  const generate = useMutation({
    mutationFn: () => api.post<unknown>(`/orders/${o.id}/reconciliation/discrepancies`),
    onSuccess: () => {
      notify.success('Diferencias de conciliación registradas')
      invalidate()
    },
  })
  const snapshot = o.reconciliationSnapshot as null | { materialCost?: number; laborCost?: number; totalCost?: number; costPerGram?: number; approvedAt?: string; notes?: string | null }
  const closed = o.status === 'APPROVED_CLOSED'

  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
      {rec && (
        <div className="space-y-4">
          {closed && snapshot && (
            <div className="grid gap-px overflow-hidden rounded-md border border-success/30 bg-success/20 sm:grid-cols-2 lg:grid-cols-5" data-testid="order-cost-snapshot">
              <div className="flex items-center gap-3 bg-success-bg px-4 py-3 lg:col-span-1">
                <ShieldCheck className="size-6 text-success" />
                <div>
                  <p className="text-[13px] font-semibold text-success">Orden aprobada y cerrada</p>
                  <p className="text-[11.5px] text-success/80">{formatDateTime(snapshot.approvedAt ?? o.closedAt)}</p>
                </div>
              </div>
              <CostCell label="Costo de material" value={formatMoney(snapshot.materialCost)} />
              <CostCell label="Mano de obra aprobada" value={formatMoney(snapshot.laborCost)} />
              <CostCell label="Costo total" value={formatMoney(snapshot.totalCost)} strong />
              <CostCell label="Costo por gramo" value={formatMoney(snapshot.costPerGram)} strong />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold', rec.balanced ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning')} data-testid="reconciliation-status">
              {rec.balanced ? <CheckCircle2 className="size-4" /> : <AlertOctagon className="size-4" />}
              {rec.balanced ? 'Conciliación cuadrada' : 'Conciliación con diferencias por resolver'}
            </span>
            <span className="text-[12px] text-ink-muted">Entregado = consumido/custodia + retornado + ajustes + diferencia autorizada (RN-011)</span>
            {canReconcile && o.status === 'IN_REVIEW' && (
              <Button className="ml-auto" variant="secondary" data-testid="generate-discrepancies" loading={generate.isPending} onClick={() => generate.mutate()}>
                <Scale className="size-4" /> Registrar diferencias de conciliación
              </Button>
            )}
          </div>

          <Card title="Balance por material" flush>
            <MiniTable
              testId="reconciliation-lines"
              head={[
                { label: 'Material' },
                { label: 'Entregado', align: 'right' },
                { label: 'Retornado', align: 'right' },
                { label: 'Ajustes', align: 'right' },
                { label: 'Custodia', align: 'right' },
                { label: 'Consumido', align: 'right' },
                { label: 'Sin explicar', align: 'right' },
                { label: 'Dif. aprobada', align: 'right' },
                { label: 'Dif. pendiente', align: 'right' },
                { label: '', align: 'center' },
              ]}
            >
              {rec.lines.map((l) => (
                <tr key={l.materialId}>
                  <td>
                    <p className="font-medium text-ink">{l.materialName}</p>
                    <p className="text-[11px] text-ink-muted">{l.materialCode}</p>
                  </td>
                  <td className="text-right font-semibold tnum">{formatGrams(l.deliveredGrams)}</td>
                  <td className="text-right tnum">{formatGrams(l.returnedGrams)}</td>
                  <td className="text-right tnum">{formatGrams(l.postedAdjustmentsGrams)}</td>
                  <td className="text-right tnum">{formatGrams(l.custodyGrams)}</td>
                  <td className="text-right tnum">{formatGrams(l.consumedGrams)}</td>
                  <td className={cn('text-right tnum', Math.abs(l.unexplainedGrams) > 0.001 ? 'font-semibold text-danger' : 'text-ink-muted')}>{formatGrams(l.unexplainedGrams)}</td>
                  <td className="text-right tnum text-success">{formatGrams(l.approvedDifferenceGrams)}</td>
                  <td className={cn('text-right tnum', l.pendingDifferenceGrams ? 'font-semibold text-warning' : 'text-ink-muted')}>{formatGrams(l.pendingDifferenceGrams)}</td>
                  <td className="text-center">{l.balanced ? <CheckCircle2 className="mx-auto size-4 text-success" aria-label="Cuadrado" /> : <XCircle className="mx-auto size-4 text-danger" aria-label="Descuadrado" />}</td>
                </tr>
              ))}
              {rec.lines.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-[12px] text-ink-muted">No se ha entregado material a esta orden.</td>
                </tr>
              )}
            </MiniTable>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card title="Transformación: consumido vs. terminado" actions={<Sparkles className="size-4 text-brand-600" />}>
              {(() => {
                const t = rec.transformation
                const pctOfTol = t.tolerancePct > 0 ? (t.processLossPct / t.tolerancePct) * 100 : 0
                return (
                  <div className="space-y-4" data-testid="reconciliation-transformation">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <KV label="Consumido total"><span className="text-[16px] font-semibold tnum">{formatGrams(t.totalConsumedGrams)}</span></KV>
                      <KV label="Terminado recibido"><span className="text-[16px] font-semibold tnum">{formatGrams(t.finishedGrams)}</span>{t.finishedUnits ? <span className="text-ink-muted"> · {t.finishedUnits} u</span> : null}</KV>
                      <KV label="Merma de proceso"><span className={cn('text-[16px] font-semibold tnum', t.withinTolerance ? 'text-ink' : 'text-danger')}>{formatGrams(t.processLossGrams)}</span></KV>
                      <KV label="Merma %"><span className={cn('text-[16px] font-semibold tnum', t.withinTolerance ? 'text-success' : 'text-danger')}>{formatPercent(t.processLossPct, 2)}</span></KV>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11.5px] text-ink-muted">
                        <span>Merma frente a tolerancia ({formatPercent(t.tolerancePct, 2)})</span>
                        <span className={cn('font-medium', t.withinTolerance ? 'text-success' : 'text-danger')}>{t.withinTolerance ? 'Dentro de tolerancia' : 'Fuera de tolerancia'}</span>
                      </div>
                      <Meter value={Math.min(pctOfTol, 100)} max={100} tone={t.withinTolerance ? 'success' : 'danger'} className="h-2" />
                    </div>
                    <p className="text-[12px] text-ink-muted">{t.registered ? 'La merma de proceso ya está registrada como diferencia.' : t.totalConsumedGrams > 0 && t.finishedGrams > 0 ? 'La merma aún no se ha registrado: usa "Registrar diferencias de conciliación".' : 'Se calcula al recibir el producto terminado.'}</p>
                  </div>
                )
              })()}
            </Card>

            <Card title="Bloqueos para el cierre">
              {rec.blockers.length === 0 ? (
                <Notice tone="success" icon={<CheckCircle2 />} title="Sin bloqueos de conciliación">
                  Calidad, ley y mano de obra se validan además al aprobar.
                </Notice>
              ) : (
                <ul className="space-y-1.5" data-testid="reconciliation-blockers">
                  {rec.blockers.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[13px] text-danger">
                      <AlertOctagon className="mt-0.5 size-4 shrink-0" /> {b}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Mermas y diferencias (RF-022, CA-008)" flush>
            <DiscrepancyTable rows={rec.discrepancies} emptyTitle="Sin diferencias registradas para esta orden" testId="order-discrepancies" />
          </Card>

          {canApprove && o.status === 'IN_REVIEW' && <ApprovalPanel o={o} rec={rec} />}
        </div>
      )}
    </QueryState>
  )
}

function CostCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-0.5 tracking-tight tnum', strong ? 'text-[18px] font-bold text-ink' : 'text-[15px] font-semibold text-ink-secondary')}>{value}</p>
    </div>
  )
}

function ApprovalPanel({ o, rec }: { o: OrderDetail; rec: Reconciliation }) {
  const invalidate = useInvalidateOrders()
  const proposed = o.labor.find((l) => l.status === 'PROPOSED')
  const [laborDecision, setLaborDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [laborValue, setLaborValue] = useState(proposed ? String(proposed.proposedValue) : '')
  const [laborNotes, setLaborNotes] = useState('')
  const [updateSheet, setUpdateSheet] = useState(false)
  const [notes, setNotes] = useState('')
  const [blockers, setBlockers] = useState<string[] | null>(null)

  const approve = useMutation({
    mutationFn: () =>
      api.post(`/orders/${o.id}/approve`, {
        labor: proposed ? { decision: laborDecision, approvedValue: laborDecision === 'APPROVE' ? Number(laborValue) : undefined, notes: laborNotes.trim() || undefined } : undefined,
        updateTechnicalSheet: updateSheet,
        notes: notes.trim() || undefined,
      }),
    meta: { silent: true },
    onSuccess: () => {
      notify.success(`${o.number} aprobada y cerrada. Costos enviados a contabilidad.`)
      setBlockers(null)
      invalidate()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'APPROVAL_BLOCKED') {
        const b = (e.details as { blockers?: string[] } | null)?.blockers
        setBlockers(b?.length ? b : [e.message])
        return
      }
      notify.error(e.message)
    },
  })

  const pendingDisc = rec.discrepancies.filter((d) => d.status === 'PENDING').length
  const checklist = [
    { ok: rec.balanced && rec.blockers.length === 0, label: 'Conciliación cuadrada y sin bloqueos' },
    { ok: pendingDisc === 0, label: pendingDisc ? `${pendingDisc} diferencia(s) pendiente(s)` : 'Diferencias resueltas' },
    { ok: !o.product.requiresQualityCheck || o.quality.some((q) => q.result === 'APPROVED'), label: o.product.requiresQualityCheck ? 'Control de calidad aprobado' : 'Calidad no requerida' },
    { ok: !o.product.requiresPurityCheck || o.purity.some((p) => p.conforming), label: o.product.requiresPurityCheck ? 'Ley / pureza conforme' : 'Ley no requerida' },
  ]

  return (
    <section id="approval-panel" className="scroll-mt-4 rounded-md border-2 border-brand-300 bg-gradient-to-br from-brand-50 to-surface p-4 shadow-gold" data-testid="approval-panel">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md gold-gradient text-white">
          <Gavel className="size-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Aprobación final de Prestige Gold (RF-023/024)</h2>
          <p className="text-[12px] text-ink-muted">Solo Oficina Madre aprueba la producción y autoriza los costos del taller (RN-009/012).</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <ul className="space-y-1.5 rounded-md border border-border bg-surface p-3">
          {checklist.map((c) => (
            <li key={c.label} className={cn('flex items-center gap-2 text-[13px]', c.ok ? 'text-ink-secondary' : 'font-medium text-danger')}>
              {c.ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4" />} {c.label}
            </li>
          ))}
        </ul>

        <div className="space-y-3">
          {proposed ? (
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="eyebrow mb-2 flex items-center gap-1.5"><Coins className="size-3.5" /> Mano de obra propuesta por el taller</p>
              <p className="text-[13px] text-ink-secondary">
                {LABOR_BASIS[proposed.basis] ?? proposed.basis}: {formatNumber(proposed.quantity, 2)} × {formatMoney(proposed.rate)} = <b className="text-ink">{formatMoney(proposed.proposedValue)}</b>
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-[auto_1fr]">
                <RadioGroup
                  orientation="horizontal"
                  value={laborDecision}
                  onValueChange={(v) => setLaborDecision(v as 'APPROVE' | 'REJECT')}
                  options={[
                    { value: 'APPROVE', label: 'Aprobar' },
                    { value: 'REJECT', label: 'Rechazar' },
                  ]}
                />
                {laborDecision === 'APPROVE' && <Input data-testid="approve-labor-value" type="number" min={0} value={laborValue} onChange={(e) => setLaborValue(e.target.value)} aria-label="Valor aprobado" />}
              </div>
              <Input className="mt-2" placeholder="Notas sobre la mano de obra" value={laborNotes} onChange={(e) => setLaborNotes(e.target.value)} />
            </div>
          ) : (
            <p className="text-[12px] text-ink-muted">{o.labor.length ? 'La mano de obra ya fue revisada.' : 'El taller no propuso mano de obra.'}</p>
          )}
          <Switch label="Actualizar la ficha técnica del modelo con los datos de esta orden (nueva versión, RN-023)" checked={updateSheet} onCheckedChange={setUpdateSheet} />
          <FormField label="Notas de aprobación">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="approve-notes" />
          </FormField>
        </div>
      </div>

      {blockers && (
        <Notice tone="danger" icon={<AlertOctagon />} title="No se puede aprobar todavía" className="mt-3">
          <ul className="list-disc space-y-0.5 pl-4" data-testid="approval-blockers">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="mt-4 flex justify-end">
        <Button size="lg" data-testid="approve-submit" loading={approve.isPending} disabled={!!proposed && laborDecision === 'APPROVE' && laborValue === ''} onClick={() => approve.mutate()}>
          <ShieldCheck className="size-4" /> Aprobar y cerrar orden
        </Button>
      </div>
    </section>
  )
}
