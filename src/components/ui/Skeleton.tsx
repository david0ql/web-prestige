import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-sunken', className)} aria-hidden />
}

interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
}

export function TableSkeleton({ rows = 8, columns = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-surface', className)}>
      <div className="flex gap-4 border-b border-border bg-sunken/60 px-4 py-2.5">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border px-4 last:border-b-0" style={{ height: 36 }}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-3 flex-1', c === 0 && 'max-w-40')} />
          ))}
        </div>
      ))}
    </div>
  )
}
