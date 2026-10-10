import { useState } from 'react'
import { Popover } from 'radix-ui'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Grid de calendario (es, semana inicia lunes)                        */
/* ------------------------------------------------------------------ */

interface CalendarGridProps {
  /** Día clickeado. */
  onSelectDay: (day: Date) => void
  /** ¿El día está seleccionado (extremo)? */
  isSelected: (day: Date) => boolean
  /** ¿El día está dentro de un rango? */
  isInRange?: (day: Date) => boolean
  initialMonth?: Date
}

function CalendarGrid({ onSelectDay, isSelected, isInRange, initialMonth }: CalendarGridProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initialMonth ?? new Date()))

  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(gridStart, i), 'EEEEEE', { locale: es }),
  )

  const monthLabel = format(viewMonth, 'LLLL yyyy', { locale: es })

  return (
    <div className="w-64 p-3 select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-ink-muted hover:bg-sunken hover:text-ink"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[13px] font-semibold text-ink capitalize">{monthLabel}</span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-ink-muted hover:bg-sunken hover:text-ink"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {weekdays.map((day) => (
          <span key={day} className="flex h-7 items-center justify-center text-[11px] font-semibold text-ink-muted">
            {day}
          </span>
        ))}
        {days.map((day) => {
          const selected = isSelected(day)
          const inRange = isInRange?.(day) ?? false
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex h-7 cursor-pointer items-center justify-center rounded-sm text-[13px] tnum',
                'transition-colors duration-120 ease-out',
                !isSameMonth(day, viewMonth) && 'text-ink-placeholder',
                isSameMonth(day, viewMonth) && !selected && 'text-ink hover:bg-sunken',
                inRange && !selected && 'rounded-none bg-brand-50 text-brand-800',
                isToday(day) && !selected && 'font-semibold text-brand-600',
                selected && 'bg-brand-600 font-medium text-white',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Trigger compartido                                                  */
/* ------------------------------------------------------------------ */

function TriggerButton({
  label,
  hasValue,
  disabled,
  invalid,
  className,
  id,
}: {
  label: string
  hasValue: boolean
  disabled?: boolean
  invalid?: boolean
  className?: string
  id?: string
}) {
  return (
    <Popover.Trigger
      id={id}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm border border-border-strong bg-surface px-2.5 text-[13px]',
        'transition-colors duration-120 ease-out hover:border-ink-placeholder',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted',
        invalid && 'border-danger',
        className,
      )}
    >
      <CalendarIcon className="size-3.5 shrink-0 text-ink-muted" />
      <span className={cn('truncate', hasValue ? 'text-ink' : 'text-ink-placeholder')}>{label}</span>
    </Popover.Trigger>
  )
}

const popoverContentClass =
  'z-50 rounded-md border border-border bg-surface shadow-overlay animate-scale-in'

/* ------------------------------------------------------------------ */
/* DatePicker                                                          */
/* ------------------------------------------------------------------ */

interface DatePickerProps {
  value: Date | null
  onValueChange: (date: Date | null) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  id?: string
}

export function DatePicker({
  value,
  onValueChange,
  placeholder = 'Selecciona una fecha',
  disabled,
  invalid,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <TriggerButton
        id={id}
        label={value ? formatDate(value) : placeholder}
        hasValue={!!value}
        disabled={disabled}
        invalid={invalid}
        className={className}
      />
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className={popoverContentClass}>
          <CalendarGrid
            initialMonth={value ?? undefined}
            isSelected={(day) => (value ? isSameDay(day, value) : false)}
            onSelectDay={(day) => {
              onValueChange(value && isSameDay(day, value) ? null : day)
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/* ------------------------------------------------------------------ */
/* DateRangePicker                                                     */
/* ------------------------------------------------------------------ */

export interface DateRange {
  from: Date | null
  to: Date | null
}

interface DateRangePickerProps {
  value: DateRange
  onValueChange: (range: DateRange) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  id?: string
}

export function DateRangePicker({
  value,
  onValueChange,
  placeholder = 'Selecciona un rango',
  disabled,
  invalid,
  className,
  id,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const label =
    value.from && value.to
      ? `${formatDate(value.from)} – ${formatDate(value.to)}`
      : value.from
        ? `${formatDate(value.from)} – …`
        : placeholder

  function handleSelect(day: Date) {
    if (!value.from || (value.from && value.to)) {
      onValueChange({ from: day, to: null })
      return
    }
    // Segundo click: cierra el rango (invierte si es anterior al inicio)
    if (isAfter(value.from, day)) {
      onValueChange({ from: day, to: value.from })
    } else {
      onValueChange({ from: value.from, to: day })
    }
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <TriggerButton
        id={id}
        label={label}
        hasValue={!!value.from}
        disabled={disabled}
        invalid={invalid}
        className={className}
      />
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className={popoverContentClass}>
          <CalendarGrid
            initialMonth={value.from ?? undefined}
            isSelected={(day) =>
              (value.from ? isSameDay(day, value.from) : false) ||
              (value.to ? isSameDay(day, value.to) : false)
            }
            isInRange={(day) =>
              value.from && value.to
                ? isWithinInterval(day, { start: value.from, end: value.to })
                : false
            }
            onSelectDay={handleSelect}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
