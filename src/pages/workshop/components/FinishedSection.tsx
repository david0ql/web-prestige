import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardCheck, PackageCheck, Plus, Trash2, Wand2, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { MediaFile, OrderDetail, TechnicalVariable } from '@/lib/api/types'
import { formatDateTime, formatGrams, formatMoney, formatNumber } from '@/lib/format'
import { APPROVAL_STATUS, LABOR_BASIS, RECEIPT_LINE } from '@/lib/labels'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Textarea } from '@/components/ui/Textarea'
import { notify } from '@/components/ui/Toaster'
import { cn } from '@/lib/cn'
import { BIG_BTN, ErrorPanel, FIELD, KV, missingList, num } from './shared'
import { evidenceMissing, stageCounts, type OrderStage } from './StagesSection'
import type { MaterialRow } from './MaterialSection'

type Leftover = { materialId: string; grams: string; type: 'LEFTOVER' | 'UNUSED' | 'RETURN' }
const LEFTOVER_TYPES = ['LEFTOVER', 'UNUSED', 'RETURN'] as const

const fmtVal = (v: unknown, unit?: string | null) => (v === true ? 'Sí' : v === false ? 'No' : v === null || v === undefined || v === '' ? '—' : `${String(v)}${unit ? ` ${unit}` : ''}`)

function Check2({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('flex items-start gap-2 text-[14px]', ok ? 'text-success' : 'text-ink-secondary')}>
      <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full', ok ? 'bg-success text-white' : 'bg-danger-bg text-danger')}>
        {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      </span>
      <span>{children}</span>
    </li>
  )
}

/** Variable técnica con control según su tipo de dato. */
function VariableInput({ v, value, onChange, reference, invalid }: { v: TechnicalVariable; value: string; onChange: (s: string) => void; reference: unknown; invalid: boolean }) {
  const testId = `finished-var-${v.code}`
  const label = `${v.name}${v.unit ? ` (${v.unit})` : ''}`
  const hint = reference !== undefined ? `Ficha técnica: ${fmtVal(reference, v.unit)}` : undefined
  const err = invalid ? 'Obligatoria para declarar el terminado' : undefined
  return (
    <FormField label={label} required={v.requiredOnFinish} hint={hint} error={err}>
      {v.dataType === 'SELECT' ? (
        <NativeSelect data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Selecciona…" options={v.options.map((o) => ({ value: o, label: o }))} className={FIELD} />
      ) : v.dataType === 'BOOLEAN' ? (
        <NativeSelect data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Selecciona…" options={[{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }]} className={FIELD} />
      ) : (
        <Input data-testid={testId} inputMode={v.dataType === 'NUMBER' ? 'decimal' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, v.dataType === 'NUMBER' && 'tnum')} />
      )}
    </FormField>
  )
}

