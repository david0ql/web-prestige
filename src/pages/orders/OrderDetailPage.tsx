import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Ban, CalendarClock, Check, ClipboardCheck, FileText, Images, MoreHorizontal, Pencil, RefreshCw, Scale, Send, Target, Truck, Undo2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { OrderDetail } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { ORDER_STATUS, PRIORITY } from '@/lib/labels'
import { formatDate, formatDateTime, formatGrams, formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { ReasonDialog } from '@/components/domain/ReasonDialog'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { notify } from '@/components/ui/Toaster'
import { CANCELLABLE, DISPATCHABLE, EDITABLE, LIFECYCLE, MODIFIABLE_TARGET, daysToCommitment, stepDates, stepIndexOf } from './components/orderUtils'
import { Notice, useInvalidateOrders } from './components/bits'
import { SummaryTab } from './components/SummaryTab'
import { DispatchesTab } from './components/DispatchesTab'
import { ProductionTab } from './components/ProductionTab'
import { EvidenceTab } from './components/EvidenceTab'
import { ReceptionTab } from './components/ReceptionTab'
import { ReconciliationTab } from './components/ReconciliationTab'
import { HistoryTab } from './components/HistoryTab'
import { EditOrderModal, ModifyTargetModal } from './components/OrderModals'

const TABS = ['resumen', 'despachos', 'produccion', 'evidencias', 'recepcion', 'conciliacion', 'historial'] as const
type Tab = (typeof TABS)[number]

const initialTab = (): Tab => {
  const h = window.location.hash.replace('#', '') as Tab
  return TABS.includes(h) ? h : 'resumen'
}

/** P06 + P11 + P12 · Detalle, seguimiento, recepción y conciliación de la orden. */
export default function OrderDetailPage() {
  const { orderId } = useParams({ from: '/app/ordenes/$orderId' })
  const [tab, setTabState] = useState<Tab>(initialTab)
  const setTab = (t: Tab) => {
    setTabState(t)
    window.history.replaceState(window.history.state, '', `#${t}`)
  }
  useEffect(() => {
    const h = () => setTabState(initialTab())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  const q = useQuery({ queryKey: ['orders', 'detail', orderId], queryFn: () => api.get<OrderDetail>(`/orders/${orderId}`) })
  const o = q.data

  return (
    <div>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {o && (
          <>
            <OrderHeader o={o} onGoTo={setTab} />
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-5">
              <TabsList className="overflow-x-auto">
                <TabsTrigger value="resumen" data-testid="tab-resumen">Resumen</TabsTrigger>
                <TabsTrigger value="despachos" data-testid="tab-despachos" count={o.dispatches.length}>Despachos</TabsTrigger>
                <TabsTrigger value="produccion" data-testid="tab-produccion" count={o.stages.filter((s) => s.completed).length}>Producción</TabsTrigger>
                <TabsTrigger value="evidencias" data-testid="tab-evidencias">Evidencias</TabsTrigger>
                <TabsTrigger value="recepcion" data-testid="tab-recepcion" count={o.receipts.length}>Recepción y calidad</TabsTrigger>
                <TabsTrigger value="conciliacion" data-testid="tab-conciliacion" count={o.discrepancies.filter((d) => d.status === 'PENDING').length || undefined}>Conciliación</TabsTrigger>
                <TabsTrigger value="historial" data-testid="tab-historial" count={o.history.length}>Historial</TabsTrigger>
              </TabsList>
              <div className="pt-4">
                <TabsContent value="resumen"><SummaryTab o={o} /></TabsContent>
                <TabsContent value="despachos"><DispatchesTab o={o} /></TabsContent>
                <TabsContent value="produccion"><ProductionTab o={o} /></TabsContent>
                <TabsContent value="evidencias"><EvidenceTab o={o} /></TabsContent>
                <TabsContent value="recepcion"><ReceptionTab o={o} /></TabsContent>
                <TabsContent value="conciliacion"><ReconciliationTab o={o} /></TabsContent>
                <TabsContent value="historial"><HistoryTab o={o} /></TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </QueryState>
    </div>
  )
}

function OrderHeader({ o, onGoTo }: { o: OrderDetail; onGoTo: (t: Tab) => void }) {
  const invalidate = useInvalidateOrders()
  const canManage = usePermission('orders.manage')
  const canDispatch = usePermission('orders.dispatch')
  const canAuthorize = usePermission('orders.authorize_changes')
  const canCancel = usePermission('orders.cancel')
  const canReceive = usePermission('orders.receive')
  const canReject = usePermission('orders.approve', 'orders.reconcile')
  const canApprove = usePermission('orders.approve')
  const [dialog, setDialog] = useState<null | 'cancel' | 'reject' | 'modify' | 'edit' | 'review'>(null)

  const action = (path: string, body: unknown, msg: string) =>
    api.post<OrderDetail>(`/orders/${o.id}/${path}`, body).then((r) => {
      notify.success(msg)
      invalidate()
      setDialog(null)
      return r
    })
  const plan = useMutation({ mutationFn: () => action('plan', {}, 'Orden planificada: suficiencia de insumos evaluada') })
  const refresh = useMutation({ mutationFn: () => action('refresh-status', {}, 'Estado recalculado') })
  const cancel = useMutation({ mutationFn: (reason: string) => action('cancel', { reason }, 'Orden cancelada') })
  const reject = useMutation({ mutationFn: (reason: string) => action('reject', { reason }, 'Orden devuelta a ajuste') })
  const review = useMutation({ mutationFn: () => action('send-to-review', {}, 'Orden enviada a revisión') })

  const s = o.status
  const late = o.overdue
  const days = daysToCommitment(o.commitmentDate)
  const stagesDone = o.stages.filter((x) => x.completed).length

  const menuItems = [
    canManage && EDITABLE.includes(s) && { label: 'Editar orden', icon: Pencil, onSelect: () => setDialog('edit') },
    canManage && ['PENDING_MATERIALS', 'READY_FOR_DISPATCH'].includes(s) && { label: 'Recalcular estado', icon: RefreshCw, onSelect: () => refresh.mutate() },
    canAuthorize && MODIFIABLE_TARGET.includes(s) && { label: 'Modificar objetivo (autorizado)', icon: Target, onSelect: () => setDialog('modify') },
    canCancel && CANCELLABLE.includes(s) && { label: 'Cancelar orden', icon: Ban, danger: true, onSelect: () => setDialog('cancel') },
  ].filter(Boolean) as { label: string; icon: typeof Pencil; danger?: boolean; onSelect: () => void }[]

  return (
    <>
      <PageHeader
        code="P06"
        breadcrumbs={[{ label: 'Órdenes', to: '/ordenes' }, { label: o.number }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {o.number}
            <StatusBadge map={ORDER_STATUS} value={s} className="text-[12px]" />
            {o.priority !== 'NORMAL' && <StatusBadge map={PRIORITY} value={o.priority} />}
          </span>
        }
        description={
          <span>
            <b className="font-semibold text-ink">{o.product.name}</b>
            {o.variant ? ` · ${o.variant.name}` : ''} · Taller <b className="font-semibold text-ink">{o.workshop.name}</b>
            {o.notes ? <span className="text-ink-muted"> · {o.notes}</span> : null}
          </span>
        }
        actions={
          <>
            {canManage && s === 'DRAFT' && (
              <Button data-testid="order-plan" loading={plan.isPending} onClick={() => plan.mutate()}>
                <ClipboardCheck className="size-4" /> Planificar
              </Button>
            )}
            {canDispatch && DISPATCHABLE.includes(s) && (
              <Link to="/asignaciones" search={{ orderId: o.id }}>
                <Button data-testid="order-dispatch" variant={s === 'READY_FOR_DISPATCH' || s === 'PENDING_MATERIALS' ? 'primary' : 'secondary'}>
                  <Truck className="size-4" /> Despachar material
                </Button>
              </Link>
            )}
            {canReceive && ['IN_PRODUCTION', 'PARTIAL', 'FINISHED_BY_WORKSHOP', 'ACCEPTED_BY_WORKSHOP', 'REJECTED_ADJUSTMENT'].includes(s) && (
              <Button variant={s === 'FINISHED_BY_WORKSHOP' ? 'primary' : 'secondary'} data-testid="order-receive" onClick={() => onGoTo('recepcion')}>
                <Scale className="size-4" /> Recibir
              </Button>
            )}
            {canReceive && s === 'FINISHED_BY_WORKSHOP' && (
              <Button variant="secondary" data-testid="order-send-review" onClick={() => setDialog('review')}>
                <Send className="size-4" /> Enviar a revisión
              </Button>
            )}
            {canReject && ['FINISHED_BY_WORKSHOP', 'IN_REVIEW'].includes(s) && (
              <Button variant="secondary" data-testid="order-reject" onClick={() => setDialog('reject')}>
                <Undo2 className="size-4" /> Devolver a ajuste
              </Button>
            )}
            {canApprove && s === 'IN_REVIEW' && (
              <Button data-testid="order-approve" onClick={() => {
                onGoTo('conciliacion')
                setTimeout(() => document.getElementById('approval-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
              }}>
                <Check className="size-4" /> Aprobar y cerrar
              </Button>
            )}
            <Link to="/ordenes/$orderId/historia" params={{ orderId: o.id }}>
              <Button variant="secondary" data-testid="order-story">
                <Images className="size-4" /> Historia
              </Button>
            </Link>
            {menuItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" iconOnly aria-label="Más acciones" data-testid="order-more">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuItems.map((m) => (
                    <DropdownMenuItem key={m.label} icon={m.icon} danger={m.danger} onSelect={m.onSelect} data-testid={m.danger ? 'order-cancel' : undefined}>
                      {m.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {s === 'CANCELLED' && (
        <Notice tone="neutral" icon={<Ban />} title="Orden cancelada" className="mb-4">
          {o.cancellationReason}
        </Notice>
      )}
      {s === 'REJECTED_ADJUSTMENT' && (
        <Notice tone="danger" icon={<Undo2 />} title="Devuelta a ajuste" className="mb-4">
          {o.rejectionReason ?? 'Existen diferencias o evidencias que deben corregirse.'}
        </Notice>
      )}

      <Lifecycle o={o} />

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border shadow-card md:grid-cols-3 xl:grid-cols-6">
        <HeaderCell label="Objetivo" value={formatGrams(o.targetGrams)} hint={o.targetUnits ? `${formatNumber(o.targetUnits)} unidades` : 'Sin unidades definidas'} />
        <HeaderCell
          label="Compromiso"
          value={<span className={cn(late && 'text-danger')}>{formatDate(o.commitmentDate)}</span>}
          hint={
            o.deliveredAt || o.closedAt ? (
              <span className={cn(o.onTime === false ? 'text-danger' : 'text-success', 'font-medium')}>{o.onTime === false ? 'Entregada tarde' : 'Entregada a tiempo'}</span>
            ) : s === 'CANCELLED' ? (
              '—'
            ) : late ? (
              <span className="font-medium text-danger">Vencida hace {Math.abs(days)} días</span>
            ) : (
              `Faltan ${days} días`
            )
          }
          icon={<CalendarClock className={cn('size-4', late ? 'text-danger' : 'text-ink-muted')} />}
        />
        <HeaderCell label="Entrega real (RF-032)" value={o.deliveredAt ? formatDate(o.deliveredAt) : '—'} hint={o.closedAt ? `Cerrada ${formatDateTime(o.closedAt)}` : o.finishedByWorkshopAt ? `Terminada por taller ${formatDate(o.finishedByWorkshopAt)}` : 'Pendiente'} />
        <HeaderCell label="Etapas con evidencia" value={`${stagesDone} / ${o.stages.length}`} hint={o.stages.length ? `${Math.round((stagesDone / o.stages.length) * 100)} % del proceso` : 'Sin etapas configuradas'} />
        <HeaderCell label="Suficiencia de insumos" value={o.sufficiency.sufficient ? <span className="text-success">Completa</span> : <span className="text-warning">Con faltantes</span>} hint={`${o.sufficiency.lines.length} insumo(s) requerido(s)`} />
        <HeaderCell
          label="Ficha técnica"
          value={o.technicalSheet ? `Versión ${o.technicalSheet.versionNumber}` : '—'}
          hint={
            <Link to="/catalogo/$productId" params={{ productId: o.productId }} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <FileText className="size-3" /> Ver catálogo técnico
            </Link>
          }
        />
      </div>

      <ReasonDialog open={dialog === 'cancel'} onOpenChange={(v) => !v && setDialog(null)} title={`Cancelar ${o.number}`} description="La orden quedará cancelada. El material en custodia deberá retornarse/controlarse según corresponda." confirmLabel="Cancelar orden" danger loading={cancel.isPending} onConfirm={(r) => cancel.mutate(r)} />
      <ReasonDialog open={dialog === 'reject'} onOpenChange={(v) => !v && setDialog(null)} title={`Devolver ${o.number} a ajuste`} description="El taller deberá corregir diferencias o evidencias antes de una nueva revisión." label="Motivo de la devolución" confirmLabel="Devolver a ajuste" danger loading={reject.isPending} onConfirm={(r) => reject.mutate(r)} />
      <ConfirmDialog open={dialog === 'review'} onOpenChange={(v) => !v && setDialog(null)} title="Enviar a revisión Prestige Gold" confirmLabel="Enviar a revisión" loading={review.isPending} onConfirm={() => review.mutate()}>
        La orden pasará a <b>En revisión</b> para conciliación y aprobación. Normalmente esto ocurre automáticamente al registrar la recepción final.
      </ConfirmDialog>
      {dialog === 'modify' && <ModifyTargetModal o={o} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <EditOrderModal o={o} onClose={() => setDialog(null)} />}
    </>
  )
}

function HeaderCell({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-[16px] font-semibold tracking-tight text-ink tnum">{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-ink-muted">{hint}</p>}
    </div>
  )
}

/** Línea de tiempo del ciclo de estados (sección 7.1) con fechas. */
function Lifecycle({ o }: { o: OrderDetail }) {
  const dates = stepDates(o)
  let current = stepIndexOf(o.status)
  if (o.status === 'CANCELLED') {
    const last = [...o.history].reverse().find((h) => h.toStatus === 'CANCELLED')
    current = last?.fromStatus ? stepIndexOf(last.fromStatus) : 0
  }
  const closed = o.status === 'APPROVED_CLOSED'
  const problem = o.status === 'CANCELLED' || o.status === 'REJECTED_ADJUSTMENT'
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface px-4 py-3 shadow-card" data-testid="order-lifecycle">
      <ol className="flex min-w-[760px] items-start">
        {LIFECYCLE.map((step, i) => {
          const done = i < current || (closed && i === current)
          const isCurrent = i === current && !closed
          return (
            <li key={step.key} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span className={cn('absolute top-[11px] right-1/2 h-0.5 w-full', i <= current ? 'bg-brand-500' : 'bg-border')} />}
              <span
                className={cn(
                  'relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-[11px] font-bold',
                  done && 'border-brand-500 bg-brand-500 text-white',
                  isCurrent && !problem && 'border-brand-600 bg-surface text-brand-700 ring-4 ring-brand-100',
                  isCurrent && problem && 'border-danger bg-surface text-danger ring-4 ring-danger-bg',
                  !done && !isCurrent && 'border-border bg-surface text-ink-muted',
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn('mt-1.5 text-[12px] font-medium', isCurrent ? (problem ? 'text-danger' : 'text-ink') : done ? 'text-ink-secondary' : 'text-ink-muted')}>
                {isCurrent && step.statuses.length > 1 ? ORDER_STATUS[o.status]?.label ?? step.label : step.label}
              </span>
              <span className="text-[10.5px] text-ink-muted tnum">{dates[i] && (done || isCurrent) ? formatDate(dates[i], 'd MMM, HH:mm') : ' '}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
