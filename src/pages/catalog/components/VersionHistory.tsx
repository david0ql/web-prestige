import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, Factory, GitCommitVertical, Image as ImageIcon } from 'lucide-react'
import type { TechnicalVariable } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { diffSheets, type CatalogMedia, type Sheet } from './sheet'

/** Historial de versiones inmutables (RN-023) con comparación contra la anterior. */
export function VersionHistory({ versions, variables, photos, currentVersion }: { versions: Sheet[]; variables: TechnicalVariable[]; photos: CatalogMedia[]; currentVersion: number }) {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)
  const [open, setOpen] = useState<string | null>(sorted[0]?.id ?? null)
  if (!sorted.length) return <p className="text-[13px] text-ink-muted">Este modelo aún no tiene ficha técnica.</p>
  return (
    <ol className="relative space-y-2" data-testid="sheet-versions">
      {sorted.map((v, i) => {
        const prev = sorted[i + 1] ?? null
        const rows = diffSheets(prev, v, variables)
        const changed = rows.filter((r) => r.changed)
        const isOpen = open === v.id
        const nPhotos = photos.filter((p) => p.technicalSheetId === v.id).length
        return (
          <li key={v.id} className={cn('rounded-md border', v.versionNumber === currentVersion ? 'border-brand-300 bg-brand-50/40' : 'border-border')} data-testid={`sheet-version-${v.versionNumber}`}>
            <button className="flex w-full items-start gap-3 px-3 py-2.5 text-left" onClick={() => setOpen(isOpen ? null : v.id)}>
              <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold', v.versionNumber === currentVersion ? 'gold-gradient text-white' : 'bg-sunken text-ink-secondary')}>
                v{v.versionNumber}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
                  {v.changeReason ?? 'Sin motivo registrado'}
                  {v.versionNumber === currentVersion && <Badge variant="gold">Vigente</Badge>}
                  {v.sourceOrderId && <Badge variant="info"><Factory className="size-3" /> Desde producción</Badge>}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted">
                  <span>{formatDateTime(v.createdAt)}</span>
                  <span>· {v.createdBy?.fullName ?? 'Sistema'}</span>
                  {prev && <span>· {changed.length ? `${changed.length} cambio${changed.length > 1 ? 's' : ''} vs v${prev.versionNumber}` : `sin cambios de valores vs v${prev.versionNumber}`}</span>}
                  {nPhotos > 0 && <span className="flex items-center gap-0.5">· <ImageIcon className="size-3" /> {nPhotos}</span>}
                </span>
                {!isOpen && changed.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {changed.slice(0, 4).map((c) => <span key={c.key} className="rounded bg-brand-100 px-1.5 py-0.5 text-[11px] text-brand-800">{c.label}: {c.after}</span>)}
                    {changed.length > 4 && <span className="text-[11px] text-ink-muted">+{changed.length - 4}</span>}
                  </span>
                )}
              </span>
              <ChevronDown className={cn('mt-1 size-4 shrink-0 text-ink-muted transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="border-t border-border px-3 py-2.5">
                {v.sourceOrderId && (
                  <p className="mb-2 text-[12px] text-ink-secondary">
                    <GitCommitVertical className="mr-1 inline size-3.5" />
                    Generada desde la orden de producción{' '}
                    <Link to="/ordenes/$orderId" params={{ orderId: v.sourceOrderId }} className="font-medium text-brand-700 hover:underline">ver orden origen</Link>
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="eyebrow py-1 pr-3">Campo</th>
                        {prev && <th className="eyebrow py-1 pr-3">v{prev.versionNumber}</th>}
                        <th className="eyebrow py-1">v{v.versionNumber}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.filter((r) => r.after !== '—' || r.before !== '—').map((r) => (
                        <tr key={r.key} className={cn('border-b border-border/60 last:border-0', r.changed && 'bg-warning-bg/60')} data-changed={r.changed || undefined}>
                          <td className="py-1 pr-3 text-ink-secondary">{r.label}</td>
                          {prev && <td className={cn('py-1 pr-3 tnum', r.changed ? 'text-ink-muted line-through' : 'text-ink-secondary')}>{r.before}</td>}
                          <td className={cn('py-1 tnum', r.changed ? 'font-semibold text-ink' : 'text-ink')}>{r.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {v.notes && <p className="mt-2 text-[12px] text-ink-secondary"><b>Notas:</b> {v.notes}</p>}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
