import * as React from 'react'
import { AlertTriangle, CheckCircle2, History, RotateCcw, Upload } from 'lucide-react'
import {
  csvImportTemplate,
  hashCsvContent,
  parseCsvImportFile,
  type CsvParseResult,
  type ImportErrorCode,
  type ImportRowError,
} from '../../lib/csv-import'
import { formatDisplayDate } from '../ui/date-picker'
import type { TranslationKey } from '../../lib/i18n'
import { customerBalance, downloadFile } from '../../lib/ledger'
import { useApp } from '../../lib/store'
import type { Customer } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { ConfirmDialog, Sheet } from '../ui/sheet'

const FILE_LEVEL_CODES: ImportErrorCode[] = ['not-csv', 'bad-header', 'empty-file', 'too-many-rows']

const ERROR_MESSAGE_KEY: Record<ImportErrorCode, TranslationKey> = {
  'not-csv': 'csvErrNotCsv',
  'bad-header': 'csvErrBadHeader',
  'empty-file': 'csvErrEmptyFile',
  'too-many-rows': 'csvErrTooManyRows',
  'missing-date': 'csvErrMissingDate',
  'invalid-date': 'csvErrInvalidDate',
  'bad-date-format': 'csvErrBadDateFormat',
  'future-date': 'csvErrFutureDate',
  'bad-amount': 'csvErrBadAmount',
  'negative-amount': 'csvErrNegativeAmount',
  'no-amount': 'csvErrNoAmount',
}

function errorMessage(t: (key: TranslationKey) => string, error: ImportRowError) {
  return t(ERROR_MESSAGE_KEY[error.code]).replace('{value}', error.rawValue)
}

