import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, ClipboardCheck, Coins, PackagePlus, Scale, X } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Discrepancy, LaborCost, MaterialRequest, ProductionOrder } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useWorkshops } from '@/lib/hooks/useMasters'
import { LABOR_BASIS, ORDER_STATUS } from '@/lib/labels'
import { formatDate, formatDateTime, formatGrams, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Stat } from '@/components/domain/Stat'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { DiscrepancyTable } from '@/pages/orders/components/DiscrepancyTable'
import { LaborDecisionModal, RequestReviewModal } from '@/pages/orders/components/ReviewModals'

/** Bandeja unificada de aprobaciones de Gerencia (RF-022/023, RN-012). */
export default function ApprovalsPage() {
  const canLabor = usePermission('labor.approve', 'finance.read')
  const canDecideLabor = usePermission('labor.approve')
  const canRequests = usePermission('requests.review')
  const workshops = useWorkshops()
  const allOrders = useQuery({ queryKey: ['orders', 'summary'], queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { pageSize: 200 }) })
  const discrepancies = useQuery({ queryKey: ['discrepancies', 'pending'], queryFn: () => api.get<Paginated<Discrepancy>>('/discrepancies', { status: 'PENDING', pageSize: 200 }) })
  const labor = useQuery({ queryKey: ['labor', 'proposed'], queryFn: () => api.get<Paginated<LaborCost>>('/labor', { status: 'PROPOSED', pageSize: 200 }), enabled: canLabor })
  const requests = useQuery({ queryKey: ['material-requests', 'pending'], queryFn: () => api.get<Paginated<MaterialRequest>>('/material-requests', { status: 'PENDING', pageSize: 200 }) })
  const [laborAction, setLaborAction] = useState<{ l: LaborCost; decision: 'APPROVE' | 'REJECT' } | null>(null)
  const [reqAction, setReqAction] = useState<{ r: MaterialRequest; decision: 'APPROVE' | 'REJECT' } | null>(null)

  const orders = allOrders.data?.items ?? []
  const inReview = orders.filter((o) => o.status === 'IN_REVIEW')
  const orderById = (id: string | null) => (id ? orders.find((o) => o.id === id) : undefined)
  const wsName = (id: string | null) => workshops.data?.find((w) => w.id === id)?.name ?? null

  const reviewCols: Column<ProductionOrder>[] = [
    {
      key: 'number',
      header: 'Orden',
      cell: (o) => (
        <div>
          <Link to="/ordenes/$orderId" params={{ orderId: o.id }} hash="conciliacion" className="font-semibold text-ink hover:text-brand-700">{o.number}</Link>
          <p className="text-[11px] text-ink-muted">{o.product.name}{o.variant ? ` · ${o.variant.name}` : ''}</p>
        </div>
      ),
    },
    { key: 'workshop', header: 'Taller', cell: (o) => o.workshop.name },
    { key: 'target', header: 'Objetivo', align: 'right', cell: (o) => formatGrams(o.targetGrams, 0) },
    { key: 'delivered', header: 'Recibida', cell: (o) => formatDate(o.deliveredAt) },
    { key: 'commitment', header: 'Compromiso', cell: (o) => <span className={cn(o.deliveredAt && o.deliveredAt.slice(0, 10) > o.commitmentDate ? 'text-danger' : 'text-ink')}>{formatDate(o.commitmentDate)}</span> },
    { key: 'status', header: 'Estado', cell: (o) => <StatusBadge map={ORDER_STATUS} value={o.status} /> },
    {
      key: 'go',
      header: '',
      align: 'right',
      cell: (o) => (
        <Link to="/ordenes/$orderId" params={{ orderId: o.id }} hash="conciliacion">
          <Button size="sm" data-testid={`approvals-review-${o.number}`}>
            Conciliar y aprobar <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      ),
    },
  ]

  const laborCols: Column<LaborCost>[] = [
    {
      key: 'order',
      header: 'Orden',
      cell: (l) => {
        const o = orderById(l.orderId)
        return (
          <div>
            <Link to="/ordenes/$orderId" params={{ orderId: l.orderId }} className="font-semibold text-ink hover:text-brand-700">{o?.number ?? 'Ver orden'}</Link>
            <p className="text-[11px] text-ink-muted">{o?.product.name ?? ''}</p>
          </div>
        )
      },
    },
    { key: 'workshop', header: 'Taller', cell: (l) => wsName(l.workshopId) ?? '—' },
    { key: 'basis', header: 'Base', cell: (l) => <span className="text-[12px]">{LABOR_BASIS[l.basis] ?? l.basis}: {formatNumber(l.quantity, 2)} × {formatMoney(l.rate)}</span> },
    { key: 'value', header: 'Propuesto', align: 'right', cell: (l) => <span className="text-[14px] font-semibold">{formatMoney(l.proposedValue)}</span> },
    { key: 'date', header: 'Fecha', hideOnMobile: true, cell: (l) => <span className="text-[12px] text-ink-muted">{formatDateTime(l.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (l) =>
        canDecideLabor ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" data-testid="labor-approve" onClick={() => setLaborAction({ l, decision: 'APPROVE' })}>
              <Check className="size-3.5 text-success" /> Aprobar
            </Button>
            <Button size="sm" variant="ghost" aria-label="Rechazar" onClick={() => setLaborAction({ l, decision: 'REJECT' })}>
              <X className="size-3.5 text-danger" />
            </Button>
          </div>
        ) : null,
    },
  ]

  const requestCols: Column<MaterialRequest>[] = [
    {
      key: 'number',
      header: 'Solicitud',
      cell: (r) => (
        <div>
          <p className="font-semibold">{r.number}</p>
          <p className="text-[11px] text-ink-muted">{formatDateTime(r.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Orden / taller',
      cell: (r) => (
        <div>
          {r.orderId ? <Link to="/ordenes/$orderId" params={{ orderId: r.orderId }} hash="produccion" className="font-medium text-brand-700 hover:underline">{r.order?.number ?? orderById(r.orderId)?.number ?? 'Ver orden'}</Link> : '—'}
          <p className="text-[11px] text-ink-muted">{wsName(r.workshopId)}</p>
        </div>
      ),
    },
    { key: 'material', header: 'Material', cell: (r) => <span className="font-medium">{r.material.name}</span> },
    { key: 'grams', header: 'Gramos', align: 'right', cell: (r) => <span className="font-semibold">{formatGrams(r.grams)}</span> },
    {
      key: 'std',
      header: 'Contra estándar',
      cell: (r) => (r.exceedsStandard ? <Badge variant="danger">Fuera de estándar {r.deviationPct !== null ? `+${formatPercent(r.deviationPct, 1)}` : ''}</Badge> : <Badge variant="success">Dentro del estándar</Badge>),
    },
    { key: 'reason', header: 'Motivo', cell: (r) => <span className="line-clamp-2 max-w-xs text-[12px] text-ink-secondary">{r.reason}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        canRequests ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" data-testid={`approvals-request-approve-${r.number}`} onClick={() => setReqAction({ r, decision: 'APPROVE' })}>
              <Check className="size-3.5 text-success" /> Aprobar
            </Button>
            <Button size="sm" variant="ghost" aria-label="Rechazar" onClick={() => setReqAction({ r, decision: 'REJECT' })}>
              <X className="size-3.5 text-danger" />
            </Button>
          </div>
        ) : null,
    },
  ]

  const counts = {
    orders: inReview.length,
    disc: discrepancies.data?.total ?? 0,
    labor: labor.data?.total ?? 0,
    requests: requests.data?.total ?? 0,
  }
  const laborTotal = (labor.data?.items ?? []).reduce((s, l) => s + l.proposedValue, 0)

  return (
    <div>
      <PageHeader title="Aprobaciones" description="Bandeja de Gerencia: cierre de órdenes, mermas y diferencias, mano de obra propuesta y solicitudes de material. Nada impacta inventario ni finanzas sin esta aprobación." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ClipboardCheck} tone={counts.orders ? 'gold' : 'default'} label="Órdenes en revisión" value={counts.orders} hint="Conciliar, aprobar y cerrar" />
        <Stat icon={Scale} tone={counts.disc ? 'warning' : 'default'} label="Diferencias pendientes" value={counts.disc} hint="Justificar y aprobar/rechazar" />
        {canLabor && <Stat icon={Coins} tone={counts.labor ? 'warning' : 'default'} label="Mano de obra propuesta" value={counts.labor} hint={formatMoney(laborTotal)} />}
        <Stat icon={PackagePlus} tone={counts.requests ? 'warning' : 'default'} label="Solicitudes de material" value={counts.requests} hint="Pendientes de revisión" />
      </div>
      <Tabs defaultValue="orders">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="orders" count={counts.orders} data-testid="approvals-tab-orders">Órdenes en revisión</TabsTrigger>
          <TabsTrigger value="disc" count={counts.disc} data-testid="approvals-tab-discrepancies">Diferencias</TabsTrigger>
          {canLabor && <TabsTrigger value="labor" count={counts.labor} data-testid="approvals-tab-labor">Mano de obra</TabsTrigger>}
          <TabsTrigger value="requests" count={counts.requests} data-testid="approvals-tab-requests">Solicitudes de material</TabsTrigger>
        </TabsList>
        <div className="pt-4">
          <TabsContent value="orders">
            <Card flush>
              <DataTable testId="approvals-orders" columns={reviewCols} rows={inReview} rowKey={(o) => o.id} loading={allOrders.isLoading} empty={{ title: 'No hay órdenes en revisión', description: 'Las órdenes llegan aquí tras la recepción final del producto.' }} />
            </Card>
          </TabsContent>
          <TabsContent value="disc">
            <Card flush>
              <DiscrepancyTable rows={discrepancies.data?.items} loading={discrepancies.isLoading} orderLabel={(id) => orderById(id)?.number ?? null} workshopLabel={wsName} emptyTitle="Sin diferencias pendientes" testId="approvals-discrepancies" />
            </Card>
          </TabsContent>
          {canLabor && (
            <TabsContent value="labor">
              <Card flush>
                <DataTable testId="approvals-labor" columns={laborCols} rows={labor.data?.items} rowKey={(l) => l.id} loading={labor.isLoading} empty={{ title: 'Sin mano de obra pendiente' }} />
              </Card>
              <p className="mt-2 text-[12px] text-ink-muted">Al aprobar, el costo se envía a contabilidad (RF-024). También puede decidirse al aprobar la orden.</p>
            </TabsContent>
          )}
          <TabsContent value="requests">
            <Card flush>
              <DataTable testId="approvals-requests" columns={requestCols} rows={requests.data?.items} rowKey={(r) => r.id} loading={requests.isLoading} empty={{ title: 'Sin solicitudes pendientes' }} />
            </Card>
          </TabsContent>
        </div>
      </Tabs>
      {laborAction && <LaborDecisionModal l={laborAction.l} decision={laborAction.decision} onClose={() => setLaborAction(null)} />}
      {reqAction && <RequestReviewModal r={reqAction.r} decision={reqAction.decision} onClose={() => setReqAction(null)} />}
    </div>
  )
}
