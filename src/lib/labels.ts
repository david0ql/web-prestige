/** Etiquetas en español y variantes de color de los enums de la API. */
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold'

type LabelMap = Record<string, { label: string; variant: BadgeVariant }>

export const ORDER_STATUS: LabelMap = {
  DRAFT: { label: 'Borrador', variant: 'neutral' },
  PENDING_MATERIALS: { label: 'Pendiente de materiales', variant: 'warning' },
  READY_FOR_DISPATCH: { label: 'Lista para despacho', variant: 'info' },
  DISPATCHED: { label: 'Despachada', variant: 'info' },
  ACCEPTED_BY_WORKSHOP: { label: 'Aceptada por taller', variant: 'info' },
  IN_PRODUCTION: { label: 'En producción', variant: 'gold' },
  PARTIAL: { label: 'Parcial', variant: 'gold' },
  FINISHED_BY_WORKSHOP: { label: 'Terminada por taller', variant: 'gold' },
  IN_REVIEW: { label: 'En revisión Prestige Gold', variant: 'warning' },
  APPROVED_CLOSED: { label: 'Aprobada/Cerrada', variant: 'success' },
  REJECTED_ADJUSTMENT: { label: 'Rechazada/Ajuste', variant: 'danger' },
  CANCELLED: { label: 'Cancelada', variant: 'neutral' },
}

export const DISPATCH_STATUS: LabelMap = {
  PENDING_ACCEPTANCE: { label: 'Pendiente de aceptación', variant: 'warning' },
  ACCEPTED: { label: 'Aceptada', variant: 'success' },
  ACCEPTED_WITH_OBSERVATIONS: { label: 'Aceptada con observaciones', variant: 'warning' },
  REJECTED: { label: 'Rechazada', variant: 'danger' },
}

export const MOVEMENT_TYPE: LabelMap = {
  ENTRY: { label: 'Entrada', variant: 'success' },
  DISPATCH: { label: 'Despacho a taller', variant: 'info' },
  CUSTODY_ACCEPTANCE: { label: 'Aceptación en custodia', variant: 'gold' },
  DISPATCH_REJECTION: { label: 'Entrega rechazada', variant: 'danger' },
  RETURN: { label: 'Retorno', variant: 'info' },
  CONSUMPTION: { label: 'Consumo aprobado', variant: 'neutral' },
  PRODUCTION_OUTPUT: { label: 'Producción (intermedio)', variant: 'success' },
  TRANSFER: { label: 'Traslado', variant: 'neutral' },
  ADJUSTMENT: { label: 'Ajuste', variant: 'warning' },
  LOSS: { label: 'Merma', variant: 'danger' },
  CUSTOMER_CONTRIBUTION: { label: 'Aporte de cliente', variant: 'gold' },
  REVERSAL: { label: 'Reverso', variant: 'danger' },
}

export const LOCATION_TYPE: LabelMap = {
  MOTHER_OFFICE: { label: 'Oficina Madre', variant: 'gold' },
  WORKSHOP: { label: 'Taller', variant: 'info' },
  TRANSIT: { label: 'Tránsito', variant: 'warning' },
  CUSTOMER: { label: 'Cliente', variant: 'neutral' },
  OTHER: { label: 'Otra', variant: 'neutral' },
}

export const DISCREPANCY_TYPE: LabelMap = {
  PROCESS_LOSS: { label: 'Merma de proceso', variant: 'warning' },
  CUSTODY_SHORTAGE: { label: 'Faltante en custodia', variant: 'danger' },
  CUSTODY_SURPLUS: { label: 'Sobrante en custodia', variant: 'info' },
  DISPATCH_DIFFERENCE: { label: 'Diferencia en entrega', variant: 'danger' },
  RECEPTION_DIFFERENCE: { label: 'Diferencia en recepción', variant: 'danger' },
  OTHER: { label: 'Otra', variant: 'neutral' },
}

export const APPROVAL_STATUS: LabelMap = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  PROPOSED: { label: 'Propuesta', variant: 'warning' },
  APPROVED: { label: 'Aprobada', variant: 'success' },
  REJECTED: { label: 'Rechazada', variant: 'danger' },
  DISPATCHED: { label: 'Despachada', variant: 'info' },
  CANCELLED: { label: 'Cancelada', variant: 'neutral' },
}

export const QUALITY: LabelMap = {
  PENDING: { label: 'Calidad pendiente', variant: 'warning' },
  APPROVED: { label: 'Calidad aprobada', variant: 'success' },
  REJECTED: { label: 'Calidad rechazada', variant: 'danger' },
}

export const PURITY: LabelMap = {
  NOT_REQUIRED: { label: 'Ley no requerida', variant: 'neutral' },
  PENDING: { label: 'Ley pendiente', variant: 'warning' },
  CONFORMING: { label: 'Ley conforme', variant: 'success' },
  NON_CONFORMING: { label: 'Ley no conforme', variant: 'danger' },
}

