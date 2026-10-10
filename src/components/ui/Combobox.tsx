import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { Command } from 'cmdk'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export interface ComboboxOption {
  value: string
  label: string
  /** Contenido extra a la izquierda (p. ej. un RecordChip). */
  leading?: ReactNode
}

interface ComboboxProps {
  value?: string | null
  onValueChange: (value: string | null, option?: ComboboxOption) => void
  /** Opciones estáticas (filtradas por cmdk)… */
  options?: ComboboxOption[]
  /** …o carga asíncrona por término de búsqueda (deshabilita el filtro local). */
  loadOptions?: (query: string) => Promise<ComboboxOption[]>
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  clearable?: boolean
  className?: string
  id?: string
}

export function Combobox({
  value,
  onValueChange,
  options: staticOptions,
  loadOptions,
  placeholder = 'Selecciona…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  disabled,
  invalid = false,
  clearable = true,
  className,
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [asyncOptions, setAsyncOptions] = useState<ComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const requestSeq = useRef(0)

  const isAsync = !!loadOptions
  const options = isAsync ? asyncOptions : (staticOptions ?? [])

  // Guarda la opción seleccionada para poder mostrar su label aunque
  // ya no esté en la lista actual (modo async).
  const [selected, setSelected] = useState<ComboboxOption | null>(null)
  const selectedLabel = useMemo(() => {
    if (value === null || value === undefined || value === '') return null
    const found = options.find((o) => o.value === value)
    return found?.label ?? (selected?.value === value ? selected.label : value)
  }, [value, options, selected])

  useEffect(() => {
    if (!isAsync || !open) return
    const seq = ++requestSeq.current
    setLoading(true)
    const timer = setTimeout(() => {
      loadOptions(query)
        .then((result) => {
          if (requestSeq.current === seq) setAsyncOptions(result)
        })
        .catch(() => {
          if (requestSeq.current === seq) setAsyncOptions([])
        })
        .finally(() => {
          if (requestSeq.current === seq) setLoading(false)
        })
    }, 200)
    return () => clearTimeout(timer)
  }, [isAsync, open, query, loadOptions])

  function handleSelect(option: ComboboxOption) {
    if (clearable && option.value === value) {
      setSelected(null)
      onValueChange(null)
    } else {
      setSelected(option)
      onValueChange(option.value, option)
    }
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface px-2.5 text-[13px]',
          'transition-colors duration-120 ease-out hover:border-ink-placeholder',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted',
          invalid && 'border-danger',
          className,
        )}
      >
        <span className={cn('truncate', selectedLabel ? 'text-ink' : 'text-ink-placeholder')}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 rounded-md border border-border bg-surface shadow-overlay animate-scale-in"
        >
          <Command shouldFilter={!isAsync} loop>
            <div className="flex items-center gap-2 border-b border-border px-2.5">
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                autoFocus
                className="h-8 w-full bg-transparent text-[13px] text-ink outline-none"
              />
              {loading && <Spinner size="sm" className="text-ink-muted" />}
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-1">
              {!loading && <Command.Empty className="px-2 py-3 text-center text-[13px] text-ink-muted">{emptyText}</Command.Empty>}
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => handleSelect(option)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-[13px] text-ink select-none',
                    'data-[selected=true]:bg-sunken',
                  )}
                >
                  {option.leading}
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.value === value && <Check className="size-3.5 text-brand-600" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
