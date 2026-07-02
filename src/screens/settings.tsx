import { Database, FileJson, FileSpreadsheet, Info, Languages, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui/button'
import { SegmentedControl } from '../components/ui/picker'
import { downloadFile, toCsv } from '../lib/ledger'
import { useApp } from '../lib/store'
import type { Language, UserRole } from '../lib/types'

export function SettingsScreen() {
  const { t, language, setLanguage, role, setRole, isAdmin, customers, entries } = useApp()

  return (
    <div className="space-y-4 animate-fade-up">
      <section className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4">
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
            <Languages className="h-4 w-4" />
            {t('language')}
          </p>
          <SegmentedControl<Language>
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'हिंदी' },
            ]}
          />
        </div>
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
            <ShieldCheck className="h-4 w-4" />
            {t('role')}
          </p>
          <SegmentedControl<UserRole>
            value={role}
            onChange={setRole}
            options={[
              { value: 'admin', label: t('admin') },
              { value: 'staff', label: t('staff') },
            ]}
          />
          {!isAdmin && <p className="text-xs text-muted-foreground animate-fade-in">{t('staffRestriction')}</p>}
        </div>
      </section>

      <section className="grid gap-2.5 rounded-[var(--radius-card)] border border-border bg-card p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
          <Database className="h-4 w-4" />
          {t('backups')}
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            downloadFile(
              'promarwadi-backup.json',
              JSON.stringify({ customers, entries, exportedAt: new Date().toISOString() }, null, 2),
              'application/json',
            )
          }
        >
          <FileJson className="h-4 w-4" />
          {t('exportJson')}
        </Button>
        <Button variant="secondary" onClick={() => downloadFile('promarwadi-customers.csv', toCsv(customers), 'text/csv')}>
          <FileSpreadsheet className="h-4 w-4" />
          {t('exportCustomersCsv')}
        </Button>
        <Button variant="secondary" onClick={() => downloadFile('promarwadi-ledger.csv', toCsv(entries), 'text/csv')}>
          <FileSpreadsheet className="h-4 w-4" />
          {t('exportLedgerCsv')}
        </Button>
      </section>

      <p className="flex items-start gap-2 rounded-[var(--radius-card)] bg-muted p-3.5 text-xs text-secondary-text">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        {t('demoNote')}
      </p>
    </div>
  )
}
