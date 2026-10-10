import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Paginated } from '@/lib/api/client'
import type { CustomerContribution, CustomerOperation, CustomerPayment, ProductionOrder, Weighing } from '@/lib/api/types'
import { formatGrams, formatMoney, formatPurity, todayIso } from '@/lib/format'
import { TIMING } from '@/lib/labels'
import { useMaterials, usePaymentMethods } from '@/lib/hooks/useMasters'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { notify } from '@/components/ui/Toaster'
import { WeighingCapture } from '@/components/domain/WeighingCapture'
import { ReasonDialog } from '@/components/domain/ReasonDialog'
import { DOC_TYPES, OPERATION_TYPE, type CustomerFull } from './shared'

const num = (v: string) => (v.trim() === '' ? undefined : Number(v))

/** Invalida todo lo relacionado con cuentas de clientes. */
export function useInvalidateAccounts() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['customer-account'] })
    void qc.invalidateQueries({ queryKey: ['customer-operation'] })
    void qc.invalidateQueries({ queryKey: ['customers'] })
    void qc.invalidateQueries({ queryKey: ['report', 'customers'] })
    void qc.invalidateQueries({ queryKey: ['finished-goods'] })
  }
}

/* ------------------------------------------------------------------ */
/* Cliente                                                             */
/* ------------------------------------------------------------------ */

export function CustomerModal({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; customer?: CustomerFull | null; onSaved?: (c: CustomerFull) => void }) {
  const empty = { documentType: 'CC', documentNumber: '', name: '', phone: '', email: '', address: '', city: '', notes: '', status: 'ACTIVE' }
  const [f, setF] = useState(empty)
  useEffect(() => {
    if (open)
      setF(
        customer
          ? { documentType: customer.documentType, documentNumber: customer.documentNumber, name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '', address: customer.address ?? '', city: customer.city ?? '', notes: customer.notes ?? '', status: customer.status }
          : empty,
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer])
  const invalidate = useInvalidateAccounts()
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, phone: f.phone || undefined, email: f.email || undefined, address: f.address || undefined, city: f.city || undefined, notes: f.notes || undefined }
      return customer ? api.patch<CustomerFull>(`/customers/${customer.id}`, body) : api.post<CustomerFull>('/customers', { ...body, status: undefined })
    },
    onSuccess: (c) => {
      notify.success(customer ? 'Cliente actualizado' : `Cliente ${c.name} creado`)
      invalidate()
      onOpenChange(false)
      onSaved?.(c)
    },
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const valid = f.name.trim().length >= 2 && f.documentNumber.trim().length >= 3
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={customer ? 'Editar cliente' : 'Nuevo cliente'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()} data-testid="customer-submit">{customer ? 'Guardar cambios' : 'Crear cliente'}</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nombre o razón social" required className="sm:col-span-2">
          <Input data-testid="customer-name" value={f.name} onChange={set('name')} maxLength={160} />
        </FormField>
        <FormField label="Tipo de documento" required>
          <NativeSelect value={f.documentType} onChange={set('documentType')} options={DOC_TYPES} />
        </FormField>
        <FormField label="Número de documento" required>
          <Input data-testid="customer-document" value={f.documentNumber} onChange={set('documentNumber')} />
        </FormField>
        <FormField label="Teléfono">
          <Input value={f.phone} onChange={set('phone')} maxLength={40} />
        </FormField>
        <FormField label="Correo electrónico">
          <Input type="email" value={f.email} onChange={set('email')} />
        </FormField>
        <FormField label="Dirección">
          <Input value={f.address} onChange={set('address')} maxLength={200} />
        </FormField>
        <FormField label="Ciudad">
          <Input value={f.city} onChange={set('city')} maxLength={80} />
        </FormField>
        {customer && (
          <FormField label="Estado">
            <NativeSelect value={f.status} onChange={set('status')} options={[{ value: 'ACTIVE', label: 'Activo' }, { value: 'INACTIVE', label: 'Inactivo' }]} />
          </FormField>
        )}
        <FormField label="Notas" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={set('notes')} />
        </FormField>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Operación                                                           */
/* ------------------------------------------------------------------ */

const loadOrders = (q: string): Promise<ComboboxOption[]> =>
  api.get<Paginated<ProductionOrder>>('/orders', { search: q, pageSize: 20 }).then((r) => r.items.map((o) => ({ value: o.id, label: `${o.number} · ${o.product?.name ?? ''} · ${o.workshop?.name ?? ''}` })))

