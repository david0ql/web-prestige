import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { AppUserRow, AuditLog } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatDateTime, monthStartIso, todayIso } from '@/lib/format'
import type { BadgeVariant } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { DateFilter, ExportButtons, FilterBar, FilterItem } from '@/pages/analytics/components/reportKit'

const ACTIONS: Record<string, { label: string; variant: BadgeVariant }> = {
  CREATE: { label: 'Creación', variant: 'success' },
  UPDATE: { label: 'Edición', variant: 'info' },
  DELETE: { label: 'Eliminación', variant: 'danger' },
  APPROVE: { label: 'Aprobación', variant: 'gold' },
  REJECT: { label: 'Rechazo', variant: 'danger' },
  REVERSE: { label: 'Reverso', variant: 'danger' },
  STATUS_CHANGE: { label: 'Cambio de estado', variant: 'info' },
  SIGN: { label: 'Firma', variant: 'gold' },
  OVERRIDE: { label: 'Autorización excepcional', variant: 'warning' },
  ACCESS: { label: 'Acceso', variant: 'neutral' },
  EXPORT: { label: 'Exportación', variant: 'neutral' },
  HIDE: { label: 'Ocultamiento', variant: 'warning' },
  LOGIN: { label: 'Inicio de sesión', variant: 'neutral' },
  LOGIN_FAILED: { label: 'Intento fallido', variant: 'danger' },
  LOGOUT: { label: 'Cierre de sesión', variant: 'neutral' },
  PASSWORD_RESET: { label: 'Cambio de contraseña', variant: 'warning' },
}

const ENTITIES = [
  'ProductionOrder', 'MaterialDispatch', 'DispatchLine', 'InventoryMovement', 'Weighing', 'ProductionReceipt', 'QualityCheck', 'PurityVerification',
  'Discrepancy', 'LaborCost', 'CostEntry', 'FinishedGood', 'SaleDispatch', 'CustomerOperation', 'CustomerPayment', 'CustomerMaterialContribution',
  'FinancialTransaction', 'PeriodClose', 'MaterialRequest', 'DigitalAcceptance', 'TechnicalSheet', 'MediaFile', 'Alert', 'Auth',
]

