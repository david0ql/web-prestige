import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Coins, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { TabularReport } from '@/lib/api/types'
import { formatMoney, formatPercent, todayIso } from '@/lib/format'
import { useCustomers } from '@/lib/hooks/useMasters'
import { GOLD, GRID, SERIES, axisProps } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { Stat } from '@/components/domain/Stat'
import { QueryState } from '@/components/domain/QueryState'
import { ChartTooltip } from '@/components/domain/ChartTooltip'
import { Card } from '@/components/ui/Card'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { DateFilter, ExportButtons, FilterBar, FilterItem, ProductFilter, ReportTable, WorkshopFilter, monthLabel, shortMoney, yearStartIso } from './components/reportKit'

interface ProfitReport extends TabularReport {
  summary: { revenue: number; cogs: number; grossProfit: number; operatingExpenses: number; netProfitOnSales: number; productionMaterialCost: number; productionLaborCost: number; consolidatedNet: number }
  charts?: { monthly: { month: string; revenue: number; costs: number; expenses: number }[] }
}

const GROUPS = [
  { value: 'month', label: 'Mes' },
  { value: 'product', label: 'Producto' },
  { value: 'customer', label: 'Cliente' },
  { value: 'workshop', label: 'Taller' },
]

/** P16 · Rentabilidad (RF-029/030, CA-011). */
export default function ProfitabilityPage() {
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [groupBy, setGroupBy] = useState('month')
  const [workshopId, setWorkshopId] = useState('')
  const [productId, setProductId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const { data: customers } = useCustomers()
  const base = { from, to, workshopId: workshopId || undefined, productId: productId || undefined }
  const params = { ...base, groupBy, customerId: customerId || undefined }

  const q = useQuery({ queryKey: ['report', 'profitability', params], queryFn: () => api.get<ProfitReport>('/reports/profitability', params), placeholderData: (p) => p })
  const costs = useQuery({ queryKey: ['report', 'production-costs', base], queryFn: () => api.get<TabularReport>('/reports/production-costs', base) })
  const s = q.data?.summary
  const margin = s && s.revenue ? (s.grossProfit / s.revenue) * 100 : null
  const cs = costs.data?.summary as Record<string, number> | undefined
  const finishedGrams = (costs.data?.rows ?? []).reduce((a, r) => a + Number(r.finishedGrams ?? 0), 0)

  return (
    <div>
      <PageHeader
        code="P16"
        title="Rentabilidad"
        description="Ventas, costo de material, mano de obra aprobada, gastos y utilidad bruta/neta por mes, producto, cliente y taller."
        actions={<ExportButtons path="/reports/profitability/export" params={params} name="rentabilidad" testId="profitability-export" />}
      />
      <FilterBar>
        <DateFilter label="Desde" value={from} onChange={setFrom} testId="filter-from" />
        <DateFilter label="Hasta" value={to} onChange={setTo} testId="filter-to" />
        <FilterItem label="Agrupar por" className="w-36">
          <NativeSelect data-testid="filter-groupby" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} options={GROUPS} />
        </FilterItem>
        <WorkshopFilter value={workshopId} onChange={setWorkshopId} />
        <ProductFilter value={productId} onChange={setProductId} />
        <FilterItem label="Cliente" className="w-52">
          <NativeSelect value={customerId} onChange={(e) => setCustomerId(e.target.value)} options={[{ value: '', label: 'Todos los clientes' }, ...(customers ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        </FilterItem>
      </FilterBar>

      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {s && q.data && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={Wallet} label="Ventas" value={formatMoney(s.revenue)} hint={`Costo de lo vendido ${formatMoney(s.cogs)}`} testId="kpi-revenue" />
              <Stat icon={s.grossProfit >= 0 ? TrendingUp : TrendingDown} tone={s.grossProfit >= 0 ? 'success' : 'danger'} label="Utilidad bruta" value={formatMoney(s.grossProfit)} hint={margin !== null ? `Margen ${formatPercent(margin)}` : 'Sin ventas en el período'} />
              <Stat icon={Receipt} label="Gastos operativos" value={formatMoney(s.operatingExpenses)} hint={`Neto sobre ventas ${formatMoney(s.netProfitOnSales)}`} />
              <Stat icon={Coins} tone={s.consolidatedNet >= 0 ? 'gold' : 'danger'} label="Utilidad neta consolidada" value={formatMoney(s.consolidatedNet)} hint="Ventas − material − mano de obra − gastos" testId="kpi-net" />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <Card title="Ingresos vs costos vs gastos por mes">
                {q.data.charts?.monthly.length ? (
                  <div className="h-72" role="img" aria-label="Ventas, costos de producción y gastos operativos por mes">
                    <ResponsiveContainer>
                      <LineChart data={q.data.charts.monthly.map((m) => ({ ...m, month: monthLabel(m.month) }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={GRID} />
                        <XAxis dataKey="month" {...axisProps} />
                        <YAxis {...axisProps} width={64} tickFormatter={(v) => shortMoney(Number(v))} />
                        <Tooltip content={<ChartTooltip format={(v) => formatMoney(v)} />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#4a4336' }} />
                        <Line type="monotone" dataKey="revenue" name="Ventas" stroke={SERIES[2]} strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="costs" name="Costos de producción" stroke={GOLD} strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="expenses" name="Gastos operativos" stroke={SERIES[4]} strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-20 text-center text-[13px] text-ink-muted">Sin movimientos en el período.</p>
                )}
              </Card>

              <Card title="Estado de resultados del período">
                <div className="space-y-0.5 text-[13px]" data-testid="pnl">
                  <PnlRow label="Ventas" value={s.revenue} />
                  <PnlRow label="(−) Costo de lo vendido" value={-s.cogs} muted />
                  <PnlRow label="Utilidad bruta" value={s.grossProfit} total />
                  <PnlRow label="(−) Gastos operativos" value={-s.operatingExpenses} muted />
                  <PnlRow label="Utilidad neta sobre ventas" value={s.netProfitOnSales} total />
                  <p className="eyebrow pt-4 pb-1">Consolidado de producción</p>
                  <PnlRow label="Ventas" value={s.revenue} />
                  <PnlRow label="(−) Costo material de producción" value={-s.productionMaterialCost} muted />
                  <PnlRow label="(−) Mano de obra aprobada" value={-s.productionLaborCost} muted />
                  <PnlRow label="(−) Gastos operativos" value={-s.operatingExpenses} muted />
                  <PnlRow label="Utilidad neta consolidada" value={s.consolidatedNet} total strong />
                </div>
              </Card>
            </div>

            <Card flush title={`Rentabilidad por ${GROUPS.find((g) => g.value === groupBy)?.label.toLowerCase()}`}>
              <ReportTable report={{ ...q.data, rows: groupBy === 'month' ? q.data.rows.map((r) => ({ ...r, group: monthLabel(String(r.group)) })) : q.data.rows }} testId="profitability-table" />
            </Card>

            <Card
              flush
              title="Costos por producción (orden)"
              actions={
                <div className="flex items-center gap-3">
                  {cs && <span className="hidden text-[12px] text-ink-muted md:inline">Total {formatMoney(cs.total)} · material {formatMoney(cs.material)} · mano de obra {formatMoney(cs.labor)}{finishedGrams ? ` · costo medio ${formatMoney(Number(cs.total) / finishedGrams)}/g` : ''}</span>}
                  <ExportButtons path="/reports/production-costs/export" params={base} name="costos-produccion" csv={false} testId="costs-export" />
                </div>
              }
            >
              <QueryState isLoading={costs.isLoading} error={costs.error}>
                {costs.data && <ReportTable report={costs.data} testId="production-costs-table" empty="Sin órdenes cerradas en el período" />}
              </QueryState>
            </Card>
          </div>
        )}
      </QueryState>
    </div>
  )
}

function PnlRow({ label, value, total, muted, strong }: { label: string; value: number; total?: boolean; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1', total && 'border-t border-border pt-1.5 font-semibold', strong && 'text-[15px]')}>
      <span className={muted ? 'text-ink-secondary' : 'text-ink'}>{label}</span>
      <span className={cn('tnum', value < 0 && total ? 'text-danger' : muted ? 'text-ink-secondary' : 'text-ink')}>{formatMoney(value)}</span>
    </div>
  )
}
