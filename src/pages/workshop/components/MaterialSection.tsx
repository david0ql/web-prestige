import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Plus, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { Material, OrderDetail } from '@/lib/api/types'
import { formatDateTime, formatGrams, formatNumber, formatPercent } from '@/lib/format'
import { ReasonDialog } from '@/components/domain/ReasonDialog'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'
import { cn } from '@/lib/cn'
import { BIG_BTN, ErrorPanel, FIELD, ProgressBar, num } from './shared'
import type { OrderStage } from './StagesSection'

export interface MaterialRow { material: Material; standard: number | null; tolerancePct: number; received: number; custody: number; consumed: number }

/** Consolida estándar, custodia y consumo por material de la orden. */
export function useMaterialRows(order: OrderDetail): MaterialRow[] {
  return useMemo(() => {
    const map = new Map<string, MaterialRow>()
    for (const r of order.requirements) map.set(r.materialId, { material: r.material, standard: r.requiredGrams, tolerancePct: r.tolerancePct, received: 0, custody: 0, consumed: 0 })
    for (const c of order.custody) {
      const row = map.get(c.materialId) ?? { material: c.material, standard: null, tolerancePct: 0, received: 0, custody: 0, consumed: 0 }
      row.received = c.inGrams
      row.custody = c.balance
      map.set(c.materialId, row)
    }
    for (const c of order.consumptions) {
      if (c.voided) continue
      const row = map.get(c.materialId) ?? { material: c.material, standard: null, tolerancePct: 0, received: 0, custody: 0, consumed: 0 }
      row.consumed += c.grams
      map.set(c.materialId, row)
    }
    return [...map.values()]
  }, [order])
}

