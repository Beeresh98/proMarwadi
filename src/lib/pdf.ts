import jsPDF from 'jspdf'
import autoTable, { type UserOptions } from 'jspdf-autotable'
import type { Customer, DateRange, LedgerEntry } from './types'
import { customerBalance, entriesInRange, ledgerRows, totalsForEntries } from './ledger'
import type {
  CollectionLogRow,
  CustomerStat,
  DistrictStat,
  EmployeeStat,
  ModeSplit,
  PeriodBucket,
  RouteStat,
  WeekdaySlot,
} from './analytics'

/* Branded PDF toolkit. Reports follow one visual system: dark-teal banner,
   KPI boxes, teal-headed striped tables — drawn shapes only, never images,
   so files stay tiny. Core jsPDF fonts have no ₹ glyph, hence "Rs". */

const ink: [number, number, number] = [44, 44, 42]
const teal: [number, number, number] = [15, 110, 86]
const heroTeal: [number, number, number] = [4, 52, 44]
const softFill: [number, number, number] = [247, 247, 245]
const lineGray: [number, number, number] = [211, 209, 199]
const mutedText: [number, number, number] = [95, 94, 90]
const debitRed: [number, number, number] = [163, 45, 45]

const debitStrong: [number, number, number] = [226, 75, 74]
const creditStrong: [number, number, number] = [99, 153, 34]
const accentTeal: [number, number, number] = [93, 202, 165]

const indian = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function money(value: number) {
  return `Rs ${indian.format(Math.round(value))}`
}

/* Compact axis labels: 1.2L / 45k / 900 */
function compact(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return String(Math.round(value))
}

function lastY(doc: jsPDF) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40
}

const pageWidth = 210
const margin = 14
const contentWidth = pageWidth - margin * 2

/* Dark banner with the app name, report title and generation stamp. */
function drawBanner(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...heroTeal)
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setTextColor(159, 225, 203)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('PROMARWADI', margin, 10)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.text(title, margin, 19)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(159, 225, 203)
  doc.text(subtitle, margin, 25.5)
  doc.setTextColor(...ink)
}

/* Row of rounded KPI boxes under the banner. */
function drawKpis(doc: jsPDF, y: number, kpis: Array<{ label: string; value: string; danger?: boolean }>) {
  const gap = 4
  const width = (contentWidth - gap * (kpis.length - 1)) / kpis.length
  kpis.forEach((kpi, index) => {
    const x = margin + index * (width + gap)
    doc.setFillColor(...softFill)
    doc.setDrawColor(...lineGray)
    doc.roundedRect(x, y, width, 16, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setTextColor(...mutedText)
    doc.text(kpi.label.toUpperCase(), x + 4, y + 5.5)
    doc.setFontSize(11.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(kpi.danger ? debitRed : teal))
    doc.text(kpi.value, x + 4, y + 12.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...ink)
  })
  return y + 16
}

function sectionTitle(doc: jsPDF, y: number, text: string) {
  if (y > 255) {
    doc.addPage()
    y = 16
  }
  doc.setFillColor(...teal)
  doc.rect(margin, y, 1.6, 6, 'F')
  doc.setFontSize(11.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ink)
  doc.text(text, margin + 4, y + 4.8)
  doc.setFont('helvetica', 'normal')
  return y + 9
}

/* House table style: teal header, zebra rows, right-aligned numerals. */
function styledTable(doc: jsPDF, options: UserOptions) {
  autoTable(doc, {
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: ink, lineColor: lineGray, lineWidth: 0.1 },
    headStyles: { fillColor: teal, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: softFill },
    footStyles: { fillColor: heroTeal, textColor: [255, 255, 255], fontStyle: 'bold' },
    ...options,
  })
}

/* ---- vector chart primitives ----------------------------------------
   All charts are drawn with jsPDF shape ops (rects / polygons) — genuine
   graphics in the PDF with zero image payload. */

function fillPolygon(doc: jsPDF, points: Array<[number, number]>, color: [number, number, number]) {
  if (points.length < 3) return
  doc.setFillColor(...color)
  const deltas: Array<[number, number]> = []
  for (let index = 1; index < points.length; index += 1) {
    deltas.push([points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]])
  }
  doc.lines(deltas, points[0][0], points[0][1], [1, 1], 'F', true)
}

function truncateText(doc: jsPDF, text: string, maxWidth: number) {
  if (doc.getTextWidth(text) <= maxWidth) return text
  let result = text
  while (result.length > 1 && doc.getTextWidth(`${result}…`) > maxWidth) result = result.slice(0, -1)
  return `${result}…`
}

