import { cn } from '@/lib/cn'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** Paleta apagada para avatares (determinística por nombre). */
const AVATAR_HUES = [
  '#4A5B78', // azul pizarra
  '#5B6B8C', // azul apagado
  '#6E5F84', // ciruela apagado
  '#4F6E78', // azul verdoso
  '#5A6E63', // salvia
  '#7A6357', // arena
  '#54627E', // azul acero suave
  '#66566B', // malva apagado
]

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

const sizes = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-[12px]',
  lg: 'size-10 text-[14px]',
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const hue = AVATAR_HUES[hashName(name) % AVATAR_HUES.length]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: hue }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  )
}
