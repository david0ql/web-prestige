import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Scale } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { InventoryBalance, InventoryMovement } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useLocations, useMaterials } from '@/lib/hooks/useMasters'
import { formatGrams } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { notify } from '@/components/ui/Toaster'
import { materialOptions } from './shared'

/** Saldo y lotes de un material en una ubicación (para orientar el formulario). */
function useLocationStock(materialId: string, locationId: string) {
  return useQuery({
    queryKey: ['inventory', 'balances', 'stock', materialId, locationId],
    queryFn: () => api.get<InventoryBalance[]>('/inventory/balances', { materialId, locationId }),
    enabled: !!materialId && !!locationId,
  })
}

function useInvalidateInventory() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['inventory'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

/** P04 (f) · Ajustes y traslados (permisos inventory.adjust / inventory.transfer). */
export function AdjustmentsTab() {
  const canAdjust = usePermission('inventory.adjust')
  const canTransfer = usePermission('inventory.transfer')
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canAdjust && <AdjustmentForm />}
      {canTransfer && <TransferForm />}
    </div>
  )
}

const emptyAdj = { materialId: '', locationId: '', lotId: '', direction: 'IN', grams: '', reason: '' }

function AdjustmentForm() {
  const { data: materials = [] } = useMaterials()
  const { data: locations = [] } = useLocations()
  const invalidate = useInvalidateInventory()
  const [f, setF] = useState(emptyAdj)
  const stock = useLocationStock(f.materialId, f.locationId)
  const current = (stock.data ?? []).reduce((s, b) => s + b.grams, 0)
  const lots = (stock.data ?? []).filter((b) => b.lot)
  const valid = f.materialId && f.locationId && Number(f.grams) > 0 && f.reason.trim().length >= 5
  const m = useMutation({
    mutationFn: () =>
      api.post<InventoryMovement>('/inventory/adjustments', {
        materialId: f.materialId,
        locationId: f.locationId,
        lotId: f.lotId || undefined,
        direction: f.direction,
        grams: Number(f.grams),
        reason: f.reason.trim(),
      }),
    onSuccess: (mv) => {
      notify.success(`Ajuste ${mv.number} registrado`)
      setF(emptyAdj)
      invalidate()
    },
  })
  return (
    <Card title="Ajuste de inventario" actions={<Scale className="size-4 text-ink-muted" />}>
      <p className="mb-3 text-[12px] text-ink-muted">Corrige diferencias de conteo con motivo obligatorio. Queda auditado y puede reversarse.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Material" required className="sm:col-span-2">
          <NativeSelect data-testid="adjust-material" placeholder="Selecciona…" options={materialOptions(materials)} value={f.materialId} onChange={(e) => setF({ ...f, materialId: e.target.value, lotId: '' })} />
        </FormField>
        <FormField label="Ubicación" required hint={f.materialId && f.locationId ? `Saldo actual: ${formatGrams(current)}` : undefined}>
          <NativeSelect data-testid="adjust-location" placeholder="Selecciona…" options={locations.map((l) => ({ value: l.id, label: l.name }))} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value, lotId: '' })} />
        </FormField>
        <FormField label="Lote">
          <NativeSelect placeholder="Sin lote / automático" options={lots.map((b) => ({ value: b.lot!.id, label: `${b.lot!.code} · ${formatGrams(b.grams)}` }))} value={f.lotId} onChange={(e) => setF({ ...f, lotId: e.target.value })} />
        </FormField>
        <FormField label="Sentido" required>
          <NativeSelect data-testid="adjust-direction" options={[{ value: 'IN', label: 'Entrada (+)' }, { value: 'OUT', label: 'Salida (−)' }]} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })} />
        </FormField>
        <FormField label="Gramos" required>
          <Input data-testid="adjust-grams" type="number" min="0" step="0.0001" value={f.grams} onChange={(e) => setF({ ...f, grams: e.target.value })} />
        </FormField>
        <FormField label="Motivo" required hint="Mínimo 5 caracteres." className="sm:col-span-2">
          <Textarea data-testid="adjust-reason" rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </FormField>
      </div>
      <div className="mt-4 flex justify-end">
        <Button data-testid="adjust-submit" disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>Registrar ajuste</Button>
      </div>
    </Card>
  )
}

