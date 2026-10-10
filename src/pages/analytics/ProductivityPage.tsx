import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarCheck, Clock, Factory, Package, Percent, TrendingDown, TriangleAlert } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { TabularReport } from '@/lib/api/types'
import { formatGrams, formatNumber, formatPercent, todayIso } from '@/lib/format'
import { GOLD, GRID, SERIES, axisProps, colorFor, legendInk } from '@/lib/chart'
import { PageHeader } from '@/components/domain/PageHeader'
import { Stat } from '@/components/domain/Stat'
import { QueryState } from '@/components/domain/QueryState'
import { ChartTooltip } from '@/components/domain/ChartTooltip'
import { Card } from '@/components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { DateFilter, ExportButtons, FilterBar, ProductFilter, ReportTable, WorkshopFilter, monthLabel, shortGrams, yearStartIso } from './components/reportKit'

interface ProductivityReport extends TabularReport {
  charts?: { byWorkshop: { workshop: string; grams: number }[]; compliance: { workshop: string; onTime: number; late: number; onTimePct: number; avgLeadDays: number }[] }
}

const TABS = [
  { key: 'productivity', label: 'Productividad', file: 'productividad' },
  { key: 'compliance', label: 'Cumplimiento', file: 'cumplimiento' },
  { key: 'losses', label: 'Mermas y diferencias', file: 'mermas' },
  { key: 'consumption-vs-standard', label: 'Consumo vs estándar', file: 'consumo-vs-estandar' },
] as const

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0))

