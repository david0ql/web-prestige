import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Coins, FileBarChart, Shield } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { TabularReport } from '@/lib/api/types'
import { formatGrams, formatMoney, formatNumber, formatPercent, todayIso } from '@/lib/format'
import { useCustomers, useLocations } from '@/lib/hooks/useMasters'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Input } from '@/components/ui/Input'
import { DateFilter, ExportButtons, FilterBar, FilterItem, MaterialFilter, ProductFilter, ReportTable, WorkshopFilter, yearStartIso } from './components/reportKit'

interface ReportDef { key: string; title: string; financial?: boolean; audit?: boolean }
type FilterKey = 'dates' | 'workshop' | 'product' | 'material' | 'customer' | 'location' | 'groupBy' | 'entityType' | 'action'

/** Filtros que aplica cada reporte en la API (sección 15). */
const FILTERS: Record<string, FilterKey[]> = {
  'inventory-global': [],
  kardex: ['dates', 'material', 'location'],
  'workshop-material': ['workshop'],
  orders: ['dates', 'workshop', 'product'],
  productivity: ['dates', 'workshop', 'product'],
  compliance: ['dates', 'workshop'],
  'consumption-vs-standard': ['dates', 'workshop', 'product'],
  losses: ['dates', 'workshop'],
  'production-costs': ['dates', 'workshop', 'product'],
  profitability: ['dates', 'groupBy', 'workshop', 'product', 'customer'],
  customers: ['customer'],
  audit: ['dates', 'entityType', 'action'],
  catalog: [],
  'visual-traceability': ['dates', 'workshop'],
  'purity-control': ['dates', 'workshop', 'product'],
}
const HINTS: Record<string, string> = { kardex: 'Selecciona un material para ver su kardex (entradas, salidas, devoluciones, ajustes y saldo).' }

const SUMMARY_LABELS: Record<string, string> = {
  totalGrams: 'Gramos totales', inWorkshops: 'En talleres', totalUnits: 'Unidades', orders: 'Órdenes', overdue: 'Retrasadas', delivered: 'Entregadas',
  onTime: 'A tiempo', late: 'Retrasadas', onTimePct: 'Cumplimiento', avgLeadTimeDays: 'Tiempo de ciclo (días)', avgDeviationDays: 'Desviación (días)',
  outOfStandard: 'Fuera de estándar', pending: 'Pendientes', total: 'Costo total', material: 'Material', labor: 'Mano de obra', revenue: 'Ventas',
  cogs: 'Costo de lo vendido', grossProfit: 'Utilidad bruta', operatingExpenses: 'Gastos operativos', netProfitOnSales: 'Neto sobre ventas',
  productionMaterialCost: 'Costo material producción', productionLaborCost: 'Mano de obra aprobada', consolidatedNet: 'Utilidad neta consolidada',
  verifications: 'Verificaciones', nonConforming: 'No conformes', entries: 'Entradas', exits: 'Salidas', balance: 'Saldo',
}
const MONEY_KEYS = ['total', 'material', 'labor', 'revenue', 'cogs', 'grossProfit', 'operatingExpenses', 'netProfitOnSales', 'productionMaterialCost', 'productionLaborCost', 'consolidatedNet']

function formatSummary(key: string, v: number | string) {
  if (typeof v === 'string') return v
  if (MONEY_KEYS.includes(key)) return formatMoney(v)
  if (/grams|inWorkshops|balance|entries|exits/i.test(key)) return formatGrams(v)
  if (/pct/i.test(key)) return formatPercent(v)
  return formatNumber(v, 1)
}

const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'APPROVE', 'REJECT', 'REVERSE', 'STATUS_CHANGE', 'SIGN', 'OVERRIDE', 'ACCESS', 'EXPORT', 'HIDE', 'LOGIN', 'LOGIN_FAILED']

