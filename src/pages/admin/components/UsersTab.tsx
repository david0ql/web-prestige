import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, KeyRound, Lock, LockOpen, Plus, X } from 'lucide-react'
import { api, type Paginated } from '@/lib/api/client'
import type { AppUserRow, Role } from '@/lib/api/types'
import { useWorkshops } from '@/lib/hooks/useMasters'
import { useDebounced } from '@/lib/hooks/useDebounced'
import { useUser } from '@/lib/auth/store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { DataTable } from '@/components/domain/DataTable'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { SearchInput } from '@/components/ui/SearchInput'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import { notify } from '@/components/ui/Toaster'
import { ActiveBadge, FormGrid, Muted, SectionBar, compact, mono, strOrNull, useFormState, useSave } from './shared'

export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: () => api.get<Role[]>('/roles') })

/** Política de contraseña de la API (RNF de seguridad). */
const RULES: { label: string; test: (s: string) => boolean }[] = [
  { label: 'Mínimo 10 caracteres', test: (s) => s.length >= 10 },
  { label: 'Una mayúscula', test: (s) => /[A-Z]/.test(s) },
  { label: 'Una minúscula', test: (s) => /[a-z]/.test(s) },
  { label: 'Un número', test: (s) => /\d/.test(s) },
  { label: 'Un símbolo', test: (s) => /[^A-Za-z0-9]/.test(s) },
]
const passwordOk = (s: string) => RULES.every((r) => r.test(s))

function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] sm:grid-cols-3">
      {RULES.map((r) => {
        const ok = r.test(value)
        return (
          <li key={r.label} className={cn('flex items-center gap-1', ok ? 'text-success' : 'text-ink-muted')}>
            {ok ? <Check className="size-3" /> : <X className="size-3" />} {r.label}
          </li>
        )
      })}
    </ul>
  )
}

const isLocked = (u: AppUserRow) => !!u.lockedUntil && new Date(u.lockedUntil) > new Date()

