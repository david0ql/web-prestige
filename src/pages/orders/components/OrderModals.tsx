import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { OrderDetail } from '@/lib/api/types'
import { formatGrams, todayIso } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'
import { PRIORITY_OPTIONS } from './orderUtils'
import { useInvalidateOrders } from './bits'

/** Escenario C · Modificar el objetivo con autorización (orders.authorize_changes). */
export function ModifyTargetModal({ o, onClose }: { o: OrderDetail; onClose: () => void }) {
  const invalidate = useInvalidateOrders()
  const [grams, setGrams] = useState(String(o.targetGrams))
  const [units, setUnits] = useState(o.targetUnits ? String(o.targetUnits) : '')
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: () => api.post(`/orders/${o.id}/modify-target`, { targetGrams: Number(grams), targetUnits: units ? Number(units) : null, reason: reason.trim() }),
    onSuccess: () => {
      notify.success('Objetivo modificado y requerimientos recalculados')
      invalidate()
      onClose()
    },
  })
  const valid = Number(grams) >= 1 && reason.trim().length >= 5
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Modificar objetivo de ${o.number}`}
      description={`Objetivo actual: ${formatGrams(o.targetGrams)}${o.targetUnits ? ` · ${o.targetUnits} u` : ''}. Los insumos requeridos se recalculan según estándar.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button data-testid="modify-target-submit" disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>Autorizar cambio</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nuevo objetivo (g)" required>
          <Input data-testid="modify-target-grams" type="number" min={1} step="0.01" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </FormField>
        <FormField label="Unidades">
          <Input type="number" min={1} value={units} onChange={(e) => setUnits(e.target.value)} />
        </FormField>
        <FormField label="Motivo de la autorización" required className="sm:col-span-2" hint="Queda en el historial de la orden y en la bitácora.">
          <Textarea data-testid="modify-target-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}

/** Edición de la orden mientras está en planeación (Borrador / Pendiente / Lista). */
export function EditOrderModal({ o, onClose }: { o: OrderDetail; onClose: () => void }) {
  const invalidate = useInvalidateOrders()
  const [grams, setGrams] = useState(String(o.targetGrams))
  const [units, setUnits] = useState(o.targetUnits ? String(o.targetUnits) : '')
  const [commitmentDate, setCommitmentDate] = useState(o.commitmentDate.slice(0, 10))
  const [priority, setPriority] = useState(o.priority)
  const [notes, setNotes] = useState(o.notes ?? '')
  const m = useMutation({
    mutationFn: () => api.patch(`/orders/${o.id}`, { targetGrams: Number(grams), targetUnits: units ? Number(units) : null, commitmentDate, priority, notes: notes.trim() || null }),
    onSuccess: () => {
      notify.success('Orden actualizada')
      invalidate()
      onClose()
    },
  })
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Editar ${o.number}`}
      description="Los insumos requeridos se recalculan con los estándares vigentes."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button data-testid="order-edit-submit" disabled={Number(grams) < 1 || !commitmentDate} loading={m.isPending} onClick={() => m.mutate()}>Guardar cambios</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Gramos objetivo" required>
          <Input type="number" min={1} step="0.01" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </FormField>
        <FormField label="Unidades objetivo">
          <Input type="number" min={1} value={units} onChange={(e) => setUnits(e.target.value)} />
        </FormField>
        <FormField label="Fecha compromiso" required>
          <Input type="date" min={todayIso()} value={commitmentDate} onChange={(e) => setCommitmentDate(e.target.value)} />
        </FormField>
        <FormField label="Prioridad">
          <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTIONS} />
        </FormField>
        <FormField label="Observaciones" className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
