import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface StatProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: 'default' | 'gold' | 'danger' | 'success' | 'warning'
  className?: string
  testId?: string
}

/** Tile de KPI (P02/P07). */
export function Stat({ label, value, hint, icon: Icon, tone = 'default', className, testId }: StatProps) {
  return (
    <div data-testid={testId} className={cn('relative overflow-hidden rounded-md border border-border bg-surface p-4 shadow-card', tone === 'gold' && 'border-brand-200 bg-gradient-to-br from-brand-50 to-surface', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <span className={cn('flex size-8 items-center justify-center rounded-md bg-sunken text-ink-muted', tone === 'gold' && 'bg-brand-100 text-brand-700', tone === 'danger' && 'bg-danger-bg text-danger', tone === 'success' && 'bg-success-bg text-success', tone === 'warning' && 'bg-warning-bg text-warning')}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[24px] leading-tight font-semibold tracking-tight text-ink tnum">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-ink-muted">{hint}</p>}
    </div>
  )
}
