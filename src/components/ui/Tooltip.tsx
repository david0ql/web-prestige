import type { ReactNode } from 'react'
import { Tooltip as RadixTooltip } from 'radix-ui'
import { cn } from '@/lib/cn'

export const TooltipProvider = RadixTooltip.Provider

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Deshabilita el tooltip (renderiza solo el hijo). */
  disabled?: boolean
  className?: string
}

export function Tooltip({ content, children, side = 'top', disabled = false, className }: TooltipProps) {
  if (disabled) return children
  return (
    <RadixTooltip.Root delayDuration={300}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-sm bg-ink px-2 py-1 text-[12px] text-surface shadow-overlay',
            'animate-fade-in',
            className,
          )}
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
