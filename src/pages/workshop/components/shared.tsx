import type { ComponentType, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertOctagon, CalendarClock, ChevronRight, Package, Truck } from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import type { Alert, Material, MaterialDispatch, MaterialRequest, ProductionOrder } from '@/lib/api/types'
import { formatDate, formatGrams, formatNumber, todayIso } from '@/lib/format'
import { DISPATCH_STATUS, ORDER_STATUS } from '@/lib/labels'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { cn } from '@/lib/cn'

/** Estados en los que el taller puede trabajar la orden (RN-014, WORKSHOP_ACTIVE_STATUSES de la API). */
export const WORK_STATUSES = ['ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'REJECTED_ADJUSTMENT']
export const CLOSED_STATUSES = ['APPROVED_CLOSED', 'CANCELLED']
export const isWorkStatus = (s: string | null | undefined) => !!s && WORK_STATUSES.includes(s)
export const isOpenOrder = (s: string) => !CLOSED_STATUSES.includes(s)

/** Controles táctiles grandes en móvil (16 px evita el zoom de iOS al enfocar). */
export const FIELD = 'h-11 text-[16px] sm:h-10 sm:text-[14px]'
export const BIG_BTN = 'h-12 px-5 text-[15px] sm:h-10 sm:text-[14px]'

/** Respuesta de GET /workshop-portal/dashboard. */
export interface WorkshopTask {
  type: 'CONFIRM_DISPATCH' | 'PRODUCE' | 'ADJUST' | string
  title: string
  detail: string
  orderId?: string
  dispatchId?: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}
export interface CustodyRow { material: Material; lot: { code: string } | null; grams: number }
export interface CustodyByOrder { productionOrderId: string | null; materialId: string; material: Material; grams: number }
export interface WorkshopDashboard {
  workshop: { id: string; code: string }
  kpis: { openOrders: number; overdue: number; pendingDispatches: number; custodyGrams: number }
  orders: ProductionOrder[]
  pendingDispatches: MaterialDispatch[]
  requests: MaterialRequest[]
  custody: { location: { name: string } | null; totals: CustodyRow[]; byOrder: CustodyByOrder[] }
  tasks: WorkshopTask[]
}

/** Días hasta una fecha YYYY-MM-DD (negativo = vencida). */
export function daysUntil(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = todayIso().split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000)
}

export function isOverdue(o: Pick<ProductionOrder, 'commitmentDate' | 'status'>) {
  return isOpenOrder(o.status) && !['FINISHED_BY_WORKSHOP', 'IN_REVIEW'].includes(o.status) && daysUntil(o.commitmentDate) < 0
}

/** Compromiso de entrega legible: "Vence hoy", "Faltan 3 días", "Vencida hace 2 días". */
export function CommitmentText({ order, className }: { order: Pick<ProductionOrder, 'commitmentDate' | 'status'>; className?: string }) {
  const days = daysUntil(order.commitmentDate)
  const done = !isOpenOrder(order.status) || ['FINISHED_BY_WORKSHOP', 'IN_REVIEW'].includes(order.status)
  const tone = done ? 'text-ink-muted' : days < 0 ? 'text-danger font-semibold' : days <= 2 ? 'text-warning font-semibold' : 'text-ink-secondary'
  const rel = done ? '' : days < 0 ? ` · vencida hace ${-days} ${-days === 1 ? 'día' : 'días'}` : days === 0 ? ' · vence hoy' : ` · faltan ${days} ${days === 1 ? 'día' : 'días'}`
  return (
    <span className={cn('inline-flex items-center gap-1 text-[13px]', tone, className)}>
      <CalendarClock className="size-3.5 shrink-0" />
      {formatDate(order.commitmentDate)}
      {rel}
    </span>
  )
}

