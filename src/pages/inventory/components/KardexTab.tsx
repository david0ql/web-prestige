import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet } from 'lucide-react'
import { api, errorMessage } from '@/lib/api/client'
import type { GlobalSummaryRow, Material } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useLocations, useMaterials } from '@/lib/hooks/useMasters'
import { formatDateTime, formatGrams, monthStartIso } from '@/lib/format'
import { MOVEMENT_TYPE } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card } from '@/components/ui/Card'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { notify } from '@/components/ui/Toaster'
import { localStartIso, materialOptions } from './shared'
import { Filter } from './BalancesTab'

interface KardexLine {
  id: string; number: string; date: string; type: string; status: string; from: string | null; to: string | null; lot: string | null
  inGrams: number; outGrams: number; movedGrams: number; balance: number; productionOrderId: string | null; reference: string | null; responsible?: string; notes: string | null
}
interface Kardex { material: Material; opening: number; closing: number; lines: KardexLine[] }

/** P04 (e) · Kardex de material con saldo corrido (reporte 15). */
export function KardexTab() {
  const canExport = usePermission('reports.export')
  const { data: materials = [] } = useMaterials()
  const { data: locations = [] } = useLocations()
  const [f, setF] = useState({ materialId: '', locationId: '', from: monthStartIso(), to: '' })
  const [exporting, setExporting] = useState(false)
  // Por defecto, el material con más gramos bajo control.
  const summary = useQuery({ queryKey: ['inventory', 'summary'], queryFn: () => api.get<GlobalSummaryRow[]>('/inventory/summary') })
  useEffect(() => {
    if (f.materialId || !summary.isFetched) return
    const top = [...(summary.data ?? [])].sort((a, b) => b.total - a.total)[0]?.material.id ?? materials[0]?.id
    if (top) setF((x) => ({ ...x, materialId: top }))
  }, [materials, summary.isFetched, summary.data, f.materialId])

  const q = useQuery({
    queryKey: ['inventory', 'kardex', f],
    queryFn: () => api.get<Kardex>('/inventory/kardex', { ...f, from: localStartIso(f.from) }),
    enabled: !!f.materialId,
  })
  const k = q.data
  const totalIn = k?.lines.reduce((s, l) => s + l.inGrams, 0) ?? 0
  const totalOut = k?.lines.reduce((s, l) => s + l.outGrams, 0) ?? 0

  const exportXlsx = async () => {
    setExporting(true)
    try {
      await api.download('/reports/kardex/export', { ...f, from: localStartIso(f.from), format: 'xlsx' }, 'kardex.xlsx')
    } catch (e) {
      notify.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_150px_150px_auto] lg:items-end">
          <Filter label="Material">
            <NativeSelect data-testid="kardex-material" options={materialOptions(materials)} value={f.materialId} onChange={(e) => setF({ ...f, materialId: e.target.value })} />
          </Filter>
          <Filter label="Ubicación">
            <NativeSelect data-testid="kardex-location" placeholder="Global (total bajo control)" options={locations.map((l) => ({ value: l.id, label: l.name }))} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })} />
          </Filter>
          <Filter label="Desde">
            <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </Filter>
          <Filter label="Hasta">
            <Input type="date" value={f.to} title="Vacío = hasta hoy" onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Filter>
          {canExport && (
            <Button variant="secondary" data-testid="kardex-export" loading={exporting} disabled={!f.materialId} onClick={() => void exportXlsx()}>
              <Download className="size-4" /> Exportar Excel
            </Button>
          )}
        </div>
        {!f.locationId && <p className="mt-2 text-[12px] text-ink-muted">Vista global: los despachos y traslados internos no cambian el saldo (el material sigue bajo control de Prestige Gold).</p>}
      </Card>

      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {k && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Saldo inicial" value={formatGrams(k.opening)} />
              <Tile label="Entradas" value={`+ ${formatGrams(totalIn)}`} tone="success" />
              <Tile label="Salidas" value={`− ${formatGrams(totalOut)}`} tone="danger" />
              <Tile label="Saldo final" value={formatGrams(k.closing)} strong />
            </div>
            <Card flush title={`Kardex · ${k.material.code} ${k.material.name}`}>
              {k.lines.length === 0 ? (
                <EmptyState icon={FileSpreadsheet} title="Sin movimientos en el periodo" description={`Saldo sin cambios: ${formatGrams(k.opening)}`} />
              ) : (
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
                  <table data-testid="kardex-table" className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-y border-border bg-sunken/60">
                        {['Fecha', 'Movimiento', 'Tipo', 'Origen → destino', 'Lote', 'Referencia', 'Entrada', 'Salida', 'Saldo'].map((h, i) => (
                          <th key={h} className={cn('eyebrow px-3 py-2 whitespace-nowrap', i >= 6 ? 'text-right' : 'text-left')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/70 bg-brand-50/40">
                        <td colSpan={8} className="px-3 py-2 font-medium text-ink-secondary">Saldo inicial</td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap text-ink tnum">{formatGrams(k.opening)}</td>
                      </tr>
                      {k.lines.map((l) => (
                        <tr key={l.id} className={cn('border-b border-border/70', l.status === 'REVERSED' && 'text-ink-muted')}>
                          <td className="px-3 py-2 whitespace-nowrap text-ink-secondary">{formatDateTime(l.date)}</td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap text-ink">{l.number}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <StatusBadge map={MOVEMENT_TYPE} value={l.type} />
                              {l.status === 'REVERSED' && <Badge variant="danger">Reversado</Badge>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-ink-secondary">
                            <span className="whitespace-nowrap">{l.from ?? 'Externo'} → {l.to ?? 'Externo'}</span>
                          </td>
                          <td className="px-3 py-2">{l.lot ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{l.reference ?? '—'}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-success tnum">{l.inGrams ? formatGrams(l.inGrams) : <span className="text-ink-muted" title={`Movido ${formatGrams(l.movedGrams)}`}>—</span>}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-danger tnum">{l.outGrams ? formatGrams(l.outGrams) : <span className="text-ink-muted" title={`Movido ${formatGrams(l.movedGrams)}`}>—</span>}</td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap text-ink tnum">{formatGrams(l.balance)}</td>
                        </tr>
                      ))}
                      <tr className="bg-sunken/40">
                        <td colSpan={6} className="px-3 py-2 font-medium text-ink-secondary">Saldo final</td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-success tnum">{formatGrams(totalIn)}</td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-danger tnum">{formatGrams(totalOut)}</td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap text-ink tnum">{formatGrams(k.closing)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </QueryState>
    </div>
  )
}

function Tile({ label, value, tone, strong }: { label: string; value: string; tone?: 'success' | 'danger'; strong?: boolean }) {
  return (
    <div className={cn('rounded-md border border-border bg-surface p-4 shadow-card', strong && 'border-brand-200 bg-gradient-to-br from-brand-50 to-surface')}>
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-1.5 text-[20px] font-semibold tnum', tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</p>
    </div>
  )
}
