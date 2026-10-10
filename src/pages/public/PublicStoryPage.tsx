import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Play } from 'lucide-react'
import type { MediaFile } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Crown } from '@/components/layout/Logo'
import { Lightbox } from '@/components/domain/MediaMosaic'
import { Spinner } from '@/components/ui/Spinner'

interface PublicMedia {
  id: string
  kind: 'PHOTO' | 'VIDEO'
  caption: string | null
  capturedAt: string
  stageId: string | null
  urls: { original: string; web: string; thumb: string | null }
  width: number | null
  height: number | null
}

interface PublicStory {
  title: string | null
  order: { number: string; product: { name: string; family?: string }; variant: { name: string } | null; createdAt: string; closedAt: string | null }
  timeline: PublicMedia[]
  groups: { stage: { id: string; name: string; sequence: number; isFinal: boolean }; items: PublicMedia[] }[]
  totals: { photos: number; videos: number }
}

class NotAvailable extends Error {}

/** Historia pública de la prenda para el consumidor final (sin login, sin datos internos). */
export default function PublicStoryPage() {
  const { token } = useParams({ from: '/historia/$token' })
  const q = useQuery({
    queryKey: ['public-story', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/stories/${encodeURIComponent(token)}`)
      if (res.status === 404) throw new NotAvailable()
      if (!res.ok) throw new Error('No fue posible cargar la historia')
      return (await res.json()) as PublicStory
    },
    retry: false,
  })
  const s = q.data
  const [open, setOpen] = useState<number | null>(null)

  const groups = useMemo(() => (s?.groups ?? []).filter((g) => g.items.length).sort((a, b) => a.stage.sequence - b.stage.sequence), [s])
  const all = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const hero = useMemo(() => {
    const finals = groups.filter((g) => g.stage.isFinal).flatMap((g) => g.items).filter((m) => m.kind === 'PHOTO')
    return finals[finals.length - 1] ?? [...all].reverse().find((m) => m.kind === 'PHOTO') ?? null
  }, [groups, all])

  useEffect(() => {
    document.title = s ? `${s.title ?? s.order.product.name} · Prestige Gold` : 'Prestige Gold'
  }, [s])

  if (q.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0c0a07] text-brand-300">
        <Spinner />
      </div>
    )
  }
  if (q.error || !s) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0c0a07] px-6 text-center">
        <Crown className="h-12 w-16" />
        <p className="display text-[34px] gold-text">Historia no disponible</p>
        <p className="max-w-sm text-[14px] text-[#9a8f78]">{q.error instanceof NotAvailable ? 'Este enlace expiró o fue retirado. Solicita uno nuevo a tu asesor Prestige Gold.' : 'Intenta de nuevo en unos minutos.'}</p>
      </div>
    )
  }

  const title = s.title ?? s.order.product.name
  const indexOf = (id: string) => all.findIndex((m) => m.id === id)

  return (
    <div className="min-h-dvh bg-[#0c0a07] text-[#ede6d6] selection:bg-brand-700/60" data-testid="public-story">
      {/* Portada */}
      <header className="relative flex min-h-[88dvh] flex-col overflow-hidden">
        {hero && <img src={hero.urls.web} alt="" className="absolute inset-0 size-full object-cover opacity-45" />}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0a07]/70 via-[#0c0a07]/40 to-[#0c0a07]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <nav className="relative flex items-center justify-center gap-3 px-6 pt-8">
          <Crown className="h-7 w-9" />
          <span className="display gold-text text-[20px] tracking-[0.18em]">PRESTIGE GOLD</span>
        </nav>
        <div className="relative mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] font-semibold tracking-[0.42em] text-brand-300 uppercase">{s.order.product.family ?? 'Alta joyería'}</p>
          <h1 className="display mt-5 text-[52px] leading-[0.95] text-[#f6efdf] sm:text-[84px]">{title}</h1>
          <span className="mt-7 block h-px w-24 bg-gradient-to-r from-transparent via-brand-400 to-transparent" />
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#cfc5ae] sm:text-[17px]">
            La historia de tu pieza, desde el metal fundido hasta el último pulido. Cada etapa fue registrada por nuestros orfebres para que conozcas cómo nació.
          </p>
          <dl className="mt-10 flex flex-wrap justify-center gap-x-12 gap-y-4 text-center">
            {s.order.variant && <Fact label="Modelo" value={s.order.variant.name} />}
            <Fact label="Etapas de elaboración" value={String(groups.length)} />
            <Fact label="Registros" value={`${s.totals.photos + s.totals.videos}`} />
            <Fact label={s.order.closedAt ? 'Finalizada' : 'Iniciada'} value={formatDate(s.order.closedAt ?? s.order.createdAt, 'MMMM yyyy')} />
          </dl>
        </div>
        <a href="#elaboracion" className="relative mx-auto mb-8 flex flex-col items-center gap-1 text-[10px] tracking-[0.3em] text-[#9a8f78] uppercase hover:text-brand-300">
          Descubrir <ChevronDown className="size-4 animate-bounce" />
        </a>
      </header>

      {/* Elaboración por etapas */}
      <main id="elaboracion" className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="mb-16 text-center">
          <p className="text-[11px] font-semibold tracking-[0.42em] text-brand-400 uppercase">El proceso</p>
          <h2 className="display mt-3 text-[40px] text-[#f6efdf] sm:text-[52px]">Hecha a mano, etapa por etapa</h2>
        </div>
        {groups.length === 0 ? (
          <p className="text-center text-[#9a8f78]">Pronto podrás ver aquí la historia de tu pieza.</p>
        ) : (
          <ol className="relative space-y-24">
            <span className="absolute top-0 bottom-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-brand-600/0 via-brand-600/40 to-brand-600/0 md:block" />
            {groups.map((g, gi) => {
              const leadIdx = Math.max(0, g.items.findIndex((m) => m.kind === 'PHOTO'))
              const lead = g.items[leadIdx]
              const rest = g.items.filter((_, i) => i !== leadIdx)
              const flip = gi % 2 === 1
              return (
                <li key={g.stage.id} className="relative grid items-center gap-8 md:grid-cols-2 md:gap-14">
                  <div className={cn('relative', flip && 'md:order-2')}>
                    <Tile m={lead} eager onOpen={() => setOpen(indexOf(lead.id))} className="aspect-[4/5] w-full" />
                    {rest.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {rest.slice(0, 3).map((m) => (
                          <Tile key={m.id} m={m} onOpen={() => setOpen(indexOf(m.id))} className="aspect-square" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={cn('text-center md:text-left', flip && 'md:order-1 md:text-right')}>
                    <p className="display text-[64px] leading-none text-brand-500/35">{String(gi + 1).padStart(2, '0')}</p>
                    <h3 className="display mt-2 text-[32px] leading-tight text-[#f6efdf] sm:text-[40px]">{g.stage.isFinal ? 'Tu pieza terminada' : g.stage.name}</h3>
                    <span className={cn('mt-4 block h-px w-16 bg-brand-500/60', flip ? 'mx-auto md:mr-0 md:ml-auto' : 'mx-auto md:mx-0')} />
                    {lead.caption && lead.caption !== g.stage.name && <p className="mt-4 text-[15px] leading-relaxed text-[#cfc5ae]">{lead.caption}</p>}
                    <p className="mt-3 text-[12px] tracking-[0.2em] text-[#9a8f78] uppercase">{formatDate(lead.capturedAt, "d 'de' MMMM yyyy")}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {all.length > 0 && (
          <section className="mt-32">
            <div className="mb-10 text-center">
              <p className="text-[11px] font-semibold tracking-[0.42em] text-brand-400 uppercase">Galería</p>
              <h2 className="display mt-3 text-[36px] text-[#f6efdf] sm:text-[44px]">Cada detalle</h2>
            </div>
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
              {all.map((m) => (
                <Tile key={m.id} m={m} onOpen={() => setOpen(indexOf(m.id))} natural />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[#2b261c] px-6 py-12 text-center">
        <Crown className="mx-auto h-8 w-11" />
        <p className="display gold-text mt-3 text-[22px] tracking-[0.2em]">PRESTIGE GOLD</p>
        <p className="mt-2 text-[12px] text-[#9a8f78]">Orfebrería con trazabilidad · Ley y calidad verificadas</p>
      </footer>

      <Lightbox items={all as unknown as MediaFile[]} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-[0.3em] text-[#9a8f78] uppercase">{label}</dt>
      <dd className="display mt-1 text-[22px] text-brand-200 capitalize">{value}</dd>
    </div>
  )
}

function Tile({ m, onOpen, className, natural, eager }: { m: PublicMedia; onOpen: () => void; className?: string; natural?: boolean; eager?: boolean }) {
  return (
    <button type="button" onClick={onOpen} className={cn('group relative block w-full overflow-hidden rounded-[3px] bg-[#1d1912] ring-1 ring-[#2b261c]', className)}>
      {m.kind === 'VIDEO' ? (
        <>
          <video src={m.urls.original} muted playsInline preload="metadata" className={cn('w-full object-cover opacity-90', natural ? 'h-auto' : 'size-full')} />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-brand-300/60 bg-black/40 backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="ml-0.5 size-5 fill-brand-200 text-brand-200" />
            </span>
          </span>
        </>
      ) : (
        <img src={m.urls.web} alt={m.caption ?? ''} loading={eager ? 'eager' : 'lazy'} className={cn('w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]', natural ? 'h-auto' : 'size-full')} />
      )}
    </button>
  )
}
