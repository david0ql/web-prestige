import type { Material } from '@/lib/api/types'
import { LOCATION_TYPE, MOVEMENT_TYPE } from '@/lib/labels'

export const materialOptions = (materials: Material[]) => materials.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))

export const locationTypeOptions = Object.entries(LOCATION_TYPE).map(([value, v]) => ({ value, label: v.label }))
export const movementTypeOptions = Object.entries(MOVEMENT_TYPE).map(([value, v]) => ({ value, label: v.label }))

/** Gramos abreviados para ejes: 1.250 g → "1,25 kg". */
export const shortGrams = (g: number) => (Math.abs(g) >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`)

export const daysSince = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null)

/** Movimientos que se reversan directamente (el resto se corrige desde su documento). */
export const REVERSIBLE = ['ENTRY', 'TRANSFER', 'ADJUSTMENT']

/** "YYYY-MM-DD" → ISO de la medianoche local (la API interpreta fechas simples en UTC). */
export const localStartIso = (d: string) => {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toISOString()
}
