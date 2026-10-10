import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, Boxes, Building2, ChevronRight, Lock, Truck, Warehouse } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { GlobalSummaryRow } from '@/lib/api/types'
import { formatGrams, formatPurity } from '@/lib/format'
import { GRID, SERIES, axisProps } from '@/lib/chart'
import { cn } from '@/lib/cn'
import { Stat } from '@/components/domain/Stat'
import { QueryState } from '@/components/domain/QueryState'
import { ChartTooltip } from '@/components/domain/ChartTooltip'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { shortGrams } from './shared'

const TRANSIT_COLOR = '#a39a8a'

/** P04 (a) · Resumen global por material (RF-005, RN-004, CA-002). */
export function SummaryTab() {
  const q = useQuery({ queryKey: ['inventory', 'summary'], queryFn: () => api.get<GlobalSummaryRow[]>('/inventory/summary') })
  const rows = useMemo(() => [...(q.data ?? [])].sort((a, b) => b.total - a.total), [q.data])
  const [open, setOpen] = useState<Record<string, boolean>>({})

  // Talleres en orden fijo (código) → color estable por entidad.
  const workshops = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>()
    rows.forEach((r) => r.byWorkshop.forEach((w) => map.set(w.workshopId, { id: w.workshopId, code: w.code, name: w.name })))
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [rows])
  const wsColor = (id: string) => SERIES[(workshops.findIndex((w) => w.id === id) + 1) % SERIES.length]

  const totals = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, office: acc.office + r.office, workshops: acc.workshops + r.workshops, transit: acc.transit + r.transit, committed: acc.committed + r.committed }),
    { total: 0, office: 0, workshops: 0, transit: 0, committed: 0 },
  )
  const below = rows.filter((r) => r.belowMin)

  const chartData = rows.map((r) => {
    const d: Record<string, number | string> = { material: r.material.code, name: r.material.name, office: r.office, transit: r.transit }
    r.byWorkshop.forEach((w) => (d[w.workshopId] = w.grams))
    return d
  })

  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
      {rows.length === 0 ? (
        <EmptyState icon={Boxes} title="Sin existencias" description="Registra una entrada en la Balanza Madre para iniciar el inventario." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Stat testId="inv-kpi-total" tone="gold" icon={Boxes} label="Total bajo control" value={formatGrams(totals.total)} hint={`${rows.length} materiales`} />
            <Stat icon={Warehouse} label="Oficina Madre" value={formatGrams(totals.office)} hint={`Comprometido ${formatGrams(totals.committed, 0)}`} />
            <Stat icon={Building2} label="En custodia de talleres" value={formatGrams(totals.workshops)} hint={`${workshops.length} talleres con material`} />
            <Stat icon={Truck} label="En tránsito" value={formatGrams(totals.transit)} hint="Pendiente de aceptación" />
            <Stat icon={AlertTriangle} tone={below.length ? 'warning' : 'default'} label="Bajo mínimo" value={below.length} hint={below.length ? below.map((b) => b.material.code).join(', ') : 'Todo sobre el mínimo'} />
          </div>

          <Card title="Distribución por ubicación (g)">
            <div className="h-72" role="img" aria-label="Gramos por material en Oficina Madre, tránsito y cada taller">
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" {...axisProps} tickFormatter={shortGrams} />
                  <YAxis type="category" dataKey="material" {...axisProps} width={64} />
                  <Tooltip cursor={{ fill: '#f5ead0' }} content={<ChartTooltip format={(v) => formatGrams(v)} />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: '#4a4336' }}>{v}</span>} />
                  <Bar dataKey="office" name="Oficina Madre" stackId="a" fill={SERIES[0]} />
                  {workshops.map((w) => (
                    <Bar key={w.id} dataKey={w.id} name={`Taller ${w.name}`} stackId="a" fill={wsColor(w.id)} />
                  ))}
                  <Bar dataKey="transit" name="Tránsito" stackId="a" fill={TRANSIT_COLOR} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card flush title="Existencias por material" actions={<span className="text-[12px] text-ink-muted">El material en talleres sigue siendo de Prestige Gold (RN-004)</span>}>
            <div className="overflow-x-auto">
              <table data-testid="inventory-summary-table" className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-y border-border bg-sunken/60">
                    {['Material', 'Oficina', 'Comprometido', 'Disponible', 'Talleres', 'Tránsito', 'Total', 'Mínimo'].map((h, i) => (
                      <th key={h} className={cn('eyebrow px-3 py-2 whitespace-nowrap', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const expanded = !!open[r.material.id]
                    const canExpand = r.byWorkshop.length > 0 || r.transit > 0
                    return (
                      <Fragment key={r.material.id}>
                        <tr
                          className={cn('border-b border-border/70', canExpand && 'cursor-pointer hover:bg-brand-50/60', expanded && 'bg-brand-50/40')}
                          onClick={() => canExpand && setOpen((o) => ({ ...o, [r.material.id]: !o[r.material.id] }))}
                          data-testid={`summary-row-${r.material.code}`}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <ChevronRight className={cn('size-3.5 shrink-0 text-ink-muted transition-transform', expanded && 'rotate-90', !canExpand && 'invisible')} />
                              <div>
                                <p className="font-medium text-ink">{r.material.name}</p>
                                <p className="text-[11px] text-ink-muted">{r.material.code} · {r.material.category?.name} · {formatPurity(r.material.purity)}</p>
                              </div>
                            </div>
                          </td>
                          <Num v={r.office} />
                          <Num v={r.committed} muted={!r.committed} icon={r.committed > 0 ? <Lock className="size-3 text-ink-muted" /> : undefined} />
                          <Num v={r.available} danger={r.available < 0} strong />
                          <Num v={r.workshops} muted={!r.workshops} />
                          <Num v={r.transit} muted={!r.transit} />
                          <Num v={r.total} strong />
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <span className="text-ink-secondary tnum">{r.minStock ? formatGrams(r.minStock, 0) : '—'}</span>
                            {r.belowMin && <Badge variant="warning" className="ml-2">Bajo mínimo</Badge>}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-border/70 bg-page/60">
                            <td colSpan={8} className="px-3 py-3 pl-9">
                              <WorkshopBars row={r} colorFor={wsColor} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </QueryState>
  )
}

function Num({ v, strong, muted, danger, icon }: { v: number; strong?: boolean; muted?: boolean; danger?: boolean; icon?: ReactNode }) {
  return (
    <td className={cn('px-3 py-2.5 text-right whitespace-nowrap tnum', strong ? 'font-semibold text-ink' : 'text-ink-secondary', muted && 'text-ink-muted', danger && 'text-danger')}>
      <span className="inline-flex items-center gap-1">{icon}{muted && v === 0 ? '—' : formatGrams(v)}</span>
    </td>
  )
}

function WorkshopBars({ row, colorFor }: { row: GlobalSummaryRow; colorFor: (id: string) => string }) {
  const items = [
    { key: 'office', label: 'Oficina Madre', grams: row.office, color: SERIES[0] },
    ...row.byWorkshop.map((w) => ({ key: w.workshopId, label: `Taller ${w.name} (${w.code})`, grams: w.grams, color: colorFor(w.workshopId) })),
    ...(row.transit ? [{ key: 'transit', label: 'En tránsito', grams: row.transit, color: TRANSIT_COLOR }] : []),
  ]
  const max = Math.max(...items.map((i) => i.grams), 1)
  return (
    <ul className="grid max-w-3xl gap-1.5">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[180px_1fr_90px_52px] items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1.5 truncate text-ink-secondary">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
            {i.label}
          </span>
          <div className="h-2 rounded-full bg-sunken">
            <div className="h-2 rounded-full" style={{ width: `${(Math.max(i.grams, 0) / max) * 100}%`, backgroundColor: i.color }} />
          </div>
          <span className="text-right font-medium text-ink tnum">{formatGrams(i.grams)}</span>
          <span className="text-right text-ink-muted tnum">{row.total ? `${Math.round((i.grams / row.total) * 100)} %` : '—'}</span>
        </li>
      ))}
    </ul>
  )
}
