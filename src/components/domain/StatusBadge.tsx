import { Badge } from '@/components/ui/Badge'
import { label, variant } from '@/lib/labels'

type Map = Parameters<typeof label>[0]

export function StatusBadge({ map, value, className }: { map: Map; value: string | null | undefined; className?: string }) {
  return (
    <Badge variant={variant(map, value)} className={className}>
      {label(map, value)}
    </Badge>
  )
}