/** P10 · Producto terminado / ficha técnica (RF-017, RF-018, CA-005). */
export function FinishedSection({ order, stages, media, variables, rows, editable }: {
  order: OrderDetail; stages: OrderStage[]; media: MediaFile[]; variables: TechnicalVariable[]; rows: MaterialRow[]; editable: boolean
}) {
  const qc = useQueryClient()
  const sheet = order.technicalSheet
  const prev = order.declarations.find((d) => d.current) ?? null
  const [grams, setGrams] = useState(prev ? String(prev.grams) : '')
  const [units, setUnits] = useState(prev?.units != null ? String(prev.units) : '')
  const [vars, setVars] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(prev?.technicalValues ?? {}).map(([k, v]) => [k, String(v)])))
  const [diameter, setDiameter] = useState(prev?.diameterMm != null ? String(prev.diameterMm) : '')
  const [length, setLength] = useState(prev?.lengthMm != null ? String(prev.lengthMm) : '')
  const [measures, setMeasures] = useState(prev?.measures ?? '')
  const [leftovers, setLeftovers] = useState<Leftover[]>(() => (prev?.declaredLeftovers ?? []).map((l) => ({ materialId: l.materialId, grams: String(l.grams), type: l.type as Leftover['type'] })))
  const [basis, setBasis] = useState('GRAM')
  const [rate, setRate] = useState('')
  const [qty, setQty] = useState('')
  const [qtyTouched, setQtyTouched] = useState(false)
  const [notes, setNotes] = useState(prev?.notes ?? '')
  const [tried, setTried] = useState(false)

  const finalStage = stages.find((s) => s.isFinal)
  const pendingStages = stages.filter((s) => s.mandatory && !s.isFinal && !s.completed)
  const finalMissing = finalStage ? evidenceMissing(finalStage, stageCounts(media, finalStage.id)) : []
  const missingVars = variables.filter((v) => v.requiredOnFinish && !(vars[v.code] ?? '').trim())
  const g = num(grams)
  const deliveredTotal = order.custody.reduce((s, c) => s + c.inGrams, 0)

  const autoQty = basis === 'GRAM' ? (g ?? 0) : basis === 'UNIT' ? (num(units) ?? 0) : 1
  const quantity = qtyTouched ? num(qty) : autoQty || undefined
  // Tarifa vigente del taller para el producto (RF-018): se usa si el taller no propone otra.
  const { data: current } = useQuery({
    queryKey: ['labor-rate', order.productId, basis],
    queryFn: () => api.get<{ rate: number | null }>('/workshop-portal/labor-rate', { productId: order.productId, basis }),
  })
  const rateN = num(rate) ?? current?.rate ?? undefined
  const laborValue = rateN !== undefined && quantity ? rateN * quantity : null

  const materialOptions = useMemo(() => rows.map((r) => ({ value: r.material.id, label: r.material.name })), [rows])

  const fillFromSheet = () => {
    if (!sheet) return
    const next: Record<string, string> = { ...vars }
    for (const v of variables) {
      const ref = sheet.variables?.[v.code]
      if (ref !== undefined && !(next[v.code] ?? '').trim()) next[v.code] = String(ref)
    }
    setVars(next)
    if (!diameter && sheet.diameterMm != null) setDiameter(String(sheet.diameterMm))
    if (!length && sheet.lengthMm != null) setLength(String(sheet.lengthMm))
    if (!measures && sheet.measures) setMeasures(sheet.measures)
    notify.info('Se copiaron los valores de la ficha técnica. Verifícalos contra la pieza real.')
  }

  const m = useMutation({
    meta: { silent: true },
    mutationFn: () => {
      const technicalValues: Record<string, string | number | boolean> = {}
      for (const v of variables) {
        const raw = (vars[v.code] ?? '').trim()
        if (!raw) continue
        technicalValues[v.code] = v.dataType === 'NUMBER' ? Number(raw.replace(',', '.')) : v.dataType === 'BOOLEAN' ? raw === 'true' : raw
      }
      return api.post(`/orders/${order.id}/finished`, {
        grams: g,
        units: num(units) !== undefined ? Math.round(num(units)!) : undefined,
        technicalValues,
        diameterMm: num(diameter),
        lengthMm: num(length),
        measures: measures.trim() || undefined,
        leftovers: leftovers.filter((l) => l.materialId && num(l.grams)).map((l) => ({ materialId: l.materialId, grams: num(l.grams), type: l.type })),
        labor: quantity && quantity > 0 ? { basis, rate: rateN, quantity } : undefined,
        notes: notes.trim() || undefined,
      })
    },
    onSuccess: () => {
      notify.success('Producto terminado declarado. Entrégalo a Oficina Madre para su recepción.')
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['workshop-portal'] })
      void qc.invalidateQueries({ queryKey: ['media'] })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const submit = () => {
    setTried(true)
    if (!g || g <= 0 || missingVars.length) {
      notify.error(!g || g <= 0 ? 'Indica el peso del producto terminado' : 'Completa las variables técnicas obligatorias')
      return
    }
    m.mutate()
  }

  const varName = (code: string) => variables.find((v) => v.code === code)?.name ?? code

  if (!editable) {
    return (
      <div className="space-y-3">
        {prev ? (
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-ink"><PackageCheck className="size-4 text-success" /> Declarado el {formatDateTime(prev.createdAt)}</p>
            <div className="divide-y divide-border">
              <KV label="Peso">{formatGrams(prev.grams)}</KV>
              {prev.units != null && <KV label="Unidades">{formatNumber(prev.units)}</KV>}
              {prev.diameterMm != null && <KV label="Diámetro">{prev.diameterMm} mm</KV>}
              {prev.lengthMm != null && <KV label="Largo">{prev.lengthMm} mm</KV>}
              {prev.measures && <KV label="Medidas">{prev.measures}</KV>}
              {Object.entries(prev.technicalValues).map(([k, v]) => (
                <KV key={k} label={varName(k)}>{fmtVal(v)}</KV>
              ))}
              {prev.declaredLeftovers.map((l, i) => (
                <KV key={i} label={RECEIPT_LINE[l.type] ?? l.type}>{rows.find((r) => r.material.id === l.materialId)?.material.name ?? 'Material'} · {formatGrams(l.grams)}</KV>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-ink-muted">Aún no se ha declarado producto terminado para esta orden.</p>
        )}
        <LaborList order={order} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-surface p-3.5" data-testid="finished-checklist">
        <p className="eyebrow mb-2">Antes de declarar</p>
        <ul className="space-y-1.5">
          <Check2 ok={pendingStages.length === 0}>
            {pendingStages.length === 0 ? 'Etapas obligatorias completas' : `Etapas obligatorias pendientes: ${pendingStages.map((s) => s.name).join(', ')}`}
          </Check2>
          {finalStage && (
            <Check2 ok={finalMissing.length === 0}>
              {finalMissing.length === 0 ? 'Evidencia final del producto cargada' : `Evidencia final (etapa ${finalStage.name}): falta ${finalMissing.join(' y ')}`}
            </Check2>
          )}
          <Check2 ok={missingVars.length === 0}>
            {missingVars.length === 0 ? 'Variables técnicas completas' : `Variables obligatorias: ${missingVars.map((v) => v.name).join(', ')}`}
          </Check2>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Peso terminado (g)" required error={tried && (!g || g <= 0) ? 'Indica el peso' : g && g > deliveredTotal + 0.0001 ? `Supera lo entregado (${formatGrams(deliveredTotal)})` : undefined} hint={`Objetivo ${formatGrams(order.targetGrams)}`}>
          <Input data-testid="finished-grams" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className={cn(FIELD, 'font-semibold tnum')} />
        </FormField>
        <FormField label="Unidades" hint={order.targetUnits ? `Objetivo ${formatNumber(order.targetUnits)} u` : undefined}>
          <Input data-testid="finished-units" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} className={cn(FIELD, 'tnum')} />
        </FormField>
      </div>

      <div className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-semibold text-ink">Ficha técnica de la pieza</p>
          {sheet && (
            <Button variant="ghost" size="sm" onClick={fillFromSheet} data-testid="finished-fill-sheet">
              <Wand2 className="size-3.5" /> Copiar de la ficha
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {variables.map((v) => (
            <VariableInput key={v.id} v={v} value={vars[v.code] ?? ''} onChange={(s) => setVars((x) => ({ ...x, [v.code]: s }))} reference={sheet?.variables?.[v.code]} invalid={tried && v.requiredOnFinish && !(vars[v.code] ?? '').trim()} />
          ))}
          <FormField label="Diámetro (mm)" hint={sheet?.diameterMm != null ? `Ficha técnica: ${sheet.diameterMm} mm` : undefined}>
            <Input data-testid="finished-diameter" inputMode="decimal" value={diameter} onChange={(e) => setDiameter(e.target.value)} className={cn(FIELD, 'tnum')} />
          </FormField>
          <FormField label="Largo (mm)" hint={sheet?.lengthMm != null ? `Ficha técnica: ${sheet.lengthMm} mm` : undefined}>
            <Input data-testid="finished-length" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} className={cn(FIELD, 'tnum')} />
          </FormField>
          <FormField label="Medidas" hint={sheet?.measures ? `Ficha técnica: ${sheet.measures}` : undefined} className="sm:col-span-2">
            <Input data-testid="finished-measures" value={measures} onChange={(e) => setMeasures(e.target.value)} className={FIELD} placeholder="Ej.: talla 7 · ancho 4 mm" />
          </FormField>
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[14px] font-semibold text-ink">Sobrantes y devoluciones</p>
            <p className="text-[12px] text-ink-muted">Material que enviarás de vuelta junto con el producto.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setLeftovers((l) => [...l, { materialId: rows[0]?.material.id ?? '', grams: '', type: 'LEFTOVER' }])} data-testid="finished-add-leftover">
            <Plus className="size-3.5" /> Agregar
          </Button>
        </div>
        {leftovers.length === 0 && <p className="text-[13px] text-ink-muted">Sin sobrantes declarados.</p>}
        <div className="space-y-2">
          {leftovers.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-sm bg-sunken/50 p-2 sm:grid-cols-[1.4fr_0.8fr_1fr_auto]">
              <NativeSelect value={l.materialId} onChange={(e) => setLeftovers((x) => x.map((y, j) => (j === i ? { ...y, materialId: e.target.value } : y)))} options={materialOptions} className={cn(FIELD, 'col-span-1')} aria-label="Material" data-testid={`finished-leftover-material-${i}`} />
              <Button variant="ghost" iconOnly aria-label="Quitar" onClick={() => setLeftovers((x) => x.filter((_, j) => j !== i))} className="size-11 sm:order-last sm:size-10">
                <Trash2 className="size-4" />
              </Button>
              <Input placeholder="Gramos" inputMode="decimal" value={l.grams} onChange={(e) => setLeftovers((x) => x.map((y, j) => (j === i ? { ...y, grams: e.target.value } : y)))} className={cn(FIELD, 'tnum')} aria-label="Gramos" data-testid={`finished-leftover-grams-${i}`} />
              <NativeSelect value={l.type} onChange={(e) => setLeftovers((x) => x.map((y, j) => (j === i ? { ...y, type: e.target.value as Leftover['type'] } : y)))} options={LEFTOVER_TYPES.map((t) => ({ value: t, label: RECEIPT_LINE[t] }))} className={FIELD} aria-label="Tipo" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-3.5">
        <p className="text-[14px] font-semibold text-ink">Mano de obra propuesta</p>
        <p className="mb-3 text-[12px] text-ink-muted">Es una propuesta: Prestige Gold la aprueba al cerrar la orden (RN-012).</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <FormField label="Base">
            <NativeSelect data-testid="finished-labor-basis" value={basis} onChange={(e) => setBasis(e.target.value)} options={Object.entries(LABOR_BASIS).map(([value, label]) => ({ value, label }))} className={FIELD} />
          </FormField>
          <FormField label="Cantidad">
            <Input
              data-testid="finished-labor-quantity"
              inputMode="decimal"
              value={qtyTouched ? qty : autoQty ? String(autoQty) : ''}
              onChange={(e) => {
                setQtyTouched(true)
                setQty(e.target.value)
              }}
              className={cn(FIELD, 'tnum')}
            />
          </FormField>
          <FormField label="Tarifa (opcional)" hint="Vacía = tarifa vigente" className="col-span-2 sm:col-span-1">
            <Input data-testid="finished-labor-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={cn(FIELD, 'tnum')} placeholder={current?.rate != null ? `Vigente: ${formatMoney(current.rate)}` : "Tarifa vigente"} />
          </FormField>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-sm bg-brand-50 px-3 py-2">
          <span className="text-[13px] text-brand-900">Valor calculado</span>
          <span className="text-[16px] font-semibold text-brand-900 tnum" data-testid="finished-labor-value">
            {laborValue !== null ? formatMoney(laborValue) : quantity ? 'Según tarifa vigente' : '—'}
          </span>
        </div>
      </div>

      <FormField label="Observaciones">
        <Textarea data-testid="finished-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-[16px] sm:text-[14px]" />
      </FormField>

      <ErrorPanel
        error={m.error}
        testId="finished-error"
        describe={(e) =>
          e.code === 'TECHNICAL_VARIABLES_REQUIRED'
            ? missingList(e, varName)
            : e.code === 'MANDATORY_STAGES_PENDING'
              ? (
                  <>
                    {missingList(e)}
                    <p className="text-[13px]">Sube la evidencia y completa esas etapas arriba.</p>
                  </>
                )
              : e.code === 'STAGE_EVIDENCE_REQUIRED'
                ? <p className="text-[13px]">Sube las fotos/video del producto terminado en la etapa final.</p>
                : e.code === 'IMPLAUSIBLE_FINISHED'
                  ? <p className="text-[13px]">Verifica el peso en la balanza: no puede superar el material entregado.</p>
                  : null
        }
      />

      <Button data-testid="finished-submit" onClick={submit} loading={m.isPending} className={cn(BIG_BTN, 'w-full')}>
        <ClipboardCheck className="size-5" /> {prev ? 'Volver a declarar producto terminado' : 'Declarar producto terminado'}
      </Button>

      <LaborList order={order} />
    </div>
  )
}

function LaborList({ order }: { order: OrderDetail }) {
  if (!order.labor.length) return null
  return (
    <div>
      <p className="eyebrow mb-1.5">Propuestas de mano de obra</p>
      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {order.labor.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div>
              <p className="text-[14px] font-medium text-ink tnum">{formatMoney(l.approvedValue ?? l.proposedValue)}</p>
              <p className="text-[12px] text-ink-muted">{LABOR_BASIS[l.basis] ?? l.basis} · {formatNumber(l.quantity, 2)} × {formatMoney(l.rate)}{l.reviewNotes ? ` · ${l.reviewNotes}` : ''}</p>
            </div>
            <StatusBadge map={APPROVAL_STATUS} value={l.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}