/** Consumos de insumos (RF-012): consumido vs estándar vs custodia. */
export function ConsumptionSection({ order, stages, editable }: { order: OrderDetail; stages: OrderStage[]; editable: boolean }) {
  const qc = useQueryClient()
  const rows = useMaterialRows(order)
  const [materialId, setMaterialId] = useState('')
  const [grams, setGrams] = useState('')
  const [stageId, setStageId] = useState('')
  const [notes, setNotes] = useState('')
  const [tried, setTried] = useState(false)
  const [voiding, setVoiding] = useState<string | null>(null)
  const g = num(grams)
  const sel = rows.find((r) => r.material.id === materialId)

  const add = useMutation({
    meta: { silent: true },
    mutationFn: () => api.post(`/orders/${order.id}/consumptions`, { items: [{ materialId, grams: g, stageId: stageId || undefined, notes: notes.trim() || undefined }] }),
    onSuccess: () => {
      notify.success('Consumo registrado')
      setGrams('')
      setNotes('')
      setTried(false)
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['workshop-portal'] })
    },
  })
  const voidM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/orders/${order.id}/consumptions/${id}/void`, { reason }),
    onSuccess: () => {
      notify.success('Consumo anulado')
      setVoiding(null)
      void qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const submit = () => {
    setTried(true)
    if (!materialId || !g || g <= 0) return
    add.mutate()
  }
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {rows.map((r) => {
          const available = r.custody - r.consumed
          const limit = r.standard ? r.standard * (1 + r.tolerancePct / 100) : null
          const over = limit !== null && r.consumed > limit + 0.0001
          return (
            <div key={r.material.id} className="rounded-md border border-border bg-surface p-3" data-testid={`consumption-row-${r.material.code}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-semibold text-ink">{r.material.name}</p>
                <p className={cn('text-[14px] font-semibold tnum', over ? 'text-danger' : 'text-ink')}>{formatGrams(r.consumed)} <span className="text-[12px] font-normal text-ink-muted">consumido</span></p>
              </div>
              <ProgressBar value={r.standard ? (r.consumed / r.standard) * 100 : r.custody ? (r.consumed / r.custody) * 100 : 0} tone={over ? 'danger' : 'gold'} className="mt-2" />
              <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                <div><p className="text-ink-muted">Estándar</p><p className="font-medium text-ink tnum">{r.standard !== null ? formatGrams(r.standard) : '—'}</p></div>
                <div><p className="text-ink-muted">En custodia</p><p className="font-medium text-ink tnum">{formatGrams(r.custody)}</p></div>
                <div><p className="text-ink-muted">Disponible</p><p className={cn('font-medium tnum', available < 0 ? 'text-danger' : 'text-ink')}>{formatGrams(available)}</p></div>
              </div>
              {over && <p className="mt-1.5 text-[12px] text-danger">Supera el estándar (+{formatPercent(r.tolerancePct)} de tolerancia). Se generó una alerta de consumo anormal.</p>}
            </div>
          )
        })}
        {!rows.length && <p className="text-[14px] text-ink-muted">Aún no tienes material recibido para esta orden.</p>}
      </div>

      {editable && (
        <div className="rounded-md border border-border bg-sunken/40 p-3.5">
          <p className="mb-3 text-[14px] font-semibold text-ink">Registrar consumo</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Material" required error={tried && !materialId ? 'Elige el material' : undefined}>
              <NativeSelect
                data-testid="consumption-material"
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                placeholder="Selecciona…"
                options={rows.map((r) => ({ value: r.material.id, label: `${r.material.name} · disp. ${formatGrams(r.custody - r.consumed)}` }))}
                className={FIELD}
              />
            </FormField>
            <FormField label="Gramos consumidos" required error={tried && (!g || g <= 0) ? 'Indica los gramos' : sel && g && g > sel.custody - sel.consumed + 0.0001 ? `Supera lo disponible (${formatGrams(sel.custody - sel.consumed)})` : undefined}>
              <Input data-testid="consumption-grams" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className={cn(FIELD, 'tnum')} />
            </FormField>
            <FormField label="Etapa (opcional)">
              <NativeSelect data-testid="consumption-stage" value={stageId} onChange={(e) => setStageId(e.target.value)} placeholder="Sin etapa" options={stages.map((s) => ({ value: s.id, label: s.name }))} className={FIELD} />
            </FormField>
            <FormField label="Observaciones (opcional)">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className={FIELD} />
            </FormField>
          </div>
          <div className="mt-3 space-y-2">
            <ErrorPanel error={add.error} />
            <Button data-testid="consumption-submit" onClick={submit} loading={add.isPending} className={cn(BIG_BTN, 'w-full sm:w-auto')}>
              <Plus className="size-5" /> Registrar consumo
            </Button>
          </div>
        </div>
      )}

      {order.consumptions.length > 0 && (
        <div>
          <p className="eyebrow mb-1.5">Consumos reportados</p>
          <ul className="divide-y divide-border rounded-md border border-border bg-surface" data-testid="consumption-list">
            {order.consumptions
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((c) => (
                <li key={c.id} className={cn('flex items-center gap-3 px-3 py-2.5', c.voided && 'opacity-60')}>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[14px] font-medium text-ink', c.voided && 'line-through')}>
                      {c.material.name} · <span className="tnum">{formatGrams(c.grams)}</span>
                    </p>
                    <p className="truncate text-[12px] text-ink-muted">
                      {formatDateTime(c.createdAt)}
                      {stageName(c.stageId) ? ` · ${stageName(c.stageId)}` : ''}
                      {c.notes ? ` · ${c.notes}` : ''}
                      {c.voided ? ` · Anulado: ${c.voidReason ?? ''}` : ''}
                    </p>
                  </div>
                  {editable && !c.voided && (
                    <Button variant="ghost" size="sm" onClick={() => setVoiding(c.id)} data-testid={`consumption-void-${c.id}`}>
                      <Ban className="size-3.5" /> Anular
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      <ReasonDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title="Anular consumo"
        description="El consumo quedará anulado (no se borra) con el motivo que indiques."
        confirmLabel="Anular consumo"
        danger
        loading={voidM.isPending}
        onConfirm={(reason) => voiding && voidM.mutate({ id: voiding, reason })}
      />
    </div>
  )
}

/** Avance parcial por gramos/unidades/% (RF-013). */
export function ProgressSection({ order, stages, editable }: { order: OrderDetail; stages: OrderStage[]; editable: boolean }) {
  const qc = useQueryClient()
  const [stageId, setStageId] = useState('')
  const [grams, setGrams] = useState('')
  const [units, setUnits] = useState('')
  const [percent, setPercent] = useState('')
  const [notes, setNotes] = useState('')
  const lastPct = order.progress.find((p) => p.percent !== null)?.percent ?? null
  const m = useMutation({
    meta: { silent: true },
    mutationFn: () =>
      api.post(`/orders/${order.id}/progress`, {
        stageId: stageId || undefined,
        grams: num(grams),
        units: num(units) !== undefined ? Math.round(num(units)!) : undefined,
        percent: num(percent),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      notify.success('Avance registrado')
      setGrams('')
      setUnits('')
      setPercent('')
      setNotes('')
      void qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
  const empty = !num(grams) && !num(units) && num(percent) === undefined && !notes.trim()
  const pctVal = num(percent)

  return (
    <div className="space-y-4">
      {editable && (
        <div className="rounded-md border border-border bg-sunken/40 p-3.5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField label="Gramos">
              <Input data-testid="progress-grams" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className={cn(FIELD, 'tnum')} placeholder={`de ${formatNumber(order.targetGrams)}`} />
            </FormField>
            <FormField label="Unidades">
              <Input data-testid="progress-units" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} className={cn(FIELD, 'tnum')} placeholder={order.targetUnits ? `de ${order.targetUnits}` : ''} />
            </FormField>
            <FormField label="% avance" error={pctVal !== undefined && (pctVal < 0 || pctVal > 100) ? '0 a 100' : undefined}>
              <Input data-testid="progress-percent" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} className={cn(FIELD, 'tnum')} placeholder={lastPct !== null ? `últ. ${lastPct}` : ''} />
            </FormField>
            <FormField label="Etapa">
              <NativeSelect value={stageId} onChange={(e) => setStageId(e.target.value)} placeholder="General" options={stages.filter((s) => !s.isFinal).map((s) => ({ value: s.id, label: s.name }))} className={FIELD} />
            </FormField>
          </div>
          <FormField label="Observaciones" className="mt-3">
            <Textarea data-testid="progress-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-[16px] sm:text-[14px]" placeholder="Ej.: 6 de 10 anillos armados" />
          </FormField>
          <div className="mt-3 space-y-2">
            <ErrorPanel error={m.error} />
            <Button data-testid="progress-submit" onClick={() => m.mutate()} disabled={empty || (pctVal !== undefined && (pctVal < 0 || pctVal > 100))} loading={m.isPending} className={cn(BIG_BTN, 'w-full sm:w-auto')}>
              <TrendingUp className="size-5" /> Registrar avance
            </Button>
          </div>
        </div>
      )}
      {order.progress.length > 0 ? (
        <ol className="relative space-y-3 border-l-2 border-border pl-4">
          {order.progress.map((p) => (
            <li key={p.id} className="relative">
              <span className={cn('absolute top-1 -left-[23px] size-3 rounded-full border-2 border-surface', p.completesStage ? 'bg-success' : 'bg-brand-500')} />
              <p className="text-[14px] font-medium text-ink">
                {p.completesStage ? `Etapa completada: ${p.stage?.name ?? ''}` : p.stage ? `Avance · ${p.stage.name}` : 'Avance general'}
              </p>
              <p className="text-[12px] text-ink-muted">
                {formatDateTime(p.createdAt)}
                {p.grams !== null ? ` · ${formatGrams(p.grams)}` : ''}
                {p.units !== null ? ` · ${formatNumber(p.units)} u` : ''}
                {p.percent !== null ? ` · ${formatPercent(p.percent, 0)}` : ''}
              </p>
              {p.notes && <p className="text-[13px] text-ink-secondary">{p.notes}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[14px] text-ink-muted">Sin avances registrados todavía.</p>
      )}
    </div>
  )
}
