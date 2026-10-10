import type { Ref, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
  invalid?: boolean
  ref?: Ref<HTMLSelectElement>
}

/** Select nativo con estilos del sistema: accesible, móvil-friendly y fácil de automatizar. */
export function NativeSelect({ options, placeholder, invalid, className, ref, ...props }: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        // Nombre accesible por defecto (filtros sin etiqueta visible): la primera opción describe el filtro.
        aria-label={props['aria-label'] ?? (props.id || props['aria-labelledby'] ? undefined : (placeholder || options[0]?.label))}
        className={cn(
          'h-8 w-full cursor-pointer appearance-none rounded-sm border border-border-strong bg-surface pr-8 pl-2.5 text-[13px] text-ink',
          'transition-colors duration-120 hover:border-ink-placeholder disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted',
          invalid && 'border-danger',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-muted" />
    </div>
  )
}
