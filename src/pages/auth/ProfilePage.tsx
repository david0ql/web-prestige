import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { ROLE_HOME } from '@/components/layout/nav'
import { api } from '@/lib/api/client'
import { useAuthStore, useUser } from '@/lib/auth/store'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { notify } from '@/components/ui/Toaster'
import { PasswordRules, passwordValid } from './PasswordRules'

export default function ProfilePage() {
  const user = useUser()
  const forced = !!user?.mustChangePassword
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const change = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      notify.success('Contraseña actualizada. Las demás sesiones fueron cerradas.')
      setCurrent('')
      setNext('')
      setConfirm('')
      if (user && forced) {
        useAuthStore.getState().setUser({ ...user, mustChangePassword: false })
        void navigate({ to: ROLE_HOME(!!user.workshopId, user.permissions) })
      }
    },
  })
  return (
    <div className="max-w-3xl">
      <PageHeader title="Mi perfil" description="Datos de acceso y seguridad de la cuenta." />
      {forced && (
        <div role="alert" data-testid="must-change-password" className="mb-4 flex items-start gap-3 rounded-md border border-warning/40 bg-warning-bg p-4 text-[14px] text-ink">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-semibold">Cambie su contraseña para continuar</p>
            <p className="text-ink-secondary">Está usando una contraseña inicial o restablecida. Por seguridad debe definir una propia antes de usar el sistema.</p>
          </div>
          <Button size="sm" variant="ghost" data-testid="forced-logout" onClick={async () => { try { await api.post('/auth/logout') } catch { /* sesión expirada */ } useAuthStore.getState().clear(); qc.clear(); void navigate({ to: '/login' }) }}>Cerrar sesión</Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Cuenta">
          <dl className="space-y-2 text-[13px]">
            <div><dt className="eyebrow">Nombre</dt><dd>{user?.fullName}</dd></div>
            <div><dt className="eyebrow">Usuario</dt><dd>{user?.username}</dd></div>
            <div><dt className="eyebrow">Correo</dt><dd>{user?.email}</dd></div>
            <div><dt className="eyebrow">Rol</dt><dd><Badge variant="gold">{user?.roleName}</Badge></dd></div>
            {user?.workshopCode && <div><dt className="eyebrow">Taller</dt><dd>{user.workshopCode}</dd></div>}
          </dl>
        </Card>
        <Card title="Cambiar contraseña">
          <div className="space-y-3">
            <FormField label="Contraseña actual"><Input type="password" data-testid="profile-current" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></FormField>
            <FormField label="Nueva contraseña"><Input type="password" data-testid="profile-new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></FormField>
            <FormField label="Confirmar" error={confirm && confirm !== next ? 'No coincide' : undefined}><Input type="password" data-testid="profile-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></FormField>
            <PasswordRules value={next} />
            <Button data-testid="profile-submit" disabled={!current || !passwordValid(next) || next !== confirm} loading={change.isPending} onClick={() => change.mutate()}>Actualizar contraseña</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
