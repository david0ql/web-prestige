import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, FileSearch, Hammer, PenLine, RotateCcw, Truck, Wrench } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Alert } from '@/lib/api/types'
import { formatGrams, formatNumber } from '@/lib/format'
import { APPROVAL_STATUS } from '@/lib/labels'
import { useUser } from '@/lib/auth/store'
import { PageHeader } from '@/components/domain/PageHeader'
import { Stat } from '@/components/domain/Stat'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { AlertRow, OrderCard, type WorkshopDashboard, type WorkshopTask } from './components/shared'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

const TASK_META: Record<string, { icon: typeof Truck; cta: string; tone: string }> = {
  CONFIRM_DISPATCH: { icon: PenLine, cta: 'Confirmar entrega', tone: 'bg-warning-bg text-warning' },
  ADJUST: { icon: RotateCcw, cta: 'Corregir orden', tone: 'bg-danger-bg text-danger' },
  PRODUCE: { icon: Hammer, cta: 'Registrar producción', tone: 'bg-brand-100 text-brand-700' },
}

function TaskRow({ t, i }: { t: WorkshopTask; i: number }) {
  const meta = TASK_META[t.type] ?? TASK_META.PRODUCE
  const Icon = meta.icon
  const body = (
    <>
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', meta.tone)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{t.title}</p>
        <p className="truncate text-[13px] text-ink-muted">{t.detail}</p>
        {t.priority === 'HIGH' && <span className="mt-1 inline-block rounded-sm bg-danger-bg px-1.5 py-0.5 text-[11px] font-semibold text-danger">Prioridad alta</span>}
      </div>
      <span className="hidden shrink-0 items-center gap-1 rounded-sm bg-brand-700 px-3 py-2 text-[13px] font-semibold text-white sm:flex">
        {meta.cta} <ChevronRight className="size-4" />
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-placeholder sm:hidden" />
    </>
  )
  const cls = 'flex items-center gap-3 rounded-md border border-border bg-surface p-3 shadow-card transition-colors hover:border-brand-300 hover:bg-brand-50/40'
  if (t.type === 'CONFIRM_DISPATCH' && t.dispatchId) {
    return (
      <Link to="/taller/entregas/$dispatchId" params={{ dispatchId: t.dispatchId }} className={cls} data-testid={`task-${i}`}>
        {body}
      </Link>
    )
  }
  if (t.orderId) {
    return (
      <Link to="/taller/ordenes/$orderId" params={{ orderId: t.orderId }} className={cls} data-testid={`task-${i}`}>
        {body}
      </Link>
    )
  }
  return <div className={cls}>{body}</div>
}

