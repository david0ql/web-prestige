import type { ReactNode } from 'react'
import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'

interface Props {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  /** Código de pantalla de la especificación (P01…P20). */
  code?: string
}

export function PageHeader({ title, description, actions, breadcrumbs, code }: Props) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-1.5" />}
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] leading-tight font-bold tracking-tight text-ink">{title}</h1>
          {code && <span className="rounded-sm border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand-700">{code}</span>}
        </div>
        {description && <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
