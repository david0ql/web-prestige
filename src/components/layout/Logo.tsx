import { cn } from '@/lib/cn'

/** Marca Prestige Gold (corona + wordmark serif). */
export function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0dba0" />
          <stop offset="0.5" stopColor="#c9a24c" />
          <stop offset="1" stopColor="#8d6b22" />
        </linearGradient>
      </defs>
      <path d="M6 36 L10 10 L22 24 L32 4 L42 24 L54 10 L58 36 Z" fill="url(#pg-gold)" />
      <circle cx="10" cy="9" r="3" fill="url(#pg-gold)" />
      <circle cx="32" cy="4" r="3" fill="url(#pg-gold)" />
      <circle cx="54" cy="9" r="3" fill="url(#pg-gold)" />
      <rect x="6" y="39" width="52" height="6" rx="2" fill="url(#pg-gold)" />
    </svg>
  )
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Crown className="h-7 w-9 shrink-0" />
      {!compact && (
        <div className="leading-none">
          <p className="display gold-text text-[21px] tracking-wide">PRESTIGE GOLD</p>
          <p className="mt-0.5 text-[8.5px] font-semibold tracking-[0.12em] whitespace-nowrap text-sidebar-muted uppercase">Sistema de gestión integral</p>
        </div>
      )}
    </div>
  )
}
