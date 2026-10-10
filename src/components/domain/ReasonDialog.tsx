import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { FormField } from '@/components/ui/FormField'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
  label?: string
  confirmLabel?: string
  danger?: boolean
  minLength?: number
  loading?: boolean
  onConfirm: (reason: string) => void
}

/** Diálogo para acciones que exigen motivo (reversos, rechazos, cancelaciones). */
export function ReasonDialog({ open, onOpenChange, title, description, label = 'Motivo', confirmLabel = 'Confirmar', danger, minLength = 5, loading, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason('')
        onOpenChange(o)
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={reason.trim().length < minLength} loading={loading} onClick={() => onConfirm(reason.trim())} data-testid="reason-confirm">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <FormField label={label} required hint={`Mínimo ${minLength} caracteres. Queda registrado en la bitácora.`}>
        <Textarea data-testid="reason-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
    </Modal>
  )
}
