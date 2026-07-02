import { useApp } from '../../lib/store'
import { cn } from '../../lib/utils'

export function Balance({
  amount,
  className,
  amountClassName,
  showLabel = true,
}: {
  amount: number
  className?: string
  amountClassName?: string
  showLabel?: boolean
}) {
  const { t, fmt } = useApp()
  const tone = amount > 0 ? 'text-debit' : amount < 0 ? 'text-credit' : 'text-muted-foreground'
  const label = amount > 0 ? t('owesYou') : amount < 0 ? t('youOwe') : t('settled')
  return (
    <div className={cn('text-right', className)}>
      <p key={amount} className={cn('tnum font-medium leading-tight animate-fade-in', tone, amountClassName)}>
        {fmt(Math.abs(amount))}
      </p>
      {showLabel && <p className={cn('text-[11px] leading-tight', tone)}>{label}</p>}
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-[13px] font-medium text-primary-pressed',
        className,
      )}
    >
      {initials || '?'}
    </div>
  )
}
