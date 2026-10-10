import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import type { FieldError } from 'react-hook-form'
import { cn } from '@/lib/cn'

interface FormFieldProps {
  label: string
  /** Error de react-hook-form (`formState.errors.campo`) o mensaje directo. */
  error?: FieldError | string
  hint?: string
  required?: boolean
  /** Se enlaza automáticamente al control hijo vía id/htmlFor si no se pasa. */
  htmlFor?: string
  children: ReactNode
  className?: string
}

/**
 * Campo de formulario: etiqueta eyebrow + control + error/hint.
 * Uso con react-hook-form:
 * ```tsx
 * <FormField label="Correo electrónico" error={errors.email} required>
 *   <Input type="email" {...register('email')} />
 * </FormField>
 * ```
 */
export function FormField({
  label,
  error,
  hint,
  required = false,
  htmlFor,
  children,
  className,
}: FormFieldProps) {
  const autoId = useId()
  const fieldId = htmlFor ?? autoId
  const message = typeof error === 'string' ? error : error?.message

  // Inyecta id + invalid al control hijo si es un solo elemento sin id propio.
  let control = children
  if (!htmlFor && isValidElement(children)) {
    const child = children as ReactElement<{ id?: string; invalid?: boolean }>
    control = cloneElement(child, {
      id: child.props.id ?? fieldId,
      ...(message ? { invalid: true } : {}),
    })
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={fieldId} className="eyebrow">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {control}
      {message ? (
        <p className="text-[12px] text-danger" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}
