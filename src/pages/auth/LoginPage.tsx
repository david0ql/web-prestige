import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { api, errorMessage } from '@/lib/api/client'
import { useAuthStore, type AuthUser } from '@/lib/auth/store'
import { ROLE_HOME } from '@/components/layout/nav'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  username: z.string().trim().min(1, 'Ingrese su usuario o correo'),
  password: z.string().min(1, 'Ingrese su contraseña'),
})
type Form = z.infer<typeof schema>

/** P01 · Inicio de sesión para Oficina Madre y talleres. */
export default function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: '/login' })
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    setError(null)
    try {
      const res = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', data)
      useAuthStore.getState().setSession(res.accessToken, res.user)
      const home = ROLE_HOME(!!res.user.workshopId, res.user.permissions)
      void navigate({ to: redirect && redirect.startsWith('/') && !redirect.startsWith('/login') ? redirect : home })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-[24px] font-bold tracking-tight text-ink">Bienvenido</h1>
      <p className="mt-1 text-[13px] text-ink-muted">Ingrese con su usuario de Oficina Madre o de taller.</p>
      <form className="mt-7 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Usuario o correo" error={formState.errors.username}>
          <Input inputSize="lg" autoComplete="username" autoFocus data-testid="login-username" {...register('username')} />
        </FormField>
        <FormField label="Contraseña" error={formState.errors.password}>
          <div className="relative">
            <Input inputSize="lg" type={show ? 'text' : 'password'} autoComplete="current-password" data-testid="login-password" className="pr-10" {...register('password')} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </FormField>
        {error && (
          <p role="alert" data-testid="login-error" className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full shadow-gold" loading={formState.isSubmitting} data-testid="login-submit">
          <LogIn className="size-4" /> Ingresar
        </Button>
        <div className="text-center">
          <Link to="/recuperar" className="text-[13px] font-medium text-brand-700 hover:underline">¿Olvidaste tu contraseña?</Link>
        </div>
      </form>
      <p className="mt-10 text-center text-[11px] text-ink-placeholder">Acceso seguro · sesión cifrada · bitácora de accesos</p>
    </AuthLayout>
  )
}
