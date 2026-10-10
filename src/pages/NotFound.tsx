import { Link } from '@tanstack/react-router'
import { Crown } from '@/components/layout/Logo'

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Crown className="h-12 w-16 opacity-60" />
      <h1 className="text-[20px] font-bold">Página no encontrada</h1>
      <p className="text-[13px] text-ink-muted">La ruta no existe o no tienes acceso.</p>
      <Link to="/" className="text-[13px] font-semibold text-brand-700 hover:underline">Volver al inicio</Link>
    </div>
  )
}