/** Usuarios: alta con rol y taller (segregación), estado, contraseña y desbloqueo. */
export function UsersTab() {
  const roles = useRoles()
  const workshops = useWorkshops()
  const [search, setSearch] = useState('')
  const [roleId, setRoleId] = useState('')
  const [workshopId, setWorkshopId] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search, 300)
  const list = useQuery({ queryKey: ['users', q, roleId, workshopId, page], queryFn: () => api.get<Paginated<AppUserRow>>('/users', { search: q, roleId, workshopId, page, pageSize: 25 }) })
  const [editing, setEditing] = useState<AppUserRow | 'new' | null>(null)
  const [resetting, setResetting] = useState<AppUserRow | null>(null)
  const [unlocking, setUnlocking] = useState<AppUserRow | null>(null)
  const unlock = useSave((u: AppUserRow) => api.post(`/users/${u.id}/unlock`), [['users']], () => {
    notify.success('Usuario desbloqueado')
    setUnlocking(null)
  })

  return (
    <Card flush>
      <SectionBar
        title="Usuarios"
        description="Acceso por mínimo privilegio: los usuarios de taller quedan asociados a un único taller y solo ven su información."
        actions={<Button data-testid="user-new" onClick={() => setEditing('new')}><Plus className="size-4" /> Nuevo usuario</Button>}
      >
        <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1) }} placeholder="Usuario, nombre o correo" className="w-56" />
        <NativeSelect className="w-48" value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1) }} placeholder="Todos los roles" options={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))} />
        <NativeSelect className="w-44" value={workshopId} onChange={(e) => { setWorkshopId(e.target.value); setPage(1) }} placeholder="Todos los talleres" options={(workshops.data ?? []).map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} />
      </SectionBar>
      <DataTable
        testId="users-table"
        loading={list.isLoading}
        rows={list.data?.items}
        rowKey={(u) => u.id}
        pagination={list.data ? { page, pageSize: list.data.pageSize, total: list.data.total, onPageChange: setPage } : undefined}
        columns={[
          {
            key: 'u', header: 'Usuario', cell: (u) => (
              <button className="text-left" onClick={() => setEditing(u)}>
                <span className="block font-medium text-ink hover:text-brand-700">{u.fullName}</span>
                <span className="block text-[12px] text-ink-muted">{u.username} · {u.email}</span>
              </button>
            ),
          },
          { key: 'r', header: 'Rol', cell: (u) => <span className="flex items-center gap-1.5">{u.role?.name}{u.role?.isWorkshopRole && <Badge variant="info">Taller</Badge>}</span> },
          { key: 'w', header: 'Taller', cell: (u) => (u.workshop ? <span><span className={mono}>{u.workshop.code}</span> {u.workshop.name}</span> : <Muted>Oficina Madre</Muted>), hideOnMobile: true },
          { key: 'l', header: 'Último acceso', cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <Muted>Nunca</Muted>), hideOnMobile: true },
          {
            key: 's', header: 'Estado', cell: (u) => (
              <span className="flex flex-wrap gap-1">
                <ActiveBadge active={u.active} />
                {isLocked(u) && <Badge variant="danger"><Lock className="size-3" /> Bloqueado hasta {formatDateTime(u.lockedUntil)}</Badge>}
                {u.mustChangePassword && <Badge variant="warning">Debe cambiar clave</Badge>}
              </span>
            ),
          },
          {
            key: 'act', header: '', align: 'right', cell: (u) => (
              <span className="flex justify-end gap-1">
                {isLocked(u) && <Button size="sm" variant="ghost" data-testid="user-unlock" onClick={() => setUnlocking(u)}><LockOpen className="size-3.5" /> Desbloquear</Button>}
                <Button size="sm" variant="ghost" data-testid="user-reset" onClick={() => setResetting(u)}><KeyRound className="size-3.5" /> Contraseña</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>Editar</Button>
              </span>
            ),
          },
        ]}
      />
      {editing && <UserModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />}
      <ConfirmDialog open={!!unlocking} onOpenChange={(o) => !o && setUnlocking(null)} title="Desbloquear usuario" loading={unlock.isPending} onConfirm={() => unlocking && unlock.mutate(unlocking)}>
        Se reiniciarán los intentos fallidos de <b>{unlocking?.username}</b> y podrá iniciar sesión de inmediato.
      </ConfirmDialog>
    </Card>
  )
}

