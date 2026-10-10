import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSearch, Plus } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { MaterialRequest, ProductionOrder } from '@/lib/api/types'
import { formatDateTime, formatGrams } from '@/lib/format'
import { APPROVAL_STATUS } from '@/lib/labels'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { cn } from '@/lib/cn'
import { BIG_BTN, FIELD } from './components/shared'
import { RequestForm, DeviationNote } from './components/RequestForm'

const REQUESTABLE = ['DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'REJECTED_ADJUSTMENT']

/** Solicitudes de material adicional del taller (RF-015/016). */
export default function WorkshopRequestsPage() {
  const [showForm, setShowForm] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [status, setStatus] = useState('')
  const q = useQuery({ queryKey: ['material-requests', 'workshop', status], queryFn: () => api.get<Paginated<MaterialRequest>>('/material-requests', { pageSize: 200, status: status || undefined }) })
  const orders = useQuery({ queryKey: ['orders', 'workshop'], queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { pageSize: 200 }) })
  const openOrders = useMemo(() => (orders.data?.items ?? []).filter((o) => REQUESTABLE.includes(o.status)), [orders.data])
  const order = openOrders.find((o) => o.id === orderId) ?? null

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Solicitudes de material"
        description="Pide material adicional indicando cantidad y motivo. Se compara con el consumo estándar de la orden."
        actions={!showForm && <Button data-testid="request-new" onClick={() => setShowForm(true)} className={BIG_BTN}><Plus className="size-5" /> Nueva solicitud</Button>}
      />

      {showForm && (
        <Card className="mb-5">
          <h2 className="mb-3 text-[17px] font-semibold text-ink">Nueva solicitud</h2>
          <FormField label="Orden" hint="Opcional: sin orden la solicitud queda para custodia general del taller." className="mb-4">
            <NativeSelect
              data-testid="request-order"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Sin orden (material general)"
              options={openOrders.map((o) => ({ value: o.id, label: `${o.number} · ${o.product.name}` }))}
              className={FIELD}
            />
          </FormField>
          <RequestForm key={orderId} order={order} onDone={() => undefined} onCancel={() => setShowForm(false)} />
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-ink">Mis solicitudes</h2>
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Todos los estados"
          options={['PENDING', 'APPROVED', 'DISPATCHED', 'REJECTED', 'CANCELLED'].map((s) => ({ value: s, label: APPROVAL_STATUS[s]?.label ?? s }))}
          className={cn(FIELD, 'w-48')}
        />
      </div>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {q.data?.items.length ? (
          <div className="space-y-2" data-testid="workshop-request-list">
            {q.data.items.map((r) => (
              <div key={r.id} className="rounded-md border border-border bg-surface p-3.5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">{r.material.name} · {formatGrams(r.grams)}</p>
                    <p className="text-[12px] text-ink-muted">{r.number} · {r.order ? `${r.order.number} · ${r.order.product.name}` : 'Sin orden'} · {formatDateTime(r.createdAt)}</p>
                  </div>
                  <StatusBadge map={APPROVAL_STATUS} value={r.status} />
                </div>
                <p className="mt-1.5 text-[14px] text-ink-secondary">{r.reason}</p>
                {r.orderId && <DeviationNote r={r} className="mt-2" />}
                {r.reviewNotes && <p className="mt-2 rounded-sm bg-sunken px-2.5 py-1.5 text-[13px] text-ink-secondary">Respuesta de Oficina Madre: {r.reviewNotes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-surface">
            <EmptyState icon={FileSearch} title="No tienes solicitudes" description="Crea una solicitud si necesitas material adicional para tus órdenes." />
          </div>
        )}
      </QueryState>
    </div>
  )
}
