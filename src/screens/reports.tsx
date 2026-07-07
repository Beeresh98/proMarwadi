import * as React from 'react'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  FileDown,
  FileText,
  Landmark,
  MapPin,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '../components/ui/button'
import { DatePicker } from '../components/ui/date-picker'
import { Field } from '../components/ui/form'
import { MultiPicker, Picker, SegmentedControl } from '../components/ui/picker'
import {
  collectionsLog,
  customerAnalytics,
  districtAnalytics,
  employeeCollections,
  overdueCustomers,
  paymentModeSplit,
  periodBuckets,
  rangeBuckets,
  routeAnalytics,
  weekdayPattern,
  type PeriodGrain,
} from '../lib/analytics'
import { weekdayNames } from '../lib/i18n'
import { currentMonthRange, customerBalance, entriesInRange, today, totalsForEntries } from '../lib/ledger'
import {
  exportAnalyticsPdf,
  exportCustomerLedgerPdf,
  exportReportPdf,
  money,
  type AnalyticsSection,
} from '../lib/pdf'
import { useApp } from '../lib/store'
import type { ReportType } from '../lib/types'
import { cn } from '../lib/utils'

/* Chart palette — mirrors the app's money semantics (index.css tokens). */
const chartDebit = '#e24b4a'
const chartCredit = '#639922'
const chartTeal = '#0f6e56'
const modeColors: Record<string, string> = { cash: '#639922', bank: '#0f6e56', upi: '#5dcaa5' }

type Period = 'today' | PeriodGrain | 'custom'

const periodPdfLabel: Record<Period, string> = {
  today: 'Today',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom range',
}

const chartTooltipStyle = {
  borderRadius: 10,
  border: '1px solid #e7e5de',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(44,44,42,0.12)',
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
        {icon}
        {title}
      </p>
      {children}
    </section>
  )
}

/* Inline proportional bar used by the employee/route breakdowns — animates
   its width on mount, matching the app's motion language. */
