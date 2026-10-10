import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { BadgeVariant } from '@/lib/labels'

interface BadgeProps {
  variant?: BadgeVariant
  /** Hue hex custom (p. ej. el de un RecordType); ignora `variant`. */
  hue?: string
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-sunken text-ink-secondary',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  gold: 'bg-brand-100 text-brand-800',
}

export function Badge({ variant = 'neutral', hue, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[20px] items-center gap-1 rounded-full px-2 text-[12px] font-medium whitespace-nowrap',
        !hue && variantClasses[variant],
        className,
      )}
      style={hue ? { backgroundColor: `${hue}1a`, color: hue } : undefined}
    >
      {children}
    </span>
  )
}
