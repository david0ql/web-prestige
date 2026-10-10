import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownCircle, ArrowUpCircle, Hash, Lock, Paperclip, Plus, Undo2, Wallet } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { FinancialTransaction } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { useFinanceCategories, useWorkshops } from '@/lib/hooks/useMasters'
import { formatDate, formatDateTime, formatGrams, formatMoney, monthStartIso, todayIso } from '@/lib/format'
import { TX_STATUS } from '@/lib/labels'
import { GRID, SERIES, axisProps } from '@/lib/chart'
import { PageHeader } from '@/components/domain/PageHeader'
import { Stat } from '@/components/domain/Stat'
import { DataTable } from '@/components/domain/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { QueryState } from '@/components/domain/QueryState'
import { ReasonDialog } from '@/components/domain/ReasonDialog'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { ChartTooltip } from '@/components/domain/ChartTooltip'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { FormField } from '@/components/ui/FormField'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { SearchInput } from '@/components/ui/SearchInput'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { notify } from '@/components/ui/Toaster'
import { DateFilter, FilterBar, shortMoney, useAllPermissions } from '@/pages/analytics/components/reportKit'
import { SupportsDrawer, TransactionModal, type TxPreset } from './components/TransactionModal'

interface Summary {
  income: number
  expense: number
  balance: number
  count: number
  byCategory: { key: string; income: number; expense: number }[]
  byPaymentMethod: { key: string; income: number; expense: number }[]
}
interface CostEntry { id: string; type: 'MATERIAL' | 'LABOR' | 'OTHER'; orderId: string | null; workshopId: string | null; materialId: string | null; grams: number | null; amount: number; description: string; periodDate: string; sourceType: string; createdAt: string }
interface Payable { workshop: { id: string; code: string; name: string }; approvedLabor: number; paid: number; balance: number }
interface PeriodClose { id: string; period: string; totals: Record<string, number>; notes: string | null; closedAt: string; closedById: string }

const COST_TYPE: Record<string, string> = { MATERIAL: 'Material', LABOR: 'Mano de obra', OTHER: 'Otros' }
const CLOSE_LABELS: Record<string, string> = { income: 'Ingresos', expense: 'Egresos', balance: 'Saldo', materialCost: 'Costo material', laborCost: 'Mano de obra' }
const SOURCE: Record<string, string> = { MANUAL: 'Manual', CUSTOMER_PAYMENT: 'Abono de cliente', WORKSHOP_PAYMENT: 'Pago a taller', REVERSAL: 'Reverso', SALE: 'Venta' }

/** P14 · Caja / Finanzas (RF-028/029, RN-020). */
export default function FinancePage() {
  const canManage = usePermission('finance.manage')
  const canReverse = useAllPermissions('finance.manage', 'reversals.authorize')
  const canClose = usePermission('finance.close')
  const [from, setFrom] = useState(monthStartIso())
  const [to, setTo] = useState(todayIso())
  const [tab, setTab] = useState('summary')
  const [txModal, setTxModal] = useState<{ preset: TxPreset | null } | null>(null)

  const summary = useQuery({ queryKey: ['finance', 'summary', from, to], queryFn: () => api.get<Summary>('/finance/summary', { from, to }) })
  const s = summary.data

  return (
    <div>
      <PageHeader
        code="P14"
        title="Caja / Finanzas"
        description="Ingresos, egresos, costos aprobados, pagos a talleres, soportes y cierres de período."
        actions={canManage && <Button onClick={() => setTxModal({ preset: null })} data-testid="tx-new"><Plus className="size-4" /> Nueva transacción</Button>}
      />
      <FilterBar>
        <DateFilter label="Desde" value={from} onChange={setFrom} testId="finance-from" />
        <DateFilter label="Hasta" value={to} onChange={setTo} testId="finance-to" />
        <p className="pb-1.5 text-[12px] text-ink-muted">El período aplica al resumen, transacciones y costos.</p>
      </FilterBar>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ArrowUpCircle} tone="success" label="Ingresos" value={formatMoney(s?.income)} testId="kpi-income" />
        <Stat icon={ArrowDownCircle} tone="danger" label="Egresos" value={formatMoney(s?.expense)} testId="kpi-expense" />
        <Stat icon={Wallet} tone="gold" label="Saldo del período" value={formatMoney(s?.balance)} hint="Ingresos − egresos contabilizados" testId="kpi-balance" />
        <Stat icon={Hash} label="Transacciones" value={s?.count ?? '—'} hint={`${formatDate(from)} – ${formatDate(to)}`} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 overflow-x-auto">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          <TabsTrigger value="costs">Costos aprobados</TabsTrigger>
          <TabsTrigger value="payables">Pagos a talleres</TabsTrigger>
          <TabsTrigger value="closes">Cierres de período</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <QueryState isLoading={summary.isLoading} error={summary.error} onRetry={() => void summary.refetch()}>
            {s && (
              <div className="grid gap-4 lg:grid-cols-2">
                <SplitChart title="Ingresos y egresos por categoría" data={s.byCategory} />
                <SplitChart title="Ingresos y egresos por medio de pago" data={s.byPaymentMethod} />
              </div>
            )}
          </QueryState>
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsTab from={from} to={to} canReverse={canReverse} canManage={canManage} />
        </TabsContent>
        <TabsContent value="costs">
          <CostsTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="payables">
          <PayablesTab canManage={canManage} onPay={(p) => setTxModal({ preset: { type: 'EXPENSE', categoryCode: 'PAGO_TALLER', workshopId: p.workshop.id, amount: p.balance, concept: `Pago mano de obra ${p.workshop.name}` } })} />
        </TabsContent>
        <TabsContent value="closes">
          <ClosesTab canClose={canClose} />
        </TabsContent>
      </Tabs>

      <TransactionModal open={!!txModal} onOpenChange={(o) => !o && setTxModal(null)} preset={txModal?.preset} />
    </div>
  )
}

