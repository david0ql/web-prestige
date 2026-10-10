import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Inbox } from 'lucide-react'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  hideOnMobile?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  onRowClick?: (row: T) => void
  empty?: { title: string; description?: string; action?: ReactNode }
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void }
  footer?: ReactNode
  testId?: string
  dense?: boolean
}

/** Tabla de datos responsive (scroll horizontal en móvil) con estados vacío/carga. */
export function DataTable<T>({ columns, rows, rowKey, loading, onRowClick, empty, pagination, footer, testId, dense }: Props<T>) {
  if (loading) return <TableSkeleton rows={6} columns={Math.min(columns.length, 6)} />
  if (!rows || rows.length === 0) {
    return <EmptyState icon={Inbox} title={empty?.title ?? 'Sin registros'} description={empty?.description} action={empty?.action} />
  }
  return (
    <div data-testid={testId}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-sunken/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn('eyebrow px-3 py-2 text-left whitespace-nowrap', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.hideOnMobile && 'hidden md:table-cell')}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn('border-b border-border/70 last:border-0', onRowClick && 'cursor-pointer hover:bg-brand-50/60')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('px-3 align-middle', dense ? 'py-1.5' : 'py-2.5', c.align === 'right' && 'text-right tnum', c.align === 'center' && 'text-center', c.hideOnMobile && 'hidden md:table-cell', c.className)}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {pagination && pagination.total > pagination.pageSize && <Pagination className="border-t border-border px-3 py-2" {...pagination} />}
    </div>
  )
}
