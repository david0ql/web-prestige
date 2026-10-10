import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Coins, Gem, Mail, MapPin, Pencil, Phone, Plus, Undo2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { formatDate, formatGrams, formatMoney, formatPurity } from '@/lib/format'
import { OPERATION_STATUS, TIMING, TX_STATUS } from '@/lib/labels'
import { usePermission } from '@/lib/auth/store'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { DataTable } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useAllPermissions } from '@/pages/analytics/components/reportKit'
import { ContributionModal, CustomerModal, OperationModal, PaymentModal, ReverseDialog } from './components/forms'
import { BalanceBlock, DualBalance, OPERATION_TYPE, materialRows, moneyRows, type CustomerAccount } from './components/shared'

/** P13 · Estado de cuenta del cliente: saldos de dinero y material separados (RN-016, RF-045, CA-009). */
export default function CustomerDetailPage() {
  const { customerId } = useParams({ from: '/app/clientes/$customerId' })
  const navigate = useNavigate()
  const canManage = usePermission('customers.manage')
  const canPay = usePermission('payments.manage')
  const canContribute = useAllPermissions('customer_material.manage', 'scale.weigh')
  const canReversePay = useAllPermissions('payments.manage', 'reversals.authorize')
  const canReverseContrib = useAllPermissions('customer_material.manage', 'reversals.authorize')
  const canReverseSale = useAllPermissions('sales.manage', 'reversals.authorize')
  const [modal, setModal] = useState<null | 'edit' | 'operation' | 'payment' | 'contribution'>(null)
  const [reverse, setReverse] = useState<{ path: string; label: string } | null>(null)

  const q = useQuery({ queryKey: ['customer-account', customerId], queryFn: () => api.get<CustomerAccount>(`/customers/${customerId}/account`) })
  const d = q.data
  const opNumber = useMemo(() => new Map((d?.operations ?? []).map((o) => [o.id, o.number])), [d])
  const grossContributed = useMemo(() => (d?.contributions ?? []).filter((c) => c.status === 'POSTED').reduce((s, c) => s + Number(c.grams), 0), [d])
  const opLink = (id: string | null) =>
    id ? (
      <Link to="/operaciones/$operationId" params={{ operationId: id }} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
        {opNumber.get(id) ?? 'Operación'}
      </Link>
    ) : (
      <span className="text-ink-muted">A cuenta</span>
    )

  return (
    <div>
      <PageHeader
        code="P13"
        breadcrumbs={[{ label: 'Clientes y abonos', to: '/clientes' }, { label: d?.customer.name ?? 'Cliente' }]}
        title={d?.customer.name ?? 'Estado de cuenta'}
        description={d ? `${d.customer.documentType} ${d.customer.documentNumber} · Estado de cuenta con saldos de dinero y material independientes` : undefined}
        actions={
          d && (
            <>
              {canManage && <Button variant="ghost" onClick={() => setModal('edit')}><Pencil className="size-4" /> Editar</Button>}
              {canManage && <Button variant="secondary" onClick={() => setModal('operation')} data-testid="operation-new"><Plus className="size-4" /> Nueva operación</Button>}
              {canContribute && <Button variant="secondary" onClick={() => setModal('contribution')} data-testid="contribution-new" disabled={!d.operations.length}><Gem className="size-4" /> Aporte de material</Button>}
              {canPay && <Button onClick={() => setModal('payment')} data-testid="payment-new"><Coins className="size-4" /> Registrar abono</Button>}
            </>
          )
        }
      />
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {d && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-secondary">
              {d.customer.status === 'INACTIVE' && <Badge variant="warning">Cliente inactivo</Badge>}
              {d.customer.phone && <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-ink-muted" /> {d.customer.phone}</span>}
              {d.customer.email && <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 text-ink-muted" /> {d.customer.email}</span>}
              {(d.customer.city || d.customer.address) && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-ink-muted" /> {[d.customer.address, d.customer.city].filter(Boolean).join(', ')}</span>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <BalanceBlock kind="money" testId="balance-money" rows={moneyRows(d.totals.money)} />
              <BalanceBlock kind="material" testId="balance-material" rows={materialRows({ ...d.totals.material, contributedGrossGrams: grossContributed })} />
            </div>

            <Tabs defaultValue="operations">
              <TabsList className="mb-3 overflow-x-auto whitespace-nowrap">
                <TabsTrigger value="operations" count={d.operations.length}>Operaciones</TabsTrigger>
                <TabsTrigger value="payments" count={d.payments.length}>Abonos en dinero</TabsTrigger>
                <TabsTrigger value="contributions" count={d.contributions.length}>Aportes de material</TabsTrigger>
                <TabsTrigger value="sales" count={d.sales.length}>Despachos / ventas</TabsTrigger>
              </TabsList>

              <TabsContent value="operations">
                <Card flush>
                  <DataTable
                    testId="account-operations"
                    rows={d.operations}
                    rowKey={(o) => o.id}
                    onRowClick={(o) => void navigate({ to: '/operaciones/$operationId', params: { operationId: o.id } })}
                    empty={{ title: 'Sin operaciones', description: 'Crea una venta o encargo para registrar abonos y aportes.', action: canManage && <Button size="sm" onClick={() => setModal('operation')}><Plus className="size-3.5" /> Nueva operación</Button> }}
                    columns={[
                      { key: 'n', header: 'Operación', cell: (o) => <div><p className="font-semibold text-ink">{o.number}</p><p className="text-[12px] text-ink-muted">{OPERATION_TYPE[o.type] ?? o.type} · {formatDate(o.createdAt)}</p></div> },
                      { key: 'd', header: 'Descripción', cell: (o) => <span className="line-clamp-2 max-w-72">{o.description}</span> },
                      { key: 's', header: 'Estado', cell: (o) => <StatusBadge map={OPERATION_STATUS} value={o.status} /> },
                      { key: 'v', header: 'Valor', align: 'right', hideOnMobile: true, cell: (o) => formatMoney(o.totalValue) },
                      { key: 'p', header: 'Abonado', align: 'right', hideOnMobile: true, cell: (o) => formatMoney(o.balances?.money.paid) },
                      { key: 'c', header: 'Fino compr. / aport.', align: 'right', hideOnMobile: true, cell: (o) => <span className="whitespace-nowrap">{formatGrams(o.balances?.material.committedFineGrams, 3)} / {formatGrams(o.balances?.material.contributedFineGrams, 3)}</span> },
                      { key: 'b', header: 'Saldos', align: 'right', cell: (o) => <DualBalance money={o.balances?.money.balance ?? 0} material={o.balances?.material.balanceFineGrams ?? 0} /> },
                    ]}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="payments">
                <Card flush>
                  <DataTable
                    testId="account-payments"
                    rows={d.payments}
                    rowKey={(p) => p.id}
                    empty={{ title: 'Sin abonos en dinero' }}
                    columns={[
                      { key: 'n', header: 'Abono', cell: (p) => <span className="font-semibold">{p.number}</span> },
                      { key: 'f', header: 'Fecha', cell: (p) => formatDate(p.paymentDate) },
                      { key: 'o', header: 'Operación', cell: (p) => opLink(p.operationId) },
                      { key: 'm', header: 'Medio', cell: (p) => p.paymentMethod?.name ?? '—' },
                      { key: 'r', header: 'Referencia', hideOnMobile: true, cell: (p) => p.reference ?? '—' },
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
                    testId="account-contributions"
                    rows={d.contributions}
                    rowKey={(c) => c.id}
                    empty={{ title: 'Sin aportes de material' }}
                    columns={[
                      { key: 'n', header: 'Aporte', cell: (c) => <div><p className="font-semibold">{c.number}</p><p className="text-[12px] text-ink-muted">{formatDate(c.contributionDate)}</p></div> },
                      { key: 'o', header: 'Operación', cell: (c) => opLink(c.operationId) },
                      { key: 'm', header: 'Material', cell: (c) => <div><p>{c.material?.name}</p><p className="text-[12px] text-ink-muted">{c.origin}</p></div> },
                      { key: 't', header: 'Momento', hideOnMobile: true, cell: (c) => <Badge variant={c.timing === 'AFTER_FABRICATION' ? 'gold' : 'info'}>{TIMING[c.timing] ?? c.timing}</Badge> },
                      { key: 'g', header: 'Peso bruto', align: 'right', cell: (c) => formatGrams(c.grams, 3) },
                      { key: 'l', header: 'Ley decl. / verif.', align: 'right', hideOnMobile: true, cell: (c) => <span className="whitespace-nowrap">{formatPurity(c.declaredPurity)} / {c.verifiedPurity ? formatPurity(c.verifiedPurity) : '—'}</span> },
                      { key: 'f', header: 'Gramos finos', align: 'right', cell: (c) => <span className={c.status === 'REVERSED' ? 'text-ink-muted line-through' : 'font-semibold text-info'}>{formatGrams(c.fineGrams, 3)}</span> },
                      { key: 'v', header: 'Valoración', align: 'right', hideOnMobile: true, cell: (c) => formatMoney(c.valuation) },
                      { key: 's', header: 'Estado', cell: (c) => <StatusBadge map={TX_STATUS} value={c.status} /> },
                      { key: 'x', header: '', align: 'right', cell: (c) => canReverseContrib && c.status === 'POSTED' && <Button size="sm" variant="ghost" onClick={() => setReverse({ path: `/customer-contributions/${c.id}/reverse`, label: `aporte ${c.number}` })}><Undo2 className="size-3.5" /> Reversar</Button> },
                    ]}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="sales">
                <Card flush>
                  <DataTable
                    testId="account-sales"
                    rows={d.sales}
                    rowKey={(s) => s.id}
                    empty={{ title: 'Sin despachos al cliente' }}
                    columns={[
                      { key: 'n', header: 'Despacho', cell: (s) => <span className="font-semibold">{s.number}</span> },
                      { key: 'f', header: 'Fecha', cell: (s) => formatDate(s.dispatchDate) },
                      { key: 'o', header: 'Operación', cell: (s) => opLink(s.operationId) },
                      { key: 'p', header: 'Piezas', cell: (s) => <ul className="text-[12px]">{s.lines.map((l) => <li key={l.id}>{l.finishedGood?.code} · {l.finishedGood?.product?.name} — {l.units} u · {formatGrams(l.grams)}</li>)}</ul> },
                      { key: 'v', header: 'Valor', align: 'right', cell: (s) => <span className={s.reversed ? 'text-ink-muted line-through' : 'font-semibold'}>{formatMoney(s.totalValue)}</span> },
                      { key: 's', header: 'Estado', cell: (s) => <StatusBadge map={TX_STATUS} value={s.reversed ? 'REVERSED' : 'POSTED'} /> },
                      { key: 'x', header: '', align: 'right', cell: (s) => canReverseSale && !s.reversed && <Button size="sm" variant="ghost" onClick={() => setReverse({ path: `/sales/${s.id}/reverse`, label: `despacho ${s.number}` })}><Undo2 className="size-3.5" /> Reversar</Button> },
                    ]}
                  />
                </Card>
              </TabsContent>
            </Tabs>

            <CustomerModal open={modal === 'edit'} onOpenChange={(o) => !o && setModal(null)} customer={d.customer} />
            <OperationModal open={modal === 'operation'} onOpenChange={(o) => !o && setModal(null)} customerId={customerId} onSaved={(o) => void navigate({ to: '/operaciones/$operationId', params: { operationId: o.id } })} />
            <PaymentModal open={modal === 'payment'} onOpenChange={(o) => !o && setModal(null)} customerId={customerId} operations={d.operations} operationId={d.operations.length === 1 ? d.operations[0].id : undefined} />
            <ContributionModal open={modal === 'contribution'} onOpenChange={(o) => !o && setModal(null)} customerId={customerId} operations={d.operations} operationId={d.operations.length === 1 ? d.operations[0].id : undefined} />
            <ReverseDialog target={reverse} onClose={() => setReverse(null)} />
          </div>
        )}
      </QueryState>
    </div>
  )
}