const emptyTr = { materialId: '', fromLocationId: '', toLocationId: '', lotId: '', grams: '', reason: '' }

function TransferForm() {
  const { data: materials = [] } = useMaterials()
  const { data: locations = [] } = useLocations()
  const invalidate = useInvalidateInventory()
  const [f, setF] = useState(emptyTr)
  // Hacia talleres solo se entrega mediante despacho (con aceptación digital).
  const options = locations.filter((l) => l.type !== 'WORKSHOP').map((l) => ({ value: l.id, label: l.name }))
  const stock = useLocationStock(f.materialId, f.fromLocationId)
  const available = (stock.data ?? []).reduce((s, b) => s + b.grams, 0)
  const lots = (stock.data ?? []).filter((b) => b.lot)
  const exceeds = !!f.fromLocationId && !!f.materialId && Number(f.grams) > available + 0.00001
  const valid = f.materialId && f.fromLocationId && f.toLocationId && f.fromLocationId !== f.toLocationId && Number(f.grams) > 0 && !exceeds && f.reason.trim().length >= 3
  const m = useMutation({
    mutationFn: () =>
      api.post<InventoryMovement>('/inventory/transfers', {
        materialId: f.materialId,
        fromLocationId: f.fromLocationId,
        toLocationId: f.toLocationId,
        lotId: f.lotId || undefined,
        grams: Number(f.grams),
        reason: f.reason.trim(),
      }),
    onSuccess: (mv) => {
      notify.success(`Traslado ${mv.number} registrado`)
      setF(emptyTr)
      invalidate()
    },
  })
  return (
    <Card title="Traslado entre ubicaciones" actions={<ArrowLeftRight className="size-4 text-ink-muted" />}>
      <p className="mb-3 text-[12px] text-ink-muted">Para ubicaciones internas. Las entregas a talleres se hacen desde Asignación a taller.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Material" required className="sm:col-span-2">
          <NativeSelect data-testid="transfer-material" placeholder="Selecciona…" options={materialOptions(materials)} value={f.materialId} onChange={(e) => setF({ ...f, materialId: e.target.value, lotId: '' })} />
        </FormField>
        <FormField label="Desde" required hint={f.materialId && f.fromLocationId ? `Disponible: ${formatGrams(available)}` : undefined}>
          <NativeSelect data-testid="transfer-from" placeholder="Selecciona…" options={options} value={f.fromLocationId} onChange={(e) => setF({ ...f, fromLocationId: e.target.value, lotId: '' })} />
        </FormField>
        <FormField label="Hacia" required error={f.toLocationId && f.toLocationId === f.fromLocationId ? 'Debe ser distinta del origen' : undefined}>
          <NativeSelect data-testid="transfer-to" placeholder="Selecciona…" options={options} value={f.toLocationId} onChange={(e) => setF({ ...f, toLocationId: e.target.value })} />
        </FormField>
        <FormField label="Lote">
          <NativeSelect placeholder="Automático (FIFO)" options={lots.map((b) => ({ value: b.lot!.id, label: `${b.lot!.code} · ${formatGrams(b.grams)}` }))} value={f.lotId} onChange={(e) => setF({ ...f, lotId: e.target.value })} />
        </FormField>
        <FormField label="Gramos" required error={exceeds ? 'Supera lo disponible en origen (RN-003)' : undefined}>
          <Input data-testid="transfer-grams" type="number" min="0" step="0.0001" value={f.grams} onChange={(e) => setF({ ...f, grams: e.target.value })} />
        </FormField>
        <FormField label="Motivo" required className="sm:col-span-2">
          <Textarea data-testid="transfer-reason" rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </FormField>
      </div>
      <div className="mt-4 flex justify-end">
        <Button data-testid="transfer-submit" disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>Registrar traslado</Button>
      </div>
    </Card>
  )
}
