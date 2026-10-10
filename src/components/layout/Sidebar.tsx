import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/cn'
import { useUser, isWorkshop } from '@/lib/auth/store'
import { Logo } from './Logo'
import { OFFICE_NAV, WORKSHOP_NAV } from './nav'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const user = useUser()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const sections = (isWorkshop(user) ? WORKSHOP_NAV : OFFICE_NAV)
    .map((s) => ({ ...s, items: s.items.filter((i) => i.perms.some((p) => user?.permissions.includes(p))) }))
    .filter((s) => s.items.length)
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="mb-1.5 px-2 text-[10px] font-bold tracking-[0.16em] text-sidebar-muted uppercase">{s.title}</p>
          <ul className="space-y-0.5">
            {s.items.map((i) => {
              const active = path === i.to || (i.to !== '/taller' && path.startsWith(`${i.to}/`))
              return (
                <li key={i.to}>
                  <Link
                    to={i.to}
                    onClick={onNavigate}
                    data-testid={`nav-${i.to.replace(/\//g, '-').slice(1)}`}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] font-medium text-sidebar-foreground/80 transition-colors',
                      'hover:bg-sidebar-active hover:text-sidebar-foreground',
                      active && 'bg-sidebar-active text-brand-300 shadow-[inset_2px_0_0_var(--color-brand-400)]',
                    )}
                  >
                    <i.icon className={cn('size-4 shrink-0', active ? 'text-brand-400' : 'text-sidebar-muted group-hover:text-sidebar-foreground')} />
                    <span className="flex-1 truncate">{i.label}</span>
                    {i.code && <span className="text-[10px] font-semibold text-sidebar-muted">{i.code}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <Logo />
      </div>
      <SidebarNav />
      <div className="border-t border-sidebar-border px-4 py-3 text-[10px] text-sidebar-muted">
        <p className="display text-[13px] italic text-brand-300/80">“Del material a la excelencia”</p>
        <p className="mt-0.5">Especificación funcional v1.1</p>
      </div>
    </aside>
  )
}
