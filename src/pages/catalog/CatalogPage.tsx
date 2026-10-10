import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Gem, Image as ImageIcon, Scale } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatGrams, formatNumber, formatPurity } from '@/lib/format'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { SearchInput } from '@/components/ui/SearchInput'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { CatalogItem } from './components/sheet'

/** P19 · Catálogo técnico de modelos (RF-042). */
export default function CatalogPage() {
  const [search, setSearch] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const q = useDebounced(search, 300)
  const list = useQuery({ queryKey: ['catalog', 'list', q], queryFn: () => api.get<CatalogItem[]>('/catalog/products', { search: q }) })
  const families = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of list.data ?? []) if (p.family) m.set(p.family.id, p.family.name)
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [list.data])
  const rows = (list.data ?? []).filter((p) => (!familyId || p.familyId === familyId) && (showInactive || p.status === 'ACTIVE'))

  return (
    <div>
      <PageHeader code="P19" title="Catálogo técnico de modelos" description="Ficha técnica versionada por modelo: fotografías, peso estándar, medidas, ley objetivo y variables técnicas. Estándar de fabricación y calidad." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput data-testid="catalog-search" value={search} onValueChange={setSearch} placeholder="Buscar por código, nombre o familia" className="w-full sm:w-72" />
        <NativeSelect data-testid="catalog-family" className="w-48" value={familyId} onChange={(e) => setFamilyId(e.target.value)} placeholder="Todas las familias" options={families} />
        <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-brand-600" /> Incluir inactivos
        </label>
        <span className="ml-auto text-[12px] text-ink-muted tnum">{rows.length} modelo{rows.length === 1 ? '' : 's'}</span>
      </div>
      <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}>
        {rows.length === 0 ? (
          <EmptyState icon={Gem} title="Sin modelos" description="No hay modelos que coincidan con la búsqueda." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" data-testid="catalog-grid">
            {rows.map((p) => <CatalogCard key={p.id} p={p} />)}
          </div>
        )}
      </QueryState>
    </div>
  )
}

function CatalogCard({ p }: { p: CatalogItem }) {
  const s = p.currentSheet
  const weight = s?.standardWeight ?? p.standardWeight
  const purity = s?.targetPurity ?? p.targetPurity
  const purityTol = s?.purityTolerance ?? p.purityTolerance
  return (
    <Link
      to="/catalogo/$productId"
      params={{ productId: p.id }}
      data-testid="catalog-card"
      className={cn('group overflow-hidden rounded-lg border border-border bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-gold', p.status !== 'ACTIVE' && 'opacity-60')}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sunken">
        {p.cover ? (
          <img src={p.cover.urls.thumb ?? p.cover.urls.web} alt={p.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand-50 via-surface to-brand-100 text-brand-400">
            <Gem className="size-10" strokeWidth={1.2} />
            <span className="flex items-center gap-1 text-[11px] text-ink-muted"><ImageIcon className="size-3" /> Sin fotografía</span>
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-sm bg-black/65 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{p.code}</span>
        {s && <span className="absolute top-2 right-2 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-bold text-brand-800 shadow-card">Ficha v{s.versionNumber}</span>}
      </div>
      <div className="space-y-2 p-3">
        <div>
          <h3 className="line-clamp-1 text-[14px] font-semibold text-ink group-hover:text-brand-800">{p.name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Badge variant="neutral">{p.family?.name ?? 'Sin familia'}</Badge>
            {p.status !== 'ACTIVE' && <Badge>Inactivo</Badge>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 border-t border-border pt-2 text-[12px]">
          <div>
            <dt className="eyebrow flex items-center gap-1"><Scale className="size-3" /> Peso estándar</dt>
            <dd className="font-semibold text-ink tnum">{weight !== null && weight !== undefined ? formatGrams(weight, 2) : '—'}{s?.weightTolerance ? <span className="font-normal text-ink-muted"> ± {formatNumber(s.weightTolerance, 3)}</span> : null}</dd>
          </div>
          <div>
            <dt className="eyebrow">Ley objetivo</dt>
            <dd className="font-semibold text-ink tnum">{purity !== null && purity !== undefined ? formatPurity(purity) : '—'}{purityTol ? <span className="font-normal text-ink-muted"> ± {formatNumber(purityTol, 1)}</span> : null}</dd>
          </div>
        </dl>
      </div>
    </Link>
  )
}
