import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Scale, SlidersHorizontal } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { Material, Weighing } from '@/lib/api/types'
import { formatDateTime, formatGrams } from '@/lib/format'
import { WEIGHING_PURPOSE } from '@/lib/labels'
import { QueryState } from '@/components/domain/QueryState'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { notify } from '@/components/ui/Toaster'

interface WeighingAdjustment { id: string; previousNetGrams: number; newNetGrams: number; reason: string; adjustedBy?: { fullName: string }; createdAt: string }
type WeighingDetail = Weighing & { material?: Material | null; notes?: string | null; adjustments: WeighingAdjustment[] }

/** Detalle de un pesaje con su historial de ajustes (auditoría RF-003). */
export function WeighingDetailDrawer({ weighingId, onClose, onAdjust }: { weighingId: string | null; onClose: () => void; onAdjust?: (w: Weighing) => void }) {
  const q = useQuery({ queryKey: ['weighings', 'detail', weighingId], queryFn: () => api.get<WeighingDetail>(`/weighings/${weighingId}`), enabled: !!weighingId })
  const w = q.data
  return (
    <Drawer
      open={!!weighingId}
      onOpenChange={(o) => !o && onClose()}
      title={w ? `Pesaje ${w.number}` : 'Pesaje'}
      description={w ? `${WEIGHING_PURPOSE[w.purpose] ?? w.purpose} · ${formatDateTime(w.capturedAt)}` : undefined}
      footer={
        w && onAdjust && !w.usedById ? (
          <Button variant="secondary" onClick={() => onAdjust(w)}>
            <SlidersHorizontal className="size-4" /> Ajustar peso
          </Button>
        ) : undefined
      }
    >
      <QueryState isLoading={q.isLoading} error={q.error}>
        {w && (
          <div className="space-y-5">
            <div className="rounded-md bg-sidebar px-4 py-3 text-right">
              <p className="text-[11px] tracking-wider text-sidebar-muted uppercase">Peso neto vigente</p>
              <p className="ledger text-[30px] font-semibold text-brand-300 tnum">{formatGrams(w.currentNetGrams, 2)}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <Fact label="Fuente">{w.source === 'MANUAL' ? <Badge variant="warning"><SlidersHorizontal className="size-3" /> Manual</Badge> : <Badge variant="gold"><Scale className="size-3" /> Balanza</Badge>}</Fact>
              <Fact label="Material">{w.material ? `${w.material.code} · ${w.material.name}` : '—'}</Fact>
              <Fact label="Bruto">{formatGrams(w.grossGrams)}</Fact>
              <Fact label="Tara">{formatGrams(w.tareGrams)}</Fact>
              <Fact label="Neto original">{formatGrams(w.netGrams)}</Fact>
              <Fact label="Estable">{w.stable ? 'Sí' : 'No'}</Fact>
              <Fact label="Capturado por">{w.capturedBy?.fullName ?? '—'}</Fact>
              <Fact label="Uso">{w.usedById ? `Utilizado (${w.usedByType})` : 'Disponible'}</Fact>
              {w.deviceInfo && <Fact label="Dispositivo">{w.deviceInfo}</Fact>}
              {w.rawReading && <Fact label="Trama cruda"><code className="rounded bg-sunken px-1 text-[12px]">{w.rawReading}</code></Fact>}
              {w.manualReason && <Fact label="Motivo de captura manual" wide>{w.manualReason}</Fact>}
            </dl>
            <section>
              <h3 className="eyebrow mb-2">Ajustes ({w.adjustments.length})</h3>
              {w.adjustments.length === 0 ? (
                <p className="text-[13px] text-ink-muted">Sin ajustes. El peso es el capturado originalmente.</p>
              ) : (
                <ol className="space-y-2">
                  {w.adjustments.map((a) => (
                    <li key={a.id} className="rounded-md border border-border px-3 py-2 text-[13px]">
                      <p className="font-medium text-ink tnum">
                        {formatGrams(a.previousNetGrams)} → {formatGrams(a.newNetGrams)}
                      </p>
                      <p className="text-ink-secondary">{a.reason}</p>
                      <p className="text-[12px] text-ink-muted">{a.adjustedBy?.fullName ?? '—'} · {formatDateTime(a.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </QueryState>
    </Drawer>
  )
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  )
}

/** Ajuste auditado del peso de un pesaje aún no utilizado (permiso scale.adjust). */
export function WeighingAdjustDialog({ weighing, onClose }: { weighing: Weighing | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [grams, setGrams] = useState('')
  const [reason, setReason] = useState('')
  const close = () => {
    setGrams('')
    setReason('')
    onClose()
  }
  const m = useMutation({
    mutationFn: () => api.post<Weighing>(`/weighings/${weighing!.id}/adjust`, { newNetGrams: Number(grams), reason: reason.trim() }),
    onSuccess: (w) => {
      notify.success(`Pesaje ${w.number} ajustado a ${formatGrams(w.currentNetGrams)}`)
      void qc.invalidateQueries({ queryKey: ['weighings'] })
      close()
    },
  })
  const valid = Number(grams) > 0 && reason.trim().length >= 5
  return (
    <Modal
      open={!!weighing}
      onOpenChange={(o) => !o && close()}
      title={`Ajustar pesaje ${weighing?.number ?? ''}`}
      description="El ajuste queda registrado en la bitácora con el peso anterior, el nuevo y el motivo."
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancelar</Button>
          <Button data-testid="weighing-adjust-confirm" disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>Guardar ajuste</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-ink-secondary">
          Peso neto vigente: <b className="text-ink tnum">{formatGrams(weighing?.currentNetGrams)}</b>
        </p>
        <FormField label="Nuevo peso neto (g)" required>
          <Input data-testid="weighing-adjust-grams" type="number" step="0.0001" min="0" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </FormField>
        <FormField label="Motivo" required hint="Mínimo 5 caracteres.">
          <Textarea data-testid="weighing-adjust-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
