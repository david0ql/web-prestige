import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

/** Envoltorio de carga / error para consultas. */
export function QueryState({ isLoading, error, onRetry, children }: { isLoading: boolean; error: unknown; onRetry?: () => void; children: ReactNode }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-ink-muted">
        <Spinner /> Cargando…
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-danger/30 bg-danger-bg px-6 py-10 text-center">
        <AlertTriangle className="size-6 text-danger" />
        <p className="text-[13px] text-danger">{error instanceof Error ? error.message : 'No se pudo cargar la información'}</p>
        {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Reintentar</Button>}
      </div>
    )
  }
  return <>{children}</>
}
