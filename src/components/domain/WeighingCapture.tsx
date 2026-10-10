import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Cable, CheckCircle2, FlaskConical, Keyboard, RotateCcw, Scale, Unplug } from 'lucide-react'
import { api, errorMessage } from '@/lib/api/client'
import type { Weighing } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useScale } from '@/lib/scale/useScale'
import { formatGrams } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'

interface Props {
  purpose: 'ENTRY' | 'DISPATCH' | 'RECEPTION' | 'CUSTOMER_MATERIAL' | 'SALE' | 'OTHER'
  materialId?: string | null
  value?: Weighing | null
  onCaptured: (w: Weighing | null) => void
  compact?: boolean
  label?: string
  testId?: string
}

/**
 * P03 · Panel de Balanza Madre: peso en vivo (Web Serial o simulador), tara y
 * captura. La captura manual solo aparece para roles autorizados y exige motivo
 * (RF-003); queda auditada en la API.
 */
export function WeighingCapture({ purpose, materialId, value, onCaptured, compact, label = 'Balanza Madre', testId = 'weighing' }: Props) {
  const canManual = usePermission('scale.manual')
  const { data: config } = useQuery({ queryKey: ['scale-config'], queryFn: () => api.get<{ baudRate: number; dataBits: number; stopBits: number; parity: string; model?: string }>('/weighings/config'), staleTime: 300_000 })
  const scale = useScale(config ?? {})
  const [manual, setManual] = useState(false)
  const [manualGrams, setManualGrams] = useState('')
  const [reason, setReason] = useState('')
  const [tare, setTare] = useState('')
  const [simTarget, setSimTarget] = useState('')

  const capture = useMutation({
    mutationFn: () => {
      const tareGrams = tare ? Number(tare) : 0
      if (manual) {
        return api.post<Weighing>('/weighings', { purpose, source: 'MANUAL', grossGrams: Number(manualGrams), tareGrams, materialId: materialId || undefined, manualReason: reason })
      }
      const r = scale.reading!
      return api.post<Weighing>('/weighings', { purpose, source: 'SCALE', grossGrams: r.grams, tareGrams, materialId: materialId || undefined, rawReading: r.raw, stable: r.stable, deviceInfo: scale.mode === 'simulator' ? 'Simulador' : 'Web Serial' })
    },
    onSuccess: (w) => {
      onCaptured(w)
      notify.success(`Pesaje ${w.number}: ${formatGrams(w.currentNetGrams)}`)
    },
    onError: (e) => notify.error(errorMessage(e)),
    meta: { silent: true },
  })

  if (value) {
    return (
      <div data-testid={`${testId}-captured`} className="flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success-bg px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="size-5 text-success" />
          <div>
            <p className="text-[13px] font-semibold text-ink">
              {formatGrams(value.currentNetGrams, 2)} <span className="font-normal text-ink-muted">· {value.number}</span>
            </p>
            <p className="text-[12px] text-ink-muted">{value.source === 'MANUAL' ? `Manual: ${value.manualReason}` : 'Capturado desde balanza'}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onCaptured(null)}>
          <RotateCcw className="size-3.5" /> Volver a pesar
        </Button>
      </div>
    )
  }

  const live = scale.reading
  const canCapture = manual ? Number(manualGrams) > 0 && reason.trim().length >= 5 : !!live && live.stable && live.grams > 0

  return (
    <div className={cn('rounded-lg border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground', compact ? 'space-y-2' : 'space-y-3')} data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-brand-400" />
          <span className="text-[12px] font-semibold tracking-wide uppercase text-sidebar-muted">{label}</span>
        </div>
        <span className={cn('flex items-center gap-1.5 text-[11px]', scale.mode === 'disconnected' ? 'text-sidebar-muted' : 'text-brand-300')}>
          <span className={cn('size-2 rounded-full', scale.mode === 'disconnected' ? 'bg-sidebar-muted' : 'bg-brand-400 animate-pulse-gold')} />
          {manual ? 'Captura manual' : scale.mode === 'serial' ? 'Balanza conectada' : scale.mode === 'simulator' ? 'Simulador' : 'Sin conexión'}
        </span>
      </div>

      {!manual ? (
        <div className="rounded-md border border-sidebar-border bg-black/40 px-4 py-3 text-right">
          <p className="text-[11px] tracking-wider text-sidebar-muted uppercase">Peso actual {live && !live.stable && <span className="text-warning">· inestable</span>}</p>
          <p data-testid={`${testId}-live`} className="ledger text-[34px] leading-tight font-semibold text-brand-300 tnum">
            {live ? live.grams.toFixed(2) : '0.00'} <span className="text-[16px] text-sidebar-muted">g</span>
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          <Input data-testid={`${testId}-manual-grams`} type="number" step="0.0001" min="0" placeholder="Peso bruto (g)" value={manualGrams} onChange={(e) => setManualGrams(e.target.value)} className="bg-white" />
          <Textarea data-testid={`${testId}-manual-reason`} rows={2} placeholder="Motivo de la captura manual (obligatorio, queda auditado)" value={reason} onChange={(e) => setReason(e.target.value)} className="bg-white" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input type="number" step="0.01" min="0" placeholder="Tara (g)" value={tare} onChange={(e) => setTare(e.target.value)} className="h-8 w-28 bg-white" aria-label="Tara" />
        {!manual && scale.mode === 'disconnected' && (
          <>
            <Button size="sm" variant="secondary" onClick={() => void scale.connectSerial()}>
              <Cable className="size-3.5" /> Conectar balanza
            </Button>
            <Button size="sm" variant="secondary" data-testid={`${testId}-simulator`} onClick={() => scale.startSimulator(Number(simTarget) || 100)}>
              <FlaskConical className="size-3.5" /> Simulador
            </Button>
          </>
        )}
        {!manual && scale.mode === 'simulator' && (
          <div className="flex items-center gap-1.5">
            <Input data-testid={`${testId}-sim-weight`} type="number" step="0.01" placeholder="Peso sobre la balanza" value={simTarget} onChange={(e) => setSimTarget(e.target.value)} className="h-8 w-40 bg-white" />
            <Button size="sm" variant="secondary" onClick={() => scale.setSimulatedWeight(Number(simTarget) || 0)}>Poner</Button>
          </div>
        )}
        {!manual && scale.mode !== 'disconnected' && (
          <Button size="sm" variant="ghost" className="text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground" onClick={() => void scale.disconnect()}>
            <Unplug className="size-3.5" /> Desconectar
          </Button>
        )}
        {canManual && (
          <Button size="sm" variant="ghost" data-testid={`${testId}-manual-toggle`} className="text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground" onClick={() => setManual((m) => !m)}>
            <Keyboard className="size-3.5" /> {manual ? 'Usar balanza' : 'Captura manual'}
          </Button>
        )}
        <Button size="sm" className="ml-auto" disabled={!canCapture} loading={capture.isPending} onClick={() => capture.mutate()} data-testid={`${testId}-capture`}>
          Capturar peso
        </Button>
      </div>
      {scale.error && <p className="text-[12px] text-warning">{scale.error}</p>}
    </div>
  )
}
