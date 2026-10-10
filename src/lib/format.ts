import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/** Moneda de operación (parámetro company.currency; COP por defecto). */
let currency = 'COP'
export const setCurrency = (c: string) => {
  currency = c
}

type DateInput = Date | string | number | null | undefined

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  // Fechas "YYYY-MM-DD" se interpretan locales (no UTC) para no correr un día.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === '' ? null : typeof v === 'string' ? Number(v) : v

/** 1234.5 → "1.234,50 g" (hasta 4 decimales, sin ceros sobrantes). */
export function formatGrams(value: number | string | null | undefined, decimals = 2): string {
  const n = num(value)
  if (n === null || Number.isNaN(n)) return '—'
  return `${new Intl.NumberFormat('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 4) }).format(n)} g`
}

export function formatMoney(value: number | string | null | undefined): string {
  const n = num(value)
  if (n === null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

export function formatNumber(value: number | string | null | undefined, decimals = 0): string {
  const n = num(value)
  if (n === null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: decimals }).format(n)
}

export function formatPercent(value: number | string | null | undefined, decimals = 1): string {
  const n = num(value)
  if (n === null || Number.isNaN(n)) return '—'
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: decimals }).format(n)} %`
}

/** Ley en milésimas: 999 → "999 ‰". */
export function formatPurity(value: number | string | null | undefined): string {
  const n = num(value)
  if (n === null || Number.isNaN(n)) return '—'
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n)} ‰`
}

export function formatDate(value: DateInput, pattern = 'd MMM yyyy'): string {
  const date = toDate(value)
  if (!date) return '—'
  return format(date, pattern, { locale: es })
}

export function formatDateTime(value: DateInput): string {
  const date = toDate(value)
  if (!date) return '—'
  return format(date, 'd MMM yyyy, HH:mm', { locale: es })
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const monthStartIso = () => `${todayIso().slice(0, 8)}01`
