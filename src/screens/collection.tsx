import * as React from 'react'
import { MapPin, Printer } from 'lucide-react'
import { DatePicker, formatDisplayDate } from '../components/ui/date-picker'
import { Button } from '../components/ui/button'
import { Picker } from '../components/ui/picker'
import { customerBalance, today } from '../lib/ledger'
import { useApp } from '../lib/store'

/**
 * City-wise daily collection sheet, modeled on the shop's paper register:
 * a ruled table of SlNo | Shop name | Bill | Cash | Bank | Balance where
 * Bill/Cash/Bank stay blank for handwriting. The date picker sets which day
 * the sheet is for — balances are computed as of that date. Printing hides
 * the app shell and controls (print: utilities) and keeps rows unsplit.
 */
export function CollectionScreen() {
  const { t, fmt, language, customers, entries } = useApp()
  const [city, setCity] = React.useState('')
  const [date, setDate] = React.useState(today)

  const cities = [...new Set(customers.map((customer) => customer.city))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  const rows = customers
    .filter((customer) => customer.city === city)
    .map((customer) => {
      // that day's bills are printed; cash/bank stay blank for the agent's pen
      const billToday = entries
        .filter(
          (entry) => entry.customerId === customer.id && entry.date === date && entry.type === 'debit',
        )
        .reduce((sum, entry) => sum + entry.amount, 0)
      return { customer, billToday, balance: customerBalance(customer, entries, date) }
    })
    .filter((row) => row.balance > 0 || row.billToday > 0)
    .sort((a, b) => b.balance - a.balance)

  const total = rows.reduce((sum, row) => sum + row.balance, 0)

  const cell = 'border border-border px-2.5 py-2 print:border-black/60'
  const blankCell = `${cell} h-11 min-w-[4.5rem]`

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid grid-cols-2 gap-2.5 print:hidden">
        <Picker
          value={city}
          onChange={setCity}
          placeholder={t('selectCity')}
          options={cities.map((item) => ({ value: item, label: item }))}
        />
        <DatePicker value={date} onChange={setDate} language={language} align="right" />
        <Button
          disabled={!city || rows.length === 0}
          onClick={() => window.print()}
          className="col-span-2 font-semibold shadow-[0_8px_20px_rgba(15,110,86,0.25)]"
        >
          <Printer className="h-4 w-4" />
          {t('printCollectionSheet')}
        </Button>
      </div>

      {!city ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong py-12 text-center print:hidden">
          <MapPin className="h-8 w-8 text-border-strong" />
          <p className="max-w-56 text-sm text-muted-foreground">{t('pickCityHint')}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border-strong py-12 text-center print:hidden">
          <p className="text-sm text-muted-foreground">{t('noDuesInCity')}</p>
        </div>
      ) : (
        <section className="rounded-[var(--radius-card)] border border-border bg-card p-4 print:rounded-none print:border-0 print:p-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[17px] font-semibold tracking-wide print:text-[19px]">
              {t('collectionSheet')} — {city}
            </h2>
            <p className="tnum text-sm font-medium">
              {t('date')}: {formatDisplayDate(date, language)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground print:text-black/70">
                  <th className={`${cell} w-10 text-center font-medium`}>#</th>
                  <th className={`${cell} text-left font-medium`}>{t('name')}</th>
                  <th className={`${cell} w-20 text-left font-medium`}>{t('youGave')}</th>
                  <th className={`${cell} w-20 text-left font-medium`}>{t('cash')}</th>
                  <th className={`${cell} w-20 text-left font-medium`}>{t('bank')}</th>
                  <th className={`${cell} w-24 text-right font-medium`}>{t('balance')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ customer, billToday, balance }, index) => (
                  <tr key={customer.id} className="print-row">
                    <td className={`${cell} tnum text-center text-muted-foreground print:text-black/70`}>
                      {index + 1}
                    </td>
                    <td className={cell}>
                      <p className="text-[15px] font-medium leading-tight">{customer.name}</p>
                      {customer.phone && (
                        <p className="tnum text-xs text-muted-foreground print:text-black/60">{customer.phone}</p>
                      )}
                    </td>
                    {billToday > 0 ? (
                      <td className={`${cell} tnum text-right text-[15px] print:text-black`}>{fmt(billToday)}</td>
                    ) : (
                      <td className={blankCell} />
                    )}
                    <td className={blankCell} />
                    <td className={blankCell} />
                    <td className={`${cell} tnum text-right text-[15px] font-semibold text-debit print:text-black`}>
                      {fmt(balance)}
                    </td>
                  </tr>
                ))}
                <tr className="print-row">
                  <td className={`${cell} border-none`} colSpan={4} />
                  <td className={`${cell} text-right text-xs font-medium uppercase tracking-wide text-muted-foreground print:text-black/70`}>
                    {t('totalPending')}
                  </td>
                  <td className={`${cell} tnum text-right text-[15px] font-semibold text-debit print:text-black`}>
                    {fmt(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
