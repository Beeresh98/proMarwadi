import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '../../lib/utils'

export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-[13px] font-medium text-secondary-text', className)}
      {...props}
    />
  )
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, onWheel, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      // number inputs otherwise change value on mouse-wheel scroll while
      // focused — blur so a scroll just scrolls the page, everywhere in the app
      onWheel={
        type === 'number'
          ? (event) => {
              event.currentTarget.blur()
              onWheel?.(event)
            }
          : onWheel
      }
      className={cn(
        'flex h-12 w-full rounded-[var(--radius-control)] border border-input bg-card px-3.5 py-2 text-[15px] outline-none transition-all duration-150 placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