export function OperationModal({ open, onOpenChange, customerId, operation, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; customerId: string; operation?: CustomerOperation | null; onSaved?: (o: CustomerOperation) => void }) {
  const empty = { type: 'SALE', description: '', totalValue: '', committedMaterialFineGrams: '', productionOrderId: '', dueDate: '', notes: '' }
  const [f, setF] = useState(empty)
  useEffect(() => {
    if (open)
      setF(
        operation
          ? { type: operation.type, description: operation.description, totalValue: String(operation.totalValue ?? ''), committedMaterialFineGrams: String(operation.committedMaterialFineGrams ?? ''), productionOrderId: operation.productionOrderId ?? '', dueDate: operation.dueDate ?? '', notes: operation.notes ?? '' }
          : empty,
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, operation])
  const invalidate = useInvalidateAccounts()
  const save = useMutation({
    mutationFn: () => {
      const body = {
        type: f.type,
        description: f.description.trim(),
        totalValue: num(f.totalValue) ?? 0,
        committedMaterialFineGrams: num(f.committedMaterialFineGrams) ?? 0,
        productionOrderId: f.productionOrderId || undefined,
        dueDate: f.dueDate || undefined,
        notes: f.notes || undefined,
      }
      return operation ? api.patch<CustomerOperation>(`/customer-operations/${operation.id}`, body) : api.post<CustomerOperation>('/customer-operations', { ...body, customerId })
    },
    onSuccess: (o) => {
      notify.success(operation ? 'Operación actualizada' : `Operación ${o.number} creada`)
      invalidate()
      onOpenChange(false)
      onSaved?.(o)
    },
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={operation ? `Editar ${operation.number}` : 'Nueva operación de cliente'}
      description="Venta o encargo. El valor en dinero y el material comprometido se controlan como saldos separados."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={f.description.trim().length < 3} loading={save.isPending} onClick={() => save.mutate()} data-testid="operation-submit">{operation ? 'Guardar' : 'Crear operación'}</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Tipo" required className="sm:col-span-2">
          <RadioGroup value={f.type} onValueChange={(v: string) => setF((x) => ({ ...x, type: v }))} options={Object.entries(OPERATION_TYPE).map(([value, label]) => ({ value, label }))} orientation="horizontal" />
        </FormField>
        <FormField label="Descripción" required className="sm:col-span-2">
          <Input data-testid="operation-description" value={f.description} onChange={set('description')} maxLength={200} placeholder="p. ej. 3 cadenas Gucci 50 cm" />
        </FormField>
        <FormField label="Valor de la operación (COP)" hint={f.totalValue ? formatMoney(Number(f.totalValue)) : undefined}>
          <Input data-testid="operation-value" type="number" min={0} value={f.totalValue} onChange={set('totalValue')} />
        </FormField>
        <FormField label="Gramos finos comprometidos" hint="Material que el cliente debe aportar (oro fino).">
          <Input data-testid="operation-fine" type="number" min={0} step="0.001" value={f.committedMaterialFineGrams} onChange={set('committedMaterialFineGrams')} />
        </FormField>
        <FormField label="Orden de producción (opcional)">
          <Combobox value={f.productionOrderId || null} onValueChange={(v) => setF((x) => ({ ...x, productionOrderId: v ?? '' }))} loadOptions={loadOrders} placeholder={f.productionOrderId ? 'Orden vinculada' : 'Buscar orden…'} />
        </FormField>
        <FormField label="Vencimiento">
          <Input type="date" value={f.dueDate} onChange={set('dueDate')} />
        </FormField>
        <FormField label="Notas" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={set('notes')} />
        </FormField>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Abono monetario (RF-026)                                            */
/* ------------------------------------------------------------------ */

export function PaymentModal({ open, onOpenChange, customerId, operations, operationId }: { open: boolean; onOpenChange: (o: boolean) => void; customerId: string; operations: CustomerOperation[]; operationId?: string }) {
  const { data: methods } = usePaymentMethods()
  const empty = { operationId: operationId ?? '', amount: '', paymentMethodId: '', paymentDate: todayIso(), reference: '', notes: '' }
  const [f, setF] = useState(empty)
  useEffect(() => {
    if (open) setF({ ...empty, operationId: operationId ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, operationId])
  const invalidate = useInvalidateAccounts()
  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: () =>
      api.post<CustomerPayment>('/customer-payments', {
        customerId,
        operationId: f.operationId || undefined,
        amount: Number(f.amount),
        paymentMethodId: f.paymentMethodId,
        paymentDate: f.paymentDate,
        reference: f.reference || undefined,
        notes: f.notes || undefined,
      }),
    onSuccess: (p) => {
      notify.success(`Abono ${p.number} registrado por ${formatMoney(p.amount)}`)
      invalidate()
      void qc.invalidateQueries({ queryKey: ['finance'] })
      onOpenChange(false)
    },
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const op = operations.find((o) => o.id === f.operationId)
  const valid = Number(f.amount) >= 1 && !!f.paymentMethodId && !!f.paymentDate
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar abono en dinero"
      description="Movimiento monetario independiente del material (RN-016). Genera el ingreso en Caja."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()} data-testid="payment-submit">Registrar abono</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Operación" hint={op?.balances ? `Saldo actual ${formatMoney(op.balances.money.balance)}` : 'Opcional: sin operación queda como abono a cuenta.'} className="sm:col-span-2">
          <NativeSelect data-testid="payment-operation" value={f.operationId} onChange={set('operationId')} options={[{ value: '', label: 'Abono a cuenta (sin operación)' }, ...operations.filter((o) => o.status !== 'CANCELLED').map((o) => ({ value: o.id, label: `${o.number} · ${o.description}` }))]} />
        </FormField>
        <FormField label="Monto (COP)" required hint={f.amount ? formatMoney(Number(f.amount)) : undefined}>
          <Input data-testid="payment-amount" type="number" min={1} value={f.amount} onChange={set('amount')} />
        </FormField>
        <FormField label="Medio de pago" required>
          <NativeSelect data-testid="payment-method" value={f.paymentMethodId} onChange={set('paymentMethodId')} placeholder="Selecciona…" options={(methods ?? []).filter((m) => m.active).map((m) => ({ value: m.id, label: m.name }))} />
        </FormField>
        <FormField label="Fecha" required>
          <Input data-testid="payment-date" type="date" value={f.paymentDate} onChange={set('paymentDate')} />
        </FormField>
        <FormField label="Referencia / soporte">
          <Input data-testid="payment-reference" value={f.reference} onChange={set('reference')} maxLength={120} placeholder="N.º de transferencia, recibo…" />
        </FormField>
        <FormField label="Notas" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={set('notes')} />
        </FormField>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Aporte de material (RF-027, RN-017)                                 */
/* ------------------------------------------------------------------ */

export function ContributionModal({ open, onOpenChange, customerId, operations, operationId }: { open: boolean; onOpenChange: (o: boolean) => void; customerId: string; operations: CustomerOperation[]; operationId?: string }) {
  const { data: materials } = useMaterials()
  const metals = useMemo(
    () => (materials ?? []).filter((m) => m.status === 'ACTIVE' && (m.category?.isPreciousMetal || m.purity)).sort((a, b) => Number(!!b.category?.isPreciousMetal) - Number(!!a.category?.isPreciousMetal) || a.name.localeCompare(b.name)),
    [materials],
  )
  const empty = { operationId: operationId ?? '', materialId: '', declaredPurity: '', verifiedPurity: '', timing: 'BEFORE_FABRICATION', origin: '', contributionDate: todayIso(), pricePerGram: '', notes: '' }
  const [f, setF] = useState(empty)
  const [weighing, setWeighing] = useState<Weighing | null>(null)
  useEffect(() => {
    if (open) {
      setF({ ...empty, operationId: operationId ?? '' })
      setWeighing(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, operationId])
  const invalidate = useInvalidateAccounts()
  const qc = useQueryClient()
  const op = operations.find((o) => o.id === f.operationId)
  const save = useMutation({
    mutationFn: () =>
      api.post<CustomerContribution>('/customer-contributions', {
        customerId,
        operationId: f.operationId,
        materialId: f.materialId,
        weighingId: weighing!.id,
        declaredPurity: Number(f.declaredPurity),
        verifiedPurity: num(f.verifiedPurity),
        timing: f.timing,
        origin: f.origin.trim(),
        contributionDate: f.contributionDate,
        pricePerGram: num(f.pricePerGram),
        productionOrderId: op?.productionOrderId ?? undefined,
        notes: f.notes || undefined,
      }),
    onSuccess: (c) => {
      notify.success(`Aporte ${c.number}: ${formatGrams(c.fineGrams, 3)} finos`)
      invalidate()
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      onOpenChange(false)
    },
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const purity = num(f.verifiedPurity) ?? num(f.declaredPurity)
  const grams = weighing?.currentNetGrams ?? 0
  const fine = purity ? Math.round(((grams * purity) / 1000) * 1000) / 1000 : 0
  const valuation = num(f.pricePerGram) ? fine * Number(f.pricePerGram) : null
  const valid = !!f.operationId && !!f.materialId && !!weighing && Number(f.declaredPurity) >= 1 && Number(f.declaredPurity) <= 1000 && f.origin.trim().length >= 3 && !!f.contributionDate
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar aporte de material del cliente"
      description="Material entregado o abonado por el cliente. Se pesa en la Balanza Madre y conserva trazabilidad separada del dinero (RN-016/017)."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()} data-testid="contribution-submit">Registrar aporte</Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <FormField label="Operación relacionada" required className="sm:col-span-2" hint={op?.balances ? `Comprometido ${formatGrams(op.balances.material.committedFineGrams, 3)} · saldo fino ${formatGrams(op.balances.material.balanceFineGrams, 3)}` : undefined}>
            <NativeSelect data-testid="contribution-operation" value={f.operationId} onChange={set('operationId')} placeholder="Selecciona la operación…" options={operations.filter((o) => o.status !== 'CANCELLED').map((o) => ({ value: o.id, label: `${o.number} · ${o.description}` }))} />
          </FormField>
          <FormField label="Material" required>
            <NativeSelect
              data-testid="contribution-material"
              value={f.materialId}
              onChange={(e) => {
                const m = metals.find((x) => x.id === e.target.value)
                setF((x) => ({ ...x, materialId: e.target.value, declaredPurity: x.declaredPurity || (m?.purity ? String(m.purity) : '') }))
                setWeighing(null)
              }}
              placeholder="Selecciona…"
              options={metals.map((m) => ({ value: m.id, label: `${m.name}${m.purity ? ` · ${formatPurity(m.purity)}` : ''}` }))}
            />
          </FormField>
          <FormField label="Momento del aporte" required>
            <NativeSelect data-testid="contribution-timing" value={f.timing} onChange={set('timing')} options={Object.entries(TIMING).map(([value, label]) => ({ value, label }))} />
          </FormField>
          <FormField label="Ley declarada (‰)" required hint="Milésimas: 999 = 24K, 750 = 18K.">
            <Input data-testid="contribution-declared" type="number" min={1} max={1000} step="0.1" value={f.declaredPurity} onChange={set('declaredPurity')} />
          </FormField>
          <FormField label="Ley verificada (‰)" hint="Si se verificó, prevalece para el cálculo.">
            <Input data-testid="contribution-verified" type="number" min={1} max={1000} step="0.1" value={f.verifiedPurity} onChange={set('verifiedPurity')} />
          </FormField>
          <FormField label="Origen" required className="sm:col-span-2">
            <Input data-testid="contribution-origin" value={f.origin} onChange={set('origin')} maxLength={200} placeholder="p. ej. Joyas usadas del cliente, lingote…" />
          </FormField>
          <FormField label="Fecha" required>
            <Input type="date" value={f.contributionDate} onChange={set('contributionDate')} />
          </FormField>
          <FormField label="Precio por gramo fino (COP)" hint="Opcional, para valoración.">
            <Input data-testid="contribution-price" type="number" min={0} value={f.pricePerGram} onChange={set('pricePerGram')} />
          </FormField>
          <FormField label="Notas" className="sm:col-span-2">
            <Textarea rows={2} value={f.notes} onChange={set('notes')} />
          </FormField>
        </div>
        <div className="space-y-3">
          <WeighingCapture purpose="CUSTOMER_MATERIAL" materialId={f.materialId || null} value={weighing} onCaptured={setWeighing} testId="contribution-weighing" label="Pesaje del material" />
          <div className="rounded-md border border-info/25 bg-info-bg/60 p-3" data-testid="contribution-fine">
            <p className="eyebrow">Gramos finos calculados</p>
            <p className="mt-1 text-[24px] font-semibold tracking-tight text-ink tnum">{formatGrams(fine, 3)}</p>
            <p className="text-[12px] text-ink-muted tnum">
              {formatGrams(grams, 3)} × {purity ? formatPurity(purity) : '— ‰'} / 1000
              {f.verifiedPurity ? ' (ley verificada)' : f.declaredPurity ? ' (ley declarada)' : ''}
            </p>
            {valuation !== null && <p className="mt-1.5 text-[13px] text-ink-secondary">Valoración: <span className="font-semibold text-ink tnum">{formatMoney(valuation)}</span></p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Reverso con motivo                                                  */
/* ------------------------------------------------------------------ */

export function ReverseDialog({ target, onClose, extraInvalidate }: { target: { path: string; label: string } | null; onClose: () => void; extraInvalidate?: () => void }) {
  const invalidate = useInvalidateAccounts()
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: (reason: string) => api.post(target!.path, { reason }),
    onSuccess: () => {
      notify.success(`${target?.label} reversado`)
      invalidate()
      void qc.invalidateQueries({ queryKey: ['finance'] })
      extraInvalidate?.()
      onClose()
    },
  })
  return (
    <ReasonDialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={`Reversar ${target?.label ?? ''}`}
      description="Los movimientos no se eliminan: se genera un reverso auditable (RN-015)."
      confirmLabel="Reversar"
      danger
      loading={m.isPending}
      onConfirm={(r) => m.mutate(r)}
    />
  )
}
