import * as React from 'react'
import { ArrowDownLeft, ArrowUpRight, FileText } from 'lucide-react'
import { Button } from '../components/ui/button'
import { DatePicker } from '../components/ui/date-picker'
import { Field } from '../components/ui/form'
import { Picker } from '../components/ui/picker'
import { entriesInRange, totalsForEntries } from '../lib/ledger'
import { exportCustomerLedgerPdf, exportReportPdf } from '../lib/pdf'
import { useApp } from '../lib/store'
import type { ReportType } from '../lib/types'

const reportTypes: ReportType[] = [
  'customer',
  'allClients',
  'daySummary',
  'monthSummary',
  'citySummary',
  'cityDaySummary',
  'districtSummary',
  'districtDaySummary',
]

export function ReportsScreen() {
  const { t, fmt, language, customers, entries, range, setRange } = useApp()
  const [type, setType] = React.useState<ReportType>('customer')
  const [customerId, setCustomerId] = React.useState(customers[0]?.id ?? '')
  const [district, setDistrict] = React.useState('')
  const [city, setCity] = React.useState('')

  const districts = Array.from(new Set(customers.map((customer) => customer.district))).filter(Boolean).sort()
  const cities = Array.from(new Set(customers.map((customer) => customer.city))).filter(Boolean).sort()

  const needsCustomer = type === 'customer'
  const needsCity = type.toLowerCase().includes('city')
  const needsDistrict = type.toLowerCase().includes('district')

  const scopedCustomers = needsCustomer
    ? customers.filter((customer) => customer.id === customerId)
    : needsCity && city
      ? customers.filter((customer) => customer.city === city)
      : needsDistrict && district
        ? customers.filter((customer) => customer.district === district)
        : customers

  const scopedIds = new Set(scopedCustomers.map((customer) => customer.id))
  const totals = totalsForEntries(
    entriesInRange(entries, range).filter((entry) => scopedIds.has(entry.customerId)),
  )

  function exportPdf() {
    if (needsCustomer) {
      const customer = customers.find((item) => item.id === customerId)
      if (customer) exportCustomerLedgerPdf(customer, entries, range)
      return
    }
    exportReportPdf(t(type), scopedCustomers, entries, range)
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4">
        <Field label={t('reportType')}>
          <Picker
            value={type}
            onChange={(value) => setType(value as ReportType)}
            options={reportTypes.map((reportType) => ({ value: reportType, label: t(reportType) }))}
          />
        </Field>

        {needsCustomer && (
          <div className="animate-fade-up">
            <Field label={t('customer')}>
              <Picker
                value={customerId}
                onChange={setCustomerId}
                searchable
                searchPlaceholder={t('searchCustomer')}
                placeholder={t('selectCustomer')}
                options={customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                  hint: `${customer.city} · ${customer.district}`,
                }))}
              />
            </Field>
          </div>
        )}

        {needsDistrict && (
          <div className="animate-fade-up">
            <Field label={t('district')}>
              <Picker
                value={district}
                onChange={setDistrict}
                options={[
                  { value: '', label: t('allDistricts') },
                  ...districts.map((item) => ({ value: item, label: item })),
                ]}
              />
            </Field>
          </div>
        )}

        {needsCity && (
          <div className="animate-fade-up">
            <Field label={t('city')}>
              <Picker
                value={city}
                onChange={setCity}
                options={[
                  { value: '', label: t('allCities') },
                  ...cities.map((item) => ({ value: item, label: item })),
                ]}
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t('from')}>
            <DatePicker value={range.from} onChange={(from) => setRange({ ...range, from })} language={language} />
          </Field>
          <Field label={t('to')}>
            <DatePicker value={range.to} onChange={(to) => setRange({ ...range, to })} language={language} align="right" />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-card)] bg-debit-tint p-4">
          <p className="flex items-center gap-1 text-xs text-debit">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t('debit')}
          </p>
          <p key={totals.debit} className="tnum mt-1 text-xl font-medium text-debit animate-fade-in">
            {fmt(totals.debit)}
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-credit-tint p-4">
          <p className="flex items-center gap-1 text-xs text-credit">
            <ArrowDownLeft className="h-3.5 w-3.5" />
            {t('credit')}
          </p>
          <p key={totals.credit} className="tnum mt-1 text-xl font-medium text-credit animate-fade-in">
            {fmt(totals.credit)}
          </p>
        </div>
      </div>

      <Button className="w-full" onClick={exportPdf}>
        <FileText className="h-4 w-4" />
        {t('exportPdf')}
      </Button>
    </div>
  )
}
