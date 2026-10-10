import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { ProductionOrder } from '@/lib/api/types'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { OrderCard, isOpenOrder, isOverdue } from './components/shared'

type Filter = 'open' | 'overdue' | 'closed'

/** Mis órdenes de producción (RN-014: solo las asignadas al taller). */
export default function WorkshopOrdersPage() {
  const [filter, setFilter] = useState<Filter>('open')
  const q = useQuery({ queryKey: ['orders', 'workshop'], queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { pageSize: 200 }) })
  const items = q.data?.items ?? []
  const open = items.filter((o) => isOpenOrder(o.status))
  const overdue = items.filter(isOverdue)
  const closed = items.filter((o) => !isOpenOrder(o.status))
  const list = (filter === 'open' ? open : filter === 'overdue' ? overdue : closed).slice().sort((a, b) => a.commitmentDate.localeCompare(b.commitmentDate) * (filter === 'closed' ? -1 : 1))

  const tabs: [Filter, string][] = [
    ['open', `Abiertas (${open.length})`],
    ['overdue', `Retrasadas (${overdue.length})`],
    ['closed', `Cerradas (${closed.length})`],
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader code="P09" title="Mis órdenes" description="Toca una orden para registrar avance, consumos, evidencias y el producto terminado." />
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-md border border-border bg-sunken p-1" role="tablist">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            data-testid={`orders-filter-${k}`}
            onClick={() => setFilter(k)}
            className={cn('h-11 rounded-sm text-[13px] font-semibold transition-colors sm:h-9 sm:text-[14px]', filter === k ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink', k === 'overdue' && overdue.length > 0 && filter !== k && 'text-danger')}
          >
            {l}
          </button>
        ))}
      </div>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {list.length ? (
          <div className="space-y-2" data-testid="workshop-order-list">
            {list.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-surface">
            <EmptyState icon={ClipboardList} title={filter === 'closed' ? 'Sin órdenes cerradas' : filter === 'overdue' ? 'No tienes órdenes retrasadas' : 'No tienes órdenes abiertas'} />
          </div>
        )}
      </QueryState>
    </div>
  )
}
