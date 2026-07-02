import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Customer, DateRange, LedgerEntry } from './types'
import { entriesInRange, ledgerRows, totalsForEntries } from './ledger'

function titleCase(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim()
}

function addHeader(doc: jsPDF, title: string, range: DateRange) {
  doc.setFontSize(16)
  doc.text(title, 14, 16)
  doc.setFontSize(10)
  doc.text(`Date range: ${range.from} to ${range.to}`, 14, 23)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 29)
}

export function exportCustomerLedgerPdf(customer: Customer, entries: LedgerEntry[], range: DateRange) {
  const doc = new jsPDF()
  addHeader(doc, `Customer Ledger - ${customer.name}`, range)
  doc.text(`Phone: ${customer.phone || '-'} | City: ${customer.city} | District: ${customer.district}`, 14, 36)
  autoTable(doc, {
    startY: 44,
    head: [['Date', 'Type', 'Debit', 'Credit', 'Note', 'Running Balance', 'Flag']],
    body: ledgerRows(customer, entries, range).map((entry) => [
      entry.date,
      titleCase(entry.type),
      entry.type === 'debit' ? entry.amount.toFixed(2) : '',
      entry.type === 'credit' ? entry.amount.toFixed(2) : '',
      entry.note || '',
      entry.runningBalance.toFixed(2),
      entry.isEdited ? 'Edited' : '',
    ]),
  })
  doc.save(`${customer.name}-ledger.pdf`)
}

export function exportReportPdf(
  title: string,
  customers: Customer[],
  entries: LedgerEntry[],
  range: DateRange,
) {
  const doc = new jsPDF()
  const rangedEntries = entriesInRange(entries, range)
  addHeader(doc, title, range)
  autoTable(doc, {
    startY: 38,
    head: [['Customer', 'Phone', 'City', 'District', 'Debit', 'Credit', 'Balance']],
    body: customers.map((customer) => {
      const customerEntries = rangedEntries.filter((entry) => entry.customerId === customer.id)
      const totals = totalsForEntries(customerEntries)
      const allTotals = totalsForEntries(entries.filter((entry) => entry.customerId === customer.id))
      const balance = customer.openingBalance + allTotals.debit - allTotals.credit
      return [
        customer.name,
        customer.phone,
        customer.city,
        customer.district,
        totals.debit.toFixed(2),
        totals.credit.toFixed(2),
        balance.toFixed(2),
      ]
    }),
  })
  doc.save(`${title.toLowerCase().replaceAll(' ', '-')}.pdf`)
}
