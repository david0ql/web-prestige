import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PathBarProps {
  /** Etiquetas de las etapas, en orden. */
  stages: string[]
  /** Índice de la etapa actual. */
  currentIndex: number
  /** Click en una etapa (si se omite, la barra es solo lectura). */
  onStageClick?: (index: number) => void
  className?: string
}

const chevronClip =
  'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)'
const chevronClipFirst = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'

/**
 * Barra de progreso de etapas (pipeline). Etapas completadas y actual con
 * relleno azul de marca; futuras en gris.
 */
export function PathBar({ stages, currentIndex, onStageClick, className }: PathBarProps) {
  return (
    <div className={cn('flex w-full items-stretch', className)} role="list" aria-label="Etapas">
      {stages.map((stage, index) => {
        const done = index < currentIndex
        const current = index === currentIndex
        const clickable = !!onStageClick
        return (
          <button
            key={`${stage}-${index}`}
            type="button"
            role="listitem"
            aria-current={current ? 'step' : undefined}
            disabled={!clickable}
            onClick={() => onStageClick?.(index)}
            style={{
              clipPath: index === 0 ? chevronClipFirst : chevronClip,
              marginLeft: index === 0 ? 0 : -6,
            }}
            className={cn(
              'flex h-8 flex-1 items-center justify-center gap-1.5 px-4 text-[12px] font-medium whitespace-nowrap select-none',
              'transition-colors duration-120 ease-out',
              clickable && 'cursor-pointer',
              done && 'bg-brand-100 text-brand-800',
              done && clickable && 'hover:bg-brand-200',
              current && 'bg-brand-700 text-white',
              !done && !current && 'bg-sunken text-ink-muted',
              !done && !current && clickable && 'hover:bg-border',
            )}
          >
            {done && <Check className="size-3.5 shrink-0" />}
            <span className="truncate">{stage}</span>
          </button>
        )
      })}
    </div>
  )
}
