import { useAuthStore } from '@/lib/auth/store'

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Error normalizado de la API: código estable de regla de negocio + detalles. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown
  constructor(status: number, message: string, code: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const GENERIC: Record<number, string> = {
  400: 'Solicitud inválida.',
  401: 'Tu sesión expiró. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'El registro no existe o no tienes acceso.',
  409: 'La operación entra en conflicto con el estado actual.',
  422: 'La operación no cumple una regla de negocio.',
  429: 'Demasiadas solicitudes. Espera un momento.',
  500: 'Error en el servidor. Intenta de nuevo.',
}

type Params = Record<string, string | number | boolean | null | undefined | string[]>

export function buildUrl(path: string, params?: Params) {
  const url = path.startsWith('/api') ? path : `/api${path}`
  if (!params) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
    else qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `${url}?${q}` : url
}

async function parse(res: Response) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

let refreshing: Promise<boolean> | null = null
/** Renovación single-flight del access token con la cookie httpOnly. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!res.ok) {
        useAuthStore.getState().clear()
        return false
      }
      const body = await res.json()
      useAuthStore.getState().setSession(body.accessToken, body.user)
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

async function request<T>(method: Method, path: string, body?: unknown, params?: Params, raw = false): Promise<T> {
  const doFetch = () => {
    const token = useAuthStore.getState().accessToken
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' }
    if (token) headers.Authorization = `Bearer ${token}`
    const isForm = body instanceof FormData
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
    return fetch(buildUrl(path, params), {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  }
  let res = await doFetch()
  if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    if (await refreshSession()) res = await doFetch()
  }
  if (raw && res.ok) return res as unknown as T
  const data = await parse(res)
  if (!res.ok) {
    const b = (data ?? {}) as { message?: string | string[]; error?: string; details?: unknown }
    const msg = Array.isArray(b.message) ? b.message.join(' · ') : (b.message ?? GENERIC[res.status] ?? 'Error inesperado')
    if (res.status === 401 && !path.includes('/auth/')) useAuthStore.getState().clear()
    throw new ApiError(res.status, msg, b.error ?? String(res.status), b.details)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, undefined, params),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
  /** Descarga binaria autenticada (exportaciones Excel/CSV). */
  async download(path: string, params: Params, fallbackName: string) {
    const res = await request<Response>('GET', path, undefined, params, true)
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') ?? ''
    const name = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? fallbackName
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  },
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')
