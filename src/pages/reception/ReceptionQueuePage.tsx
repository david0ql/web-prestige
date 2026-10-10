import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowRight, Gem, PackageCheck, Scale, SearchCheck } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { FinishedGood, ProductionOrder } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { FINISHED_STATUS, ORDER_STATUS, PURITY, QUALITY } from '@/lib/labels'
import { formatDate, formatGrams, formatMoney, formatNumber, formatPurity } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Stat } from '@/components/domain/Stat'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { SearchInput } from '@/components/ui/SearchInput'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { daysToCommitment, isOverdue } from '@/pages/orders/components/orderUtils'

const TO_RECEIVE = ['FINISHED_BY_WORKSHOP', 'PARTIAL', 'IN_PRODUCTION', 'ACCEPTED_BY_WORKSHOP']
const IN_REVIEW = ['IN_REVIEW', 'REJECTED_ADJUSTMENT']

/** P11 · Bandeja de recepción y control de calidad / ley. */
export default function ReceptionQueuePage() {
  const canFG = usePermission('inventory.read', 'sales.manage')
  const orders = useQuery({ queryKey: ['orders', 'reception-queue'], queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { status: [...TO_RECEIVE, ...IN_REVIEW], pageSize: 200 }) })
  const allFg = useQuery({ queryKey: ['finished-goods', 'all'], queryFn: () => api.get<Paginated<FinishedGood>>('/finished-goods', { pageSize: 200 }), enabled: canFG })
  const items = orders.data?.items ?? []
  const fgByOrder = useMemo(() => {
    const m = new Map<string, FinishedGood[]>()
    for (const f of allFg.data?.items ?? []) m.set(f.orderId, [...(m.get(f.orderId) ?? []), f])
    return m
  }, [allFg.data])

  const priority = (o: ProductionOrder) => (o.status === 'FINISHED_BY_WORKSHOP' ? 0 : o.status === 'PARTIAL' ? 1 : 2)
  const toReceive = items.filter((o) => TO_RECEIVE.includes(o.status)).sort((a, b) => priority(a) - priority(b) || a.commitmentDate.localeCompare(b.commitmentDate))
  const inReview = items.filter((o) => IN_REVIEW.includes(o.status))
  const finished = items.filter((o) => o.status === 'FINISHED_BY_WORKSHOP').length
  const quarantine = (allFg.data?.items ?? []).filter((f) => f.status === 'QUARANTINE')

  const checks = (o: ProductionOrder) => {
    const fgs = fgByOrder.get(o.id) ?? []
    if (!fgs.length) return <span className="text-[12px] text-ink-muted">Sin producto recibido</span>
    const q = fgs.some((f) => f.qualityStatus === 'REJECTED') ? 'REJECTED' : fgs.every((f) => f.qualityStatus === 'APPROVED') ? 'APPROVED' : 'PENDING'
    const p = fgs.some((f) => f.purityStatus === 'NON_CONFORMING') ? 'NON_CONFORMING' : fgs.every((f) => ['CONFORMING', 'NOT_REQUIRED'].includes(f.purityStatus)) ? (fgs[0].purityStatus === 'NOT_REQUIRED' ? 'NOT_REQUIRED' : 'CONFORMING') : 'PENDING'
    return (
      <div className="flex flex-wrap gap-1">
        <StatusBadge map={QUALITY} value={q} />
        <StatusBadge map={PURITY} value={p} />
      </div>
    )
  }

  const orderCols = (mode: 'receive' | 'review'): Column<ProductionOrder>[] => [
    {
      key: 'number',
      header: 'Orden',
      cell: (o) => (
        <div>
          <Link to="/ordenes/$orderId" params={{ orderId: o.id }} className="font-semibold text-ink hover:text-brand-700">{o.number}</Link>
          <p className="text-[11px] text-ink-muted">{o.product.name}{o.variant ? ` · ${o.variant.name}` : ''}</p>
        </div>
      ),
    },
    { key: 'workshop', header: 'Taller', hideOnMobile: true, cell: (o) => o.workshop.name },
    { key: 'status', header: 'Estado', cell: (o) => <StatusBadge map={ORDER_STATUS} value={o.status} /> },
    { key: 'target', header: 'Objetivo', align: 'right', cell: (o) => <span className="tnum">{formatGrams(o.targetGrams, 0)}{o.targetUnits ? <span className="text-ink-muted"> · {o.targetUnits} u</span> : null}</span> },
    {
      key: 'commitment',
      header: 'Compromiso',
      cell: (o) => {
        const late = isOverdue(o)
        return (
          <div>
            <p className={cn('font-medium', late ? 'text-danger' : 'text-ink')}>{formatDate(o.commitmentDate)}</p>
            {late && <p className="text-[11px] font-medium text-danger">Vencida hace {Math.abs(daysToCommitment(o.commitmentDate))} d</p>}
          </div>
        )
      },
    },
    { key: 'checks', header: 'Calidad / ley', cell: checks },
    {
      key: 'go',
      header: '',
      align: 'right',
      cell: (o) => (
        <Link to="/ordenes/$orderId" params={{ orderId: o.id }} hash={mode === 'receive' ? 'recepcion' : o.status === 'IN_REVIEW' ? 'conciliacion' : 'recepcion'}>
          <Button size="sm" variant={o.status === 'FINISHED_BY_WORKSHOP' || o.status === 'IN_REVIEW' ? 'primary' : 'secondary'} data-testid={`reception-go-${o.number}`}>
            {mode === 'receive' ? (o.status === 'FINISHED_BY_WORKSHOP' ? 'Recibir final' : 'Recepción parcial') : o.status === 'IN_REVIEW' ? 'Conciliar' : 'Ver ajuste'} <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader code="P11" title="Recepción y control de calidad / ley" description="Producto que regresa de los talleres: pesaje de retorno, sobrantes y devoluciones, control de calidad, verificación de ley y paso a revisión." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Scale} tone={finished ? 'gold' : 'default'} label="Terminadas por taller" value={finished} hint="Listas para recepción final" />
        <Stat icon={PackageCheck} label="En taller" value={toReceive.length - finished} hint="Admiten recepción parcial" />
        <Stat icon={SearchCheck} tone={inReview.length ? 'warning' : 'default'} label="En revisión / ajuste" value={inReview.length} hint="Conciliación y aprobación" />
        <Stat icon={Gem} tone={quarantine.length ? 'warning' : 'default'} label="Producto en cuarentena" value={quarantine.length} hint={formatGrams(quarantine.reduce((s, f) => s + f.availableGrams, 0))} />
      </div>
      <Tabs defaultValue="receive">
        <TabsList>
          <TabsTrigger value="receive" count={toReceive.length} data-testid="reception-tab-receive">Por recibir</TabsTrigger>
          <TabsTrigger value="review" count={inReview.length} data-testid="reception-tab-review">En revisión</TabsTrigger>
          {canFG && <TabsTrigger value="fg" count={allFg.data?.total} data-testid="reception-tab-fg">Producto terminado</TabsTrigger>}
        </TabsList>
        <div className="pt-4">
          <TabsContent value="receive">
            <Card flush>
              <DataTable testId="reception-queue" columns={orderCols('receive')} rows={toReceive} rowKey={(o) => o.id} loading={orders.isLoading} empty={{ title: 'Nada por recibir', description: 'Las órdenes aparecen aquí cuando el taller está produciendo o declara el producto terminado.' }} />
            </Card>
          </TabsContent>
          <TabsContent value="review">
            <Card flush>
              <DataTable testId="reception-review" columns={orderCols('review')} rows={inReview} rowKey={(o) => o.id} loading={orders.isLoading} empty={{ title: 'Sin órdenes en revisión' }} />
            </Card>
          </TabsContent>
          {canFG && (
            <TabsContent value="fg">
              <FinishedGoods orderNumber={(id) => items.find((o) => o.id === id)?.number} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  )
}

function FinishedGoods({ orderNumber }: { orderNumber: (id: string) => string | undefined }) {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search, 300)
  const params = { status, search: q, page, pageSize: 20 }
  const list = useQuery({ queryKey: ['finished-goods', 'list', params], queryFn: () => api.get<Paginated<FinishedGood>>('/finished-goods', params), placeholderData: keepPreviousData })
  const columns: Column<FinishedGood>[] = [
    {
      key: 'code',
      header: 'Código',
      cell: (f) => (
        <div>
          <p className="ledger font-semibold text-ink">{f.code}</p>
          <p className="text-[11px] text-ink-muted">{formatDate(f.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Producto',
      cell: (f) => (
        <div>
          <p className="font-medium">{f.product.name}</p>
          <p className="text-[11px] text-ink-muted">{f.variant?.name ?? f.product.code}</p>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Orden',
      hideOnMobile: true,
      cell: (f) => (
        <Link to="/ordenes/$orderId" params={{ orderId: f.orderId }} hash="recepcion" className="font-medium text-brand-700 hover:underline">
          {orderNumber(f.orderId) ?? 'Ver orden'}
        </Link>
      ),
    },
    { key: 'units', header: 'Unidades', align: 'right', cell: (f) => <span>{formatNumber(f.availableUnits)} <span className="text-ink-muted">/ {formatNumber(f.units)}</span></span> },
    { key: 'grams', header: 'Disponible', align: 'right', cell: (f) => <span className="font-semibold">{formatGrams(f.availableGrams)}</span> },
    { key: 'status', header: 'Estado', cell: (f) => <StatusBadge map={FINISHED_STATUS} value={f.status} /> },
    { key: 'quality', header: 'Calidad', cell: (f) => <StatusBadge map={QUALITY} value={f.qualityStatus} /> },
    { key: 'purity', header: 'Ley', cell: (f) => <div><StatusBadge map={PURITY} value={f.purityStatus} />{f.verifiedPurity ? <p className="mt-0.5 text-[11px] text-ink-muted tnum">{formatPurity(f.verifiedPurity)}</p> : null}</div> },
    { key: 'cost', header: 'Costo / g', align: 'right', hideOnMobile: true, cell: (f) => (f.unitCostPerGram ? formatMoney(f.unitCostPerGram) : <span className="text-ink-muted">—</span>) },
  ]
  return (
    <Card flush>
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1) }} placeholder="Buscar código o producto…" className="sm:w-72" />
        <div className="sm:w-52">
          <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(FINISHED_STATUS).map(([value, x]) => ({ value, label: x.label }))]} />
        </div>
        <p className="text-[12px] text-ink-muted sm:ml-auto">El producto queda disponible para venta solo con calidad aprobada y ley validada (RN-022).</p>
      </div>
      <DataTable testId="finished-goods" columns={columns} rows={list.data?.items} rowKey={(f) => f.id} loading={list.isLoading} empty={{ title: 'Sin producto terminado' }} pagination={list.data ? { page, pageSize: 20, total: list.data.total, onPageChange: setPage } : undefined} />
    </Card>
  )
}