function SplitChart({ title, data }: { title: string; data: { key: string; income: number; expense: number }[] }) {
  const rows = [...data].sort((a, b) => b.income + b.expense - (a.income + a.expense))
  return (
    <Card title={title}>
      {rows.length ? (
        <div style={{ height: Math.max(220, rows.length * 44 + 60) }} role="img" aria-label={title}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barGap={2}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => shortMoney(Number(v))} />
              <YAxis type="category" dataKey="key" {...axisProps} width={150} />
              <Tooltip cursor={{ fill: '#f5ead0' }} content={<ChartTooltip format={(v) => formatMoney(v)} />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#4a4336' }} />
              <Bar dataKey="income" name="Ingresos" fill={SERIES[2]} radius={[0, 4, 4, 0]} maxBarSize={16} />
              <Bar dataKey="expense" name="Egresos" fill={SERIES[5]} radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-16 text-center text-[13px] text-ink-muted">Sin movimientos en el período.</p>
      )}
    </Card>
  )
}

function TransactionsTab({ from, to, canReverse, canManage }: { from: string; to: string; canReverse: boolean; canManage: boolean }) {
  const { data: categories } = useFinanceCategories()
  const { data: workshops } = useWorkshops()
  const qc = useQueryClient()
  const [type, setType] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [workshopId, setWorkshopId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [reverse, setReverse] = useState<FinancialTransaction | null>(null)
  const [supports, setSupports] = useState<FinancialTransaction | null>(null)
  const q = useDebounced(search, 300)
  const wsName = useMemo(() => new Map((workshops ?? []).map((w) => [w.id, w.name])), [workshops])

  const list = useQuery({
    queryKey: ['finance', 'transactions', from, to, type, categoryId, workshopId, q, page],
    queryFn: () => api.get<Paginated<FinancialTransaction>>('/finance/transactions', { from, to, type, categoryId, workshopId, search: q, page, pageSize: 20 }),
    placeholderData: (p) => p,
  })
  const rev = useMutation({
    mutationFn: (reason: string) => api.post(`/finance/transactions/${reverse!.id}/reverse`, { reason }),
    onSuccess: () => {
      notify.success(`Transacción ${reverse?.number} reversada`)
      void qc.invalidateQueries({ queryKey: ['finance'] })
      setReverse(null)
    },
  })
  const reset = () => setPage(1)

  return (
    <Card flush>
      <div className="flex flex-wrap items-end gap-2 border-b border-border p-3">
        <SearchInput value={search} onValueChange={(v) => { setSearch(v); reset() }} placeholder="Concepto, número, tercero, soporte…" className="w-full sm:w-72" data-testid="tx-search" />
        <div className="w-36"><NativeSelect data-testid="tx-filter-type" value={type} onChange={(e) => { setType(e.target.value); setCategoryId(''); reset() }} options={[{ value: '', label: 'Todos los tipos' }, { value: 'INCOME', label: 'Ingresos' }, { value: 'EXPENSE', label: 'Egresos' }]} /></div>
        <div className="w-52"><NativeSelect value={categoryId} onChange={(e) => { setCategoryId(e.target.value); reset() }} options={[{ value: '', label: 'Todas las categorías' }, ...(categories ?? []).filter((c) => !type || c.type === type).map((c) => ({ value: c.id, label: c.name }))]} /></div>
        <div className="w-44"><NativeSelect value={workshopId} onChange={(e) => { setWorkshopId(e.target.value); reset() }} options={[{ value: '', label: 'Todos los talleres' }, ...(workshops ?? []).map((w) => ({ value: w.id, label: w.name }))]} /></div>
      </div>
      <DataTable
        testId="tx-table"
        loading={list.isLoading}
        rows={list.data?.items}
        rowKey={(t) => t.id}
        pagination={list.data && { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: setPage }}
        empty={{ title: 'Sin transacciones', description: 'No hay movimientos para los filtros y el período seleccionados.' }}
        columns={[
          { key: 'n', header: 'Número', cell: (t) => <div className="whitespace-nowrap"><p className="font-semibold">{t.number}</p><p className="text-[12px] text-ink-muted">{formatDate(t.transactionDate)}</p></div> },
          { key: 't', header: 'Tipo', cell: (t) => <Badge variant={t.type === 'INCOME' ? 'success' : 'danger'}>{t.type === 'INCOME' ? 'Ingreso' : 'Egreso'}</Badge> },
          { key: 'c', header: 'Categoría / concepto', cell: (t) => <div><p className="text-ink">{t.concept}</p><p className="text-[12px] text-ink-muted">{t.category?.name} · {SOURCE[t.source] ?? t.source}</p></div> },
          { key: 'p', header: 'Tercero', hideOnMobile: true, cell: (t) => <span className="text-[12px]">{t.thirdPartyName ?? (t.workshopId ? `Taller ${wsName.get(t.workshopId) ?? ''}` : t.customerId ? 'Cliente' : '—')}</span> },
          { key: 'm', header: 'Medio', hideOnMobile: true, cell: (t) => t.paymentMethod?.name ?? '—' },
          { key: 'r', header: 'Soporte', hideOnMobile: true, cell: (t) => <span className="text-[12px] whitespace-nowrap">{t.supportReference ?? <span className="text-ink-placeholder">—</span>}</span> },
          { key: 'a', header: 'Valor', align: 'right', cell: (t) => <span className={`whitespace-nowrap ${t.status === 'REVERSED' ? 'text-ink-muted line-through' : t.type === 'INCOME' ? 'font-semibold text-success' : 'font-semibold text-ink'}`}>{t.type === 'INCOME' ? '+' : '−'}{formatMoney(t.amount)}</span> },
          { key: 's', header: 'Estado', cell: (t) => <StatusBadge map={TX_STATUS} value={t.status} /> },
          {
            key: 'x',
            header: '',
            align: 'right',
            cell: (t) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setSupports(t)} title="Soportes" aria-label="Soportes" data-testid={`tx-supports-${t.number}`}><Paperclip className="size-3.5" /></Button>
                {canReverse && t.status === 'POSTED' && t.source !== 'REVERSAL' && <Button size="sm" variant="ghost" onClick={() => setReverse(t)}><Undo2 className="size-3.5" /> Reversar</Button>}
              </div>
            ),
          },
        ]}
      />
      <ReasonDialog open={!!reverse} onOpenChange={(o) => !o && setReverse(null)} title={`Reversar ${reverse?.number ?? ''}`} description="Se genera una transacción de reverso; la original no se elimina (RN-015)." confirmLabel="Reversar" danger loading={rev.isPending} onConfirm={(r) => rev.mutate(r)} />
      <SupportsDrawer tx={supports} onClose={() => setSupports(null)} canUpload={canManage} />
    </Card>
  )
}

