import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { Button } from './Button'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <p className="text-[12px] text-ink-muted tnum">
        {total === 0
          ? 'Sin resultados'
          : `${formatNumber(from)}–${formatNumber(to)} de ${formatNumber(total)}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-ink-muted tnum">
          Página {formatNumber(page)} de {formatNumber(totalPages)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Anterior
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
