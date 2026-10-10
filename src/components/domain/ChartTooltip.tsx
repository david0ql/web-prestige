import type { ReactNode } from 'react'

interface Item { name?: string | number; value?: number | string; color?: string; dataKey?: string | number }

/** Tooltip de gráficas: texto en tinta, el color solo en el marcador. */
export function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: Item[]; label?: ReactNode; format: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] shadow-overlay">
      {label !== undefined && <p className="mb-1 font-semibold text-ink">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink-secondary">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-semibold text-ink tnum">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  )
}
