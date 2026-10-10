import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, RotateCcw, ShieldAlert } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { InventoryMovement, ProductionOrder, Weighing } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useMaterials } from '@/lib/hooks/useMasters'
import { formatDateTime, formatGrams, formatMoney, formatPurity } from '@/lib/format'
import { LOCATION_TYPE, MOVEMENT_TYPE } from '@/lib/labels'
import { DataTable, type Column } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { QueryState } from '@/components/domain/QueryState'
import { ReasonDialog } from '@/components/domain/ReasonDialog'
import { Card } from '@/components/ui/Card'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Drawer } from '@/components/ui/Drawer'
import { notify } from '@/components/ui/Toaster'
import { localStartIso, materialOptions, movementTypeOptions, REVERSIBLE } from './shared'
import { Filter } from './BalancesTab'

type MovementDetail = InventoryMovement & { weighing?: Weighing | null; unitCost?: number | null; overrideReason?: string | null; reversalOfId?: string | null; sourceId?: string | null }

const PAGE_SIZE = 25
const emptyFilters = { type: '', materialId: '', productionOrderId: '', from: '', to: '' }

/** P04 (d) · Movimientos con trazabilidad y reverso auditable (RN-015). */
export function MovementsTab() {
  const { data: materials = [] } = useMaterials()
  const [f, setF] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const orders = useQuery({ queryKey: ['orders', 'all-for-filter'], queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { pageSize: 200 }), staleTime: 60_000 })
  const q = useQuery({
    queryKey: ['inventory', 'movements', 'list', f, page],
    queryFn: () => api.get<Paginated<InventoryMovement>>('/inventory/movements', { ...f, from: localStartIso(f.from), page, pageSize: PAGE_SIZE }),
  })
  const upd = (patch: Partial<typeof emptyFilters>) => {
    setF((x) => ({ ...x, ...patch }))
    setPage(1)
  }

  const columns: Column<InventoryMovement>[] = [
    { key: 'number', header: 'Movimiento', cell: (r) => <span className="font-medium whitespace-nowrap text-ink">{r.number}</span> },
    { key: 'date', header: 'Fecha', cell: (r) => <span className="whitespace-nowrap text-ink-secondary">{formatDateTime(r.createdAt)}</span> },
    {
      key: 'type',
      header: 'Tipo',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <StatusBadge map={MOVEMENT_TYPE} value={r.type} />
          {r.status === 'REVERSED' && <Badge variant="danger">Reversado</Badge>}
          {r.overrideApplied && <ShieldAlert className="size-3.5 text-danger" aria-label="Autorización excepcional" />}
        </div>
      ),
    },
    {
      key: 'material',
      header: 'Material',
      cell: (r) => (
        <div className="leading-tight" title={r.material.name}>
          <p className="font-medium whitespace-nowrap text-ink">{r.material.code}</p>
          <p className="max-w-[140px] truncate text-[11px] text-ink-muted">{r.material.name}</p>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Origen → destino',
      hideOnMobile: true,
      cell: (r) => (
        <span className="flex items-center gap-1 text-ink-secondary">
          <span className="max-w-[130px] truncate">{r.fromLocation?.name ?? 'Externo'}</span>
          <ArrowRight className="size-3 shrink-0 text-ink-muted" />
          <span className="max-w-[130px] truncate">{r.toLocation?.name ?? 'Externo'}</span>
        </span>
      ),
    },
    { key: 'lot', header: 'Lote', cell: (r) => <span className="whitespace-nowrap">{r.lot?.code ?? '—'}</span>, hideOnMobile: true },
    { key: 'ref', header: 'Referencia', cell: (r) => <span className="whitespace-nowrap">{r.reference ?? '—'}</span>, hideOnMobile: true },
    { key: 'grams', header: 'Gramos', align: 'right', cell: (r) => <span className="font-semibold whitespace-nowrap text-ink">{formatGrams(r.grams)}</span> },
    { key: 'resp', header: 'Responsable', cell: (r) => <span className="whitespace-nowrap">{r.responsible?.fullName ?? '—'}</span>, hideOnMobile: true },
  ]

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_1fr_1fr_150px_150px_auto] lg:items-end">
          <Filter label="Tipo">
            <NativeSelect data-testid="movements-type" placeholder="Todos" options={movementTypeOptions} value={f.type} onChange={(e) => upd({ type: e.target.value })} />
          </Filter>
          <Filter label="Material">
            <NativeSelect data-testid="movements-material" placeholder="Todos" options={materialOptions(materials)} value={f.materialId} onChange={(e) => upd({ materialId: e.target.value })} />
          </Filter>
          <Filter label="Orden">
            <NativeSelect
              data-testid="movements-order"
              placeholder="Todas"
              options={(orders.data?.items ?? []).map((o) => ({ value: o.id, label: `${o.number} · ${o.product.name}` }))}
              value={f.productionOrderId}
              onChange={(e) => upd({ productionOrderId: e.target.value })}
            />
          </Filter>
          <Filter label="Desde">
            <Input type="date" value={f.from} onChange={(e) => upd({ from: e.target.value })} />
          </Filter>
          <Filter label="Hasta">
            <Input type="date" value={f.to} onChange={(e) => upd({ to: e.target.value })} />
          </Filter>
          <Button variant="ghost" onClick={() => upd(emptyFilters)}>Limpiar</Button>
        </div>
      </Card>
      <QueryState isLoading={false} error={q.error} onRetry={() => void q.refetch()}>
        <Card flush>
          <DataTable
            testId="movements-table"
            columns={columns}
            rows={q.data?.items}
            rowKey={(r) => r.id}
            loading={q.isLoading}
            onRowClick={(r) => setSelected(r.id)}
            empty={{ title: 'Sin movimientos', description: 'Ajusta los filtros para ver otros movimientos.' }}
            pagination={q.data ? { page, pageSize: PAGE_SIZE, total: q.data.total, onPageChange: setPage } : undefined}
          />
        </Card>
      </QueryState>
      <MovementDrawer id={selected} onClose={() => setSelected(null)} orders={orders.data?.items ?? []} />
    </div>
  )
}

