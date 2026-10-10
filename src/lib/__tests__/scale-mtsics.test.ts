import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mtSicsError, parseScaleReading } from '../scale/parse'
import { useScale } from '../scale/useScale'

/** Balanza Mettler Toledo simulada: responde por un puerto serie Web Serial falso con tramas MT-SICS. */
function fakeMettler() {
  const written: string[] = []
  let push: (line: string) => void = () => {}
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (line) => controller.enqueue(new TextEncoder().encode(line))
    },
  })
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      written.push(new TextDecoder().decode(chunk))
    },
  })
  const opened: Record<string, unknown>[] = []
  const port = {
    readable,
    writable,
    open: async (o: Record<string, unknown>) => void opened.push(o),
    close: async () => {},
  }
  Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort: async () => port } })
  return { written, opened, send: (line: string) => push(line) }
}

afterEach(() => {
  // @ts-expect-error limpieza del mock
  delete navigator.serial
})

describe('Balanza Mettler Toledo (MT-SICS)', () => {
  it('interpreta las respuestas MT-SICS de peso y de estado', () => {
    expect(parseScaleReading('S S      12.3456 g')).toEqual({ grams: 12.3456, stable: true })
    expect(parseScaleReading('S D      12.3400 g')).toEqual({ grams: 12.34, stable: false })
    expect(parseScaleReading('S S       0.5000 ct')).toEqual({ grams: 0.1, stable: true })
    expect(parseScaleReading('S S       1.2345 kg')).toEqual({ grams: 1234.5, stable: true })
    expect(mtSicsError('S +')).toBe('OVERLOAD')
    expect(mtSicsError('S -')).toBe('UNDERLOAD')
    expect(mtSicsError('S I')).toBe('BUSY')
    expect(mtSicsError('ES')).toBe('SYNTAX')
    expect(mtSicsError('ET')).toBe('TRANSMISSION')
    expect(mtSicsError('EL')).toBe('LOGICAL')
    expect(mtSicsError('S S      12.3456 g')).toBeNull()
  })

  it('abre el puerto con la configuración, pide peso continuo (SIR), muestra estados y envía cero/tara/@', async () => {
    const dev = fakeMettler()
    const { result } = renderHook(() => useScale({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', protocol: 'MT-SICS' }))
    expect(result.current.protocol).toBe('MT-SICS')
    act(() => void result.current.connectSerial())
    await waitFor(() => expect(result.current.mode).toBe('serial'))
    expect(dev.opened[0]).toMatchObject({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' })
    await waitFor(() => expect(dev.written).toContain('SIR\r\n'))

    // Peso en movimiento y luego estable (las tramas pueden llegar partidas).
    act(() => dev.send('S D      10.1200 g\r\nS S     '))
    await waitFor(() => expect(result.current.reading).toMatchObject({ grams: 10.12, stable: false }))
    act(() => dev.send(' 10.1250 g\r\n'))
    await waitFor(() => expect(result.current.reading).toMatchObject({ grams: 10.125, stable: true, raw: 'S S      10.1250 g' }))

    // Sobrecarga: se informa al operador y no queda un peso capturable.
    act(() => dev.send('S +\r\n'))
    await waitFor(() => expect(result.current.error).toMatch(/sobrecarga/))
    expect(result.current.reading).toBeNull()
    act(() => dev.send('S S       5.0000 g\r\n'))
    await waitFor(() => expect(result.current.error).toBeNull())

    await act(() => result.current.zero!())
    await act(() => result.current.tare!())
    expect(dev.written).toEqual(expect.arrayContaining(['Z\r\n', 'T\r\n']))
    await act(() => result.current.disconnect())
    expect(dev.written.at(-1)).toBe('@\r\n')
    expect(result.current.mode).toBe('disconnected')
  })

  it('con protocolo genérico no envía comandos (balanzas en modo de impresión continua)', async () => {
    const dev = fakeMettler()
    const { result } = renderHook(() => useScale({ baudRate: 2400 }))
    act(() => void result.current.connectSerial())
    await waitFor(() => expect(result.current.mode).toBe('serial'))
    act(() => dev.send('ST,GS,+   12.50 g\r\n'))
    await waitFor(() => expect(result.current.reading).toMatchObject({ grams: 12.5, stable: true }))
    expect(dev.written).toEqual([])
    expect(result.current.zero).toBeUndefined()
  })
})
