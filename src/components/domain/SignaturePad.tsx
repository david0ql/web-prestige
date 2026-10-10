import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * RF-035 · Firma digital: trazo con dedo/lápiz/mouse sobre canvas. Entrega un PNG
 * en data URL que la API guarda junto al hash del contenido aceptado.
 */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const c = canvas.current!
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = c.offsetHeight * ratio
    const ctx = c.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1712'
  }, [])

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div>
      <div className="relative rounded-md border border-dashed border-border-strong bg-white">
        <canvas
          ref={canvas}
          data-testid="signature-pad"
          className="h-36 w-full touch-none"
          onPointerDown={(e) => {
            drawing.current = true
            const ctx = canvas.current!.getContext('2d')!
            const p = pos(e)
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            canvas.current!.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return
            const ctx = canvas.current!.getContext('2d')!
            const p = pos(e)
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
            if (!hasInk) setHasInk(true)
          }}
          onPointerUp={() => {
            drawing.current = false
            if (hasInk) onChange(canvas.current!.toDataURL('image/png'))
          }}
        />
        {!hasInk && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-ink-placeholder">Firme aquí</span>}
      </div>
      <div className="mt-1 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const c = canvas.current!
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
            setHasInk(false)
            onChange(null)
          }}
        >
          <Eraser className="size-3.5" /> Limpiar
        </Button>
      </div>
    </div>
  )
}