/** P07 · Portal / Dashboard de taller (RF-034). */
export default function WorkshopHomePage() {
  const user = useUser()
  const q = useQuery({ queryKey: ['workshop-portal', 'dashboard'], queryFn: () => api.get<WorkshopDashboard>('/workshop-portal/dashboard'), refetchInterval: 60_000 })
  const alerts = useQuery({ queryKey: ['alerts', 'workshop', 'OPEN'], queryFn: () => api.get<Paginated<Alert>>('/alerts', { status: 'OPEN', pageSize: 20 }) })
  const d = q.data
  const firstName = user?.fullName?.split(' ')[0] ?? ''
  const orderNumber = (id: string | null) => (id ? d?.orders.find((o) => o.id === id)?.number : null)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        code="P07"
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={d ? `Taller ${d.workshop.code} · aquí ves solo tus órdenes, entregas y material en custodia.` : 'Portal del taller'}
        actions={
          <Link to="/taller/solicitudes" className="hidden sm:block">
            <Button variant="secondary"><FileSearch className="size-4" /> Solicitar material</Button>
          </Link>
        }
      />
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {d && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat testId="kpi-open-orders" icon={ClipboardList} label="Órdenes abiertas" value={formatNumber(d.kpis.openOrders)} hint="Asignadas a tu taller" />
              <Stat testId="kpi-overdue" icon={CalendarClock} tone={d.kpis.overdue ? 'danger' : 'default'} label="Retrasadas" value={formatNumber(d.kpis.overdue)} hint="Compromiso vencido" />
              <Stat testId="kpi-pending-dispatches" icon={Truck} tone={d.kpis.pendingDispatches ? 'warning' : 'default'} label="Entregas por confirmar" value={formatNumber(d.kpis.pendingDispatches)} hint="Material enviado" />
              <Stat testId="kpi-custody" icon={Boxes} tone="gold" label="En custodia" value={formatGrams(d.kpis.custodyGrams)} hint="Material bajo tu responsabilidad" />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
              <div className="space-y-5">
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[17px] font-semibold text-ink">Mis tareas</h2>
                    <span className="text-[13px] text-ink-muted">{d.tasks.length} pendiente(s)</span>
                  </div>
                  {d.tasks.length ? (
                    <div className="space-y-2" data-testid="workshop-tasks">
                      {d.tasks.map((t, i) => (
                        <TaskRow key={`${t.type}-${t.dispatchId ?? t.orderId ?? i}`} t={t} i={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success-bg p-4 text-[14px] text-success">
                      <CheckCircle2 className="size-5" /> No tienes tareas pendientes. ¡Todo al día!
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[17px] font-semibold text-ink">Órdenes asignadas</h2>
                    <Link to="/taller/ordenes" className="text-[13px] font-medium text-brand-700 hover:underline">Ver todas</Link>
                  </div>
                  {d.orders.length ? (
                    <div className="space-y-2">
                      {d.orders.map((o) => (
                        <OrderCard key={o.id} order={o} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-border bg-surface p-4 text-[14px] text-ink-muted">No tienes órdenes abiertas.</p>
                  )}
                </section>
              </div>

              <div className="space-y-5">
                <Card title="Material en custodia">
                  {d.custody.totals.length ? (
                    <>
                      <ul className="divide-y divide-border">
                        {d.custody.totals.map((c) => (
                          <li key={`${c.material.id}-${c.lot?.code ?? ''}`} className="flex items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <p className="text-[14px] font-medium text-ink">{c.material.name}</p>
                              <p className="text-[12px] text-ink-muted">{c.material.code}{c.lot ? ` · lote ${c.lot.code}` : ''}</p>
                            </div>
                            <span className="text-[15px] font-semibold text-ink tnum">{formatGrams(c.grams)}</span>
                          </li>
                        ))}
                      </ul>
                      {d.custody.byOrder.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="eyebrow mb-1.5">Por orden</p>
                          <ul className="space-y-1">
                            {d.custody.byOrder.map((c, i) => (
                              <li key={i} className="flex justify-between gap-3 text-[13px]">
                                <span className="truncate text-ink-secondary">
                                  {orderNumber(c.productionOrderId) ?? (c.productionOrderId ? 'Orden' : 'Sin orden asignada')} · {c.material.name}
                                </span>
                                <span className="font-medium text-ink tnum">{formatGrams(c.grams)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[14px] text-ink-muted">No tienes material en custodia.</p>
                  )}
                </Card>

                <Card title="Alertas de mi taller" actions={<Link to="/alertas" className="text-[13px] font-medium text-brand-700 hover:underline">Ver todas</Link>}>
                  {alerts.isLoading ? (
                    <p className="text-[13px] text-ink-muted">Cargando…</p>
                  ) : alerts.data?.items.length ? (
                    <div className="space-y-2">
                      {alerts.data.items.slice(0, 5).map((a) => (
                        <AlertRow key={a.id} a={a} />
                      ))}
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-[14px] text-ink-muted"><AlertTriangle className="size-4" /> Sin alertas abiertas.</p>
                  )}
                </Card>

                <Card title="Solicitudes de material" actions={<Link to="/taller/solicitudes" className="text-[13px] font-medium text-brand-700 hover:underline">Gestionar</Link>}>
                  {d.requests.length ? (
                    <ul className="divide-y divide-border">
                      {d.requests.slice(0, 5).map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium text-ink">{r.material.name} · {formatGrams(r.grams)}</p>
                            <p className="truncate text-[12px] text-ink-muted">{r.number}{r.order ? ` · ${r.order.number}` : ''} · {r.reason}</p>
                          </div>
                          <StatusBadge map={APPROVAL_STATUS} value={r.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[14px] text-ink-muted">No tienes solicitudes pendientes.</p>
                      <Link to="/taller/solicitudes"><Button variant="secondary" className="w-full sm:w-auto"><Wrench className="size-4" /> Nueva solicitud</Button></Link>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  )
}