/** P15 · Productividad de talleres (RF-031/032, CA-010). */
export default function ProductivityPage() {
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [workshopId, setWorkshopId] = useState('')
  const [productId, setProductId] = useState('')
  const [tab, setTab] = useState<string>('productivity')
  const params = { from, to, workshopId: workshopId || undefined, productId: productId || undefined }

  const prod = useQuery({ queryKey: ['report', 'productivity', params], queryFn: () => api.get<ProductivityReport>('/reports/productivity', params) })
  const comp = useQuery({ queryKey: ['report', 'compliance', params], queryFn: () => api.get<TabularReport>('/reports/compliance', params) })
  const loss = useQuery({ queryKey: ['report', 'losses', params], queryFn: () => api.get<TabularReport & { charts?: { trend: { month: string; grams: number }[] } }>('/reports/losses', params) })
  const cons = useQuery({ queryKey: ['report', 'consumption-vs-standard', params], queryFn: () => api.get<TabularReport>('/reports/consumption-vs-standard', params) })
  const reports: Record<string, TabularReport | undefined> = { productivity: prod.data, compliance: comp.data, losses: loss.data, 'consumption-vs-standard': cons.data }

  // Pivot mes × taller para el comparativo mensual (color estable por taller).
  const monthly = useMemo(() => {
    const rows = prod.data?.rows ?? []
    const workshops = [...new Set(rows.map((r) => String(r.workshop)))].sort()
    const months = [...new Set(rows.map((r) => String(r.month)))].sort()
    const data = months.map((m) => {
      const o: Record<string, number | string> = { month: monthLabel(m) }
      for (const w of workshops) o[w] = rows.filter((r) => r.month === m && r.workshop === w).reduce((a, r) => a + n(r.grams), 0)
      return o
    })
    return { workshops, data }
  }, [prod.data])

  const cs = comp.data?.summary ?? {}
  const ps = prod.data?.summary ?? {}
  const ls = loss.data?.summary ?? {}
  const active = TABS.find((t) => t.key === tab)!

  return (
    <div>
      <PageHeader
        code="P15"
        title="Productividad de talleres"
        description="Producción por período, cumplimiento de compromisos, retrasos, mermas y desempeño comparativo por taller."
        actions={<ExportButtons path={`/reports/${active.key}/export`} params={params} name={active.file} testId="productivity-export" />}
      />
      <FilterBar>
        <DateFilter label="Desde" value={from} onChange={setFrom} testId="filter-from" />
        <DateFilter label="Hasta" value={to} onChange={setTo} testId="filter-to" />
        <WorkshopFilter value={workshopId} onChange={setWorkshopId} />
        <ProductFilter value={productId} onChange={setProductId} />
      </FilterBar>

      <QueryState isLoading={prod.isLoading} error={prod.error} onRetry={() => void prod.refetch()}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat icon={Factory} tone="gold" label="Gramos terminados" value={formatGrams(ps.totalGrams)} hint="Recibido en Oficina Madre" testId="kpi-grams" />
            <Stat icon={Package} label="Unidades" value={formatNumber(ps.totalUnits)} />
            <Stat icon={CalendarCheck} tone={n(cs.onTimePct) >= 90 ? 'success' : n(cs.late) > 0 ? 'warning' : 'default'} label="Entregas a tiempo" value={formatPercent(cs.onTimePct)} hint={`${formatNumber(cs.onTime)} a tiempo · ${formatNumber(cs.late)} retrasadas`} testId="kpi-ontime" />
            <Stat icon={Clock} label="Tiempo de ciclo" value={`${formatNumber(cs.avgLeadTimeDays, 1)} d`} hint="Promedio despacho → entrega" />
            <Stat icon={Percent} label="Desviación promedio" value={`${formatNumber(cs.avgDeviationDays, 1)} d`} hint="Negativo = antes del compromiso" />
            <Stat icon={TrendingDown} tone={n(ls.pending) > 0 ? 'warning' : 'default'} label="Mermas" value={formatGrams(ls.totalGrams)} hint={`${formatNumber(ls.pending)} pendientes · ${formatNumber(cons.data?.summary?.outOfStandard)} fuera de estándar`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Gramos terminados por taller">
              {prod.data?.charts?.byWorkshop.length ? (
                <div className="h-64" role="img" aria-label="Gramos terminados por taller">
                  <ResponsiveContainer>
                    <BarChart data={prod.data.charts.byWorkshop} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="workshop" {...axisProps} />
                      <YAxis {...axisProps} tickFormatter={(v) => shortGrams(Number(v))} width={60} />
                      <Tooltip cursor={{ fill: '#f5ead0' }} content={<ChartTooltip format={(v) => formatGrams(v)} />} />
                      <Bar dataKey="grams" name="Terminado" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={48}>
                        <LabelList dataKey="grams" position="top" formatter={(v) => shortGrams(Number(v))} style={{ fontSize: 11, fill: '#4a4336' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty text="Sin producción recibida en el período." />
              )}
            </Card>
            <Card title="Cumplimiento de compromisos por taller (órdenes)">
              {prod.data?.charts?.compliance.length ? (
                <div className="h-64" role="img" aria-label="Órdenes a tiempo y retrasadas por taller">
                  <ResponsiveContainer>
                    <BarChart data={prod.data.charts.compliance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="workshop" {...axisProps} />
                      <YAxis {...axisProps} allowDecimals={false} width={36} />
                      <Tooltip cursor={{ fill: '#f1ede4' }} content={<ChartTooltip format={(v) => `${formatNumber(v)} órdenes`} />} />
                      <Legend formatter={legendInk} iconType="circle" wrapperStyle={{ fontSize: 12, color: '#4a4336' }} />
                      <Bar dataKey="onTime" name="A tiempo" stackId="c" fill={SERIES[2]} maxBarSize={48} />
                      <Bar dataKey="late" name="Retrasadas" stackId="c" fill={SERIES[5]} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty text="Sin entregas en el período." />
              )}
            </Card>
            <Card title="Producción mensual por taller (g)">
              {monthly.data.length ? (
                <div className="h-64" role="img" aria-label="Gramos terminados por mes y taller">
                  <ResponsiveContainer>
                    <BarChart data={monthly.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="month" {...axisProps} />
                      <YAxis {...axisProps} tickFormatter={(v) => shortGrams(Number(v))} width={60} />
                      <Tooltip cursor={{ fill: '#f1ede4' }} content={<ChartTooltip format={(v) => formatGrams(v)} />} />
                      {monthly.workshops.length >= 2 && <Legend formatter={legendInk} iconType="circle" wrapperStyle={{ fontSize: 12, color: '#4a4336' }} />}
                      {monthly.workshops.map((w) => <Bar key={w} dataKey={w} name={w} fill={colorFor(w, monthly.workshops)} radius={[4, 4, 0, 0]} maxBarSize={36} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty text="Sin producción en el período." />
              )}
            </Card>
            <Card title="Tendencia de mermas (g)">
              {loss.data?.charts?.trend.length ? (
                <div className="h-64" role="img" aria-label="Gramos de merma por mes">
                  <ResponsiveContainer>
                    <BarChart data={loss.data.charts.trend.map((t) => ({ ...t, month: monthLabel(t.month) }))} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="month" {...axisProps} />
                      <YAxis {...axisProps} tickFormatter={(v) => shortGrams(Number(v))} width={56} />
                      <Tooltip cursor={{ fill: '#f1ede4' }} content={<ChartTooltip format={(v) => formatGrams(v)} />} />
                      <Bar dataKey="grams" name="Merma" fill={SERIES[4]} radius={[4, 4, 0, 0]} maxBarSize={44}>
                        <LabelList dataKey="grams" position="top" formatter={(v) => shortGrams(Number(v))} style={{ fontSize: 11, fill: '#4a4336' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty text="Sin mermas registradas en el período." />
              )}
            </Card>
          </div>

          <Card flush>
            <Tabs value={tab} onValueChange={setTab}>
              <div className="px-4 pt-3">
                <TabsList className="overflow-x-auto">
                  {TABS.map((t) => <TabsTrigger key={t.key} value={t.key} count={reports[t.key]?.rows.length}>{t.label}</TabsTrigger>)}
                </TabsList>
              </div>
              {TABS.map((t) => (
                <TabsContent key={t.key} value={t.key}>
                  {reports[t.key]?.description && <p className="px-4 pt-3 text-[12px] text-ink-muted">{reports[t.key]!.description}</p>}
                  {t.key === 'consumption-vs-standard' && n(cons.data?.summary?.outOfStandard) > 0 && (
                    <p className="mx-4 mt-3 flex items-center gap-1.5 rounded-md bg-warning-bg px-3 py-2 text-[12px] text-warning"><TriangleAlert className="size-3.5" /> {cons.data?.summary?.outOfStandard} consumos fuera del estándar parametrizado.</p>
                  )}
                  <div className="mt-2">{reports[t.key] ? <ReportTable report={reports[t.key]!} testId={`table-${t.key}`} /> : <p className="p-6 text-center text-[13px] text-ink-muted">Cargando…</p>}</div>
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        </div>
      </QueryState>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-16 text-center text-[13px] text-ink-muted">{text}</p>
}
