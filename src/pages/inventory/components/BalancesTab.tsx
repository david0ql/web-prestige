import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { InventoryBalance } from '@/lib/api/types'
import { useMaterials, useWorkshops } from '@/lib/hooks/useMasters'
import { formatDateTime, formatGrams, formatPurity } from '@/lib/format'
import { LOCATION_TYPE } from '@/lib/labels'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { QueryState } from '@/components/domain/QueryState'
import { Card } from '@/components/ui/Card'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Button } from '@/components/ui/Button'
import { locationTypeOptions, materialOptions } from './shared'

/** P04 (b) · Existencias por material, ubicación y lote. */
export function BalancesTab() {
  const { data: materials = [] } = useMaterials()
  const { data: workshops = [] } = useWorkshops()
  const [f, setF] = useState({ materialId: '', locationType: '', workshopId: '' })
  const q = useQuery({
    queryKey: ['inventory', 'balances', f],
    queryFn: () => api.get<InventoryBalance[]>('/inventory/balances', { materialId: f.materialId, locationType: f.locationType, workshopId: f.workshopId }),
  })
  const rows = q.data ?? []
  const total = rows.reduce((s, r) => s + r.grams, 0)
  const singleMaterial = new Set(rows.map((r) => r.material.id)).size === 1

  const columns: Column<InventoryBalance>[] = [
    {
      key: 'material',
      header: 'Material',
      cell: (r) => (
        <div>
          <p className="font-medium text-ink">{r.material.name}</p>
          <p className="text-[11px] text-ink-muted">{r.material.code} · {r.material.category?.name}</p>
        </div>
      ),
    },
    { key: 'location', header: 'Ubicación', cell: (r) => r.location.name },
    { key: 'type', header: 'Tipo', cell: (r) => <StatusBadge map={LOCATION_TYPE} value={r.location.type} /> },
    { key: 'lot', header: 'Lote', cell: (r) => (r.lot ? <span className="font-medium">{r.lot.code}</span> : <span className="text-ink-muted">Sin lote</span>) },
    { key: 'purity', header: 'Ley', align: 'right', cell: (r) => formatPurity(r.lot?.purity ?? r.material.purity), hideOnMobile: true },
    { key: 'grams', header: 'Gramos', align: 'right', cell: (r) => <span className={r.grams < 0 ? 'font-semibold text-danger' : 'font-semibold text-ink'}>{formatGrams(r.grams)}</span> },
    { key: 'last', header: 'Último movimiento', cell: (r) => <span className="text-ink-secondary">{formatDateTime(r.lastMovementAt)}</span>, hideOnMobile: true },
  ]

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_200px_auto] sm:items-end">
          <Filter label="Material">
            <NativeSelect data-testid="balances-material" placeholder="Todos los materiales" options={materialOptions(materials)} value={f.materialId} onChange={(e) => setF({ ...f, materialId: e.target.value })} />
          </Filter>
          <Filter label="Tipo de ubicación">
            <NativeSelect data-testid="balances-location-type" placeholder="Todas" options={locationTypeOptions} value={f.locationType} onChange={(e) => setF({ ...f, locationType: e.target.value })} />
          </Filter>
          <Filter label="Taller">
            <NativeSelect data-testid="balances-workshop" placeholder="Todos" options={workshops.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} value={f.workshopId} onChange={(e) => setF({ ...f, workshopId: e.target.value })} />
          </Filter>
          <Button variant="ghost" onClick={() => setF({ materialId: '', locationType: '', workshopId: '' })}>Limpiar</Button>
        </div>
      </Card>
      <QueryState isLoading={false} error={q.error} onRetry={() => void q.refetch()}>
        <Card flush>
          <DataTable
            testId="balances-table"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            loading={q.isLoading}
            empty={{ title: 'Sin existencias para los filtros', description: 'Solo se muestran saldos distintos de cero.' }}
            footer={
              rows.length > 0 ? (
                <tr className="border-t border-border bg-sunken/40">
                  <td colSpan={5} className="px-3 py-2 text-right text-[12px] text-ink-muted">
                    {rows.length} saldos{singleMaterial ? '' : ' · suma de materiales distintos (referencial)'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-ink tnum">{formatGrams(total)}</td>
                  <td className="hidden md:table-cell" />
                </tr>
              ) : undefined
            }
          />
        </Card>
      </QueryState>
    </div>
  )
}

export function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}
