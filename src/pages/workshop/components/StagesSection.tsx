import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, ChevronDown, Flag, Image as ImageIcon, Video, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { MediaFile, OrderDetail } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { MediaUploader } from '@/components/domain/MediaUploader'
import { MediaGrid } from '@/components/domain/MediaMosaic'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { notify } from '@/components/ui/Toaster'
import { cn } from '@/lib/cn'
import { BIG_BTN, ErrorPanel, FIELD, missingList } from './shared'

export type OrderStage = OrderDetail['stages'][number]

export function stageCounts(media: MediaFile[], stageId: string) {
  const items = media.filter((m) => m.stageId === stageId && !m.hidden)
  return { items, photos: items.filter((m) => m.kind === 'PHOTO').length, videos: items.filter((m) => m.kind === 'VIDEO').length }
}

export function evidenceMissing(stage: OrderStage, c: { photos: number; videos: number }) {
  const missing: string[] = []
  const minPhotos = Math.max(1, stage.minPhotos)
  if (stage.requiresPhoto && c.photos < minPhotos) missing.push(`${minPhotos - c.photos} foto(s) más`)
  if (stage.requiresVideo && c.videos < 1) missing.push('1 video')
  return missing
}

function Req({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px] font-medium', ok ? 'bg-success-bg text-success' : 'bg-sunken text-ink-secondary')}>
      {ok ? <Check className="size-3.5" /> : <X className="size-3.5 text-danger" />}
      {children}
    </span>
  )
}

