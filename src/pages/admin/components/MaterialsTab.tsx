import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { Material, MaterialCategory, Unit } from '@/lib/api/types'
import { useUnits } from '@/lib/hooks/useMasters'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatGrams, formatMoney, formatNumber, formatPurity } from '@/lib/format'
import { DataTable } from '@/components/domain/DataTable'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { SearchInput } from '@/components/ui/SearchInput'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { notify } from '@/components/ui/Toaster'
import { ActiveBadge, FormGrid, Muted, SectionBar, Segmented, STATUS_OPTIONS, YesNo, compact, mono, numStr, strOrNull, toNum, useFormState, useSave } from './shared'

type Sub = 'materials' | 'categories' | 'units'

/** Materiales, categorías y unidades auxiliares (RF-038, RF-043). */
export function MaterialsTab() {
  const [sub, setSub] = useState<Sub>('materials')
  return (
    <div className="space-y-4">
      <Segmented
        testIdPrefix="materials-sub"
        value={sub}
        onChange={setSub}
        options={[
          { value: 'materials', label: 'Materiales' },
          { value: 'categories', label: 'Categorías' },
          { value: 'units', label: 'Unidades' },
        ]}
      />
      {sub === 'materials' && <MaterialsList />}
      {sub === 'categories' && <CategoriesList />}
      {sub === 'units' && <UnitsList />}
    </div>
  )
}

const useCategories = () => useQuery({ queryKey: ['material-categories'], queryFn: () => api.get<MaterialCategory[]>('/material-categories') })

