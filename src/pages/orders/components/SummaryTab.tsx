import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, GitBranch, Lock } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Alert, OrderDetail } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { ALERT_SEVERITY, ALERT_STATUS, INSUFFICIENCY_ACTION } from '@/lib/labels'
import { formatDate, formatDateTime, formatGrams, formatNumber, formatPurity } from '@/lib/format'
import { cn } from '@/lib/cn'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Meter, MiniTable, Notice } from './bits'

export function SummaryTab({ o }: { o: OrderDetail }) {
  const canAlerts = usePermission('alerts.read')
  const alerts = useQuery({
    queryKey: ['orders', 'alerts', o.id],
    queryFn: () => api.get<Paginated<Alert>>('/alerts', { search: o.number, pageSize: 50 }),
    enabled: canAlerts,
  })
  const orderAlerts = (alerts.data?.items ?? []).filter((a) => a.entityId === o.id || a.title.includes(o.number))
  const suff = new Map(o.sufficiency.lines.map((l) => [l.materialId, l]))
  const totalCustody = o.custody.reduce((s, c) => s + c.balance, 0)

  return (
    <div className="space-y-4">
      <Card title="Requerimientos de insumos (RF-008/009)" flush>
        <MiniTable
          testId="order-requirements"
          head={[
            { label: 'Material' },
            { label: 'Requerido', align: 'right' },
            { label: 'Despachado', align: 'right' },
            { label: 'Pendiente', align: 'right' },
            { label: 'Disponible oficina', align: 'right' },
            { label: 'Faltante', align: 'right' },
            { label: 'Consumido', align: 'right' },
            { label: 'En custodia', align: 'right' },
          ]}
        >
          {o.requirements.map((r) => {
            const s = suff.get(r.materialId)
            const dispatched = r.dispatchedGrams ?? s?.dispatchedGrams ?? 0
            const shortfall = r.shortfallGrams ?? s?.shortfallGrams ?? 0
            return (
              <tr key={r.id}>
                <td>
                  <p className="font-medium text-ink">
                    {r.material.name} {r.manual && <Badge variant="gold" className="ml-1">Manual</Badge>}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Meter value={dispatched} max={r.requiredGrams} tone={dispatched >= r.requiredGrams ? 'success' : 'gold'} className="w-24" />
                    <span className="text-[11px] text-ink-muted">
                      {r.material.code}
                      {r.material.purity ? ` · ${formatPurity(r.material.purity)}` : ''} · tol. {formatNumber(r.tolerancePct, 2)} %
                    </span>
                  </div>
                </td>
                <td className="text-right font-semibold tnum">{formatGrams(r.requiredGrams)}</td>
                <td className="text-right tnum">{formatGrams(dispatched)}</td>
                <td className="text-right tnum">{formatGrams(r.pendingGrams ?? s?.pendingGrams)}</td>
                <td className="text-right text-ink-secondary tnum">{formatGrams(r.availableInOffice ?? s?.availableInOffice)}</td>
                <td className={cn('text-right tnum', shortfall > 0 ? 'font-semibold text-danger' : 'text-ink-muted')}>{shortfall > 0 ? formatGrams(shortfall) : '—'}</td>
                <td className="text-right tnum">{formatGrams(r.consumedGrams ?? 0)}</td>
                <td className="text-right tnum">{formatGrams(r.custodyGrams ?? 0)}</td>
              </tr>
            )
          })}
          {o.requirements.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-[12px] text-ink-muted">Sin insumos requeridos.</td>
            </tr>
          )}
        </MiniTable>
        {!o.sufficiency.sufficient && !['APPROVED_CLOSED', 'CANCELLED'].includes(o.status) && (
          <div className="border-t border-border p-3">
            <Notice tone="warning" icon={<AlertTriangle />} title="Insuficiencia de insumos (RN-008)">
              El material disponible no alcanza para el objetivo planificado. Al despachar podrás completar desde inventario, solicitar/fabricar el insumo o modificar la orden con autorización.
            </Notice>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Custodia actual del taller · ${formatGrams(totalCustody)}`} flush>
          <MiniTable head={[{ label: 'Material' }, { label: 'Entregado', align: 'right' }, { label: 'Salidas', align: 'right' }, { label: 'Saldo', align: 'right' }, { label: 'Desde' }]}>
            {o.custody.map((c) => (
              <tr key={c.materialId}>
                <td className="font-medium">{c.material.name}</td>
                <td className="text-right tnum">{formatGrams(c.inGrams)}</td>
                <td className="text-right tnum">{formatGrams(c.outGrams)}</td>
                <td className={cn('text-right font-semibold tnum', c.balance > 0 ? 'text-brand-700' : 'text-ink-muted')}>{formatGrams(c.balance)}</td>
                <td className="text-[12px] text-ink-muted">{formatDate(c.since)}</td>
              </tr>
            ))}
            {o.custody.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[12px] text-ink-muted">Sin material entregado a esta orden.</td>
              </tr>
            )}
          </MiniTable>
          <p className="border-t border-border px-4 py-2 text-[11.5px] text-ink-muted">
            <Lock className="mr-1 inline size-3" />
            El material en custodia sigue siendo de Prestige Gold (RN-004).
          </p>
        </Card>

        <Card title="Decisiones de insuficiencia (Escenario C)">
          {o.decisions.length === 0 ? (
            <p className="text-[12px] text-ink-muted">No se han tomado decisiones de insuficiencia para esta orden.</p>
          ) : (
            <ul className="space-y-2.5">
              {o.decisions.map((d) => (
                <li key={d.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="gold">{INSUFFICIENCY_ACTION[d.action]?.label ?? d.action}</Badge>
                    <span className="text-[11px] text-ink-muted">{formatDateTime(d.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink">{d.justification}</p>
                  {(d.requiredGrams !== null || d.shortfallGrams !== null) && (
                    <p className="mt-1 text-[12px] text-ink-secondary tnum">
                      Requerido {formatGrams(d.requiredGrams)} · asignado {formatGrams(d.assignedGrams)} · <span className="font-medium text-danger">faltante {formatGrams(d.shortfallGrams)}</span>
                    </p>
                  )}
                  {d.generatedOrderId && (
                    <Link to="/ordenes/$orderId" params={{ orderId: d.generatedOrderId }} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline">
                      <GitBranch className="size-3.5" /> Orden generada {String((d.details as Record<string, unknown> | null)?.generatedOrderNumber ?? '')}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {o.parentOrderId && (
            <Link to="/ordenes/$orderId" params={{ orderId: o.parentOrderId }} className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline">
              <GitBranch className="size-3.5" /> Esta orden abastece a una orden principal · ver orden padre
            </Link>
          )}
        </Card>
      </div>

      {canAlerts && (
        <Card title="Alertas de la orden">
          {orderAlerts.length === 0 ? (
            <p className="text-[12px] text-ink-muted">{alerts.isLoading ? 'Cargando…' : 'Sin alertas asociadas.'}</p>
          ) : (
            <ul className="divide-y divide-border">
              {orderAlerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
                  <StatusBadge map={ALERT_SEVERITY} value={a.severity} />
                  <span className={cn('flex-1 text-[13px]', a.status === 'RESOLVED' ? 'text-ink-muted line-through decoration-ink-muted/40' : 'text-ink')}>{a.title}</span>
                  <StatusBadge map={ALERT_STATUS} value={a.status} />
                  <span className="text-[11px] text-ink-muted">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
