import { useAuthStore } from '@/lib/auth/store'
import { ApiError, refreshSession } from './client'
import type { MediaFile } from './types'

/**
 * RNF-011 · Optimiza fotos en el dispositivo antes de subir (≤2560 px, JPEG 85%)
 * para no saturar datos móviles; los videos se suben tal cual con progreso.
 */
async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 600_000) return file
  try {
    const bitmap = await createImageBitmap(file)
    const max = 2560
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 2_500_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}

export async function uploadMedia(
  file: File,
  fields: Record<string, string | undefined>,
  onProgress?: (pct: number) => void,
): Promise<MediaFile> {
  const optimized = await optimizeImage(file)
  const send = () =>
    new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const form = new FormData()
      for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v)
      form.append('capturedAt', new Date(file.lastModified || Date.now()).toISOString())
      form.append('file', optimized)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/media')
      xhr.withCredentials = true
      const token = useAuthStore.getState().accessToken
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
      xhr.onload = () => {
        let body: unknown = null
        try {
          body = JSON.parse(xhr.responseText)
        } catch {
          body = xhr.responseText
        }
        resolve({ status: xhr.status, body })
      }
      xhr.onerror = () => reject(new Error('Error de red al subir el archivo'))
      xhr.send(form)
    })
  let res = await send()
  if (res.status === 401 && (await refreshSession())) res = await send()
  if (res.status >= 400) {
    const b = (res.body ?? {}) as { message?: string | string[]; error?: string }
    throw new ApiError(res.status, Array.isArray(b.message) ? b.message.join(' · ') : (b.message ?? 'No se pudo subir el archivo'), b.error ?? String(res.status))
  }
  return res.body as MediaFile
}