function MaterialsList() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const q = useDebounced(search, 300)
  const list = useQuery({ queryKey: ['materials', 'admin', q, status], queryFn: () => api.get<Paginated<Material>>('/materials', { pageSize: 200, search: q, status }) })
  const [editing, setEditing] = useState<Material | 'new' | null>(null)
  return (
    <Card flush>
      <SectionBar
        title="Materiales e insumos"
        description="La unidad operativa es el gramo. Ley en milésimas (‰): 999 equivale operativamente a 24K."
        actions={<Button data-testid="material-new" onClick={() => setEditing('new')}><Plus className="size-4" /> Nuevo material</Button>}
      >
        <SearchInput value={search} onValueChange={setSearch} placeholder="Buscar material" className="w-56" />
        <NativeSelect className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Todos" options={STATUS_OPTIONS} />
      </SectionBar>
      <DataTable
        testId="materials-table"
        loading={list.isLoading}
        rows={list.data?.items}
        rowKey={(m) => m.id}
        onRowClick={setEditing}
        columns={[
          { key: 'code', header: 'Código', cell: (m) => <span className={mono}>{m.code}</span> },
          { key: 'name', header: 'Nombre', cell: (m) => <span className="font-medium">{m.name}</span> },
          { key: 'cat', header: 'Categoría', cell: (m) => m.category?.name ?? '—', hideOnMobile: true },
          { key: 'pur', header: 'Ley', align: 'right', cell: (m) => (m.purity !== null ? formatPurity(m.purity) : <Muted>—</Muted>) },
          { key: 'k', header: 'Quilataje', align: 'right', cell: (m) => (m.karat ? `${m.karat}K` : <Muted>—</Muted>), hideOnMobile: true },
          { key: 'tol', header: 'Tol. ley', align: 'right', cell: (m) => (m.purityTolerance !== null ? `± ${formatNumber(m.purityTolerance, 1)} ‰` : <Muted>—</Muted>), hideOnMobile: true },
          { key: 'u', header: 'Unidad', cell: (m) => m.baseUnit?.code ?? '—', hideOnMobile: true },
          { key: 'cost', header: 'Costo ref./g', align: 'right', cell: (m) => formatMoney(m.referenceCost) },
          { key: 'min', header: 'Mínimo', align: 'right', cell: (m) => (m.minStock ? formatGrams(m.minStock, 0) : <Muted>—</Muted>), hideOnMobile: true },
          { key: 'flags', header: 'Tipo', cell: (m) => <span className="flex gap-1">{m.isIntermediate && <Badge variant="gold">Intermedio</Badge>}{m.tracksLots && <Badge variant="info">Lotes</Badge>}</span>, hideOnMobile: true },
          { key: 's', header: 'Estado', cell: (m) => <ActiveBadge status={m.status} /> },
        ]}
      />
      {editing && <MaterialModal material={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function MaterialModal({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const cats = useCategories()
  const units = useUnits()
  const [f, set] = useFormState({
    code: material?.code ?? '',
    name: material?.name ?? '',
    categoryId: material?.categoryId ?? '',
    purity: numStr(material?.purity),
    karat: numStr(material?.karat),
    purityTolerance: numStr(material?.purityTolerance),
    baseUnitId: material?.baseUnitId ?? '',
    referenceCost: numStr(material?.referenceCost ?? 0),
    minStock: numStr(material?.minStock ?? 0),
    isIntermediate: material?.isIntermediate ?? false,
    tracksLots: material?.tracksLots ?? false,
    description: material?.description ?? '',
    status: material?.status ?? 'ACTIVE',
  })
  const baseUnit = f.baseUnitId || units.data?.find((u) => u.isBase)?.id || ''
  const valid = f.code.trim() && f.name.trim() && f.categoryId && baseUnit
  const save = useSave(
    () => {
      const body = {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        categoryId: f.categoryId,
        purity: toNum(f.purity),
        karat: toNum(f.karat),
        purityTolerance: toNum(f.purityTolerance),
        baseUnitId: baseUnit,
        referenceCost: toNum(f.referenceCost) ?? 0,
        minStock: toNum(f.minStock) ?? 0,
        isIntermediate: f.isIntermediate,
        tracksLots: f.tracksLots,
        description: strOrNull(f.description),
        status: f.status,
      }
      return material ? api.patch(`/materials/${material.id}`, body) : api.post('/materials', compact(body))
    },
    [['materials']],
    () => {
      notify.success(material ? 'Material actualizado' : 'Material creado')
      onClose()
    },
  )
  /** Sugerencia: quilataje → ley (24K = 999 ‰ operativo). */
  const suggest = (k: string) => {
    set('karat', k)
    const n = toNum(k)
    if (n && !f.purity) set('purity', String(n === 24 ? 999 : Math.round((n / 24) * 1000)))
  }
  return (
    <Modal open size="lg" onOpenChange={(o) => !o && onClose()} title={material ? `Material ${material.code}` : 'Nuevo material'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="material-save" disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid cols={3}>
          <FormField label="Código" required><Input data-testid="material-code" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className="font-mono" /></FormField>
          <FormField label="Nombre" required className="sm:col-span-2"><Input data-testid="material-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
        </FormGrid>
        <FormGrid cols={3}>
          <FormField label="Categoría" required><NativeSelect value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} placeholder="Seleccione…" options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))} /></FormField>
          <FormField label="Unidad base" required><NativeSelect value={baseUnit} onChange={(e) => set('baseUnitId', e.target.value)} placeholder="Seleccione…" options={(units.data ?? []).map((u) => ({ value: u.id, label: `${u.code} · ${u.name}` }))} /></FormField>
          <FormField label="Estado"><NativeSelect value={f.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} /></FormField>
        </FormGrid>
        <FormGrid cols={3}>
          <FormField label="Quilataje (K)" hint="1 a 24"><Input inputMode="numeric" value={f.karat} onChange={(e) => suggest(e.target.value)} /></FormField>
          <FormField label="Ley / pureza (‰)" hint="0 a 1000 · 999 = 24K"><Input inputMode="decimal" value={f.purity} onChange={(e) => set('purity', e.target.value)} /></FormField>
          <FormField label="Tolerancia de ley (‰)"><Input inputMode="decimal" value={f.purityTolerance} onChange={(e) => set('purityTolerance', e.target.value)} /></FormField>
        </FormGrid>
        <FormGrid>
          <FormField label="Costo de referencia por gramo (COP)"><Input inputMode="decimal" value={f.referenceCost} onChange={(e) => set('referenceCost', e.target.value)} /></FormField>
          <FormField label="Mínimo de inventario (g)" hint="Genera alerta al bajar de este valor"><Input inputMode="decimal" value={f.minStock} onChange={(e) => set('minStock', e.target.value)} /></FormField>
        </FormGrid>
        <div className="flex flex-wrap gap-5 py-1">
          <Switch checked={f.isIntermediate} onCheckedChange={(v) => set('isIntermediate', v)} label="Producto intermedio (p. ej. hilo, aleación)" />
          <Switch checked={f.tracksLots} onCheckedChange={(v) => set('tracksLots', v)} label="Controla lotes" />
        </div>
        <FormField label="Descripción"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} /></FormField>
      </div>
    </Modal>
  )
}