function CostsTab({ from, to }: { from: string; to: string }) {
  const { data: workshops } = useWorkshops()
  const [type, setType] = useState('')
  const [workshopId, setWorkshopId] = useState('')
  const [page, setPage] = useState(1)
  const wsName = useMemo(() => new Map((workshops ?? []).map((w) => [w.id, w.name])), [workshops])
  const list = useQuery({
    queryKey: ['finance', 'costs', from, to, type, workshopId, page],
    queryFn: () => api.get<Paginated<CostEntry>>('/finance/costs', { from, to, type, workshopId, page, pageSize: 20 }),
    placeholderData: (p) => p,
  })
  const total = (list.data?.items ?? []).reduce((a, c) => a + Number(c.amount), 0)
  return (
    <Card flush>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="w-40"><NativeSelect value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} options={[{ value: '', label: 'Todos los tipos' }, ...Object.entries(COST_TYPE).map(([value, label]) => ({ value, label }))]} /></div>
        <div className="w-44"><NativeSelect value={workshopId} onChange={(e) => { setWorkshopId(e.target.value); setPage(1) }} options={[{ value: '', label: 'Todos los talleres' }, ...(workshops ?? []).map((w) => ({ value: w.id, label: w.name }))]} /></div>
        <p className="ml-auto text-[12px] text-ink-muted">Costos aprobados por Prestige Gold (RF-024): impactan finanzas solo tras aprobación.</p>
      </div>
      <DataTable
        testId="costs-table"
        loading={list.isLoading}
        rows={list.data?.items}
        rowKey={(c) => c.id}
        pagination={list.data && { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: setPage }}
        empty={{ title: 'Sin costos aprobados en el período' }}
        footer={
          list.data?.items.length ? (
            <tr className="border-t border-border bg-sunken/50">
              <td colSpan={5} className="px-3 py-2 text-right text-[12px] font-semibold text-ink-secondary">Total página</td>
              <td className="px-3 py-2 text-right font-semibold tnum">{formatMoney(total)}</td>
            </tr>
          ) : undefined
        }
        columns={[
          { key: 'd', header: 'Fecha', cell: (c) => formatDate(c.periodDate) },
          { key: 't', header: 'Tipo', cell: (c) => <Badge variant={c.type === 'LABOR' ? 'info' : c.type === 'MATERIAL' ? 'gold' : 'neutral'}>{COST_TYPE[c.type] ?? c.type}</Badge> },
          { key: 'desc', header: 'Descripción', cell: (c) => <div><p>{c.description}</p>{c.orderId && <Link to="/ordenes/$orderId" params={{ orderId: c.orderId }} className="text-[12px] text-brand-700 hover:underline">Ver orden</Link>}</div> },
          { key: 'w', header: 'Taller', hideOnMobile: true, cell: (c) => (c.workshopId ? wsName.get(c.workshopId) ?? '—' : '—') },
          { key: 'g', header: 'Gramos', align: 'right', hideOnMobile: true, cell: (c) => (c.grams ? formatGrams(c.grams) : '—') },
          { key: 'a', header: 'Monto', align: 'right', cell: (c) => <span className="font-semibold">{formatMoney(c.amount)}</span> },
        ]}
      />
    </Card>
  )
}

