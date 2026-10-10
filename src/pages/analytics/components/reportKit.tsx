import { useState, type ReactNode } from 'react'
import { Check, Download, FileSpreadsheet, Minus } from 'lucide-react'
import { api, errorMessage } from '@/lib/api/client'
import type { ReportColumn, TabularReport } from '@/lib/api/types'
import { hasPermission, useUser } from '@/lib/auth/store'
import { formatDate, formatDateTime, formatGrams, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { useMaterials, useProducts, useWorkshops } from '@/lib/hooks/useMasters'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { notify } from '@/components/ui/Toaster'

/** Exige TODOS los permisos (la API usa semántica "todos" en RequirePermissions). */
export function useAllPermissions(...perms: string[]) {
  const user = useUser()
  return perms.every((p) => hasPermission(user, p))
}

export type CellType = NonNullable<ReportColumn['type']>

/** Formatea un valor de reporte tabular según el tipo de la columna. */
export function formatCell(type: CellType | undefined, value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return <span className="text-ink-placeholder">—</span>
  switch (type) {
    case 'grams':
      return formatGrams(value as number)
    case 'money':
      return formatMoney(value as number)
    case 'number':
      return formatNumber(value as number, 2)
    case 'percent':
      return formatPercent(value as number)
    case 'date':
      return formatDate(value as string)
    case 'datetime':
      return formatDateTime(value as string)
    case 'boolean':
      return value ? (
        <span className="inline-flex items-center gap-1 text-success"><Check className="size-3.5" /> Sí</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-ink-muted"><Minus className="size-3.5" /> No</span>
      )
    default:
      if (typeof value === 'object') {
        const json = JSON.stringify(value)
        return <span className="font-mono text-[11px] text-ink-secondary" title={json}>{json.length > 80 ? `${json.slice(0, 80)}…` : json}</span>
      }
      if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return monthLabel(value)
      return String(value)
  }
}

const NUMERIC: CellType[] = ['grams', 'money', 'number', 'percent']

/** Tabla genérica para cualquier reporte tabular de la API. */
export function ReportTable({ report, testId, empty }: { report: TabularReport; testId?: string; empty?: string }) {
  const columns: Column<Record<string, unknown>>[] = report.columns.map((c) => ({
    key: c.key,
    header: c.label,
    align: c.type && NUMERIC.includes(c.type) ? 'right' : c.type === 'boolean' ? 'center' : 'left',
    cell: (r) =>
      !c.type || c.type === 'text' ? (
        <span className="block max-w-[26rem] truncate" title={typeof r[c.key] === 'string' ? (r[c.key] as string) : undefined}>{formatCell(c.type, r[c.key])}</span>
      ) : (
        formatCell(c.type, r[c.key])
      ),
    className: 'whitespace-nowrap',
  }))
  return (
    <DataTable
      dense
      testId={testId}
      columns={columns}
      rows={report.rows}
      rowKey={(r) => JSON.stringify(r).slice(0, 200) + report.rows.indexOf(r)}
      empty={{ title: empty ?? 'Sin datos para los filtros seleccionados' }}
    />
  )
}

/** Botones de exportación (RF-040). Solo visibles con `reports.export`. */
export function ExportButtons({ path, params, name, csv = true, testId = 'export' }: { path: string; params: Record<string, string | undefined>; name: string; csv?: boolean; testId?: string }) {
  const can = useAllPermissions('reports.export')
  const [busy, setBusy] = useState<string | null>(null)
  if (!can) return null
  const run = async (format: 'xlsx' | 'csv') => {
    setBusy(format)
    try {
      await api.download(path, { ...params, format }, `${name}.${format}`)
    } catch (e) {
      notify.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <Button variant="secondary" loading={busy === 'xlsx'} onClick={() => void run('xlsx')} data-testid={`${testId}-xlsx`}>
        <FileSpreadsheet className="size-4" /> Excel
      </Button>
      {csv && (
        <Button variant="ghost" loading={busy === 'csv'} onClick={() => void run('csv')} data-testid={`${testId}-csv`}>
          <Download className="size-4" /> CSV
        </Button>
      )}
    </>
  )
}

export interface CommonFilters {
  from: string
  to: string
  workshopId: string
  productId: string
  materialId: string
}

/** Barra de filtros compacta y reutilizable. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3 shadow-card">{children}</div>
}

export function FilterItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className ?? 'w-44'}>
      <span className="eyebrow mb-1 block">{label}</span>
      {children}
    </label>
  )
}

export function DateFilter({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId?: string }) {
  return (
    <FilterItem label={label} className="w-40">
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
    </FilterItem>
  )
}

export function WorkshopFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useWorkshops()
  return (
    <FilterItem label="Taller">
      <NativeSelect data-testid="filter-workshop" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Todos los talleres" options={[{ value: '', label: 'Todos los talleres' }, ...(data ?? []).map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))]} />
    </FilterItem>
  )
}

export function ProductFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useProducts()
  return (
    <FilterItem label="Producto" className="w-52">
      <NativeSelect data-testid="filter-product" value={value} onChange={(e) => onChange(e.target.value)} options={[{ value: '', label: 'Todos los productos' }, ...(data ?? []).map((p) => ({ value: p.id, label: p.name }))]} />
    </FilterItem>
  )
}

export function MaterialFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useMaterials()
  return (
    <FilterItem label="Material">
      <NativeSelect data-testid="filter-material" value={value} onChange={(e) => onChange(e.target.value)} options={[{ value: '', label: 'Todos los materiales' }, ...(data ?? []).map((m) => ({ value: m.id, label: m.name }))]} />
    </FilterItem>
  )
}

/** Ejes compactos: 1,2 M / 350 k. */
export const shortMoney = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)} mil M`
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 1)} M`
  if (a >= 1e3) return `${Math.round(v / 1e3)} k`
  return String(Math.round(v))
}
export const shortGrams = (g: number) => (Math.abs(g) >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g * 10) / 10} g`)

/** "2026-10" → "oct 2026". */
export const monthLabel = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? formatDate(`${m}-01`, 'MMM yyyy') : m)

/** Período por defecto: año en curso hasta hoy. */
export const yearStartIso = () => `${new Date().getFullYear()}-01-01`
