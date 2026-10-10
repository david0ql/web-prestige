import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { LaborCost, MaterialRequest } from '@/lib/api/types'
import { LABOR_BASIS } from '@/lib/labels'
import { formatGrams, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'
import { useInvalidateOrders } from './bits'

/** RF-015/016 · Revisión de solicitud de material adicional. */
export function RequestReviewModal({ r, decision, onClose }: { r: MaterialRequest; decision: 'APPROVE' | 'REJECT'; onClose: () => void }) {
  const invalidate = useInvalidateOrders()
  const [notes, setNotes] = useState('')
  const approve = decision === 'APPROVE'
  const m = useMutation({
    mutationFn: () => api.post(`/material-requests/${r.id}/review`, { decision, notes: notes.trim() || undefined }),
    onSuccess: () => {
      notify.success(`Solicitud ${r.number} ${approve ? 'aprobada' : 'rechazada'}`)
      invalidate()
      onClose()
    },
  })
  const notesInvalid = !approve && notes.trim().length < 3
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${approve ? 'Aprobar' : 'Rechazar'} solicitud ${r.number}`}
      description={`${r.material.name} · ${formatGrams(r.grams)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant={approve ? 'primary' : 'danger'} data-testid="request-review-submit" disabled={notesInvalid} loading={m.isPending} onClick={() => m.mutate()}>
            {approve ? 'Aprobar solicitud' : 'Rechazar solicitud'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[13px]">
        <p className="rounded-md bg-sunken px-3 py-2 text-ink-secondary">Motivo del taller: {r.reason}</p>
        {r.expectedGrams !== null && (
          <p className={r.exceedsStandard ? 'text-danger' : 'text-ink-secondary'}>
            Consumo esperado {formatGrams(r.expectedGrams)} · ya entregado {formatGrams(r.alreadyDeliveredGrams)} · desviación {formatPercent(r.deviationPct, 1)}
            {r.exceedsStandard ? ' — fuera de estándar (RF-016)' : ''}
          </p>
        )}
        {approve && <p className="text-[12px] text-ink-muted">Al aprobar, el material queda listo para despacharse desde Asignaciones.</p>}
        <FormField label="Notas" required={!approve} hint={r.exceedsStandard ? "Recomendado: deja constancia de por qué se autoriza un consumo fuera de estándar." : "Mínimo 3 caracteres al rechazar."}>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="request-review-notes" />
        </FormField>
      </div>
    </Modal>
  )
}

/** RN-012 · Decisión sobre mano de obra propuesta por el taller. */
export function LaborDecisionModal({ l, decision, onClose, title }: { l: LaborCost; decision: 'APPROVE' | 'REJECT'; onClose: () => void; title?: string }) {
  const invalidate = useInvalidateOrders()
  const [value, setValue] = useState(String(l.proposedValue))
  const [notes, setNotes] = useState('')
  const approve = decision === 'APPROVE'
  const m = useMutation({
    mutationFn: () => api.post(`/labor/${l.id}/decision`, { decision, approvedValue: approve ? Number(value) : undefined, notes: notes.trim() || undefined }),
    onSuccess: () => {
      notify.success(approve ? 'Mano de obra aprobada' : 'Mano de obra rechazada')
      invalidate()
      onClose()
    },
  })
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={title ?? `${approve ? 'Aprobar' : 'Rechazar'} mano de obra`}
      description={`${LABOR_BASIS[l.basis] ?? l.basis}: ${formatNumber(l.quantity, 2)} × ${formatMoney(l.rate)} = ${formatMoney(l.proposedValue)} propuesto`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant={approve ? 'primary' : 'danger'} data-testid="labor-decision-submit" disabled={approve && !(Number(value) >= 0 && value !== '')} loading={m.isPending} onClick={() => m.mutate()}>
            {approve ? 'Aprobar' : 'Rechazar'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {approve && (
          <FormField label="Valor aprobado" hint="Por defecto el valor propuesto. Solo impacta finanzas al aprobar (RF-024).">
            <Input type="number" min={0} step="1" value={value} onChange={(e) => setValue(e.target.value)} data-testid="labor-approved-value" />
          </FormField>
        )}
        <FormField label="Notas">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
