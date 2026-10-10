import type { Ref, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ invalid = false, className, rows = 3, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-sm border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink',
        'transition-colors duration-120 ease-out',
        'hover:border-ink-placeholder',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted',
        invalid && 'border-danger',
        className,
      )}
      {...props}
    />
  )
}
