import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Lock, Plus, ShieldCheck } from 'lucide-react'
import { api, errorMessage } from '@/lib/api/client'
import type { Role } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { FormField } from '@/components/ui/FormField'
import { Checkbox } from '@/components/ui/Checkbox'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { notify } from '@/components/ui/Toaster'
import { FormGrid, SectionBar } from './shared'
import { useRoles } from './UsersTab'

interface PermissionDef { code: string; label: string }

const MODULE_LABEL: Record<string, string> = {
  users: 'Usuarios', roles: 'Roles', params: 'Parámetros', audit: 'Auditoría', reversals: 'Reversos', masters: 'Maestros', catalog: 'Catálogo técnico',
  scale: 'Balanza', inventory: 'Inventario', orders: 'Órdenes de producción', requests: 'Solicitudes de material', discrepancies: 'Diferencias / mermas',
  labor: 'Mano de obra', quality: 'Calidad y ley', media: 'Evidencias', customers: 'Clientes', sales: 'Ventas', payments: 'Abonos',
  customer_material: 'Material de clientes', finance: 'Finanzas', dashboard: 'Dashboard', reports: 'Reportes', alerts: 'Alertas', workshop: 'Portal de taller',
}

/** Permisos que la API prohíbe a un rol de taller (RN-009, segregación de funciones). */
const WORKSHOP_FORBIDDEN = new Set([
  'orders.approve', 'labor.approve', 'discrepancies.approve', 'finance.read', 'finance.manage', 'finance.close', 'reports.financial',
  'dashboard.office', 'inventory.read', 'users.manage', 'roles.manage', 'audit.read', 'customers.read', 'reports.read',
])

