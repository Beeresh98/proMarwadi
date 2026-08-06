import * as React from 'react'
import { Check, ListChecks, MapPin, Pencil, Printer, Save, UserPlus } from 'lucide-react'
import { RouteMembersSheet } from '../components/app/route-members-sheet'
import { DatePicker, formatDisplayDate } from '../components/ui/date-picker'
import { Button } from '../components/ui/button'
import { Picker } from '../components/ui/picker'
import { customerBalance, dayCollection, today } from '../lib/ledger'
import { useApp } from '../lib/store'
import { cn } from '../lib/utils'

/**
 * Route-wise daily collection sheet, modeled on the shop's paper register:
 * a ruled table of SlNo | Shop name | Bill | Cash | Bank | Balance where
 * Bill/Cash/Bank stay blank for handwriting. The date picker sets which day
 * the sheet is for — balances are computed as of that date. Printing hides
 * the app shell and controls (print: utilities) and keeps rows unsplit.
 * Staff only see their allocated routes (store scoping).
 */
export function CollectionScreen() {
  const { t, fmt, language, customers, entries, preferences, routes, routeName, isAdmin } = useApp()
  const [routeId, setRouteId] = React.useState('')
  const [date, setDate] = React.useState(today)
  const [addSheetOpen, setAddSheetOpen] = React.useState(false)
  // per-print exclusion: local only, never persisted — resets whenever the
  // route or date changes so every sheet starts fully included
  const [selectMode, setSelectMode] = React.useState(false)
  const [excludedIds, setExcludedIds] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    setSelectMode(false)
    setExcludedIds(new Set())
  }, [routeId, date])

  const allRows = customers
    .filter((customer) => customer.routeId === routeId)
    .map((customer) => {
      const { bill, cash, bank } = dayCollection(customer.id, entries, date)
      return { customer, bill, cash, bank, balance: customerBalance(customer, entries, date) }
    })
    .filter((row) => row.balance > 0 || row.bill > 0 || row.cash > 0 || row.bank > 0)
    .sort((a, b) => b.balance - a.balance)

  const rows = allRows.filter((row) => !excludedIds.has(row.customer.id))
  const totals = rows.reduce(
    (sum, row) => ({
      bill: sum.bill + row.bill,
      cash: sum.cash + row.cash,
      bank: sum.bank + row.bank,
      balance: sum.balance + row.balance,
    }),
    { bill: 0, cash: 0, bank: 0, balance: 0 },
  )

  function toggleExcluded(customerId: string) {
    setExcludedIds((current) => {
      const next = new Set(current)
      if (next.has(customerId)) next.delete(customerId)
      else next.add(customerId)
      return next
    })
  }

  const cell = 'border border-border px-2.5 py-2 print:border-black/60'
  const blankCell = `${cell} h-11 min-w-[4.5rem]`

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-2 gap-2.5 print:hidden">
        <Picker
          value={routeId}
          onChange={setRouteId}
          placeholder={t('selectRoute')}
          options={routes.map((route) => ({ value: route.id, label: route.name }))}
        />
        <DatePicker value={date} onChange={setDate} language={language} dateFormat={preferences.dateFormat} align="right" />
        {isAdmin && routeId && (
          <Button variant="secondary" onClick={() => setAddSheetOpen(true)} className="col-span-2">
            <UserPlus className="h-4 w-4" />
            {t('manageRouteCustomers')}
          </Button>
        )}
        <Button
          disabled={!routeId || rows.length === 0}
          onClick={() => window.print()}
          className="col-span-2 font-semibold shadow-[0_8px_20px_rgba(15,110,86,0.25)]"
        >
          <Printer className="h-4 w-4" />
          {t('printCollectionSheet')}
        </Button>
      </div>

      {!routeId ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong py-12 text-center print:hidden">
          <MapPin className="h-8 w-8 text-border-strong" />
          <p className="max-w-56 text-sm text-muted-foreground">{t('pickRouteHint')}</p>
        </div>
      ) : allRows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border-strong py-12 text-center print:hidden">
          <p className="text-sm text-muted-foreground">{t('noDuesInRoute')}</p>
        </div>
      ) : (
        <section className="rounded-[var(--radius-card)] border border-border bg-card p-4 print:rounded-none print:border-0 print:p-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[17px] font-semibold tracking-wide print:text-[19px]">
              {t('collectionSheet')} — {routeName(routeId)}
            </h2>
            <div className="flex items-center gap-3 print:hidden">
              {selectMode && (
                <p className="tnum text-xs text-muted-foreground">
                  {rows.length}/{allRows.length} {t('included')}
                </p>
              )}
              <button
                type="button"
                onClick={() => setSelectMode((current) => !current)}
                className="pressable inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-tint"
              >
                {selectMode ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                {selectMode ? t('doneEditing') : t('editSelection')}
              </button>
            </div>
            <p className="tnum text-sm font-medium">
              {t('date')}: {formatDisplayDate(date, language, preferences.dateFormat)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground print:text-black/70">
                  <th className={`${cell} w-10 text-center font-medium`}>
                    {selectMode ? <ListChecks className="mx-auto h-3.5 w-3.5" /> : '#'}
                  </th>
                  <th className={`${cell} text-left font-medium`}>{t('name')}</th>
                  <th className={`${cell} w-20 text-left font-medium`}>{t('youGave')}</th>
                  <th className={`${cell} w-20 text-left font-medium`}>{t('cash')}</th>
                  <th className={`${cell} w-20 text-left font-medium`}>{t('bank')}</th>
                  <th className={`${cell} w-24 text-right font-medium`}>{t('balance')}</th>
                </tr>
              </thead>
              <tbody>
                {(selectMode ? allRows : rows).map(({ customer, bill, cash, bank, balance }, index) => {
                  const excluded = excludedIds.has(customer.id)
                  return (
                    <tr key={customer.id} className={cn('print-row', excluded && 'opacity-40 print:hidden')}>
                      <td className={`${cell} tnum text-center text-muted-foreground print:text-black/70`}>
                        {selectMode ? (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={!excluded}
                            aria-label={customer.name}
                            onClick={() => toggleExcluded(customer.id)}
                            className={cn(
                              'pressable mx-auto flex h-5 w-5 items-center justify-center rounded border',
                              !excluded ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong',
                            )}
                          >
                            {!excluded && <Check className="h-3 w-3" />}
                          </button>
                        ) : (
                          index + 1
                        )}
                      </td>
                      <td className={cell}>
                        <p className="text-[15px] font-medium leading-tight">{customer.name}</p>
                        {customer.phone && (
                          <p className="tnum text-xs text-muted-foreground print:text-black/60">{customer.phone}</p>
                        )}
                      </td>
                      {bill > 0 ? (
                        <td className={`${cell} tnum text-right text-[15px] print:text-black`}>{fmt(bill)}</td>
                      ) : (
                        <td className={blankCell} />
                      )}
                      {cash > 0 ? (
                        <td className={`${cell} tnum text-right text-[15px] text-credit print:text-black`}>{fmt(cash)}</td>
                      ) : (
                        <td className={blankCell} />
                      )}
                      {bank > 0 ? (
                        <td className={`${cell} tnum text-right text-[15px] text-credit print:text-black`}>{fmt(bank)}</td>
                      ) : (
                        <td className={blankCell} />
                      )}
                      <td className={`${cell} tnum text-right text-[15px] font-semibold text-debit print:text-black`}>
                        {fmt(balance)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="print-row border-t-2 border-border-strong print:border-t-2 print:border-black/60">
                  <td
                    className={`${cell} text-right text-xs font-medium uppercase tracking-wide text-muted-foreground print:text-black/70`}
                    colSpan={2}
                  >
                    {t('total')}
                  </td>
                  <td className={`${cell} tnum text-right text-[15px] font-semibold print:text-black`}>
                    {fmt(totals.bill)}
                  </td>
                  <td className={`${cell} tnum text-right text-[15px] font-semibold text-credit print:text-black`}>
                    {fmt(totals.cash)}
                  </td>
                  <td className={`${cell} tnum text-right text-[15px] font-semibold text-credit print:text-black`}>
                    {fmt(totals.bank)}
                  </td>
                  <td className={`${cell} tnum text-right text-[15px] font-semibold text-debit print:text-black`}>
                    {fmt(totals.balance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isAdmin && (
        <RouteMembersSheet
          open={addSheetOpen}
          routeId={routeId}
          routeLabel={routeName(routeId)}
          onClose={() => setAddSheetOpen(false)}
        />
      )}
    </div>
  )
}