export const FINISHED_STATUS: LabelMap = {
  QUARANTINE: { label: 'En cuarentena', variant: 'warning' },
  AVAILABLE: { label: 'Disponible', variant: 'success' },
  REJECTED: { label: 'Rechazado', variant: 'danger' },
  SOLD: { label: 'Vendido', variant: 'neutral' },
}

export const ALERT_SEVERITY: LabelMap = {
  INFO: { label: 'Informativa', variant: 'info' },
  WARNING: { label: 'Advertencia', variant: 'warning' },
  CRITICAL: { label: 'Crítica', variant: 'danger' },
}

export const ALERT_TYPE: LabelMap = {
  SHORTAGE: { label: 'Faltante', variant: 'warning' },
  MIN_STOCK: { label: 'Mínimo de inventario', variant: 'warning' },
  DELAY: { label: 'Retraso', variant: 'danger' },
  ABNORMAL_CONSUMPTION: { label: 'Consumo anormal', variant: 'warning' },
  DIFFERENCE: { label: 'Diferencia', variant: 'danger' },
  PENDING_OPERATION: { label: 'Operación pendiente', variant: 'info' },
  PURITY_NON_CONFORMING: { label: 'Ley no conforme', variant: 'danger' },
  QUALITY_REJECTED: { label: 'Calidad rechazada', variant: 'danger' },
  REQUEST_DEVIATION: { label: 'Solicitud fuera de estándar', variant: 'warning' },
}

export const ALERT_STATUS: LabelMap = {
  OPEN: { label: 'Abierta', variant: 'danger' },
  ACKNOWLEDGED: { label: 'Vista', variant: 'warning' },
  RESOLVED: { label: 'Resuelta', variant: 'success' },
}

export const OPERATION_STATUS: LabelMap = {
  OPEN: { label: 'Abierta', variant: 'info' },
  PARTIALLY_DISPATCHED: { label: 'Despacho parcial', variant: 'gold' },
  DISPATCHED: { label: 'Despachada', variant: 'success' },
  CLOSED: { label: 'Cerrada', variant: 'neutral' },
  CANCELLED: { label: 'Cancelada', variant: 'neutral' },
}

export const PRIORITY: LabelMap = {
  LOW: { label: 'Baja', variant: 'neutral' },
  NORMAL: { label: 'Normal', variant: 'info' },
  HIGH: { label: 'Alta', variant: 'warning' },
  URGENT: { label: 'Urgente', variant: 'danger' },
}

export const TX_STATUS: LabelMap = {
  POSTED: { label: 'Contabilizada', variant: 'success' },
  REVERSED: { label: 'Reversada', variant: 'danger' },
}

export const label = (map: LabelMap, key: string | null | undefined) => (key ? (map[key]?.label ?? key) : '—')
export const variant = (map: LabelMap, key: string | null | undefined): BadgeVariant => (key ? (map[key]?.variant ?? 'neutral') : 'neutral')

export const WEIGHING_PURPOSE: Record<string, string> = {
  ENTRY: 'Entrada de material',
  DISPATCH: 'Salida a taller',
  RECEPTION: 'Recepción de producción',
  CUSTOMER_MATERIAL: 'Material de cliente',
  SALE: 'Despacho a cliente',
  OTHER: 'Otro',
}

export const RECEIPT_LINE: Record<string, string> = {
  FINISHED_PRODUCT: 'Producto terminado',
  LEFTOVER: 'Sobrante',
  UNUSED: 'Material no utilizado',
  RETURN: 'Devolución',
}

export const PURITY_METHOD: Record<string, string> = {
  XRF: 'Fluorescencia de rayos X (XRF)',
  TOUCHSTONE: 'Piedra de toque',
  FIRE_ASSAY: 'Ensayo al fuego (copelación)',
  DENSITY: 'Densidad / gravedad específica',
  ACID_TEST: 'Prueba ácida',
  OTHER: 'Otro',
}

export const INSUFFICIENCY_ACTION: Record<string, { label: string; description: string }> = {
  COMPLETE_FROM_INVENTORY: { label: 'Completar desde inventario', description: 'Pesar el faltante desde la existencia de Oficina Madre y agregarlo al despacho.' },
  REQUEST_FABRICATION: { label: 'Solicitar/fabricar el insumo', description: 'Genera una orden borrador para fabricar el faltante (p. ej. hilo con Javier) y despacha lo disponible.' },
  MODIFY_ORDER: { label: 'Modificar la orden con autorización', description: 'Reduce el objetivo de la orden a lo que alcanza el material (requiere permiso de Gerencia).' },
  DISPATCH_PARTIAL: { label: 'Despachar parcialmente', description: 'Entrega lo disponible y la orden queda pendiente del faltante.' },
}

export const STANDARD_BASIS: Record<string, string> = {
  PER_GRAM: 'Por gramo de producto',
  PER_UNIT: 'Por unidad',
  PER_LOT: 'Por lote',
}

export const LABOR_BASIS: Record<string, string> = { GRAM: 'Por gramo', UNIT: 'Por unidad', LOT: 'Por lote' }

export const TIMING: Record<string, string> = {
  BEFORE_FABRICATION: 'Antes de la fabricación',
  AFTER_FABRICATION: 'Después de la fabricación',
}
