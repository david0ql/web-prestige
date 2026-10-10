import { useState } from 'react'
import { Popover } from 'radix-ui'
import { Command } from 'cmdk'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  values: string[]
  onValuesChange: (values: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  id?: string
}

export function MultiSelect({
  values,
  onValuesChange,
  options,
  placeholder = 'Selecciona…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  disabled,
  invalid = false,
  className,
  id,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)

  function toggle(value: string) {
    onValuesChange(
      values.includes(value) ? values.filter((v) => v !== value) : [...values, value],
    )
  }

  const selectedOptions = options.filter((o) => values.includes(o.value))

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface px-2 py-1 text-[13px]',
          'transition-colors duration-120 ease-out hover:border-ink-placeholder',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted',
          invalid && 'border-danger',
          className,
        )}
      >
        {selectedOptions.length === 0 ? (
          <span className="px-0.5 text-ink-placeholder">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-[4px] bg-sunken px-1.5 py-0.5 text-[12px] text-ink"
              >
                {option.label}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Quitar ${option.label}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(option.value)
                  }}
                  className="cursor-pointer text-ink-muted hover:text-ink"
                >
                  <X className="size-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 rounded-md border border-border bg-surface shadow-overlay animate-scale-in"
        >
          <Command loop>
            <Command.Input
              placeholder={searchPlaceholder}
              autoFocus
              className="h-8 w-full border-b border-border bg-transparent px-2.5 text-[13px] text-ink outline-none"
            />
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-3 text-center text-[13px] text-ink-muted">
                {emptyText}
              </Command.Empty>
              {options.map((option) => {
                const checked = values.includes(option.value)
                return (
                  <Command.Item
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggle(option.value)}
                    className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-[13px] text-ink select-none data-[selected=true]:bg-sunken"
                  >
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-[4px] border',
                        checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-border-strong bg-surface',
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="flex-1 truncate">{option.label}</span>
                  </Command.Item>
                )
              })}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
