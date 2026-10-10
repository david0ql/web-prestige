import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BookOpen, Calculator, Plus } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { ConsumptionStandard, Product, ProductFamily, ProductVariant } from '@/lib/api/types'
import { useFamilies, useMaterials, useWorkshops } from '@/lib/hooks/useMasters'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { formatGrams, formatNumber, formatPercent, formatPurity } from '@/lib/format'
import { STANDARD_BASIS } from '@/lib/labels'
import { DataTable } from '@/components/domain/DataTable'
import { QueryState } from '@/components/domain/QueryState'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { SearchInput } from '@/components/ui/SearchInput'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { notify } from '@/components/ui/Toaster'
import { ActiveBadge, FormGrid, Muted, SectionBar, Segmented, STATUS_OPTIONS, compact, mono, numStr, strOrNull, toNum, useFormState, useSave } from './shared'

type Sub = 'products' | 'families'

/** Productos / modelos, variantes y estándares de consumo (RF-038, RF-043, RN-007). */
export function ProductsTab() {
  const [sub, setSub] = useState<Sub>('products')
  return (
    <div className="space-y-4">
      <Segmented testIdPrefix="products-sub" value={sub} onChange={setSub} options={[{ value: 'products', label: 'Productos / modelos' }, { value: 'families', label: 'Familias' }]} />
      {sub === 'products' ? <ProductsList /> : <FamiliesList />}
    </div>
  )
}

function ProductsList() {
  const families = useFamilies()
  const [search, setSearch] = useState('')
  const [familyId, setFamilyId] = useState('')
  const q = useDebounced(search, 300)
  const list = useQuery({ queryKey: ['products', 'admin', q, familyId], queryFn: () => api.get<Paginated<Product>>('/products', { pageSize: 200, search: q, familyId }) })
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  return (
    <Card flush>
      <SectionBar
        title="Productos y modelos"
        description="Cada modelo define ley objetivo, controles, merma tolerada, talleres habilitados, variantes y estándares de consumo."
        actions={<Button data-testid="product-new" onClick={() => setCreating(true)}><Plus className="size-4" /> Nuevo producto</Button>}
      >
        <SearchInput value={search} onValueChange={setSearch} placeholder="Buscar código o nombre" className="w-56" />
        <NativeSelect className="w-44" value={familyId} onChange={(e) => setFamilyId(e.target.value)} placeholder="Todas las familias" options={(families.data ?? []).map((f) => ({ value: f.id, label: f.name }))} />
      </SectionBar>
      <DataTable
        testId="products-table"
        loading={list.isLoading}
        rows={list.data?.items}
        rowKey={(p) => p.id}
        onRowClick={(p) => setOpenId(p.id)}
        columns={[
          { key: 'c', header: 'Código', cell: (p) => <span className={mono}>{p.code}</span> },
          { key: 'n', header: 'Nombre', cell: (p) => <span className="font-medium">{p.name}</span> },
          { key: 'f', header: 'Familia', cell: (p) => p.family?.name ?? '—', hideOnMobile: true },
          { key: 'l', header: 'Ley objetivo', align: 'right', cell: (p) => (p.targetPurity !== null ? `${formatPurity(p.targetPurity)}${p.purityTolerance !== null ? ` ± ${formatNumber(p.purityTolerance, 1)}` : ''}` : <Muted>—</Muted>) },
          { key: 'ctl', header: 'Controles', cell: (p) => <span className="flex gap-1">{p.requiresPurityCheck && <Badge variant="gold">Ley</Badge>}{p.requiresQualityCheck && <Badge variant="info">Calidad</Badge>}</span>, hideOnMobile: true },
          { key: 'm', header: 'Merma tol.', align: 'right', cell: (p) => formatPercent(p.lossTolerancePct), hideOnMobile: true },
          { key: 'o', header: 'Material de salida', cell: (p) => p.outputMaterial?.name ?? <Muted>—</Muted>, hideOnMobile: true },
          { key: 'v', header: 'Ficha', align: 'right', cell: (p) => (p.currentSheetVersion ? `v${p.currentSheetVersion}` : <Muted>—</Muted>), hideOnMobile: true },
          { key: 's', header: 'Estado', cell: (p) => <ActiveBadge status={p.status} /> },
        ]}
      />
      {creating && <ProductFormModal onClose={() => setCreating(false)} onCreated={(p) => setOpenId(p.id)} />}
      {openId && <ProductDrawer productId={openId} onClose={() => setOpenId(null)} />}
    </Card>
  )
}

