import * as React from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { monthNames, weekdayNames } from '../../lib/i18n'
import type { DateFormatPref, Language } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Popover, useDismissable } from './picker'

function toIso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseIso(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month: (month || 1) - 1, day: day || 1 }
}

export function formatDisplayDate(value: string, language: Language, format: DateFormatPref = 'ddMMMyyyy') {
  if (!value) return ''
  const { year, month, day } = parseIso(value)
  if (format === 'ddmmyyyy') {
    return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
  }
  return `${day} ${monthNames[language][month]?.slice(0, language === 'hi' ? undefined : 3)} ${year}`
}

/* Every date picker in the app blocks future dates — a bill or a payment
   can only ever be logged for today or earlier. */
export function DatePicker({
  value,
  onChange,
  language,
  dateFormat,
  className,
  align = 'left',
}: {
  value: string
  onChange: (value: string) => void
  language: Language
  dateFormat?: DateFormatPref
  className?: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = React.useState(false)
  const close = React.useCallback(() => setOpen(false), [])
  const ref = useDismissable(open, close)
  const selected = parseIso(value || new Date().toISOString().slice(0, 10))
  const [view, setView] = React.useState({ year: selected.year, month: selected.month })
  // clicking the header swaps the day grid for a month/year quick-jump
  const [mode, setMode] = React.useState<'days' | 'months'>('days')

  React.useEffect(() => {
    if (open) {
      setView({ year: selected.year, month: selected.month })
      setMode('days')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const today = new Date()
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate())
  const isCurrentOrFutureMonth = view.year > today.getFullYear() || (view.year === today.getFullYear() && view.month >= today.getMonth())

  const firstWeekday = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()

  function shiftMonth(delta: number) {
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const anchorRef = React.useRef<HTMLButtonElement>(null)

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'pressable flex h-12 w-full items-center gap-2.5 rounded-[var(--radius-control)] border border-input bg-card px-3.5 text-left text-[15px] hover:border-border-strong focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40',
          open && 'border-primary ring-2 ring-ring/40',
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn('tnum truncate', !value && 'text-muted-foreground')}>
          {value ? formatDisplayDate(value, language, dateFormat) : '—'}
        </span>
      </button>

      <Popover open={open} anchorRef={anchorRef} align={align} width={288} className="p-3">
        <div role="dialog">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => (mode === 'days' ? shiftMonth(-1) : setView((current) => ({ ...current, year: current.year - 1 })))}
              className="pressable flex h-8 w-8 items-center justify-center rounded-lg text-secondary-text hover:bg-fill"
              aria-label={mode === 'days' ? 'Previous month' : 'Previous year'}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMode((current) => (current === 'days' ? 'months' : 'days'))}
              className="pressable rounded-md px-2 py-1 text-sm font-medium hover:bg-fill"
            >
              {mode === 'days' ? (
                <>
                  {monthNames[language][view.month]} <span className="tnum">{view.year}</span>
                </>
              ) : (
                <span className="tnum">{view.year}</span>
              )}
            </button>
            <button
              type="button"
              disabled={mode === 'days' ? isCurrentOrFutureMonth : view.year >= today.getFullYear()}
              onClick={() => (mode === 'days' ? shiftMonth(1) : setView((current) => ({ ...current, year: current.year + 1 })))}
              className="pressable flex h-8 w-8 items-center justify-center rounded-lg text-secondary-text hover:bg-fill disabled:pointer-events-none disabled:opacity-30"
              aria-label={mode === 'days' ? 'Next month' : 'Next year'}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {mode === 'months' ? (
            <div className="grid grid-cols-3 gap-1.5">
              {monthNames[language].map((name, month) => {
                const isFuture = view.year > today.getFullYear() || (view.year === today.getFullYear() && month > today.getMonth())
                const isSelected = month === view.month && view.year === selected.year
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={isFuture}
                    onClick={() => {
                      setView((current) => ({ ...current, month }))
                      setMode('days')
                    }}
                    className={cn(
                      'pressable rounded-lg py-2.5 text-center text-sm hover:bg-fill disabled:pointer-events-none disabled:opacity-30',
                      isSelected && 'bg-primary font-medium text-primary-foreground hover:bg-primary-pressed',
                    )}
                  >
                    {name.slice(0, language === 'hi' ? undefined : 3)}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-0.5">
              {weekdayNames[language].map((day, index) => (
                <p key={index} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
                  {day}
                </p>
              ))}
              {Array.from({ length: firstWeekday }).map((_, index) => (
                <span key={`pad-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const iso = toIso(view.year, view.month, day)
                const isSelected = iso === value
                const isToday = iso === todayIso
                const isFuture = iso > todayIso
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isFuture}
                    onClick={() => {
                      onChange(iso)
                      close()
                    }}
                    className={cn(
                      'pressable tnum flex h-9 items-center justify-center rounded-lg text-sm hover:bg-fill disabled:pointer-events-none disabled:opacity-30 disabled:hover:bg-transparent',
                      isToday && !isSelected && 'border border-primary-accent text-primary-pressed',
                      isSelected && 'bg-primary font-medium text-primary-foreground hover:bg-primary-pressed',
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Popover>
    </div>
  )
}
