import type { MediaFile, Product, TechnicalSheet, TechnicalVariable } from '@/lib/api/types'
import { formatNumber } from '@/lib/format'

/** Tipos locales de la respuesta de /catalog (extienden los compartidos). */
export type Sheet = TechnicalSheet & { createdBy?: { fullName: string } | null }
export type CatalogMedia = MediaFile & { technicalSheetId?: string | null; productId?: string | null }
export interface CatalogItem extends Product { currentSheet: Sheet | null; cover: CatalogMedia | null }
export interface CatalogDetail { product: Product; currentSheet: Sheet | null; versions: Sheet[]; photos: CatalogMedia[]; variables: TechnicalVariable[] }

export type SheetNumKey = 'standardWeight' | 'weightTolerance' | 'diameterMm' | 'lengthMm' | 'widthMm' | 'thicknessMm' | 'targetPurity' | 'purityTolerance'

export const SHEET_FIELDS: { key: SheetNumKey | 'measures'; label: string; unit?: string; decimals?: number }[] = [
  { key: 'standardWeight', label: 'Peso estándar', unit: 'g', decimals: 3 },
  { key: 'weightTolerance', label: 'Tolerancia de peso', unit: 'g', decimals: 3 },
  { key: 'diameterMm', label: 'Diámetro', unit: 'mm', decimals: 2 },
  { key: 'lengthMm', label: 'Largo', unit: 'mm', decimals: 2 },
  { key: 'widthMm', label: 'Ancho', unit: 'mm', decimals: 2 },
  { key: 'thicknessMm', label: 'Espesor', unit: 'mm', decimals: 2 },
  { key: 'measures', label: 'Medidas' },
  { key: 'targetPurity', label: 'Ley objetivo', unit: '‰', decimals: 1 },
  { key: 'purityTolerance', label: 'Tolerancia de ley', unit: '‰', decimals: 1 },
]

export const fmtVal = (v: unknown, unit?: string, decimals = 2): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'number') return `${formatNumber(v, decimals)}${unit ? ` ${unit}` : ''}`
  return `${String(v)}${unit ? ` ${unit}` : ''}`
}

export interface DiffRow { key: string; label: string; before: string; after: string; changed: boolean }

/** Compara dos versiones de ficha (RN-023): campos y variables técnicas. */
export function diffSheets(prev: Sheet | null, next: Sheet, defs: TechnicalVariable[]): DiffRow[] {
  const rows: DiffRow[] = SHEET_FIELDS.map((f) => {
    const a = prev ? prev[f.key] : null
    const b = next[f.key]
    return { key: f.key, label: f.label, before: prev ? fmtVal(a, f.unit, f.decimals) : '—', after: fmtVal(b, f.unit, f.decimals), changed: !!prev && (a ?? null) !== (b ?? null) }
  })
  const codes = new Set([...Object.keys(prev?.variables ?? {}), ...Object.keys(next.variables ?? {})])
  for (const code of codes) {
    const def = defs.find((d) => d.code === code)
    const a = prev?.variables?.[code]
    const b = next.variables?.[code]
    rows.push({ key: `var:${code}`, label: def?.name ?? code, before: prev ? fmtVal(a, def?.unit ?? undefined, 3) : '—', after: fmtVal(b, def?.unit ?? undefined, 3), changed: !!prev && (a ?? null) !== (b ?? null) })
  }
  if ((prev?.notes ?? null) !== (next.notes ?? null) && prev) rows.push({ key: 'notes', label: 'Notas', before: prev.notes ?? '—', after: next.notes ?? '—', changed: true })
  return rows
}