function PayablesTab({ canManage, onPay }: { canManage: boolean; onPay: (p: Payable) => void }) {
  const q = useQuery({ queryKey: ['finance', 'payables'], queryFn: () => api.get<Payable[]>('/finance/workshop-payables') })
  const totals = (q.data ?? []).reduce((a, p) => ({ approved: a.approved + p.approvedLabor, paid: a.paid + p.paid, balance: a.balance + p.balance }), { approved: 0, paid: 0, balance: 0 })
  return (
    <Card flush title="Mano de obra aprobada vs pagada" actions={<span className="text-[12px] text-ink-muted">Saldo total por pagar: <b className="text-ink tnum">{formatMoney(totals.balance)}</b></span>}>
      <DataTable
        testId="payables-table"
        loading={q.isLoading}
        rows={q.data}
        rowKey={(p) => p.workshop.id}
        empty={{ title: 'Sin talleres' }}
        footer={
          <tr className="border-t border-border bg-sunken/50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right tnum">{formatMoney(totals.approved)}</td>
            <td className="px-3 py-2 text-right tnum">{formatMoney(totals.paid)}</td>
            <td className="hidden px-3 py-2 md:table-cell" />
            <td className="px-3 py-2 text-right tnum">{formatMoney(totals.balance)}</td>
            <td />
          </tr>
        }
        columns={[
          { key: 'w', header: 'Taller', cell: (p) => <span className="font-medium">{p.workshop.code} · {p.workshop.name}</span> },
          { key: 'a', header: 'Aprobada', align: 'right', cell: (p) => formatMoney(p.approvedLabor) },
          { key: 'p', header: 'Pagada', align: 'right', cell: (p) => formatMoney(p.paid) },
          {
            key: 'bar',
            header: 'Avance de pago',
            hideOnMobile: true,
            cell: (p) => {
              const pct = p.approvedLabor ? Math.min(100, (p.paid / p.approvedLabor) * 100) : 0
              return (
                <div className="flex w-40 items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-sunken"><div className="h-2 rounded-full gold-gradient" style={{ width: `${pct}%` }} /></div>
                  <span className="w-9 text-right text-[11px] text-ink-muted tnum">{p.approvedLabor ? `${Math.round(pct)}%` : '—'}</span>
                </div>
              )
            },
          },
          { key: 'b', header: 'Saldo', align: 'right', cell: (p) => <span className={p.balance > 0 ? 'font-semibold text-danger' : 'text-ink-muted'}>{formatMoney(p.balance)}</span> },
          { key: 'x', header: '', align: 'right', cell: (p) => canManage && p.balance > 0 && <Button size="sm" variant="secondary" onClick={() => onPay(p)} data-testid={`pay-workshop-${p.workshop.code}`}><Wallet className="size-3.5" /> Registrar pago</Button> },
        ]}
      />
    </Card>
  )
}

