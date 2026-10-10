import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Inbox } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { MaterialDispatch } from '@/lib/api/types'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { DispatchCard } from './components/shared'

/** Entregas de material recibidas por el taller: por confirmar y respondidas (RF-011). */
export default function WorkshopDispatchesPage() {
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const q = useQuery({ queryKey: ['dispatches', 'workshop'], queryFn: () => api.get<Paginated<MaterialDispatch>>('/dispatches', { pageSize: 200 }) })
  const items = q.data?.items ?? []
  const pending = items.filter((d) => d.status === 'PENDING_ACCEPTANCE')
  const done = items.filter((d) => d.status !== 'PENDING_ACCEPTANCE')
  const list = tab === 'pending' ? pending : done

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader code="P08" title="Entregas de material" description="Confirma el material que Oficina Madre te envió: revisa el peso, acepta el compromiso y firma." />
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-border bg-sunken p-1" role="tablist">
        {(
          [
            ['pending', `Por confirmar (${pending.length})`],
            ['done', `Respondidas (${done.length})`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            data-testid={`dispatches-tab-${k}`}
            onClick={() => setTab(k)}
            className={cn('h-11 rounded-sm text-[14px] font-semibold transition-colors sm:h-9', tab === k ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink')}
          >
            {l}
          </button>
        ))}
      </div>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {list.length ? (
          <div className="space-y-2" data-testid="workshop-dispatch-list">
            {list.map((d) => (
              <DispatchCard key={d.id} dispatch={d} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-surface">
            {tab === 'pending' ? (
              <EmptyState icon={CheckCircle2} title="No tienes entregas por confirmar" description="Cuando Oficina Madre te envíe material aparecerá aquí." />
            ) : (
              <EmptyState icon={Inbox} title="Sin entregas respondidas" />
            )}
          </div>
        )}
      </QueryState>
    </div>
  )
}
