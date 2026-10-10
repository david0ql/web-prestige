import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px]',
        'border border-border bg-sunken px-1 font-mono text-[11px] text-ink-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
