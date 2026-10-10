import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ClipboardList, Factory, FilePlus2, History, Images, Ruler } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { ProductionOrder } from '@/lib/api/types'
import { usePermission } from '@/lib/auth/store'
import { formatDate, formatDateTime, formatGrams, formatNumber, formatPercent, formatPurity } from '@/lib/format'
import { ORDER_STATUS, STANDARD_BASIS } from '@/lib/labels'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { MediaGrid } from '@/components/domain/MediaMosaic'
import { MediaUploader } from '@/components/domain/MediaUploader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtVal, type CatalogDetail, type Sheet } from './components/sheet'
import { SheetFormModal } from './components/SheetFormModal'
import { VersionHistory } from './components/VersionHistory'

/** P19 · Ficha técnica de un modelo (RF-042, RN-023, CA-015). */
export default function CatalogDetailPage() {
  const { productId } = useParams({ from: '/app/catalogo/$productId' })
  const qc = useQueryClient()
  const canManage = usePermission('catalog.manage')
  const canUpload = usePermission('media.upload')
  const canOrders = usePermission('orders.read')
  const q = useQuery({ queryKey: ['catalog', 'detail', productId], queryFn: () => api.get<CatalogDetail>(`/catalog/products/${productId}`) })
  const orders = useQuery({
    queryKey: ['orders', 'by-product', productId],
    queryFn: () => api.get<Paginated<ProductionOrder>>('/orders', { productId, pageSize: 8 }),
    enabled: canOrders,
  })
  const [newVersion, setNewVersion] = useState(false)
  const d = q.data
  const p = d?.product
  const s = d?.currentSheet

  return (
    <div>
      <PageHeader
        code="P19"
        breadcrumbs={[{ label: 'Catálogo técnico', to: '/catalogo' }, { label: p?.code ?? '…' }]}
        title={p ? p.name : 'Ficha técnica'}
        description={p ? `${p.code} · ${p.family?.name ?? ''}${s ? ` · versión vigente v${s.versionNumber} del ${formatDate(s.createdAt)}` : ''}` : undefined}
        actions={
          canManage && p ? (
            <Button data-testid="sheet-new-version" onClick={() => setNewVersion(true)}><FilePlus2 className="size-4" /> Nueva versión</Button>
          ) : undefined
        }
      />
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {d && p && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-5">
              <Card title="Fotografías del modelo" actions={<span className="flex items-center gap-1 text-[12px] text-ink-muted"><Images className="size-3.5" /> {d.photos.length}</span>}>
                <div className="space-y-3" data-testid="catalog-photos">
                  <MediaGrid items={d.photos} emptyText="Aún no hay fotografías de catálogo para este modelo." />
                  {canManage && canUpload && (
                    <MediaUploader
                      testId="catalog-uploader"
                      accept="image/*"
                      label="Agregar fotografías de catálogo"
                      hint={s ? `Quedan asociadas al modelo y a la ficha v${s.versionNumber}` : 'Quedan asociadas al modelo'}
                      compact={d.photos.length > 0}
                      fields={{ purpose: 'CATALOG', productId: p.id, technicalSheetId: s?.id }}
                      onUploaded={() => void qc.invalidateQueries({ queryKey: ['catalog'] })}
                    />
                  )}
                </div>
              </Card>

              <Card title={s ? `Ficha técnica vigente · v${s.versionNumber}` : 'Ficha técnica'}>
                {s ? <CurrentSheet sheet={s} detail={d} /> : (
                  <EmptyState icon={Ruler} title="Sin ficha técnica" description="Cree la primera versión con el botón “Nueva versión”." />
                )}
              </Card>

              <Card title="Historial de versiones" actions={<span className="flex items-center gap-1 text-[12px] text-ink-muted"><History className="size-3.5" /> {d.versions.length} versiones · inmutables</span>}>
                <VersionHistory key={p.currentSheetVersion} versions={d.versions} variables={d.variables} photos={d.photos} currentVersion={p.currentSheetVersion} />
              </Card>
            </div>

            <div className="space-y-5">
              <Card title="Producto">
                <dl className="space-y-2 text-[13px]">
                  <Row label="Familia">{p.family?.name ?? '—'}</Row>
                  <Row label="Ley objetivo">{p.targetPurity !== null ? `${formatPurity(p.targetPurity)}${p.purityTolerance !== null ? ` ± ${formatNumber(p.purityTolerance, 1)}` : ''}` : '—'}</Row>
                  <Row label="Merma tolerada">{formatPercent(p.lossTolerancePct)}</Row>
                  <Row label="Controles">
                    <span className="flex flex-wrap justify-end gap-1">
                      {p.requiresPurityCheck && <Badge variant="gold">Ley/pureza</Badge>}
                      {p.requiresQualityCheck && <Badge variant="info">Calidad</Badge>}
                      {!p.requiresPurityCheck && !p.requiresQualityCheck && '—'}
                    </span>
                  </Row>
                  {p.outputMaterial && <Row label="Material de salida">{p.outputMaterial.name}</Row>}
                  <Row label="Estado"><Badge variant={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</Badge></Row>
                </dl>
              </Card>

              <Card title={`Variantes (${p.variants?.length ?? 0})`}>
                {p.variants?.length ? (
                  <ul className="divide-y divide-border text-[13px]">
                    {p.variants.map((v) => (
                      <li key={v.id} className="flex items-center justify-between py-1.5">
                        <span><span className="font-mono text-[12px] font-semibold">{v.code}</span> {v.name}</span>
                        <span className="text-ink-muted tnum">{v.standardWeight !== null ? formatGrams(v.standardWeight, 3) : '—'}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-[12px] text-ink-muted">Sin variantes.</p>}
              </Card>

              <Card title="Talleres habilitados">
                {p.workshops?.filter((w) => w.enabled).length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {p.workshops.filter((w) => w.enabled).map((w) => (
                      <li key={w.id}><Badge variant="info"><Factory className="size-3" /> {w.workshop.code} · {w.workshop.name}</Badge></li>
                    ))}
                  </ul>
                ) : <p className="text-[12px] text-ink-muted">Ningún taller habilitado.</p>}
              </Card>

              <Card title="Estándares de consumo">
                {p.standards?.filter((x) => x.active).length ? (
                  <ul className="space-y-1.5 text-[13px]">
                    {p.standards.filter((x) => x.active).map((st) => (
                      <li key={st.id} className="flex items-start justify-between gap-2">
                        <span>
                          {st.material.name}
                          <span className="block text-[11px] text-ink-muted">{STANDARD_BASIS[st.basis]}{st.variant ? ` · ${st.variant.name}` : ''} · tol. {formatPercent(st.tolerancePct)}</span>
                        </span>
                        <span className="font-semibold tnum">{formatNumber(st.quantity, 4)} g{st.basis === 'PER_LOT' && st.lotSizeGrams ? ` / ${formatGrams(st.lotSizeGrams, 0)}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-[12px] text-ink-muted">Sin estándares configurados.</p>}
              </Card>

              {canOrders && (
                <Card title="Órdenes del modelo" actions={<Link to="/ordenes" search={{ productId }} className="text-[12px] font-medium text-brand-700 hover:underline">Ver todas</Link>}>
                  {orders.data?.items.length ? (
                    <ul className="divide-y divide-border text-[13px]" data-testid="catalog-orders">
                      {orders.data.items.map((o) => (
                        <li key={o.id}>
                          <Link to="/ordenes/$orderId" params={{ orderId: o.id }} className="flex items-center justify-between gap-2 py-1.5 hover:text-brand-800">
                            <span>
                              <span className="font-mono text-[12px] font-semibold">{o.number}</span>
                              <span className="block text-[11px] text-ink-muted">{o.workshop?.code} · {formatGrams(o.targetGrams, 0)} · ficha v{o.technicalSheet?.versionNumber ?? '—'}</span>
                            </span>
                            <StatusBadge map={ORDER_STATUS} value={o.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="flex items-center gap-1.5 text-[12px] text-ink-muted"><ClipboardList className="size-3.5" /> {orders.isLoading ? 'Cargando…' : 'Sin órdenes de este modelo.'}</p>}
                </Card>
              )}
            </div>
          </div>
        )}
      </QueryState>
      {newVersion && d && p && (
        <SheetFormModal product={p} current={d.currentSheet} variables={d.variables} onClose={() => setNewVersion(false)} onCreated={() => undefined} />
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  )
}

function CurrentSheet({ sheet: s, detail: d }: { sheet: Sheet; detail: CatalogDetail }) {
  const tiles: { label: string; value: string; hint?: string; accent?: boolean }[] = [
    { label: 'Peso estándar', value: s.standardWeight !== null ? formatGrams(s.standardWeight, 2) : '—', hint: s.weightTolerance !== null ? `± ${formatNumber(s.weightTolerance, 3)} g` : undefined, accent: true },
    { label: 'Ley objetivo', value: s.targetPurity !== null ? formatPurity(s.targetPurity) : '—', hint: s.purityTolerance !== null ? `± ${formatNumber(s.purityTolerance, 1)} ‰` : undefined, accent: true },
    { label: 'Diámetro', value: fmtVal(s.diameterMm, 'mm') },
    { label: 'Largo', value: fmtVal(s.lengthMm, 'mm') },
    { label: 'Ancho', value: fmtVal(s.widthMm, 'mm') },
    { label: 'Espesor', value: fmtVal(s.thicknessMm, 'mm') },
  ]
  const defs = d.variables
  const extraCodes = Object.keys(s.variables ?? {}).filter((c) => !defs.some((v) => v.code === c))
  return (
    <div className="space-y-4" data-testid="current-sheet">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className={t.accent ? 'rounded-md border border-brand-200 bg-brand-50/60 px-3 py-2' : 'rounded-md border border-border px-3 py-2'}>
            <p className="eyebrow">{t.label}</p>
            <p className="text-[17px] font-semibold text-ink tnum">{t.value}</p>
            {t.hint && <p className="text-[12px] text-ink-muted tnum">{t.hint}</p>}
          </div>
        ))}
      </div>
      {s.measures && <p className="text-[13px]"><span className="eyebrow mr-2">Medidas</span>{s.measures}</p>}
      <div>
        <h3 className="eyebrow mb-1.5">Variables técnicas</h3>
        {defs.length === 0 && extraCodes.length === 0 ? (
          <p className="text-[12px] text-ink-muted">No hay variables técnicas definidas para esta familia.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {defs.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b border-border/70 py-1.5 text-[13px]">
                <dt className="text-ink-secondary">{v.name}{v.requiredOnFinish && <span className="ml-1 text-[10px] text-warning" title="Requerida al terminar">●</span>}</dt>
                <dd className="font-medium text-ink tnum">{fmtVal(s.variables?.[v.code], v.unit ?? undefined, 3)}</dd>
              </div>
            ))}
            {extraCodes.map((c) => (
              <div key={c} className="flex items-center justify-between border-b border-border/70 py-1.5 text-[13px]">
                <dt className="text-ink-muted">{c} <span className="text-[11px]">(retirada)</span></dt>
                <dd className="font-medium tnum">{fmtVal(s.variables[c])}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {s.notes && <p className="rounded-md bg-sunken/60 px-3 py-2 text-[13px] text-ink-secondary">{s.notes}</p>}
      <p className="text-[12px] text-ink-muted">
        Motivo: {s.changeReason ?? '—'} · {s.createdBy?.fullName ?? 'Sistema'} · {formatDateTime(s.createdAt)}
      </p>
    </div>
  )
}