/* Grouped billed/collected bar chart with gridlines, axis labels and legend. */
function pdfBarChart(doc: jsPDF, x: number, y: number, w: number, h: number, buckets: PeriodBucket[]) {
  const plotX = x + 12
  const plotW = w - 12
  const plotH = h - 6
  const max = Math.max(...buckets.map((bucket) => Math.max(bucket.debit, bucket.credit)), 1)

  doc.setFontSize(6.5)
  doc.setTextColor(...mutedText)
  doc.setDrawColor(...lineGray)
  doc.setLineWidth(0.1)
  for (let step = 0; step <= 3; step += 1) {
    const gy = y + plotH - (step / 3) * plotH
    doc.line(plotX, gy, plotX + plotW, gy)
    doc.text(compact((max * step) / 3), plotX - 1.5, gy + 1, { align: 'right' })
  }

  const slot = plotW / buckets.length
  const barW = Math.min(4.5, slot * 0.32)
  buckets.forEach((bucket, index) => {
    const cx = plotX + slot * index + slot / 2
    const debitH = (bucket.debit / max) * plotH
    const creditH = (bucket.credit / max) * plotH
    if (debitH > 0) {
      doc.setFillColor(...debitStrong)
      doc.rect(cx - barW - 0.25, y + plotH - debitH, barW, debitH, 'F')
    }
    if (creditH > 0) {
      doc.setFillColor(...creditStrong)
      doc.rect(cx + 0.25, y + plotH - creditH, barW, creditH, 'F')
    }
  })

  // x labels — at most ~9, always including first and last
  const step = Math.max(1, Math.ceil(buckets.length / 9))
  doc.setFontSize(6.5)
  doc.setTextColor(...mutedText)
  buckets.forEach((bucket, index) => {
    if (index % step !== 0 && index !== buckets.length - 1) return
    const cx = plotX + slot * index + slot / 2
    doc.text(bucket.label, cx, y + plotH + 3.5, { align: 'center' })
  })

  // legend, top right
  doc.setFontSize(7)
  const legendY = y - 2
  doc.setFillColor(...debitStrong)
  doc.circle(plotX + plotW - 42, legendY, 1.1, 'F')
  doc.setTextColor(...ink)
  doc.text('Billed', plotX + plotW - 39.5, legendY + 1)
  doc.setFillColor(...creditStrong)
  doc.circle(plotX + plotW - 22, legendY, 1.1, 'F')
  doc.text('Collected', plotX + plotW - 19.5, legendY + 1)

  return y + h
}

/* Donut chart built from ring-segment polygons, legend on the right. */
function pdfDonut(
  doc: jsPDF,
  x: number,
  y: number,
  slices: Array<{ label: string; value: number; color: [number, number, number] }>,
) {
  const rOuter = 17
  const rInner = 9.5
  const cx = x + rOuter + 2
  const cy = y + rOuter + 2
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1

  let angle = -90
  for (const slice of slices) {
    const sweep = (slice.value / total) * 360
    const end = angle + sweep
    const points: Array<[number, number]> = []
    for (let a = angle; a <= end; a += 4) {
      points.push([cx + rOuter * Math.cos((a * Math.PI) / 180), cy + rOuter * Math.sin((a * Math.PI) / 180)])
    }
    points.push([cx + rOuter * Math.cos((end * Math.PI) / 180), cy + rOuter * Math.sin((end * Math.PI) / 180)])
    for (let a = end; a >= angle; a -= 4) {
      points.push([cx + rInner * Math.cos((a * Math.PI) / 180), cy + rInner * Math.sin((a * Math.PI) / 180)])
    }
    fillPolygon(doc, points, slice.color)
    angle = end
  }

  doc.setFontSize(8)
  let legendY = cy - rOuter + 3
  for (const slice of slices) {
    doc.setFillColor(...slice.color)
    doc.roundedRect(cx + rOuter + 8, legendY - 2.4, 3, 3, 0.6, 0.6, 'F')
    doc.setTextColor(...ink)
    doc.text(
      `${slice.label} — ${money(slice.value)} (${Math.round((slice.value / total) * 100)}%)`,
      cx + rOuter + 13,
      legendY,
    )
    legendY += 6
  }
  return Math.max(cy + rOuter + 4, legendY + 2)
}