export function ImportSheet({
  open,
  customer,
  onClose,
}: {
  open: boolean
  customer: Customer | null
  onClose: () => void
}) {
  const { t, fmt, language, preferences, entries, importBatches, importEntries, reverseImportBatch } = useApp()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = React.useState('')
  const [fileHash, setFileHash] = React.useState('')
  const [result, setResult] = React.useState<CsvParseResult | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [justImported, setJustImported] = React.useState<number | null>(null)
  const [reverseTarget, setReverseTarget] = React.useState('')

  const batches = React.useMemo(
    () => (customer ? importBatches.filter((batch) => batch.customerId === customer.id) : []),
    [importBatches, customer],
  )

  function resetPicker() {
    setFileName('')
    setFileHash('')
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    resetPicker()
    setJustImported(null)
    setReverseTarget('')
    onClose()
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setJustImported(null)
    setFileName(file.name)
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension !== 'csv') {
      setResult({ rows: [], errors: [{ rowNumber: 0, rawValue: file.name, code: 'not-csv' }] })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? '')
      setFileHash(hashCsvContent(content))
      setResult(parseCsvImportFile(content))
    }
    reader.readAsText(file)
  }

  if (!customer) return null

  const rows = result?.rows ?? []
  const errors = result?.errors ?? []
  const isFileLevelError = errors.length === 1 && FILE_LEVEL_CODES.includes(errors[0].code)
  const isValid = result !== null && errors.length === 0 && rows.length > 0

  const totalBill = rows.reduce((sum, row) => sum + (row.bill ?? 0), 0)
  const totalCash = rows.reduce((sum, row) => sum + (row.cash ?? 0), 0)
  const entryCount = rows.reduce((sum, row) => sum + (row.bill ? 1 : 0) + (row.cash ? 1 : 0), 0)
  const balanceBefore = customerBalance(customer, entries)
  const balanceAfter = balanceBefore + totalBill - totalCash
  const duplicateBatch = isValid ? batches.find((batch) => batch.fileHash === fileHash && batch.status === 'active') : undefined

  function confirmImport() {
    if (!isValid || busy) return
    setBusy(true)
    importEntries({ customerId: customer!.id, fileName, fileHash, rows })
    setJustImported(entryCount)
    resetPicker()
    setBusy(false)
  }

  const reverseBatch = batches.find((batch) => batch.id === reverseTarget)

  return (
    <Sheet open={open} title={t('csvImportTitle')} onClose={handleClose}>
      <div className="grid gap-4 pt-1">
        {result === null && (
          <>
            {justImported !== null && (
              <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-credit/30 bg-credit-tint p-3.5 text-sm text-credit animate-fade-up">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="tnum">
                  {justImported} {t('csvImportSuccess')}
                </p>
              </div>
            )}

            <label className="pressable flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border-strong bg-muted/40 px-4 py-8 text-center hover:border-primary hover:bg-primary-tint">
              <Upload className="h-5 w-5 text-secondary-text" />
              <span className="text-[15px] font-medium">{t('chooseCsvFile')}</span>
              <span className="text-xs text-muted-foreground">DATE, BILL, CASH, NOTE — .csv</span>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>

            <button
              type="button"
              onClick={() =>
                downloadFile(
                  `${customer.name.replace(/[^a-z0-9]+/gi, '-')}-entries.csv`,
                  csvImportTemplate(),
                  'text/csv',
                )
              }
              className="pressable justify-self-center text-xs font-medium text-primary hover:underline"
            >
              {t('downloadCsvTemplate')}
            </button>

            <section className="grid gap-2.5">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
                <History className="h-4 w-4" />
                {t('csvImportHistory')}
              </p>
              {batches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted-foreground">
                  {t('csvNoImportsYet')}
                </p>
              ) : (
                <div className="stagger grid">
                  {batches.map((batch) => (
                    <div key={batch.id} className="grid gap-1.5 border-b border-border py-2.5 last:border-b-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[15px] font-medium">{batch.fileName}</p>
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-px text-[10px] font-medium',
                            batch.status === 'active' ? 'bg-primary-tint text-primary-pressed' : 'bg-muted text-secondary-text',
                          )}
                        >
                          {batch.status === 'active' ? t('csvActive') : t('csvReversed')}
                        </span>
                      </div>
                      <p className="tnum text-xs text-muted-foreground">
                        {formatDisplayDate(batch.createdAt.slice(0, 10), language, preferences.dateFormat)} ·{' '}
                        {batch.rowCount} {t('csvBatchRows')} · {batch.entryCount} {t('csvBatchEntries')} ·{' '}
                        {fmt(batch.totalBill)} / {fmt(batch.totalCash)}
                      </p>
                      {batch.status === 'reversed' && batch.reversedAt && (
                        <p className="tnum text-[11px] text-muted-foreground">
                          {t('csvReversedOn')}: {formatDisplayDate(batch.reversedAt.slice(0, 10), language, preferences.dateFormat)}
                        </p>
                      )}
                      {batch.status === 'active' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="justify-self-start"
                          onClick={() => setReverseTarget(batch.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t('csvReverse')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {result !== null && errors.length > 0 && (
          <div className="grid gap-3 animate-fade-up">
            {isFileLevelError ? (
              <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-debit-strong/40 bg-debit-tint p-3.5 text-sm text-debit">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{errorMessage(t, errors[0])}</p>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-sm font-medium text-debit">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {errors.length} {t('csvProblemsFound')}
                </p>
                <div className="grid max-h-64 gap-2 overflow-y-auto rounded-[var(--radius-card)] border border-debit-strong/30 bg-debit-tint p-3">
                  {errors.map((error, index) => (
                    <p key={index} className="text-xs leading-relaxed text-debit">
                      <span className="tnum font-medium">
                        {t('csvRowLabel')} {error.rowNumber}
                      </span>{' '}
                      {errorMessage(t, error)}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t('csvFixRowsToImport')}</p>
              </>
            )}
            <Button variant="secondary" onClick={resetPicker}>
              {t('chooseAnotherFile')}
            </Button>
          </div>
        )}

        {isValid && (
          <div className="grid gap-3 animate-fade-up">
            <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
              <p className="truncate text-[15px] font-medium">{fileName}</p>
              <div className="tnum mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('csvPreviewRows')}</p>
                  <p className="font-medium">{rows.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('entries')}</p>
                  <p className="font-medium">{entryCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('csvPreviewTotalBill')}</p>
                  <p className="font-medium text-debit">{fmt(totalBill)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('csvPreviewTotalCash')}</p>
                  <p className="font-medium text-credit">{fmt(totalCash)}</p>
                </div>
              </div>
              <div className="tnum mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span>
                  {t('csvPreviewBalanceBefore')}: <span className="font-medium">{fmt(balanceBefore)}</span>
                </span>
                <span>
                  {t('csvPreviewBalanceAfter')}: <span className="font-medium">{fmt(balanceAfter)}</span>
                </span>
              </div>
            </div>

            {duplicateBatch && (
              <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-debit-strong/40 bg-debit-tint p-3.5 text-xs text-debit animate-fade-in">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {t('csvDuplicateWarning').replace(
                    '{value}',
                    formatDisplayDate(duplicateBatch.createdAt.slice(0, 10), language, preferences.dateFormat),
                  )}
                </p>
              </div>
            )}

            <div className="flex gap-2.5">
              <Button variant="secondary" className="flex-1" onClick={resetPicker}>
                {t('chooseAnotherFile')}
              </Button>
              <Button variant="credit" className="flex-1" disabled={busy} onClick={confirmImport}>
                {busy ? t('csvImporting') : `${t('csvImportButton')} (${entryCount})`}
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(reverseTarget)}
        message={t('csvConfirmReverse').replace('{value}', String(reverseBatch?.entryCount ?? 0))}
        confirmLabel={t('csvReverse')}
        cancelLabel={t('cancel')}
        onCancel={() => setReverseTarget('')}
        onConfirm={() => {
          reverseImportBatch(reverseTarget)
          setReverseTarget('')
        }}
      />
    </Sheet>
  )
}