export function ProgressBar({ value, className, tone = 'gold' }: { value: number; className?: string; tone?: 'gold' | 'danger' | 'success' }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-sunken', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', tone === 'gold' && 'gold-gradient', tone === 'danger' && 'bg-danger', tone === 'success' && 'bg-success')} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Tarjeta táctil de orden (listas del portal). */
export function OrderCard({ order, extra }: { order: ProductionOrder; extra?: ReactNode }) {
  const overdue = isOverdue(order)
  return (
    <Link
      to="/taller/ordenes/$orderId"
      params={{ orderId: order.id }}
      data-testid={`order-card-${order.number}`}
      className={cn('group flex items-center gap-3 rounded-md border border-border bg-surface p-3.5 shadow-card transition-colors hover:border-brand-300 hover:bg-brand-50/40', overdue && 'border-l-4 border-l-danger')}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        <Package className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold text-ink">{order.product.name}</span>
          <StatusBadge map={ORDER_STATUS} value={order.status} />
        </div>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {order.number} · {formatGrams(order.targetGrams, 0)}
          {order.targetUnits ? ` · ${formatNumber(order.targetUnits)} u` : ''}
          {order.variant ? ` · ${order.variant.name}` : ''}
        </p>
        <CommitmentText order={order} className="mt-1" />
        {extra}
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-placeholder transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

/** Tarjeta táctil de entrega (despacho) de material. */
export function DispatchCard({ dispatch }: { dispatch: MaterialDispatch }) {
  const pending = dispatch.status === 'PENDING_ACCEPTANCE'
  const total = dispatch.lines.reduce((s, l) => s + l.grams, 0)
  return (
    <Link
      to="/taller/entregas/$dispatchId"
      params={{ dispatchId: dispatch.id }}
      data-testid={`dispatch-card-${dispatch.number}`}
      className={cn('group flex items-center gap-3 rounded-md border border-border bg-surface p-3.5 shadow-card transition-colors hover:border-brand-300 hover:bg-brand-50/40', pending && 'border-l-4 border-l-warning')}
    >
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', pending ? 'bg-warning-bg text-warning' : 'bg-sunken text-ink-muted')}>
        <Truck className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold text-ink">{dispatch.number}</span>
          <StatusBadge map={DISPATCH_STATUS} value={dispatch.status} />
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-secondary">{dispatch.lines.map((l) => `${l.material.name} ${formatGrams(l.grams)}`).join(' · ')}</p>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          {dispatch.order ? `${dispatch.order.number} · ${dispatch.order.product.name}` : dispatch.purpose} · enviado {formatDate(dispatch.createdAt)} · total {formatGrams(total)}
        </p>
      </div>
      {pending ? (
        <span className="hidden shrink-0 rounded-sm bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white sm:inline">Confirmar</span>
      ) : (
        <ChevronRight className="size-5 shrink-0 text-ink-placeholder" />
      )}
    </Link>
  )
}

/** Encabezado numerado de sección (flujo por pasos, RNF-001). */
export function StepHeader({ id, step, title, description, icon: Icon, right }: { id?: string; step?: number | string; title: string; description?: ReactNode; icon?: ComponentType<{ className?: string }>; right?: ReactNode }) {
  return (
    <div id={id} className="mb-3 flex scroll-mt-28 items-start gap-3">
      {step !== undefined ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar text-[14px] font-bold text-brand-300">{step}</span>
      ) : Icon ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Icon className="size-4" /></span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] leading-tight font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {right}
    </div>
  )
}

/** Panel de error de regla de negocio con sus detalles (p. ej. qué falta). */
export function ErrorPanel({ error, describe, testId }: { error: unknown; describe?: (e: ApiError) => ReactNode; testId?: string }) {
  if (!error) return null
  const api = error instanceof ApiError ? error : null
  return (
    <div role="alert" data-testid={testId} className="flex gap-3 rounded-md border border-danger/30 bg-danger-bg p-3.5 text-[14px] text-danger">
      <AlertOctagon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{error instanceof Error ? error.message : 'Ocurrió un error inesperado'}</p>
        {api && describe?.(api)}
      </div>
    </div>
  )
}

/** Lista de pendientes en `details.missing` (strings u objetos {name}). */
export function missingList(e: ApiError, nameOf?: (code: string) => string) {
  const d = (e.details ?? {}) as { missing?: (string | { name: string })[] }
  if (!Array.isArray(d.missing) || !d.missing.length) return null
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-[13px]">
      {d.missing.map((m, i) => (
        <li key={i}>{typeof m === 'string' ? (nameOf?.(m) ?? m) : m.name}</li>
      ))}
    </ul>
  )
}

export function AlertRow({ a }: { a: Alert }) {
  const tone = a.severity === 'CRITICAL' ? 'border-l-danger' : a.severity === 'WARNING' ? 'border-l-warning' : 'border-l-info'
  const inner = (
    <>
      <p className="text-[14px] font-semibold text-ink">{a.title}</p>
      <p className="text-[13px] text-ink-secondary">{a.message}</p>
      <p className="mt-0.5 text-[12px] text-ink-muted">{formatDate(a.createdAt, "d MMM yyyy, HH:mm")}</p>
    </>
  )
  const cls = cn('block rounded-md border border-border border-l-4 bg-surface px-3 py-2.5', tone)
  if (a.entityType === 'ProductionOrder' && a.entityId) {
    return (
      <Link to="/taller/ordenes/$orderId" params={{ orderId: a.entityId }} className={cn(cls, 'hover:bg-sunken/60')}>
        {inner}
      </Link>
    )
  }
  return <div className={cls}>{inner}</div>
}

/** Fila etiqueta/valor compacta. */
export function KV({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5 text-[14px]', className)}>
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-ink tnum">{children}</span>
    </div>
  )
}

export const num = (v: string) => {
  if (v.trim() === '') return undefined
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}