function UserModal({ user, onClose }: { user: AppUserRow | null; onClose: () => void }) {
  const me = useUser()
  const roles = useRoles()
  const workshops = useWorkshops()
  const [f, set] = useFormState({
    username: user?.username ?? '',
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    roleId: user?.roleId ?? '',
    workshopId: user?.workshopId ?? '',
    password: '',
    mustChangePassword: user?.mustChangePassword ?? true,
    active: user?.active ?? true,
  })
  const role = roles.data?.find((r) => r.id === f.roleId)
  const workshopRole = !!role?.isWorkshopRole
  const [touched, setTouched] = useState(false)
  const errors = {
    username: !user && !/^[a-zA-Z0-9._-]{3,60}$/.test(f.username) ? 'De 3 a 60 caracteres: letras, números, punto, guion' : undefined,
    fullName: !f.fullName.trim() ? 'Obligatorio' : undefined,
    email: !/^\S+@\S+\.\S+$/.test(f.email) ? 'Correo inválido' : undefined,
    roleId: !f.roleId ? 'Seleccione un rol' : undefined,
    workshopId: workshopRole && !f.workshopId ? 'Obligatorio para un rol de taller' : undefined,
    password: !user && !passwordOk(f.password) ? 'No cumple la política' : undefined,
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const save = useSave(
    () => {
      const common = { fullName: f.fullName.trim(), email: f.email.trim(), phone: strOrNull(f.phone), roleId: f.roleId, workshopId: workshopRole ? f.workshopId : null, mustChangePassword: f.mustChangePassword }
      return user
        ? api.patch(`/users/${user.id}`, { ...common, active: f.active })
        : api.post('/users', compact({ ...common, username: f.username.trim(), password: f.password }))
    },
    [['users']],
    () => {
      notify.success(user ? 'Usuario actualizado' : `Usuario ${f.username} creado`)
      onClose()
    },
  )
  const self = user?.id === me?.id
  return (
    <Modal open size="lg" onOpenChange={(o) => !o && onClose()} title={user ? `Usuario ${user.username}` : 'Nuevo usuario'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="user-save" loading={save.isPending} onClick={() => { setTouched(true); if (!hasErrors) save.mutate(undefined) }}>{user ? 'Guardar cambios' : 'Crear usuario'}</Button>
      </>
    }>
      <div className="space-y-3">
        <FormGrid>
          <FormField label="Usuario" required error={touched ? errors.username : undefined}>
            <Input data-testid="user-username" value={f.username} disabled={!!user} autoComplete="off" onChange={(e) => set('username', e.target.value.toLowerCase())} />
          </FormField>
          <FormField label="Nombre completo" required error={touched ? errors.fullName : undefined}>
            <Input data-testid="user-fullname" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </FormField>
          <FormField label="Correo" required error={touched ? errors.email : undefined}>
            <Input data-testid="user-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          </FormField>
          <FormField label="Teléfono"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></FormField>
          <FormField label="Rol" required error={touched ? errors.roleId : undefined}>
            <NativeSelect
              data-testid="user-role"
              value={f.roleId}
              onChange={(e) => {
                set('roleId', e.target.value)
                if (!roles.data?.find((r) => r.id === e.target.value)?.isWorkshopRole) set('workshopId', '')
              }}
              placeholder="Seleccione…"
              options={(roles.data ?? []).filter((r) => r.active || r.id === f.roleId).map((r) => ({ value: r.id, label: `${r.name}${r.isWorkshopRole ? ' (taller)' : ''}` }))}
            />
          </FormField>
          <FormField
            label="Taller asociado"
            required={workshopRole}
            error={touched ? errors.workshopId : undefined}
            hint={workshopRole ? 'El usuario solo verá las órdenes, entregas y materiales de este taller.' : 'Solo los roles de taller tienen taller asociado.'}
          >
            <NativeSelect data-testid="user-workshop" value={f.workshopId} disabled={!workshopRole} onChange={(e) => set('workshopId', e.target.value)} placeholder={workshopRole ? 'Seleccione taller…' : 'No aplica'} options={(workshops.data ?? []).map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} />
          </FormField>
        </FormGrid>
        {!user && (
          <FormField label="Contraseña inicial" required error={touched ? errors.password : undefined}>
            <div>
              <Input data-testid="user-password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} />
              <PasswordChecklist value={f.password} />
            </div>
          </FormField>
        )}
        <div className="flex flex-wrap gap-5 pt-1">
          <Switch checked={f.mustChangePassword} onCheckedChange={(v) => set('mustChangePassword', v)} label="Debe cambiar la contraseña al ingresar" />
          {user && <Switch checked={f.active} disabled={self} onCheckedChange={(v) => set('active', v)} label={self ? 'Activo (no puede desactivarse a sí mismo)' : 'Usuario activo'} />}
        </div>
        {user && (
          <p className="text-[12px] text-ink-muted">
            Último acceso: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'nunca'}
            {isLocked(user) && <> · <span className="text-danger">bloqueado hasta {formatDateTime(user.lockedUntil)}</span></>}
          </p>
        )}
      </div>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose }: { user: AppUserRow; onClose: () => void }) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const ok = passwordOk(pwd) && pwd === confirm
  const save = useSave(() => api.post(`/users/${user.id}/reset-password`, { password: pwd }), [['users']], () => {
    notify.success(`Contraseña de ${user.username} restablecida`)
    onClose()
  })
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Restablecer contraseña · ${user.username}`} description="El usuario deberá usar esta contraseña en su próximo ingreso." footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button data-testid="user-reset-save" disabled={!ok} loading={save.isPending} onClick={() => save.mutate(undefined)}>Restablecer</Button>
      </>
    }>
      <div className="space-y-3">
        <FormField label="Nueva contraseña" required>
          <div>
            <Input type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <PasswordChecklist value={pwd} />
          </div>
        </FormField>
        <FormField label="Confirmar contraseña" required error={confirm && confirm !== pwd ? 'No coincide' : undefined}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
