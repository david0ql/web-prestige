import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileText, Paperclip } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Customer, FinancialTransaction, MediaFile } from '@/lib/api/types'
import { formatDateTime, formatMoney, todayIso } from '@/lib/format'
import { useFinanceCategories, usePaymentMethods, useWorkshops } from '@/lib/hooks/useMasters'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { notify } from '@/components/ui/Toaster'
import { MediaUploader } from '@/components/domain/MediaUploader'
import { MediaThumb } from '@/components/domain/MediaMosaic'

export interface TxPreset { type?: 'INCOME' | 'EXPENSE'; categoryCode?: string; workshopId?: string; amount?: number; concept?: string }

const loadCustomers = (q: string): Promise<ComboboxOption[]> =>
  api.get<Paginated<Customer>>('/customers', { search: q, pageSize: 20 }).then((r) => r.items.map((c) => ({ value: c.id, label: `${c.name} · ${c.documentNumber}` })))

/** RF-028 / RN-020 · Nuevo ingreso o egreso con soporte. */
export function TransactionModal({ open, onOpenChange, preset }: { open: boolean; onOpenChange: (o: boolean) => void; preset?: TxPreset | null }) {
  const { data: categories } = useFinanceCategories()
  const { data: methods } = usePaymentMethods()
  const { data: workshops } = useWorkshops()
  const qc = useQueryClient()
  const blank = { type: 'EXPENSE' as 'INCOME' | 'EXPENSE', categoryId: '', concept: '', amount: '', transactionDate: todayIso(), thirdPartyName: '', customerId: '', workshopId: '', paymentMethodId: '', supportReference: '', notes: '' }
  const [f, setF] = useState(blank)
  const [created, setCreated] = useState<FinancialTransaction | null>(null)
  const [uploaded, setUploaded] = useState<MediaFile[]>([])

  useEffect(() => {
    if (!open) return
    const cat = preset?.categoryCode ? categories?.find((c) => c.code === preset.categoryCode) : undefined
    setF({
      ...blank,
      type: preset?.type ?? cat?.type ?? 'EXPENSE',
      categoryId: cat?.id ?? '',
      workshopId: preset?.workshopId ?? '',
      amount: preset?.amount ? String(Math.round(preset.amount)) : '',
      concept: preset?.concept ?? '',
    })
    setCreated(null)
    setUploaded([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset, categories])

  const cats = useMemo(() => (categories ?? []).filter((c) => c.active && c.type === f.type), [categories, f.type])
  const category = categories?.find((c) => c.id === f.categoryId)
  const needsWorkshop = category?.code === 'PAGO_TALLER'

  const save = useMutation({
    mutationFn: () =>
      api.post<FinancialTransaction>('/finance/transactions', {
        type: f.type,
        categoryId: f.categoryId,
        concept: f.concept.trim(),
        amount: Number(f.amount),
        transactionDate: f.transactionDate,
        thirdPartyName: f.thirdPartyName || undefined,
        customerId: f.customerId || undefined,
        workshopId: f.workshopId || undefined,
        paymentMethodId: f.paymentMethodId || undefined,
        supportReference: f.supportReference || undefined,
        notes: f.notes || undefined,
      }),
    onSuccess: (t) => {
      notify.success(`${t.type === 'INCOME' ? 'Ingreso' : 'Egreso'} ${t.number} registrado`)
      void qc.invalidateQueries({ queryKey: ['finance'] })
      setCreated(t)
    },
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const valid = !!f.categoryId && f.concept.trim().length >= 3 && Number(f.amount) >= 1 && !!f.transactionDate && (!needsWorkshop || !!f.workshopId)

  if (created) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={`${created.number} registrado`}
        description="Adjunta el soporte (factura, recibo, comprobante). Puedes hacerlo ahora o más tarde desde la tabla."
        footer={<Button onClick={() => onOpenChange(false)} data-testid="tx-finish">Finalizar</Button>}
      >
        <div className="mb-3 flex items-center gap-2 rounded-md border border-success/30 bg-success-bg px-3 py-2 text-[13px]">
          <CheckCircle2 className="size-4 text-success" />
          <span>{created.concept} · <b className="tnum">{formatMoney(created.amount)}</b></span>
        </div>
        <MediaUploader
          fields={{ purpose: 'FINANCE_SUPPORT', relatedType: 'FinancialTransaction', relatedId: created.id }}
          accept="image/*,application/pdf"
          label="Adjuntar soporte"
          hint="PDF, JPG o PNG · factura, recibo o comprobante"
          onUploaded={(m) => {
            setUploaded((u) => [...u, m])
            notify.success('Soporte adjuntado')
          }}
          testId="tx-support-uploader"
        />
        {uploaded.length > 0 && (
          <ul className="mt-3 space-y-1 text-[13px]">
            {uploaded.map((m) => <li key={m.id} className="flex items-center gap-1.5"><Paperclip className="size-3.5 text-ink-muted" /> {m.originalName}</li>)}
          </ul>
        )}
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva transacción"
      description="Toda transacción requiere fecha, concepto, valor, responsable (automático) y soporte/referencia cuando aplique (RN-020)."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()} data-testid="tx-submit">Registrar</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Tipo" required className="sm:col-span-2">
          <RadioGroup
            orientation="horizontal"
            value={f.type}
            onValueChange={(v) => setF((x) => ({ ...x, type: v as 'INCOME' | 'EXPENSE', categoryId: '' }))}
            options={[{ value: 'INCOME', label: 'Ingreso' }, { value: 'EXPENSE', label: 'Egreso' }]}
          />
        </FormField>
        <FormField label="Categoría" required>
          <NativeSelect data-testid="tx-category" value={f.categoryId} onChange={set('categoryId')} placeholder="Selecciona…" options={cats.map((c) => ({ value: c.id, label: c.name }))} />
        </FormField>
        <FormField label="Valor (COP)" required hint={f.amount ? formatMoney(Number(f.amount)) : undefined}>
          <Input data-testid="tx-amount" type="number" min={1} value={f.amount} onChange={set('amount')} />
        </FormField>
        <FormField label="Concepto" required className="sm:col-span-2">
          <Input data-testid="tx-concept" value={f.concept} onChange={set('concept')} maxLength={200} placeholder="p. ej. Arriendo local octubre" />
        </FormField>
        <FormField label="Fecha" required>
          <Input data-testid="tx-date" type="date" value={f.transactionDate} onChange={set('transactionDate')} />
        </FormField>
        <FormField label="Medio de pago">
          <NativeSelect data-testid="tx-method" value={f.paymentMethodId} onChange={set('paymentMethodId')} placeholder="Selecciona…" options={(methods ?? []).filter((m) => m.active).map((m) => ({ value: m.id, label: m.name }))} />
        </FormField>
        <FormField label="Tercero">
          <Input data-testid="tx-third" value={f.thirdPartyName} onChange={set('thirdPartyName')} maxLength={160} placeholder="Proveedor, beneficiario…" />
        </FormField>
        <FormField label="Taller" required={needsWorkshop} error={needsWorkshop && !f.workshopId ? 'Obligatorio para pagos a taller' : undefined}>
          <NativeSelect data-testid="tx-workshop" value={f.workshopId} onChange={set('workshopId')} options={[{ value: '', label: 'Ninguno' }, ...(workshops ?? []).map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))]} />
        </FormField>
        <FormField label="Cliente (opcional)">
          <Combobox value={f.customerId || null} onValueChange={(v) => setF((x) => ({ ...x, customerId: v ?? '' }))} loadOptions={loadCustomers} placeholder="Buscar cliente…" />
        </FormField>
        <FormField label="Soporte / referencia" hint="N.º de factura, recibo o comprobante. El archivo se adjunta después.">
          <Input data-testid="tx-support" value={f.supportReference} onChange={set('supportReference')} maxLength={160} />
        </FormField>
        <FormField label="Notas" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={set('notes')} />
        </FormField>
      </div>
    </Modal>
  )
}

