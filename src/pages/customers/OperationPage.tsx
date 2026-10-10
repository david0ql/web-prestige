import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { AlertTriangle, Ban, CheckCircle2, Coins, Gem, Lock, Pencil, Plus, RotateCcw, Scale, ShieldAlert, Trash2, Truck, Undo2 } from 'lucide-react'
import { api, ApiError, type Paginated } from '@/lib/api/client'
import type { FinishedGood, Weighing } from '@/lib/api/types'
import { formatDate, formatGrams, formatMoney, formatPurity, todayIso } from '@/lib/format'
import { FINISHED_STATUS, OPERATION_STATUS, PURITY, QUALITY, TIMING, TX_STATUS, label } from '@/lib/labels'
import { usePermission } from '@/lib/auth/store'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { DataTable } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { WeighingCapture } from '@/components/domain/WeighingCapture'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { FormField } from '@/components/ui/FormField'
import { notify } from '@/components/ui/Toaster'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useAllPermissions } from '@/pages/analytics/components/reportKit'
import { ContributionModal, OperationModal, PaymentModal, ReverseDialog, useInvalidateAccounts } from './components/forms'
import { BalanceBlock, OPERATION_TYPE, materialRows, moneyRows, type OperationDetail } from './components/shared'

/** RN-022 / CA-014 · Motivo por el que una pieza no puede despacharse (null = liberada). */
function releaseIssue(g: FinishedGood): string | null {
  if (g.status === 'SOLD') return 'Vendida'
  if (g.status === 'REJECTED') return 'Rechazada'
  const issues: string[] = []
  if (g.qualityStatus !== 'APPROVED') issues.push(g.qualityStatus === 'REJECTED' ? 'calidad rechazada' : 'calidad pendiente')
  const purityOk = g.purityStatus === 'CONFORMING' || (!g.product?.requiresPurityCheck && g.purityStatus === 'NOT_REQUIRED')
  if (!purityOk) issues.push(g.purityStatus === 'NON_CONFORMING' ? 'ley no conforme' : 'ley/pureza pendiente')
  if (g.status !== 'AVAILABLE' && !issues.length) issues.push(label(FINISHED_STATUS, g.status).toLowerCase())
  if (!issues.length && g.availableUnits <= 0 && g.availableGrams <= 0) issues.push('sin saldo disponible')
  return issues.length ? `No liberada: ${issues.join(' y ')}` : null
}

interface SaleLine { finishedGoodId: string; units: string; grams: string; value: string; weigh: boolean; weighing: Weighing | null }
const newLine = (): SaleLine => ({ finishedGoodId: '', units: '1', grams: '', value: '', weigh: false, weighing: null })

