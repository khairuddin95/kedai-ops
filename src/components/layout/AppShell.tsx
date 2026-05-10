import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { STRINGS } from '../../utils/i18n'
import Avatar from '../ui/Avatar'
import { sendNotification } from '../../lib/notifications'
import { hasFeature } from '../../utils/permissions'
import type { FeatureKey, User } from '../../types'

type NavItem = { to: string; icon: string; label: string; key: FeatureKey }

const ALL_NAV: NavItem[] = [
  { key: 'home',          to: '/',              icon: '🏠', label: 'home' },
  { key: 'tasks',         to: '/tasks',         icon: '📋', label: 'tasks' },
  { key: 'dashboard',     to: '/dashboard',     icon: '📊', label: 'dashboard' },
  { key: 'review',        to: '/review',        icon: '🔍', label: 'review' },
  { key: 'schedule',      to: '/schedule',      icon: '📅', label: 'nav_schedule' },
  { key: 'maintenance',   to: '/maintenance',   icon: '🔧', label: 'maintenance' },
  { key: 'loans',         to: '/loans',         icon: '📦', label: 'loan_item' },
  { key: 'tasks-admin',   to: '/tasks-admin',   icon: '📋', label: 'task_mgmt' },
  { key: 'assets',        to: '/assets',        icon: '🗄️', label: 'asset_mgmt' },
  { key: 'branches',      to: '/branches',      icon: '🏪', label: 'branch_setup' },
  { key: 'staff',         to: '/staff',         icon: '👥', label: 'staff' },
  { key: 'google-review', to: '/google-review', icon: '⭐', label: 'google_review' },
  { key: 'history',       to: '/history',       icon: '📜', label: 'history' },
  { key: 'settings',      to: '/settings',      icon: '⚙️', label: 'settings' },
]

function navItems(user: User, lang: 'bm' | 'en'): NavItem[] {
  const s = STRINGS[lang]
  return ALL_NAV
    .filter(item => hasFeature(user, item.key))
    .map(item => ({ ...item, label: s[item.label] ?? item.label }))
}

const PRIMARY_COUNT = 4

export default function AppShell() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const lang = state.lang
  const s = STRINGS[lang]
  const role = state.user?.role ?? 'staff'
  const items = navItems(state.user!, lang)
  const primaryItems = items.slice(0, PRIMARY_COUNT)
  const moreItems    = items.slice(PRIMARY_COUNT)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const pendingCount = (role === 'supervisor' || role === 'owner')
    ? state.submissions.filter(sub => sub.status === 'pending').length
    : 0

  // OS notification when a new pending submission arrives
  const prevPendingRef = useRef<number | null>(null)
  useEffect(() => {
    if (role === 'staff') return
    const prev = prevPendingRef.current
    prevPendingRef.current = pendingCount
    if (prev !== null && pendingCount > prev) {
      const newest = state.submissions.find(sub => sub.status === 'pending')
      sendNotification(
        '⏳ Submission Baru',
        newest ? `${newest.staffName} — ${newest.taskTitle}` : 'Ada submission menunggu semakan',
        'new_submission'
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, role])

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' })
    navigate('/login')
    setDrawerOpen(false)
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
        : 'text-[var(--text-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
    }`

  return (
    <div className="flex h-full">
      {/* ── Sidebar (desktop) ── */}
      <aside
        className="hidden md:flex flex-col w-[220px] min-w-[220px] bg-[var(--surface)] border-r border-[var(--border)] pb-5"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        {/* Logo */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-sm">K</div>
            <div>
              <div className="font-bold text-sm text-[var(--text)]">KedaiOps</div>
              <div className="text-[10px] text-[var(--text-muted)]">{s.version} · {state.user?.branch}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {items.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.to === '/review' && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar emoji={state.user?.avatar ?? '👤'} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate text-[var(--text)]">{state.user?.name}</div>
              <div className="text-[10px] text-[var(--text-muted)] capitalize">{state.user?.role}</div>
            </div>
            <button onClick={handleLogout} title="Log keluar" className="text-[var(--text-muted)] hover:text-red-500 transition-colors text-sm">⏻</button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar — paddingTop pushes content below notch/dynamic island in PWA mode */}
        <header
          className="bg-[var(--surface)] border-b border-[var(--border)] flex-shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="h-14 flex items-center px-5 gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--text)] truncate">
                {state.user?.name}
                <span className="text-xs font-normal text-[var(--text-muted)] ml-2 capitalize hidden sm:inline">{state.user?.role} · {state.user?.branch}</span>
              </div>
            </div>
            <div className="md:hidden flex items-center gap-2 flex-shrink-0">
              <Avatar emoji={state.user?.avatar ?? '👤'} size="sm" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 pb-24 md:pb-5 main-content">
          <div className="max-w-[1100px] mx-auto animate-fadeIn">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Bottom Nav (mobile) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] flex z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primaryItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={{ touchAction: 'manipulation' }}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-brand-600' : 'text-[var(--text-muted)]'
              }`
            }
          >
            <div className="relative">
              <span className="text-lg">{item.icon}</span>
              {item.to === '/review' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[14px] text-center leading-none py-0.5">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
            <span className="truncate max-w-[52px] text-center leading-tight">{item.label}</span>
          </NavLink>
        ))}

        {/* More button — always visible for settings access */}
        <button
          onClick={() => setDrawerOpen(true)}
          style={{ touchAction: 'manipulation' }}
          className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
            drawerOpen ? 'text-brand-600' : 'text-[var(--text-muted)]'
          }`}
        >
          <span className="text-lg">☰</span>
          <span>Lagi</span>
        </button>
      </nav>

      {/* ── More Drawer (mobile) ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-50"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] rounded-t-2xl shadow-2xl border-t border-[var(--border)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border-2)]" />
            </div>

            {/* User info */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
              <Avatar emoji={state.user?.avatar ?? '👤'} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--text)] truncate">{state.user?.name}</div>
                <div className="text-xs text-[var(--text-muted)] capitalize">{state.user?.role} · {state.user?.branch}</div>
              </div>
            </div>

            {/* More nav items */}
            {moreItems.length > 0 && (
              <div className="px-3 py-2 grid grid-cols-2 gap-1">
                {moreItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setDrawerOpen(false)}
                    style={{ touchAction: 'manipulation' }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                          : 'text-[var(--text-soft)] hover:bg-[var(--surface-2)]'
                      }`
                    }
                  >
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.to === '/review' && pendingCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}

            <div className="pb-3" />
          </div>
        </>
      )}
    </div>
  )
}