interface ProductForm {
  code: string; name: string; familyId: string; description: string; targetPurity: string; purityTolerance: string
  requiresPurityCheck: boolean; requiresQualityCheck: boolean; lossTolerancePct: string; outputMaterialId: string; workshopIds: string[]; status: string
}
const productForm = (p?: Product | null): ProductForm => ({
  code: p?.code ?? '',
  name: p?.name ?? '',
  familyId: p?.familyId ?? '',
  description: p?.description ?? '',
  targetPurity: numStr(p?.targetPurity),
  purityTolerance: numStr(p?.purityTolerance),
  requiresPurityCheck: p?.requiresPurityCheck ?? false,
  requiresQualityCheck: p?.requiresQualityCheck ?? true,
  lossTolerancePct: numStr(p?.lossTolerancePct ?? 0),
  outputMaterialId: p?.outputMaterialId ?? '',
  workshopIds: p?.workshops?.filter((w) => w.enabled).map((w) => w.workshopId) ?? [],
  status: p?.status ?? 'ACTIVE',
})
const productBody = (f: ProductForm) => ({
  code: f.code.trim().toUpperCase(),
  name: f.name.trim(),
  familyId: f.familyId,
  description: strOrNull(f.description),
  targetPurity: toNum(f.targetPurity),
  purityTolerance: toNum(f.purityTolerance),
  requiresPurityCheck: f.requiresPurityCheck,
  requiresQualityCheck: f.requiresQualityCheck,
  lossTolerancePct: toNum(f.lossTolerancePct) ?? 0,
  outputMaterialId: f.outputMaterialId || null,
  workshopIds: f.workshopIds,
  status: f.status,
})

function ProductFields({ f, set }: { f: ProductForm; set: <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => void }) {
  const families = useFamilies()
  const materials = useMaterials()
  const workshops = useWorkshops()
  const intermediates = (materials.data ?? []).filter((m) => m.isIntermediate)
  return (
    <div className="space-y-3">
      <FormGrid cols={3}>
        <FormField label="Código" required><Input data-testid="product-code" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className="font-mono" /></FormField>
        <FormField label="Nombre" required className="sm:col-span-2"><Input data-testid="product-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
      </FormGrid>
      <FormGrid cols={3}>
        <FormField label="Familia" required><NativeSelect data-testid="product-family" value={f.familyId} onChange={(e) => set('familyId', e.target.value)} placeholder="Seleccione…" options={(families.data ?? []).map((x) => ({ value: x.id, label: x.name }))} /></FormField>
        <FormField label="Ley objetivo (‰)" hint="RF-043 · 999 = 24K"><Input inputMode="decimal" value={f.targetPurity} onChange={(e) => set('targetPurity', e.target.value)} /></FormField>
        <FormField label="Tolerancia de ley (± ‰)"><Input inputMode="decimal" value={f.purityTolerance} onChange={(e) => set('purityTolerance', e.target.value)} /></FormField>
      </FormGrid>
      <FormGrid cols={3}>
        <FormField label="Tolerancia de merma (%)"><Input inputMode="decimal" value={f.lossTolerancePct} onChange={(e) => set('lossTolerancePct', e.target.value)} /></FormField>
        <FormField label="Material de salida" hint="Si el producto es un intermedio (p. ej. hilo) que entra al inventario" className="sm:col-span-2">
          <NativeSelect value={f.outputMaterialId} onChange={(e) => set('outputMaterialId', e.target.value)} placeholder="Ninguno (producto terminado)" options={(intermediates.length ? intermediates : materials.data ?? []).map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} />
        </FormField>
      </FormGrid>
      <div className="flex flex-wrap gap-5 py-1">
        <Switch checked={f.requiresPurityCheck} onCheckedChange={(v) => set('requiresPurityCheck', v)} label="Requiere control de ley/pureza" />
        <Switch checked={f.requiresQualityCheck} onCheckedChange={(v) => set('requiresQualityCheck', v)} label="Requiere control de calidad" />
      </div>
      <FormField label="Talleres habilitados" hint="Relación producto–taller">
        <MultiSelect values={f.workshopIds} onValuesChange={(v) => set('workshopIds', v)} options={(workshops.data ?? []).map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} placeholder="Seleccione talleres…" />
      </FormField>
      <FormGrid>
        <FormField label="Estado"><NativeSelect value={f.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} /></FormField>
      </FormGrid>
      <FormField label="Descripción"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} /></FormField>
    </div>
  )
}

function ProductFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Product) => void }) {
  const [f, set] = useFormState(productForm())
  const save = useSave(
    () => api.post<Product>('/products', compact(productBody(f))),
    [['products'], ['workshops'], ['catalog']],
    (p) => {
      notify.success(`Producto ${p.code} creado. Agregue variantes y estándares de consumo.`)
      onClose()
      onCreated(p)
    },
  )
  return (
    <Modal open size="lg" onOpenChange={(o) => !o && onClose()} title="Nuevo producto / modelo" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="product-save" disabled={!f.code || !f.name || !f.familyId} loading={save.isPending} onClick={() => save.mutate(undefined)}>Crear producto</Button>
      </>
    }>
      <ProductFields f={f} set={set} />
    </Modal>
  )
}

function ProductDrawer({ productId, onClose }: { productId: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['products', 'detail', productId], queryFn: () => api.get<Product>(`/products/${productId}`) })
  const p = q.data
  return (
    <Drawer open size="lg" onOpenChange={(o) => !o && onClose()} title={p ? `${p.code} · ${p.name}` : 'Producto'} description={p ? `${p.family?.name ?? ''} · ficha técnica v${p.currentSheetVersion}` : undefined}>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
        {p && (
          <Tabs defaultValue="general">
            <TabsList className="mb-4">
              <TabsTrigger value="general">Datos generales</TabsTrigger>
              <TabsTrigger value="variants" count={p.variants?.length ?? 0} data-testid="product-tab-variants">Variantes</TabsTrigger>
              <TabsTrigger value="standards" data-testid="product-tab-standards">Estándares de consumo</TabsTrigger>
            </TabsList>
            <TabsContent value="general"><ProductGeneral product={p} /></TabsContent>
            <TabsContent value="variants"><VariantsSection product={p} /></TabsContent>
            <TabsContent value="standards"><StandardsSection product={p} /></TabsContent>
          </Tabs>
        )}
      </QueryState>
    </Drawer>
  )
}

function ProductGeneral({ product }: { product: Product }) {
  const [f, set] = useFormState(productForm(product))
  const save = useSave(() => api.patch(`/products/${product.id}`, productBody(f)), [['products'], ['workshops'], ['catalog']], () => notify.success('Producto actualizado'))
  return (
    <div className="space-y-4">
      <ProductFields f={f} set={set} />
      <div className="flex items-center justify-between border-t border-border pt-3">
        <Link to="/catalogo/$productId" params={{ productId: product.id }} className="flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline">
          <BookOpen className="size-4" /> Ver ficha técnica (P19)
        </Link>
        <Button data-testid="product-update" loading={save.isPending} disabled={!f.code || !f.name || !f.familyId} onClick={() => save.mutate(undefined)}>Guardar cambios</Button>
      </div>
    </div>
  )
}

