import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { STRINGS, langLocale } from '../utils/i18n'
import Card from '../components/ui/Card'
import { supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'
import type { MaintenanceReport, LoanRequest } from '../types'

function getGreeting(name: string, lang: 'bm' | 'en') {
  const h = new Date().getHours()
  const s = STRINGS[lang]
  const greet = h < 12 ? s.good_morning : h < 18 ? s.good_afternoon : s.good_evening
  return `${greet}, ${name} 👋`
}

function timeAgo(d: Date, lang: 'bm' | 'en'): string {
  const diff = (Date.now() - d.getTime()) / 60000
  if (diff < 1) return lang === 'bm' ? 'baru sahaja' : 'just now'
  if (diff < 60) return `${Math.floor(diff)} ${lang === 'bm' ? 'min lalu' : 'min ago'}`
  if (diff < 1440) return `${Math.floor(diff / 60)} ${lang === 'bm' ? 'jam lalu' : 'hr ago'}`
  return `${Math.floor(diff / 1440)} ${lang === 'bm' ? 'hari lalu' : 'day(s) ago'}`
}

export default function SupervisorHomePage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const lang = state.lang
  const s = STRINGS[lang]
  const role = state.user?.role
  const branch = role === 'supervisor' ? state.user?.branch : undefined

  const [maintenance, setMaintenance] = useState<MaintenanceReport[]>([])
  const [loans, setLoans] = useState<LoanRequest[]>([])
  const [staffTodayCount, setStaffTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return }
    const todayDow = new Date().getDay()
    ;(async () => {
      const [maint, loanData, schedules] = await Promise.all([
        db.fetchMaintenanceReports(branch),
        db.fetchLoanRequests(branch),
        db.fetchSchedules(),
      ])
      setMaintenance(maint ?? [])
      setLoans(loanData ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const todayCount = (schedules as any[]).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) => e.dayOfWeek === todayDow && e.shiftId !== null
      ).length
      setStaffTodayCount(todayCount)
      setLoading(false)
    })()
  }, [branch])

  const today = new Date().toLocaleDateString(langLocale(lang), {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const pendingReviews = state.submissions.filter(sub => sub.status === 'pending').length
  const recentPending = state.submissions.filter(sub => sub.status === 'pending').slice(0, 3)

  const criticalIssues = maintenance.filter(
    r => r.status !== 'resolved' && ['critical', 'high'].includes(r.priority)
  )
  const criticalCount = criticalIssues.length

  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
  const overdueCount = loans.filter(
    l => l.status === 'approved' && l.dueDate && new Date(l.dueDate) < todayMidnight
  ).length

  const quickStats = [
    {
      icon: '⏳', label: s.sup_pending_review, value: pendingReviews,
      to: '/review', color: '#f59e0b',
      bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800',
    },
    {
      icon: '🚨', label: s.sup_critical_issues, value: criticalCount,
      to: '/maintenance', color: '#ef4444',
      bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800',
    },
    {
      icon: '📦', label: s.sup_overdue_loans, value: overdueCount,
      to: '/loans', color: '#8b5cf6',
      bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800',
    },
    {
      icon: '👥', label: s.sup_staff_today, value: staffTodayCount,
      to: '/schedule', color: '#10b981',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800',
    },
  ]

  const quickLinks = [
    { icon: '📊', label: 'Dashboard', to: '/dashboard' },
    { icon: '🔍', label: s.review ?? 'Semakan', to: '/review' },
    { icon: '🔧', label: s.maintenance ?? 'Maintenance', to: '/maintenance' },
    { icon: '📅', label: s.nav_schedule ?? 'Jadual', to: '/schedule' },
  ]

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-xs text-[var(--text-muted)] mb-0.5">{today}</p>
        <h2 className="text-xl font-bold text-[var(--text)]">
          {getGreeting(state.user?.name ?? '', lang)}
        </h2>
        <p className="text-sm text-[var(--text-soft)] mt-0.5">
          {state.user?.branch} · {role === 'owner' ? s.role_owner : s.role_supervisor}
        </p>
      </div>

      {/* Alert banners */}
      {!loading && criticalCount > 0 && (
        <button
          onClick={() => navigate('/maintenance')}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-left active:scale-[0.99] transition-transform"
        >
          <span className="text-2xl flex-shrink-0">🚨</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-red-700 dark:text-red-300">
              {criticalCount} {s.alert_critical_maint}
            </div>
            {criticalIssues[0] && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">
                {criticalIssues[0].title}
                {criticalCount > 1 ? ` +${criticalCount - 1}` : ''}
              </div>
            )}
          </div>
          <span className="text-red-400 flex-shrink-0 text-lg">›</span>
        </button>
      )}

      {!loading && overdueCount > 0 && (
        <button
          onClick={() => navigate('/loans')}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-left active:scale-[0.99] transition-transform"
        >
          <span className="text-2xl flex-shrink-0">⏰</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-amber-700 dark:text-amber-300">
              {overdueCount} {s.alert_overdue_loan}
            </div>
          </div>
          <span className="text-amber-400 flex-shrink-0 text-lg">›</span>
        </button>
      )}

      {/* Quick stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {quickStats.map(stat => (
          <button
            key={stat.to}
            onClick={() => navigate(stat.to)}
            className={`${stat.bg} ${stat.border} border rounded-xl p-4 text-left active:scale-95 transition-transform`}
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="font-mono text-3xl font-extrabold leading-none" style={{ color: stat.color }}>
              {loading ? '—' : stat.value}
            </div>
            <div className="text-xs text-[var(--text-soft)] mt-1.5 leading-tight">{stat.label}</div>
          </button>
        ))}
      </div>

      {/* Recent pending submissions */}
      <Card padding="none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-bold text-sm text-[var(--text)]">{s.sup_recent_subs}</h3>
          {pendingReviews > 0 && (
            <button onClick={() => navigate('/review')} className="text-xs text-brand-600 hover:underline">
              {s.sup_view_all} ({pendingReviews})
            </button>
          )}
        </div>

        {recentPending.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm text-[var(--text-muted)]">{s.sup_no_pending}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {recentPending.map(sub => (
              <button
                key={sub.id}
                onClick={() => navigate('/review')}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--surface-2)] transition-colors text-left active:scale-[0.99]"
              >
                <div className="w-11 h-11 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-2xl flex-shrink-0">
                  {sub.staffAvatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[var(--text)] truncate">{sub.staffName}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{sub.taskTitle}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-amber-500 font-semibold">⏳ {lang === 'bm' ? 'Menunggu' : 'Pending'}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {timeAgo(new Date(sub.submittedAt), lang)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Quick navigate */}
      <div>
        <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.sup_quick_access}</h3>
        <div className="grid grid-cols-2 gap-2">
          {quickLinks.map(item => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className="flex items-center gap-2.5 px-3 py-3.5 bg-[var(--surface-2)] rounded-xl text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-3,#f0f0f0)] active:scale-95 transition-all border border-[var(--border)]"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
