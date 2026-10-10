import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { useUser } from '@/lib/auth/store'
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
    },
  })
  return (
    <div className="max-w-3xl">
      <PageHeader title="Mi perfil" description="Datos de acceso y seguridad de la cuenta." />
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
            <FormField label="Contraseña actual"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></FormField>
            <FormField label="Nueva contraseña"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></FormField>
            <FormField label="Confirmar" error={confirm && confirm !== next ? 'No coincide' : undefined}><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></FormField>
            <PasswordRules value={next} />
            <Button disabled={!current || !passwordValid(next) || next !== confirm} loading={change.isPending} onClick={() => change.mutate()}>Actualizar contraseña</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
