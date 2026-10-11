import { create } from 'zustand'

export interface AuthUser {
  id: string
  username: string
  fullName: string
  email: string
  roleCode: string
  roleName: string
  workshopId: string | null
  workshopCode: string | null
  permissions: string[]
  /** Contraseña inicial o restablecida: debe cambiarla antes de operar. */
  mustChangePassword?: boolean
  sessionId: string
}

interface AuthState {
  /** El access token vive SOLO en memoria (nunca en localStorage: mitiga XSS). */
  accessToken: string | null
  user: AuthUser | null
  ready: boolean
  setSession: (token: string, user: AuthUser) => void
  setUser: (user: AuthUser) => void
  clear: () => void
  setReady: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  ready: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null }),
  setReady: () => set({ ready: true }),
}))

export const useUser = () => useAuthStore((s) => s.user)

export function hasPermission(user: AuthUser | null, ...perms: string[]) {
  return !!user && perms.some((p) => user.permissions.includes(p))
}

export const usePermission = (...perms: string[]) => {
  const user = useUser()
  return hasPermission(user, ...perms)
}

export const isWorkshop = (user: AuthUser | null) => !!user?.workshopId
