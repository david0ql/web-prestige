import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Camera, Film } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { OrderDetail, Story } from '@/lib/api/types'
import { QueryState } from '@/components/domain/QueryState'
import { MediaGrid } from '@/components/domain/MediaMosaic'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function EvidenceTab({ o }: { o: OrderDetail }) {
  const q = useQuery({ queryKey: ['orders', 'story', o.id], queryFn: () => api.get<Story>(`/orders/${o.id}/story`) })
  const s = q.data
  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
      {s && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
              <Camera className="size-4 text-brand-600" /> <b className="text-ink tnum">{s.totals.photos}</b> fotos
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
              <Film className="size-4 text-brand-600" /> <b className="text-ink tnum">{s.totals.videos}</b> videos
            </span>
            <span className="text-[12px] text-ink-muted">Organizadas por etapa de fabricación (CA-016)</span>
            <Link to="/ordenes/$orderId/historia" params={{ orderId: o.id }} className="ml-auto">
              <Button variant="secondary" size="sm" data-testid="evidence-story-link">
                Ver historia visual completa <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {s.groups.map((g) => (
              <Card
                key={g.stage.id}
                title={`${g.stage.sequence < 999 ? `${g.stage.sequence}. ` : ''}${g.stage.name}`}
                actions={
                  <div className="flex gap-1">
                    {g.stage.mandatory && <Badge variant="neutral">Obligatoria</Badge>}
                    <Badge variant={g.items.length ? 'success' : 'warning'}>{g.items.length} archivo(s)</Badge>
                  </div>
                }
              >
                <MediaGrid items={g.items} size="sm" emptyText={g.stage.requiresPhoto || g.stage.requiresVideo ? 'Pendiente de evidencia obligatoria' : 'Sin evidencias'} />
              </Card>
            ))}
          </div>
        </div>
      )}
    </QueryState>
  )
}
