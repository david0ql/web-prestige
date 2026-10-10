import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/cn'

/** Par etiqueta / valor compacto. */
export function KV({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="eyebrow">{label}</p>
      <div className="mt-0.5 text-[13px] text-ink">{children}</div>
    </div>
  )
}

/** Barra de progreso horizontal. */
export function Meter({ value, max, tone = 'gold', className }: { value: number; max: number; tone?: 'gold' | 'success' | 'danger' | 'warning'; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-sunken', className)}>
      <span
        className={cn('block h-full rounded-full', tone === 'gold' && 'gold-gradient', tone === 'success' && 'bg-success', tone === 'danger' && 'bg-danger', tone === 'warning' && 'bg-warning')}
        style={{ width: `${pct}%` }}
      />
    </span>
  )
}

/** Bloque de aviso con tono. */
export function Notice({ tone = 'info', icon, title, children, className }: { tone?: 'info' | 'warning' | 'danger' | 'success' | 'neutral'; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px]',
        tone === 'info' && 'border-info/25 bg-info-bg text-info',
        tone === 'warning' && 'border-warning/25 bg-warning-bg text-warning',
        tone === 'danger' && 'border-danger/25 bg-danger-bg text-danger',
        tone === 'success' && 'border-success/25 bg-success-bg text-success',
        tone === 'neutral' && 'border-border bg-sunken text-ink-secondary',
        className,
      )}
    >
      {icon && <span className="mt-0.5 shrink-0 [&>svg]:size-4">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-[12.5px] opacity-90')}>{children}</div>}
      </div>
    </div>
  )
}

/** Invalida todo lo relacionado con órdenes (detalle, listas, conciliación, bandejas). */
export function useInvalidateOrders() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['orders'] })
    void qc.invalidateQueries({ queryKey: ['discrepancies'] })
    void qc.invalidateQueries({ queryKey: ['labor'] })
    void qc.invalidateQueries({ queryKey: ['material-requests'] })
    void qc.invalidateQueries({ queryKey: ['finished-goods'] })
  }
}

/** Tabla simple con estilos del sistema (para tablas pequeñas dentro de tarjetas). */
export function MiniTable({ head, children, className, testId }: { head: { label: ReactNode; align?: 'left' | 'right' | 'center'; className?: string }[]; children: ReactNode; className?: string; testId?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)} data-testid={testId}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border bg-sunken/60">
            {head.map((h, i) => (
              <th key={i} className={cn('eyebrow px-3 py-2 whitespace-nowrap', h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left', h.className)}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-border/70 [&>tr:last-child]:border-0 [&_td]:px-3 [&_td]:py-2 [&_td]:align-middle">{children}</tbody>
      </table>
    </div>
  )
}
