import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, KeyRound, LogOut, Menu, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuthStore, useUser, usePermission } from '@/lib/auth/store'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Logo } from './Logo'
import { SidebarNav } from './Sidebar'

export function Topbar() {
  const user = useUser()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canAlerts = usePermission('alerts.read')
  const [mobile, setMobile] = useState(false)
  const { data: counts } = useQuery({
    queryKey: ['alerts', 'counts'],
    queryFn: () => api.get<{ open: number; bySeverity: Record<string, number> }>('/alerts/counts'),
    enabled: canAlerts,
    refetchInterval: 60_000,
  })

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* la sesión pudo haber expirado */
    }
    useAuthStore.getState().clear()
    qc.clear()
    void navigate({ to: '/login' })
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur lg:px-6">
        <button className="rounded-sm p-1.5 text-ink-secondary hover:bg-sunken lg:hidden" aria-label="Abrir menú" onClick={() => setMobile(true)} data-testid="mobile-menu">
          <Menu className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {user?.workshopCode && (
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[12px] font-semibold text-brand-800">Taller {user.workshopCode}</span>
          )}
          <span className="hidden truncate text-[12px] text-ink-muted sm:inline">{user?.roleName}</span>
        </div>
        {canAlerts && (
          <Link to="/alertas" className="relative rounded-sm p-2 text-ink-secondary hover:bg-sunken" aria-label="Alertas" data-testid="alerts-bell">
            <Bell className="size-[18px]" />
            {!!counts?.open && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {counts.open > 99 ? '99+' : counts.open}
              </span>
            )}
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sunken" data-testid="user-menu">
            <Avatar name={user?.fullName ?? '?'} size="sm" />
            <span className="hidden text-[13px] font-medium text-ink md:inline">{user?.fullName}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuItem icon={KeyRound} onSelect={() => void navigate({ to: '/perfil' })}>Cambiar contraseña</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={LogOut} danger onSelect={() => void logout()} data-testid="logout">Cerrar sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[270px] flex-col bg-sidebar animate-slide-in-left">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <Logo />
              <button onClick={() => setMobile(false)} className="text-sidebar-muted" aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobile(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
