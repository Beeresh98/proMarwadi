import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'pressable inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-pressed',
        secondary: 'border border-border-strong bg-card text-foreground hover:border-foreground/40 hover:bg-fill',
        ghost: 'text-secondary-text hover:bg-muted hover:text-foreground',
        debit: 'border border-debit-strong bg-card text-debit hover:bg-debit-tint',
        credit: 'bg-credit text-white hover:bg-credit/90',
        destructive: 'border border-debit-strong/60 bg-card text-debit hover:bg-debit-tint',
      },
      size: {
        default: 'h-12 px-5 text-[15px]',
        sm: 'h-9 px-3 text-sm',
        icon: 'h-10 w-10',
        iconSm: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} type={asChild ? undefined : type} ref={ref} {...props} />
    )
  },
)

Button.displayName = 'Button'