/** Roles y permisos (sección 11): matriz de permisos por módulo. */
export function RolesTab() {
  const roles = useRoles()
  const perms = useQuery({ queryKey: ['roles', 'permissions'], queryFn: () => api.get<PermissionDef[]>('/roles/permissions'), staleTime: 5 * 60_000 })
  const [selected, setSelected] = useState<string | 'new' | null>(null)
  const current = selected === 'new' ? null : (roles.data?.find((r) => r.id === selected) ?? roles.data?.[0] ?? null)
  const key = selected === 'new' ? 'new' : (current?.id ?? 'none')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
      <Card flush>
        <SectionBar title="Roles" actions={<Button size="sm" data-testid="role-new" onClick={() => setSelected('new')}><Plus className="size-3.5" /> Nuevo rol</Button>} />
        {roles.isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <ul className="divide-y divide-border">
            {roles.data?.map((r) => (
              <li key={r.id}>
                <button
                  data-testid={`role-item-${r.code}`}
                  onClick={() => setSelected(r.id)}
                  className={cn('flex w-full flex-col items-start gap-1 px-4 py-2.5 text-left hover:bg-sunken/60', current?.id === r.id && selected !== 'new' && 'bg-brand-50/70')}
                >
                  <span className="flex w-full items-center gap-1.5 text-[13px] font-medium text-ink">
                    {r.name}
                    {!r.active && <Badge>Inactivo</Badge>}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-[11px] text-ink-muted">
                    <span className="font-mono">{r.code}</span> · {r.permissions.length} permisos
                    {r.isSystem && <Badge variant="neutral" className="h-[18px] text-[11px]"><Lock className="size-2.5" /> Sistema</Badge>}
                    {r.isWorkshopRole && <Badge variant="info" className="h-[18px] text-[11px]">Taller</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {perms.data && (selected === 'new' || current) ? (
        <RoleEditor key={key} role={current} perms={perms.data} onCreated={(r) => setSelected(r.id)} />
      ) : (
        <Card><EmptyState icon={ShieldCheck} title="Seleccione un rol" /></Card>
      )}
    </div>
  )
}

function RoleEditor({ role, perms, onCreated }: { role: Role | null; perms: PermissionDef[]; onCreated: (r: Role) => void }) {
  const qc = useQueryClient()
  const [code, setCode] = useState(role?.code ?? '')
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [isWorkshopRole, setWorkshopRole] = useState(role?.isWorkshopRole ?? false)
  const [active, setActive] = useState(role?.active ?? true)
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []))
  const [apiError, setApiError] = useState<string | null>(null)

  const groups = useMemo(() => {
    const m = new Map<string, PermissionDef[]>()
    for (const p of perms) {
      const mod = p.code.split('.')[0]
      m.set(mod, [...(m.get(mod) ?? []), p])
    }
    return [...m.entries()]
  }, [perms])

  const conflicts = isWorkshopRole ? [...selected].filter((p) => WORKSHOP_FORBIDDEN.has(p)) : []
  const toggle = (c: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(c); else n.delete(c); return n })
  const toggleGroup = (items: PermissionDef[], on: boolean) => setSelected((s) => { const n = new Set(s); items.forEach((p) => (on ? n.add(p.code) : n.delete(p.code))); return n })

  const save = useMutation({
    meta: { silent: true },
    mutationFn: () => {
      const permissions = [...selected]
      return role
        ? api.patch<Role>(`/roles/${role.id}`, { name: name.trim(), description: description.trim() || null, permissions, isWorkshopRole, active })
        : api.post<Role>('/roles', { code, name: name.trim(), description: description.trim() || undefined, permissions, isWorkshopRole })
    },
    onSuccess: (r) => {
      setApiError(null)
      void qc.invalidateQueries({ queryKey: ['roles'] })
      notify.success(role ? 'Permisos del rol actualizados' : `Rol ${r.code} creado`)
      if (!role) onCreated(r)
    },
    onError: (e) => {
      setApiError(errorMessage(e))
      notify.error(errorMessage(e))
    },
  })
  const codeOk = /^[A-Z0-9_]{2,40}$/.test(code)

  return (
    <Card flush>
      <SectionBar
        title={role ? role.name : 'Nuevo rol personalizado'}
        description={role?.isSystem ? 'Rol de sistema: el código y el tipo no cambian, pero sus permisos son configurables.' : 'Defina los permisos con la matriz por módulo.'}
        actions={<Button data-testid="role-save" loading={save.isPending} disabled={!name.trim() || (!role && !codeOk)} onClick={() => save.mutate()}>{role ? 'Guardar permisos' : 'Crear rol'}</Button>}
      />
      <div className="space-y-4 p-4">
        <FormGrid cols={3}>
          <FormField label="Código" required hint="MAYÚSCULAS_Y_GUION_BAJO">
            <Input data-testid="role-code" value={code} disabled={!!role} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} className="font-mono" />
          </FormField>
          <FormField label="Nombre" required className="sm:col-span-2"><Input data-testid="role-name" value={name} onChange={(e) => setName(e.target.value)} /></FormField>
        </FormGrid>
        <FormField label="Descripción"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></FormField>
        <div className="flex flex-wrap gap-5">
          <Switch checked={isWorkshopRole} disabled={role?.isSystem} onCheckedChange={setWorkshopRole} label="Rol de taller (usuarios asociados a un taller)" />
          {role && <Switch checked={active} disabled={role.isSystem} onCheckedChange={setActive} label="Rol activo" />}
        </div>
        {isWorkshopRole && (
          <div data-testid="role-segregation-warning" className="flex gap-2.5 rounded-md border border-warning/30 bg-warning-bg px-3 py-2.5 text-[12px] text-ink-secondary">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="font-semibold text-warning">Segregación de funciones (RN-009)</p>
              <p>Un rol de taller no puede aprobar producción, costos ni diferencias, ni consultar finanzas, inventario global, clientes, reportes o auditoría. Los permisos marcados con <Lock className="inline size-3" /> serán rechazados.</p>
              {conflicts.length > 0 && <p className="mt-1 font-medium text-danger">Conflictos seleccionados: {conflicts.join(', ')}</p>}
            </div>
          </div>
        )}
        {apiError && <div data-testid="role-api-error" className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-[13px] text-danger">{apiError}</div>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="role-matrix">
          {groups.map(([mod, items]) => {
            const count = items.filter((p) => selected.has(p.code)).length
            const all = count === items.length
            return (
              <div key={mod} className="rounded-md border border-border">
                <div className="flex items-center justify-between border-b border-border bg-sunken/60 px-3 py-1.5">
                  <Checkbox
                    checked={all ? true : count > 0 ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleGroup(items, v === true)}
                    label={MODULE_LABEL[mod] ?? mod}
                    className="[&_label]:font-semibold"
                  />
                  <span className="text-[11px] text-ink-muted tnum">{count}/{items.length}</span>
                </div>
                <ul className="space-y-1.5 px-3 py-2">
                  {items.map((p) => {
                    const forbidden = isWorkshopRole && WORKSHOP_FORBIDDEN.has(p.code)
                    return (
                      <li key={p.code} className="flex items-center justify-between gap-2" title={p.code}>
                        <Checkbox checked={selected.has(p.code)} onCheckedChange={(v) => toggle(p.code, v === true)} label={p.label} className={cn(forbidden && selected.has(p.code) && '[&_label]:text-danger')} />
                        {forbidden && <Lock className="size-3 shrink-0 text-warning" aria-label="Prohibido para rol de taller" />}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
