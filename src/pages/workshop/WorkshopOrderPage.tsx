import { useMemo } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertOctagon, ArrowLeft, CheckCircle2, Clock, Info, Lock, Truck } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { MediaFile, OrderDetail, ProductionStage, TechnicalVariable } from '@/lib/api/types'
import { formatDate, formatGrams, formatNumber, formatPurity } from '@/lib/format'
import { APPROVAL_STATUS, ORDER_STATUS, PRIORITY } from '@/lib/labels'
import { useStages, useVariables } from '@/lib/hooks/useMasters'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { MediaGrid } from '@/components/domain/MediaMosaic'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { CommitmentText, KV, ProgressBar, StepHeader, isWorkStatus } from './components/shared'
import { StagesSection, type OrderStage } from './components/StagesSection'
import { ConsumptionSection, ProgressSection, useMaterialRows } from './components/MaterialSection'
import { FinishedSection } from './components/FinishedSection'
import { RequestForm, DeviationNote } from './components/RequestForm'

const SECTIONS = [
  ['etapas', 'Etapas'],
  ['avance', 'Avance'],
  ['consumos', 'Consumos'],
  ['solicitar', 'Solicitar'],
  ['terminado', 'Terminado'],
  ['ficha', 'Ficha técnica'],
] as const

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/** P09 · Registro de producción y evidencias + P10 · Producto terminado (RF-012…018, CA-004/005). */
export default function WorkshopOrderPage() {
  const { orderId } = useParams({ from: '/app/taller/ordenes/$orderId' })
  const q = useQuery({ queryKey: ['orders', orderId], queryFn: () => api.get<OrderDetail>(`/orders/${orderId}`) })
  const mediaQ = useQuery({ queryKey: ['media', 'order', orderId], queryFn: () => api.get<Paginated<MediaFile>>('/media', { productionOrderId: orderId, pageSize: 200 }) })
  const stagesQ = useStages()
  const varsQ = useVariables()
  const o = q.data
  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/taller/ordenes" className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Mis órdenes
      </Link>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {o && <OrderView o={o} media={mediaQ.data?.items ?? []} catalogStages={stagesQ.data ?? []} allVars={varsQ.data ?? []} />}
      </QueryState>
    </div>
  )
}

