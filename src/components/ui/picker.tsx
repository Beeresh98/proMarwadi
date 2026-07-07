import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

export function useDismissable(open: boolean, onClose: () => void) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (ref.current && ref.current.contains(target)) return
      // popover content lives in a portal outside the trigger's subtree
      if (target instanceof Element && target.closest('[data-popover]')) return
      onClose()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])
  return ref
}

/**
 * Universal dropdown surface. Renders into document.body via portal with
 * fixed positioning, so it always paints above page content — immune to
 * ancestor stacking contexts, overflow clipping, and transforms.
 */
export function Popover({
  open,
  anchorRef,
  align = 'left',
  width = 'anchor',
  className,
  children,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  align?: 'left' | 'right'
  width?: 'anchor' | number
  className?: string
  children: React.ReactNode
}) {
  const [style, setStyle] = React.useState<React.CSSProperties | null>(null)

  React.useLayoutEffect(() => {
    if (!open) {
      setStyle(null)
      return
    }
    function update() {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const gap = 6
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < 320 && rect.top > spaceBelow
      const next: React.CSSProperties = {
        position: 'fixed',
        zIndex: 60,
        maxWidth: 'calc(100vw - 16px)',
      }
      // menu matches the trigger's width exactly so it never overflows
      // narrow fields (e.g. the half-width City field inside a sheet)
      if (width === 'anchor') next.width = rect.width
      else next.width = width
      if (align === 'right') next.right = Math.max(8, window.innerWidth - rect.right)
      else next.left = Math.max(8, rect.left)
      if (openUp) next.bottom = window.innerHeight - rect.top + gap
      else next.top = rect.bottom + gap
      setStyle(next)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, align, width, anchorRef])

  if (!open || !style) return null
  return createPortal(
    <div
      data-popover
      style={style}
      className={cn(
        'rounded-xl border border-border bg-card shadow-[0_12px_32px_rgba(44,44,42,0.18)] animate-pop-in',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}

export type PickerOption = {
  value: string
  label: string
  hint?: string
  /* Renders as a highlighted action row (e.g. "+ Add new city") pinned below
     the regular options, separated by a divider and exempt from search filtering. */
  action?: boolean
}

export function Picker({
  value,
  options,
  onChange,
  placeholder = '—',
  searchable = false,
  searchPlaceholder = '',
  className,
  align = 'left',
  disabled = false,
}: {
  value: string
  options: PickerOption[]
  onChange: (value: string) => void
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
  align?: 'left' | 'right'
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const close = React.useCallback(() => setOpen(false), [])
  const ref = useDismissable(open, close)
  const anchorRef = React.useRef<HTMLButtonElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open && searchable) searchRef.current?.focus()
    if (!open) setQuery('')
  }, [open, searchable])

  const selected = options.find((option) => option.value === value)
  const visible = query.trim()
    ? options.filter(
        (option) =>
          option.action ||
          `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : options

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'pressable flex h-12 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-input bg-card px-3.5 text-left text-[15px] hover:border-border-strong focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-45',
          open && 'border-primary ring-2 ring-ring/40',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <Popover open={open} anchorRef={anchorRef} align={align} className="max-h-72 overflow-auto p-1.5">
        <div role="listbox">
          {searchable && (
            <div className="sticky top-0 z-10 -m-1.5 mb-1 border-b border-border bg-card p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-input bg-fill pl-8 pr-2 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
          )}
          {visible.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">—</p>
          )}
          {visible.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value)
                  close()
                }}
                className={cn(
                  'pressable flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[15px] hover:bg-fill',
                  isSelected && 'bg-primary-tint text-primary-pressed',
                  option.action &&
                    'mt-1 rounded-t-none border-t border-border font-medium text-primary hover:bg-primary-tint',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
                  )}
                </span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </Popover>
    </div>
  )
}

/* Multi-select variant of Picker: checkbox rows that stay open while
   toggling, a select-all header, and a trigger that summarizes the choice. */
export function MultiPicker({
  values,
  options,
  onChange,
  placeholder = '—',
  allLabel,
  countLabel,
  className,
  align = 'left',
}: {
  values: string[]
  options: PickerOption[]
  onChange: (values: string[]) => void
  placeholder?: string
  /* header row label toggling select-all / clear */
  allLabel: string
  /* trigger summary when 2+ picked, e.g. (n) => `${n} selected` */
  countLabel: (count: number) => string
  className?: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = React.useState(false)
  const close = React.useCallback(() => setOpen(false), [])
  const ref = useDismissable(open, close)
  const anchorRef = React.useRef<HTMLButtonElement>(null)

  const allSelected = values.length === options.length
  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (options.find((option) => option.value === values[0])?.label ?? placeholder)
        : allSelected
          ? allLabel
          : countLabel(values.length)

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'pressable flex h-12 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-input bg-card px-3.5 text-left text-[15px] hover:border-border-strong focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40',
          open && 'border-primary ring-2 ring-ring/40',
        )}
      >
        <span className={cn('truncate', values.length === 0 && 'text-muted-foreground')}>{summary}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {values.length > 0 && (
            <span className="tnum rounded bg-primary-tint px-1.5 py-px text-[11px] font-medium text-primary-pressed">
              {values.length}
            </span>
          )}
          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          />
        </span>
      </button>

      <Popover open={open} anchorRef={anchorRef} align={align} className="max-h-72 overflow-auto p-1.5">
        <div role="listbox" aria-multiselectable="true">
          <button
            type="button"
            onClick={() => onChange(allSelected ? [] : options.map((option) => option.value))}
            className="pressable mb-1 flex w-full items-center justify-between gap-2 rounded-lg border-b border-border px-3 py-2 text-left text-[13px] font-medium text-primary hover:bg-primary-tint"
          >
            {allLabel}
            {allSelected && <Check className="h-4 w-4 shrink-0" />}
          </button>
          {options.map((option) => {
            const selected = values.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(option.value)}
                className={cn(
                  'pressable flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[15px] hover:bg-fill',
                  selected && 'bg-primary-tint text-primary-pressed',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
                  )}
                </span>
                <span
                  className={cn(
                    'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border',
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong',
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                </span>
              </button>
            )
          })}
        </div>
      </Popover>
    </div>
  )
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: Array<{ value: T; label: React.ReactNode; activeClassName?: string }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-[10px] bg-muted p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'pressable rounded-lg px-3 py-2 text-center text-sm font-medium text-secondary-text',
            value === option.value
              ? cn('bg-card text-foreground shadow-[0_1px_4px_rgba(44,44,42,0.12)]', option.activeClassName)
              : 'hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
