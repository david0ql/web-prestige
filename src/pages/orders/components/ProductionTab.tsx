import { useState } from 'react'
import { Camera, Check, CheckCircle2, Circle, Film, PackageCheck, X } from 'lucide-react'
import type { LaborCost, MaterialRequest, OrderDetail } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { APPROVAL_STATUS, LABOR_BASIS } from '@/lib/labels'
import { formatDateTime, formatGrams, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { KV, MiniTable } from './bits'
import { LaborDecisionModal, RequestReviewModal } from './ReviewModals'

export function ProductionTab({ o }: { o: OrderDetail }) {
  const canReview = usePermission('requests.review')
  const canLabor = usePermission('labor.approve')
  const [req, setReq] = useState<{ r: MaterialRequest; decision: 'APPROVE' | 'REJECT' } | null>(null)
  const [labor, setLabor] = useState<{ l: LaborCost; decision: 'APPROVE' | 'REJECT' } | null>(null)
  const consumed = o.consumptions.filter((c) => !c.voided)
  const declaration = o.declarations.find((d) => d.current) ?? o.declarations[0]

  return (
    <div className="space-y-4">
      <Card title="Etapas de producción y evidencia obligatoria (RF-014, RN-013)" flush>
        <ol className="divide-y divide-border" data-testid="order-stages">
          {o.stages.map((s) => {
            const c = s.completed
            const photosOk = !s.requiresPhoto || (c?.photoCount ?? 0) >= Math.max(1, s.minPhotos)
            const videoOk = !s.requiresVideo || (c?.videoCount ?? 0) >= 1
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                {c ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-border-strong" />}
                <div className="min-w-48 flex-1">
                  <p className="text-[13px] font-medium text-ink">
                    {s.sequence}. {s.name} {s.mandatory && <span className="text-[11px] font-normal text-ink-muted">· obligatoria</span>}
                    {s.isFinal && <Badge variant="gold" className="ml-1.5">Final</Badge>}
                  </p>
                  <p className="text-[11.5px] text-ink-muted">{c ? `Completada ${formatDateTime(c.completedAt)}` : 'Pendiente'}</p>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  {s.requiresPhoto && (
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', c ? (photosOk ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger') : 'bg-sunken text-ink-muted')}>
                      <Camera className="size-3" /> {c?.photoCount ?? 0}/{Math.max(1, s.minPhotos)} foto(s)
                    </span>
                  )}
                  {s.requiresVideo && (
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', c ? (videoOk ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger') : 'bg-sunken text-ink-muted')}>
                      <Film className="size-3" /> {c?.videoCount ?? 0}/1 video
                    </span>
                  )}
                  {!s.requiresPhoto && !s.requiresVideo && <span className="text-ink-muted">Sin evidencia obligatoria</span>}
                </div>
              </li>
            )
          })}
          {o.stages.length === 0 && <li className="px-4 py-6 text-center text-[12px] text-ink-muted">La familia del producto no tiene etapas configuradas.</li>}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Consumos reportados (RF-012) · ${formatGrams(consumed.reduce((s, c) => s + c.grams, 0))}`} flush>
          <MiniTable head={[{ label: 'Fecha' }, { label: 'Material' }, { label: 'Gramos', align: 'right' }, { label: 'Notas' }]}>
            {o.consumptions.map((c) => (
              <tr key={c.id} className={cn(c.voided && 'opacity-50')}>
                <td className="text-[12px] whitespace-nowrap text-ink-muted">{formatDateTime(c.createdAt)}</td>
                <td className="font-medium">
                  {c.material.name}
                  {c.voided && <Badge variant="danger" className="ml-1.5">Anulado</Badge>}
                </td>
                <td className={cn('text-right font-semibold tnum', c.voided && 'line-through')}>{formatGrams(c.grams)}</td>
                <td className="text-[12px] text-ink-muted">{c.voided ? c.voidReason : c.notes ?? '—'}</td>
              </tr>
            ))}
            {o.consumptions.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[12px] text-ink-muted">El taller aún no ha reportado consumos.</td>
              </tr>
            )}
          </MiniTable>
        </Card>

        <Card title="Avances (RF-013)" flush>
          <MiniTable head={[{ label: 'Fecha' }, { label: 'Etapa' }, { label: 'Avance', align: 'right' }, { label: 'Notas' }]}>
            {o.progress.map((p) => (
              <tr key={p.id}>
                <td className="text-[12px] whitespace-nowrap text-ink-muted">{formatDateTime(p.createdAt)}</td>
                <td className="font-medium">
                  {p.stage?.name ?? '—'}
                  {p.completesStage && <Check className="ml-1 inline size-3.5 text-success" />}
                </td>
                <td className="text-right tnum">{[p.percent !== null ? formatPercent(p.percent, 0) : null, p.grams ? formatGrams(p.grams) : null, p.units ? `${p.units} u` : null].filter(Boolean).join(' · ') || '—'}</td>
                <td className="text-[12px] text-ink-muted">{p.notes ?? '—'}</td>
              </tr>
            ))}
            {o.progress.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[12px] text-ink-muted">Sin avances reportados.</td>
              </tr>
            )}
          </MiniTable>
        </Card>
      </div>

      <Card title="Solicitudes de material adicional (RF-015/016)" flush>
        <MiniTable head={[{ label: 'Solicitud' }, { label: 'Material' }, { label: 'Gramos', align: 'right' }, { label: 'Contra estándar' }, { label: 'Motivo' }, { label: 'Estado' }, { label: '', align: 'right' }]}>
          {o.requests.map((r) => (
            <tr key={r.id}>
              <td>
                <p className="font-semibold">{r.number}</p>
                <p className="text-[11px] text-ink-muted">{formatDateTime(r.createdAt)}</p>
              </td>
              <td className="font-medium">{r.material.name}</td>
              <td className="text-right font-semibold tnum">{formatGrams(r.grams)}</td>
              <td className="text-[12px]">
                {r.exceedsStandard ? (
                  <Badge variant="danger">Fuera de estándar {r.deviationPct !== null ? `+${formatPercent(r.deviationPct, 1)}` : ''}</Badge>
                ) : (
                  <Badge variant="success">Dentro del estándar</Badge>
                )}
                {r.expectedGrams !== null && <p className="mt-0.5 text-[11px] text-ink-muted">Esperado {formatGrams(r.expectedGrams)} · entregado {formatGrams(r.alreadyDeliveredGrams)}</p>}
              </td>
              <td className="max-w-xs text-[12px] text-ink-secondary">{r.reason}</td>
              <td>
                <StatusBadge map={APPROVAL_STATUS} value={r.status} />
                {r.reviewNotes && <p className="mt-0.5 text-[11px] text-ink-muted">{r.reviewNotes}</p>}
              </td>
              <td className="text-right whitespace-nowrap">
                {canReview && r.status === 'PENDING' && (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" data-testid={`request-approve-${r.number}`} onClick={() => setReq({ r, decision: 'APPROVE' })}>
                      <Check className="size-3.5 text-success" /> Aprobar
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Rechazar" onClick={() => setReq({ r, decision: 'REJECT' })}>
                      <X className="size-3.5 text-danger" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {o.requests.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-[12px] text-ink-muted">Sin solicitudes de material.</td>
            </tr>
          )}
        </MiniTable>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Declaración de producto terminado (RF-017, P10)" actions={<PackageCheck className="size-4 text-brand-600" />}>
          {!declaration ? (
            <p className="text-[12px] text-ink-muted">El taller aún no ha declarado el producto terminado.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KV label="Peso declarado"><span className="font-semibold tnum">{formatGrams(declaration.grams)}</span></KV>
                <KV label="Unidades">{declaration.units ?? '—'}</KV>
                <KV label="Diámetro">{declaration.diameterMm ? `${formatNumber(declaration.diameterMm, 2)} mm` : '—'}</KV>
                <KV label="Largo">{declaration.lengthMm ? `${formatNumber(declaration.lengthMm, 1)} mm` : '—'}</KV>
              </div>
              {declaration.measures && <KV label="Medidas">{declaration.measures}</KV>}
              {Object.keys(declaration.technicalValues ?? {}).length > 0 && (
                <div>
                  <p className="eyebrow mb-1">Variables técnicas del modelo</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-sunken/60 px-3 py-2 text-[12.5px] sm:grid-cols-3">
                    {Object.entries(declaration.technicalValues).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-ink-muted">{k.replace(/_/g, ' ').toLowerCase()}</dt>
                        <dd className="font-medium text-ink">{typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {declaration.declaredLeftovers?.length > 0 && (
                <div>
                  <p className="eyebrow mb-1">Sobrantes declarados</p>
                  <ul className="text-[12.5px] text-ink-secondary">
                    {declaration.declaredLeftovers.map((l, i) => (
                      <li key={i}>
                        {o.custody.find((c) => c.materialId === l.materialId)?.material.name ?? o.requirements.find((r) => r.materialId === l.materialId)?.material.name ?? 'Material'} · {formatGrams(l.grams)} ({l.type})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {declaration.notes && <p className="text-[12px] text-ink-secondary">{declaration.notes}</p>}
              <p className="text-[11px] text-ink-muted">
                Declarado {formatDateTime(declaration.createdAt)}
                {o.declarations.length > 1 ? ` · ${o.declarations.length - 1} declaración(es) anterior(es) reemplazada(s)` : ''}
              </p>
            </div>
          )}
        </Card>

        <Card title="Mano de obra propuesta (RF-018, RN-012)">
          {o.labor.length === 0 ? (
            <p className="text-[12px] text-ink-muted">Sin mano de obra propuesta.</p>
          ) : (
            <ul className="space-y-3">
              {o.labor.map((l) => (
                <li key={l.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[18px] font-semibold tracking-tight tnum">{formatMoney(l.approvedValue ?? l.proposedValue)}</p>
                    <StatusBadge map={APPROVAL_STATUS} value={l.status} />
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {LABOR_BASIS[l.basis] ?? l.basis}: {formatNumber(l.quantity, 2)} × {formatMoney(l.rate)} · propuesto {formatMoney(l.proposedValue)}
                  </p>
                  {l.notes && <p className="mt-1 text-[12px] text-ink-secondary">{l.notes}</p>}
                  {l.reviewNotes && <p className="mt-1 text-[12px] text-ink-muted">Revisión: {l.reviewNotes}</p>}
                  {canLabor && l.status === 'PROPOSED' && (
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setLabor({ l, decision: 'APPROVE' })}>
                        <Check className="size-3.5 text-success" /> Aprobar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setLabor({ l, decision: 'REJECT' })}>
                        <X className="size-3.5 text-danger" /> Rechazar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-ink-muted">Los costos de taller no impactan finanzas hasta su aprobación (RF-024).</p>
        </Card>
      </div>

      {req && <RequestReviewModal r={req.r} decision={req.decision} onClose={() => setReq(null)} />}
      {labor && <LaborDecisionModal l={labor.l} decision={labor.decision} onClose={() => setLabor(null)} />}
    </div>
  )
}
