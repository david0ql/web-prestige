import type { ComponentProps, ReactNode } from 'react'
import { Tabs as RadixTabs } from 'radix-ui'
import { cn } from '@/lib/cn'

export const Tabs = RadixTabs.Root
export const TabsContent = RadixTabs.Content

export function TabsList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      {...props}
      className={cn('flex items-end gap-1 border-b border-border', className)}
    />
  )
}

interface TabsTriggerProps extends ComponentProps<typeof RadixTabs.Trigger> {
  /** Contador opcional a la derecha del label. */
  count?: number
  children: ReactNode
}

export function TabsTrigger({ count, className, children, ...props }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      {...props}
      className={cn(
        'relative -mb-px flex cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 pt-1.5 pb-2 text-[13px] font-medium text-ink-muted',
        'transition-colors duration-120 ease-out hover:text-ink',
        'data-[state=active]:border-brand-600 data-[state=active]:text-ink',
        className,
      )}
    >
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-sunken px-1.5 text-[11px] text-ink-muted tnum">{count}</span>
      )}
    </RadixTabs.Trigger>
  )
}
