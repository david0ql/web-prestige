import type { ReactNode } from 'react'
import { Boxes, Factory, ScanLine, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import { Crown } from '@/components/layout/Logo'

const FEATURES = [
  { icon: ScanLine, label: 'Trazabilidad por gramo' },
  { icon: Factory, label: 'Control de talleres' },
  { icon: Boxes, label: 'Inventario y custodias' },
  { icon: Sparkles, label: 'Ley y calidad verificadas' },
  { icon: Wallet, label: 'Finanzas y rentabilidad' },
  { icon: ShieldCheck, label: 'Auditoría completa' },
]

/** P01 · Marco visual de acceso: panel de marca + formulario. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-brand-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 size-[460px] rounded-full bg-brand-700/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Crown className="h-10 w-14" />
          <div>
            <p className="display gold-text text-[30px] leading-none tracking-wide">PRESTIGE GOLD</p>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.3em] text-sidebar-muted uppercase">Sistema de gestión integral</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <p className="display text-[44px] leading-[1.05] text-sidebar-foreground">
            Un negocio, un sistema,
            <br />
            <span className="gold-text italic">todo bajo control.</span>
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-sidebar-muted">
            Cada gramo, cada entrega, cada evidencia y cada verificación de ley se explica desde su origen hasta su resultado final.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-2/60 px-3 py-2.5 text-[13px] text-sidebar-foreground/85">
                <f.icon className="size-4 text-brand-400" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="display relative text-[15px] italic text-brand-300/70">“Control de hoy, crecimiento mañana”</p>
      </section>
      <section className="flex items-center justify-center bg-page px-5 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Crown className="h-12 w-16" />
            <p className="display mt-2 text-[28px] tracking-wide text-brand-700">PRESTIGE GOLD</p>
          </div>
          {children}
        </div>
      </section>
    </div>
  )
}