/* Horizontal bar rows: label · track bar · value. */
function pdfHBars(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  rows: Array<{ label: string; value: number; valueLabel: string }>,
  color: [number, number, number],
) {
  const labelW = 46
  const valueW = 26
  const trackW = w - labelW - valueW - 6
  const max = Math.max(...rows.map((row) => row.value), 1)
  doc.setFontSize(8)
  rows.forEach((row, index) => {
    const rowY = y + index * 7
    doc.setTextColor(...ink)
    doc.text(truncateText(doc, row.label, labelW - 2), x, rowY + 3)
    doc.setFillColor(...softFill)
    doc.roundedRect(x + labelW, rowY, trackW, 4, 1.2, 1.2, 'F')
    const barW = Math.max(1.5, (row.value / max) * trackW)
    doc.setFillColor(...color)
    doc.roundedRect(x + labelW, rowY, barW, 4, 1.2, 1.2, 'F')
    doc.setTextColor(...mutedText)
    doc.text(row.valueLabel, x + w, rowY + 3, { align: 'right' })
  })
  return y + rows.length * 7 + 2
}

/* Page-break guard for hand-drawn (non-autoTable) blocks. */
function ensureSpace(doc: jsPDF, y: number, needed: number) {
  if (y + needed <= 278) return y
  doc.addPage()
  return 16
}

function addFooters(doc: jsPDF) {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(...mutedText)
    doc.text(`ProMarwadi · ${new Date().toLocaleDateString('en-IN')}`, margin, 291)
    doc.text(`Page ${page} / ${pages}`, pageWidth - margin, 291, { align: 'right' })
  }
}

export function exportCustomerLedgerPdf(customer: Customer, entries: LedgerEntry[], range: DateRange) {
  const doc = new jsPDF()
  drawBanner(doc, `Customer Ledger — ${customer.name}`, `${range.from} to ${range.to} · generated ${new Date().toLocaleString('en-IN')}`)

  doc.setFontSize(9)
  doc.setTextColor(...mutedText)
  doc.text(
    `${customer.city} · ${customer.district}${customer.phone ? ` · ${customer.phone}` : ''}${customer.address ? ` · ${customer.address}` : ''}`,
    margin,
    37,
  )

  const rows = ledgerRows(customer, entries, range)
  const totals = totalsForEntries(rows)
  const balance = customerBalance(customer, entries)
  const y = drawKpis(doc, 41, [
    { label: 'Opening balance', value: money(customer.openingBalance) },
    { label: 'Billed in range', value: money(totals.debit) },
    { label: 'Received in range', value: money(totals.credit) },
    { label: 'Current balance', value: money(balance), danger: balance > 0 },
  ])

  styledTable(doc, {
    startY: y + 5,
    head: [['Date', 'Bill', 'Received', 'Mode', 'Note', 'Balance']],
    body: rows.map((entry) => [
      entry.date,
      entry.type === 'debit' ? money(entry.amount) : '',
      entry.type === 'credit' ? money(entry.amount) : '',
      entry.type === 'credit'
        ? `${(entry.paymentMode ?? 'cash').toUpperCase()}${entry.bankName ? ` · ${entry.bankName}` : ''}${entry.upiApp ? ` · ${entry.upiApp}` : ''}`
        : '',
      `${entry.note ?? ''}${entry.isEdited ? ` (edited x${entry.editCount})` : ''}`,
      money(entry.runningBalance),
    ]),
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  })
  addFooters(doc)
  doc.save(`${customer.name}-ledger.pdf`)
}

export function exportReportPdf(
  title: string,
  customers: Customer[],
  entries: LedgerEntry[],
  range: DateRange,
) {
  const doc = new jsPDF()
  drawBanner(doc, title, `${range.from} to ${range.to} · generated ${new Date().toLocaleString('en-IN')}`)

  const rangedEntries = entriesInRange(entries, range)
  const rows = customers.map((customer) => {
    const totals = totalsForEntries(rangedEntries.filter((entry) => entry.customerId === customer.id))
    return { customer, totals, balance: customerBalance(customer, entries) }
  })
  const billed = rows.reduce((sum, row) => sum + row.totals.debit, 0)
  const received = rows.reduce((sum, row) => sum + row.totals.credit, 0)
  const outstanding = rows.reduce((sum, row) => sum + row.balance, 0)

  const y = drawKpis(doc, 36, [
    { label: 'Customers', value: String(rows.length) },
    { label: 'Billed in range', value: money(billed) },
    { label: 'Received in range', value: money(received) },
    { label: 'Total outstanding', value: money(outstanding), danger: outstanding > 0 },
  ])

  styledTable(doc, {
    startY: y + 5,
    head: [['Customer', 'Phone', 'City', 'District', 'Bill', 'Received', 'Balance']],
    body: rows.map(({ customer, totals, balance }) => [
      customer.name,
      customer.phone,
      customer.city,
      customer.district,
      money(totals.debit),
      money(totals.credit),
      money(balance),
    ]),
    foot: [['Total', '', '', '', money(billed), money(received), money(outstanding)]],
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  })
  addFooters(doc)
  doc.save(`${title.toLowerCase().replaceAll(' ', '-')}.pdf`)
}

