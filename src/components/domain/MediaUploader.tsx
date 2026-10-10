import { useRef, useState } from 'react'
import { Camera, FileUp, Film, ImagePlus } from 'lucide-react'
import { uploadMedia } from '@/lib/api/upload'
import type { MediaFile } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { notify } from '@/components/ui/Toaster'
import { errorMessage } from '@/lib/api/client'

interface Props {
  fields: Record<string, string | undefined>
  onUploaded?: (m: MediaFile) => void
  accept?: string
  label?: string
  hint?: string
  compact?: boolean
  testId?: string
}

/**
 * RF-014 · Carga de fotos y videos desde PC o cámara del celular, con arrastrar y
 * soltar, varios archivos a la vez y barra de progreso.
 */
export function MediaUploader({ fields, onUploaded, accept = 'image/*,video/*', label = 'Agregar fotos o videos', hint = 'JPG, PNG, HEIC, MP4, MOV · desde el computador o la cámara', compact, testId = 'media-uploader' }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([])
  const [drag, setDrag] = useState(false)

  const handle = async (files: FileList | null) => {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      setUploads((u) => [...u, { name: file.name, pct: 0 }])
      try {
        const m = await uploadMedia(file, fields, (pct) => setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, pct } : x))))
        onUploaded?.(m)
      } catch (e) {
        notify.error(`${file.name}: ${errorMessage(e)}`)
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name))
      }
    }
    if (input.current) input.current.value = ''
    if (camera.current) camera.current.value = ''
  }

  return (
    <div
      data-testid={testId}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        void handle(e.dataTransfer.files)
      }}
      className={cn('rounded-md border border-dashed border-border-strong bg-sunken/40 transition-colors', drag && 'border-brand-500 bg-brand-50', compact ? 'p-2.5' : 'p-4')}
    >
      <input ref={input} type="file" multiple accept={accept} className="hidden" data-testid={`${testId}-input`} onChange={(e) => void handle(e.target.files)} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handle(e.target.files)} />
      <div className={cn('flex items-center gap-3', compact ? 'flex-row' : 'flex-col text-center sm:flex-row sm:text-left')}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <ImagePlus className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-ink">{label}</p>
          {!compact && <p className="text-[12px] text-ink-muted">{hint}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => camera.current?.click()} className="flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 text-[13px] font-medium hover:bg-sunken sm:hidden">
            <Camera className="size-3.5" /> Cámara
          </button>
          <button type="button" onClick={() => input.current?.click()} className="flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 text-[13px] font-medium hover:bg-sunken">
            <FileUp className="size-3.5" /> Elegir archivos
          </button>
        </div>
      </div>
      {uploads.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {uploads.map((u) => (
            <li key={u.name} className="flex items-center gap-2 text-[12px] text-ink-secondary">
              <Film className="size-3.5 shrink-0" />
              <span className="flex-1 truncate">{u.name}</span>
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
                <span className="block h-full gold-gradient transition-all" style={{ width: `${u.pct}%` }} />
              </span>
              <span className="w-9 text-right tnum">{u.pct}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
