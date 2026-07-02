import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/35 animate-overlay-in cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-card',
          'rounded-t-2xl animate-sheet-up',
          'sm:max-w-md sm:rounded-2xl sm:animate-pop-in sm:border sm:border-border sm:shadow-[0_24px_64px_rgba(44,44,42,0.22)]',
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-1 pt-3.5 sm:pt-5">
          <h2 className="text-[17px] font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pressable flex h-9 w-9 items-center justify-center rounded-full text-secondary-text hover:bg-fill"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-foreground/35 animate-overlay-in cursor-default"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xs rounded-2xl border border-border bg-card p-5 shadow-[0_24px_64px_rgba(44,44,42,0.22)] animate-pop-in"
      >
        <p className="text-[15px] leading-relaxed">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="pressable h-11 flex-1 rounded-[var(--radius-control)] border border-border-strong text-sm font-medium hover:bg-fill"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="pressable h-11 flex-1 rounded-[var(--radius-control)] bg-debit text-sm font-medium text-white hover:bg-debit/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