function StageCard({ order, stage, index, media, current, editable, total, completedCount, onGoFinish }: {
  order: OrderDetail; stage: OrderStage; index: number; media: MediaFile[]; current: boolean; editable: boolean; total: number; completedCount: number; onGoFinish: () => void
}) {
  const qc = useQueryClient()
  const done = !!stage.completed
  const [open, setOpen] = useState(current && editable)
  const [notes, setNotes] = useState('')
  // Al avanzar, la nueva etapa actual se despliega sola.
  useEffect(() => {
    if (current && editable) setOpen(true)
  }, [current, editable])
  const c = stageCounts(media, stage.id)
  const missing = evidenceMissing(stage, c)
  const minPhotos = Math.max(1, stage.minPhotos)

  const complete = useMutation({
    meta: { silent: true },
    mutationFn: () =>
      api.post(`/orders/${order.id}/progress`, {
        stageId: stage.id,
        completesStage: true,
        percent: Math.min(100, Math.round(((completedCount + 1) / Math.max(1, total)) * 100)),
        notes: notes.trim() || `Etapa ${stage.name} completada`,
      }),
    onSuccess: () => {
      notify.success(`Etapa "${stage.name}" completada`)
      setNotes('')
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['workshop-portal'] })
    },
  })

  const refreshMedia = () => {
    void qc.invalidateQueries({ queryKey: ['media', 'order', order.id] })
  }

  return (
    <li data-testid={`stage-${stage.code}`} className={cn('relative rounded-md border bg-surface shadow-card', current && editable ? 'border-brand-400 ring-2 ring-brand-100' : 'border-border')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3.5 text-left" aria-expanded={open}>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold',
            done ? 'bg-success text-white' : current ? 'bg-brand-700 text-white' : 'bg-sunken text-ink-muted',
          )}
        >
          {done ? <Check className="size-5" /> : stage.isFinal ? <Flag className="size-4" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{stage.name}</p>
          <p className="text-[12px] text-ink-muted">
            {done
              ? `Completada ${formatDateTime(stage.completed!.completedAt)}`
              : current
                ? 'Etapa actual'
                : stage.mandatory
                  ? 'Obligatoria'
                  : 'Opcional'}
            {' · '}
            <ImageIcon className="inline size-3" /> {c.photos}
            {(stage.requiresVideo || c.videos > 0) && (
              <>
                {' '}
                <Video className="inline size-3" /> {c.videos}
              </>
            )}
          </p>
        </div>
        <ChevronDown className={cn('size-5 shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>

      {/* El contenido queda montado (oculto) para que la carga por input funcione aun plegada. */}
      <div className={cn('space-y-3 border-t border-border px-3.5 pt-3 pb-4', !open && 'hidden')}>
          <div className="flex flex-wrap gap-1.5">
            {stage.requiresPhoto && <Req ok={c.photos >= minPhotos}>Fotos {c.photos}/{minPhotos}</Req>}
            {stage.requiresVideo && <Req ok={c.videos >= 1}>Video {Math.min(c.videos, 1)}/1</Req>}
            {!stage.requiresPhoto && !stage.requiresVideo && <span className="text-[12px] text-ink-muted">Evidencia opcional</span>}
            {stage.mandatory && <span className="inline-flex items-center rounded-sm bg-brand-50 px-2 py-1 text-[12px] font-medium text-brand-800">Obligatoria</span>}
          </div>
          {stage.description && <p className="text-[13px] text-ink-secondary">{stage.description}</p>}

          <MediaGrid items={c.items} size="sm" emptyText="Aún no hay fotos ni videos en esta etapa." />

          {editable && (
            <MediaUploader
              testId={`stage-upload-${stage.code}`}
              fields={{ purpose: stage.isFinal ? 'FINISHED' : 'STAGE', productionOrderId: order.id, stageId: stage.id, caption: stage.name }}
              label={stage.isFinal ? 'Fotos y video del producto terminado' : `Subir evidencia de ${stage.name.toLowerCase()}`}
              hint={`${stage.requiresPhoto ? `Mínimo ${minPhotos} foto(s)` : 'Fotos opcionales'}${stage.requiresVideo ? ' y 1 video' : ''} · desde la cámara o el computador`}
              onUploaded={refreshMedia}
            />
          )}

          {editable && !done && !stage.isFinal && (
            <div className="space-y-2">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones de la etapa (opcional)" className={FIELD} data-testid={`stage-notes-${stage.code}`} />
              {missing.length > 0 && <p className="text-[13px] text-warning">Para completar falta: {missing.join(' y ')}.</p>}
              <ErrorPanel error={complete.error} describe={(e) => (e.code === 'STAGE_EVIDENCE_REQUIRED' ? missingList(e) : null)} />
              <Button data-testid={`stage-complete-${stage.code}`} onClick={() => complete.mutate()} loading={complete.isPending} className={cn(BIG_BTN, 'w-full sm:w-auto')} variant={missing.length ? 'secondary' : 'primary'}>
                <CheckCircle2 className="size-5" /> Completar etapa
              </Button>
            </div>
          )}
          {editable && !done && stage.isFinal && (
            <div className="flex flex-col gap-2 rounded-sm bg-brand-50 p-3 text-[13px] text-brand-900 sm:flex-row sm:items-center sm:justify-between">
              <span>Esta etapa se completa al declarar el producto terminado.{missing.length > 0 && ` Falta: ${missing.join(' y ')}.`}</span>
              <Button variant="secondary" onClick={onGoFinish} className="shrink-0">Ir a producto terminado</Button>
            </div>
          )}
      </div>
    </li>
  )
}

/** Etapas de fabricación con evidencias obligatorias (RF-014, RN-013). */
export function StagesSection({ order, stages, media, editable, onGoFinish }: { order: OrderDetail; stages: OrderStage[]; media: MediaFile[]; editable: boolean; onGoFinish: () => void }) {
  const completedCount = stages.filter((s) => s.completed).length
  const currentId = stages.find((s) => !s.completed)?.id
  if (!stages.length) return <p className="text-[14px] text-ink-muted">Este producto no tiene etapas configuradas.</p>
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => (
        <StageCard key={s.id} order={order} stage={s} index={i} media={media} current={s.id === currentId} editable={editable} total={stages.length} completedCount={completedCount} onGoFinish={onGoFinish} />
      ))}
    </ol>
  )
}

