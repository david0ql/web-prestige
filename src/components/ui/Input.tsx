import type { InputHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'sm' | 'md' | 'lg'
  invalid?: boolean
  ref?: Ref<HTMLInputElement>
}

const sizes = {
  sm: 'h-7 px-2 text-[13px]',
  md: 'h-8 px-2.5 text-[13px]',
  lg: 'h-9 px-3 text-[14px]',
}

export function Input({ inputSize = 'md', invalid = false, className, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-sm border border-border-strong bg-surface text-ink',
        'transition-colors duration-120 ease-out',
        'hover:border-ink-placeholder',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted',
        invalid && 'border-danger',
        sizes[inputSize],
        className,
      )}
      {...props}
    />
  )
}
