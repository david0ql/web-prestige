import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, Boxes, CalendarClock, ClipboardCheck, Coins, Factory, PackageCheck, Scale, TrendingUp, Truck, Wallet } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { Alert } from '@/lib/api/types'
import { formatDate, formatDateTime, formatGrams, formatMoney } from '@/lib/format'
import { ALERT_SEVERITY } from '@/lib/labels'
import { GOLD, GRID, SERIES, axisProps } from '@/lib/chart'
import { usePermission } from '@/lib/auth/store'
import { PageHeader } from '@/components/domain/PageHeader'
import { Stat } from '@/components/domain/Stat'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { ChartTooltip } from '@/components/domain/ChartTooltip'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface Dashboard {
  period: { from: string; to: string }
  kpis: Record<string, number | null>
  charts: {
    materialByWorkshop: { workshop: string; grams: number }[]
    productivityByWorkshop: { workshop: string; grams: number }[]
    monthlyProfitability: { month: string; revenue: number; costs: number; expenses: number }[]
    ordersByStatus: { status: string; label: string; count: number }[]
  }
  inventory: { material: string; code: string; office: number; workshops: number; transit: number; total: number; belowMin: boolean }[]
  overdue: { id: string; number: string; workshop: string; product: string; commitmentDate: string; status: string }[]
  recentAlerts: Alert[]
}

