import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Coins, FileText, Gem, Handshake, Pencil, Plus, Users } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { CustomerOperation } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatDate, formatGrams, formatMoney } from '@/lib/format'
import { OPERATION_STATUS } from '@/lib/labels'
import { PageHeader } from '@/components/domain/PageHeader'
import { DataTable } from '@/components/domain/DataTable'
import { Stat } from '@/components/domain/Stat'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SearchInput } from '@/components/ui/SearchInput'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { CustomerModal } from './components/forms'
import { DualBalance, OPERATION_TYPE, type CustomerFull } from './components/shared'

interface Agg { operations: number; open: number; money: number; material: number }

/** P13 · Clientes y abonos (RF-026/027/045). */
export default function CustomersPage() {
  const navigate = useNavigate()
  const canManage = usePermission('customers.manage')
  const [tab, setTab] = useState('customers')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('ACTIVE')
  const [opStatus, setOpStatus] = useState('')
  const [opSearch, setOpSearch] = useState('')
  const [modal, setModal] = useState<{ customer: CustomerFull | null } | null>(null)
  const q = useDebounced(search, 300)
  const oq = useDebounced(opSearch, 300)

  const customers = useQuery({
    queryKey: ['customers', 'list', q, status, page],
    queryFn: () => api.get<Paginated<CustomerFull>>('/customers', { search: q, status, page, pageSize: 20 }),
    placeholderData: (p) => p,
  })
  // Saldos resumidos: se agregan desde las operaciones (cada una trae balances dinero/material separados).
  const ops = useQuery({
    queryKey: ['customers', 'operations', 'all'],
    queryFn: () => api.get<Paginated<CustomerOperation>>('/customer-operations', { pageSize: 200 }),
  })
  const opsFiltered = useQuery({
    queryKey: ['customers', 'operations', oq, opStatus],
    queryFn: () => api.get<Paginated<CustomerOperation>>('/customer-operations', { pageSize: 50, search: oq, status: opStatus }),
    enabled: tab === 'operations',
    placeholderData: (p) => p,
  })

  const agg = useMemo(() => {
    const m = new Map<string, Agg>()
    for (const o of ops.data?.items ?? []) {
      const a = m.get(o.customerId) ?? { operations: 0, open: 0, money: 0, material: 0 }
      a.operations++
      if (o.status !== 'CANCELLED') {
        if (!['CLOSED', 'DISPATCHED'].includes(o.status)) a.open++
        a.money += o.balances?.money.balance ?? 0
        a.material += o.balances?.material.balanceFineGrams ?? 0
      }
      m.set(o.customerId, a)
    }
    return m
  }, [ops.data])
  const totals = useMemo(() => {
    let money = 0, material = 0, open = 0, paid = 0
    for (const o of ops.data?.items ?? []) {
      if (o.status === 'CANCELLED') continue
      money += o.balances?.money.balance ?? 0
      material += o.balances?.material.balanceFineGrams ?? 0
      paid += o.balances?.money.paid ?? 0
      if (!['CLOSED', 'DISPATCHED'].includes(o.status)) open++
    }
    return { money, material, open, paid }
  }, [ops.data])

  return (
    <div>
      <PageHeader
        code="P13"
        title="Clientes y abonos"
        description="Ventas, encargos, abonos en dinero y aportes de material. Los saldos de dinero y de material se controlan por separado (RN-016)."
        actions={canManage && <Button onClick={() => setModal({ customer: null })} data-testid="customer-new"><Plus className="size-4" /> Nuevo cliente</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Clientes" value={customers.data?.total ?? '—'} hint={status === 'ACTIVE' ? 'Activos' : 'Según filtro'} />
        <Stat icon={Handshake} label="Operaciones abiertas" value={totals.open} hint={`${ops.data?.total ?? 0} operaciones en total`} />
        <Stat icon={Coins} tone="gold" label="Saldo por cobrar (dinero)" value={formatMoney(totals.money)} hint={`Abonado ${formatMoney(totals.paid)}`} testId="kpi-money-balance" />
        <Stat icon={Gem} label="Material pendiente (fino)" value={formatGrams(totals.material, 3)} hint="Comprometido − aportado" testId="kpi-material-balance" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="customers" count={customers.data?.total}>Clientes</TabsTrigger>
          <TabsTrigger value="operations" count={ops.data?.total}>Operaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <Card flush>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1) }} placeholder="Buscar por nombre, documento o correo…" className="w-full sm:w-80" data-testid="customer-search" />
              <div className="w-40">
                <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} options={[{ value: 'ACTIVE', label: 'Activos' }, { value: 'INACTIVE', label: 'Inactivos' }, { value: '', label: 'Todos' }]} />
              </div>
            </div>
            <DataTable
              testId="customers-table"
              loading={customers.isLoading}
              rows={customers.data?.items}
              rowKey={(c) => c.id}
              onRowClick={(c) => void navigate({ to: '/clientes/$customerId', params: { customerId: c.id } })}
              pagination={customers.data && { page, pageSize: customers.data.pageSize, total: customers.data.total, onPageChange: setPage }}
              empty={{ title: 'Sin clientes', description: search ? 'Ningún cliente coincide con la búsqueda.' : 'Crea el primer cliente para registrar ventas y abonos.' }}
              columns={[
                {
                  key: 'name',
                  header: 'Cliente',
                  cell: (c) => (
                    <div>
                      <p className="font-semibold text-ink">{c.name} {c.status === 'INACTIVE' && <Badge className="ml-1">Inactivo</Badge>}</p>
                      <p className="text-[12px] text-ink-muted">{c.documentType} {c.documentNumber}</p>
                    </div>
                  ),
                },
                { key: 'contact', header: 'Contacto', hideOnMobile: true, cell: (c) => <div className="text-[12px] text-ink-secondary"><p>{c.phone ?? '—'}</p><p className="text-ink-muted">{c.email ?? ''}</p></div> },
                { key: 'city', header: 'Ciudad', hideOnMobile: true, cell: (c) => c.city ?? '—' },
                { key: 'ops', header: 'Operaciones', align: 'center', cell: (c) => { const a = agg.get(c.id); return a ? <span className="tnum">{a.open} <span className="text-ink-muted">/ {a.operations}</span></span> : <span className="text-ink-muted">0</span> } },
                { key: 'balance', header: 'Saldos (dinero · fino)', align: 'right', cell: (c) => { const a = agg.get(c.id); return <DualBalance money={a?.money ?? 0} material={a?.material ?? 0} /> } },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (c) => (
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {canManage && <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setModal({ customer: c })}><Pencil className="size-3.5" /></Button>}
                      <Button size="sm" variant="secondary" onClick={() => void navigate({ to: '/clientes/$customerId', params: { customerId: c.id } })}><FileText className="size-3.5" /> Estado de cuenta</Button>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="operations">
          <Card flush>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <SearchInput value={opSearch} onValueChange={setOpSearch} placeholder="Buscar operación…" className="w-full sm:w-72" />
              <div className="w-48">
                <NativeSelect value={opStatus} onChange={(e) => setOpStatus(e.target.value)} options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(OPERATION_STATUS).map(([value, v]) => ({ value, label: v.label }))]} />
              </div>
            </div>
            <DataTable
              testId="operations-table"
              loading={opsFiltered.isLoading}
              rows={opsFiltered.data?.items}
              rowKey={(o) => o.id}
              onRowClick={(o) => void navigate({ to: '/operaciones/$operationId', params: { operationId: o.id } })}
              empty={{ title: 'Sin operaciones' }}
              columns={[
                { key: 'number', header: 'Operación', cell: (o) => <div><p className="font-semibold">{o.number}</p><p className="text-[12px] text-ink-muted">{OPERATION_TYPE[o.type] ?? o.type} · {formatDate(o.createdAt)}</p></div> },
                { key: 'customer', header: 'Cliente', cell: (o) => <div><p>{o.customer?.name}</p><p className="max-w-64 truncate text-[12px] text-ink-muted">{o.description}</p></div> },
                { key: 'status', header: 'Estado', cell: (o) => <StatusBadge map={OPERATION_STATUS} value={o.status} /> },
                { key: 'value', header: 'Valor', align: 'right', hideOnMobile: true, cell: (o) => formatMoney(o.totalValue) },
                { key: 'paid', header: 'Abonado', align: 'right', hideOnMobile: true, cell: (o) => formatMoney(o.balances?.money.paid) },
                { key: 'due', header: 'Vence', hideOnMobile: true, cell: (o) => formatDate(o.dueDate) },
                { key: 'bal', header: 'Saldos (dinero · fino)', align: 'right', cell: (o) => <DualBalance money={o.balances?.money.balance ?? 0} material={o.balances?.material.balanceFineGrams ?? 0} /> },
              ]}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <CustomerModal
        open={!!modal}
        onOpenChange={(o) => !o && setModal(null)}
        customer={modal?.customer}
        onSaved={(c) => !modal?.customer && void navigate({ to: '/clientes/$customerId', params: { customerId: c.id } })}
      />
    </div>
  )
}
