import { useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Copy, ExternalLink, Eye, EyeOff, Film, Globe, GlobeLock, Link2, Plus, Trash2 } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { MediaFile, Story } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { ORDER_STATUS } from '@/lib/labels'
import { formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { ReasonDialog } from '@/components/domain/ReasonDialog'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { Lightbox, MediaThumb } from '@/components/domain/MediaMosaic'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Tooltip } from '@/components/ui/Tooltip'
import { notify } from '@/components/ui/Toaster'

interface StoryShare {
  id: string
  token: string
  title: string | null
  expiresAt: string | null
  views?: number
  createdAt: string
}

const publicUrl = (token: string) => `${window.location.origin}/historia/${token}`

/** P20 · Historia visual / mosaico de fabricación (RF-041, CA-016). */
export default function StoryPage() {
  const { orderId } = useParams({ from: '/app/ordenes/$orderId/historia' })
  const canModerate = usePermission('media.moderate')
  const q = useQuery({ queryKey: ['orders', 'story', orderId], queryFn: () => api.get<Story>(`/orders/${orderId}/story`) })
  const s = q.data
  const [open, setOpen] = useState<number | null>(null)
  const [hide, setHide] = useState<MediaFile | null>(null)
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['orders', 'story', orderId] })
    void qc.invalidateQueries({ queryKey: ['orders', 'story-hidden', orderId] })
  }

  const hideM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/media/${id}/hide`, { reason }),
    onSuccess: () => {
      notify.success('Evidencia ocultada (queda trazabilidad, RN-024)')
      setHide(null)
      refresh()
    },
  })
  const visibility = useMutation({
    mutationFn: ({ id, publicVisible }: { id: string; publicVisible: boolean }) => api.patch(`/media/${id}/visibility`, { publicVisible }),
    onSuccess: (_, v) => {
      notify.success(v.publicVisible ? 'Visible en la historia pública' : 'Retirada de la historia pública')
      refresh()
    },
  })

  const timeline = useMemo(() => s?.groups.flatMap((g) => g.items) ?? [], [s])
  const indexOf = (id: string) => timeline.findIndex((m) => m.id === id)
  const groups = s?.groups.filter((g) => g.items.length || g.stage.mandatory) ?? []
  const publicCount = timeline.filter((m) => m.publicVisible).length

  return (
    <div>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {s && (
          <>
            <PageHeader
              code="P20"
              breadcrumbs={[{ label: 'Órdenes', to: '/ordenes' }, { label: s.order.number, to: `/ordenes/${orderId}` }, { label: 'Historia visual' }]}
              title="Historia visual de fabricación"
              description="Línea de tiempo de fotos y videos por etapa, lista para consulta interna y para la experiencia del consumidor final."
              actions={
                <Link to="/ordenes/$orderId" params={{ orderId }}>
                  <Button variant="secondary">Volver a la orden</Button>
                </Link>
              }
            />

            <div className="relative mb-5 overflow-hidden rounded-lg bg-sidebar px-6 py-6 text-sidebar-foreground shadow-card">
              <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-brand-500/15 blur-3xl" />
              <div className="relative flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.2em] text-brand-300 uppercase">{s.order.product.family ?? 'Prestige Gold'}</p>
                  <h2 className="display mt-1 text-[38px] leading-none gold-text">{s.order.product.name}</h2>
                  <p className="mt-2 text-[13px] text-sidebar-muted">
                    {s.order.number}
                    {s.order.variant ? ` · ${s.order.variant.name}` : ''}
                    {s.order.workshop ? ` · Taller ${s.order.workshop.name}` : ''} · Iniciada {formatDate(s.order.createdAt)}
                    {s.order.closedAt ? ` · Cerrada ${formatDate(s.order.closedAt)}` : ''}
                  </p>
                  <div className="mt-3"><StatusBadge map={ORDER_STATUS} value={s.order.status} /></div>
                </div>
                <div className="flex gap-6">
                  <Counter icon={<Camera className="size-4" />} value={s.totals.photos} label="Fotos" />
                  <Counter icon={<Film className="size-4" />} value={s.totals.videos} label="Videos" />
                  <Counter icon={<Globe className="size-4" />} value={publicCount} label="Públicas" />
                  <Counter value={s.groups.filter((g) => g.items.length).length} label="Etapas" />
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                {timeline.length === 0 ? (
                  <EmptyState icon={Camera} title="Aún no hay evidencias" description="Las fotos y videos que el taller cargue por etapa aparecerán aquí en orden cronológico." />
                ) : (
                  <ol className="relative" data-testid="story-timeline">
                    {groups.map((g, gi) => {
                      const first = g.items[0]
                      const last = g.items[g.items.length - 1]
                      return (
                        <li key={g.stage.id} className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-4 pb-8 last:pb-0">
                          {gi < groups.length - 1 && <span className="absolute top-11 bottom-0 left-[21px] w-px bg-gradient-to-b from-brand-300 to-border" />}
                          <span className={cn('relative z-10 flex size-11 items-center justify-center rounded-full border-2 text-[14px] font-bold display', g.items.length ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-border bg-surface text-ink-muted')}>
                            {g.stage.sequence < 999 ? g.stage.sequence : '·'}
                          </span>
                          <div>
                            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                              <h3 className="display text-[22px] leading-tight text-ink">{g.stage.name}</h3>
                              <span className="text-[12px] text-ink-muted">
                                {g.items.length ? `${formatDateTime(first.capturedAt)}${last && last.id !== first.id ? ` — ${formatDateTime(last.capturedAt)}` : ''}` : 'Sin evidencias'}
                              </span>
                              {g.stage.isFinal && <span className="rounded-full bg-brand-100 px-2 text-[11px] font-medium text-brand-800">Pieza terminada</span>}
                            </div>
                            {g.items.length === 0 ? (
                              <p className="rounded-md border border-dashed border-border px-3 py-4 text-[12px] text-ink-muted">Etapa obligatoria sin evidencia registrada.</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                {g.items.map((m, i) => (
                                  <div key={m.id} className={cn('group relative', i === 0 && g.items.length > 2 && 'col-span-2 row-span-2')}>
                                    <MediaThumb m={m} onClick={() => setOpen(indexOf(m.id))} className="size-full" />
                                    {m.caption && <p className="pointer-events-none absolute inset-x-0 bottom-0 truncate rounded-b-md bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">{m.caption}</p>}
                                    {canModerate && (
                                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                                        <Tooltip content={m.publicVisible ? 'Visible al público · clic para retirar' : 'Privada · clic para publicar'}>
                                          <button
                                            type="button"
                                            data-testid="media-toggle-public"
                                            onClick={() => visibility.mutate({ id: m.id, publicVisible: !m.publicVisible })}
                                            className={cn('flex size-7 items-center justify-center rounded-full text-white shadow', m.publicVisible ? 'bg-brand-600 hover:bg-brand-700' : 'bg-black/60 hover:bg-black/80')}
                                          >
                                            {m.publicVisible ? <Globe className="size-3.5" /> : <GlobeLock className="size-3.5" />}
                                          </button>
                                        </Tooltip>
                                        <Tooltip content="Ocultar evidencia (con motivo)">
                                          <button type="button" data-testid="media-hide" onClick={() => setHide(m)} className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-danger">
                                            <EyeOff className="size-3.5" />
                                          </button>
                                        </Tooltip>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>

              <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
                {canModerate ? <SharesPanel orderId={orderId} defaultTitle={s.order.product.name} /> : (
                  <Card title="Historia pública">
                    <p className="text-[12px] text-ink-muted">La publicación de enlaces para el consumidor final la gestiona Gerencia (permiso de moderación).</p>
                  </Card>
                )}
                {canModerate && <HiddenPanel orderId={orderId} onChange={refresh} />}
              </div>
            </div>

            <Lightbox items={timeline} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
            <ReasonDialog
              open={!!hide}
              onOpenChange={(v) => !v && setHide(null)}
              title="Ocultar evidencia"
              description="La evidencia no se elimina: queda oculta con motivo y usuario (RN-024). Puedes volver a mostrarla."
              confirmLabel="Ocultar"
              danger
              loading={hideM.isPending}
              onConfirm={(reason) => hide && hideM.mutate({ id: hide.id, reason })}
            />
          </>
        )}
      </QueryState>
    </div>
  )
}

function Counter({ icon, value, label }: { icon?: React.ReactNode; value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="display flex items-center justify-center gap-1.5 text-[30px] leading-none text-brand-200 tnum">
        {icon && <span className="text-brand-400">{icon}</span>}
        {value}
      </p>
      <p className="mt-1 text-[10.5px] font-bold tracking-[0.18em] text-sidebar-muted uppercase">{label}</p>
    </div>
  )
}

function SharesPanel({ orderId, defaultTitle }: { orderId: string; defaultTitle: string }) {
  const qc = useQueryClient()
  const key = ['orders', 'story-shares', orderId]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<StoryShare[]>(`/orders/${orderId}/story/shares`) })
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState(defaultTitle)
  const [expiresAt, setExpiresAt] = useState('')
  const [revoke, setRevoke] = useState<StoryShare | null>(null)
  const create = useMutation({
    mutationFn: () => api.post<StoryShare>(`/orders/${orderId}/story/shares`, { title: title.trim() || undefined, expiresAt: expiresAt || undefined }),
    onSuccess: (sh) => {
      void qc.invalidateQueries({ queryKey: key })
      setCreating(false)
      void copy(sh.token)
    },
  })
  const revokeM = useMutation({
    mutationFn: (id: string) => api.delete(`/story-shares/${id}`),
    onSuccess: () => {
      notify.success('Enlace revocado')
      setRevoke(null)
      void qc.invalidateQueries({ queryKey: key })
    },
  })
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(token))
      notify.success('Enlace público copiado')
    } catch {
      notify.info(publicUrl(token))
    }
  }
  return (
    <Card
      title="Enlaces públicos (consumidor final)"
      actions={
        <Button size="sm" data-testid="story-share-create" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Crear enlace
        </Button>
      }
    >
      <p className="mb-3 text-[12px] text-ink-muted">Solo se publican las evidencias marcadas como visibles al público <Globe className="inline size-3 text-brand-600" />. No incluye datos internos.</p>
      {q.data?.length ? (
        <ul className="space-y-2" data-testid="story-shares">
          {q.data.map((sh) => (
            <li key={sh.id} className="rounded-md border border-border p-2.5">
              <div className="flex items-center gap-2">
                <Link2 className="size-3.5 shrink-0 text-brand-600" />
                <p className="flex-1 truncate text-[13px] font-medium text-ink">{sh.title ?? 'Historia'}</p>
                {typeof sh.views === 'number' && <span className="flex items-center gap-1 text-[11px] text-ink-muted"><Eye className="size-3" /> {sh.views}</span>}
              </div>
              <p className="ledger mt-1 truncate text-[11px] text-ink-muted">{publicUrl(sh.token)}</p>
              <p className="text-[11px] text-ink-muted">Creado {formatDate(sh.createdAt)}{sh.expiresAt ? ` · vence ${formatDate(sh.expiresAt)}` : ' · sin vencimiento'}</p>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="secondary" data-testid="story-share-copy" onClick={() => void copy(sh.token)}>
                  <Copy className="size-3.5" /> Copiar
                </Button>
                <a href={publicUrl(sh.token)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost">
                    <ExternalLink className="size-3.5" /> Abrir
                  </Button>
                </a>
                <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => setRevoke(sh)}>
                  <Trash2 className="size-3.5" /> Revocar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-ink-muted">{q.isLoading ? 'Cargando…' : 'Sin enlaces activos.'}</p>
      )}
      <Modal
        open={creating}
        onOpenChange={setCreating}
        title="Crear enlace público"
        description="Cualquier persona con el enlace podrá ver la historia de elaboración de la prenda."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button data-testid="story-share-submit" loading={create.isPending} onClick={() => create.mutate()}>Crear y copiar enlace</Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Título visible">
            <Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Vence el" hint="Opcional. Sin fecha, el enlace queda activo hasta revocarlo.">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </FormField>
        </div>
      </Modal>
      <ConfirmDialog open={!!revoke} onOpenChange={(v) => !v && setRevoke(null)} title="Revocar enlace público" danger confirmLabel="Revocar" loading={revokeM.isPending} onConfirm={() => revoke && revokeM.mutate(revoke.id)}>
        El enlace dejará de funcionar de inmediato para quien lo tenga.
      </ConfirmDialog>
    </Card>
  )
}

function HiddenPanel({ orderId, onChange }: { orderId: string; onChange: () => void }) {
  const q = useQuery({
    queryKey: ['orders', 'story-hidden', orderId],
    queryFn: () => api.get<Paginated<MediaFile>>('/media', { productionOrderId: orderId, includeHidden: true, pageSize: 200 }).then((r) => r.items.filter((m) => m.hidden)),
  })
  const unhide = useMutation({
    mutationFn: (id: string) => api.post(`/media/${id}/unhide`),
    onSuccess: () => {
      notify.success('Evidencia visible nuevamente')
      void q.refetch()
      onChange()
    },
  })
  if (!q.data?.length) return null
  return (
    <Card title={`Evidencias ocultas · ${q.data.length}`}>
      <ul className="space-y-2">
        {q.data.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5">
            <MediaThumb m={m} className="size-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-ink">{m.caption ?? m.originalName}</p>
              <p className="truncate text-[11px] text-ink-muted">{m.hiddenReason}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => unhide.mutate(m.id)}>
              <Eye className="size-3.5" /> Mostrar
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
