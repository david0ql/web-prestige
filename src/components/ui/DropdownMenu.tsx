import type { ComponentProps, ComponentType, ReactNode } from 'react'
import { DropdownMenu as RadixDropdownMenu } from 'radix-ui'
import { cn } from '@/lib/cn'

export const DropdownMenu = RadixDropdownMenu.Root
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger
export const DropdownMenuSeparator = (props: ComponentProps<typeof RadixDropdownMenu.Separator>) => (
  <RadixDropdownMenu.Separator {...props} className={cn('my-1 h-px bg-border', props.className)} />
)

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'start',
  children,
  ...props
}: ComponentProps<typeof RadixDropdownMenu.Content>) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-44 rounded-md border border-border bg-surface p-1 shadow-overlay',
          'animate-scale-in origin-top',
          className,
        )}
        {...props}
      >
        {children}
      </RadixDropdownMenu.Content>
    </RadixDropdownMenu.Portal>
  )
}

interface DropdownMenuItemProps extends Omit<ComponentProps<typeof RadixDropdownMenu.Item>, 'children'> {
  icon?: ComponentType<{ className?: string }>
  danger?: boolean
  children: ReactNode
}

export function DropdownMenuItem({ icon: Icon, danger = false, className, children, ...props }: DropdownMenuItemProps) {
  return (
    <RadixDropdownMenu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-[13px] outline-none select-none',
        danger ? 'text-danger data-highlighted:bg-danger-bg' : 'text-ink data-highlighted:bg-sunken',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={cn('size-4', danger ? 'text-danger' : 'text-ink-muted')} />}
      {children}
    </RadixDropdownMenu.Item>
  )
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof RadixDropdownMenu.Label>) {
  return <RadixDropdownMenu.Label {...props} className={cn('eyebrow px-2 pt-2 pb-1', className)} />
}
