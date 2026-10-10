import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { api, errorMessage } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { AuthLayout } from './AuthLayout'
import { PasswordRules, passwordValid } from './PasswordRules'

export default function ResetPasswordPage() {
  const { token } = useSearch({ from: '/restablecer' })
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  return (
    <AuthLayout>
      <h1 className="text-[22px] font-bold text-ink">Nueva contraseña</h1>
      {done ? (
        <div className="mt-6 space-y-4">
          <p className="flex gap-2 rounded-md border border-success/30 bg-success-bg p-4 text-[13px] text-success">
            <CheckCircle2 className="size-5" /> Contraseña actualizada. Todas las sesiones anteriores fueron cerradas.
          </p>
          <Link to="/login" className="block text-center text-[13px] font-semibold text-brand-700">Ir a iniciar sesión</Link>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setLoading(true)
            setError(null)
            try {
              await api.post('/auth/reset-password', { token, newPassword: pwd })
              setDone(true)
            } catch (err) {
              setError(errorMessage(err))
            } finally {
              setLoading(false)
            }
          }}
        >
          <FormField label="Nueva contraseña">
            <Input inputSize="lg" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
          </FormField>
          <FormField label="Confirmar contraseña" error={confirm && confirm !== pwd ? 'No coincide' : undefined}>
            <Input inputSize="lg" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </FormField>
          <PasswordRules value={pwd} />
          {!token && <p className="text-[13px] text-danger">Enlace inválido: solicite uno nuevo.</p>}
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={!token || !passwordValid(pwd) || pwd !== confirm} loading={loading}>Guardar contraseña</Button>
        </form>
      )}
    </AuthLayout>
  )
}
