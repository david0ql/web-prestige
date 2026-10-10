import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { Product, TechnicalVariable } from '@/lib/api/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { FormField } from '@/components/ui/FormField'
import { Switch } from '@/components/ui/Switch'
import { notify } from '@/components/ui/Toaster'
import { SHEET_FIELDS, diffSheets, type Sheet, type SheetNumKey } from './sheet'

const toNum = (s: string) => {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

/** Nueva versión de ficha técnica (RN-023): precargada con la vigente, motivo obligatorio. */
export function SheetFormModal({ product, current, variables, onClose, onCreated }: { product: Product; current: Sheet | null; variables: TechnicalVariable[]; onClose: () => void; onCreated: (s: Sheet) => void }) {
  const qc = useQueryClient()
  const numKeys = SHEET_FIELDS.filter((f) => f.key !== 'measures') as { key: SheetNumKey; label: string; unit?: string }[]
  const [nums, setNums] = useState<Record<SheetNumKey, string>>(() => {
    const base = { ...current, targetPurity: current?.targetPurity ?? product.targetPurity, purityTolerance: current?.purityTolerance ?? product.purityTolerance, standardWeight: current?.standardWeight ?? product.standardWeight }
    return Object.fromEntries(numKeys.map((f) => [f.key, str(base[f.key] as number | null | undefined)])) as Record<SheetNumKey, string>
  })
  const [measures, setMeasures] = useState(current?.measures ?? '')
  const [notes, setNotes] = useState(current?.notes ?? '')
  const [reason, setReason] = useState('')
  const [vars, setVars] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(variables.map((v) => {
      const raw = current?.variables?.[v.code]
      return [v.code, v.dataType === 'BOOLEAN' ? raw === true : raw === undefined || raw === null ? '' : String(raw)]
    })),
  )
  const [touched, setTouched] = useState(false)

  const parsed = Object.fromEntries(numKeys.map((f) => [f.key, toNum(nums[f.key])])) as Record<SheetNumKey, number | null>
  const badNum = numKeys.find((f) => Number.isNaN(parsed[f.key]))
  const varValues = Object.fromEntries(
    variables.map((v) => {
      const raw = vars[v.code]
      if (v.dataType === 'BOOLEAN') return [v.code, raw === true]
      if (v.dataType === 'NUMBER') return [v.code, raw === '' ? null : Number(String(raw).replace(',', '.'))]
      return [v.code, raw === '' ? null : String(raw)]
    }).filter(([, val]) => val !== null),
  ) as Record<string, string | number | boolean>
  const reasonError = reason.trim().length < 3 ? 'Indique el motivo del cambio (mín. 3 caracteres)' : undefined

  const preview: Sheet = { ...(current ?? ({} as Sheet)), ...parsed, measures: measures.trim() || null, notes: notes.trim() || null, variables: varValues }
  const changes = current ? diffSheets(current, preview, variables).filter((r) => r.changed) : []

  const save = useMutation({
    mutationFn: () =>
      api.post<Sheet>(`/catalog/products/${product.id}/sheets`, {
        ...Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== null)),
        measures: measures.trim() || undefined,
        notes: notes.trim() || undefined,
        variables: varValues,
        changeReason: reason.trim(),
      }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      notify.success(`Versión v${s.versionNumber} creada. Las órdenes existentes conservan su versión.`)
      onCreated(s)
      onClose()
    },
  })

  return (
    <Modal open size="xl" onOpenChange={(o) => !o && onClose()} title={`Nueva versión de ficha · ${product.code}`} description={`Se creará la versión v${(product.currentSheetVersion ?? 0) + 1}. Las versiones anteriores no se modifican (RN-023).`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="sheet-save" loading={save.isPending} onClick={() => { setTouched(true); if (!reasonError && !badNum) save.mutate() }}>Crear versión</Button>
      </>
    }>
      <div className="space-y-4">
        <section>
          <h3 className="eyebrow mb-2">Medidas y peso</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {numKeys.map((f) => (
              <FormField key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`} error={touched && Number.isNaN(parsed[f.key]) ? 'Número inválido' : undefined}>
                <Input data-testid={`sheet-${f.key}`} inputMode="decimal" value={nums[f.key]} onChange={(e) => setNums((n) => ({ ...n, [f.key]: e.target.value }))} />
              </FormField>
            ))}
          </div>
          <FormField label="Medidas (texto libre)" className="mt-3">
            <Input data-testid="sheet-measures" value={measures} maxLength={500} onChange={(e) => setMeasures(e.target.value)} placeholder="p. ej. Talla 7 · ancho 4 mm" />
          </FormField>
        </section>
        {variables.length > 0 && (
          <section>
            <h3 className="eyebrow mb-2">Variables técnicas</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {variables.map((v) => {
                const label = `${v.name}${v.unit ? ` (${v.unit})` : ''}`
                if (v.dataType === 'BOOLEAN')
                  return <div key={v.id} className="flex items-end pb-1.5"><Switch checked={vars[v.code] === true} onCheckedChange={(c) => setVars((s) => ({ ...s, [v.code]: c }))} label={label} /></div>
                if (v.dataType === 'SELECT')
                  return (
                    <FormField key={v.id} label={label}>
                      <NativeSelect data-testid={`sheet-var-${v.code}`} value={String(vars[v.code] ?? '')} onChange={(e) => setVars((s) => ({ ...s, [v.code]: e.target.value }))} placeholder="—" options={v.options.map((o) => ({ value: o, label: o }))} />
                    </FormField>
                  )
                return (
                  <FormField key={v.id} label={label}>
                    <Input data-testid={`sheet-var-${v.code}`} inputMode={v.dataType === 'NUMBER' ? 'decimal' : undefined} value={String(vars[v.code] ?? '')} onChange={(e) => setVars((s) => ({ ...s, [v.code]: e.target.value }))} />
                  </FormField>
                )
              })}
            </div>
          </section>
        )}
        <FormField label="Notas técnicas"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
        <FormField label="Motivo del cambio" required error={touched ? reasonError : undefined} hint="Queda registrado en el historial de versiones con su autor y fecha.">
          <Textarea data-testid="sheet-reason" rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        {current && (
          <div className="rounded-md border border-border bg-sunken/50 px-3 py-2.5 text-[12px]">
            <p className="mb-1 font-semibold text-ink">Cambios respecto a v{current.versionNumber}</p>
            {changes.length === 0 ? (
              <p className="text-ink-muted">Sin cambios en los valores (la versión se creará igual con el motivo indicado).</p>
            ) : (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {changes.map((c) => (
                  <li key={c.key}><span className="text-ink-secondary">{c.label}:</span> <span className="text-ink-muted line-through">{c.before}</span> → <b className="text-brand-800">{c.after}</b></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
