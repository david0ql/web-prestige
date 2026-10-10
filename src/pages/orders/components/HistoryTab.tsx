import { ArrowRight } from 'lucide-react'
import type { OrderDetail } from '@/lib/api/types'
import { ORDER_STATUS } from '@/lib/labels'
import { formatDateTime } from '@/lib/format'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'

/** Historial de estados con usuario, motivo y fecha (RF-036). */
export function HistoryTab({ o }: { o: OrderDetail }) {
  const items = [...o.history].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <Card title="Historial de estados">
      <ol className="relative space-y-0" data-testid="order-history">
        {items.map((h, i) => (
          <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" />}
            <Avatar name={h.userName} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {h.fromStatus && (
                  <>
                    <StatusBadge map={ORDER_STATUS} value={h.fromStatus} />
                    <ArrowRight className="size-3.5 text-ink-muted" />
                  </>
                )}
                <StatusBadge map={ORDER_STATUS} value={h.toStatus} />
                <span className="ml-auto text-[12px] text-ink-muted tnum">{formatDateTime(h.createdAt)}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink">
                <span className="font-medium">{h.userName}</span>
                {h.reason ? <span className="text-ink-secondary"> · {h.reason}</span> : null}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
