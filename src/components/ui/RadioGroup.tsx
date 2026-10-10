import { useId } from 'react'
import { RadioGroup as RadixRadioGroup } from 'radix-ui'
import { cn } from '@/lib/cn'

export interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  options: RadioOption[]
  orientation?: 'vertical' | 'horizontal'
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  orientation = 'vertical',
  disabled,
  className,
  ...props
}: RadioGroupProps) {
  const groupId = useId()
  return (
    <RadixRadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      orientation={orientation}
      className={cn('flex gap-1', orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap gap-x-4', className)}
      {...props}
    >
      {options.map((option) => {
        const itemId = `${groupId}-${option.value}`
        return (
          <div key={option.value} className="flex items-start gap-2 py-0.5">
            <RadixRadioGroup.Item
              id={itemId}
              value={option.value}
              disabled={option.disabled}
              className={cn(
                'mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface',
                'transition-colors duration-120 ease-out',
                'data-[state=checked]:border-brand-600',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <RadixRadioGroup.Indicator className="size-2 rounded-full bg-brand-600" />
            </RadixRadioGroup.Item>
            <label htmlFor={itemId} className="cursor-pointer text-[13px] text-ink select-none">
              {option.label}
              {option.description && (
                <span className="block text-[12px] text-ink-muted">{option.description}</span>
              )}
            </label>
          </div>
        )
      })}
    </RadixRadioGroup.Root>
  )
}