export type AnalyticsSection =
  | 'overview'
  | 'weekday'
  | 'modes'
  | 'employees'
  | 'routes'
  | 'districts'
  | 'watchlist'
  | 'customers'
  | 'log'

export type AnalyticsPdfData = {
  grainLabel: string
  rangeLabel: string
  kpis: Array<{ label: string; value: string; danger?: boolean }>
  buckets: PeriodBucket[]
  modeSplit: ModeSplit[]
  employees: EmployeeStat[]
  routes: RouteStat[]
  districts: DistrictStat[]
  weekday: WeekdaySlot[]
  watchlist: CustomerStat[]
  customers: CustomerStat[]
  log: CollectionLogRow[]
  /* which sections to render, in the fixed order below */
  sections: AnalyticsSection[]
  /* customers section: full book vs top 20 by outstanding */
  allCustomers: boolean
}

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pdfModeColors: Record<string, [number, number, number]> = {
  cash: creditStrong,
  bank: teal,
  upi: accentTeal,
}

/* The selectable business report: KPI band, then only the sections the user
   picked — each led by a vector chart, followed by its table. */
export function exportAnalyticsPdf(data: AnalyticsPdfData) {
  const doc = new jsPDF()
  const has = (section: AnalyticsSection) => data.sections.includes(section)
  drawBanner(doc, `Business Analytics — ${data.grainLabel}`, `${data.rangeLabel} · generated ${new Date().toLocaleString('en-IN')}`)

  let y = drawKpis(doc, 36, data.kpis) + 6

  if (has('overview')) {
    y = sectionTitle(doc, y, `${data.grainLabel} overview`)
    y = ensureSpace(doc, y, 56)
    y = pdfBarChart(doc, margin, y + 3, contentWidth, 46, data.buckets) + 4
    styledTable(doc, {
      startY: y,
      head: [['Period', 'Billed', 'Collected', 'Collections', 'Net']],
      body: data.buckets.map((bucket) => [
        bucket.label,
        money(bucket.debit),
        money(bucket.credit),
        String(bucket.count),
        money(bucket.credit - bucket.debit),
      ]),
      foot: [
        [
          'Total',
          money(data.buckets.reduce((sum, bucket) => sum + bucket.debit, 0)),
          money(data.buckets.reduce((sum, bucket) => sum + bucket.credit, 0)),
          String(data.buckets.reduce((sum, bucket) => sum + bucket.count, 0)),
          money(data.buckets.reduce((sum, bucket) => sum + bucket.credit - bucket.debit, 0)),
        ],
      ],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    })
    y = lastY(doc) + 8
  }

  if (has('weekday') && data.weekday.some((slot) => slot.count > 0)) {
    y = sectionTitle(doc, y, 'Collection pattern by weekday')
    y = ensureSpace(doc, y, 54)
    y =
      pdfHBars(
        doc,
        margin,
        y + 2,
        contentWidth,
        data.weekday.map((slot) => ({
          label: weekdayLabels[slot.weekday],
          value: slot.total,
          valueLabel: `${money(slot.total)} (${slot.count})`,
        })),
        teal,
      ) + 6
  }

  if (has('modes') && data.modeSplit.length > 0) {
    y = sectionTitle(doc, y, 'Collections by payment mode')
    y = ensureSpace(doc, y, 46)
    y =
      pdfDonut(
        doc,
        margin,
        y + 2,
        data.modeSplit.map((slot) => ({
          label: slot.mode.toUpperCase(),
          value: slot.total,
          color: pdfModeColors[slot.mode],
        })),
      ) + 6
  }

  if (has('employees') && data.employees.length > 0) {
    y = sectionTitle(doc, y, 'Employee collections')
    y = ensureSpace(doc, y, data.employees.slice(0, 8).length * 7 + 10)
    y = pdfHBars(
      doc,
      margin,
      y + 2,
      contentWidth,
      data.employees.slice(0, 8).map((employee) => ({
        label: employee.name,
        value: employee.total,
        valueLabel: money(employee.total),
      })),
      creditStrong,
    )
    styledTable(doc, {
      startY: y + 2,
      head: [['Employee', 'Collections', 'Total collected', 'Average']],
      body: data.employees.map((employee) => [
        employee.name,
        String(employee.count),
        money(employee.total),
        money(employee.average),
      ]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' } },
    })
    y = lastY(doc) + 8
  }

  if (has('routes') && data.routes.length > 0) {
    y = sectionTitle(doc, y, 'Route performance')
    y = ensureSpace(doc, y, data.routes.slice(0, 8).length * 7 + 10)
    y = pdfHBars(
      doc,
      margin,
      y + 2,
      contentWidth,
      data.routes.slice(0, 8).map((route) => ({
        label: route.name,
        value: route.outstanding,
        valueLabel: money(route.outstanding),
      })),
      teal,
    )
    styledTable(doc, {
      startY: y + 2,
      head: [['Route', 'Customers', 'Billed', 'Collected', 'Outstanding']],
      body: data.routes.map((route) => [
        route.name,
        String(route.customers),
        money(route.billed),
        money(route.collected),
        money(route.outstanding),
      ]),
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    })
    y = lastY(doc) + 8
  }

  if (has('districts') && data.districts.length > 0) {
    y = sectionTitle(doc, y, 'District overview')
    y = ensureSpace(doc, y, data.districts.slice(0, 8).length * 7 + 10)
    y = pdfHBars(
      doc,
      margin,
      y + 2,
      contentWidth,
      data.districts.slice(0, 8).map((district) => ({
        label: district.name,
        value: district.outstanding,
        valueLabel: money(district.outstanding),
      })),
      teal,
    )
    styledTable(doc, {
      startY: y + 2,
      head: [['District', 'Customers', 'Billed', 'Collected', 'Outstanding']],
      body: data.districts.map((district) => [
        district.name,
        String(district.customers),
        money(district.billed),
        money(district.collected),
        money(district.outstanding),
      ]),
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    })
    y = lastY(doc) + 8
  }

  if (has('watchlist') && data.watchlist.length > 0) {
    y = sectionTitle(doc, y, `Overdue watchlist — no payment in 30+ days (${data.watchlist.length})`)
    styledTable(doc, {
      startY: y,
      head: [['Customer', 'Phone', 'Outstanding', 'Last payment', 'Silent for']],
      body: data.watchlist.map((stat) => [
        stat.customer.name,
        stat.customer.phone,
        money(stat.outstanding),
        stat.lastPaymentDate || 'Never',
        stat.daysSinceLastPayment === null ? '—' : `${stat.daysSinceLastPayment} days`,
      ]),
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' }, 4: { halign: 'right' } },
      didParseCell: (hook) => {
        if (hook.section === 'body' && hook.column.index === 4) {
          hook.cell.styles.textColor = debitRed
          hook.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = lastY(doc) + 8
  }

  if (has('customers') && data.customers.length > 0) {
    const rows = data.allCustomers ? data.customers : data.customers.slice(0, 20)
    y = sectionTitle(
      doc,
      y,
      data.allCustomers
        ? `Customer analysis — all ${rows.length} customers`
        : 'Customer analysis — top 20 by outstanding',
    )
    styledTable(doc, {
      startY: y,
      head: [['Customer', 'Outstanding', 'Billed', 'Collected', 'Payments', 'Last payment', 'Avg gap (days)']],
      body: rows.map((stat) => [
        stat.customer.name,
        money(stat.outstanding),
        money(stat.billed),
        money(stat.collected),
        String(stat.payments),
        stat.lastPaymentDate ? `${stat.lastPaymentDate} (${stat.daysSinceLastPayment}d ago)` : 'Never',
        stat.averageGapDays === null ? '—' : String(stat.averageGapDays),
      ]),
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        6: { halign: 'right' },
      },
      didParseCell: (hook) => {
        // slow payers (30+ days silent) print in debit red
        if (hook.section !== 'body') return
        const stat = rows[hook.row.index]
        if (stat && stat.daysSinceLastPayment !== null && stat.daysSinceLastPayment > 30 && hook.column.index === 5) {
          hook.cell.styles.textColor = debitRed
          hook.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = lastY(doc) + 8
  }

  if (has('log') && data.log.length > 0) {
    const rows = data.log.slice(0, 400)
    y = sectionTitle(
      doc,
      y,
      `Collections log (${data.log.length}${data.log.length > rows.length ? `, first ${rows.length} shown` : ''})`,
    )
    styledTable(doc, {
      startY: y,
      head: [['Date', 'Customer', 'Amount', 'Mode', 'Collected by']],
      body: rows.map((row) => [row.date, row.customerName, money(row.amount), row.mode, row.collector]),
      foot: [['Total', '', money(data.log.reduce((sum, row) => sum + row.amount, 0)), '', '']],
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    })
  }

  addFooters(doc)
  doc.save(`promarwadi-analytics-${data.grainLabel.toLowerCase().replaceAll(' ', '-')}.pdf`)
}
