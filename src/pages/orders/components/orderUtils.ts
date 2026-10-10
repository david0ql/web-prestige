import type { ConsumptionStandard, OrderDetail, ProductionOrder } from '@/lib/api/types'
import { todayIso } from '@/lib/format'

/** Ciclo de estados de la orden (sección 7.1) agrupado en pasos visuales. */
export interface LifecycleStep {
  key: string
  label: string
  statuses: string[]
  dateField?: keyof ProductionOrder | 'startedAt'
}

export const LIFECYCLE: LifecycleStep[] = [
  { key: 'DRAFT', label: 'Borrador', statuses: ['DRAFT'], dateField: 'createdAt' },
  { key: 'PLANNED', label: 'Planificada', statuses: ['PENDING_MATERIALS', 'READY_FOR_DISPATCH'] },
  { key: 'DISPATCHED', label: 'Despachada', statuses: ['DISPATCHED'], dateField: 'dispatchedAt' },
  { key: 'ACCEPTED', label: 'Aceptada', statuses: ['ACCEPTED_BY_WORKSHOP'], dateField: 'acceptedAt' },
  { key: 'PRODUCTION', label: 'En producción', statuses: ['IN_PRODUCTION', 'PARTIAL'], dateField: 'startedAt' },
  { key: 'FINISHED', label: 'Terminada', statuses: ['FINISHED_BY_WORKSHOP'], dateField: 'finishedByWorkshopAt' },
  { key: 'REVIEW', label: 'En revisión', statuses: ['IN_REVIEW', 'REJECTED_ADJUSTMENT'], dateField: 'deliveredAt' },
  { key: 'CLOSED', label: 'Cerrada', statuses: ['APPROVED_CLOSED'], dateField: 'closedAt' },
]

export const stepIndexOf = (status: string) => LIFECYCLE.findIndex((s) => s.statuses.includes(status))

/** Avance del ciclo de vida (0–100) para listados. */
export function lifecyclePct(status: string) {
  if (status === 'CANCELLED') return 0
  const i = stepIndexOf(status)
  return i < 0 ? 0 : Math.round((i / (LIFECYCLE.length - 1)) * 100)
}

export const CLOSED_STATUSES = ['APPROVED_CLOSED', 'CANCELLED']

export function isOverdue(o: Pick<ProductionOrder, 'commitmentDate' | 'status' | 'deliveredAt'>) {
  if (CLOSED_STATUSES.includes(o.status) || o.deliveredAt) return false
  return o.commitmentDate < todayIso()
}

/** Días entre hoy y el compromiso (negativo = vencida). */
export function daysToCommitment(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / 86_400_000)
}

/** Estados en los que se admiten despachos adicionales (espejo de la API). */
export const DISPATCHABLE = ['PENDING_MATERIALS', 'READY_FOR_DISPATCH', 'DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'REJECTED_ADJUSTMENT']
export const EDITABLE = ['DRAFT', 'PENDING_MATERIALS', 'READY_FOR_DISPATCH']
export const MODIFIABLE_TARGET = ['DRAFT', 'PENDING_MATERIALS', 'READY_FOR_DISPATCH', 'DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION']
export const CANCELLABLE = ['DRAFT', 'PENDING_MATERIALS', 'READY_FOR_DISPATCH', 'DISPATCHED', 'ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'REJECTED_ADJUSTMENT']
export const PARTIAL_RECEIPT = ['ACCEPTED_BY_WORKSHOP', 'IN_PRODUCTION', 'PARTIAL', 'FINISHED_BY_WORKSHOP', 'IN_REVIEW', 'REJECTED_ADJUSTMENT']

/** Fecha en la que la orden entró a cada paso (desde el historial; respaldo en campos). */
export function stepDates(order: OrderDetail): (string | null)[] {
  return LIFECYCLE.map((step) => {
    const h = order.history.find((x) => step.statuses.includes(x.toStatus))
    if (h) return h.createdAt
    const f = step.dateField ? (order as unknown as Record<string, unknown>)[step.dateField] : null
    return typeof f === 'string' ? f : null
  })
}

/**
 * RF-008 · Estimación de insumos en cliente (misma fórmula que la API): un estándar
 * de variante reemplaza al general del mismo material.
 */
export function estimateRequirements(standards: ConsumptionStandard[], target: { grams: number; units: number | null; variantId: string | null }) {
  const active = standards.filter((s) => s.active)
  const byMaterial = new Map<string, ConsumptionStandard>()
  for (const s of active.filter((x) => !x.variantId)) byMaterial.set(s.materialId, s)
  if (target.variantId) for (const s of active.filter((x) => x.variantId === target.variantId)) byMaterial.set(s.materialId, s)
  const out: { standard: ConsumptionStandard; requiredGrams: number }[] = []
  for (const s of byMaterial.values()) {
    let qty = 0
    if (s.basis === 'PER_GRAM') qty = s.quantity * target.grams
    else if (s.basis === 'PER_UNIT') qty = s.quantity * (target.units ?? 0)
    else if (s.basis === 'PER_LOT') qty = Math.ceil(target.grams / (s.lotSizeGrams || target.grams || 1)) * s.quantity
    out.push({ standard: s, requiredGrams: Math.round(qty * 10000) / 10000 })
  }
  return out
}

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baja' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
]

export const DEFAULT_CHECKLIST = ['Acabado y brillo', 'Medidas según ficha', 'Soldaduras', 'Cierre / broche', 'Piedras fijas', 'Sin porosidad']
