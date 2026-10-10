import type { ReactNode } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel = 'Confirmar', danger, loading, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; children?: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} footer={
      <>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm} data-testid="confirm-ok">{confirmLabel}</Button>
      </>
    }>
      <div className="text-[13px] text-ink-secondary">{children}</div>
    </Modal>
  )
}
