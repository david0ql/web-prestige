import { useState } from 'react'
import { Lock, Plus } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { FinanceCategory, PaymentMethod } from '@/lib/api/types'
import { useFinanceCategories, usePaymentMethods } from '@/lib/hooks/useMasters'
import { DataTable } from '@/components/domain/DataTable'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { notify } from '@/components/ui/Toaster'
import { ActiveBadge, FormGrid, SectionBar, YesNo, mono, useFormState, useSave } from './shared'

const TYPE: Record<string, string> = { INCOME: 'Ingreso', EXPENSE: 'Egreso' }
const codeClean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9_]/g, '_')

/** Medios de pago y categorías financieras (maestros de finanzas). */
export function FinanceMastersTab() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_3fr]">
      <PaymentMethods />
      <FinanceCategories />
    </div>
  )
}

function PaymentMethods() {
  const q = usePaymentMethods()
  const [editing, setEditing] = useState<PaymentMethod | 'new' | null>(null)
  return (
    <Card flush>
      <SectionBar title="Medios de pago" actions={<Button size="sm" variant="secondary" data-testid="payment-method-new" onClick={() => setEditing('new')}><Plus className="size-3.5" /> Nuevo</Button>} />
      <DataTable
        dense
        loading={q.isLoading}
        rows={q.data}
        rowKey={(m) => m.id}
        onRowClick={setEditing}
        columns={[
          { key: 'c', header: 'Código', cell: (m) => <span className={mono}>{m.code}</span> },
          { key: 'n', header: 'Nombre', cell: (m) => m.name },
          { key: 'a', header: 'Estado', cell: (m) => <ActiveBadge active={m.active} /> },
        ]}
      />
      {editing && <PaymentMethodModal method={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function PaymentMethodModal({ method, onClose }: { method: PaymentMethod | null; onClose: () => void }) {
  const [f, set] = useFormState({ code: method?.code ?? '', name: method?.name ?? '', active: method?.active ?? true })
  const save = useSave(
    () => (method ? api.patch(`/payment-methods/${method.id}`, { code: f.code, name: f.name.trim(), active: f.active }) : api.post('/payment-methods', { code: f.code, name: f.name.trim(), active: f.active })),
    [['payment-methods']],
    () => {
      notify.success('Medio de pago guardado')
      onClose()
    },
  )
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={method ? 'Editar medio de pago' : 'Nuevo medio de pago'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!/^[A-Z0-9_]{1,20}$/.test(f.code) || !f.name.trim()} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid>
          <FormField label="Código" required><Input value={f.code} maxLength={20} onChange={(e) => set('code', codeClean(e.target.value))} className="font-mono" /></FormField>
          <FormField label="Nombre" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
        </FormGrid>
        <Switch checked={f.active} onCheckedChange={(v) => set('active', v)} label="Activo" />
      </div>
    </Modal>
  )
}

function FinanceCategories() {
  const q = useFinanceCategories()
  const [editing, setEditing] = useState<FinanceCategory | 'new' | null>(null)
  return (
    <Card flush>
      <SectionBar title="Categorías financieras" description="Las categorías de sistema conservan código y tipo (las usa la contabilización automática)." actions={<Button size="sm" variant="secondary" data-testid="finance-category-new" onClick={() => setEditing('new')}><Plus className="size-3.5" /> Nueva</Button>} />
      <DataTable
        dense
        loading={q.isLoading}
        rows={q.data}
        rowKey={(c) => c.id}
        onRowClick={setEditing}
        columns={[
          { key: 'c', header: 'Código', cell: (c) => <span className="flex items-center gap-1"><span className={mono}>{c.code}</span>{c.isSystem && <Lock className="size-3 text-ink-muted" aria-label="Sistema" />}</span> },
          { key: 'n', header: 'Nombre', cell: (c) => c.name },
          { key: 't', header: 'Tipo', cell: (c) => <Badge variant={c.type === 'INCOME' ? 'success' : 'warning'}>{TYPE[c.type]}</Badge> },
          { key: 'o', header: 'Gasto operativo', cell: (c) => <YesNo value={c.isOperatingExpense} /> },
          { key: 'a', header: 'Estado', cell: (c) => <ActiveBadge active={c.active} /> },
        ]}
      />
      {editing && <FinanceCategoryModal cat={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function FinanceCategoryModal({ cat, onClose }: { cat: FinanceCategory | null; onClose: () => void }) {
  const [f, set] = useFormState({ code: cat?.code ?? '', name: cat?.name ?? '', type: cat?.type ?? 'EXPENSE', isOperatingExpense: cat?.isOperatingExpense ?? false, active: cat?.active ?? true })
  const system = !!cat?.isSystem
  const save = useSave(
    () => {
      const body = system ? { name: f.name.trim(), isOperatingExpense: f.isOperatingExpense, active: f.active } : { code: f.code, name: f.name.trim(), type: f.type, isOperatingExpense: f.type === 'EXPENSE' && f.isOperatingExpense, active: f.active }
      return cat ? api.patch(`/finance-categories/${cat.id}`, body) : api.post('/finance-categories', body)
    },
    [['finance-categories']],
    () => {
      notify.success('Categoría guardada')
      onClose()
    },
  )
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={cat ? 'Editar categoría financiera' : 'Nueva categoría financiera'} description={system ? 'Categoría de sistema: código y tipo bloqueados.' : undefined} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!/^[A-Z0-9_]{1,30}$/.test(f.code) || !f.name.trim()} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid>
          <FormField label="Código" required><Input value={f.code} disabled={system} maxLength={30} onChange={(e) => set('code', codeClean(e.target.value))} className="font-mono" /></FormField>
          <FormField label="Nombre" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
          <FormField label="Tipo" required>
            <NativeSelect value={f.type} disabled={system} onChange={(e) => set('type', e.target.value as FinanceCategory['type'])} options={Object.entries(TYPE).map(([value, label]) => ({ value, label }))} />
          </FormField>
        </FormGrid>
        <div className="flex flex-wrap gap-5">
          <Switch checked={f.isOperatingExpense} disabled={f.type !== 'EXPENSE'} onCheckedChange={(v) => set('isOperatingExpense', v)} label="Gasto operativo (rentabilidad neta)" />
          <Switch checked={f.active} onCheckedChange={(v) => set('active', v)} label="Activa" />
        </div>
      </div>
    </Modal>
  )
}