function ClosesTab({ canClose }: { canClose: boolean }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['finance', 'closes'], queryFn: () => api.get<PeriodClose[]>('/finance/period-closes') })
  const lastMonth = (() => {
    const d = new Date()
    d.setDate(0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const [period, setPeriod] = useState(lastMonth)
  const [notes, setNotes] = useState('')
  const [confirm, setConfirm] = useState(false)
  const close = useMutation({
    mutationFn: () => api.post<PeriodClose>('/finance/period-closes', { period, notes: notes || undefined }),
    onSuccess: (c) => {
      notify.success(`Período ${c.period} cerrado`)
      setNotes('')
      setConfirm(false)
      void qc.invalidateQueries({ queryKey: ['finance'] })
    },
  })
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card flush title="Cierres registrados">
        <DataTable
          testId="closes-table"
          loading={q.isLoading}
          rows={q.data}
          rowKey={(c) => c.id}
          empty={{ title: 'Sin cierres de período', description: 'Al cerrar un mes se bloquean nuevos registros con fecha en ese período.' }}
          columns={[
            { key: 'p', header: 'Período', cell: (c) => <span className="inline-flex items-center gap-1.5 font-semibold"><Lock className="size-3.5 text-ink-muted" /> {formatDate(`${c.period}-01`, 'MMMM yyyy')}</span> },
            ...Object.entries(CLOSE_LABELS).map(([k, l]) => ({ key: k, header: l, align: 'right' as const, cell: (c: PeriodClose) => formatMoney(c.totals?.[k]) })),
            { key: 'at', header: 'Cerrado', hideOnMobile: true, cell: (c) => <div className="text-[12px]"><p>{formatDateTime(c.closedAt)}</p>{c.notes && <p className="text-ink-muted">{c.notes}</p>}</div> },
          ]}
        />
      </Card>
      {canClose && (
        <Card title="Cerrar período">
          <div className="space-y-3">
            <FormField label="Mes a cerrar" required hint="Solo meses terminados. El cierre es definitivo.">
              <Input type="month" value={period} max={lastMonth} onChange={(e) => setPeriod(e.target.value)} data-testid="close-period" />
            </FormField>
            <FormField label="Notas">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormField>
            <Button className="w-full" disabled={!/^\d{4}-\d{2}$/.test(period)} onClick={() => setConfirm(true)} data-testid="close-submit"><Lock className="size-4" /> Cerrar período</Button>
          </div>
          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Cerrar ${period}`} confirmLabel="Cerrar definitivamente" danger loading={close.isPending} onConfirm={() => close.mutate()}>
            Se consolidarán ingresos, egresos y costos del mes y se bloquearán nuevos registros con fecha en ese período. Esta acción no se puede deshacer.
          </ConfirmDialog>
        </Card>
      )}
    </div>
  )
}

