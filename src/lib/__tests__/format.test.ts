import { formatGrams, formatMoney, formatPurity, formatDate, formatPercent } from '../format'
import { parseScaleReading } from '../scale/parse'
import { label, variant, ORDER_STATUS } from '../labels'

describe('formatos', () => {
  it('gramos con separadores es-CO', () => {
    expect(formatGrams(1234.5)).toBe('1.234,50 g')
    expect(formatGrams(0.1234, 4)).toBe('0,1234 g')
    expect(formatGrams(null)).toBe('—')
  })
  it('moneda COP sin decimales', () => {
    expect(formatMoney(15000000).replace(/\s/g, ' ')).toMatch(/15\.000\.000/)
  })
  it('ley en milésimas', () => expect(formatPurity(999.1)).toBe('999,1 ‰'))
  it('porcentaje', () => expect(formatPercent(1.84)).toBe('1,8 %'))
  it('fechas ISO sin desfase de zona', () => expect(formatDate('2026-10-01')).toBe('1 oct 2026'))
})

describe('lectura de balanza', () => {
  it('interpreta tramas estables e inestables', () => {
    expect(parseScaleReading('ST,GS,+  1000.25 g')).toEqual({ grams: 1000.25, stable: true })
    expect(parseScaleReading('US,GS,+  12.5 kg')).toEqual({ grams: 12500, stable: false })
    expect(parseScaleReading('ERR')).toBeNull()
  })
})

describe('etiquetas de estados', () => {
  it('traduce y asigna color', () => {
    expect(label(ORDER_STATUS, 'IN_REVIEW')).toBe('En revisión Prestige Gold')
    expect(variant(ORDER_STATUS, 'APPROVED_CLOSED')).toBe('success')
    expect(label(ORDER_STATUS, 'DESCONOCIDO')).toBe('DESCONOCIDO')
  })
})
