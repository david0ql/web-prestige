import type { ReactNode } from 'react'
import { Coins, Gem } from 'lucide-react'
import type { Customer, CustomerContribution, CustomerOperation, CustomerPayment, SaleDispatch } from '@/lib/api/types'
import { formatGrams, formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

export type CustomerFull = Customer & { address: string | null; city: string | null; status: 'ACTIVE' | 'INACTIVE' }

export interface CustomerAccount {
  customer: CustomerFull
  totals: {
    money: { totalValue: number; paid: number; balance: number; unassignedPaid: number }
    material: { committedFineGrams: number; contributedFineGrams: number; balanceFineGrams: number; valuation: number; contributedGrossGrams?: number }
  }
  operations: CustomerOperation[]
  payments: CustomerPayment[]
  contributions: (CustomerContribution & { productionOrderId: string | null; weighingId: string | null })[]
  sales: SaleDispatch[]
}

export type OperationDetail = CustomerOperation & {
  payments: CustomerPayment[]
  contributions: (CustomerContribution & { productionOrderId: string | null })[]
  dispatches: SaleDispatch[]
}

export const OPERATION_TYPE: Record<string, string> = { SALE: 'Venta', CUSTOM_ORDER: 'Encargo / fabricación' }
export const DOC_TYPES = [
  { value: 'CC', label: 'CC · Cédula de ciudadanía' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CE', label: 'CE · Cédula de extranjería' },
  { value: 'PAS', label: 'Pasaporte' },
  { value: 'TI', label: 'TI · Tarjeta de identidad' },
  { value: 'OTRO', label: 'Otro' },
]

export interface BalanceRow { label: string; value: ReactNode; strong?: boolean; tone?: 'danger' | 'success' }

/**
 * RN-016 / RF-045 · Bloques de saldo independientes: dinero (oro-cálido) y
 * material (azul frío), con identidad visual distinta para no mezclarlos.
 */
export function BalanceBlock({ kind, rows, title, testId }: { kind: 'money' | 'material'; rows: BalanceRow[]; title?: string; testId?: string }) {
  const money = kind === 'money'
  const Icon = money ? Coins : Gem
  return (
    <section
      data-testid={testId}
      className={cn(
        'rounded-md border p-4 shadow-card',
        money ? 'border-brand-200 bg-gradient-to-br from-brand-50 to-surface' : 'border-info/25 bg-gradient-to-br from-info-bg to-surface',
      )}
    >
      <header className="mb-3 flex items-center gap-2">
        <span className={cn('flex size-8 items-center justify-center rounded-md', money ? 'bg-brand-100 text-brand-700' : 'bg-info-bg text-info')}>
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold text-ink">{title ?? (money ? 'Saldo en dinero' : 'Saldo en material')}</h2>
          <p className="text-[11px] text-ink-muted">{money ? 'Valores en pesos · abonos monetarios' : 'Gramos finos (peso × ley / 1000) · aportes de material'}</p>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className={cn(r.strong && 'col-span-2 border-t border-border/80 pt-2.5')}>
            <dt className="eyebrow">{r.label}</dt>
            <dd className={cn('tnum text-ink', r.strong ? 'text-[22px] font-semibold tracking-tight' : 'text-[15px] font-medium', r.tone === 'danger' && 'text-danger', r.tone === 'success' && 'text-success')}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function moneyRows(m: { totalValue: number; paid: number; balance: number; dispatchedValue?: number; unassignedPaid?: number }): BalanceRow[] {
  const rows: BalanceRow[] = [
    { label: 'Valor operaciones', value: formatMoney(m.totalValue) },
    { label: 'Abonado', value: formatMoney(m.paid) },
  ]
  if (m.dispatchedValue !== undefined) rows.push({ label: 'Despachado', value: formatMoney(m.dispatchedValue) })
  if (m.unassignedPaid) rows.push({ label: 'Abonos sin operación', value: formatMoney(m.unassignedPaid) })
  rows.push({ label: 'Saldo por cobrar', value: formatMoney(m.balance), strong: true, tone: m.balance > 0 ? 'danger' : 'success' })
  return rows
}

export function materialRows(m: { committedFineGrams: number; contributedFineGrams: number; balanceFineGrams: number; valuation: number; contributedGrossGrams?: number }): BalanceRow[] {
  const rows: BalanceRow[] = [{ label: 'Comprometido fino', value: formatGrams(m.committedFineGrams, 3) }]
  if (m.contributedGrossGrams !== undefined) rows.push({ label: 'Aportado bruto', value: formatGrams(m.contributedGrossGrams, 3) })
  rows.push({ label: 'Aportado fino', value: formatGrams(m.contributedFineGrams, 3) })
  rows.push({ label: 'Valoración aportes', value: formatMoney(m.valuation) })
  rows.push({ label: 'Saldo fino pendiente', value: formatGrams(m.balanceFineGrams, 3), strong: true, tone: m.balanceFineGrams > 0 ? 'danger' : 'success' })
  return rows
}

/** Bloque compacto de saldos dobles para listas de operaciones. */
export function DualBalance({ money, material }: { money: number; material: number }) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-[12px] tnum">
      <span className={cn('inline-flex items-center gap-1', money > 0 ? 'text-ink' : 'text-ink-muted')}>
        <Coins className="size-3 text-brand-600" /> {formatMoney(money)}
      </span>
      <span className={cn('inline-flex items-center gap-1', material > 0 ? 'text-ink' : 'text-ink-muted')}>
        <Gem className="size-3 text-info" /> {formatGrams(material, 3)}
      </span>
    </div>
  )
}
