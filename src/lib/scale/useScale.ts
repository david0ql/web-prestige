import { useCallback, useEffect, useRef, useState } from 'react'
import { MT_SICS, MT_SICS_ERRORS, mtSicsError, parseScaleReading } from './parse'

/**
 * Integración con la Balanza Madre (RF-002) vía Web Serial API (Chrome/Edge en
 * PC/tablet). Lee tramas continuas, expone el peso en vivo y la trama cruda que
 * se envía a la API. Incluye un simulador para demostraciones sin hardware.
 */
export interface ScaleReading { grams: number; stable: boolean; raw: string; at: number }

interface SerialPortLike {
  open(o: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable?: WritableStream<Uint8Array> | null
  getInfo?: () => { usbVendorId?: number; usbProductId?: number }
}

export type ScaleMode = 'disconnected' | 'serial' | 'simulator'

export interface ScaleConfig { baudRate?: number; dataBits?: number; stopBits?: number; parity?: string; protocol?: string; model?: string }

export function useScale(config: ScaleConfig = {}) {
  const sics = (config.protocol ?? '').toUpperCase() === 'MT-SICS'
  const [mode, setMode] = useState<ScaleMode>('disconnected')
  const [reading, setReading] = useState<ScaleReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  const portRef = useRef<SerialPortLike | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const simRef = useRef<{ target: number; timer: ReturnType<typeof setInterval> | null }>({ target: 0, timer: null })
  const supported = typeof navigator !== 'undefined' && 'serial' in navigator

  /** Envía un comando de texto a la balanza (MT-SICS: SIR, Z, T, @). */
  const send = useCallback(async (command: string) => {
    const w = portRef.current?.writable?.getWriter()
    if (!w) return
    try {
      await w.write(new TextEncoder().encode(command))
    } finally {
      w.releaseLock()
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      if (sics && portRef.current) await send(MT_SICS.stop)
      await readerRef.current?.cancel()
      await portRef.current?.close()
    } catch {
      /* puerto ya cerrado */
    }
    if (simRef.current.timer) clearInterval(simRef.current.timer)
    simRef.current.timer = null
    readerRef.current = null
    portRef.current = null
    setMode('disconnected')
  }, [sics, send])

  const connectSerial = useCallback(async () => {
    setError(null)
    if (!supported) {
      setError('Este navegador no soporta Web Serial. Use Chrome o Edge, o el simulador / captura manual autorizada.')
      return
    }
    try {
      const serial = (navigator as unknown as { serial: { requestPort(): Promise<SerialPortLike> } }).serial
      const port = await serial.requestPort()
      await port.open({ baudRate: config.baudRate ?? 9600, dataBits: config.dataBits ?? 8, stopBits: config.stopBits ?? 1, parity: config.parity ?? 'none' })
      portRef.current = port
      setMode('serial')
      // MT-SICS: pedir el peso de forma continua (estable «S S» o en movimiento «S D»).
      if (sics) await send(MT_SICS.streamWeight)
      const decoder = new TextDecoder()
      let buffer = ''
      const reader = port.readable!.getReader()
      readerRef.current = reader
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const status = mtSicsError(line)
          if (status) {
            setError(MT_SICS_ERRORS[status])
            setReading(null)
            continue
          }
          const parsed = parseScaleReading(line)
          if (parsed) {
            setError(null)
            setReading({ ...parsed, raw: line.trim(), at: Date.now() })
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar la balanza')
      setMode('disconnected')
    }
  }, [config.baudRate, config.dataBits, config.stopBits, config.parity, supported, sics, send])

  /** Simulador: oscila unos instantes y luego estabiliza en el peso objetivo. */
  const startSimulator = useCallback((target = 100) => {
    if (simRef.current.timer) clearInterval(simRef.current.timer)
    simRef.current.target = target
    setMode('simulator')
    let ticks = 0
    simRef.current.timer = setInterval(() => {
      ticks++
      const t = simRef.current.target
      const stable = ticks > 4
      const noise = stable ? 0 : (Math.random() - 0.5) * Math.max(0.05, t * 0.002)
      const grams = Math.round((t + noise) * 100) / 100
      const raw = `${stable ? 'ST' : 'US'},GS,+${grams.toFixed(2).padStart(10, ' ')} g`
      setReading({ grams, stable, raw, at: Date.now() })
    }, 350)
  }, [])

  const setSimulatedWeight = useCallback(
    (grams: number) => {
      if (mode !== 'simulator') return startSimulator(grams)
      simRef.current.target = grams
      startSimulator(grams)
    },
    [mode, startSimulator],
  )

  useEffect(() => () => void disconnect(), [disconnect])

  const zero = useCallback(() => send(MT_SICS.zero), [send])
  const tare = useCallback(() => send(MT_SICS.tare), [send])

  return { supported, mode, reading, error, connectSerial, startSimulator, setSimulatedWeight, disconnect, protocol: sics ? 'MT-SICS' : 'genérico', zero: sics ? zero : undefined, tare: sics ? tare : undefined }
}