function OrderView({ o, media, catalogStages, allVars }: { o: OrderDetail; media: MediaFile[]; catalogStages: ProductionStage[]; allVars: TechnicalVariable[] }) {
  const family = o.product.family?.code
  const editable = isWorkStatus(o.status)
  const rows = useMaterialRows(o)

  // Etapas aplicables: las que trae la orden (con su cumplimiento) o, si no vinieran, el catálogo filtrado por familia.
  const stages: OrderStage[] = useMemo(() => {
    const base = o.stages.length
      ? o.stages
      : catalogStages.filter((s) => s.active && (!s.families.length || s.families.some((f) => f.code === family))).map((s) => ({ ...s, completed: null }))
    return base.slice().sort((a, b) => a.sequence - b.sequence)
  }, [o.stages, catalogStages, family])

  const variables = useMemo(() => allVars.filter((v) => v.active && (!v.families.length || v.families.some((f) => f.code === family))), [allVars, family])
  const done = stages.filter((s) => s.completed).length
  const pct = stages.length ? (done / stages.length) * 100 : 0
  const pendingDispatch = o.dispatches?.find((d) => d.status === 'PENDING_ACCEPTANCE')
  const custodyTotal = o.custody.reduce((s, c) => s + c.balance, 0)
  const sheet = o.technicalSheet
  const timeline = useMemo(() => media.filter((m) => !m.hidden).slice().sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)), [media])
  const byDay = useMemo(() => {
    const g = new Map<string, MediaFile[]>()
    for (const m of timeline) {
      const k = formatDate(m.capturedAt, 'yyyy-MM-dd')
      g.set(k, [...(g.get(k) ?? []), m])
    }
    return [...g.entries()]
  }, [timeline])

  return (
    <>
      <PageHeader
        code="P09"
        title={o.product.name}
        description={`${o.number}${o.variant ? ` · ${o.variant.name}` : ''} · ${o.product.family?.name ?? ''}`}
        actions={
          <>
            <StatusBadge map={ORDER_STATUS} value={o.status} />
            {o.priority !== 'NORMAL' && <StatusBadge map={PRIORITY} value={o.priority} />}
          </>
        }
      />

      {/* Resumen */}
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-border bg-surface p-4 shadow-card lg:grid-cols-4">
        <div>
          <p className="eyebrow">Objetivo</p>
          <p className="text-[18px] font-semibold text-ink tnum">{formatGrams(o.targetGrams, 0)}</p>
          {o.targetUnits ? <p className="text-[12px] text-ink-muted">{formatNumber(o.targetUnits)} unidades</p> : null}
        </div>
        <div>
          <p className="eyebrow">Entrega comprometida</p>
          <CommitmentText order={o} className="mt-1" />
        </div>
        <div>
          <p className="eyebrow">Etapas</p>
          <p className="text-[18px] font-semibold text-ink tnum">{done} / {stages.length}</p>
          <ProgressBar value={pct} className="mt-1" />
        </div>
        <div>
          <p className="eyebrow">En custodia</p>
          <p className="text-[18px] font-semibold text-ink tnum">{formatGrams(custodyTotal)}</p>
          <p className="text-[12px] text-ink-muted">{o.custody.length} material(es)</p>
        </div>
      </div>

      {/* Banners de estado */}
      <div className="mb-4 space-y-3">
        {o.status === 'REJECTED_ADJUSTMENT' && (
          <div className="flex gap-3 rounded-md border border-danger/40 bg-danger-bg p-4 text-danger" data-testid="order-rejected-banner">
            <AlertOctagon className="mt-0.5 size-6 shrink-0" />
            <div className="space-y-1.5 text-[14px]">
              <p className="text-[15px] font-semibold">Prestige Gold devolvió esta orden para ajuste</p>
              <p><strong>Motivo:</strong> {o.rejectionReason ?? 'Sin motivo indicado'}</p>
              <ol className="list-decimal space-y-0.5 pl-5 text-[13px] text-ink-secondary">
                <li>Revisa el motivo y corrige lo indicado (peso, evidencias, consumos o variables).</li>
                <li>Si falta evidencia, súbela en la etapa correspondiente.</li>
                <li>Vuelve a declarar el producto terminado en la sección <button className="font-semibold underline" onClick={() => scrollTo('terminado')}>Terminado</button>.</li>
              </ol>
            </div>
          </div>
        )}
        {o.status === 'DISPATCHED' && (
          <div className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning-bg p-4 text-warning sm:flex-row sm:items-center">
            <Truck className="size-6 shrink-0" />
            <p className="flex-1 text-[14px]"><strong>Primero confirma la entrega de material.</strong> Al aceptarla y firmar el compromiso podrás registrar la producción.</p>
            {pendingDispatch && (
              <Link to="/taller/entregas/$dispatchId" params={{ dispatchId: pendingDispatch.id }}>
                <Button className="w-full sm:w-auto">Confirmar entrega</Button>
              </Link>
            )}
          </div>
        )}
        {['FINISHED_BY_WORKSHOP', 'IN_REVIEW'].includes(o.status) && (
          <div className="flex gap-3 rounded-md border border-info/30 bg-info-bg p-4 text-info">
            <Clock className="mt-0.5 size-5 shrink-0" />
            <p className="text-[14px]"><strong>Producto terminado declarado.</strong> Entrégalo a Oficina Madre; Prestige Gold lo recibirá y revisará. La orden queda en solo lectura.</p>
          </div>
        )}
        {o.status === 'APPROVED_CLOSED' && (
          <div className="flex gap-3 rounded-md border border-success/30 bg-success-bg p-4 text-success">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <p className="text-[14px]"><strong>Orden aprobada y cerrada</strong>{o.closedAt ? ` el ${formatDate(o.closedAt)}` : ''}. Vista de solo lectura.</p>
          </div>
        )}
        {!editable && !['DISPATCHED', 'FINISHED_BY_WORKSHOP', 'IN_REVIEW', 'APPROVED_CLOSED'].includes(o.status) && (
          <div className="flex gap-3 rounded-md border border-border bg-sunken p-4 text-ink-secondary">
            <Lock className="mt-0.5 size-5 shrink-0" />
            <p className="text-[14px]">La orden está en estado «{ORDER_STATUS[o.status]?.label ?? o.status}»: solo lectura.{o.cancellationReason ? ` Motivo: ${o.cancellationReason}` : ''}</p>
          </div>
        )}
      </div>

      {/* Navegación por secciones */}
      <nav className="sticky top-14 z-20 -mx-4 mb-4 flex gap-1.5 overflow-x-auto border-b border-border bg-page/95 px-4 py-2 backdrop-blur lg:top-14 lg:mx-0 lg:rounded-md lg:border lg:px-2" aria-label="Secciones de la orden">
        {SECTIONS.map(([id, l]) => (
          <button key={id} onClick={() => scrollTo(id)} className="h-11 shrink-0 rounded-full border border-border bg-surface px-3.5 text-[13px] font-medium text-ink-secondary hover:border-brand-300 hover:text-ink">
            {l}
          </button>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <section>
            <StepHeader id="etapas" step={1} title="Etapas de fabricación" description="Sube las fotos y videos de cada etapa y márcala como completada." />
            <StagesSection order={o} stages={stages} media={media} editable={editable} onGoFinish={() => scrollTo('terminado')} />
            {timeline.length > 0 && (
              <Card title={`Línea de tiempo de elaboración · ${timeline.length} evidencia(s)`} className="mt-4">
                <div className="space-y-3" data-testid="order-timeline">
                  {byDay.map(([day, items]) => (
                    <div key={day}>
                      <p className="mb-1.5 text-[12px] font-semibold text-ink-muted">{formatDate(day, "EEEE d 'de' MMMM")}</p>
                      <MediaGrid items={items} size="sm" />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </section>

          <section>
            <StepHeader id="avance" step={2} title="Avance parcial" description="Reporta gramos, unidades o porcentaje y tus observaciones." />
            <ProgressSection order={o} stages={stages} editable={editable} />
          </section>

          <section>
            <StepHeader id="consumos" step={3} title="Consumo de materiales" description="Informa cuánto material usaste. Se compara con el estándar y con lo que tienes en custodia." />
            <ConsumptionSection order={o} stages={stages} editable={editable} />
          </section>

          <section>
            <StepHeader id="solicitar" step={4} title="Solicitar material adicional" description="Si te falta material, pídelo aquí. Se valida contra el consumo estándar de la orden." />
            {editable ? (
              <Card>
                <RequestForm order={o} />
              </Card>
            ) : (
              <p className="text-[14px] text-ink-muted">Disponible mientras la orden está en producción.</p>
            )}
            {o.requests.length > 0 && (
              <ul className="mt-3 space-y-2">
                {o.requests.map((r) => (
                  <li key={r.id} className="rounded-md border border-border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-medium text-ink">{r.number} · {r.material?.name ?? 'Material'} · {formatGrams(r.grams)}</p>
                      <StatusBadge map={APPROVAL_STATUS} value={r.status} />
                    </div>
                    <p className="text-[13px] text-ink-secondary">{r.reason}</p>
                    <DeviationNote r={r} className="mt-2" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <StepHeader
              id="terminado"
              step={5}
              title="Producto terminado"
              description="Peso, unidades, variables técnicas del modelo, sobrantes y mano de obra propuesta."
              right={<span className="rounded-sm border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand-700">P10</span>}
            />
            <FinishedSection order={o} stages={stages} media={media} variables={variables} rows={rows} editable={editable} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div id="ficha" className="scroll-mt-28">
            <Card title={`Ficha técnica${sheet ? ` · v${sheet.versionNumber}` : ''}`}>
              {sheet ? (
                <div className="divide-y divide-border">
                  {sheet.standardWeight != null && <KV label="Peso estándar">{formatGrams(sheet.standardWeight)}{sheet.weightTolerance != null ? ` ± ${formatGrams(sheet.weightTolerance)}` : ''}</KV>}
                  {sheet.targetPurity != null && <KV label="Ley objetivo">{formatPurity(sheet.targetPurity)}</KV>}
                  {sheet.diameterMm != null && <KV label="Diámetro">{sheet.diameterMm} mm</KV>}
                  {sheet.lengthMm != null && <KV label="Largo">{sheet.lengthMm} mm</KV>}
                  {sheet.widthMm != null && <KV label="Ancho">{sheet.widthMm} mm</KV>}
                  {sheet.thicknessMm != null && <KV label="Espesor">{sheet.thicknessMm} mm</KV>}
                  {sheet.measures && <KV label="Medidas">{sheet.measures}</KV>}
                  {Object.entries(sheet.variables ?? {}).map(([k, v]) => {
                    const def = allVars.find((x) => x.code === k)
                    return (
                      <KV key={k} label={def?.name ?? k}>
                        {v === true ? 'Sí' : v === false ? 'No' : String(v)}
                        {def?.unit ? ` ${def.unit}` : ''}
                      </KV>
                    )
                  })}
                  {sheet.notes && <p className="pt-2 text-[13px] text-ink-secondary">{sheet.notes}</p>}
                </div>
              ) : (
                <p className="text-[14px] text-ink-muted">El modelo aún no tiene ficha técnica.</p>
              )}
            </Card>
          </div>
          <Card title="Material de la orden">
            {rows.length ? (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.material.id} className="py-2">
                    <p className="text-[14px] font-medium text-ink">{r.material.name}</p>
                    <p className="text-[12px] text-ink-muted tnum">
                      Estándar {r.standard !== null ? formatGrams(r.standard) : '—'} · recibido {formatGrams(r.received)} · custodia {formatGrams(r.custody)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-muted">Sin material.</p>
            )}
          </Card>
          {o.notes && (
            <Card title="Indicaciones de Oficina Madre">
              <p className="flex gap-2 text-[14px] text-ink-secondary"><Info className="mt-0.5 size-4 shrink-0" /> {o.notes}</p>
            </Card>
          )}
          {o.history?.length > 0 && (
            <Card title="Historial de estados">
              <ol className="space-y-1.5">
                {o.history.slice(0, 8).map((h) => (
                  <li key={h.id} className="text-[12px]">
                    <span className={cn('font-medium text-ink')}>{ORDER_STATUS[h.toStatus]?.label ?? h.toStatus}</span>
                    <span className="text-ink-muted"> · {formatDate(h.createdAt, 'd MMM, HH:mm')} · {h.userName}</span>
                    {h.reason && <p className="text-ink-secondary">{h.reason}</p>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}
