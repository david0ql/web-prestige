import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'

const RULES = [
  { test: (v: string) => v.length >= 10, label: 'Mínimo 10 caracteres' },
  { test: (v: string) => /[A-Z]/.test(v), label: 'Una mayúscula' },
  { test: (v: string) => /[a-z]/.test(v), label: 'Una minúscula' },
  { test: (v: string) => /\d/.test(v), label: 'Un número' },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: 'Un símbolo' },
]

export const passwordValid = (v: string) => RULES.every((r) => r.test(v))

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-1 text-[12px]">
      {RULES.map((r) => {
        const ok = r.test(value)
        return (
          <li key={r.label} className={cn('flex items-center gap-1.5', ok ? 'text-success' : 'text-ink-muted')}>
            {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />} {r.label}
          </li>
        )
      })}
    </ul>
  )
}