/** Detalle de operación de cliente + despacho/venta con control de calidad y ley (RF-025, RN-022, CA-014). */
export default function OperationPage() {
  const { operationId } = useParams({ from: '/app/operaciones/$operationId' })
  const canManage = usePermission('customers.manage')
  const canPay = usePermission('payments.manage')
  const canSell = usePermission('sales.manage')
  const canContribute = useAllPermissions('customer_material.manage', 'scale.weigh')
  const canReversePay = useAllPermissions('payments.manage', 'reversals.authorize')
  const canReverseContrib = useAllPermissions('customer_material.manage', 'reversals.authorize')
  const canReverseSale = useAllPermissions('sales.manage', 'reversals.authorize')
  const [modal, setModal] = useState<null | 'edit' | 'payment' | 'contribution'>(null)
  const [statusTarget, setStatusTarget] = useState<null | 'CLOSED' | 'CANCELLED' | 'OPEN'>(null)
  const [reverse, setReverse] = useState<{ path: string; label: string } | null>(null)
  const invalidate = useInvalidateAccounts()

  const q = useQuery({ queryKey: ['customer-operation', operationId], queryFn: () => api.get<OperationDetail>(`/customer-operations/${operationId}`) })
  const op = q.data
  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/customer-operations/${operationId}`, { status }),
    onSuccess: () => {
      notify.success('Estado de la operación actualizado')
      invalidate()
      setStatusTarget(null)
    },
  })
  const canDispatch = !!op && ['OPEN', 'PARTIALLY_DISPATCHED', 'DISPATCHED'].includes(op.status)
  const active = !!op && !['CLOSED', 'CANCELLED'].includes(op.status)
  const ops = op ? [op] : []

  return (
    <div>
      <PageHeader
        code="P13"
        breadcrumbs={[{ label: 'Clientes y abonos', to: '/clientes' }, ...(op ? [{ label: op.customer.name, to: `/clientes/${op.customerId}` }] : []), { label: op?.number ?? 'Operación' }]}
        title={
          op ? (
            <span className="flex flex-wrap items-center gap-2">
              {op.number} <StatusBadge map={OPERATION_STATUS} value={op.status} />
            </span>
          ) : (
            'Operación'
          )
        }
        description={op ? `${OPERATION_TYPE[op.type] ?? op.type} · ${op.description}` : undefined}
        actions={
          op && (
            <>
              {canManage && active && <Button variant="ghost" onClick={() => setModal('edit')}><Pencil className="size-4" /> Editar</Button>}
              {canManage && active && <Button variant="ghost" onClick={() => setStatusTarget('CANCELLED')} data-testid="operation-cancel"><Ban className="size-4" /> Cancelar</Button>}
              {canManage && active && <Button variant="secondary" onClick={() => setStatusTarget('CLOSED')} data-testid="operation-close"><Lock className="size-4" /> Cerrar</Button>}
              {canManage && !active && <Button variant="secondary" onClick={() => setStatusTarget('OPEN')} data-testid="operation-reopen"><RotateCcw className="size-4" /> Reabrir</Button>}
              {canContribute && op.status !== 'CANCELLED' && <Button variant="secondary" onClick={() => setModal('contribution')} data-testid="contribution-new"><Gem className="size-4" /> Aporte de material</Button>}
              {canPay && op.status !== 'CANCELLED' && <Button onClick={() => setModal('payment')} data-testid="payment-new"><Coins className="size-4" /> Registrar abono</Button>}
            </>
          )
        }
      />
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {op && (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
              {op.balances && <BalanceBlock kind="money" testId="op-balance-money" rows={moneyRows(op.balances.money)} />}
              {op.balances && <BalanceBlock kind="material" testId="op-balance-material" rows={materialRows(op.balances.material)} />}
              <Card title="Datos de la operación">
                <dl className="space-y-2 text-[13px]">
                  <Row k="Cliente"><Link to="/clientes/$customerId" params={{ customerId: op.customerId }} className="font-medium text-brand-700 hover:underline">{op.customer.name}</Link></Row>
                  <Row k="Tipo">{OPERATION_TYPE[op.type] ?? op.type}</Row>
                  <Row k="Creada">{formatDate(op.createdAt)}</Row>
                  <Row k="Vencimiento">{op.dueDate ? <span className={op.dueDate < todayIso() && active ? 'font-semibold text-danger' : ''}>{formatDate(op.dueDate)}</span> : '—'}</Row>
                  <Row k="Orden de producción">{op.productionOrderId ? <Link to="/ordenes/$orderId" params={{ orderId: op.productionOrderId }} className="font-medium text-brand-700 hover:underline">Ver orden vinculada</Link> : '—'}</Row>
                  {op.notes && <Row k="Notas">{op.notes}</Row>}
                </dl>
              </Card>
            </div>

            {canSell && canDispatch && <SalePanel op={op} />}

            <Tabs defaultValue="dispatches">
              <TabsList className="mb-3 overflow-x-auto whitespace-nowrap">
                <TabsTrigger value="dispatches" count={op.dispatches.length}>Despachos</TabsTrigger>
                <TabsTrigger value="payments" count={op.payments.length}>Abonos en dinero</TabsTrigger>
                <TabsTrigger value="contributions" count={op.contributions.length}>Aportes de material</TabsTrigger>
              </TabsList>
              <TabsContent value="dispatches">
                <Card flush>
                  <DataTable
                    testId="op-dispatches"
                    rows={op.dispatches}
                    rowKey={(s) => s.id}
                    empty={{ title: 'Sin despachos', description: 'Las piezas despachadas al cliente aparecerán aquí.' }}
                    columns={[
                      { key: 'n', header: 'Despacho', cell: (s) => <div><p className="font-semibold">{s.number}</p><p className="text-[12px] text-ink-muted">{formatDate(s.dispatchDate)}</p></div> },
                      { key: 'p', header: 'Piezas', cell: (s) => <ul className="text-[12px]">{s.lines.map((l) => <li key={l.id}>{l.finishedGood?.code} · {l.finishedGood?.product?.name} — {l.units} u · {formatGrams(l.grams)} · {formatMoney(l.value)}</li>)}</ul> },
                      { key: 'c', header: 'Costo', align: 'right', hideOnMobile: true, cell: (s) => formatMoney(s.lines.reduce((a, l) => a + Number(l.cost ?? 0), 0)) },
                      { key: 'v', header: 'Valor', align: 'right', cell: (s) => <span className={s.reversed ? 'text-ink-muted line-through' : 'font-semibold'}>{formatMoney(s.totalValue)}</span> },
                      { key: 's', header: 'Estado', cell: (s) => <StatusBadge map={TX_STATUS} value={s.reversed ? 'REVERSED' : 'POSTED'} /> },
                      { key: 'x', header: '', align: 'right', cell: (s) => canReverseSale && !s.reversed && <Button size="sm" variant="ghost" onClick={() => setReverse({ path: `/sales/${s.id}/reverse`, label: `despacho ${s.number}` })}><Undo2 className="size-3.5" /> Reversar</Button> },
                    ]}
                  />
                </Card>
              </TabsContent>
              <TabsContent value="payments">
                <Card flush>
                  <DataTable
                    testId="op-payments"
                    rows={op.payments}
                    rowKey={(p) => p.id}
                    empty={{ title: 'Sin abonos en dinero' }}
                    columns={[
                      { key: 'n', header: 'Abono', cell: (p) => <span className="font-semibold">{p.number}</span> },
                      { key: 'f', header: 'Fecha', cell: (p) => formatDate(p.paymentDate) },
                      { key: 'm', header: 'Medio', cell: (p) => p.paymentMethod?.name ?? '—' },
                      { key: 'r', header: 'Referencia', cell: (p) => p.reference ?? '—' },
                      { key: 'a', header: 'Monto', align: 'right', cell: (p) => <span className={p.status === 'REVERSED' ? 'text-ink-muted line-through' : 'font-semibold'}>{formatMoney(p.amount)}</span> },
                      { key: 's', header: 'Estado', cell: (p) => <StatusBadge map={TX_STATUS} value={p.status} /> },
                      { key: 'x', header: '', align: 'right', cell: (p) => canReversePay && p.status === 'POSTED' && <Button size="sm" variant="ghost" onClick={() => setReverse({ path: `/customer-payments/${p.id}/reverse`, label: `abono ${p.number}` })}><Undo2 className="size-3.5" /> Reversar</Button> },
                    ]}
                  />
                </Card>
              </TabsContent>
              <TabsContent value="contributions">
                <Card flush>
                  <DataTable
                    testId="op-contributions"
                    rows={op.contributions}
                    rowKey={(c) => c.id}
                    empty={{ title: 'Sin aportes de material' }}
                    columns={[
                      { key: 'n', header: 'Aporte', cell: (c) => <div><p className="font-semibold">{c.number}</p><p className="text-[12px] text-ink-muted">{formatDate(c.contributionDate)}</p></div> },
                      { key: 'm', header: 'Material / origen', cell: (c) => <div><p>{c.material?.name}</p><p className="text-[12px] text-ink-muted">{c.origin}</p></div> },
                      { key: 't', header: 'Momento', cell: (c) => <Badge variant={c.timing === 'AFTER_FABRICATION' ? 'gold' : 'info'}>{TIMING[c.timing] ?? c.timing}</Badge> },
                      { key: 'g', header: 'Peso', align: 'right', cell: (c) => formatGrams(c.grams, 3) },
                      { key: 'l', header: 'Ley decl. / verif.', align: 'right', cell: (c) => <span className="whitespace-nowrap">{formatPurity(c.declaredPurity)} / {c.verifiedPurity ? formatPurity(c.verifiedPurity) : '—'}</span> },
                      { key: 'f', header: 'Finos', align: 'right', cell: (c) => <span className={c.status === 'REVERSED' ? 'text-ink-muted line-through' : 'font-semibold text-info'}>{formatGrams(c.fineGrams, 3)}</span> },
                      { key: 'v', header: 'Valoración', align: 'right', cell: (c) => formatMoney(c.valuation) },
                      { key: 's', header: 'Estado', cell: (c) => <StatusBadge map={TX_STATUS} value={c.status} /> },
                      { key: 'x', header: '', align: 'right', cell: (c) => canReverseContrib && c.status === 'POSTED' && <Button size="sm" variant="ghost" onClick={() => setReverse({ path: `/customer-contributions/${c.id}/reverse`, label: `aporte ${c.number}` })}><Undo2 className="size-3.5" /> Reversar</Button> },
                    ]}
                  />
                </Card>
              </TabsContent>
            </Tabs>

            <OperationModal open={modal === 'edit'} onOpenChange={(o) => !o && setModal(null)} customerId={op.customerId} operation={op} />
            <PaymentModal open={modal === 'payment'} onOpenChange={(o) => !o && setModal(null)} customerId={op.customerId} operations={ops} operationId={op.id} />
            <ContributionModal open={modal === 'contribution'} onOpenChange={(o) => !o && setModal(null)} customerId={op.customerId} operations={ops} operationId={op.id} />
            <ReverseDialog target={reverse} onClose={() => setReverse(null)} />
            <ConfirmDialog
              open={!!statusTarget}
              onOpenChange={(o) => !o && setStatusTarget(null)}
              title={statusTarget === 'CLOSED' ? `Cerrar ${op.number}` : statusTarget === 'CANCELLED' ? `Cancelar ${op.number}` : `Reabrir ${op.number}`}
              confirmLabel={statusTarget === 'CLOSED' ? 'Cerrar operación' : statusTarget === 'CANCELLED' ? 'Cancelar operación' : 'Reabrir'}
              danger={statusTarget === 'CANCELLED'}
              loading={changeStatus.isPending}
              onConfirm={() => statusTarget && changeStatus.mutate(statusTarget)}
            >
              {statusTarget === 'CLOSED' && 'La operación quedará cerrada: no admitirá nuevos despachos. Los saldos pendientes seguirán visibles en el estado de cuenta.'}
              {statusTarget === 'CANCELLED' && 'La operación se cancelará. Si tiene abonos o despachos vigentes la API puede impedirlo; revérsalos primero.'}
              {statusTarget === 'OPEN' && 'La operación volverá a quedar abierta para despachos y abonos.'}
            </ConfirmDialog>
          </div>
        )}
      </QueryState>
    </div>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  )
}

/** Panel de despacho/venta: solo piezas liberadas por calidad y ley (RN-022). */
function SalePanel({ op }: { op: OperationDetail }) {
  const invalidate = useInvalidateAccounts()
  const [lines, setLines] = useState<SaleLine[]>([newLine()])
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [blocked, setBlocked] = useState<string | null>(null)
  const goods = useQuery({
    queryKey: ['finished-goods', 'sale-picker'],
    queryFn: () => api.get<Paginated<FinishedGood>>('/finished-goods', { pageSize: 200 }),
  })
  const pool = useMemo(() => {
    const items = (goods.data?.items ?? []).filter((g) => g.status !== 'SOLD')
    // Primero las piezas de la orden vinculada a la operación.
    return items.sort((a, b) => Number(b.orderId === op.productionOrderId) - Number(a.orderId === op.productionOrderId) || a.code.localeCompare(b.code))
  }, [goods.data, op.productionOrderId])
  const released = pool.filter((g) => !releaseIssue(g))
  const notReleased = pool.filter((g) => releaseIssue(g))
  const byId = new Map(pool.map((g) => [g.id, g]))

  const options = pool.map((g) => {
    const issue = releaseIssue(g)
    const linked = g.orderId === op.productionOrderId ? '★ ' : ''
    return {
      value: g.id,
      label: `${linked}${g.code} · ${g.product?.name}${g.variant ? ` ${g.variant.name}` : ''} — ${issue ?? `${g.availableUnits} u · ${formatGrams(g.availableGrams)} disp.`}`,
      disabled: !!issue,
    }
  })

  const total = lines.reduce((s, l) => s + (Number(l.value) || 0), 0)
  const valid = lines.length > 0 && lines.every((l) => {
    const g = byId.get(l.finishedGoodId)
    if (!g) return false
    const units = Number(l.units)
    return units >= 0 && units <= g.availableUnits && (units > 0 || Number(l.grams) > 0 || !!l.weighing) && Number(l.value) >= 0 && l.value !== '' && (!l.weigh || !!l.weighing)
  })

  const submit = useMutation({
    mutationFn: () =>
      api.post('/sales', {
        operationId: op.id,
        dispatchDate: date,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          finishedGoodId: l.finishedGoodId,
          units: Number(l.units) || 0,
          grams: l.weighing ? undefined : l.grams ? Number(l.grams) : undefined,
          value: Number(l.value),
          weighingId: l.weighing?.id,
        })),
      }),
    meta: { silent: true },
    onSuccess: () => {
      notify.success('Despacho registrado')
      setLines([newLine()])
      setNotes('')
      setBlocked(null)
      invalidate()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'PRODUCT_NOT_RELEASED') setBlocked(e.message)
      else notify.error(e instanceof Error ? e.message : 'No se pudo registrar el despacho')
    },
  })
  const upd = (i: number, patch: Partial<SaleLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <Card title="Despacho / venta al cliente" actions={<span className="flex items-center gap-1 text-[12px] text-ink-muted"><ShieldAlert className="size-3.5" /> Solo piezas liberadas por calidad y ley (RN-022)</span>}>
      {blocked && (
        <div data-testid="sale-blocked" className="mb-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div><p className="font-semibold">Despacho bloqueado: pieza no liberada</p><p>{blocked}</p></div>
        </div>
      )}
      {!goods.isLoading && released.length === 0 && (
        <p className="mb-3 rounded-md bg-warning-bg px-3 py-2 text-[13px] text-warning">No hay piezas de producto terminado liberadas para despachar en este momento.</p>
      )}
      <div className="space-y-3">
        {lines.map((l, i) => {
          const g = byId.get(l.finishedGoodId)
          return (
            <div key={i} className="rounded-md border border-border bg-page/50 p-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,2.4fr)_90px_120px_150px_auto] md:items-end">
                <FormField label={`Pieza ${i + 1}`} required>
                  <NativeSelect data-testid={`sale-good-${i}`} value={l.finishedGoodId} onChange={(e) => upd(i, { finishedGoodId: e.target.value, units: byId.get(e.target.value)?.units ? '1' : '0' })} placeholder={goods.isLoading ? 'Cargando…' : 'Selecciona una pieza liberada…'} options={options} />
                </FormField>
                <FormField label="Unidades">
                  <Input data-testid={`sale-units-${i}`} type="number" min={0} max={g?.availableUnits} value={l.units} onChange={(e) => upd(i, { units: e.target.value })} />
                </FormField>
                <FormField label="Gramos (opc.)">
                  <Input data-testid={`sale-grams-${i}`} type="number" min={0} step="0.01" disabled={!!l.weighing} value={l.weighing ? String(l.weighing.currentNetGrams) : l.grams} onChange={(e) => upd(i, { grams: e.target.value })} placeholder={g && g.units > 0 && Number(l.units) > 0 ? String(Math.round((g.grams / g.units) * Number(l.units) * 100) / 100) : ''} />
                </FormField>
                <FormField label="Valor (COP)" required>
                  <Input data-testid={`sale-value-${i}`} type="number" min={0} value={l.value} onChange={(e) => upd(i, { value: e.target.value })} />
                </FormField>
                <div className="flex gap-1">
                  <Button variant={l.weigh ? 'secondary' : 'ghost'} size="md" onClick={() => upd(i, { weigh: !l.weigh, weighing: null })} aria-label="Pesar" title="Pesaje opcional en Balanza Madre"><Scale className="size-4" /></Button>
                  {lines.length > 1 && <Button variant="ghost" size="md" aria-label="Quitar línea" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>}
                </div>
              </div>
              {g && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
                  <StatusBadge map={QUALITY} value={g.qualityStatus} />
                  <StatusBadge map={PURITY} value={g.purityStatus} />
                  {g.verifiedPurity && <span>Ley verificada {formatPurity(g.verifiedPurity)}</span>}
                  <span>· Disponible {g.availableUnits} u / {formatGrams(g.availableGrams)}</span>
                  {g.unitCostPerGram && <span>· Costo {formatMoney(g.unitCostPerGram)}/g</span>}
                  {l.value && l.value !== '0' && g.unitCostPerGram && <span>· Valor/g {formatMoney(Number(l.value) / (Number(l.grams) || l.weighing?.currentNetGrams || (g.units ? (g.grams / g.units) * Number(l.units) : g.availableGrams) || 1))}</span>}
                </div>
              )}
              {l.weigh && (
                <div className="mt-3 max-w-md">
                  <WeighingCapture purpose="SALE" value={l.weighing} onCaptured={(w) => upd(i, { weighing: w })} compact testId={`sale-weighing-${i}`} label="Pesaje de salida al cliente" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <Button variant="ghost" onClick={() => setLines((ls) => [...ls, newLine()])} data-testid="sale-add-line"><Plus className="size-4" /> Agregar pieza</Button>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Fecha de despacho" required className="w-40">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="sale-date" />
          </FormField>
          <FormField label="Notas" className="w-64">
            <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
          <div className="text-right">
            <p className="eyebrow">Total despacho</p>
            <p className="text-[20px] font-semibold text-ink tnum">{formatMoney(total)}</p>
          </div>
          <Button disabled={!valid} loading={submit.isPending} onClick={() => submit.mutate()} data-testid="sale-submit"><Truck className="size-4" /> Registrar despacho</Button>
        </div>
      </div>
      {notReleased.length > 0 && (
        <details className="mt-4 rounded-md border border-border bg-sunken/40 px-3 py-2 text-[12px]">
          <summary className="cursor-pointer font-medium text-ink-secondary">{notReleased.length} pieza(s) no liberadas — no se pueden despachar</summary>
          <ul className="mt-2 space-y-1">
            {notReleased.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 text-ink-muted">
                <span className="font-medium text-ink">{g.code}</span> {g.product?.name} · {g.availableUnits} u / {formatGrams(g.availableGrams)}
                <StatusBadge map={QUALITY} value={g.qualityStatus} />
                <StatusBadge map={PURITY} value={g.purityStatus} />
                <span className="text-danger">{releaseIssue(g)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {released.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-muted"><CheckCircle2 className="size-3.5 text-success" /> {released.length} pieza(s) liberadas disponibles{op.productionOrderId ? ' · ★ = de la orden vinculada' : ''}</p>
      )}
    </Card>
  )
}
