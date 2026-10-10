import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSignature, Scale, ShieldCheck, XCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { MaterialDispatch } from '@/lib/api/types'
import { formatDateTime, formatGrams, formatNumber, formatPurity } from '@/lib/format'
import { DISPATCH_STATUS, ORDER_STATUS } from '@/lib/labels'
import { useUser } from '@/lib/auth/store'
import { PageHeader } from '@/components/domain/PageHeader'
import { QueryState } from '@/components/domain/QueryState'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { SignaturePad } from '@/components/domain/SignaturePad'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { FormField } from '@/components/ui/FormField'
import { notify } from '@/components/ui/Toaster'
import { cn } from '@/lib/cn'
import { BIG_BTN, CommitmentText, ErrorPanel, FIELD, KV, StepHeader, num } from './components/shared'

const TOL = 0.005

/** P08 · Confirmación de entrega con firma digital (RF-011, RF-035). */
export default function DispatchConfirmPage() {
  const { dispatchId } = useParams({ from: '/app/taller/entregas/$dispatchId' })
  const q = useQuery({ queryKey: ['dispatches', dispatchId], queryFn: () => api.get<MaterialDispatch>(`/dispatches/${dispatchId}`) })
  const d = q.data
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/taller/entregas" className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Entregas
      </Link>
      <PageHeader
        code="P08"
        title={d ? `Entrega ${d.number}` : 'Confirmación de entrega'}
        description={d?.status === 'PENDING_ACCEPTANCE' ? 'Revisa el material, confirma el peso recibido y firma.' : undefined}
        actions={d && <StatusBadge map={DISPATCH_STATUS} value={d.status} />}
      />
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {d && (d.status === 'PENDING_ACCEPTANCE' ? <ConfirmForm d={d} /> : <Responded d={d} />)}
      </QueryState>
    </div>
  )
}

function OrderSummary({ d }: { d: MaterialDispatch }) {
  const o = d.order
  if (!o) {
    return (
      <Card title="Destino">
        <p className="text-[14px] text-ink-secondary">{d.purpose}</p>
        <p className="mt-1 text-[13px] text-ink-muted">Entrega sin orden asociada (material para custodia del taller).</p>
      </Card>
    )
  }
  return (
    <Card title="Orden y compromiso">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[16px] font-semibold text-ink">{o.product.name}</span>
        <StatusBadge map={ORDER_STATUS} value={o.status} />
      </div>
      <p className="mt-0.5 text-[13px] text-ink-muted">{o.number}{o.variant ? ` · ${o.variant.name}` : ''}</p>
      <div className="mt-2 divide-y divide-border">
        <KV label="Objetivo">{formatGrams(o.targetGrams)}{o.targetUnits ? ` · ${formatNumber(o.targetUnits)} u` : ''}</KV>
        <KV label="Fecha compromiso"><CommitmentText order={o} /></KV>
        {o.notes && <KV label="Indicaciones">{o.notes}</KV>}
      </div>
    </Card>
  )
}

