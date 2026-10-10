import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Factory, MapPin, Plus } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { LaborRate, Location, Workshop } from '@/lib/api/types'
import { useProducts, useWorkshops } from '@/lib/hooks/useMasters'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatDate, formatMoney } from '@/lib/format'
import { LABOR_BASIS } from '@/lib/labels'
import { DataTable } from '@/components/domain/DataTable'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { SearchInput } from '@/components/ui/SearchInput'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { notify } from '@/components/ui/Toaster'
import { ActiveBadge, FormGrid, Muted, SectionBar, STATUS_OPTIONS, compact, mono, numStr, strOrNull, toNum, useFormState, useSave } from './shared'

const CODE_RE = /^[A-Z0-9_-]{1,20}$/

/** Talleres (RF-037, RN-018, CA-012) + tarifas de mano de obra por taller. */
export function WorkshopsTab() {
  const [search, setSearch] = useState('')
  const q = useDebounced(search, 300)
  const list = useQuery({ queryKey: ['workshops', 'admin', q], queryFn: () => api.get<Paginated<Workshop>>('/workshops', { pageSize: 200, search: q }) })
  const [editing, setEditing] = useState<Workshop | 'new' | null>(null)
  const [created, setCreated] = useState<{ code: string; name: string; location?: string } | null>(null)

  return (
    <div className="space-y-5">
      {created && (
        <div data-testid="workshop-created" className="flex items-start gap-3 rounded-md border border-success/30 bg-success-bg px-4 py-3 text-[13px]">
          <MapPin className="mt-0.5 size-4 text-success" />
          <div className="flex-1">
            <p className="font-semibold text-success">Taller {created.code} · {created.name} creado</p>
            <p className="text-ink-secondary">
              Se generó automáticamente su ubicación de custodia <span className={mono}>{created.location ?? `TALLER-${created.code}`}</span>. Ya puede recibir despachos y asignarse a usuarios de taller.
            </p>
          </div>
          <button className="text-[12px] text-ink-muted hover:text-ink" onClick={() => setCreated(null)}>Cerrar</button>
        </div>
      )}
      <Card flush>
        <SectionBar
          title="Talleres"
          description="Agregue talleres sin desarrollo adicional: cada taller nuevo obtiene su ubicación de custodia y solo verá su información."
          actions={<Button data-testid="workshop-new" onClick={() => setEditing('new')}><Plus className="size-4" /> Nuevo taller</Button>}
        >
          <SearchInput value={search} onValueChange={setSearch} placeholder="Buscar código o nombre" className="w-60" />
        </SectionBar>
        <DataTable
          testId="workshops-table"
          loading={list.isLoading}
          rows={list.data?.items}
          rowKey={(w) => w.id}
          onRowClick={(w) => setEditing(w)}
          empty={{ title: 'Sin talleres', description: 'Cree el primer taller con el botón “Nuevo taller”.' }}
          columns={[
            { key: 'code', header: 'Código', cell: (w) => <span className={mono}>{w.code}</span> },
            { key: 'name', header: 'Taller', cell: (w) => <span className="font-medium">{w.name}</span> },
            { key: 'resp', header: 'Responsable', cell: (w) => w.responsible ?? <Muted>—</Muted>, hideOnMobile: true },
            { key: 'contact', header: 'Contacto', cell: (w) => [w.phone, w.email].filter(Boolean).join(' · ') || <Muted>—</Muted>, hideOnMobile: true },
            { key: 'main', header: 'Producción principal', cell: (w) => <span className="line-clamp-1 max-w-72">{w.mainProduction ?? '—'}</span>, hideOnMobile: true },
            { key: 'products', header: 'Productos autorizados', align: 'right', cell: (w) => w.products?.filter((p) => p.enabled).length ?? 0 },
            { key: 'status', header: 'Estado', cell: (w) => <ActiveBadge status={w.status} /> },
          ]}
        />
      </Card>
      <LaborRatesCard />
      {editing && (
        <WorkshopModal
          workshop={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={async (w) => {
            const locs = await api.get<Location[]>('/locations').catch(() => [] as Location[])
            const loc = locs.find((l) => l.workshopId === w.id)
            setCreated({ code: w.code, name: w.name, location: loc?.code })
            notify.success(`Taller ${w.code} creado con su ubicación de custodia ${loc?.code ?? ''}`.trim())
          }}
        />
      )}
    </div>
  )
}

function WorkshopModal({ workshop, onClose, onCreated }: { workshop: Workshop | null; onClose: () => void; onCreated: (w: Workshop) => void }) {
  const products = useProducts()
  const [f, set] = useFormState({
    code: workshop?.code ?? '',
    name: workshop?.name ?? '',
    responsible: workshop?.responsible ?? '',
    phone: workshop?.phone ?? '',
    email: workshop?.email ?? '',
    address: workshop?.address ?? '',
    mainProduction: workshop?.mainProduction ?? '',
    conditions: workshop?.conditions ?? '',
    status: workshop?.status ?? 'ACTIVE',
    productIds: workshop?.products?.filter((p) => p.enabled).map((p) => p.productId) ?? [],
  })
  const [touched, setTouched] = useState(false)
  const codeError = !f.code ? 'Obligatorio' : !CODE_RE.test(f.code) ? 'Solo mayúsculas, números, guion y guion bajo (máx. 20)' : undefined
  const nameError = !f.name.trim() ? 'Obligatorio' : undefined

  const save = useSave(
    () => {
      const body = {
        code: f.code,
        name: f.name.trim(),
        responsible: strOrNull(f.responsible),
        phone: strOrNull(f.phone),
        email: strOrNull(f.email),
        address: strOrNull(f.address),
        mainProduction: strOrNull(f.mainProduction),
        conditions: strOrNull(f.conditions),
        status: f.status,
        productIds: f.productIds,
      }
      return workshop ? api.patch<Workshop>(`/workshops/${workshop.id}`, body) : api.post<Workshop>('/workshops', compact(body))
    },
    [['workshops'], ['locations'], ['products']],
    (w) => {
      if (!workshop) onCreated(w)
      else notify.success('Taller actualizado')
      onClose()
    },
  )

  const submit = () => {
    setTouched(true)
    if (codeError || nameError) return
    save.mutate(undefined)
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={workshop ? `Taller ${workshop.code} · ${workshop.name}` : 'Nuevo taller'}
      description={workshop ? 'Editar datos, estado y productos autorizados.' : 'Al guardar se crea automáticamente la ubicación de custodia del taller.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button data-testid="workshop-save" loading={save.isPending} onClick={submit}>{workshop ? 'Guardar cambios' : 'Crear taller'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={3}>
          <FormField label="Código" required error={touched ? codeError : undefined} hint="Configurable, p. ej. TC, TJ, ALX">
            <Input data-testid="workshop-code" value={f.code} maxLength={20} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} className="font-mono uppercase" />
          </FormField>
          <FormField label="Nombre" required error={touched ? nameError : undefined} className="sm:col-span-2">
            <Input data-testid="workshop-name" value={f.name} maxLength={120} onChange={(e) => set('name', e.target.value)} />
          </FormField>
        </FormGrid>
        <FormGrid cols={3}>
          <FormField label="Responsable"><Input data-testid="workshop-responsible" value={f.responsible} onChange={(e) => set('responsible', e.target.value)} /></FormField>
          <FormField label="Teléfono"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></FormField>
          <FormField label="Correo"><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></FormField>
        </FormGrid>
        <FormGrid>
          <FormField label="Dirección"><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></FormField>
          <FormField label="Estado"><NativeSelect value={f.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} /></FormField>
        </FormGrid>
        <FormField label="Producción principal">
          <Input data-testid="workshop-main" value={f.mainProduction} onChange={(e) => set('mainProduction', e.target.value)} placeholder="Familias o productos que fabrica" />
        </FormField>
        <FormField label="Productos autorizados" hint="Relación producto–taller: solo se podrán crear órdenes de estos productos para el taller.">
          <div data-testid="workshop-products">
            <MultiSelect values={f.productIds} onValuesChange={(v) => set('productIds', v)} options={(products.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} placeholder="Seleccione productos…" />
          </div>
        </FormField>
        <FormField label="Condiciones" hint="Condiciones comerciales u operativas acordadas.">
          <Textarea value={f.conditions} onChange={(e) => set('conditions', e.target.value)} rows={3} />
        </FormField>
      </div>
    </Modal>
  )
}

/** Tarifas de mano de obra por taller (base de las propuestas de costo, RN-012). */
function LaborRatesCard() {
  const workshops = useWorkshops()
  const [workshopId, setWorkshopId] = useState('')
  const rates = useQuery({ queryKey: ['labor-rates', workshopId], queryFn: () => api.get<LaborRate[]>('/labor-rates', { workshopId: workshopId || undefined }) })
  const [editing, setEditing] = useState<LaborRate | 'new' | null>(null)
  return (
    <Card flush>
      <SectionBar
        title="Tarifas de mano de obra"
        description="Tarifa por gramo, unidad o lote, general del taller o específica por producto, con vigencia."
        actions={<Button variant="secondary" data-testid="labor-rate-new" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva tarifa</Button>}
      >
        <NativeSelect className="w-56" value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} placeholder="Todos los talleres" options={(workshops.data ?? []).map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} />
      </SectionBar>
      <DataTable
        dense
        loading={rates.isLoading}
        rows={rates.data}
        rowKey={(r) => r.id}
        onRowClick={(r) => setEditing(r)}
        empty={{ title: 'Sin tarifas registradas' }}
        columns={[
          { key: 'w', header: 'Taller', cell: (r) => <span className="flex items-center gap-1.5"><Factory className="size-3.5 text-ink-muted" /><span className={mono}>{r.workshop.code}</span> {r.workshop.name}</span> },
          { key: 'p', header: 'Producto', cell: (r) => (r.product ? `${r.product.code} · ${r.product.name}` : <Badge>General del taller</Badge>) },
          { key: 'b', header: 'Base', cell: (r) => LABOR_BASIS[r.basis] ?? r.basis },
          { key: 'r', header: 'Tarifa', align: 'right', cell: (r) => formatMoney(r.rate) },
          { key: 'v', header: 'Vigencia', cell: (r) => `${formatDate(r.validFrom)} → ${r.validTo ? formatDate(r.validTo) : 'indefinida'}`, hideOnMobile: true },
          { key: 'a', header: 'Estado', cell: (r) => <ActiveBadge active={r.active} /> },
        ]}
      />
      {editing && <LaborRateModal rate={editing === 'new' ? null : editing} defaultWorkshopId={workshopId} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function LaborRateModal({ rate, defaultWorkshopId, onClose }: { rate: LaborRate | null; defaultWorkshopId: string; onClose: () => void }) {
  const workshops = useWorkshops()
  const [f, set] = useFormState({
    workshopId: rate?.workshopId ?? defaultWorkshopId,
    productId: rate?.productId ?? '',
    basis: rate?.basis ?? 'GRAM',
    rate: numStr(rate?.rate),
    validFrom: rate?.validFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    validTo: rate?.validTo?.slice(0, 10) ?? '',
    active: rate?.active ?? true,
  })
  const products = useProducts(f.workshopId || undefined)
  const valid = f.workshopId && toNum(f.rate) !== null && f.validFrom
  const save = useSave(
    () => {
      const body = { workshopId: f.workshopId, productId: f.productId || null, basis: f.basis, rate: toNum(f.rate), validFrom: f.validFrom, validTo: f.validTo || null, active: f.active }
      return rate ? api.patch(`/labor-rates/${rate.id}`, body) : api.post('/labor-rates', compact(body))
    },
    [['labor-rates']],
    () => {
      notify.success(rate ? 'Tarifa actualizada' : 'Tarifa creada')
      onClose()
    },
  )
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={rate ? 'Editar tarifa' : 'Nueva tarifa de mano de obra'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="labor-rate-save" disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormField label="Taller" required>
          <NativeSelect value={f.workshopId} onChange={(e) => set('workshopId', e.target.value)} placeholder="Seleccione…" options={(workshops.data ?? []).map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} />
        </FormField>
        <FormField label="Producto" hint="Vacío = tarifa general del taller">
          <NativeSelect value={f.productId} onChange={(e) => set('productId', e.target.value)} placeholder="Todos los productos" options={(products.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
        </FormField>
        <FormGrid>
          <FormField label="Base" required><NativeSelect value={f.basis} onChange={(e) => set('basis', e.target.value)} options={Object.entries(LABOR_BASIS).map(([value, label]) => ({ value, label }))} /></FormField>
          <FormField label="Tarifa (COP)" required><Input inputMode="decimal" value={f.rate} onChange={(e) => set('rate', e.target.value)} /></FormField>
          <FormField label="Vigente desde" required><Input type="date" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} /></FormField>
          <FormField label="Vigente hasta"><Input type="date" value={f.validTo} onChange={(e) => set('validTo', e.target.value)} /></FormField>
        </FormGrid>
        <Switch checked={f.active} onCheckedChange={(v) => set('active', v)} label="Tarifa activa" />
      </div>
    </Modal>
  )
}
