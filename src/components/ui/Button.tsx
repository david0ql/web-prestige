import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Botón cuadrado solo-ícono (usar con aria-label). */
  iconOnly?: boolean
  children?: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-800 border border-transparent',
  secondary:
    'bg-surface text-ink border border-border-strong hover:bg-sunken active:bg-sunken',
  ghost: 'bg-transparent text-ink-secondary border border-transparent hover:bg-sunken hover:text-ink',
  danger: 'bg-danger text-white border border-transparent hover:bg-[#A83029] active:bg-[#93251F]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[13px] gap-1.5 rounded-sm',
  md: 'h-8 px-3 text-[13px] gap-2 rounded-sm',
  lg: 'h-9 px-4 text-[14px] gap-2 rounded-md',
}

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: 'size-7 rounded-sm',
  md: 'size-8 rounded-sm',
  lg: 'size-9 rounded-md',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconOnly = false,
  className,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-medium select-none',
        'transition-colors duration-120 ease-out',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
