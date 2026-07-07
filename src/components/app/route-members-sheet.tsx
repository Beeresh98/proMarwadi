import * as React from 'react'
import { Check, UserMinus, UserPlus } from 'lucide-react'
import { useApp } from '../../lib/store'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/form'
import { Sheet } from '../ui/sheet'

/**
 * Bulk route-membership manager, reachable from Settings → Routes and the
 * collection sheet. Top half: customers already on the route, one tap to
 * unassign. Bottom half: searchable checklist of everyone else (unassigned
 * customers or ones on another route) to pull onto this route — so a newly
 * created route can be filled without editing customers one by one.
 */
export function RouteMembersSheet({
  open,
  routeId,
  routeLabel,
  onClose,
}: {
  open: boolean
  routeId: string
  routeLabel: string
  onClose: () => void
}) {
  const { t, customers, routeName, assignCustomersToRoute } = useApp()
  const [search, setSearch] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (open) {
      setSearch('')
      setSelected(new Set())
    }
  }, [open, routeId])

  const members = customers
    .filter((customer) => customer.routeId === routeId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const candidates = customers
    .filter((customer) => customer.routeId !== routeId)
    .filter((customer) => {
      const query = search.trim().toLowerCase()
      if (!query) return true
      return [customer.name, customer.phone, customer.city, customer.district].some((value) =>
        value.toLowerCase().includes(query),
      )
    })
    .sort((a, b) => {
      // unassigned customers first — the most likely additions
      const aFree = a.routeId ? 1 : 0
      const bFree = b.routeId ? 1 : 0
      return aFree - bFree || a.name.localeCompare(b.name)
    })

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addSelected() {
    if (selected.size === 0) return
    assignCustomersToRoute([...selected], routeId)
    setSelected(new Set())
  }

  return (
    <Sheet open={open} title={routeLabel} onClose={onClose}>
      <div className="grid gap-4 pt-1">
        <div className="grid gap-1.5">
          <p className="text-[13px] font-medium text-secondary-text">
            {t('onThisRoute')} <span className="tnum">({members.length})</span>
          </p>
          {members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted-foreground">
              {t('noneOnRoute')}
            </p>
          ) : (
            <div className="grid max-h-56 overflow-y-auto rounded-[var(--radius-control)] border border-input px-3">
              {members.map((customer) => (
                <div key={customer.id} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {customer.city} · {customer.district}
                    </p>
                  </div>
                  <Button
                    size="iconSm"
                    variant="ghost"
                    aria-label={`${t('removeFromRoute')}: ${customer.name}`}
                    title={t('removeFromRoute')}
                    onClick={() => assignCustomersToRoute([customer.id], '')}
                    className="shrink-0 hover:text-debit"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <p className="text-[13px] font-medium text-secondary-text">{t('addCustomersToRoute')}</p>
          <p className="text-xs text-muted-foreground">{t('addCustomersToRouteHint')}</p>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchCustomer')}
          />
          {candidates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted-foreground">
              {t('noCustomersToAdd')}
            </p>
          ) : (
            <div className="grid max-h-64 gap-1 overflow-y-auto rounded-[var(--radius-control)] border border-input p-1.5">
              {candidates.map((customer) => {
                const isSelected = selected.has(customer.id)
                const currentRoute = customer.routeId ? routeName(customer.routeId) : ''
                return (
                  <button
                    key={customer.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => toggle(customer.id)}
                    className={cn(
                      'pressable flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-fill',
                      isSelected && 'bg-primary-tint',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{customer.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {customer.city} · {customer.district}
                        {currentRoute && ` · ${t('currentlyOn')} ${currentRoute}`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          <Button disabled={selected.size === 0} onClick={addSelected}>
            <UserPlus className="h-4 w-4" />
            {t('addSelected')} {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
