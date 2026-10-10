import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { api, errorMessage } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { AuthLayout } from './AuthLayout'

/** P01 · Recuperación de acceso por correo. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  return (
    <AuthLayout>
      <h1 className="text-[22px] font-bold text-ink">Recuperar acceso</h1>
      <p className="mt-1 text-[13px] text-ink-muted">Le enviaremos un enlace para restablecer su contraseña (vence en 30 minutos).</p>
      {sent ? (
        <div className="mt-6 flex gap-3 rounded-md border border-success/30 bg-success-bg p-4 text-[13px] text-success" data-testid="forgot-sent">
          <MailCheck className="size-5 shrink-0" />
          {sent}
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setLoading(true)
            setError(null)
            try {
              const r = await api.post<{ message: string }>('/auth/forgot-password', { email })
              setSent(r.message)
            } catch (err) {
              setError(errorMessage(err))
            } finally {
              setLoading(false)
            }
          }}
        >
          <FormField label="Correo electrónico">
            <Input inputSize="lg" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" />
          </FormField>
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading} data-testid="forgot-submit">Enviar enlace</Button>
        </form>
      )}
      <div className="mt-6 text-center">
        <Link to="/login" className="text-[13px] font-medium text-brand-700 hover:underline">Volver a iniciar sesión</Link>
      </div>
    </AuthLayout>
  )
}
