import { useId } from 'react'
import { Checkbox as RadixCheckbox } from 'radix-ui'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'

interface CheckboxProps {
  checked?: boolean | 'indeterminate'
  onCheckedChange?: (checked: boolean | 'indeterminate') => void
  label?: string
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
  'data-testid'?: string
}

export function Checkbox({ checked, onCheckedChange, label, disabled, className, id, ...props }: CheckboxProps) {
  const autoId = useId()
  const checkboxId = id ?? autoId
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <RadixCheckbox.Root
        id={checkboxId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-border-strong bg-surface',
          'transition-colors duration-120 ease-out',
          'data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600',
          'data-[state=indeterminate]:border-brand-600 data-[state=indeterminate]:bg-brand-600',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      >
        <RadixCheckbox.Indicator className="text-white">
          {checked === 'indeterminate' ? <Minus className="size-3" /> : <Check className="size-3" />}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {label && (
        <label
          htmlFor={checkboxId}
          className={cn('cursor-pointer text-[13px] text-ink select-none', disabled && 'cursor-not-allowed opacity-50')}
        >
          {label}
        </label>
      )}
    </div>
  )
}
