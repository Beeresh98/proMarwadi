import * as React from 'react'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Pencil,
  Phone,
  Trash2,
} from 'lucide-react'
import type { EntryDraft } from '../components/app/entry-sheet'
import { Button } from '../components/ui/button'
import { DatePicker, formatDisplayDate } from '../components/ui/date-picker'
import { ConfirmDialog } from '../components/ui/sheet'
import { customerBalance, ledgerRows } from '../lib/ledger'
import { exportCustomerLedgerPdf } from '../lib/pdf'
import { useApp } from '../lib/store'
import { cn } from '../lib/utils'

export function LedgerScreen({
  customerId,
  onBack,
  onEditCustomer,
  onEntry,
}: {
  customerId: string
  onBack: () => void
  onEditCustomer: () => void
  onEntry: (draft: EntryDraft) => void
}) {
  const { t, fmt, language, customers, entries, range, setRange, isAdmin, deleteCustomer, deleteEntry } = useApp()
  const [confirm, setConfirm] = React.useState<{ kind: 'customer' | 'entry'; id: string } | null>(null)

  const customer = customers.find((item) => item.id === customerId)
  if (!customer) return null

  const rows = ledgerRows(customer, entries, range)
  const balance = customerBalance(customer, entries)

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full text-secondary-text hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-medium leading-tight">{customer.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {customer.city} · {customer.district}
            {customer.phone && (
              <span className="tnum inline-flex items-center gap-1">
                {' · '}
                <Phone className="h-3 w-3" />
                {customer.phone}
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-1.5">
            <Button size="iconSm" variant="ghost" aria-label={t('editCustomer')} onClick={onEditCustomer}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="iconSm"
              variant="ghost"
              aria-label={t('delete')}
              className="text-debit hover:bg-debit-tint hover:text-debit"
              onClick={() => setConfirm({ kind: 'customer', id: customer.id })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <section className="flex items-center justify-between rounded-[var(--radius-card)] bg-hero p-5 text-hero-foreground">
        <div>
          <p className="text-[13px] text-hero-muted">{t('balance')}</p>
          <p
            key={balance}
            className={cn(
              'tnum mt-0.5 text-[30px] font-medium leading-tight tracking-tight animate-fade-up',
              balance >= 0 ? 'text-white' : 'text-primary-accent',
            )}
          >
            {fmt(Math.abs(balance))}
          </p>
          <p className="mt-0.5 text-xs text-primary-accent">
            {balance > 0 ? t('owesYou') : balance < 0 ? t('youOwe') : t('settled')}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="border-transparent bg-white/10 text-white hover:bg-white/20 hover:border-transparent"
          onClick={() => exportCustomerLedgerPdf(customer, entries, range)}
        >
          <FileText className="h-4 w-4" />
          PDF
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t('from')}</p>
          <DatePicker value={range.from} onChange={(from) => setRange({ ...range, from })} language={language} />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t('to')}</p>
          <DatePicker
            value={range.to}
            onChange={(to) => setRange({ ...range, to })}
            language={language}
            align="right"
          />
        </div>
      </div>

      <section className="rounded-[var(--radius-card)] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {t('openingBalance')}: <span className="tnum">{fmt(customer.openingBalance)}</span>
          </span>
          <span className="tnum">
            {rows.length} {t('entries')}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground animate-fade-in">{t('noRows')}</p>
        ) : (
          <div className="stagger px-4">
            {rows.map((entry) => (
              <div key={entry.id} className="group flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    entry.type === 'debit' ? 'bg-debit-tint text-debit' : 'bg-credit-tint text-credit',
                  )}
                >
                  {entry.type === 'debit' ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownLeft className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('tnum text-[15px] font-medium', entry.type === 'debit' ? 'text-debit' : 'text-credit')}>
                    {entry.type === 'debit' ? '−' : '+'} {fmt(entry.amount)}
                  </p>
                  <p className="tnum truncate text-xs text-muted-foreground">
                    {formatDisplayDate(entry.date, language)}
                    {entry.note && ` · ${entry.note}`}
                    {entry.type === 'credit' && entry.paymentMode && (
                      <span className="ml-1 rounded bg-credit-tint px-1 py-px text-[10px] font-medium text-credit">
                        {t(entry.paymentMode)}
                        {entry.paymentMode === 'bank' && entry.bankName && ` · ${entry.bankName}`}
                        {entry.paymentMode === 'upi' && entry.upiApp && ` · ${entry.upiApp}`}
                      </span>
                    )}
                    {entry.isEdited && (
                      <span className="ml-1 rounded bg-muted px-1 py-px text-[10px] font-medium text-secondary-text">
                        {t('edited')} ×{entry.editCount}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum text-[15px] font-medium">{fmt(entry.runningBalance)}</p>
                  <p className="text-[11px] text-muted-foreground">{t('runningBalance')}</p>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={t('edited')}
                      onClick={() => onEntry({ entryId: entry.id, customerId: customer.id, type: entry.type })}
                      className="pressable flex h-7 w-7 items-center justify-center rounded-md text-secondary-text hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('delete')}
                      onClick={() => setConfirm({ kind: 'entry', id: entry.id })}
                      className="pressable flex h-7 w-7 items-center justify-center rounded-md text-debit hover:bg-debit-tint"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 flex gap-3 pb-1 lg:bottom-4">
        <Button
          variant="debit"
          className="flex-1 shadow-[0_8px_20px_rgba(163,45,45,0.18)]"
          onClick={() => onEntry({ customerId: customer.id, type: 'debit' })}
        >
          <ArrowUpRight className="h-4 w-4" />
          {t('youGave')} −
        </Button>
        <Button
          variant="credit"
          className="flex-1 shadow-[0_8px_20px_rgba(59,109,17,0.22)]"
          onClick={() => onEntry({ customerId: customer.id, type: 'credit' })}
        >
          <ArrowDownLeft className="h-4 w-4" />
          {t('youGot')} +
        </Button>
      </section>

      <ConfirmDialog
        open={confirm !== null}
        message={confirm?.kind === 'customer' ? t('confirmDeleteCustomer') : t('confirmDeleteEntry')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === 'customer') {
            deleteCustomer(confirm.id)
            setConfirm(null)
            onBack()
          } else {
            deleteEntry(confirm.id)
            setConfirm(null)
          }
        }}
      />
    </div>
  )
}