/** Soportes adjuntos de una transacción (ver / agregar). */
export function SupportsDrawer({ tx, onClose, canUpload }: { tx: FinancialTransaction | null; onClose: () => void; canUpload: boolean }) {
  const qc = useQueryClient()
  const media = useQuery({
    queryKey: ['finance', 'supports', tx?.id],
    queryFn: () => api.get<Paginated<MediaFile>>('/media', { relatedType: 'FinancialTransaction', relatedId: tx!.id, pageSize: 50 }),
    enabled: !!tx,
  })
  return (
    <Drawer open={!!tx} onOpenChange={(o) => !o && onClose()} title={tx ? `Soportes ${tx.number}` : 'Soportes'} description={tx ? `${tx.concept} · ${formatMoney(tx.amount)}${tx.supportReference ? ` · Ref. ${tx.supportReference}` : ''}` : undefined}>
      <div className="space-y-4">
        {canUpload && tx && (
          <MediaUploader
            fields={{ purpose: 'FINANCE_SUPPORT', relatedType: 'FinancialTransaction', relatedId: tx.id }}
            accept="image/*,application/pdf"
            label="Adjuntar soporte"
            hint="PDF, JPG o PNG"
            compact
            onUploaded={() => void qc.invalidateQueries({ queryKey: ['finance', 'supports', tx.id] })}
          />
        )}
        {media.isLoading ? (
          <p className="text-[13px] text-ink-muted">Cargando…</p>
        ) : media.data?.items.length ? (
          <ul className="space-y-2">
            {media.data.items.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                {m.kind === 'PHOTO' ? <MediaThumb m={m} className="size-14 shrink-0" /> : <span className="flex size-14 shrink-0 items-center justify-center rounded bg-sunken"><FileText className="size-6 text-ink-muted" /></span>}
                <div className="min-w-0 flex-1 text-[13px]">
                  <a href={m.urls.original} target="_blank" rel="noreferrer" className="block truncate font-medium text-brand-700 hover:underline">{m.originalName}</a>
                  <p className="text-[12px] text-ink-muted">{formatDateTime(m.capturedAt)}{m.uploadedBy ? ` · ${m.uploadedBy.fullName}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-sunken px-3 py-6 text-center text-[13px] text-ink-muted">Sin soportes adjuntos.</p>
        )}
      </div>
    </Drawer>
  )
}
