import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, EyeOff, FileText, Play, X } from 'lucide-react'
import type { MediaFile } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'

/** Miniatura de evidencia (foto/video/documento). */
export function MediaThumb({ m, onClick, className }: { m: MediaFile; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid="media-thumb" className={cn('group relative aspect-square overflow-hidden rounded-md border border-border bg-sunken', className)}>
      {m.kind === 'PHOTO' ? (
        <img src={m.urls.thumb ?? m.urls.web} alt={m.caption ?? m.originalName} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
      ) : m.kind === 'VIDEO' ? (
        <div className="flex size-full items-center justify-center bg-sidebar">
          <video src={m.urls.original} muted preload="metadata" className="absolute inset-0 size-full object-cover opacity-70" />
          <span className="relative flex size-10 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="size-5 fill-white" />
          </span>
        </div>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-ink-muted">
          <FileText className="size-6" />
          <span className="line-clamp-2 text-[10px]">{m.originalName}</span>
        </div>
      )}
      {m.hidden && (
        <span className="absolute top-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
          <EyeOff className="size-3" /> Oculta
        </span>
      )}
    </button>
  )
}

/** Visor a pantalla completa con navegación por teclado. */
export function Lightbox({ items, index, onClose, onIndex }: { items: MediaFile[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  useEffect(() => {
    if (index === null) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex(Math.min(items.length - 1, index + 1))
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [index, items.length, onClose, onIndex])
  if (index === null || !items[index]) return null
  const m = items[index]
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 animate-fade-in" data-testid="lightbox">
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <p className="text-[13px]">
          {index + 1} / {items.length} · {m.caption ?? m.originalName} · {formatDateTime(m.capturedAt)}
        </p>
        <button onClick={onClose} aria-label="Cerrar" className="rounded p-1 hover:bg-white/10">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-12 pb-6">
        {m.kind === 'VIDEO' ? (
          <video src={m.urls.original} controls autoPlay playsInline className="max-h-full max-w-full rounded" />
        ) : m.kind === 'PHOTO' ? (
          <img src={m.urls.web} alt={m.caption ?? ''} className="max-h-full max-w-full rounded object-contain" />
        ) : (
          <a href={m.urls.original} target="_blank" rel="noreferrer" className="text-brand-300 underline">Abrir documento</a>
        )}
        {index > 0 && (
          <button onClick={() => onIndex(index - 1)} className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Anterior">
            <ChevronLeft className="size-6" />
          </button>
        )}
        {index < items.length - 1 && (
          <button onClick={() => onIndex(index + 1)} className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Siguiente">
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>
    </div>
  )
}

/** Cuadrícula simple de evidencias con visor. */
export function MediaGrid({ items, emptyText = 'Sin evidencias aún', size = 'md' }: { items: MediaFile[]; emptyText?: string; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!items.length) return <p className="text-[12px] text-ink-muted">{emptyText}</p>
  return (
    <>
      <div className={cn('grid gap-2', size === 'sm' ? 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6')}>
        {items.map((m, i) => (
          <MediaThumb key={m.id} m={m} onClick={() => setOpen(i)} />
        ))}
      </div>
      <Lightbox items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </>
  )
}
