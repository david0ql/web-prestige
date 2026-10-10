/**
 * Interpreta la trama de una balanza de joyería (mismo algoritmo que la API, que
 * vuelve a validar la lectura cruda para impedir alterar el peso — RN-019).
 */
export function parseScaleReading(raw: string): { grams: number; stable: boolean } | null {
  const text = raw.trim()
  const match = text.match(/([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|gn|g|ct|ozt|oz|dwt)?/i)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const value = Number(match[2].replace(',', '.')) * sign
  const unit = (match[3] ?? 'g').toLowerCase()
  const factor: Record<string, number> = { g: 1, kg: 1000, ct: 0.2, ozt: 31.1034768, oz: 28.3495231, dwt: 1.55517384, gn: 0.06479891 }
  const stable = !/(^|[,\s])US([,\s]|$)|^S\s+D\s|\?/i.test(text)
  return { grams: Math.round(value * (factor[unit] ?? 1) * 10000) / 10000, stable }
}

/** Respuestas MT-SICS (Mettler Toledo) sin peso utilizable → mensaje para el operador. */
export const MT_SICS_ERRORS: Record<string, string> = {
  OVERLOAD: 'Balanza en sobrecarga (S +): retire peso',
  UNDERLOAD: 'Balanza bajo el rango (S -): verifique el plato y haga cero',
  BUSY: 'Balanza ocupada (S I): espere y vuelva a leer',
  SYNTAX: 'La balanza no reconoció el comando (ES)',
  TRANSMISSION: 'Error de transmisión con la balanza (ET): revise cable y baudios',
  LOGICAL: 'La balanza no puede ejecutar el comando (EL)',
}

export function mtSicsError(raw: string): keyof typeof MT_SICS_ERRORS | null {
  const t = raw.trim().toUpperCase()
  if (/^S\s+\+$/.test(t)) return 'OVERLOAD'
  if (/^S\s+-$/.test(t)) return 'UNDERLOAD'
  if (/^S\s+I$/.test(t)) return 'BUSY'
  if (t === 'ES') return 'SYNTAX'
  if (t === 'ET') return 'TRANSMISSION'
  if (t === 'EL') return 'LOGICAL'
  return null
}

/** Comandos MT-SICS nivel 0/1 usados por la Balanza Madre. */
export const MT_SICS = { streamWeight: 'SIR\r\n', stop: '@\r\n', zero: 'Z\r\n', tare: 'T\r\n' } as const
