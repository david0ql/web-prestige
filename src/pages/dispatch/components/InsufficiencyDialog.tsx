import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { InsufficiencyLine, Workshop } from '@/lib/api/types'
import { formatGrams } from '@/lib/format'
import { INSUFFICIENCY_ACTION } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { FormField } from '@/components/ui/FormField'

export type DecisionAction = 'DISPATCH_PARTIAL' | 'REQUEST_FABRICATION' | 'MODIFY_ORDER'
export interface InsufficiencyDecision { action: DecisionAction; justification: string; fabricationWorkshopId?: string }
export interface InsufficiencyDetails { insufficient: InsufficiencyLine[]; actions: string[] }

interface Props {
  data: InsufficiencyDetails | null
  orderNumber?: string
  canModifyOrder: boolean
  workshops: Workshop[]
  loading?: boolean
  onClose: () => void
  /** "Completar desde inventario": vuelve al formulario para agregar/repesar líneas. */
  onCompleteFromInventory: (lines: InsufficiencyLine[]) => void
  onConfirm: (decision: InsufficiencyDecision) => void
}

/** Escenario C · el material asignado no alcanza para el objetivo de la orden (RF-009, RN-008, CA-003). */
export function InsufficiencyDialog({ data, orderNumber, canModifyOrder, workshops, loading, onClose, onCompleteFromInventory, onConfirm }: Props) {
  const [action, setAction] = useState<string>('')
  const [justification, setJustification] = useState('')
  const [fabricationWorkshopId, setFabricationWorkshopId] = useState('')
  useEffect(() => {
    if (data) {
      setAction('')
      setJustification('')
      setFabricationWorkshopId('')
    }
  }, [data])

  const lines = data?.insufficient ?? []
  const canComplete = lines.some((l) => l.canCompleteFromInventory)
  const canFabricate = lines.length > 0 && lines.every((l) => l.fabricationProduct)
  const available = (data?.actions ?? Object.keys(INSUFFICIENCY_ACTION)).filter((a) => a !== 'MODIFY_ORDER' || canModifyOrder)
  const disabledReason: Record<string, string | undefined> = {
    COMPLETE_FROM_INVENTORY: canComplete ? undefined : 'No hay existencia suficiente en Oficina Madre.',
    REQUEST_FABRICATION: canFabricate ? undefined : 'Algún insumo faltante no tiene un producto de fabricación configurado.',
  }
  const needsJustification = action !== '' && action !== 'COMPLETE_FROM_INVENTORY'
  const valid = action === 'COMPLETE_FROM_INVENTORY' || (needsJustification && justification.trim().length >= 5)

  const confirm = () => {
    if (action === 'COMPLETE_FROM_INVENTORY') onCompleteFromInventory(lines.filter((l) => l.canCompleteFromInventory))
    else onConfirm({ action: action as DecisionAction, justification: justification.trim(), fabricationWorkshopId: action === 'REQUEST_FABRICATION' ? fabricationWorkshopId || undefined : undefined })
  }

  return (
    <Modal
      open={!!data}
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title="Material insuficiente para la orden"
      description={`Lo asignado${orderNumber ? ` a ${orderNumber}` : ''} no alcanza para el objetivo planificado según el estándar. Elige cómo continuar; la decisión queda registrada en la orden.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button data-testid="insufficiency-confirm" disabled={!valid} loading={loading} onClick={confirm}>
            {action === 'COMPLETE_FROM_INVENTORY' ? 'Volver y completar' : 'Confirmar y despachar'}
          </Button>
        </>
      }
    >
      <div data-testid="insufficiency-dialog" className="space-y-4">
        <div className="overflow-x-auto rounded-md border border-warning/40">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-warning-bg">
                {['Insumo', 'Requerido', 'Despachado antes', 'Este despacho', 'Faltante', 'En oficina'].map((h, i) => (
                  <th key={h} className={cn('eyebrow px-3 py-2 whitespace-nowrap', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.materialId} className="border-t border-border/70">
                  <td className="px-3 py-2">
                    <p className="font-medium whitespace-nowrap text-ink">{l.materialName}</p>
                    {l.fabricationProduct && <p className="text-[11px] whitespace-nowrap text-ink-muted">Se fabrica con {l.fabricationProduct.code}</p>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tnum">{formatGrams(l.requiredGrams)}</td>
                  <td className="px-3 py-2 text-right text-ink-secondary tnum">{formatGrams(l.previouslyDispatched)}</td>
                  <td className="px-3 py-2 text-right text-ink-secondary tnum">{formatGrams(l.thisDispatch)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-danger tnum">{formatGrams(l.shortfallGrams)}</td>
                  <td className={cn('px-3 py-2 text-right tnum', l.canCompleteFromInventory ? 'text-success' : 'text-ink-muted')}>{formatGrams(l.availableInOffice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <fieldset>
          <legend className="eyebrow mb-2">¿Cómo deseas continuar?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((a) => {
              const meta = INSUFFICIENCY_ACTION[a]
              const reason = disabledReason[a]
              const selected = action === a
              return (
                <button
                  key={a}
                  type="button"
                  data-testid={`insufficiency-action-${a}`}
                  disabled={!!reason}
                  onClick={() => setAction(a)}
                  aria-pressed={selected}
                  className={cn(
                    'flex cursor-pointer flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors',
                    selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-border hover:border-brand-300 hover:bg-brand-50/40',
                    reason && 'cursor-not-allowed opacity-50 hover:border-border hover:bg-transparent',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    {selected ? <CheckCircle2 className="size-4 text-brand-600" /> : <span className="size-4 rounded-full border border-border-strong" />}
                    {meta?.label ?? a}
                  </span>
                  <span className="text-[12px] text-ink-muted">{reason ?? meta?.description}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {action === 'COMPLETE_FROM_INVENTORY' && (
          <p className="rounded-md bg-info-bg px-3 py-2 text-[12px] text-info">
            Se agregarán líneas con el faltante sugerido para que lo peses en la Balanza Madre:{' '}
            {lines.filter((l) => l.canCompleteFromInventory).map((l) => `${l.materialName} ${formatGrams(l.shortfallGrams)}`).join(' · ')}.
          </p>
        )}
        {action === 'REQUEST_FABRICATION' && (
          <FormField label="Taller fabricante" hint="Se crea una orden borrador por el faltante, vinculada a esta orden.">
            <NativeSelect
              data-testid="insufficiency-fabrication-workshop"
              placeholder="Automático (taller habilitado del producto)"
              options={workshops.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))}
              value={fabricationWorkshopId}
              onChange={(e) => setFabricationWorkshopId(e.target.value)}
            />
          </FormField>
        )}
        {action === 'MODIFY_ORDER' && (
          <p className="flex items-start gap-2 rounded-md bg-warning-bg px-3 py-2 text-[12px] text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> El objetivo de la orden se reducirá a lo que alcanza el material más restrictivo. Queda registrado con tu autorización.
          </p>
        )}
        {needsJustification && (
          <FormField label="Justificación" required hint="Mínimo 5 caracteres. Queda en el historial de decisiones de la orden.">
            <Textarea data-testid="insufficiency-justification" rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} />
          </FormField>
        )}
      </div>
    </Modal>
  )
}