function VariantsSection({ product }: { product: Product }) {
  const [editing, setEditing] = useState<ProductVariant | 'new' | null>(null)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-ink-muted">Variantes / modelos del producto (talla, calibre, color…). Pueden tener estándares propios.</p>
        <Button size="sm" variant="secondary" data-testid="variant-new" onClick={() => setEditing('new')}><Plus className="size-3.5" /> Nueva variante</Button>
      </div>
      <div className="rounded-md border border-border">
        <DataTable
          dense
          rows={product.variants}
          rowKey={(v) => v.id}
          onRowClick={setEditing}
          empty={{ title: 'Sin variantes', description: 'El producto se fabrica en su versión estándar.' }}
          columns={[
            { key: 'c', header: 'Código', cell: (v) => <span className={mono}>{v.code}</span> },
            { key: 'n', header: 'Nombre', cell: (v) => v.name },
            { key: 'w', header: 'Peso estándar', align: 'right', cell: (v) => (v.standardWeight !== null ? formatGrams(v.standardWeight, 3) : <Muted>—</Muted>) },
            { key: 'a', header: 'Atributos', cell: (v) => Object.entries(v.attributes ?? {}).map(([k, val]) => `${k}: ${String(val)}`).join(' · ') || <Muted>—</Muted> },
            { key: 's', header: 'Estado', cell: (v) => <ActiveBadge status={v.status} /> },
          ]}
        />
      </div>
      {editing && <VariantModal product={product} variant={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function VariantModal({ product, variant, onClose }: { product: Product; variant: ProductVariant | null; onClose: () => void }) {
  const [f, set] = useFormState({
    code: variant?.code ?? '',
    name: variant?.name ?? '',
    standardWeight: numStr(variant?.standardWeight),
    attributes: Object.entries(variant?.attributes ?? {}).map(([k, v]) => `${k}=${String(v)}`).join('\n'),
    status: variant?.status ?? 'ACTIVE',
  })
  const save = useSave(
    () => {
      const attributes = Object.fromEntries(
        f.attributes.split('\n').map((l) => l.split('=')).filter((p) => p[0]?.trim()).map(([k, ...v]) => [k.trim(), v.join('=').trim()]),
      )
      const body = { code: f.code.trim().toUpperCase(), name: f.name.trim(), standardWeight: toNum(f.standardWeight), attributes, status: f.status }
      return variant ? api.patch(`/products/${product.id}/variants/${variant.id}`, body) : api.post(`/products/${product.id}/variants`, compact(body))
    },
    [['products']],
    () => {
      notify.success('Variante guardada')
      onClose()
    },
  )
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={variant ? 'Editar variante' : `Nueva variante de ${product.code}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="variant-save" disabled={!f.code || !f.name} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid>
          <FormField label="Código" required><Input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className="font-mono" /></FormField>
          <FormField label="Nombre" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
          <FormField label="Peso estándar (g)"><Input inputMode="decimal" value={f.standardWeight} onChange={(e) => set('standardWeight', e.target.value)} /></FormField>
          <FormField label="Estado"><NativeSelect value={f.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} /></FormField>
        </FormGrid>
        <FormField label="Atributos" hint="Uno por línea, formato clave=valor (p. ej. talla=7)">
          <Textarea value={f.attributes} onChange={(e) => set('attributes', e.target.value)} rows={3} className="font-mono" />
        </FormField>
      </div>
    </Modal>
  )
}

/** RF-008 / RN-007: requerimiento calculado (misma fórmula que la API). */
export function standardExample(s: { basis: string; quantity: number; lotSizeGrams: number | null }) {
  if (s.basis === 'PER_UNIT') return { base: '10 u', grams: s.quantity * 10 }
  if (s.basis === 'PER_LOT') return { base: '100 g', grams: Math.ceil(100 / (s.lotSizeGrams || 100)) * s.quantity }
  return { base: '100 g', grams: s.quantity * 100 }
}

function StandardsSection({ product }: { product: Product }) {
  const q = useQuery({ queryKey: ['products', 'standards', product.id], queryFn: () => api.get<ConsumptionStandard[]>(`/products/${product.id}/standards`) })
  const [editing, setEditing] = useState<ConsumptionStandard | 'new' | null>(null)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-muted">Cantidad de cada material por gramo, unidad o lote de producto. Un estándar de variante reemplaza al general del mismo material.</p>
        <Button size="sm" variant="secondary" data-testid="standard-new" onClick={() => setEditing('new')}><Plus className="size-3.5" /> Nuevo estándar</Button>
      </div>
      <div className="rounded-md border border-border">
        <DataTable
          dense
          loading={q.isLoading}
          rows={q.data}
          rowKey={(s) => s.id}
          onRowClick={setEditing}
          empty={{ title: 'Sin estándares de consumo', description: 'Sin estándares no se pueden calcular materiales requeridos ni validar suficiencia.' }}
          columns={[
            { key: 'm', header: 'Material', cell: (s) => <span><span className={mono}>{s.material.code}</span> {s.material.name}</span> },
            { key: 'b', header: 'Base', cell: (s) => STANDARD_BASIS[s.basis] ?? s.basis },
            { key: 'q', header: 'Cantidad', align: 'right', cell: (s) => `${formatNumber(s.quantity, 4)} g${s.basis === 'PER_LOT' && s.lotSizeGrams ? ` / ${formatGrams(s.lotSizeGrams, 0)}` : ''}` },
            { key: 't', header: 'Tol.', align: 'right', cell: (s) => formatPercent(s.tolerancePct) },
            { key: 'v', header: 'Variante', cell: (s) => s.variant?.name ?? <Muted>General</Muted> },
            { key: 'e', header: 'Ejemplo', cell: (s) => { const ex = standardExample(s); return <span className="whitespace-nowrap text-[12px] text-ink-secondary">{ex.base} → <b className="tnum">{formatGrams(ex.grams)}</b></span> } },
            { key: 'a', header: 'Estado', cell: (s) => <ActiveBadge active={s.active} /> },
          ]}
        />
      </div>
      {editing && <StandardModal product={product} standard={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function StandardModal({ product, standard, onClose }: { product: Product; standard: ConsumptionStandard | null; onClose: () => void }) {
  const materials = useMaterials()
  const [f, set] = useFormState({
    materialId: standard?.materialId ?? '',
    basis: standard?.basis ?? 'PER_GRAM',
    quantity: numStr(standard?.quantity),
    lotSizeGrams: numStr(standard?.lotSizeGrams),
    tolerancePct: numStr(standard?.tolerancePct ?? 0),
    variantId: standard?.variantId ?? '',
    notes: standard?.notes ?? '',
    active: standard?.active ?? true,
  })
  const qty = toNum(f.quantity)
  const lot = toNum(f.lotSizeGrams)
  const mat = materials.data?.find((m) => m.id === f.materialId)
  const valid = f.materialId && qty && qty > 0 && (f.basis !== 'PER_LOT' || (lot && lot > 0))
  const ex = qty ? standardExample({ basis: f.basis, quantity: qty, lotSizeGrams: lot }) : null
  const tol = toNum(f.tolerancePct) ?? 0
  const save = useSave(
    () => {
      const body = {
        materialId: f.materialId,
        basis: f.basis,
        quantity: qty,
        lotSizeGrams: f.basis === 'PER_LOT' ? lot : null,
        tolerancePct: tol,
        variantId: f.variantId || null,
        notes: strOrNull(f.notes),
        active: f.active,
      }
      return standard ? api.patch(`/products/${product.id}/standards/${standard.id}`, body) : api.post(`/products/${product.id}/standards`, compact(body))
    },
    [['products']],
    () => {
      notify.success('Estándar de consumo guardado')
      onClose()
    },
  )
  return (
    <Modal open size="xl" onOpenChange={(o) => !o && onClose()} title={standard ? 'Editar estándar de consumo' : `Nuevo estándar · ${product.code}`} description="RN-007 · parametrizable por producto y variante" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="standard-save" disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid>
          <FormField label="Material / insumo" required>
            <NativeSelect data-testid="standard-material" value={f.materialId} onChange={(e) => set('materialId', e.target.value)} placeholder="Seleccione…" options={(materials.data ?? []).map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} />
          </FormField>
          <FormField label="Variante" hint="Vacío = aplica a todo el producto">
            <NativeSelect value={f.variantId} onChange={(e) => set('variantId', e.target.value)} placeholder="General" options={(product.variants ?? []).map((v) => ({ value: v.id, label: `${v.code} · ${v.name}` }))} />
          </FormField>
        </FormGrid>
        <FormGrid cols={4}>
          <FormField label="Base" required>
            <NativeSelect data-testid="standard-basis" value={f.basis} onChange={(e) => set('basis', e.target.value)} options={Object.entries(STANDARD_BASIS).map(([value, label]) => ({ value, label }))} />
          </FormField>
          <FormField label={f.basis === 'PER_GRAM' ? 'Gramos por g de producto' : f.basis === 'PER_UNIT' ? 'Gramos por unidad' : 'Gramos por lote'} required>
            <Input data-testid="standard-quantity" inputMode="decimal" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </FormField>
          <FormField label="Tamaño de lote (g)" required={f.basis === 'PER_LOT'}>
            <Input inputMode="decimal" disabled={f.basis !== 'PER_LOT'} value={f.lotSizeGrams} onChange={(e) => set('lotSizeGrams', e.target.value)} />
          </FormField>
          <FormField label="Tolerancia (%)"><Input inputMode="decimal" value={f.tolerancePct} onChange={(e) => set('tolerancePct', e.target.value)} /></FormField>
        </FormGrid>
        <div data-testid="standard-example" className="flex items-start gap-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 text-[13px]">
          <Calculator className="mt-0.5 size-4 shrink-0 text-brand-700" />
          {ex ? (
            <p className="text-ink-secondary">
              Para <b>{ex.base}</b> de {product.name} se requieren <b className="tnum text-ink">{formatGrams(ex.grams)}</b> de {mat?.name ?? 'el material'}
              {tol > 0 && <> (tolerancia ± {formatPercent(tol)}: {formatGrams(ex.grams * (1 - tol / 100))} – {formatGrams(ex.grams * (1 + tol / 100))})</>}.
              {f.basis === 'PER_LOT' && lot ? <> Se calcula por lotes completos de {formatGrams(lot, 0)}.</> : null}
            </p>
          ) : (
            <p className="text-ink-muted">Ingrese la cantidad para ver el requerimiento calculado.</p>
          )}
        </div>
        <FormField label="Notas"><Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></FormField>
        <Switch checked={f.active} onCheckedChange={(v) => set('active', v)} label="Estándar activo" />
      </div>
    </Modal>
  )
}

function FamiliesList() {
  const families = useFamilies()
  const [editing, setEditing] = useState<ProductFamily | 'new' | null>(null)
  return (
    <Card flush>
      <SectionBar title="Familias de producto" description="Agrupan modelos; las etapas y variables técnicas pueden aplicar por familia." actions={<Button variant="secondary" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva familia</Button>} />
      <DataTable
        loading={families.isLoading}
        rows={families.data}
        rowKey={(f) => f.id}
        onRowClick={setEditing}
        columns={[
          { key: 'c', header: 'Código', cell: (f) => <span className={mono}>{f.code}</span> },
          { key: 'n', header: 'Nombre', cell: (f) => f.name },
          { key: 'd', header: 'Descripción', cell: (f) => f.description ?? <Muted>—</Muted>, hideOnMobile: true },
          { key: 's', header: 'Estado', cell: (f) => <ActiveBadge status={f.status} /> },
        ]}
      />
      {editing && <FamilyModal family={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function FamilyModal({ family, onClose }: { family: ProductFamily | null; onClose: () => void }) {
  const [f, set] = useFormState({ code: family?.code ?? '', name: family?.name ?? '', description: family?.description ?? '', status: family?.status ?? 'ACTIVE' })
  const save = useSave(
    () => {
      const body = { code: f.code.trim().toUpperCase(), name: f.name.trim(), description: strOrNull(f.description), status: f.status }
      return family ? api.patch(`/product-families/${family.id}`, body) : api.post('/product-families', compact(body))
    },
    [['families'], ['products']],
    () => {
      notify.success('Familia guardada')
      onClose()
    },
  )
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={family ? 'Editar familia' : 'Nueva familia'} footer={
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
        <FormField label="Descripción"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} /></FormField>
        <FormField label="Estado"><NativeSelect value={f.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} /></FormField>
      </div>
    </Modal>
  )
}
