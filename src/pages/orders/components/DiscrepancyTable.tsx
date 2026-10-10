import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { Check, MessageSquareText, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { Discrepancy } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { APPROVAL_STATUS, DISCREPANCY_TYPE } from '@/lib/labels'
import { formatDateTime, formatGrams, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'
import { useInvalidateOrders } from './bits'

interface Props {
  rows: Discrepancy[] | undefined
  loading?: boolean
  /** Mostrar columna de orden (bandejas globales). */
  orderLabel?: (orderId: string | null) => string | null
  workshopLabel?: (workshopId: string | null) => string | null
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void }
  emptyTitle?: string
  testId?: string
}

/** RF-022 · Tabla de mermas/diferencias con justificar y aprobar/rechazar. */
export function DiscrepancyTable({ rows, loading, orderLabel, workshopLabel, pagination, emptyTitle = 'Sin diferencias registradas', testId = 'discrepancies-table' }: Props) {
  const canJustify = usePermission('orders.reconcile', 'discrepancies.approve')
  const canApprove = usePermission('discrepancies.approve')
  const [justify, setJustify] = useState<Discrepancy | null>(null)
  const [review, setReview] = useState<{ d: Discrepancy; decision: 'APPROVED' | 'REJECTED' } | null>(null)

  const columns: Column<Discrepancy>[] = [
    {
      key: 'number',
      header: 'Diferencia',
      cell: (d) => (
        <div>
          <p className="font-semibold whitespace-nowrap text-ink">{d.number}</p>
          <p className="text-[11px] text-ink-muted">{formatDateTime(d.createdAt)}</p>
        </div>
      ),
    },
    ...(orderLabel
      ? [
          {
            key: 'order',
            header: 'Orden / taller',
            cell: (d: Discrepancy) => (
              <div>
                {d.orderId ? (
                  <Link to="/ordenes/$orderId" params={{ orderId: d.orderId }} hash="conciliacion" className="font-medium text-brand-700 hover:underline">
                    {orderLabel(d.orderId) ?? 'Ver orden'}
                  </Link>
                ) : (
                  '—'
                )}
                {workshopLabel && <p className="text-[11px] text-ink-muted">{workshopLabel(d.workshopId) ?? ''}</p>}
              </div>
            ),
          } satisfies Column<Discrepancy>,
        ]
      : []),
    {
      key: 'type',
      header: 'Tipo',
      cell: (d) => (
        <div className="space-y-0.5">
          <StatusBadge map={DISCREPANCY_TYPE} value={d.type} />
          <p className="text-[11px] text-ink-muted">{d.material?.name ?? 'Transformación'}</p>
        </div>
      ),
    },
    {
      key: 'grams',
      header: 'Cantidad',
      align: 'right',
      cell: (d) => (
        <div>
          <p className={cn('font-semibold', d.grams > 0 ? 'text-danger' : d.grams < 0 ? 'text-info' : 'text-ink')}>{formatGrams(d.grams)}</p>
          {d.percent !== null && (
            <p className={cn('text-[11px]', d.withinTolerance ? 'text-success' : 'text-danger')}>
              {formatPercent(d.percent, 2)} {d.tolerancePct !== null ? `/ tol. ${formatPercent(d.tolerancePct, 2)}` : ''}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo y justificación',
      cell: (d) => (
        <div className="max-w-md space-y-0.5 text-[12px]">
          <p className="text-ink-secondary">{d.reason ?? '—'}</p>
          {d.justification ? (
            <p className="text-ink">
              <span className="font-medium">Justificación:</span> {d.justification}
              {d.responsibleParty ? <span className="text-ink-muted"> · Resp.: {d.responsibleParty}</span> : null}
            </p>
          ) : d.status === 'PENDING' ? (
            <p className="font-medium text-warning">Sin justificar</p>
          ) : null}
          {d.reviewNotes && <p className="text-ink-muted">Revisión: {d.reviewNotes}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (d) => (
        <div className="space-y-0.5">
          <StatusBadge map={APPROVAL_STATUS} value={d.status} />
          {d.autoApproved && <Badge variant="neutral">Automática</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (d) =>
        d.status === 'PENDING' ? (
          <div className="flex justify-end gap-1.5">
            {canJustify && (
              <Button size="sm" variant="secondary" data-testid={`disc-justify-${d.number}`} onClick={() => setJustify(d)}>
                <MessageSquareText className="size-3.5" /> Justificar
              </Button>
            )}
            {canApprove && (
              <>
                <Button size="sm" variant="secondary" aria-label="Aprobar" data-testid={`disc-approve-${d.number}`} onClick={() => setReview({ d, decision: 'APPROVED' })}>
                  <Check className="size-3.5 text-success" /> Aprobar
                </Button>
                <Button size="sm" variant="ghost" aria-label="Rechazar" data-testid={`disc-reject-${d.number}`} onClick={() => setReview({ d, decision: 'REJECTED' })}>
                  <X className="size-3.5 text-danger" />
                </Button>
              </>
            )}
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <DataTable testId={testId} columns={columns} rows={rows} rowKey={(d) => d.id} loading={loading} empty={{ title: emptyTitle }} pagination={pagination} />
      {justify && <JustifyModal d={justify} onClose={() => setJustify(null)} />}
      {review && <ReviewModal d={review.d} decision={review.decision} onClose={() => setReview(null)} />}
    </>
  )
}

function JustifyModal({ d, onClose }: { d: Discrepancy; onClose: () => void }) {
  const invalidate = useInvalidateOrders()
  const [justification, setJustification] = useState(d.justification ?? '')
  const [responsibleParty, setResponsibleParty] = useState(d.responsibleParty ?? '')
  const m = useMutation({
    mutationFn: () => api.post(`/discrepancies/${d.id}/justify`, { justification: justification.trim(), responsibleParty: responsibleParty.trim() || undefined }),
    onSuccess: () => {
      notify.success(`Diferencia ${d.number} justificada`)
      invalidate()
      onClose()
    },
  })
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Justificar ${d.number}`}
      description={`${DISCREPANCY_TYPE[d.type]?.label ?? d.type} · ${formatGrams(d.grams)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button data-testid="disc-justify-submit" disabled={justification.trim().length < 5} loading={m.isPending} onClick={() => m.mutate()}>
            Guardar justificación
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-md bg-sunken px-3 py-2 text-[12px] text-ink-secondary">{d.reason}</p>
        <FormField label="Justificación" required hint="Mínimo 5 caracteres. Explica la causa de la diferencia (RN-010).">
          <Textarea data-testid="disc-justification" rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </FormField>
        <FormField label="Responsable">
          <Input value={responsibleParty} onChange={(e) => setResponsibleParty(e.target.value)} placeholder="Taller, persona o área" />
        </FormField>
      </div>
    </Modal>
  )
}

function ReviewModal({ d, decision, onClose }: { d: Discrepancy; decision: 'APPROVED' | 'REJECTED'; onClose: () => void }) {
  const invalidate = useInvalidateOrders()
  const [notes, setNotes] = useState('')
  const approve = decision === 'APPROVED'
  const m = useMutation({
    mutationFn: () => api.post(`/discrepancies/${d.id}/review`, { decision, notes: notes.trim() || undefined }),
    onSuccess: () => {
      notify.success(`Diferencia ${d.number} ${approve ? 'aprobada' : 'rechazada'}`)
      invalidate()
      onClose()
    },
  })
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${approve ? 'Aprobar' : 'Rechazar'} ${d.number}`}
      description={`${DISCREPANCY_TYPE[d.type]?.label ?? d.type} · ${formatGrams(d.grams)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant={approve ? 'primary' : 'danger'} data-testid="disc-review-submit" disabled={!approve && notes.trim().length < 3} loading={m.isPending} onClick={() => m.mutate()}>
            {approve ? 'Aprobar diferencia' : 'Rechazar diferencia'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[13px]">
        <p className="text-ink-secondary">{d.reason}</p>
        {d.justification ? <p><span className="font-medium">Justificación:</span> {d.justification}</p> : <p className="font-medium text-warning">La diferencia aún no tiene justificación.</p>}
        {approve && <p className="text-[12px] text-ink-muted">Al aprobar, la diferencia se contabiliza como ajuste/merma auditable en el inventario.</p>}
        <FormField label="Notas de revisión" required={!approve}>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
