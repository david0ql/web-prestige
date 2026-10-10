import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Scale, XCircle } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Discrepancy, ProductionOrder } from '@/lib/api/types'
import { useWorkshops } from '@/lib/hooks/useMasters'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { DISCREPANCY_TYPE } from '@/lib/labels'
import { formatGrams } from '@/lib/format'
import { PageHeader } from '@/components/domain/PageHeader'
import { Stat } from '@/components/domain/Stat'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { SearchInput } from '@/components/ui/SearchInput'
import { DiscrepancyTable } from '@/pages/orders/components/DiscrepancyTable'

const PAGE_SIZE = 25

/** Mermas y diferencias (RF-022, RN-010, CA-008). */
export default function DiscrepanciesPage() {
  const workshops = useWorkshops()
  const [status, setStatus] = useState('PENDING')
  const [type, setType] = useState('')
  const [workshopId, setWorkshopId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search, 300)
  const params = { status, type, workshopId, search: q, page, pageSize: PAGE_SIZE }
  const list = useQuery({ queryKey: ['discrepancies', 'list', params], queryFn: () => api.get<Paginated<Discrepancy>>('/discrepancies', params), placeholderData: keepPreviousData })
  const all = useQuery({ queryKey: ['discrepancies', 'all'], queryFn: () => api.get<Paginated<Discrepancy>>('/discrepancies', { pageSize: 200 }) })
  const orders = useQuery({ queryKey: ['orders', 'summary'], queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { pageSize: 200 }) })

  const stats = useMemo(() => {
    const items = all.data?.items ?? []
    const pending = items.filter((d) => d.status === 'PENDING')
    return {
      pending: pending.length,
      pendingGrams: pending.reduce((s, d) => s + Math.abs(d.grams), 0),
      unjustified: pending.filter((d) => !d.justification).length,
      outOfTol: items.filter((d) => !d.withinTolerance && d.status !== 'REJECTED').length,
      approvedLoss: items.filter((d) => d.status === 'APPROVED' && d.grams > 0).reduce((s, d) => s + d.grams, 0),
      rejected: items.filter((d) => d.status === 'REJECTED').length,
    }
  }, [all.data])

  const set = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
  }

  return (
    <div>
      <PageHeader title="Mermas y diferencias" description="Toda diferencia de peso debe tener tipo, cantidad, motivo, responsable y aprobación antes de cerrar la orden (RN-010)." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={AlertTriangle} tone={stats.pending ? 'warning' : 'default'} label="Pendientes" value={stats.pending} hint={`${formatGrams(stats.pendingGrams)} en juego`} />
        <Stat icon={Scale} tone={stats.unjustified ? 'danger' : 'default'} label="Sin justificar" value={stats.unjustified} hint="Requieren justificación" />
        <Stat icon={XCircle} label="Fuera de tolerancia" value={stats.outOfTol} hint={`${stats.rejected} rechazada(s)`} />
        <Stat icon={CheckCircle2} label="Merma aprobada" value={formatGrams(stats.approvedLoss)} hint="Acumulado contabilizado" />
      </div>
      <Card flush>
        <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
          <SearchInput value={search} onValueChange={set(setSearch)} placeholder="Buscar número o motivo…" className="lg:w-64" />
          <div className="lg:w-44">
            <NativeSelect
              data-testid="disc-filter-status"
              value={status}
              onChange={(e) => set(setStatus)(e.target.value)}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'PENDING', label: 'Pendientes' },
                { value: 'APPROVED', label: 'Aprobadas' },
                { value: 'REJECTED', label: 'Rechazadas' },
              ]}
            />
          </div>
          <div className="lg:w-52">
            <NativeSelect value={type} onChange={(e) => set(setType)(e.target.value)} options={[{ value: '', label: 'Todos los tipos' }, ...Object.entries(DISCREPANCY_TYPE).map(([value, x]) => ({ value, label: x.label }))]} />
          </div>
          <div className="lg:w-44">
            <NativeSelect value={workshopId} onChange={(e) => set(setWorkshopId)(e.target.value)} options={[{ value: '', label: 'Todos los talleres' }, ...(workshops.data ?? []).map((w) => ({ value: w.id, label: w.name }))]} />
          </div>
          {(status !== 'PENDING' || type || workshopId || search) && (
            <Button variant="ghost" size="sm" className="lg:ml-auto" onClick={() => { setStatus('PENDING'); setType(''); setWorkshopId(''); setSearch(''); setPage(1) }}>
              Restablecer
            </Button>
          )}
        </div>
        <DiscrepancyTable
          rows={list.data?.items}
          loading={list.isLoading}
          orderLabel={(id) => orders.data?.items.find((o) => o.id === id)?.number ?? null}
          workshopLabel={(id) => workshops.data?.find((w) => w.id === id)?.name ?? null}
          emptyTitle={status === 'PENDING' ? 'No hay diferencias pendientes' : 'Sin diferencias para los filtros'}
          pagination={list.data ? { page, pageSize: PAGE_SIZE, total: list.data.total, onPageChange: setPage } : undefined}
        />
      </Card>
    </div>
  )
}
