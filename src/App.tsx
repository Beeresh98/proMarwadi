import * as React from 'react'
import { FileText, Home, Printer, Settings, Users } from 'lucide-react'
import { CustomerSheet } from './components/app/customer-sheet'
import { EntrySheet, type EntryDraft } from './components/app/entry-sheet'
import { useApp } from './lib/store'
import type { Customer, EntryType } from './lib/types'
import { cn } from './lib/utils'
import { CollectionScreen } from './screens/collection'
import { CustomersScreen } from './screens/customers'
import { HomeScreen } from './screens/home'
import { LedgerScreen } from './screens/ledger'
import { ReportsScreen } from './screens/reports'
import { SettingsScreen } from './screens/settings'

type Tab = 'home' | 'customers' | 'collection' | 'reports' | 'settings'

function App() {
  const { t, customers } = useApp()
  const [tab, setTab] = React.useState<Tab>('home')
  const [openCustomerId, setOpenCustomerId] = React.useState('')
  const [districtFilter, setDistrictFilter] = React.useState('')
  const [entryDraft, setEntryDraft] = React.useState<EntryDraft | null>(null)
  const [customerSheet, setCustomerSheet] = React.useState<{ open: boolean; editing: Customer | null }>({
    open: false,
    editing: null,
  })

  const openCustomer = customers.find((customer) => customer.id === openCustomerId)

  function navigate(next: Tab) {
    setTab(next)
    setOpenCustomerId('')
  }

  function startEntry(type: EntryType, customerId = '') {
    setEntryDraft({ customerId, type })
  }

  const navItems: Array<{ tab: Tab; label: string; icon: React.ReactNode }> = [
    { tab: 'home', label: t('home'), icon: <Home className="h-5 w-5" /> },
    { tab: 'customers', label: t('customers'), icon: <Users className="h-5 w-5" /> },
    { tab: 'collection', label: t('collection'), icon: <Printer className="h-5 w-5" /> },
    { tab: 'reports', label: t('reports'), icon: <FileText className="h-5 w-5" /> },
    { tab: 'settings', label: t('settings'), icon: <Settings className="h-5 w-5" /> },
  ]

  return (
    <div className="min-h-dvh bg-background text-foreground lg:flex">
      <aside className="hidden print:!hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1.5 lg:border-r lg:border-border lg:bg-card lg:p-5">
        <p className="mb-6 px-3 pt-1 text-[19px] font-semibold tracking-tight text-primary-pressed">{t('appName')}</p>
        {navItems.map((item) => {
          const active = tab === item.tab && !openCustomer
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
              {openCustomer ? t('ledger') : navItems.find((item) => item.tab === tab)?.label}
            </span>
          </div>
        </header>

        <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 print:p-0 lg:px-10 lg:pb-10 lg:pt-8">
          {!openCustomer && (
            <h1 className="mb-6 hidden text-[22px] font-semibold tracking-tight print:!hidden lg:block">
              {navItems.find((item) => item.tab === tab)?.label}
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
          ) : tab === 'home' ? (
            <HomeScreen
              onOpenDistrict={(district) => {
                setDistrictFilter(district)
                setTab('customers')
              }}
              onOpenCustomer={setOpenCustomerId}
              onNewEntry={startEntry}
            />
          ) : tab === 'customers' ? (
            <CustomersScreen
              districtFilter={districtFilter}
              onDistrictFilterChange={setDistrictFilter}
              onOpenCustomer={setOpenCustomerId}
              onAddCustomer={() => setCustomerSheet({ open: true, editing: null })}
            />
          ) : tab === 'collection' ? (
            <CollectionScreen />
          ) : tab === 'reports' ? (
            <ReportsScreen />
          ) : (
            <SettingsScreen />
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] print:hidden lg:hidden">
        <div className="mx-auto flex max-w-xl">
          {navItems.map((item) => {
            const active = tab === item.tab && !openCustomer
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
