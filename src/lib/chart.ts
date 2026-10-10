/**
 * Paleta categórica validada (scripts dataviz: banda de luminosidad, croma, CVD y
 * separación normal). Orden fijo: el color sigue a la entidad, nunca al ranking.
 * Varios slots quedan <3:1 sobre blanco → siempre con leyenda/etiqueta directa.
 */
export const SERIES = ['#c08a12', '#2a78d6', '#1baf7a', '#e87ba4', '#6250d6', '#eb6834']
export const GOLD = '#c08a12'
export const GRID = '#ebe5d8'
export const AXIS = '#73695a'

/** Color estable por clave (p. ej. código de taller) según su posición en una lista fija. */
export function colorFor(key: string, keys: string[]) {
  const i = keys.indexOf(key)
  return SERIES[(i >= 0 ? i : 0) % SERIES.length]
}

export const axisProps = { stroke: AXIS, fontSize: 11, tickLine: false, axisLine: false } as const
