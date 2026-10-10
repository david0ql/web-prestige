import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface BreadcrumbItem {
  label: string
  /** Ruta destino; el último item normalmente no lleva. */
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Migas de pan" className={cn('flex items-center gap-1 text-[12px]', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight className="size-3 shrink-0 text-ink-placeholder" />}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="rounded-[4px] text-ink-muted transition-colors duration-120 hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? 'font-medium text-ink' : 'text-ink-muted')}>{item.label}</span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