const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** Diff legible antes/después (RF-036). */
function Diff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => !['updatedAt', 'version'].includes(k))
  if (!keys.length) return <p className="text-[12px] text-ink-muted">Sin datos de antes/después para este evento.</p>
  const changed = keys.filter((k) => show(before?.[k]) !== show(after?.[k]))
  const ordered = [...changed, ...keys.filter((k) => !changed.includes(k))]
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left">
            <th className="eyebrow w-48 py-1 pr-3">Campo</th>
            {before && <th className="eyebrow py-1 pr-3">Antes</th>}
            {after && <th className="eyebrow py-1">Después</th>}
          </tr>
        </thead>
        <tbody className="font-mono">
          {ordered.map((k) => {
            const diff = changed.includes(k) && before && after
            return (
              <tr key={k} className={cn('border-t border-border/60 align-top', diff && 'bg-brand-50')}>
                <td className="py-1 pr-3 font-sans font-medium text-ink-secondary">{k}{diff && <span className="ml-1 text-brand-700">•</span>}</td>
                {before && <td className={cn('py-1 pr-3 break-all', diff ? 'text-danger line-through decoration-danger/40' : 'text-ink-muted')}>{show(before[k])}</td>}
                {after && <td className={cn('py-1 break-all', diff ? 'font-semibold text-success' : 'text-ink')}>{show(after[k])}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Auditoría · bitácora de movimientos críticos (RF-036). */
export default function AuditPage() {
  const canUsers = usePermission('users.manage')
  const [from, setFrom] = useState(monthStartIso())
  const [to, setTo] = useState(todayIso())
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const q = useDebounced(search, 300)
  const eid = useDebounced(entityId.trim(), 400)

  const users = useQuery({ queryKey: ['users', 'audit-filter'], queryFn: () => api.get<Paginated<AppUserRow>>('/users', { pageSize: 200 }), enabled: canUsers, staleTime: 300_000 })
  const params = { from, to, action: action || undefined, entityType: entityType || undefined, entityId: /^[0-9a-f-]{36}$/i.test(eid) ? eid : undefined, userId: userId || undefined }
  const list = useQuery({
    queryKey: ['audit', params, q, page],
    queryFn: () => api.get<Paginated<AuditLog>>('/audit', { ...params, search: q, page, pageSize: 25 }),
    placeholderData: (p) => p,
  })
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const reset = () => setPage(1)
  const userOptions = useMemo(() => (users.data?.items ?? []).map((u) => ({ value: u.id, label: `${u.username} · ${u.fullName}` })), [users.data])

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Bitácora de creación, edición, aprobación, reverso y acceso a movimientos críticos, con antes/después."
        actions={<ExportButtons path="/reports/audit/export" params={{ from, to, action: params.action, entityType: params.entityType, userId: params.userId }} name="auditoria" testId="audit-export" />}
      />
      <FilterBar>
        <DateFilter label="Desde" value={from} onChange={(v) => { setFrom(v); reset() }} testId="audit-from" />
        <DateFilter label="Hasta" value={to} onChange={(v) => { setTo(v); reset() }} testId="audit-to" />
        <FilterItem label="Acción">
          <NativeSelect data-testid="audit-action" value={action} onChange={(e) => { setAction(e.target.value); reset() }} options={[{ value: '', label: 'Todas las acciones' }, ...Object.entries(ACTIONS).map(([value, v]) => ({ value, label: v.label }))]} />
        </FilterItem>
        <FilterItem label="Entidad" className="w-52">
          <Input list="audit-entities" value={entityType} onChange={(e) => { setEntityType(e.target.value); reset() }} placeholder="Todas" data-testid="audit-entity" />
          <datalist id="audit-entities">{ENTITIES.map((e) => <option key={e} value={e} />)}</datalist>
        </FilterItem>
        <FilterItem label="ID de entidad" className="w-64">
          <Input value={entityId} onChange={(e) => { setEntityId(e.target.value); reset() }} placeholder="UUID del registro" className="font-mono text-[12px]" />
        </FilterItem>
        {canUsers && (
          <FilterItem label="Usuario" className="w-52">
            <NativeSelect value={userId} onChange={(e) => { setUserId(e.target.value); reset() }} options={[{ value: '', label: 'Todos los usuarios' }, ...userOptions]} />
          </FilterItem>
        )}
        <FilterItem label="Buscar" className="w-56">
          <SearchInput value={search} onValueChange={(v) => { setSearch(v); reset() }} placeholder="Usuario o descripción…" data-testid="audit-search" />
        </FilterItem>
      </FilterBar>

      <Card flush>
        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}>
          {list.data?.items.length ? (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable" data-testid="audit-table">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-sunken/60 text-left">
                    <th className="w-8" />
                    <th className="eyebrow px-3 py-2">Fecha y hora</th>
                    <th className="eyebrow px-3 py-2">Usuario</th>
                    <th className="eyebrow px-3 py-2">Acción</th>
                    <th className="eyebrow px-3 py-2">Entidad</th>
                    <th className="eyebrow hidden px-3 py-2 md:table-cell">Descripción</th>
                    <th className="eyebrow hidden px-3 py-2 lg:table-cell">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((r) => {
                    const expandable = !!(r.before || r.after)
                    const isOpen = open.has(r.id)
                    return (
                      <Fragment key={r.id}>
                        <tr className={cn('border-b border-border/70', expandable && 'cursor-pointer hover:bg-brand-50/60', isOpen && 'bg-brand-50/40')} onClick={() => expandable && toggle(r.id)} data-testid="audit-row">
                          <td className="pl-3 text-ink-muted">{expandable && (isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}</td>
                          <td className="px-3 py-2 whitespace-nowrap tnum">{formatDateTime(r.createdAt)}</td>
                          <td className="px-3 py-2 font-medium">{r.username ?? <span className="text-ink-muted">Sistema</span>}</td>
                          <td className="px-3 py-2"><Badge variant={ACTIONS[r.action]?.variant ?? 'neutral'}>{ACTIONS[r.action]?.label ?? r.action}</Badge></td>
                          <td className="px-3 py-2">
                            <p>{r.entityType}</p>
                            {r.entityId && (
                              <button type="button" className="font-mono text-[11px] text-ink-muted hover:text-brand-700" title="Filtrar por este registro" onClick={(e) => { e.stopPropagation(); setEntityId(r.entityId!); setEntityType(r.entityType); reset() }}>
                                {r.entityId.slice(0, 8)}…
                              </button>
                            )}
                          </td>
                          <td className="hidden max-w-md px-3 py-2 text-ink-secondary md:table-cell">{r.description ?? '—'}</td>
                          <td className="hidden px-3 py-2 text-[11px] text-ink-muted lg:table-cell"><p className="font-mono">{r.path ?? ''}</p><p>{r.ip ?? ''}</p></td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border bg-page/60">
                            <td />
                            <td colSpan={6} className="px-3 py-3"><Diff before={r.before} after={r.after} /></td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={ScrollText} title="Sin eventos" description="No hay registros de auditoría con estos filtros." />
          )}
          {list.data && list.data.total > list.data.pageSize && <Pagination className="border-t border-border px-3 py-2" page={page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} />}
        </QueryState>
      </Card>
    </div>
  )
}
