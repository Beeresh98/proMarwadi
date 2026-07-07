import * as React from 'react'
import { AlertTriangle, Copy, FileText, Home, LogOut, Printer, Settings, Users, X } from 'lucide-react'
import { CustomerSheet } from './components/app/customer-sheet'
import { EntrySheet, type EntryDraft } from './components/app/entry-sheet'
import { useAuth } from './lib/auth'
import { useApp } from './lib/store'
import type { Customer, EntryType } from './lib/types'
import { cn } from './lib/utils'
import { Button } from './components/ui/button'
import { CollectionScreen } from './screens/collection'
import { CustomersScreen } from './screens/customers'
import { HomeScreen } from './screens/home'
import { LedgerScreen } from './screens/ledger'
import { LoginScreen } from './screens/login'
import { ReportsScreen } from './screens/reports'
import { SettingsScreen } from './screens/settings'

type Tab = 'home' | 'customers' | 'collection' | 'reports' | 'settings'

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-hero text-[22px] font-semibold text-hero-foreground">
        ₹
      </div>
    </div>
  )
}

function NoAccessScreen() {
  const { t } = useApp()
  const { user, signOutUser } = useAuth()
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 text-foreground">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-card p-6 text-center animate-fade-up">
        <h1 className="text-lg font-semibold">{t('noAccessTitle')}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('noAccessBody')}</p>
        {user?.email && <p className="mt-3 text-sm font-medium">{user.email}</p>}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(user?.uid ?? '')
            setCopied(true)
          }}
          className="pressable mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-secondary-text hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {t('userId')}: <span className="tnum">{user?.uid}</span>
          </span>
        </button>
        {copied && <p className="mt-1.5 text-xs text-credit animate-fade-in">{t('copied')}</p>}
        <Button variant="secondary" className="mt-5 w-full" onClick={() => void signOutUser()}>
          <LogOut className="h-4 w-4" />
          {t('signOut')}
        </Button>
      </div>
    </div>
  )
}

/* Cloud writes are fire-and-forget; when one fails (bad security rules,
   offline, …) this toast is the only signal the user gets. */