function MeterRow({
  label,
  hint,
  value,
  max,
  valueLabel,
  color = 'bg-primary',
}: {
  label: string
  hint?: string
  value: number
  max: number
  valueLabel: string
  color?: string
}) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-medium">{label}</p>
        <p className="tnum shrink-0 text-[15px] font-medium">{valueLabel}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-[width] duration-700 ease-out', color)}
            style={{ width: `${max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0}%` }}
          />
        </div>
        {hint && <p className="shrink-0 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

function AnalyticsView() {
  const { t, fmt, language, preferences, customers, entries, routes } = useApp()
  const [period, setPeriod] = React.useState<Period>('daily')
  const [custom, setCustom] = React.useState(() => ({ ...currentMonthRange(), to: today }))
  const [pdfSections, setPdfSections] = React.useState<string[]>([
    'overview',
    'weekday',
    'modes',
    'employees',
    'routes',
    'watchlist',
  ])

  const buckets = React.useMemo(
    () =>
      period === 'today'
        ? rangeBuckets(entries, today, today)
        : period === 'custom'
          ? rangeBuckets(entries, custom.from, custom.to)
          : periodBuckets(entries, period),
    [entries, period, custom.from, custom.to],
  )
  const span = { from: buckets[0]?.from ?? today, to: buckets[buckets.length - 1]?.to ?? today }
  const spanDays = Math.max(
    1,
    Math.round((new Date(span.to).getTime() - new Date(span.from).getTime()) / 86400000) + 1,
  )
  const billed = buckets.reduce((sum, bucket) => sum + bucket.debit, 0)
  const collected = buckets.reduce((sum, bucket) => sum + bucket.credit, 0)
  const collectionCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const outstanding = customers.reduce((sum, customer) => sum + customerBalance(customer, entries), 0)
  const recoveryRate = billed > 0 ? Math.round((collected / billed) * 100) : collected > 0 ? 100 : 0

  const modeSplit = React.useMemo(() => paymentModeSplit(entries, span.from, span.to), [entries, span.from, span.to])
  const employees = React.useMemo(() => employeeCollections(entries, span.from, span.to), [entries, span.from, span.to])
  const weekdays = React.useMemo(() => weekdayPattern(entries, span.from, span.to), [entries, span.from, span.to])
  const routeStats = React.useMemo(
    () => routeAnalytics(routes, customers, entries, span.from, span.to),
    [routes, customers, entries, span.from, span.to],
  )
  const districtStats = React.useMemo(
    () => districtAnalytics(customers, entries, span.from, span.to),
    [customers, entries, span.from, span.to],
  )
  const customerStats = React.useMemo(() => customerAnalytics(customers, entries), [customers, entries])
  const watchlist = React.useMemo(() => overdueCustomers(customerStats), [customerStats])

  const chartData = buckets.map((bucket) => ({
    label: bucket.label,
    [t('billed')]: bucket.debit,
    [t('collected')]: bucket.credit,
    [t('balance')]: bucket.credit - bucket.debit,
  }))
  // weekday chart: Monday-first labels from the shared weekday names
  const weekdayData = weekdays.map((slot) => ({
    label: weekdayNames[language][(slot.weekday + 1) % 7],
    [t('collected')]: slot.total,
  }))
  const maxEmployee = Math.max(...employees.map((employee) => employee.total), 0)
  const maxRoute = Math.max(...routeStats.map((route) => route.outstanding), 0)
  const maxDistrict = Math.max(...districtStats.map((district) => district.outstanding), 0)

  function downloadPdf() {
    const sections = pdfSections
      .filter((section) => section !== 'topCustomers' && section !== 'allCustomers')
      .concat(pdfSections.includes('topCustomers') || pdfSections.includes('allCustomers') ? ['customers'] : [])
    exportAnalyticsPdf({
      grainLabel: periodPdfLabel[period],
      rangeLabel: span.from === span.to ? span.from : `${span.from} to ${span.to}`,
      kpis: [
        { label: 'Billed', value: money(billed) },
        { label: 'Collected', value: money(collected) },
        { label: 'Recovery rate', value: `${recoveryRate}%` },
        { label: 'Outstanding', value: money(outstanding), danger: outstanding > 0 },
      ],
      buckets,
      modeSplit,
      employees,
      routes: routeStats,
      districts: districtStats,
      weekday: weekdays,
      watchlist,
      customers: customerStats,
      log: collectionsLog(customers, entries, span.from, span.to),
      sections: sections as AnalyticsSection[],
      allCustomers: pdfSections.includes('allCustomers'),
    })
  }

  const kpis = [
    { label: t('billed'), value: fmt(billed), tone: 'text-debit' },
    { label: t('collected'), value: fmt(collected), tone: 'text-credit' },
    { label: t('recoveryRate'), value: `${recoveryRate}%`, tone: recoveryRate >= 100 ? 'text-credit' : 'text-foreground' },
    { label: t('outstanding'), value: fmt(outstanding), tone: 'text-primary-pressed' },
  ]
  const miniKpis = [
    { label: t('collectionsCount'), value: String(collectionCount) },
    { label: t('avgCollection'), value: collectionCount > 0 ? fmt(Math.round(collected / collectionCount)) : '—' },
    { label: t('perDay'), value: fmt(Math.round(collected / spanDays)) },
    { label: t('overdue'), value: String(watchlist.length) },
  ]

  const sectionOptions = [
    { value: 'overview', label: t('overviewTrend') },
    { value: 'weekday', label: t('weekdayPattern') },
    { value: 'modes', label: t('paymentModes') },
    { value: 'employees', label: t('employeeCollections') },
    { value: 'routes', label: t('routePerformance') },
    { value: 'districts', label: t('districtOverview') },
    { value: 'watchlist', label: t('overdueWatchlist') },
    { value: 'topCustomers', label: `${t('customerAnalysis')} — ${t('topCustomers')}` },
    { value: 'allCustomers', label: `${t('customerAnalysis')} — ${t('allClients')}` },
    { value: 'log', label: t('collectionsLog') },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5">
        <Picker
          value={period}
          onChange={(value) => setPeriod(value as Period)}
          options={[
            { value: 'today', label: t('today') },
            { value: 'daily', label: `${t('daily')} · 30` },
            { value: 'weekly', label: `${t('weekly')} · 12` },
            { value: 'monthly', label: `${t('monthly')} · 12` },
            { value: 'yearly', label: t('yearly') },
            { value: 'custom', label: t('customRange') },
          ]}
        />
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2.5 animate-fade-up">
            <DatePicker
              value={custom.from}
              onChange={(from) => setCustom((current) => ({ ...current, from }))}
              language={language}
              dateFormat={preferences.dateFormat}
            />
            <DatePicker
              value={custom.to}
              onChange={(to) => setCustom((current) => ({ ...current, to }))}
              language={language}
              dateFormat={preferences.dateFormat}
              align="right"
            />
          </div>
        )}
      </div>

      <div key={`${period}-${span.from}-${span.to}`} className="stagger grid grid-cols-2 gap-2.5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[var(--radius-card)] border border-border bg-card p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            <p className={cn('tnum mt-1 text-[19px] font-semibold leading-tight', kpi.tone)}>{kpi.value}</p>
          </div>
        ))}
        <div className="col-span-2 grid grid-cols-4 divide-x divide-border rounded-[var(--radius-card)] border border-border bg-card py-2.5">
          {miniKpis.map((kpi) => (
            <div key={kpi.label} className="px-2.5 text-center">
              <p className="tnum text-[15px] font-semibold leading-tight">{kpi.value}</p>
              <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <SectionCard icon={<BarChart3 className="h-4 w-4" />} title={t('overviewTrend')}>
        {buckets.every((bucket) => bucket.debit === 0 && bucket.credit === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }} barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5de" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#888780' }}
                  tickLine={false}
                  axisLine={{ stroke: '#d3d1c7' }}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#888780' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => (Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : String(value))}
                />
                <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                <Bar dataKey={t('billed')} fill={chartDebit} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey={t('collected')} fill={chartCredit} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Line
                  type="monotone"
                  dataKey={t('balance')}
                  stroke={chartTeal}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={<CalendarDays className="h-4 w-4" />} title={t('weekdayPattern')}>
        {weekdays.every((slot) => slot.count === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5de" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#888780' }} tickLine={false} axisLine={{ stroke: '#d3d1c7' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#888780' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))}
                />
                <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={chartTooltipStyle} />
                <Bar dataKey={t('collected')} fill={chartTeal} radius={[3, 3, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={<Landmark className="h-4 w-4" />} title={t('paymentModes')}>
        {modeSplit.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modeSplit.map((slot) => ({ name: t(slot.mode), value: slot.total, mode: slot.mode }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {modeSplit.map((slot) => (
                    <Cell key={slot.mode} fill={modeColors[slot.mode]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={<UserRound className="h-4 w-4" />} title={t('employeeCollections')}>
        {employees.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="grid">
            {employees.map((employee) => (
              <MeterRow
                key={employee.name}
                label={employee.name}
                hint={`${employee.count} ${t('payments')} · ${t('avgCollection')} ${fmt(employee.average)}`}
                value={employee.total}
                max={maxEmployee}
                valueLabel={fmt(employee.total)}
                color="bg-credit-strong"
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={<MapPin className="h-4 w-4" />} title={t('routePerformance')}>
        {routeStats.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="grid">
            {routeStats.map((route) => (
              <MeterRow
                key={route.routeId || 'none'}
                label={route.name === '—' ? t('noRoute') : route.name}
                hint={`${route.customers} ${route.customers === 1 ? t('customerWord') : t('customersWord')} · ${t('collected')} ${fmt(route.collected)}`}
                value={route.outstanding}
                max={maxRoute}
                valueLabel={fmt(route.outstanding)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={<Building2 className="h-4 w-4" />} title={t('districtOverview')}>
        {districtStats.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="grid">
            {districtStats.map((district) => (
              <MeterRow
                key={district.name}
                label={district.name}
                hint={`${district.customers} ${district.customers === 1 ? t('customerWord') : t('customersWord')} · ${t('collected')} ${fmt(district.collected)}`}
                value={district.outstanding}
                max={maxDistrict}
                valueLabel={fmt(district.outstanding)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<AlertTriangle className="h-4 w-4 text-debit" />}
        title={`${t('overdueWatchlist')}${watchlist.length > 0 ? ` · ${watchlist.length}` : ''}`}
      >
        <p className="-mt-1.5 text-xs text-muted-foreground">{t('overdueHint')}</p>
        {watchlist.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-credit">{t('allSettled')}</p>
        ) : (
          <div className="grid">
            {watchlist.slice(0, 10).map((stat) => (
              <div key={stat.customer.id} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{stat.customer.name}</p>
                  <p className="tnum text-xs text-debit">
                    {stat.daysSinceLastPayment === null
                      ? `${t('lastPayment')}: ${t('never')}`
                      : `${t('lastPayment')}: ${stat.daysSinceLastPayment} ${t('daysAgo')}`}
                  </p>
                </div>
                <p className="tnum shrink-0 text-[15px] font-semibold text-debit">{fmt(stat.outstanding)}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={<Users className="h-4 w-4" />} title={t('customerAnalysis')}>
        {customerStats.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="grid">
            {customerStats.slice(0, 15).map((stat) => {
              const slow = stat.daysSinceLastPayment !== null && stat.daysSinceLastPayment > 30
              return (
                <div key={stat.customer.id} className="grid gap-0.5 border-b border-border py-2.5 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-[15px] font-medium">{stat.customer.name}</p>
                    <p className="tnum shrink-0 text-[15px] font-semibold text-primary-pressed">{fmt(stat.outstanding)}</p>
                  </div>
                  <p className="tnum text-xs text-muted-foreground">
                    {stat.payments} {t('payments')}
                    {' · '}
                    <span className={cn(slow && 'font-medium text-debit')}>
                      {t('lastPayment')}:{' '}
                      {stat.daysSinceLastPayment === null ? t('never') : `${stat.daysSinceLastPayment} ${t('daysAgo')}`}
                    </span>
                    {stat.averageGapDays !== null && ` · ${t('avgGapDays')}: ${stat.averageGapDays}`}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={<FileDown className="h-4 w-4" />} title={t('downloadAnalyticsPdf')}>
        <Field label={t('sectionsToInclude')}>
          <MultiPicker
            values={pdfSections}
            onChange={setPdfSections}
            options={sectionOptions}
            allLabel={t('all')}
            countLabel={(count) => `${count} ${t('selectedWord')}`}
            placeholder={t('sectionsToInclude')}
          />
        </Field>
        <Button
          className="w-full font-semibold shadow-[0_8px_20px_rgba(15,110,86,0.25)]"
          disabled={pdfSections.length === 0}
          onClick={downloadPdf}
        >
          <FileDown className="h-4 w-4" />
          {t('downloadAnalyticsPdf')}
        </Button>
      </SectionCard>
    </div>
  )
}

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

function ExportsView() {
  const { t, fmt, language, customers, entries, range, setRange, preferences } = useApp()
  const [type, setType] = React.useState<ReportType>('customer')
  const [customerId, setCustomerId] = React.useState(customers[0]?.id ?? '')
  const [district, setDistrict] = React.useState('')
  const [city, setCity] = React.useState('')
  const [dayDate, setDayDate] = React.useState(today)

  const districts = Array.from(new Set(customers.map((customer) => customer.district))).filter(Boolean).sort()
  const cities = Array.from(new Set(customers.map((customer) => customer.city))).filter(Boolean).sort()

  const needsCustomer = type === 'customer'
  const needsCity = type.toLowerCase().includes('city')
  const needsDistrict = type.toLowerCase().includes('district')
  // "Day summary" reports on one specific day, not a from/to span
  const isDaySummary = type === 'daySummary'
  const effectiveRange = isDaySummary ? { from: dayDate, to: dayDate } : range

  const scopedCustomers = needsCustomer
    ? customers.filter((customer) => customer.id === customerId)
    : needsCity && city
      ? customers.filter((customer) => customer.city === city)
      : needsDistrict && district
        ? customers.filter((customer) => customer.district === district)
        : customers

  const scopedIds = new Set(scopedCustomers.map((customer) => customer.id))
  const totals = totalsForEntries(
    entriesInRange(entries, effectiveRange).filter((entry) => scopedIds.has(entry.customerId)),
  )

  function exportPdf() {
    if (needsCustomer) {
      const customer = customers.find((item) => item.id === customerId)
      if (customer) exportCustomerLedgerPdf(customer, entries, effectiveRange)
      return
    }
    exportReportPdf(t(type), scopedCustomers, entries, effectiveRange)
  }

  return (
    <div className="space-y-4">
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

        {isDaySummary ? (
          <div className="animate-fade-up">
            <Field label={t('date')}>
              <DatePicker value={dayDate} onChange={setDayDate} language={language} dateFormat={preferences.dateFormat} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label={t('from')}>
              <DatePicker value={range.from} onChange={(from) => setRange({ ...range, from })} language={language} dateFormat={preferences.dateFormat} />
            </Field>
            <Field label={t('to')}>
              <DatePicker value={range.to} onChange={(to) => setRange({ ...range, to })} language={language} dateFormat={preferences.dateFormat} align="right" />
            </Field>
          </div>
        )}
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

export function ReportsScreen() {
  const { t } = useApp()
  const [view, setView] = React.useState<'analytics' | 'exports'>('analytics')

  return (
    <div className="space-y-4 animate-fade-up">
      <SegmentedControl<'analytics' | 'exports'>
        value={view}
        onChange={setView}
        options={[
          { value: 'analytics', label: t('analytics') },
          { value: 'exports', label: t('exportPdf') },
        ]}
      />
      {view === 'analytics' ? <AnalyticsView /> : <ExportsView />}
    </div>
  )
}
