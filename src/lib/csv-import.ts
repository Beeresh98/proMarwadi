import { today } from './ledger'

/* Keeps a single CSV upload well under Firestore's 500-write batch limit
   (each row can produce up to 2 ledger entries + 1 batch doc). */
export const CSV_IMPORT_MAX_ROWS = 200

export type ParsedImportRow = {
  rowNumber: number
  date: string
  bill?: number
  cash?: number
  note?: string
}

export type ImportErrorCode =
  | 'not-csv'
  | 'bad-header'
  | 'empty-file'
  | 'too-many-rows'
  | 'missing-date'
  | 'invalid-date'
  | 'bad-date-format'
  | 'future-date'
  | 'bad-amount'
  | 'negative-amount'
  | 'no-amount'

export type ImportRowError = {
  rowNumber: number
  rawValue: string
  code: ImportErrorCode
}

export type CsvParseResult = {
  rows: ParsedImportRow[]
  errors: ImportRowError[]
}

export function csvImportTemplate(): string {
  return 'DATE,BILL,CASH,NOTE\n'
}

/* Not cryptographic — just deterministic enough to flag "you already
   imported this exact file" before it creates duplicate entries. */
export function hashCsvContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i += 1) {
    hash = (Math.imul(hash, 31) + content.charCodeAt(i)) | 0
  }
  return `${hash}-${content.length}`
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
const DMY_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/

type DateParseResult = { iso: string } | { badFormat: true } | { invalid: true }

function parseDateCell(raw: string): DateParseResult {
  const trimmed = raw.trim()
  const isoMatch = ISO_DATE.exec(trimmed)
  const dmyMatch = DMY_DATE.exec(trimmed)
  let year: number
  let month: number
  let day: number
  if (isoMatch) {
    year = Number(isoMatch[1])
    month = Number(isoMatch[2])
    day = Number(isoMatch[3])
  } else if (dmyMatch) {
    day = Number(dmyMatch[1])
    month = Number(dmyMatch[2])
    year = Number(dmyMatch[3])
  } else {
    return { badFormat: true }
  }
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { invalid: true }
  }
  return { iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
}

function parseAmountCell(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, '')
  if (cleaned === '') return NaN
  return Number(cleaned)
}

const EXPECTED_HEADER = ['DATE', 'BILL', 'CASH']

/* Never throws — every row is checked independently so one bad row never
   hides the rest. Nothing is imported unless `errors` comes back empty. */
const BOM = String.fromCharCode(0xfeff)

export function parseCsvImportFile(rawContent: string): CsvParseResult {
  const content = rawContent.startsWith(BOM) ? rawContent.slice(1) : rawContent
  const lines = content.split(/\r\n|\n|\r/)
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()

  if (lines.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, rawValue: '', code: 'empty-file' }] }
  }

  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toUpperCase())
  const headerOk = EXPECTED_HEADER.every((column, index) => header[index] === column)
  if (!headerOk) {
    return { rows: [], errors: [{ rowNumber: 1, rawValue: lines[0], code: 'bad-header' }] }
  }

  const dataLines = lines.slice(1).filter((line) => line.trim() !== '')
  if (dataLines.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, rawValue: '', code: 'empty-file' }] }
  }
  if (dataLines.length > CSV_IMPORT_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, rawValue: String(CSV_IMPORT_MAX_ROWS), code: 'too-many-rows' }],
    }
  }

  const rows: ParsedImportRow[] = []
  const errors: ImportRowError[] = []

  lines.slice(1).forEach((line, index) => {
    if (line.trim() === '') return
    const rowNumber = index + 2 // +1 for 0-index, +1 for the header row above
    const [rawDate = '', rawBill = '', rawCash = '', rawNote = ''] = splitCsvLine(line)
    const billEmpty = rawBill.trim() === ''
    const cashEmpty = rawCash.trim() === ''

    if (rawDate.trim() === '') {
      errors.push({ rowNumber, rawValue: line, code: 'missing-date' })
      return
    }

    const parsedDate = parseDateCell(rawDate)
    if ('badFormat' in parsedDate) {
      errors.push({ rowNumber, rawValue: rawDate.trim(), code: 'bad-date-format' })
      return
    }
    if ('invalid' in parsedDate) {
      errors.push({ rowNumber, rawValue: rawDate.trim(), code: 'invalid-date' })
      return
    }
    if (parsedDate.iso > today) {
      errors.push({ rowNumber, rawValue: rawDate.trim(), code: 'future-date' })
      return
    }

    if (billEmpty && cashEmpty) {
      errors.push({ rowNumber, rawValue: line, code: 'no-amount' })
      return
    }

    let bill: number | undefined
    let cash: number | undefined
    let hadAmountError = false

    if (!billEmpty) {
      const value = parseAmountCell(rawBill)
      if (Number.isNaN(value)) {
        errors.push({ rowNumber, rawValue: rawBill.trim(), code: 'bad-amount' })
        hadAmountError = true
      } else if (value <= 0) {
        errors.push({ rowNumber, rawValue: rawBill.trim(), code: 'negative-amount' })
        hadAmountError = true
      } else {
        bill = value
      }
    }
    if (!cashEmpty) {
      const value = parseAmountCell(rawCash)
      if (Number.isNaN(value)) {
        errors.push({ rowNumber, rawValue: rawCash.trim(), code: 'bad-amount' })
        hadAmountError = true
      } else if (value <= 0) {
        errors.push({ rowNumber, rawValue: rawCash.trim(), code: 'negative-amount' })
        hadAmountError = true
      } else {
        cash = value
      }
    }
    if (hadAmountError) return

    rows.push({ rowNumber, date: parsedDate.iso, bill, cash, note: rawNote.trim() || undefined })
  })

  return { rows, errors }
}
