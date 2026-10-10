/**
 * Interpreta la trama de una balanza de joyería (mismo algoritmo que la API, que
 * vuelve a validar la lectura cruda para impedir alterar el peso — RN-019).
 */
export function parseScaleReading(raw: string): { grams: number; stable: boolean } | null {
  const text = raw.trim()
  const match = text.match(/([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ct|ozt|oz)?/i)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const value = Number(match[2].replace(',', '.')) * sign
  const unit = (match[3] ?? 'g').toLowerCase()
  const factor: Record<string, number> = { g: 1, kg: 1000, ct: 0.2, ozt: 31.1034768, oz: 28.3495231 }
  const stable = !/(^|[,\s])US([,\s]|$)|\?/i.test(text)
  return { grams: Math.round(value * (factor[unit] ?? 1) * 10000) / 10000, stable }
}