const short = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`)

/** P02 · Dashboard Oficina Madre (RF-033). */
export default function OfficeDashboardPage() {
  const financial = usePermission('reports.financial')
  const q = useQuery({ queryKey: ['dashboard', 'office'], queryFn: () => api.get<Dashboard>('/dashboard/office'), refetchInterval: 60_000 })
  const d = q.data
  return (
    <div>
      <PageHeader
        code="P02"
        title="Dashboard Oficina Madre"
        description={d ? `Control en tiempo real · mes ${formatDate(d.period.from, 'MMMM yyyy')}` : 'Control en tiempo real'}
        actions={
          <>
            <Link to="/balanza"><Button variant="secondary"><Scale className="size-4" /> Registrar entrada</Button></Link>
            <Link to="/ordenes/nueva"><Button><ClipboardCheck className="size-4" /> Nueva orden</Button></Link>
          </>
        }
      />
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {d && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
              <Stat testId="kpi-inventory" tone="gold" icon={Boxes} label="Inventario total" value={formatGrams(d.kpis.totalInventoryGrams)} hint={`Oficina ${formatGrams(d.kpis.officeGrams, 0)}`} />
              <Stat testId="kpi-workshops" icon={Truck} label="Material en talleres" value={formatGrams(d.kpis.workshopsGrams)} hint={`En tránsito ${formatGrams(d.kpis.transitGrams, 0)}`} />
              <Stat icon={Factory} label="Producción en proceso" value={`${d.kpis.ordersInProduction} órdenes`} hint={`${formatGrams(d.kpis.gramsInProduction, 0)} objetivo`} />
              <Stat icon={PackageCheck} label="Terminado este mes" value={formatGrams(d.kpis.finishedThisMonthGrams)} hint="Recibido en Oficina Madre" />
              <Stat icon={CalendarClock} tone={d.kpis.overdueOrders ? 'danger' : 'default'} label="Órdenes retrasadas" value={d.kpis.overdueOrders ?? 0} hint="Compromiso vencido" />
              <Stat icon={AlertTriangle} tone={d.kpis.openAlerts ? 'warning' : 'default'} label="Alertas abiertas" value={d.kpis.openAlerts ?? 0} hint={`${d.kpis.pendingApprovals} aprobaciones · ${d.kpis.pendingRequests} solicitudes`} />
              {financial ? (
                <>
                  <Stat icon={Wallet} label="Ventas del mes" value={formatMoney(d.kpis.salesThisMonth)} hint={`Costos ${formatMoney(d.kpis.costsThisMonth)}`} />
                  <Stat icon={Coins} tone={(d.kpis.profitThisMonth ?? 0) >= 0 ? 'success' : 'danger'} label="Utilidad del mes" value={formatMoney(d.kpis.profitThisMonth)} hint="Ventas − material − mano de obra − gastos" />
                </>
              ) : (
                <Stat icon={TrendingUp} label="Aprobaciones pendientes" value={d.kpis.pendingApprovals ?? 0} hint="Órdenes, diferencias y mano de obra" />
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Distribución de material por taller (g)">
                {d.charts.materialByWorkshop.length ? (
                  <div className="h-64" role="img" aria-label="Gramos en custodia por taller">
                    <ResponsiveContainer>
                      <BarChart data={d.charts.materialByWorkshop} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={GRID} />
                        <XAxis dataKey="workshop" {...axisProps} />
                        <YAxis {...axisProps} tickFormatter={short} width={56} />
                        <Tooltip cursor={{ fill: '#f5ead0' }} content={<ChartTooltip format={(v) => formatGrams(v)} />} />
                        <Bar dataKey="grams" name="En custodia" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={44}>
                          <LabelList dataKey="grams" position="top" formatter={(v) => short(Number(v))} style={{ fontSize: 11, fill: '#4a4336' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-16 text-center text-[13px] text-ink-muted">Sin material en custodia de talleres.</p>
                )}
              </Card>
              <Card title="Productividad del mes por taller (g terminados)">
                {d.charts.productivityByWorkshop.length ? (
                  <div className="h-64" role="img" aria-label="Gramos terminados por taller">
                    <ResponsiveContainer>
                      <BarChart data={d.charts.productivityByWorkshop} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={GRID} />
                        <XAxis dataKey="workshop" {...axisProps} />
                        <YAxis {...axisProps} tickFormatter={short} width={56} />
                        <Tooltip cursor={{ fill: '#e8f0fb' }} content={<ChartTooltip format={(v) => formatGrams(v)} />} />
                        <Bar dataKey="grams" name="Terminado" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={44}>
                          <LabelList dataKey="grams" position="top" formatter={(v) => short(Number(v))} style={{ fontSize: 11, fill: '#4a4336' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-16 text-center text-[13px] text-ink-muted">Aún no hay producción recibida este mes.</p>
                )}
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              {financial && (
                <Card title="Rentabilidad mensual (últimos 6 meses)">
                  {d.charts.monthlyProfitability.length ? (
                    <div className="h-64" role="img" aria-label="Ventas, costos y gastos por mes">
                      <ResponsiveContainer>
                        <LineChart data={d.charts.monthlyProfitability} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke={GRID} />
                          <XAxis dataKey="month" {...axisProps} />
                          <YAxis {...axisProps} width={72} tickFormatter={(v) => formatMoney(Number(v)).replace(/\s?COP/, '')} />
                          <Tooltip content={<ChartTooltip format={(v) => formatMoney(v)} />} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#4a4336' }} />
                          <Line type="monotone" dataKey="revenue" name="Ventas" stroke={SERIES[2]} strokeWidth={2} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="costs" name="Costos de producción" stroke={GOLD} strokeWidth={2} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="expenses" name="Gastos operativos" stroke={SERIES[4]} strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="py-16 text-center text-[13px] text-ink-muted">Sin movimientos financieros recientes.</p>
                  )}
                </Card>
              )}
              <Card title="Órdenes abiertas por estado" className={financial ? '' : 'lg:col-span-2'}>
                <ul className="space-y-2">
                  {d.charts.ordersByStatus.map((s) => {
                    const max = Math.max(...d.charts.ordersByStatus.map((x) => x.count))
                    return (
                      <li key={s.status} className="text-[12px]">
                        <div className="mb-0.5 flex justify-between text-ink-secondary">
                          <span>{s.label}</span>
                          <span className="font-semibold text-ink tnum">{s.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-sunken">
                          <div className="h-2 rounded-full gold-gradient" style={{ width: `${(s.count / max) * 100}%` }} />
                        </div>
                      </li>
                    )
                  })}
                  {!d.charts.ordersByStatus.length && <p className="text-[13px] text-ink-muted">No hay órdenes abiertas.</p>}
                </ul>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card title="Inventario por material" flush className="xl:col-span-2" actions={<Link to="/inventario" className="text-[12px] font-semibold text-brand-700">Ver inventario</Link>}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-y border-border bg-sunken/60">
                        {['Material', 'Oficina', 'Talleres', 'Tránsito', 'Total'].map((h, i) => (
                          <th key={h} className={`eyebrow px-4 py-2 ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.inventory.map((m) => (
                        <tr key={m.code} className="border-b border-border/70 last:border-0">
                          <td className="px-4 py-2">
                            <span className="font-medium">{m.material}</span> {m.belowMin && <Badge variant="warning" className="ml-1">Bajo mínimo</Badge>}
                          </td>
                          <td className="px-4 py-2 text-right tnum">{formatGrams(m.office)}</td>
                          <td className="px-4 py-2 text-right tnum">{formatGrams(m.workshops)}</td>
                          <td className="px-4 py-2 text-right tnum">{formatGrams(m.transit)}</td>
                          <td className="px-4 py-2 text-right font-semibold tnum">{formatGrams(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="space-y-4">
                <Card title="Retrasos" actions={<Link to="/ordenes" search={{}} className="text-[12px] font-semibold text-brand-700">Órdenes</Link>}>
                  <ul className="space-y-2">
                    {d.overdue.map((o) => (
                      <li key={o.id}>
                        <Link to="/ordenes/$orderId" params={{ orderId: o.id }} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-sunken">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold">{o.number}</p>
                            <p className="truncate text-[12px] text-ink-muted">{o.workshop} · {o.product}</p>
                          </div>
                          <span className="text-[12px] font-semibold text-danger">{formatDate(o.commitmentDate)}</span>
                        </Link>
                      </li>
                    ))}
                    {!d.overdue.length && <p className="text-[13px] text-ink-muted">Sin órdenes retrasadas. 👌</p>}
                  </ul>
                </Card>
                <Card title="Alertas recientes" actions={<Link to="/alertas" className="text-[12px] font-semibold text-brand-700">Todas</Link>}>
                  <ul className="space-y-2.5">
                    {d.recentAlerts.map((a) => (
                      <li key={a.id} className="text-[12px]">
                        <div className="flex items-center gap-2">
                          <StatusBadge map={ALERT_SEVERITY} value={a.severity} />
                          <span className="text-ink-muted">{formatDateTime(a.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 font-medium text-ink">{a.title}</p>
                      </li>
                    ))}
                    {!d.recentAlerts.length && <p className="text-[13px] text-ink-muted">Sin alertas abiertas.</p>}
                  </ul>
                </Card>
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  )
}
