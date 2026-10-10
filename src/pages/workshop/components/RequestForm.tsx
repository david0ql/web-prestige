import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Send } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { MaterialRequest, ProductionOrder } from '@/lib/api/types'
import { formatGrams, formatPercent } from '@/lib/format'
import { useMaterials } from '@/lib/hooks/useMasters'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'
import { cn } from '@/lib/cn'
import { BIG_BTN, ErrorPanel, FIELD, num } from './shared'

/** Resultado de la validación contra estándar (RF-016). */
export function DeviationNote({ r, className }: { r: MaterialRequest; className?: string }) {
  if (r.expectedGrams === null) return null
  return (
    <div
      data-testid="request-deviation"
      className={cn('flex items-start gap-2 rounded-sm px-2.5 py-2 text-[13px]', r.exceedsStandard ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success', className)}
    >
      {r.exceedsStandard ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
      <span>
        {r.exceedsStandard ? 'Fuera del estándar' : 'Dentro del estándar'}: estándar {formatGrams(r.expectedGrams)}, ya entregado {formatGrams(r.alreadyDeliveredGrams)}
        {r.deviationPct !== null && ` · desviación ${r.deviationPct > 0 ? '+' : ''}${formatPercent(r.deviationPct)}`}
        {r.exceedsStandard && '. Prestige Gold revisará la justificación.'}
      </span>
    </div>
  )
}

/** Formulario de solicitud de material adicional (con o sin orden). */
export function RequestForm({ order, onDone, onCancel, disabled }: { order: ProductionOrder | null; onDone?: (r: MaterialRequest) => void; onCancel?: () => void; disabled?: boolean }) {
  const qc = useQueryClient()
  const materials = useMaterials()
  const [materialId, setMaterialId] = useState('')
  const [grams, setGrams] = useState('')
  const [reason, setReason] = useState('')
  const [result, setResult] = useState<MaterialRequest | null>(null)
  const [tried, setTried] = useState(false)

  const reqs = order?.requirements ?? []
  const options = useMemo(() => {
    const fromOrder = reqs.map((r) => ({ value: r.materialId, label: `${r.material.name} (de la orden)` }))
    const ids = new Set(fromOrder.map((o) => o.value))
    const rest = (materials.data ?? []).filter((m) => m.status === 'ACTIVE' && !ids.has(m.id)).map((m) => ({ value: m.id, label: `${m.name} · ${m.code}` }))
    return [...fromOrder, ...rest]
  }, [reqs, materials.data])

  const req = reqs.find((r) => r.materialId === materialId)
  const g = num(grams)
  const preview = req && g && req.dispatchedGrams !== undefined ? ((req.dispatchedGrams ?? 0) + g - req.requiredGrams) / req.requiredGrams * 100 : null
  const previewExceeds = req && preview !== null ? preview > req.tolerancePct : false

  const m = useMutation({
    meta: { silent: true },
    mutationFn: () => api.post<MaterialRequest>('/material-requests', { orderId: order?.id, materialId, grams: g, reason: reason.trim() }),
    onSuccess: (r) => {
      setResult(r)
      setGrams('')
      setReason('')
      setTried(false)
      notify.success(`Solicitud ${r.number} enviada a Oficina Madre`)
      void qc.invalidateQueries({ queryKey: ['material-requests'] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['workshop-portal'] })
      onDone?.(r)
    },
  })

  const submit = () => {
    setTried(true)
    if (!materialId || !g || g <= 0 || reason.trim().length < 5) return
    m.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <FormField label="Material" required error={tried && !materialId ? 'Elige el material' : undefined}>
          <NativeSelect data-testid="request-material" value={materialId} onChange={(e) => setMaterialId(e.target.value)} placeholder="Selecciona…" options={options} className={FIELD} disabled={disabled} />
        </FormField>
        <FormField label="Cantidad (g)" required error={tried && (!g || g <= 0) ? 'Indica los gramos' : undefined}>
          <Input data-testid="request-grams" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className={cn(FIELD, 'tnum')} disabled={disabled} />
        </FormField>
      </div>
      {req && (
        <p className="text-[13px] text-ink-muted">
          Estándar de la orden {formatGrams(req.requiredGrams)} (tolerancia {formatPercent(req.tolerancePct)}) {req.dispatchedGrams !== undefined && ` · entregado ${formatGrams(req.dispatchedGrams)}`}
          {preview !== null && (
            <span className={cn('ml-1 font-semibold', previewExceeds ? 'text-warning' : 'text-success')}>
              · con esta solicitud quedarías {preview > 0 ? '+' : ''}{formatPercent(preview)} {previewExceeds ? '(fuera del estándar)' : ''}
            </span>
          )}
        </p>
      )}
      <FormField label="Motivo" required error={tried && reason.trim().length < 5 ? 'Explica el motivo (mínimo 5 caracteres)' : undefined}>
        <Textarea data-testid="request-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: se fundió más material por porosidad" className="text-[16px] sm:text-[14px]" disabled={disabled} />
      </FormField>
      <ErrorPanel error={m.error} />
      {result && <DeviationNote r={result} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button variant="secondary" onClick={onCancel} className={BIG_BTN}>Cerrar</Button>}
        <Button data-testid="request-submit" onClick={submit} loading={m.isPending} disabled={disabled} className={BIG_BTN}>
          <Send className="size-4" /> Enviar solicitud
        </Button>
      </div>
    </div>
  )
}
