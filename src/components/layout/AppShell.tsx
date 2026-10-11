import { Outlet } from '@tanstack/react-router'
import { useUser } from '@/lib/auth/store'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const user = useUser()
  // Mientras deba cambiar la contraseña: solo la pantalla de perfil, sin menú ni consultas.
  if (user?.mustChangePassword)
    return (
      <main className="mx-auto min-h-dvh w-full max-w-3xl bg-page px-4 py-8">
        <Outlet />
      </main>
    )
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 lg:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
