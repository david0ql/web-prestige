import { useId } from 'react'
import { Switch as RadixSwitch } from 'radix-ui'
import { cn } from '@/lib/cn'

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
  'data-testid'?: string
}

export function Switch({ checked, onCheckedChange, label, disabled, className, id, ...props }: SwitchProps) {
  const autoId = useId()
  const switchId = id ?? autoId
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <RadixSwitch.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative h-[18px] w-8 shrink-0 cursor-pointer rounded-full bg-border-strong',
          'transition-colors duration-120 ease-out',
          'data-[state=checked]:bg-brand-600',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block size-[14px] translate-x-[2px] rounded-full bg-white shadow-card',
            'transition-transform duration-120 ease-out',
            'data-[state=checked]:translate-x-[16px]',
          )}
        />
      </RadixSwitch.Root>
      {label && (
        <label
          htmlFor={switchId}
          className={cn('cursor-pointer text-[13px] text-ink select-none', disabled && 'cursor-not-allowed opacity-50')}
        >
          {label}
        </label>
      )}
    </div>
  )
}