function CategoriesList() {
  const cats = useCategories()
  const [editing, setEditing] = useState<MaterialCategory | 'new' | null>(null)
  return (
    <Card flush>
      <SectionBar title="Categorías de material" actions={<Button variant="secondary" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva categoría</Button>} />
      <DataTable
        loading={cats.isLoading}
        rows={cats.data}
        rowKey={(c) => c.id}
        onRowClick={setEditing}
        columns={[
          { key: 'c', header: 'Código', cell: (c) => <span className={mono}>{c.code}</span> },
          { key: 'n', header: 'Nombre', cell: (c) => c.name },
          { key: 'p', header: 'Metal precioso', cell: (c) => <YesNo value={c.isPreciousMetal} variant="gold" /> },
          { key: 's', header: 'Estado', cell: (c) => <ActiveBadge status={c.status} /> },
        ]}
      />
      {editing && <CategoryModal cat={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function CategoryModal({ cat, onClose }: { cat: MaterialCategory | null; onClose: () => void }) {
  const [f, set] = useFormState({ code: cat?.code ?? '', name: cat?.name ?? '', isPreciousMetal: cat?.isPreciousMetal ?? false, status: cat?.status ?? 'ACTIVE' })
  const save = useSave(
    () => {
      const body = { ...f, code: f.code.trim().toUpperCase(), name: f.name.trim() }
      return cat ? api.patch(`/material-categories/${cat.id}`, body) : api.post('/material-categories', body)
    },
    [['material-categories'], ['materials']],
    () => {
      notify.success('Categoría guardada')
      onClose()
    },
  )
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={cat ? 'Editar categoría' : 'Nueva categoría'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!f.code || !f.name} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid>
          <FormField label="Código" required><Input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className="font-mono" /></FormField>
          <FormField label="Nombre" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
        </FormGrid>
        <FormGrid>
          <FormField label="Estado"><NativeSelect value={f.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} /></FormField>
          <div className="flex items-end pb-1.5"><Switch checked={f.isPreciousMetal} onCheckedChange={(v) => set('isPreciousMetal', v)} label="Metal precioso" /></div>
        </FormGrid>
      </div>
    </Modal>
  )
}

const UNIT_KIND: Record<string, string> = { MASS: 'Masa', COUNT: 'Conteo', LENGTH: 'Longitud' }

function UnitsList() {
  const units = useUnits()
  const [editing, setEditing] = useState<Unit | 'new' | null>(null)
  return (
    <Card flush>
      <SectionBar title="Unidades" description="El gramo es la unidad base. Las auxiliares se convierten con su factor a gramo." actions={<Button variant="secondary" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva unidad</Button>} />
      <DataTable
        loading={units.isLoading}
        rows={units.data}
        rowKey={(u) => u.id}
        onRowClick={(u) => (u.isBase ? notify.info('La unidad base (gramo) no se edita') : setEditing(u))}
        columns={[
          { key: 'c', header: 'Código', cell: (u) => <span className={mono}>{u.code}</span> },
          { key: 'n', header: 'Nombre', cell: (u) => <span className="flex items-center gap-2">{u.name}{u.isBase && <Badge variant="gold">Base</Badge>}</span> },
          { key: 'k', header: 'Tipo', cell: (u) => UNIT_KIND[u.kind] ?? u.kind },
          { key: 'f', header: 'Factor a gramo', align: 'right', cell: (u) => `1 ${u.code} = ${formatNumber(u.factorToGram, 4)} g` },
          { key: 's', header: 'Estado', cell: (u) => <ActiveBadge status={u.status} /> },
        ]}
      />
      {editing && <UnitModal unit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function UnitModal({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  const [f, set] = useFormState({ code: unit?.code ?? '', name: unit?.name ?? '', kind: unit?.kind ?? 'MASS', factorToGram: numStr(unit?.factorToGram ?? 1), status: unit?.status ?? 'ACTIVE' })
  const factor = toNum(f.factorToGram)
  const save = useSave(
    () => {
      const body = { code: f.code.trim(), name: f.name.trim(), kind: f.kind, factorToGram: factor, status: f.status }
      return unit ? api.patch(`/units/${unit.id}`, body) : api.post('/units', body)
    },
    [['units']],
    () => {
      notify.success('Unidad guardada')
      onClose()
    },
  )
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={unit ? 'Editar unidad' : 'Nueva unidad auxiliar'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!f.code || !f.name || !factor || factor <= 0} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid>
          <FormField label="Código" required hint="Letras y números, máx. 12"><Input value={f.code} maxLength={12} onChange={(e) => set('code', e.target.value.replace(/[^A-Za-z0-9]/g, ''))} className="font-mono" /></FormField>
          <FormField label="Nombre" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
          <FormField label="Tipo" required><NativeSelect value={f.kind} onChange={(e) => set('kind', e.target.value)} options={Object.entries(UNIT_KIND).map(([value, label]) => ({ value, label }))} /></FormField>
          <FormField label="Factor a gramo" required hint={factor ? `1 ${f.code || 'unidad'} = ${formatNumber(factor, 4)} g` : 'Gramos equivalentes a 1 unidad'}><Input inputMode="decimal" value={f.factorToGram} onChange={(e) => set('factorToGram', e.target.value)} /></FormField>
          <FormField label="Estado"><NativeSelect value={f.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} /></FormField>
        </FormGrid>
      </div>
    </Modal>
  )
}
