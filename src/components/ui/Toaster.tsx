import { Toaster as SonnerToaster, toast } from 'sonner'

/** Re-export de sonner con estilos de los tokens del sistema. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={8}
      toastOptions={{
        style: {
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-overlay)',
          color: 'var(--color-ink)',
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
        },
      }}
    />
  )
}

export { toast }

/** Helpers con mensajes por defecto en español. */
export const notify = {
  success(message = 'Cambios guardados') {
    toast.success(message)
  },
  error(message = 'Ocurrió un error. Intenta de nuevo.') {
    toast.error(message)
  },
  info(message: string) {
    toast.info(message)
  },
}