function MovementDrawer({ id, onClose, orders }: { id: string | null; onClose: () => void; orders: ProductionOrder[] }) {
  const qc = useQueryClient()
  const canReverse = usePermission('reversals.authorize')
  const [reversing, setReversing] = useState(false)
  const q = useQuery({ queryKey: ['inventory', 'movement', id], queryFn: () => api.get<MovementDetail>(`/inventory/movements/${id}`), enabled: !!id })
  const mv = q.data
  const reverse = useMutation({
    mutationFn: (reason: string) => api.post<InventoryMovement>(`/inventory/movements/${id}/reverse`, { reason }),
    onSuccess: (r) => {
      notify.success(`Movimiento reversado con ${r.number}`)
      setReversing(false)
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const order = mv?.productionOrderId ? orders.find((o) => o.id === mv.productionOrderId) : null
  const reversible = !!mv && REVERSIBLE.includes(mv.type) && mv.status !== 'REVERSED'

  return (
    <>
      <Drawer
        open={!!id}
        onOpenChange={(o) => !o && onClose()}
        title={mv ? `Movimiento ${mv.number}` : 'Movimiento'}
        description={mv ? formatDateTime(mv.createdAt) : undefined}
        footer={
          canReverse && reversible ? (
            <Button variant="danger" data-testid="movement-reverse" onClick={() => setReversing(true)}>
              <RotateCcw className="size-4" /> Reversar movimiento
            </Button>
          ) : undefined
        }
      >
        <QueryState isLoading={q.isLoading} error={q.error}>
          {mv && (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-md border border-border bg-page px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge map={MOVEMENT_TYPE} value={mv.type} />
                  {mv.status === 'REVERSED' ? <Badge variant="danger">Reversado</Badge> : <Badge variant="success">Confirmado</Badge>}
                </div>
                <p className="text-[22px] font-semibold text-ink tnum">{formatGrams(mv.grams)}</p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[13px]">
                <LocationBox label="Origen" name={mv.fromLocation?.name} type={mv.fromLocation?.type} />
                <ArrowRight className="size-4 text-ink-muted" />
                <LocationBox label="Destino" name={mv.toLocation?.name} type={mv.toLocation?.type} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <Fact label="Material">{mv.material.code} · {mv.material.name}</Fact>
                <Fact label="Lote">{mv.lot?.code ?? '—'}</Fact>
                <Fact label="Ley">{formatPurity(mv.purity)}</Fact>
                <Fact label="Costo por gramo">{mv.unitCost != null ? formatMoney(mv.unitCost) : '—'}</Fact>
                <Fact label="Referencia">{mv.reference ?? '—'}</Fact>
                <Fact label="Origen / proveedor">{mv.origin ?? '—'}</Fact>
                <Fact label="Orden">
                  {mv.productionOrderId ? (
                    <Link to="/ordenes/$orderId" params={{ orderId: mv.productionOrderId }} className="font-medium text-brand-700 hover:underline">
                      {order?.number ?? 'Ver orden'}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Fact>
                <Fact label="Responsable">{mv.responsible?.fullName ?? '—'}</Fact>
                <Fact label="Documento origen">{mv.sourceType ?? '—'}</Fact>
                <Fact label="Pesaje">{mv.weighing ? `${mv.weighing.number} · ${mv.weighing.source === 'MANUAL' ? 'manual' : 'balanza'}` : '—'}</Fact>
                {mv.notes && <Fact label="Observaciones" wide>{mv.notes}</Fact>}
                {mv.overrideApplied && (
                  <Fact label="Autorización excepcional (RN-003)" wide>
                    <span className="text-danger">{mv.overrideReason ?? 'Sí'}</span>
                  </Fact>
                )}
              </dl>
              {!REVERSIBLE.includes(mv.type) && mv.status !== 'REVERSED' && (
                <p className="rounded-md bg-sunken px-3 py-2 text-[12px] text-ink-muted">Este tipo de movimiento se corrige desde su documento de origen (despacho, recepción, consumo).</p>
              )}
            </div>
          )}
        </QueryState>
      </Drawer>
      <ReasonDialog
        open={reversing}
        onOpenChange={setReversing}
        title={`Reversar ${mv?.number ?? ''}`}
        description="Se generará un movimiento de reverso por la misma cantidad en sentido contrario. El original no se elimina (RN-015)."
        confirmLabel="Reversar"
        danger
        loading={reverse.isPending}
        onConfirm={(reason) => reverse.mutate(reason)}
      />
    </>
  )
}

function LocationBox({ label, name, type }: { label: string; name?: string; type?: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="eyebrow">{label}</p>
      <p className="mt-0.5 truncate font-medium text-ink">{name ?? 'Externo'}</p>
      {type && <StatusBadge map={LOCATION_TYPE} value={type} className="mt-1" />}
    </div>
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
