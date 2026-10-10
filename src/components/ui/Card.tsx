import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps {
  /** Encabezado de sección (se pinta como eyebrow). */
  title?: string
  /** Acciones alineadas a la derecha del encabezado. */
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Quita el padding interior (para tablas edge-to-edge). */
  flush?: boolean
}

export function Card({ title, actions, children, className, flush = false }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-md border border-border bg-surface shadow-card',
        !flush && 'p-4',
        className,
      )}
    >
      {(title || actions) && (
        <header className={cn('mb-3 flex items-center justify-between gap-2', flush && 'px-4 pt-4')}>
          {title && <h2 className="eyebrow">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
