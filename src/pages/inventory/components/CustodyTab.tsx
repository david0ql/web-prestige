import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, Clock } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Location, Material, MaterialLot, ProductionOrder } from '@/lib/api/types'
import { useWorkshops } from '@/lib/hooks/useMasters'
import { formatDate, formatGrams } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/labels'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card } from '@/components/ui/Card'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { daysSince } from './shared'
import { Filter } from './BalancesTab'

interface Custody {
  location: Location
  totals: { material: Material; lot: MaterialLot | null; grams: number }[]
  byOrder: { productionOrderId: string | null; materialId: string; material: Material; grams: number; since: string | null }[]
}
type ByOrder = Custody['byOrder'][number]

/** P04 (c) · Custodia por taller (RF-006, reporte "Material por taller"). */
export function CustodyTab() {
  const { data: workshops = [] } = useWorkshops()
  const [workshopId, setWorkshopId] = useState('')
  useEffect(() => {
    if (!workshopId && workshops.length) setWorkshopId(workshops[0].id)
  }, [workshops, workshopId])

  const q = useQuery({
    queryKey: ['inventory', 'custody', workshopId],
    queryFn: () => api.get<Custody>(`/inventory/workshops/${workshopId}/custody`),
    enabled: !!workshopId,
  })
  const orders = useQuery({
    queryKey: ['orders', 'by-workshop', workshopId],
    queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { workshopId, pageSize: 200 }),
    enabled: !!workshopId,
  })
  const orderMap = useMemo(() => new Map((orders.data?.items ?? []).map((o) => [o.id, o])), [orders.data])
  const workshop = workshops.find((w) => w.id === workshopId)
  const total = (q.data?.totals ?? []).reduce((s, t) => s + t.grams, 0)

  const columns: Column<ByOrder>[] = [
    {
      key: 'order',
      header: 'Orden',
      cell: (r) => {
        if (!r.productionOrderId) return <Badge variant="neutral">Sin orden</Badge>
        const o = orderMap.get(r.productionOrderId)
        return (
          <Link to="/ordenes/$orderId" params={{ orderId: r.productionOrderId }} className="font-medium text-brand-700 hover:underline">
            {o?.number ?? 'Ver orden'}
          </Link>
        )
      },
    },
    { key: 'product', header: 'Producto', cell: (r) => (r.productionOrderId ? (orderMap.get(r.productionOrderId)?.product.name ?? '—') : '—'), hideOnMobile: true },
    { key: 'status', header: 'Estado orden', cell: (r) => (r.productionOrderId && orderMap.get(r.productionOrderId) ? <StatusBadge map={ORDER_STATUS} value={orderMap.get(r.productionOrderId)!.status} /> : '—'), hideOnMobile: true },
    { key: 'material', header: 'Material', cell: (r) => `${r.material.code} · ${r.material.name}` },
    { key: 'grams', header: 'En custodia', align: 'right', cell: (r) => <span className="font-semibold text-ink">{formatGrams(r.grams)}</span> },
    { key: 'since', header: 'Desde', cell: (r) => formatDate(r.since) },
    {
      key: 'days',
      header: 'Días',
      align: 'right',
      cell: (r) => {
        const d = daysSince(r.since)
        return <span className={d !== null && d > 30 ? 'font-semibold text-warning' : 'text-ink-secondary'}>{d ?? '—'}</span>
      },
    },
  ]

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-3 sm:grid-cols-[320px_1fr] sm:items-end">
          <Filter label="Taller">
            <NativeSelect data-testid="custody-workshop" options={workshops.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} />
          </Filter>
          {workshop && (
            <p className="text-[12px] text-ink-muted sm:text-right">
              Responsable: <b className="font-medium text-ink">{workshop.responsible ?? '—'}</b>
              {workshop.mainProduction && <> · {workshop.mainProduction}</>}
            </p>
          )}
        </div>
      </Card>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {q.data && (
          <>
            {q.data.totals.length === 0 ? (
              <Card>
                <EmptyState icon={Building2} title="El taller no tiene material en custodia" description="Cuando acepte un despacho, el material aparecerá aquí con su orden y fecha." />
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  <div className="rounded-md border border-brand-200 bg-gradient-to-br from-brand-50 to-surface p-4 shadow-card">
                    <p className="eyebrow">Total en custodia</p>
                    <p className="mt-1.5 text-[22px] font-semibold text-ink tnum">{formatGrams(total)}</p>
                    <p className="mt-1 text-[12px] text-ink-muted">{q.data.location.name}</p>
                  </div>
                  {q.data.totals.map((t) => (
                    <div key={`${t.material.id}-${t.lot?.id ?? 'none'}`} className="rounded-md border border-border bg-surface p-4 shadow-card">
                      <p className="eyebrow truncate">{t.material.code}{t.lot ? ` · ${t.lot.code}` : ''}</p>
                      <p className="mt-1.5 text-[20px] font-semibold text-ink tnum">{formatGrams(t.grams)}</p>
                      <p className="mt-1 truncate text-[12px] text-ink-muted">{t.material.name}</p>
                    </div>
                  ))}
                </div>
                <Card flush title="Material por orden" actions={<span className="flex items-center gap-1 text-[12px] text-ink-muted"><Clock className="size-3.5" /> Quién tiene cada gramo y para qué producción</span>}>
                  <DataTable testId="custody-table" columns={columns} rows={q.data.byOrder} rowKey={(r) => `${r.productionOrderId ?? 'none'}-${r.materialId}`} />
                </Card>
              </>
            )}
          </>
        )}
      </QueryState>
    </div>
  )
}
