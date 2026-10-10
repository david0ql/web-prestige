import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Customer, Location } from '@/lib/api/types'
import { useLocations } from '@/lib/hooks/useMasters'
import { usePermission } from '@/lib/auth/store'
import { LOCATION_TYPE } from '@/lib/labels'
import { DataTable } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Combobox } from '@/components/ui/Combobox'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { notify } from '@/components/ui/Toaster'
import { ActiveBadge, FormGrid, Muted, SectionBar, STATUS_OPTIONS, compact, mono, useFormState, useSave } from './shared'

const EDITABLE = ['OTHER', 'TRANSIT', 'CUSTOMER']

/** Ubicaciones lógicas: todo inventario pertenece a una (sección 5). */
export function LocationsTab() {
  const locs = useLocations()
  const [typeFilter, setTypeFilter] = useState('')
  const [editing, setEditing] = useState<Location | 'new' | null>(null)
  const rows = (locs.data ?? []).filter((l) => !typeFilter || l.type === typeFilter)
  return (
    <Card flush>
      <SectionBar
        title="Ubicaciones"
        description="Oficina Madre y custodias de taller se generan automáticamente. Puede crear ubicaciones de tránsito, cliente u otras."
        actions={<Button data-testid="location-new" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva ubicación</Button>}
      >
        <NativeSelect className="w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="Todos los tipos" options={Object.entries(LOCATION_TYPE).map(([value, v]) => ({ value, label: v.label }))} />
      </SectionBar>
      <DataTable
        loading={locs.isLoading}
        rows={rows}
        rowKey={(l) => l.id}
        onRowClick={(l) => (EDITABLE.includes(l.type) ? setEditing(l) : notify.info('Las ubicaciones de Oficina Madre y de taller se administran automáticamente'))}
        columns={[
          { key: 'c', header: 'Código', cell: (l) => <span className={mono}>{l.code}</span> },
          { key: 'n', header: 'Nombre', cell: (l) => l.name },
          { key: 't', header: 'Tipo', cell: (l) => <StatusBadge map={LOCATION_TYPE} value={l.type} /> },
          { key: 'w', header: 'Taller', cell: (l) => (l.workshop ? `${l.workshop.code} · ${l.workshop.name}` : <Muted>—</Muted>), hideOnMobile: true },
          { key: 's', header: 'Estado', cell: (l) => <ActiveBadge status={l.status} /> },
        ]}
      />
      {editing && <LocationModal location={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function LocationModal({ location, onClose }: { location: (Location & { customerId?: string | null }) | null; onClose: () => void }) {
  const canCustomers = usePermission('customers.read')
  const [f, set] = useFormState({ code: location?.code ?? '', name: location?.name ?? '', type: location?.type ?? 'OTHER', customerId: location?.customerId ?? '', status: location?.status ?? 'ACTIVE' })
  const save = useSave(
    () => {
      const body = { code: f.code.trim().toUpperCase(), name: f.name.trim(), type: f.type, customerId: f.type === 'CUSTOMER' && f.customerId ? f.customerId : null, status: f.status }
      return location ? api.patch(`/locations/${location.id}`, body) : api.post('/locations', compact(body))
    },
    [['locations']],
    () => {
      notify.success('Ubicación guardada')
      onClose()
    },
  )
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={location ? 'Editar ubicación' : 'Nueva ubicación'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="location-save" disabled={!f.code || !f.name} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid>
          <FormField label="Código" required><Input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className="font-mono" /></FormField>
          <FormField label="Nombre" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
          <FormField label="Tipo" required>
            <NativeSelect value={f.type} disabled={!!location} onChange={(e) => set('type', e.target.value)} options={EDITABLE.map((t) => ({ value: t, label: LOCATION_TYPE[t].label }))} />
          </FormField>
          <FormField label="Estado"><NativeSelect value={f.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} /></FormField>
        </FormGrid>
        {f.type === 'CUSTOMER' && canCustomers && (
          <FormField label="Cliente" hint="Opcional: ubicación asociada a un cliente">
            <Combobox
              value={f.customerId || null}
              onValueChange={(v) => set('customerId', v ?? '')}
              loadOptions={async (q) => (await api.get<Paginated<Customer>>('/customers', { search: q, pageSize: 20 })).items.map((c) => ({ value: c.id, label: `${c.name} · ${c.documentNumber}` }))}
              placeholder="Buscar cliente…"
            />
          </FormField>
        )}
      </div>
    </Modal>
  )
}