/** Centro de reportes (sección 15, RF-040): reportes tabulares exportables a Excel/CSV. */
export default function ReportsPage() {
  const list = useQuery({ queryKey: ['reports', 'list'], queryFn: () => api.get<ReportDef[]>('/reports') })
  const [key, setKey] = useState<string>('')
  const [from, setFrom] = useState(yearStartIso())
  const [to, setTo] = useState(todayIso())
  const [workshopId, setWorkshopId] = useState('')
  const [productId, setProductId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [groupBy, setGroupBy] = useState('month')
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const { data: customers } = useCustomers()
  const { data: locations } = useLocations()

  const current = key || list.data?.[0]?.key || ''
  const def = list.data?.find((r) => r.key === current)
  const filters = FILTERS[current] ?? ['dates']
  const params = useMemo(() => {
    const p: Record<string, string | undefined> = {}
    if (filters.includes('dates')) Object.assign(p, { from, to })
    if (filters.includes('workshop')) p.workshopId = workshopId || undefined
    if (filters.includes('product')) p.productId = productId || undefined
    if (filters.includes('material')) p.materialId = materialId || undefined
    if (filters.includes('customer')) p.customerId = customerId || undefined
    if (filters.includes('location')) p.locationId = locationId || undefined
    if (filters.includes('groupBy')) p.groupBy = groupBy
    if (filters.includes('entityType')) p.entityType = entityType || undefined
    if (filters.includes('action')) p.action = action || undefined
    return p
  }, [filters, from, to, workshopId, productId, materialId, customerId, locationId, groupBy, entityType, action])

  const report = useQuery({
    queryKey: ['report', current, params],
    queryFn: () => api.get<TabularReport>(`/reports/${current}`, params),
    enabled: !!current,
    placeholderData: (p) => (p?.key === current ? p : undefined),
  })
  const summary = Object.entries(report.data?.summary ?? {})

  const groups = useMemo(() => {
    const items = list.data ?? []
    return [
      { title: 'Operación y producción', icon: BarChart3, items: items.filter((r) => !r.financial && !r.audit) },
      { title: 'Financieros', icon: Coins, items: items.filter((r) => r.financial) },
      { title: 'Control', icon: Shield, items: items.filter((r) => r.audit) },
    ].filter((g) => g.items.length)
  }, [list.data])

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Reportes operativos y financieros con filtros comunes, exportables a Excel o CSV (RF-040)."
        actions={current && <ExportButtons path={`/reports/${current}/export`} params={params} name={current} testId="report-export" />}
      />
      <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}>
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="lg:hidden">
            <NativeSelect data-testid="report-select" value={current} onChange={(e) => setKey(e.target.value)} options={(list.data ?? []).map((r) => ({ value: r.key, label: r.title }))} />
          </div>
          <nav className="hidden space-y-4 lg:block" aria-label="Reportes disponibles">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="eyebrow mb-1.5 flex items-center gap-1.5"><g.icon className="size-3.5" /> {g.title}</p>
                <ul className="space-y-0.5">
                  {g.items.map((r) => (
                    <li key={r.key}>
                      <button
                        type="button"
                        data-testid={`report-${r.key}`}
                        onClick={() => setKey(r.key)}
                        className={cn('w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors', r.key === current ? 'bg-brand-100 font-semibold text-brand-900' : 'text-ink-secondary hover:bg-sunken hover:text-ink')}
                      >
                        {r.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="min-w-0">
            {current ? (
              <>
                {filters.length > 0 && (
                  <FilterBar>
                    {filters.includes('dates') && <DateFilter label="Desde" value={from} onChange={setFrom} testId="filter-from" />}
                    {filters.includes('dates') && <DateFilter label="Hasta" value={to} onChange={setTo} testId="filter-to" />}
                    {filters.includes('groupBy') && (
                      <FilterItem label="Agrupar por" className="w-36">
                        <NativeSelect value={groupBy} onChange={(e) => setGroupBy(e.target.value)} options={[{ value: 'month', label: 'Mes' }, { value: 'product', label: 'Producto' }, { value: 'customer', label: 'Cliente' }, { value: 'workshop', label: 'Taller' }]} />
                      </FilterItem>
                    )}
                    {filters.includes('workshop') && <WorkshopFilter value={workshopId} onChange={setWorkshopId} />}
                    {filters.includes('product') && <ProductFilter value={productId} onChange={setProductId} />}
                    {filters.includes('material') && <MaterialFilter value={materialId} onChange={setMaterialId} />}
                    {filters.includes('location') && (
                      <FilterItem label="Ubicación">
                        <NativeSelect value={locationId} onChange={(e) => setLocationId(e.target.value)} options={[{ value: '', label: 'Todas las ubicaciones' }, ...(locations ?? []).map((l) => ({ value: l.id, label: l.name }))]} />
                      </FilterItem>
                    )}
                    {filters.includes('customer') && (
                      <FilterItem label="Cliente" className="w-52">
                        <NativeSelect value={customerId} onChange={(e) => setCustomerId(e.target.value)} options={[{ value: '', label: 'Todos los clientes' }, ...(customers ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
                      </FilterItem>
                    )}
                    {filters.includes('entityType') && (
                      <FilterItem label="Entidad">
                        <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="p. ej. ProductionOrder" />
                      </FilterItem>
                    )}
                    {filters.includes('action') && (
                      <FilterItem label="Acción">
                        <NativeSelect value={action} onChange={(e) => setAction(e.target.value)} options={[{ value: '', label: 'Todas' }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: a }))]} />
                      </FilterItem>
                    )}
                  </FilterBar>
                )}
                <QueryState isLoading={report.isLoading} error={report.error} onRetry={() => void report.refetch()}>
                  {report.data && (
                    <div className="space-y-4">
                      {summary.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="report-summary">
                          {summary.map(([k, v]) => (
                            <div key={k} className="rounded-md border border-border bg-surface p-3 shadow-card">
                              <p className="eyebrow">{SUMMARY_LABELS[k] ?? k}</p>
                              <p className="mt-1 text-[18px] font-semibold text-ink tnum">{formatSummary(k, v)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <Card flush>
                        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
                          <div>
                            <h2 className="text-[15px] font-semibold text-ink">{report.data.title ?? def?.title}</h2>
                            {report.data.description && <p className="text-[12px] text-ink-muted">{report.data.description}</p>}
                          </div>
                          <span className="text-[12px] text-ink-muted tnum">{formatNumber(report.data.rows.length)} filas</span>
                        </header>
                        <ReportTable report={report.data} testId="report-table" empty={HINTS[current]} />
                      </Card>
                    </div>
                  )}
                </QueryState>
              </>
            ) : (
              <EmptyState icon={FileBarChart} title="Sin reportes disponibles" description="Tu rol no tiene reportes habilitados." />
            )}
          </div>
        </div>
      </QueryState>
    </div>
  )
}
