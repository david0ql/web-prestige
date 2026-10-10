import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarClock, ClipboardList, FilePen, PackageSearch, Plus, SearchCheck, Truck, Factory } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { ProductionOrder } from '@/lib/api/types'
import { useProducts, useWorkshops } from '@/lib/hooks/useMasters'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { Can } from '@/lib/auth/Can'
import { ORDER_STATUS, PRIORITY } from '@/lib/labels'
import { formatDate, formatGrams, formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { QueryState } from '@/components/domain/QueryState'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { SearchInput } from '@/components/ui/SearchInput'
import { Switch } from '@/components/ui/Switch'
import { daysToCommitment, isOverdue, lifecyclePct } from './components/orderUtils'

const PAGE_SIZE = 20

interface SummaryCard {
  key: string
  label: string
  statuses: string[]
  icon: typeof ClipboardList
  tone: string
  overdue?: boolean
}

const SUMMARY: SummaryCard[] = [
  { key: 'draft', label: 'Borradores', statuses: ['DRAFT'], icon: FilePen, tone: 'text-ink-secondary bg-sunken' },
  { key: 'materials', label: 'Pendiente de materiales', statuses: ['PENDING_MATERIALS'], icon: PackageSearch, tone: 'text-warning bg-warning-bg' },
  { key: 'ready', label: 'Lista para despacho', statuses: ['READY_FOR_DISPATCH'], icon: Truck, tone: 'text-info bg-info-bg' },
  { key: 'workshop', label: 'En taller', statuses: ['DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL'], icon: Factory, tone: 'text-brand-700 bg-brand-100' },
  { key: 'review', label: 'Por recibir / revisión', statuses: ['FINISHED_BY_WORKSHOP', 'IN_REVIEW', 'REJECTED_ADJUSTMENT'], icon: SearchCheck, tone: 'text-warning bg-warning-bg' },
  { key: 'overdue', label: 'Retrasadas', statuses: [], icon: CalendarClock, tone: 'text-danger bg-danger-bg', overdue: true },
]

/** Listado de órdenes de producción (P06). */
export default function OrdersListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const linked = useSearch({ from: '/app/ordenes' })
  const [workshopId, setWorkshopId] = useState(linked.workshopId ?? '')
  const [productId, setProductId] = useState(linked.productId ?? '')
  const [overdue, setOverdue] = useState(false)
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const q = useDebounced(search, 300)
  const workshops = useWorkshops()
  const products = useProducts()

  const params = { page, pageSize: PAGE_SIZE, search: q, status: statuses, workshopId, productId, overdue: overdue ? 'true' : undefined, open: open ? 'true' : undefined }
  const list = useQuery({ queryKey: ['orders', 'list', params], queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', params), placeholderData: keepPreviousData })
  // Resumen por estado: todas las órdenes (volumen operativo moderado).
  const all = useQuery({ queryKey: ['orders', 'summary'], queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { pageSize: 200 }) })

  const counts = useMemo(() => {
    const items = all.data?.items ?? []
    return Object.fromEntries(SUMMARY.map((c) => [c.key, c.overdue ? items.filter(isOverdue).length : items.filter((o) => c.statuses.includes(o.status)).length]))
  }, [all.data])

  const activeCard = SUMMARY.find((c) => (c.overdue ? overdue && statuses.length === 0 : !overdue && statuses.length === c.statuses.length && c.statuses.every((s) => statuses.includes(s))))
  const applyCard = (c: SummaryCard) => {
    setPage(1)
    if (activeCard?.key === c.key) {
      setStatuses([])
      setOverdue(false)
      return
    }
    setStatuses(c.overdue ? [] : c.statuses)
    setOverdue(!!c.overdue)
  }
  const reset = () => {
    setSearch('')
    setStatuses([])
    setWorkshopId('')
    setProductId('')
    setOverdue(false)
    setOpen(false)
    setPage(1)
  }
  const hasFilters = !!(search || statuses.length || workshopId || productId || overdue || open)

  const columns: Column<ProductionOrder>[] = [
    {
      key: 'number',
      header: 'Orden',
      cell: (o) => (
        <div>
          <Link to="/ordenes/$orderId" params={{ orderId: o.id }} className="font-semibold text-ink hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
            {o.number}
          </Link>
          <p className="text-[11px] text-ink-muted">Creada {formatDate(o.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Producto',
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{o.product.name}</p>
          <p className="text-[11px] text-ink-muted">{[o.product.code, o.variant?.name].filter(Boolean).join(' · ')}</p>
        </div>
      ),
    },
    { key: 'workshop', header: 'Taller', hideOnMobile: true, cell: (o) => <span className="text-ink-secondary">{o.workshop.name}</span> },
    {
      key: 'target',
      header: 'Objetivo',
      align: 'right',
      cell: (o) => (
        <div>
          <p className="font-medium">{formatGrams(o.targetGrams, 0)}</p>
          {o.targetUnits ? <p className="text-[11px] text-ink-muted">{formatNumber(o.targetUnits)} u</p> : null}
        </div>
      ),
    },
    { key: 'status', header: 'Estado', cell: (o) => <StatusBadge map={ORDER_STATUS} value={o.status} /> },
    { key: 'priority', header: 'Prioridad', hideOnMobile: true, cell: (o) => <StatusBadge map={PRIORITY} value={o.priority} /> },
    {
      key: 'commitment',
      header: 'Compromiso',
      cell: (o) => {
        const late = isOverdue(o)
        const days = daysToCommitment(o.commitmentDate)
        return (
          <div className={cn(late && 'text-danger')}>
            <p className={cn('font-medium', late ? 'text-danger' : 'text-ink')}>{formatDate(o.commitmentDate)}</p>
            <p className="text-[11px] text-ink-muted">
              {o.status === 'CANCELLED' ? 'Cancelada' : o.closedAt || o.deliveredAt ? `Entregada ${formatDate(o.deliveredAt ?? o.closedAt)}` : late ? <span className="font-medium text-danger">Vencida hace {Math.abs(days)} d</span> : days === 0 ? 'Vence hoy' : `En ${days} d`}
            </p>
          </div>
        )
      },
    },
    {
      key: 'progress',
      header: 'Avance',
      hideOnMobile: true,
      cell: (o) => {
        const pct = lifecyclePct(o.status)
        return (
          <div className="flex w-28 items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <span className={cn('block h-full rounded-full', o.status === 'APPROVED_CLOSED' ? 'bg-success' : o.status === 'CANCELLED' ? 'bg-border-strong' : 'gold-gradient')} style={{ width: `${pct}%` }} />
            </span>
            <span className="w-8 text-right text-[11px] text-ink-muted tnum">{pct}%</span>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        code="P06"
        title="Órdenes de producción"
        description="Planeación, seguimiento y cierre de la producción por taller: estados, compromisos y avance del ciclo."
        actions={
          <Can perm="orders.manage">
            <Link to="/ordenes/nueva">
              <Button data-testid="orders-new">
                <Plus className="size-4" /> Nueva orden
              </Button>
            </Link>
          </Can>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {SUMMARY.map((c) => {
          const Icon = c.icon
          const active = activeCard?.key === c.key
          return (
            <button
              key={c.key}
              type="button"
              data-testid={`orders-card-${c.key}`}
              onClick={() => applyCard(c)}
              className={cn(
                'group rounded-md border bg-surface p-3 text-left shadow-card transition-colors hover:border-brand-300',
                active ? 'border-brand-500 ring-1 ring-brand-500' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow leading-tight">{c.label}</span>
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', c.tone)}>
                  <Icon className="size-3.5" />
                </span>
              </div>
              <p className={cn('mt-1 text-[22px] font-semibold tracking-tight tnum', c.overdue && counts[c.key] ? 'text-danger' : 'text-ink')}>{all.isLoading ? '…' : counts[c.key]}</p>
            </button>
          )
        })}
      </div>

      <Card flush>
        <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onValueChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Buscar por número, producto o taller…"
            className="lg:w-72"
            data-testid="orders-search"
          />
          <div className="lg:w-64">
            <MultiSelect
              values={statuses}
              onValuesChange={(v) => {
                setStatuses(v)
                setPage(1)
              }}
              options={Object.entries(ORDER_STATUS).map(([value, x]) => ({ value, label: x.label }))}
              placeholder="Todos los estados"
            />
          </div>
          <div className="lg:w-44">
            <NativeSelect
              value={workshopId}
              onChange={(e) => {
                setWorkshopId(e.target.value)
                setPage(1)
              }}
              options={[{ value: '', label: 'Todos los talleres' }, ...(workshops.data ?? []).map((w) => ({ value: w.id, label: w.name }))]}
              data-testid="orders-filter-workshop"
            />
          </div>
          <div className="lg:w-52">
            <NativeSelect
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                setPage(1)
              }}
              options={[{ value: '', label: 'Todos los productos' }, ...(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))]}
            />
          </div>
          <div className="flex items-center gap-4 lg:ml-auto">
            <Switch label="Retrasadas" checked={overdue} onCheckedChange={(v) => { setOverdue(v); setPage(1) }} />
            <Switch label="Abiertas" checked={open} onCheckedChange={(v) => { setOpen(v); setPage(1) }} />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Limpiar
              </Button>
            )}
          </div>
        </div>
        <QueryState isLoading={false} error={list.error} onRetry={() => void list.refetch()}>
          <DataTable
            testId="orders-table"
            columns={columns}
            rows={list.data?.items}
            rowKey={(o) => o.id}
            loading={list.isLoading}
            onRowClick={(o) => void navigate({ to: '/ordenes/$orderId', params: { orderId: o.id } })}
            empty={{ title: hasFilters ? 'Ninguna orden coincide con los filtros' : 'Aún no hay órdenes', description: hasFilters ? 'Ajusta o limpia los filtros.' : 'Crea la primera orden de producción.' }}
            pagination={list.data ? { page, pageSize: PAGE_SIZE, total: list.data.total, onPageChange: setPage } : undefined}
          />
        </QueryState>
      </Card>
    </div>
  )
}
