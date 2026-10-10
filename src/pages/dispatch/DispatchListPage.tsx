import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FileSignature, Plus, ShieldAlert } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { MaterialDispatch } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useWorkshops } from '@/lib/hooks/useMasters'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatDateTime, formatGrams } from '@/lib/format'
import { DISPATCH_STATUS } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { QueryState } from '@/components/domain/QueryState'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { SearchInput } from '@/components/ui/SearchInput'
import { Drawer } from '@/components/ui/Drawer'
import { Badge } from '@/components/ui/Badge'

const PAGE_SIZE = 20
const statusOptions = Object.entries(DISPATCH_STATUS).map(([value, v]) => ({ value, label: v.label }))
const DECISION: Record<string, string> = { ACCEPT: 'Aceptado', ACCEPT_WITH_OBSERVATIONS: 'Aceptado con observaciones', REJECT: 'Rechazado' }

const totalOf = (d: MaterialDispatch) => d.lines.reduce((s, l) => s + l.grams, 0)

/** Despachos a talleres con su aceptación digital (RF-010/011). */
export default function DispatchListPage() {
  const canDispatch = usePermission('orders.dispatch')
  const { data: workshops = [] } = useWorkshops()
  const [status, setStatus] = useState('')
  const [workshopId, setWorkshopId] = useState('')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['dispatches', 'list', { status, workshopId, search: debounced, page }],
    queryFn: () => api.get<Paginated<MaterialDispatch>>('/dispatches', { status, workshopId, search: debounced, page, pageSize: PAGE_SIZE }),
  })
  const pending = useQuery({
    queryKey: ['dispatches', 'pending-count'],
    queryFn: () => api.get<Paginated<MaterialDispatch>>('/dispatches', { status: 'PENDING_ACCEPTANCE', pageSize: 1 }),
  })

  const columns: Column<MaterialDispatch>[] = [
    { key: 'number', header: 'Despacho', cell: (r) => <span className="font-medium whitespace-nowrap text-ink">{r.number}</span> },
    { key: 'date', header: 'Fecha', cell: (r) => <span className="whitespace-nowrap text-ink-secondary">{formatDateTime(r.createdAt)}</span> },
    { key: 'workshop', header: 'Taller', cell: (r) => <span className="whitespace-nowrap">{r.workshop.code} · {r.workshop.name}</span> },
    { key: 'order', header: 'Orden', cell: (r) => <span className={cn('whitespace-nowrap', !r.order && 'text-ink-muted')}>{r.order?.number ?? 'Sin orden'}</span> },
    { key: 'purpose', header: 'Propósito', hideOnMobile: true, cell: (r) => <span className="line-clamp-1 max-w-[260px] text-ink-secondary" title={r.purpose}>{r.purpose}</span> },
    {
      key: 'lines',
      header: 'Material',
      hideOnMobile: true,
      cell: (r) => <span className="text-ink-secondary">{r.lines.map((l) => l.material.code).join(', ')}</span>,
    },
    { key: 'grams', header: 'Gramos', align: 'right', cell: (r) => <span className="font-semibold whitespace-nowrap text-ink">{formatGrams(totalOf(r))}</span> },
    {
      key: 'status',
      header: 'Estado',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <StatusBadge map={DISPATCH_STATUS} value={r.status} />
          {r.acceptance && <FileSignature className="size-3.5 text-ink-muted" aria-label="Firmado" />}
        </div>
      ),
    },
    { key: 'resp', header: 'Responsable', hideOnMobile: true, cell: (r) => r.responsible?.fullName ?? '—' },
  ]

  return (
    <div>
      <PageHeader
        title="Despachos a talleres"
        description="Entregas de material desde Oficina Madre con su confirmación digital por parte del taller."
        actions={
          canDispatch && (
            <Link to="/asignaciones">
              <Button><Plus className="size-4" /> Nueva asignación</Button>
            </Link>
          )
        }
      />
      <Card className="mb-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_220px] sm:items-end">
          <SearchInput data-testid="dispatches-search" placeholder="Buscar por número o propósito…" value={search} onValueChange={(v) => { setSearch(v); setPage(1) }} />
          <NativeSelect data-testid="dispatches-status" placeholder="Todos los estados" options={statusOptions} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} />
          <NativeSelect data-testid="dispatches-workshop" placeholder="Todos los talleres" options={workshops.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} value={workshopId} onChange={(e) => { setWorkshopId(e.target.value); setPage(1) }} />
        </div>
        {!!pending.data?.total && (
          <button type="button" className="mt-3 cursor-pointer text-[12px] font-medium text-warning hover:underline" onClick={() => { setStatus('PENDING_ACCEPTANCE'); setPage(1) }}>
            {pending.data.total} {pending.data.total === 1 ? 'despacho pendiente' : 'despachos pendientes'} de aceptación del taller
          </button>
        )}
      </Card>
      <QueryState isLoading={false} error={q.error} onRetry={() => void q.refetch()}>
        <Card flush>
          <DataTable
            testId="dispatches-table"
            columns={columns}
            rows={q.data?.items}
            rowKey={(r) => r.id}
            loading={q.isLoading}
            onRowClick={(r) => setSelected(r.id)}
            empty={{ title: 'Sin despachos', description: 'Las asignaciones a talleres aparecerán aquí.' }}
            pagination={q.data ? { page, pageSize: PAGE_SIZE, total: q.data.total, onPageChange: setPage } : undefined}
          />
        </Card>
      </QueryState>
      <DispatchDrawer id={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function DispatchDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['dispatches', 'detail', id], queryFn: () => api.get<MaterialDispatch>(`/dispatches/${id}`), enabled: !!id })
  const d = q.data
  const total = d ? totalOf(d) : 0
  const received = d?.lines.every((l) => l.receivedGrams !== null) ? d.lines.reduce((s, l) => s + (l.receivedGrams ?? 0), 0) : null

  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()} size="lg" title={d ? `Despacho ${d.number}` : 'Despacho'} description={d ? formatDateTime(d.createdAt) : undefined}>
      <QueryState isLoading={q.isLoading} error={q.error}>
        {d && (
          <div data-testid="dispatch-detail" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-page px-4 py-3">
              <div className="flex items-center gap-2">
                <StatusBadge map={DISPATCH_STATUS} value={d.status} />
                {d.respondedAt && <span className="text-[12px] text-ink-muted">Respondido {formatDateTime(d.respondedAt)}</span>}
              </div>
              <div className="text-right">
                <p className="text-[22px] font-semibold text-ink tnum">{formatGrams(total)}</p>
                {received !== null && Math.abs(received - total) > 0.00001 && <p className="text-[12px] font-medium text-danger">Recibido {formatGrams(received)} · diferencia {formatGrams(received - total)}</p>}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <Fact label="Taller">{d.workshop.code} · {d.workshop.name}</Fact>
              <Fact label="Orden">
                {d.orderId ? (
                  <Link to="/ordenes/$orderId" params={{ orderId: d.orderId }} className="font-medium text-brand-700 hover:underline">{d.order?.number ?? 'Ver orden'}</Link>
                ) : (
                  'Sin orden'
                )}
              </Fact>
              <Fact label="Responsable Oficina Madre">{d.responsible?.fullName ?? '—'}</Fact>
              <Fact label="Producto">{d.order?.product?.name ?? '—'}</Fact>
              <Fact label="Propósito" wide>{d.purpose}</Fact>
              {d.notes && <Fact label="Observaciones de Oficina Madre" wide>{d.notes}</Fact>}
            </dl>

            <section>
              <h3 className="eyebrow mb-2">Líneas</h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-sunken/60">
                      {['Material', 'Lote', 'Pesaje', 'Despachado', 'Recibido', 'Diferencia'].map((h, i) => (
                        <th key={h} className={cn('eyebrow px-3 py-2 whitespace-nowrap', i >= 3 ? 'text-right' : 'text-left')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l) => {
                      const diff = l.receivedGrams !== null ? l.receivedGrams - l.grams : null
                      return (
                        <tr key={l.id} className="border-t border-border/70">
                          <td className="px-3 py-2">
                            <p className="font-medium text-ink">{l.material.name}</p>
                            <p className="text-[11px] text-ink-muted">{l.material.code}</p>
                          </td>
                          <td className="px-3 py-2">{l.lot?.code ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-ink-secondary">
                            {l.weighing ? (
                              <span>{l.weighing.number}{l.weighing.source === 'MANUAL' && <Badge variant="warning" className="ml-1">Manual</Badge>}</span>
                            ) : '—'}
                            {l.overrideApplied && <Badge variant="danger" className="ml-1"><ShieldAlert className="size-3" /> Excepcional</Badge>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-ink tnum">{formatGrams(l.grams)}</td>
                          <td className="px-3 py-2 text-right tnum">{l.receivedGrams !== null ? formatGrams(l.receivedGrams) : <span className="text-ink-muted">Pendiente</span>}</td>
                          <td className={cn('px-3 py-2 text-right whitespace-nowrap tnum', diff && Math.abs(diff) > 0.00001 ? 'font-semibold text-danger' : 'text-ink-muted')}>{diff === null ? '—' : Math.abs(diff) > 0.00001 ? formatGrams(diff) : 'Conforme'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="eyebrow mb-2">Confirmación digital del taller</h3>
              {d.acceptance ? (
                <div className="rounded-md border border-border">
                  <div className="grid gap-4 p-4 sm:grid-cols-[220px_1fr]">
                    <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-border-strong bg-white">
                      {d.acceptance.signatureImage ? (
                        <img data-testid="dispatch-signature" src={d.acceptance.signatureImage} alt={`Firma de ${d.acceptance.signerName}`} className="max-h-24 max-w-full object-contain" />
                      ) : (
                        <span className="text-[12px] text-ink-muted">Sin imagen de firma</span>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                      <Fact label="Decisión">{DECISION[d.acceptance.decision] ?? d.acceptance.decision}</Fact>
                      <Fact label="Firmante">{d.acceptance.signerName}</Fact>
                      <Fact label="Fecha y hora">{formatDateTime(d.acceptance.signedAt)}</Fact>
                      <Fact label="IP">{d.acceptance.ip ?? '—'}</Fact>
                    </dl>
                  </div>
                  <div className="border-t border-border bg-page px-4 py-2.5">
                    <p className="eyebrow">Huella del documento (SHA-256)</p>
                    <code className="mt-0.5 block text-[11px] break-all text-ink-secondary">{d.acceptance.payloadHash}</code>
                  </div>
                  {(d.acceptance.observations || d.workshopObservations) && (
                    <div className="border-t border-border px-4 py-2.5 text-[13px]">
                      <p className="eyebrow">Observaciones del taller</p>
                      <p className="mt-0.5 text-ink">{d.acceptance.observations ?? d.workshopObservations}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-warning/50 bg-warning-bg/50 px-4 py-3 text-[13px] text-warning">
                  Pendiente de aceptación. El material permanece en tránsito hasta que el taller confirme lo recibido con su firma.
                </p>
              )}
            </section>
          </div>
        )}
      </QueryState>
    </Drawer>
  )
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  )
}
