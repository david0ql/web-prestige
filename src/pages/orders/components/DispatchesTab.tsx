import { Link } from '@tanstack/react-router'
import { FileSignature, ShieldAlert, Truck } from 'lucide-react'
import type { OrderDetail } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { DISPATCH_STATUS } from '@/lib/labels'
import { formatDateTime, formatGrams } from '@/lib/format'
import { cn } from '@/lib/cn'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { DISPATCHABLE } from './orderUtils'
import { MiniTable } from './bits'

export function DispatchesTab({ o }: { o: OrderDetail }) {
  const canDispatch = usePermission('orders.dispatch')
  const total = o.dispatches.filter((d) => d.status !== 'REJECTED').reduce((s, d) => s + d.lines.reduce((a, l) => a + l.grams, 0), 0)
  const action = canDispatch && DISPATCHABLE.includes(o.status) && (
    <Link to="/asignaciones" search={{ orderId: o.id }}>
      <Button size="sm">
        <Truck className="size-3.5" /> Nuevo despacho
      </Button>
    </Link>
  )
  if (!o.dispatches.length) {
    return <EmptyState icon={Truck} title="Sin despachos" description="Aún no se ha entregado material al taller para esta orden." action={action || undefined} />
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-secondary">
          {o.dispatches.length} despacho(s) · <b className="text-ink tnum">{formatGrams(total)}</b> entregados (sin rechazados)
        </p>
        {action}
      </div>
      {o.dispatches.map((d) => {
        const grams = d.lines.reduce((s, l) => s + l.grams, 0)
        return (
          <Card key={d.id} flush>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3">
              <p className="font-semibold text-ink">{d.number}</p>
              <StatusBadge map={DISPATCH_STATUS} value={d.status} />
              <span className="text-[12px] text-ink-muted">{d.purpose}</span>
              <span className="ml-auto text-[12px] text-ink-muted">
                {formatDateTime(d.createdAt)} · {d.responsible?.fullName ?? '—'}
              </span>
            </div>
            <MiniTable head={[{ label: 'Material' }, { label: 'Lote' }, { label: 'Pesaje' }, { label: 'Entregado', align: 'right' }, { label: 'Recibido por taller', align: 'right' }]}>
              {d.lines.map((l) => {
                const diff = l.receivedGrams !== null ? l.receivedGrams - l.grams : 0
                return (
                  <tr key={l.id}>
                    <td className="font-medium">
                      {l.material.name}
                      {l.overrideApplied && (
                        <Badge variant="danger" className="ml-1.5">
                          <ShieldAlert className="size-3" /> Autorización excepcional
                        </Badge>
                      )}
                    </td>
                    <td className="text-[12px] text-ink-muted">{l.lot?.code ?? '—'}</td>
                    <td className="ledger text-ink-secondary">{l.weighing?.number ?? '—'}</td>
                    <td className="text-right font-semibold tnum">{formatGrams(l.grams)}</td>
                    <td className={cn('text-right tnum', Math.abs(diff) > 0.001 ? 'font-semibold text-danger' : 'text-ink-secondary')}>
                      {l.receivedGrams !== null ? formatGrams(l.receivedGrams) : '—'}
                      {Math.abs(diff) > 0.001 && <span className="block text-[11px]">Dif. {formatGrams(diff)}</span>}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-sunken/40">
                <td colSpan={3} className="font-semibold">Total</td>
                <td className="text-right font-semibold tnum">{formatGrams(grams)}</td>
                <td />
              </tr>
            </MiniTable>
            <div className="flex flex-wrap items-start gap-4 border-t border-border px-4 py-3 text-[12px]">
              {d.acceptance ? (
                <>
                  <div className="flex items-start gap-2">
                    <FileSignature className="mt-0.5 size-4 text-success" />
                    <div>
                      <p className="font-medium text-ink">
                        Firmado por {d.acceptance.signerName} · {formatDateTime(d.acceptance.signedAt)}
                      </p>
                      <p className="text-ink-muted">
                        Decisión: {d.acceptance.decision === 'ACCEPT' ? 'Aceptación' : d.acceptance.decision} {d.acceptance.ip ? `· IP ${d.acceptance.ip}` : ''}
                      </p>
                      <p className="ledger mt-0.5 break-all text-[11px] text-ink-muted">SHA-256 {d.acceptance.payloadHash}</p>
                      {d.acceptance.observations && <p className="mt-1 text-ink-secondary">Observaciones: {d.acceptance.observations}</p>}
                    </div>
                  </div>
                  {d.acceptance.signatureImage && <img src={d.acceptance.signatureImage} alt="Firma" className="ml-auto h-14 rounded border border-border bg-white px-2" />}
                </>
              ) : (
                <p className="text-warning">Pendiente de confirmación digital del taller (RF-011).</p>
              )}
              {d.workshopObservations && !d.acceptance?.observations && <p className="text-ink-secondary">Observaciones del taller: {d.workshopObservations}</p>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
