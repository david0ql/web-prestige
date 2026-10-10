import type { InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string
  onValueChange: (value: string) => void
}

export function SearchInput({
  value,
  onValueChange,
  placeholder = 'Buscar…',
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-8 w-full rounded-sm border border-border-strong bg-surface pr-7 pl-8 text-[13px] text-ink',
          'transition-colors duration-120 ease-out hover:border-ink-placeholder',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
        {...props}
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => onValueChange('')}
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[4px] text-ink-muted hover:bg-sunken hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
