import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { STRINGS } from '../../utils/i18n'
import Avatar from '../ui/Avatar'

function navItems(role: string, lang: 'bm' | 'en') {
  const s = STRINGS[lang as 'bm' | 'en']
  if (role === 'staff') return [
    { to: '/',             icon: '🏠', label: s.home },
    { to: '/tasks',        icon: '📋', label: s.tasks },
    { to: '/maintenance',  icon: '🔧', label: s.maintenance },
    { to: '/loans',        icon: '📦', label: s.loan_item },
    { to: '/history',      icon: '📜', label: s.history },
  ]
  if (role === 'supervisor') return [
    { to: '/review',            icon: '🔍', label: s.review },
    { to: '/reports',           icon: '📊', label: s.reports },
    { to: '/maintenance-dash',  icon: '📉', label: s.maint_dashboard },
    { to: '/maintenance',       icon: '🔧', label: s.maintenance },
    { to: '/loans',             icon: '📦', label: s.loan_item },
    { to: '/tasks-admin',       icon: '📋', label: s.task_mgmt },
    { to: '/assets',            icon: '🗄️',  label: s.asset_mgmt },
    { to: '/staff',             icon: '👥', label: s.staff },
    { to: '/history',           icon: '📜', label: s.history },
  ]
  // owner
  return [
    { to: '/reports',           icon: '📊', label: s.reports },
    { to: '/review',            icon: '🔍', label: s.review },
    { to: '/maintenance-dash',  icon: '📉', label: s.maint_dashboard },
    { to: '/maintenance',       icon: '🔧', label: s.maintenance },
    { to: '/loans',             icon: '📦', label: s.loan_item },
    { to: '/tasks-admin',       icon: '📋', label: s.task_mgmt },
    { to: '/assets',            icon: '🗄️',  label: s.asset_mgmt },
    { to: '/branches',          icon: '🏪', label: s.branch_setup },
    { to: '/staff',             icon: '👥', label: s.staff },
    { to: '/history',           icon: '📜', label: s.history },
  ]
}

export default function AppShell() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const lang = state.lang
  const s = STRINGS[lang]
  const role = state.user?.role ?? 'staff'
  const items = navItems(role, lang)

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' })
    navigate('/login')
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
        <nav className="flex-1 px-3 space-y-0.5">
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
          {/* Mobile: show user */}
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
        {items.map(item => (
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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
