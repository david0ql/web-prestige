import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { TechnicalVariable } from '@/lib/api/types'
import { useFamilies, useVariables } from '@/lib/hooks/useMasters'
import { DataTable } from '@/components/domain/DataTable'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { notify } from '@/components/ui/Toaster'
import { ActiveBadge, FormGrid, Muted, SectionBar, compact, mono, strOrNull, useFormState, useSave } from './shared'

export const DATA_TYPE: Record<string, string> = { NUMBER: 'Número', TEXT: 'Texto', BOOLEAN: 'Sí / No', SELECT: 'Lista de opciones' }

/** Variables técnicas configurables de las fichas y la declaración de producto terminado. */
export function VariablesTab() {
  const vars = useVariables()
  const [editing, setEditing] = useState<TechnicalVariable | 'new' | null>(null)
  return (
    <Card flush>
      <SectionBar
        title="Variables técnicas"
        description="Se usan en la ficha técnica de cada modelo (RF-042) y al declarar producto terminado."
        actions={<Button data-testid="variable-new" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva variable</Button>}
      />
      <DataTable
        loading={vars.isLoading}
        rows={vars.data}
        rowKey={(v) => v.id}
        onRowClick={setEditing}
        columns={[
          { key: 'c', header: 'Código', cell: (v) => <span className={mono}>{v.code}</span> },
          { key: 'n', header: 'Nombre', cell: (v) => <span className="font-medium">{v.name}</span> },
          { key: 't', header: 'Tipo', cell: (v) => <span>{DATA_TYPE[v.dataType]}{v.dataType === 'SELECT' && <span className="ml-1 text-[12px] text-ink-muted">({v.options.join(', ')})</span>}</span> },
          { key: 'u', header: 'Unidad', cell: (v) => v.unit ?? <Muted>—</Muted> },
          { key: 'r', header: 'Al terminar', cell: (v) => (v.requiredOnFinish ? <Badge variant="warning">Requerida</Badge> : <Muted>Opcional</Muted>) },
          { key: 'f', header: 'Familias', cell: (v) => (v.families?.length ? v.families.map((f) => f.name).join(', ') : <Muted>Todas</Muted>), hideOnMobile: true },
          { key: 'a', header: 'Estado', cell: (v) => <ActiveBadge active={v.active} /> },
        ]}
      />
      {editing && <VariableModal variable={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function VariableModal({ variable, onClose }: { variable: TechnicalVariable | null; onClose: () => void }) {
  const families = useFamilies()
  const [f, set] = useFormState({
    code: variable?.code ?? '',
    name: variable?.name ?? '',
    dataType: variable?.dataType ?? 'NUMBER',
    unit: variable?.unit ?? '',
    options: variable?.options.join('\n') ?? '',
    requiredOnFinish: variable?.requiredOnFinish ?? false,
    active: variable?.active ?? true,
    familyIds: variable?.families?.map((x) => x.id) ?? [],
  })
  const options = f.options.split('\n').map((s) => s.trim()).filter(Boolean)
  const codeOk = /^[A-Z0-9_]{1,40}$/.test(f.code)
  const valid = codeOk && f.name.trim() && (f.dataType !== 'SELECT' || options.length > 0)
  const save = useSave(
    () => {
      const body = { code: f.code, name: f.name.trim(), dataType: f.dataType, unit: strOrNull(f.unit), options: f.dataType === 'SELECT' ? options : [], requiredOnFinish: f.requiredOnFinish, active: f.active, familyIds: f.familyIds }
      return variable ? api.patch(`/technical-variables/${variable.id}`, body) : api.post('/technical-variables', compact(body))
    },
    [['variables'], ['catalog']],
    () => {
      notify.success('Variable guardada')
      onClose()
    },
  )
  return (
    <Modal open size="lg" onOpenChange={(o) => !o && onClose()} title={variable ? `Variable ${variable.code}` : 'Nueva variable técnica'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="variable-save" disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid cols={3}>
          <FormField label="Código" required hint="MAYÚSCULAS_Y_GUION_BAJO" error={f.code && !codeOk ? 'Formato inválido' : undefined}>
            <Input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} className="font-mono" />
          </FormField>
          <FormField label="Nombre" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
        </FormGrid>
        <FormGrid>
          <FormField label="Tipo de dato" required>
            <NativeSelect value={f.dataType} onChange={(e) => set('dataType', e.target.value as TechnicalVariable['dataType'])} options={Object.entries(DATA_TYPE).map(([value, label]) => ({ value, label }))} />
          </FormField>
          <FormField label="Unidad" hint="p. ej. mm, g, cm"><Input value={f.unit} maxLength={20} onChange={(e) => set('unit', e.target.value)} /></FormField>
        </FormGrid>
        {f.dataType === 'SELECT' && (
          <FormField label="Opciones" required hint="Una por línea">
            <Textarea value={f.options} onChange={(e) => set('options', e.target.value)} rows={4} />
          </FormField>
        )}
        <FormField label="Familias aplicables" hint="Vacío = todas las familias">
          <MultiSelect values={f.familyIds} onValuesChange={(v) => set('familyIds', v)} options={(families.data ?? []).map((x) => ({ value: x.id, label: x.name }))} placeholder="Todas las familias" />
        </FormField>
        <div className="flex flex-wrap gap-5">
          <Switch checked={f.requiredOnFinish} onCheckedChange={(v) => set('requiredOnFinish', v)} label="Requerida al declarar producto terminado" />
          <Switch checked={f.active} onCheckedChange={(v) => set('active', v)} label="Activa" />
        </div>
      </div>
    </Modal>
  )
}
