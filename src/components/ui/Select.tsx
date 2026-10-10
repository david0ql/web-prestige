import { Select as RadixSelect } from 'radix-ui'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  id?: string
  'aria-label'?: string
}

const sizes = {
  sm: 'h-7 px-2 text-[13px]',
  md: 'h-8 px-2.5 text-[13px]',
  lg: 'h-9 px-3 text-[14px]',
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Selecciona…',
  disabled,
  invalid = false,
  size = 'md',
  className,
  id,
  ...props
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface text-ink',
          'transition-colors duration-120 ease-out hover:border-ink-placeholder',
          'data-disabled:cursor-not-allowed data-disabled:bg-sunken data-disabled:text-ink-muted',
          'data-[placeholder]:text-ink-placeholder',
          invalid && 'border-danger',
          sizes[size],
          className,
        )}
        {...props}
      >
        <span className="truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon>
          <ChevronDown className="size-3.5 text-ink-muted" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-overlay animate-scale-in"
        >
          <RadixSelect.ScrollUpButton className="flex h-6 items-center justify-center text-ink-muted">
            <ChevronUp className="size-3.5" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-[4px] px-2 py-1.5 text-[13px] text-ink outline-none select-none',
                  'data-highlighted:bg-sunken',
                  'data-disabled:pointer-events-none data-disabled:opacity-50',
                )}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator>
                  <Check className="size-3.5 text-brand-600" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex h-6 items-center justify-center text-ink-muted">
            <ChevronDown className="size-3.5" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