function SyncErrorToast() {
  const { t, syncError, clearSyncError } = useApp()
  if (!syncError) return null
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 print:hidden lg:bottom-6">
      <div className="flex max-w-md items-start gap-2.5 rounded-xl border border-debit-strong/40 bg-debit-tint p-3.5 text-sm text-debit shadow-[0_12px_32px_rgba(44,44,42,0.18)] animate-fade-up">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">
            {t('syncFailed')} <span className="font-normal">({syncError})</span>
          </p>
          <p className="mt-0.5 text-xs opacity-80">{t('syncFailedHint')}</p>
        </div>
        <button
          type="button"
          aria-label={t('cancel')}
          onClick={clearSyncError}
          className="pressable -m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-debit/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function App() {
  const { t, customers, isAdmin } = useApp()
  const authState = useAuth()
  const [tab, setTab] = React.useState<Tab>('home')
  const [openCustomerId, setOpenCustomerId] = React.useState('')
  const [districtFilter, setDistrictFilter] = React.useState('')
  const [entryDraft, setEntryDraft] = React.useState<EntryDraft | null>(null)
  const [customerSheet, setCustomerSheet] = React.useState<{ open: boolean; editing: Customer | null }>({
    open: false,
    editing: null,
  })

  const openCustomer = customers.find((customer) => customer.id === openCustomerId)

  // staff see their route-scoped customers, the collection sheet, and settings
  const allowedTabs: Tab[] = isAdmin
    ? ['home', 'customers', 'collection', 'reports', 'settings']
    : ['customers', 'collection', 'settings']
  const activeTab: Tab = allowedTabs.includes(tab) ? tab : isAdmin ? 'home' : 'collection'

  function navigate(next: Tab) {
    setTab(next)
    setOpenCustomerId('')
  }

  function startEntry(type: EntryType, customerId = '') {
    setEntryDraft({ customerId, type })
  }

  const allNavItems: Array<{ tab: Tab; label: string; icon: React.ReactNode }> = [
    { tab: 'home', label: t('home'), icon: <Home className="h-5 w-5" /> },
    { tab: 'customers', label: t('customers'), icon: <Users className="h-5 w-5" /> },
    { tab: 'collection', label: t('collection'), icon: <Printer className="h-5 w-5" /> },
    { tab: 'reports', label: t('reports'), icon: <FileText className="h-5 w-5" /> },
    { tab: 'settings', label: t('settings'), icon: <Settings className="h-5 w-5" /> },
  ]
  const navItems = allNavItems.filter((item) => allowedTabs.includes(item.tab))

  if (authState.mode === 'cloud' && authState.status !== 'ready') {
    if (authState.status === 'signedOut') return <LoginScreen />
    if (authState.status === 'noProfile') return <NoAccessScreen />
    return <Splash />
  }

  return (
    <div className="min-h-dvh bg-background text-foreground lg:flex">
      <aside className="hidden print:!hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1.5 lg:border-r lg:border-border lg:bg-card lg:p-5">
        <p className="mb-6 px-3 pt-1 text-[19px] font-semibold tracking-tight text-primary-pressed">{t('appName')}</p>
        {navItems.map((item) => {
          const active = activeTab === item.tab && !openCustomer
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => navigate(item.tab)}
              className={cn(
                'pressable flex items-center gap-3 rounded-[10px] px-3.5 py-3 text-left text-[15px]',
                active
                  ? 'bg-primary font-medium text-primary-foreground shadow-[0_2px_8px_rgba(15,110,86,0.25)]'
                  : 'text-secondary-text hover:bg-fill hover:text-foreground',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}
      </aside>

      <div className="mx-auto w-full max-w-xl flex-1 print:max-w-none lg:max-w-3xl">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur print:hidden lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-[17px] font-medium text-primary-pressed">{t('appName')}</h1>
            <span className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
              {openCustomer ? t('ledger') : navItems.find((item) => item.tab === activeTab)?.label}
            </span>
          </div>
        </header>

        <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 print:p-0 lg:px-10 lg:pb-10 lg:pt-8">
          {!openCustomer && (
            <h1 className="mb-6 hidden text-[22px] font-semibold tracking-tight print:!hidden lg:block">
              {navItems.find((item) => item.tab === activeTab)?.label}
            </h1>
          )}
          {openCustomer ? (
            <LedgerScreen
              key={openCustomer.id}
              customerId={openCustomer.id}
              onBack={() => setOpenCustomerId('')}
              onEditCustomer={() => setCustomerSheet({ open: true, editing: openCustomer })}
              onEntry={setEntryDraft}
            />
          ) : activeTab === 'home' ? (
            <HomeScreen
              onOpenDistrict={(district) => {
                setDistrictFilter(district)
                setTab('customers')
              }}
              onOpenCustomer={setOpenCustomerId}
              onNewEntry={startEntry}
            />
          ) : activeTab === 'customers' ? (
            <CustomersScreen
              districtFilter={districtFilter}
              onDistrictFilterChange={setDistrictFilter}
              onOpenCustomer={setOpenCustomerId}
              onAddCustomer={() => setCustomerSheet({ open: true, editing: null })}
            />
          ) : activeTab === 'collection' ? (
            <CollectionScreen />
          ) : activeTab === 'reports' ? (
            <ReportsScreen />
          ) : (
            <SettingsScreen />
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] print:hidden lg:hidden">
        <div className="mx-auto flex max-w-xl">
          {navItems.map((item) => {
            const active = activeTab === item.tab && !openCustomer
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => navigate(item.tab)}
                className={cn(
                  'pressable flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
                  active ? 'font-medium text-primary-pressed' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-lg transition-colors duration-200',
                    active && 'bg-primary text-primary-foreground',
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <SyncErrorToast />
      <EntrySheet draft={entryDraft} onClose={() => setEntryDraft(null)} />
      <CustomerSheet
        open={customerSheet.open}
        editing={customerSheet.editing}
        onClose={() => setCustomerSheet({ open: false, editing: null })}
      />
    </div>
  )
}

export default App