function ConfirmForm({ d }: { d: MaterialDispatch }) {
  const user = useUser()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [received, setReceived] = useState<Record<string, string>>(() => Object.fromEntries(d.lines.map((l) => [l.id, String(l.grams)])))
  const [commitment, setCommitment] = useState(false)
  const [signer, setSigner] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [observations, setObservations] = useState('')
  const [tried, setTried] = useState<'ACCEPT' | 'REJECT' | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)

  useEffect(() => {
    if (user?.fullName) setSigner((s) => s || user.fullName)
  }, [user?.fullName])

  const diffs = useMemo(
    () =>
      d.lines.map((l) => {
        const r = num(received[l.id] ?? '')
        return { line: l, received: r, diff: r === undefined ? 0 : r - l.grams }
      }),
    [d.lines, received],
  )
  const hasDiff = diffs.some((x) => Math.abs(x.diff) > TOL)
  const invalidLine = diffs.some((x) => x.received === undefined || x.received < 0)
  const needsCommitment = !!d.order

  const m = useMutation({
    meta: { silent: true },
    mutationFn: (decision: 'ACCEPT' | 'REJECT') =>
      api.post<MaterialDispatch>(`/dispatches/${d.id}/respond`, {
        decision,
        lines: decision === 'ACCEPT' ? diffs.map((x) => ({ lineId: x.line.id, receivedGrams: x.received ?? 0 })) : undefined,
        signerName: signer.trim(),
        signatureImage: signature ?? undefined,
        observations: observations.trim() || undefined,
        acceptCommitment: decision === 'ACCEPT' ? commitment : false,
      }),
    onSuccess: (_r, decision) => {
      notify.success(decision === 'ACCEPT' ? 'Entrega confirmada y firmada' : 'Entrega rechazada; el material regresa a Oficina Madre')
      void qc.invalidateQueries({ queryKey: ['dispatches'] })
      void qc.invalidateQueries({ queryKey: ['workshop-portal'] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
      setConfirmReject(false)
      if (decision === 'ACCEPT' && d.orderId) void navigate({ to: '/taller/ordenes/$orderId', params: { orderId: d.orderId } })
    },
    onError: () => setConfirmReject(false),
  })

  const signerErr = tried && signer.trim().length < 3 ? 'Escribe el nombre completo de quien firma' : undefined
  const signatureErr = tried === 'ACCEPT' && !signature ? 'La firma es obligatoria para aceptar' : undefined
  const commitmentErr = tried === 'ACCEPT' && needsCommitment && !commitment
  const obsErr = tried === 'REJECT' && observations.trim().length < 3 ? 'Para rechazar debes explicar el motivo' : undefined

  const accept = () => {
    setTried('ACCEPT')
    if (invalidLine || signer.trim().length < 3 || !signature || (needsCommitment && !commitment)) {
      notify.error('Revisa los campos marcados antes de aceptar')
      return
    }
    m.mutate('ACCEPT')
  }
  const reject = () => {
    setTried('REJECT')
    if (observations.trim().length < 3 || signer.trim().length < 3) {
      notify.error('Indica el motivo del rechazo y el nombre de quien firma')
      document.querySelector<HTMLTextAreaElement>('[data-testid=confirm-observations]')?.focus()
      return
    }
    setConfirmReject(true)
  }

  return (
    <div className="space-y-5">
      <section>
        <StepHeader step={1} title="Material recibido" description={`Enviado por ${d.responsible?.fullName ?? 'Oficina Madre'} el ${formatDateTime(d.createdAt)}. Pesa el material y confirma el peso que recibiste.`} />
        <div className="space-y-3">
          {diffs.map(({ line: l, received: r, diff }, i) => (
            <div key={l.id} className={cn('rounded-md border bg-surface p-4 shadow-card', Math.abs(diff) > TOL ? 'border-warning/60' : 'border-border')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[16px] font-semibold text-ink">{l.material.name}</p>
                  <p className="text-[13px] text-ink-muted">
                    {l.material.code}
                    {l.material.purity ? ` · ley ${formatPurity(l.material.purity)}` : ''}
                    {l.lot ? ` · lote ${l.lot.code}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="eyebrow">Peso despachado</p>
                  <p className="text-[20px] font-semibold text-ink tnum">{formatGrams(l.grams)}</p>
                  {l.weighing && <p className="text-[11px] text-ink-muted"><Scale className="mr-1 inline size-3" />{l.weighing.number}</p>}
                </div>
              </div>
              <FormField label="Peso recibido (g)" required className="mt-3" error={tried && (r === undefined || r < 0) ? 'Indica un peso válido' : undefined}>
                <Input
                  data-testid={`confirm-received-${i}`}
                  inputMode="decimal"
                  value={received[l.id] ?? ''}
                  onChange={(e) => setReceived((s) => ({ ...s, [l.id]: e.target.value }))}
                  className={cn(FIELD, 'tnum font-semibold')}
                />
              </FormField>
              {Math.abs(diff) > TOL && (
                <p className="mt-2 flex items-start gap-1.5 text-[13px] text-warning" data-testid={`confirm-diff-${i}`}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Diferencia de {diff > 0 ? '+' : ''}{formatGrams(diff)} frente a lo despachado. Se registrará una diferencia que Prestige Gold deberá aprobar.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <StepHeader step={2} title="Compromiso de producción" />
        <div className="space-y-3">
          <OrderSummary d={d} />
          {needsCommitment && (
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors',
                commitment ? 'border-brand-400 bg-brand-50' : commitmentErr ? 'border-danger bg-danger-bg' : 'border-border bg-surface',
              )}
            >
              <input
                type="checkbox"
                data-testid="confirm-commitment"
                checked={commitment}
                onChange={(e) => setCommitment(e.target.checked)}
                className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[#a9822c]"
              />
              <span className="text-[15px] text-ink">
                <strong>Acepto el compromiso de producción y la fecha de entrega.</strong>
                <span className="mt-0.5 block text-[13px] text-ink-muted">Me comprometo a producir lo indicado en la orden y entregarlo en la fecha acordada.</span>
              </span>
            </label>
          )}
        </div>
      </section>

      <section>
        <StepHeader step={3} title="Firma digital" description="Queda registrada con tu usuario, la fecha y una huella del contenido aceptado." />
        <Card>
          <div className="space-y-4">
            <FormField label="Nombre de quien firma" required error={signerErr}>
              <Input data-testid="confirm-signer" value={signer} onChange={(e) => setSigner(e.target.value)} className={FIELD} autoComplete="name" />
            </FormField>
            <div>
              <p className="eyebrow mb-1.5">Firma <span className="text-danger">*</span></p>
              <SignaturePad onChange={setSignature} />
              {signatureErr && <p className="text-[12px] text-danger" role="alert">{signatureErr}</p>}
            </div>
            <FormField label="Observaciones" hint="Obligatorias si rechazas la entrega o si el peso no coincide." error={obsErr}>
              <Textarea data-testid="confirm-observations" rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} className="text-[16px] sm:text-[14px]" placeholder="Ej.: el paquete llegó con 0,05 g menos" />
            </FormField>
          </div>
        </Card>
      </section>

      <ErrorPanel error={m.error} testId="confirm-error" />

      {hasDiff && (
        <div className="flex gap-2 rounded-md border border-warning/40 bg-warning-bg p-3 text-[14px] text-warning">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <span>Declaraste un peso diferente al despachado. Al aceptar se generará una <strong>diferencia a aprobar por Prestige Gold</strong>.</span>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-page/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="secondary" data-testid="confirm-reject" onClick={reject} disabled={m.isPending} className={cn(BIG_BTN, 'text-danger')}>
          <XCircle className="size-5" /> Rechazar entrega
        </Button>
        <Button data-testid="confirm-accept" onClick={accept} loading={m.isPending && m.variables === 'ACCEPT'} className={BIG_BTN}>
          <FileSignature className="size-5" /> Aceptar y firmar
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title="¿Rechazar esta entrega?"
        confirmLabel="Rechazar entrega"
        danger
        loading={m.isPending}
        onConfirm={() => m.mutate('REJECT')}
      >
        El material quedará devuelto a Oficina Madre y la entrega no se podrá volver a confirmar. Motivo: «{observations.trim()}».
      </ConfirmDialog>
    </div>
  )
}

function Responded({ d }: { d: MaterialDispatch }) {
  const a = d.acceptance
  const accepted = d.status !== 'REJECTED'
  return (
    <div className="space-y-4">
      <div className={cn('flex items-start gap-3 rounded-md border p-4', accepted ? 'border-success/30 bg-success-bg text-success' : 'border-danger/30 bg-danger-bg text-danger')}>
        {accepted ? <CheckCircle2 className="size-6 shrink-0" /> : <XCircle className="size-6 shrink-0" />}
        <div>
          <p className="text-[15px] font-semibold">{accepted ? 'Entrega confirmada' : 'Entrega rechazada'}</p>
          <p className="text-[13px]">Respondida el {formatDateTime(d.respondedAt ?? a?.signedAt)}{a ? ` por ${a.signerName}` : ''}.</p>
        </div>
      </div>
      <Card title="Material">
        <ul className="divide-y divide-border">
          {d.lines.map((l) => {
            const diff = l.receivedGrams === null ? 0 : l.receivedGrams - l.grams
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-[14px] font-medium text-ink">{l.material.name}</p>
                  <p className="text-[12px] text-ink-muted">Despachado {formatGrams(l.grams)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-semibold text-ink tnum">{l.receivedGrams === null ? '—' : formatGrams(l.receivedGrams)}</p>
                  <p className={cn('text-[12px]', Math.abs(diff) > TOL ? 'text-warning' : 'text-ink-muted')}>
                    {l.receivedGrams === null ? 'No recibido' : Math.abs(diff) > TOL ? `Diferencia ${diff > 0 ? '+' : ''}${formatGrams(diff)}` : 'Recibido conforme'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
      <OrderSummary d={d} />
      {a && (
        <Card title="Evidencia de aceptación">
          <div className="divide-y divide-border">
            <KV label="Firmante">{a.signerName}</KV>
            <KV label="Fecha">{formatDateTime(a.signedAt)}</KV>
            {(a.observations ?? d.workshopObservations) && <KV label="Observaciones">{a.observations ?? d.workshopObservations}</KV>}
          </div>
          {a.signatureImage && <img src={a.signatureImage} alt="Firma" className="mt-3 h-28 rounded-md border border-border bg-white object-contain" />}
          <p className="mt-2 flex items-center gap-1.5 text-[11px] break-all text-ink-muted">
            <ShieldCheck className="size-3.5 shrink-0" /> Huella {a.payloadHash}
          </p>
        </Card>
      )}
      {accepted && d.orderId && (
        <Link to="/taller/ordenes/$orderId" params={{ orderId: d.orderId }} className="block">
          <Button className={cn(BIG_BTN, 'w-full sm:w-auto')}>Ir a la orden y registrar producción</Button>
        </Link>
      )}
    </div>
  )
}
