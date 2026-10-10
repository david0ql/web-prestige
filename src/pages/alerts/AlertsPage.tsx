import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertOctagon, AlertTriangle, ArrowRight, BellRing, CheckCheck, CheckCircle2, Eye, Info, RefreshCw } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Alert } from '@/lib/api/types'
import { isWorkshop, usePermission, useUser } from '@/lib/auth/store'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatDateTime } from '@/lib/format'
import { ALERT_SEVERITY, ALERT_STATUS, ALERT_TYPE, label } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { Stat } from '@/components/domain/Stat'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { QueryState } from '@/components/domain/QueryState'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { notify } from '@/components/ui/Toaster'

interface Counts { open: number; bySeverity: Record<string, number>; byType: Record<string, number> }

const SEV_ICON = { CRITICAL: AlertOctagon, WARNING: AlertTriangle, INFO: Info } as const
const SEV_TONE: Record<string, string> = { CRITICAL: 'border-l-danger', WARNING: 'border-l-warning', INFO: 'border-l-info' }
const SEV_TEXT: Record<string, string> = { CRITICAL: 'text-danger', WARNING: 'text-warning', INFO: 'text-info' }

/** Enlace a la entidad relacionada según el portal (oficina o taller). */
function EntityLink({ a, workshop }: { a: Alert; workshop: boolean }) {
  if (!a.entityType || !a.entityId) return null
  const cls = 'inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline'
  switch (a.entityType) {
    case 'ProductionOrder':
      return workshop ? (
        <Link to="/taller/ordenes/$orderId" params={{ orderId: a.entityId }} className={cls}>Ver orden <ArrowRight className="size-3" /></Link>
      ) : (
        <Link to="/ordenes/$orderId" params={{ orderId: a.entityId }} className={cls}>Ver orden <ArrowRight className="size-3" /></Link>
      )
    case 'MaterialDispatch':
      return workshop ? (
        <Link to="/taller/entregas/$dispatchId" params={{ dispatchId: a.entityId }} className={cls}>Ver entrega <ArrowRight className="size-3" /></Link>
      ) : (
        <Link to="/despachos" className={cls}>Ver despachos <ArrowRight className="size-3" /></Link>
      )
    case 'Discrepancy':
      return workshop ? null : <Link to="/diferencias" className={cls}>Ver diferencias <ArrowRight className="size-3" /></Link>
    case 'MaterialRequest':
      return workshop ? <Link to="/taller/solicitudes" className={cls}>Ver solicitudes <ArrowRight className="size-3" /></Link> : <Link to="/aprobaciones" className={cls}>Revisar solicitud <ArrowRight className="size-3" /></Link>
    case 'Material':
      return workshop ? null : <Link to="/inventario" className={cls}>Ver inventario <ArrowRight className="size-3" /></Link>
    default:
      return null
  }
}

