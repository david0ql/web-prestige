import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { SystemParameter } from '@/lib/api/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Switch } from '@/components/ui/Switch'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/components/ui/Toaster'
import { SectionBar, useSave } from './shared'

const GROUP_LABEL: Record<string, string> = { alertas: 'Alertas', balanza: 'Balanza Madre', calidad: 'Calidad y ley', general: 'General', inventario: 'Inventario', produccion: 'Producción', finanzas: 'Finanzas', seguridad: 'Seguridad', medios: 'Evidencias' }

type Kind = 'number' | 'string' | 'boolean' | 'string[]' | 'json'
const kindOf = (v: unknown): Kind =>
  typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : typeof v === 'string' ? 'string' : Array.isArray(v) && v.every((x) => typeof x === 'string') ? 'string[]' : 'json'

function Preview({ value }: { value: unknown }) {
  const k = kindOf(value)
  if (k === 'boolean') return <span className="font-medium">{value ? 'Sí' : 'No'}</span>
  if (k === 'string[]') return <span className="flex flex-wrap gap-1">{(value as string[]).map((s) => <span key={s} className="rounded bg-sunken px-1.5 py-0.5 text-[12px]">{s}</span>)}</span>
  if (k === 'json') return <code className="line-clamp-2 font-mono text-[12px] text-ink-secondary">{JSON.stringify(value)}</code>
  return <span className="font-medium tnum">{String(value)}</span>
}

/** Parámetros del sistema agrupados (parametrización sin código). */
export function ParametersTab() {
  const q = useQuery({ queryKey: ['parameters'], queryFn: () => api.get<SystemParameter[]>('/parameters') })
  const [editing, setEditing] = useState<SystemParameter | null>(null)
  const groups = useMemo(() => {
    const m = new Map<string, SystemParameter[]>()
    for (const p of q.data ?? []) m.set(p.groupName, [...(m.get(p.groupName) ?? []), p])
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [q.data])
  if (q.isLoading) return <div className="flex justify-center py-10"><Spinner /></div>
  return (
    <div className="space-y-4">
      {groups.map(([group, items]) => (
        <Card key={group} flush>
          <SectionBar title={GROUP_LABEL[group] ?? group.charAt(0).toUpperCase() + group.slice(1)} />
          <ul className="divide-y divide-border">
            {items.map((p) => (
              <li key={p.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center" data-testid={`param-${p.key}`}>
                <div className="min-w-0 sm:w-80 sm:shrink-0">
                  <p className="text-[13px] font-medium text-ink">{p.description}</p>
                  <p className="font-mono text-[11px] text-ink-muted">{p.key}</p>
                </div>
                <div className="min-w-0 flex-1"><Preview value={p.value} /></div>
                <Button size="sm" variant="secondary" onClick={() => setEditing(p)}><Pencil className="size-3.5" /> Editar</Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {editing && <ParameterModal param={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ParameterModal({ param, onClose }: { param: SystemParameter; onClose: () => void }) {
  const kind = kindOf(param.value)
  const [num, setNum] = useState(kind === 'number' ? String(param.value) : '')
  const [text, setText] = useState(kind === 'string' ? String(param.value) : '')
  const [bool, setBool] = useState(kind === 'boolean' ? Boolean(param.value) : false)
  const [list, setList] = useState<string[]>(kind === 'string[]' ? [...(param.value as string[])] : [])
  const [json, setJson] = useState(kind === 'json' ? JSON.stringify(param.value, null, 2) : '')
  const [newItem, setNewItem] = useState('')

  let value: unknown = null
  let error: string | undefined
  if (kind === 'number') {
    const n = Number(num.replace(',', '.'))
    if (num.trim() === '' || !Number.isFinite(n)) error = 'Ingrese un número válido'
    else value = n
  } else if (kind === 'string') value = text
  else if (kind === 'boolean') value = bool
  else if (kind === 'string[]') value = list.map((s) => s.trim()).filter(Boolean)
  else {
    try {
      value = JSON.parse(json)
    } catch {
      error = 'JSON inválido'
    }
  }

  const save = useSave(() => api.put(`/parameters/${encodeURIComponent(param.key)}`, { value }), [['parameters']], () => {
    notify.success('Parámetro actualizado')
    onClose()
  })
  return (
    <Modal open size={kind === 'json' || kind === 'string[]' ? 'lg' : 'md'} onOpenChange={(o) => !o && onClose()} title={param.description} description={param.key} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="param-save" disabled={!!error} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      {kind === 'number' && <FormField label="Valor" error={error}><Input data-testid="param-value" inputMode="decimal" value={num} onChange={(e) => setNum(e.target.value)} /></FormField>}
      {kind === 'string' && <FormField label="Valor"><Input data-testid="param-value" value={text} onChange={(e) => setText(e.target.value)} /></FormField>}
      {kind === 'boolean' && <Switch checked={bool} onCheckedChange={setBool} label={bool ? 'Activado' : 'Desactivado'} />}
      {kind === 'string[]' && (
        <div className="space-y-2">
          <ul className="space-y-1.5">
            {list.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <GripVertical className="size-3.5 text-ink-muted" />
                <Input value={item} onChange={(e) => setList((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                <Button iconOnly size="sm" variant="ghost" aria-label="Quitar" onClick={() => setList((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newItem.trim()) { setList((l) => [...l, newItem.trim()]); setNewItem('') } }}>
            <Input placeholder="Nuevo elemento…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
            <Button type="submit" variant="secondary" size="md"><Plus className="size-3.5" /> Agregar</Button>
          </form>
        </div>
      )}
      {kind === 'json' && (
        <FormField label="Valor (JSON)" error={error} hint="Objeto de configuración; se valida antes de guardar.">
          <Textarea data-testid="param-json" rows={10} className="font-mono text-[12px]" value={json} onChange={(e) => setJson(e.target.value)} />
        </FormField>
      )}
    </Modal>
  )
}
