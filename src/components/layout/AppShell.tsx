import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { STRINGS } from '../../utils/i18n'
import Avatar from '../ui/Avatar'

type NavItem = { to: string; icon: string; label: string }

function navItems(role: string, lang: 'bm' | 'en'): NavItem[] {
  const s = STRINGS[lang as 'bm' | 'en']
  if (role === 'staff') return [
    { to: '/',               icon: '🏠', label: s.home },
    { to: '/tasks',          icon: '📋', label: s.tasks },
    { to: '/google-review',  icon: '⭐', label: s.google_review },
    { to: '/history',        icon: '📜', label: s.history },
  ]
  if (role === 'supervisor') return [
    { to: '/dashboard',     icon: '📊', label: 'Dashboard' },
    { to: '/review',        icon: '🔍', label: s.review },
    { to: '/maintenance',   icon: '🔧', label: s.maintenance },
    { to: '/loans',         icon: '📦', label: s.loan_item },
    { to: '/tasks-admin',   icon: '📋', label: s.task_mgmt },
    { to: '/assets',        icon: '🗄️',  label: s.asset_mgmt },
    { to: '/google-review', icon: '⭐', label: s.google_review },
    { to: '/history',       icon: '📜', label: s.history },
  ]
  return [
    { to: '/dashboard',     icon: '📊', label: 'Dashboard' },
    { to: '/review',        icon: '🔍', label: s.review },
    { to: '/maintenance',   icon: '🔧', label: s.maintenance },
    { to: '/loans',         icon: '📦', label: s.loan_item },
    { to: '/tasks-admin',   icon: '📋', label: s.task_mgmt },
    { to: '/assets',        icon: '🗄️',  label: s.asset_mgmt },
    { to: '/branches',      icon: '🏪', label: s.branch_setup },
    { to: '/staff',         icon: '👥', label: s.staff },
    { to: '/google-review', icon: '⭐', label: s.google_review },
    { to: '/history',       icon: '📜', label: s.history },
  ]
}

const PRIMARY_COUNT = 4

export default function AppShell() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const lang = state.lang
  const s = STRINGS[lang]
  const role = state.user?.role ?? 'staff'
  const items = navItems(role, lang)
  const primaryItems = items.slice(0, PRIMARY_COUNT)
  const moreItems    = items.slice(PRIMARY_COUNT)
  const [drawerOpen, setDrawerOpen] = useState(false)

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
      <aside className="hidden md:flex flex-col w-[220px] min-w-[220px] bg-[var(--surface)] border-r border-[var(--border)] py-5">
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
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Divider + settings */}
        <div className="px-3 mt-2 mb-2 space-y-0.5">
          <div className="h-px bg-[var(--border)] mx-1 mb-2" />
          <button
            onClick={() => dispatch({ type: 'TOGGLE_DARK' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span>{state.dark ? '☀️' : '🌙'}</span>
            <span>{s.dark_mode}</span>
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_LANG', lang: lang === 'bm' ? 'en' : 'bm' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span>🌐</span>
            <span>{lang === 'bm' ? 'English' : 'Bahasa'}</span>
          </button>
        </div>

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
        {/* Topbar */}
        <header className="h-14 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-5 gap-3 flex-shrink-0">
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--text)]">
              {state.user?.name}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-2 capitalize">{state.user?.role} · {state.user?.branch}</span>
            </div>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <Avatar emoji={state.user?.avatar ?? '👤'} size="sm" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 pb-24 md:pb-5">
          <div className="max-w-[1100px] mx-auto animate-fadeIn">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Bottom Nav (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] flex z-40">
        {primaryItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-brand-600' : 'text-[var(--text-muted)]'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span className="truncate max-w-[52px] text-center leading-tight">{item.label}</span>
          </NavLink>
        ))}

        {/* More button — always visible for settings access */}
        <button
          onClick={() => setDrawerOpen(true)}
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
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] rounded-t-2xl shadow-2xl border-t border-[var(--border)] pb-safe">
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
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                          : 'text-[var(--text-soft)] hover:bg-[var(--surface-2)]'
                      }`
                    }
                  >
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}

            {/* Settings row */}
            <div className={`px-3 pb-3 flex gap-2 ${moreItems.length > 0 ? 'pt-1 border-t border-[var(--border)] mt-1' : 'pt-3'}`}>
              <button
                onClick={() => { dispatch({ type: 'TOGGLE_DARK' }); setDrawerOpen(false) }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-[var(--text-soft)] bg-[var(--surface-2)] hover:bg-[var(--surface-3,#e5e7eb)] transition-colors"
              >
                <span>{state.dark ? '☀️' : '🌙'}</span>
                <span>{s.dark_mode}</span>
              </button>
              <button
                onClick={() => { dispatch({ type: 'SET_LANG', lang: lang === 'bm' ? 'en' : 'bm' }); setDrawerOpen(false) }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-[var(--text-soft)] bg-[var(--surface-2)] hover:bg-[var(--surface-3,#e5e7eb)] transition-colors"
              >
                <span>🌐</span>
                <span>{lang === 'bm' ? 'English' : 'Bahasa'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <span>⏻</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