/** P17 · Alertas operativas (RF-039). El taller solo ve las suyas (filtro en la API). */
export default function AlertsPage() {
  const user = useUser()
  const workshop = isWorkshop(user)
  const canManage = usePermission('alerts.manage')
  const qc = useQueryClient()
  const [status, setStatus] = useState('OPEN')
  const [type, setType] = useState('')
  const [severity, setSeverity] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [resolving, setResolving] = useState<Alert | null>(null)
  const [notes, setNotes] = useState('')
  const q = useDebounced(search, 300)

  const counts = useQuery({ queryKey: ['alerts', 'counts'], queryFn: () => api.get<Counts>('/alerts/counts'), refetchInterval: 60_000 })
  const list = useQuery({
    queryKey: ['alerts', 'list', status, type, severity, q, page],
    queryFn: () => api.get<Paginated<Alert>>('/alerts', { status, type, severity, search: q, page, pageSize: 20 }),
    placeholderData: (p) => p,
  })
  const refresh = () => void qc.invalidateQueries({ queryKey: ['alerts'] })
  const ack = useMutation({
    mutationFn: (id: string) => api.post(`/alerts/${id}/acknowledge`),
    onSuccess: () => { notify.success('Alerta marcada como vista'); refresh() },
  })
  const resolve = useMutation({
    mutationFn: () => api.post(`/alerts/${resolving!.id}/resolve`, { notes: notes.trim() || undefined }),
    onSuccess: () => { notify.success('Alerta resuelta'); setResolving(null); setNotes(''); refresh() },
  })
  const run = useMutation({
    mutationFn: () => api.post<{ checkedOrders?: number; pendingDispatches?: number } | null>('/alerts/run-checks'),
    onSuccess: (r) => { notify.success(r?.checkedOrders !== undefined ? `Revisión ejecutada · ${r.checkedOrders} órdenes y ${r.pendingDispatches ?? 0} entregas revisadas` : 'Revisión de alertas ejecutada'); refresh() },
  })
  const c = counts.data
  const reset = () => setPage(1)

  return (
    <div>
      <PageHeader
        code="P17"
        title="Alertas"
        description={workshop ? 'Alertas de tus órdenes, entregas y solicitudes.' : 'Faltantes, mínimos de inventario, retrasos, diferencias, consumos fuera de estándar y operaciones pendientes.'}
        actions={canManage && <Button variant="secondary" loading={run.isPending} onClick={() => run.mutate()} data-testid="alerts-run-checks"><RefreshCw className="size-4" /> Ejecutar revisión</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={BellRing} tone={c?.open ? 'warning' : 'default'} label="Abiertas" value={c?.open ?? '—'} testId="alerts-open-count" />
        <Stat icon={AlertOctagon} tone={c?.bySeverity.CRITICAL ? 'danger' : 'default'} label="Críticas" value={c?.bySeverity.CRITICAL ?? 0} />
        <Stat icon={AlertTriangle} label="Advertencias" value={c?.bySeverity.WARNING ?? 0} />
        <Stat icon={Info} label="Informativas" value={c?.bySeverity.INFO ?? 0} />
      </div>
      {c && Object.keys(c.byType).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {Object.entries(c.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(type === t ? '' : t); setStatus('OPEN'); reset() }}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors', type === t ? 'border-brand-400 bg-brand-100 text-brand-900' : 'border-border bg-surface text-ink-secondary hover:bg-sunken')}
            >
              {label(ALERT_TYPE, t)} <span className="font-semibold tnum">{n}</span>
            </button>
          ))}
        </div>
      )}

      <Card flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <SearchInput value={search} onValueChange={(v) => { setSearch(v); reset() }} placeholder="Buscar alerta…" className="w-full sm:w-64" />
          <div className="w-36"><NativeSelect data-testid="alerts-filter-status" value={status} onChange={(e) => { setStatus(e.target.value); reset() }} options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(ALERT_STATUS).map(([value, v]) => ({ value, label: v.label }))]} /></div>
          <div className="w-52"><NativeSelect value={type} onChange={(e) => { setType(e.target.value); reset() }} options={[{ value: '', label: 'Todos los tipos' }, ...Object.entries(ALERT_TYPE).map(([value, v]) => ({ value, label: v.label }))]} /></div>
          <div className="w-40"><NativeSelect value={severity} onChange={(e) => { setSeverity(e.target.value); reset() }} options={[{ value: '', label: 'Toda severidad' }, ...Object.entries(ALERT_SEVERITY).map(([value, v]) => ({ value, label: v.label }))]} /></div>
        </div>
        <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}>
          {list.data?.items.length ? (
            <ul className="divide-y divide-border" data-testid="alerts-list">
              {list.data.items.map((a) => {
                const Icon = SEV_ICON[a.severity as keyof typeof SEV_ICON] ?? Info
                return (
                  <li key={a.id} className={cn('flex flex-col gap-3 border-l-[3px] px-4 py-3 sm:flex-row sm:items-start', SEV_TONE[a.severity] ?? 'border-l-border', a.status === 'RESOLVED' && 'opacity-70')} data-testid="alert-item">
                    <Icon className={cn('mt-0.5 hidden size-5 shrink-0 sm:block', SEV_TEXT[a.severity])} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge map={ALERT_SEVERITY} value={a.severity} />
                        <StatusBadge map={ALERT_TYPE} value={a.type} />
                        <StatusBadge map={ALERT_STATUS} value={a.status} />
                        <span className="text-[12px] text-ink-muted">{formatDateTime(a.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-[14px] font-semibold text-ink">{a.title}</p>
                      <p className="text-[13px] text-ink-secondary">{a.message}</p>
                      {a.status === 'RESOLVED' && (
                        <p className="mt-1 flex items-center gap-1 text-[12px] text-success"><CheckCircle2 className="size-3.5" /> Resuelta {formatDateTime(a.resolvedAt)}{a.resolutionNotes ? ` · ${a.resolutionNotes}` : ''}</p>
                      )}
                      <div className="mt-1.5"><EntityLink a={a} workshop={workshop} /></div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {a.status === 'OPEN' && <Button size="sm" variant="ghost" loading={ack.isPending && ack.variables === a.id} onClick={() => ack.mutate(a.id)} data-testid="alert-ack"><Eye className="size-3.5" /> Marcar vista</Button>}
                      {canManage && a.status !== 'RESOLVED' && <Button size="sm" variant="secondary" onClick={() => { setResolving(a); setNotes('') }} data-testid="alert-resolve"><CheckCheck className="size-3.5" /> Resolver</Button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState icon={CheckCircle2} title="Sin alertas" description={status === 'OPEN' ? 'No hay alertas abiertas con estos filtros.' : 'No hay alertas que coincidan con los filtros.'} />
          )}
          {list.data && list.data.total > list.data.pageSize && <Pagination className="border-t border-border px-3 py-2" page={page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} />}
        </QueryState>
      </Card>

      <Modal
        open={!!resolving}
        onOpenChange={(o) => !o && setResolving(null)}
        title="Resolver alerta"
        description={resolving?.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(null)}>Cancelar</Button>
            <Button loading={resolve.isPending} onClick={() => resolve.mutate()} data-testid="alert-resolve-confirm">Marcar resuelta</Button>
          </>
        }
      >
        <FormField label="Nota de resolución" hint="Qué se hizo para atender la alerta. Queda en la bitácora.">
          <Textarea data-testid="alert-resolve-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </Modal>
    </div>
  )
}
