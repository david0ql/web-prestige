import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { BadgeVariant } from '@/lib/labels'

/** Utilidades locales de la pantalla P18 (formularios simples y estados). */

export function useFormState<T extends object>(initial: T) {
  const [values, setValues] = useState<T>(initial)
  const set = <K extends keyof T>(key: K, value: T[K]) => setValues((p) => ({ ...p, [key]: value }))
  return [values, set, setValues] as const
}

/** '' → null, número con coma o punto. */
export const toNum = (s: string | number | null | undefined): number | null => {
  if (s === null || s === undefined) return null
  if (typeof s === 'number') return Number.isFinite(s) ? s : null
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
export const numStr = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))
/** Cadena vacía → null (los DTO aceptan null en campos opcionales). */
export const strOrNull = (s: string | null | undefined) => (s && s.trim() !== '' ? s.trim() : null)
/** Elimina claves con null (para POST de creación). */
export const compact = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>

export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
]

export function ActiveBadge({ active, status }: { active?: boolean; status?: string }) {
  const on = active ?? status === 'ACTIVE'
  return <Badge variant={on ? 'success' : 'neutral'}>{on ? 'Activo' : 'Inactivo'}</Badge>
}

export function YesNo({ value, yes = 'Sí', no = '—', variant = 'info' }: { value: boolean; yes?: string; no?: string; variant?: BadgeVariant }) {
  return value ? <Badge variant={variant}>{yes}</Badge> : <span className="text-ink-muted">{no}</span>
}

/** Barra de herramientas de una sección: título, filtros y acciones. */
export function SectionBar({ title, description, children, actions }: { title: string; description?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="space-y-3 border-b border-border px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 max-w-3xl text-[12px] text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Selector segmentado para sub-secciones dentro de una pestaña. */
export function Segmented<T extends string>({ value, onChange, options, testIdPrefix }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; testIdPrefix?: string }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-testid={testIdPrefix ? `${testIdPrefix}-${o.value}` : undefined}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="text-[11px] text-ink-muted tnum">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Mutación que invalida prefijos de query al terminar con éxito. */
export function useSave<V, R = unknown>(fn: (v: V) => Promise<R>, invalidate: string[][], onSuccess?: (r: R, v: V) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      invalidate.forEach((k) => void qc.invalidateQueries({ queryKey: k }))
      onSuccess?.(r, v)
    },
  })
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={cn('grid grid-cols-1 gap-3', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-3', cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4')}>{children}</div>
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>
}

export const mono = 'font-mono text-[12px] font-semibold tracking-tight text-ink'
