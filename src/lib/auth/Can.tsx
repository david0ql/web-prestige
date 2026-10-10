import type { ReactNode } from 'react'
import { usePermission } from './store'

/** Renderiza hijos solo si el usuario tiene alguno de los permisos. */
export function Can({ perm, children, fallback = null }: { perm: string | string[]; children: ReactNode; fallback?: ReactNode }) {
  const perms = Array.isArray(perm) ? perm : [perm]
  return usePermission(...perms) ? <>{children}</> : <>{fallback}</>
}
