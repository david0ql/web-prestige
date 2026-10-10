import { useState } from 'react'
import { Camera, Flag, Plus, Video } from 'lucide-react'
import { api } from '@/lib/api/client'
import type { ProductionStage } from '@/lib/api/types'
import { useFamilies, useStages } from '@/lib/hooks/useMasters'
import { DataTable } from '@/components/domain/DataTable'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { notify } from '@/components/ui/Toaster'
import { ActiveBadge, FormGrid, Muted, SectionBar, compact, mono, strOrNull, toNum, useFormState, useSave } from './shared'

/** Etapas de fabricación y evidencias obligatorias (RN-013). */
export function StagesTab() {
  const stages = useStages()
  const [editing, setEditing] = useState<ProductionStage | 'new' | null>(null)
  const rows = [...(stages.data ?? [])].sort((a, b) => a.sequence - b.sequence)
  return (
    <Card flush>
      <SectionBar
        title="Etapas de fabricación y evidencias"
        description="RN-013 · las fotos y videos son evidencia obligatoria en las etapas que lo exigen y conforman la historia visual de la pieza."
        actions={<Button data-testid="stage-new" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva etapa</Button>}
      />
      <DataTable
        testId="stages-table"
        loading={stages.isLoading}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={setEditing}
        columns={[
          { key: 'seq', header: '#', align: 'center', cell: (s) => <span className="inline-flex size-6 items-center justify-center rounded-full bg-sunken text-[12px] font-semibold tnum">{s.sequence}</span> },
          { key: 'c', header: 'Código', cell: (s) => <span className={mono}>{s.code}</span> },
          { key: 'n', header: 'Etapa', cell: (s) => <span className="font-medium">{s.name}</span> },
          { key: 'm', header: 'Obligatoria', cell: (s) => (s.mandatory ? <Badge variant="warning">Obligatoria</Badge> : <Muted>Opcional</Muted>) },
          {
            key: 'ev', header: 'Evidencias', cell: (s) => (
              <span className="flex flex-wrap gap-1">
                {s.requiresPhoto && <Badge variant="info"><Camera className="size-3" /> {s.minPhotos || 1} foto{(s.minPhotos || 1) > 1 ? 's' : ''} mín.</Badge>}
                {s.requiresVideo && <Badge variant="info"><Video className="size-3" /> Video</Badge>}
                {!s.requiresPhoto && !s.requiresVideo && <Muted>—</Muted>}
              </span>
            ),
          },
          { key: 'f', header: 'Final', cell: (s) => (s.isFinal ? <Badge variant="gold"><Flag className="size-3" /> Final</Badge> : null), hideOnMobile: true },
          { key: 'fam', header: 'Familias', cell: (s) => (s.families?.length ? s.families.map((f) => f.name).join(', ') : <Muted>Todas</Muted>), hideOnMobile: true },
          { key: 'a', header: 'Estado', cell: (s) => <ActiveBadge active={s.active} /> },
        ]}
      />
      {editing && <StageModal stage={editing === 'new' ? null : editing} nextSeq={(rows.at(-1)?.sequence ?? 0) + 1} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function StageModal({ stage, nextSeq, onClose }: { stage: ProductionStage | null; nextSeq: number; onClose: () => void }) {
  const families = useFamilies()
  const [f, set] = useFormState({
    code: stage?.code ?? '',
    name: stage?.name ?? '',
    description: stage?.description ?? '',
    sequence: String(stage?.sequence ?? nextSeq),
    mandatory: stage?.mandatory ?? true,
    requiresPhoto: stage?.requiresPhoto ?? true,
    requiresVideo: stage?.requiresVideo ?? false,
    minPhotos: String(stage?.minPhotos ?? 1),
    isFinal: stage?.isFinal ?? false,
    active: stage?.active ?? true,
    familyIds: stage?.families?.map((x) => x.id) ?? [],
  })
  const seq = toNum(f.sequence)
  const save = useSave(
    () => {
      const body = {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        description: strOrNull(f.description),
        sequence: seq,
        mandatory: f.mandatory,
        requiresPhoto: f.requiresPhoto,
        requiresVideo: f.requiresVideo,
        minPhotos: f.requiresPhoto ? (toNum(f.minPhotos) ?? 1) : 0,
        isFinal: f.isFinal,
        active: f.active,
        familyIds: f.familyIds,
      }
      return stage ? api.patch(`/production-stages/${stage.id}`, body) : api.post('/production-stages', compact(body))
    },
    [['stages']],
    () => {
      notify.success('Etapa guardada')
      onClose()
    },
  )
  return (
    <Modal open size="lg" onOpenChange={(o) => !o && onClose()} title={stage ? `Etapa ${stage.name}` : 'Nueva etapa de fabricación'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="stage-save" disabled={!f.code || !f.name || !seq || seq < 1} loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid cols={4}>
          <FormField label="Secuencia" required><Input inputMode="numeric" value={f.sequence} onChange={(e) => set('sequence', e.target.value)} /></FormField>
          <FormField label="Código" required><Input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className="font-mono" /></FormField>
          <FormField label="Nombre" required className="lg:col-span-2"><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></FormField>
        </FormGrid>
        <FormField label="Descripción"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} /></FormField>
        <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-sunken/40 p-3 sm:grid-cols-2">
          <Switch checked={f.mandatory} onCheckedChange={(v) => set('mandatory', v)} label="Etapa obligatoria" />
          <Switch checked={f.isFinal} onCheckedChange={(v) => set('isFinal', v)} label="Etapa final (cierra la fabricación)" />
          <div className="flex items-center gap-3">
            <Switch checked={f.requiresPhoto} onCheckedChange={(v) => set('requiresPhoto', v)} label="Requiere foto" />
            {f.requiresPhoto && (
              <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                mínimo <Input inputSize="sm" className="w-14" inputMode="numeric" value={f.minPhotos} onChange={(e) => set('minPhotos', e.target.value)} />
              </span>
            )}
          </div>
          <Switch checked={f.requiresVideo} onCheckedChange={(v) => set('requiresVideo', v)} label="Requiere video" />
        </div>
        <FormField label="Familias aplicables" hint="Vacío = aplica a todas las familias">
          <MultiSelect values={f.familyIds} onValuesChange={(v) => set('familyIds', v)} options={(families.data ?? []).map((x) => ({ value: x.id, label: x.name }))} placeholder="Todas las familias" />
        </FormField>
        <Switch checked={f.active} onCheckedChange={(v) => set('active', v)} label="Etapa activa" />
      </div>
    </Modal>
  )
}
