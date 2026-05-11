import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { STRINGS, langLocale } from '../utils/i18n'
import { supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import StarRating from '../components/ui/StarRating'
import type { Lang, MaintenanceCategory, MaintenancePriority, User } from '../types'

// ─── Shared helpers ───────────────────────────────────────────
const TODAY = new Date()
const MEDALS = ['🥇', '🥈', '🥉']
const DAY_KEYS_BM = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab']
const DAY_KEYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function isSameMonth(d: Date) {
  return d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear()
}
function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}
function inRange(d: Date | string, range: DateRange): boolean {
  const t = (d instanceof Date ? d : new Date(d)).getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}
function toDateInput(d: Date) {
  // YYYY-MM-DD in local time
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
function fromDateInput(s: string): Date {
  // Parse YYYY-MM-DD as a local-midnight Date (avoids UTC shift)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function fmtRange(r: DateRange, lang: Lang) {
  const sameDay = isSameDay(r.start, r.end)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const locale = langLocale(lang)
  if (sameDay) return r.start.toLocaleDateString(locale, { ...opts, year: 'numeric' })
  return `${r.start.toLocaleDateString(locale, opts)} – ${r.end.toLocaleDateString(locale, opts)}`
}

// ─── Date range ───────────────────────────────────────────────
type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom'
interface DateRange {
  preset: RangePreset
  start: Date  // local 00:00:00
  end: Date    // local 23:59:59
}

function buildRange(preset: RangePreset, custom?: { start: Date; end: Date }): DateRange {
  if (preset === 'custom' && custom) {
    return { preset, start: startOfDay(custom.start), end: endOfDay(custom.end) }
  }
  const days = preset === 'today' ? 1 : preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  const end = endOfDay(new Date())
  const start = startOfDay(new Date())
  start.setDate(start.getDate() - (days - 1))
  return { preset, start, end }
}

function rangeDays(r: DateRange): number {
  return Math.max(1, Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000) + 1)
}

// ─── DateRangePicker component ────────────────────────────────
function DateRangePicker({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const { state } = useApp()
  const s = STRINGS[state.lang]
  const [showCustom, setShowCustom] = useState(range.preset === 'custom')
  const [customStart, setCustomStart] = useState(toDateInput(range.start))
  const [customEnd, setCustomEnd]     = useState(toDateInput(range.end))

  const presets: { key: RangePreset; label: string }[] = [
    { key: 'today', label: s.range_today },
    { key: '7d',    label: s.range_7d },
    { key: '30d',   label: s.range_30d },
    { key: '90d',   label: s.range_90d },
    { key: 'custom', label: `📅 ${s.range_custom}` },
  ]

  const pickPreset = (p: RangePreset) => {
    if (p === 'custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    onChange(buildRange(p))
  }

  const applyCustom = () => {
    if (!customStart || !customEnd) return
    const start = fromDateInput(customStart)
    const end   = fromDateInput(customEnd)
    if (end < start) return
    onChange(buildRange('custom', { start, end }))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl overflow-x-auto scrollbar-hide">
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => pickPreset(p.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              range.preset === p.key
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2 p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-0.5">{s.range_from}</label>
            <input
              type="date"
              value={customStart}
              max={customEnd || toDateInput(new Date())}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-0.5">{s.range_to}</label>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={toDateInput(new Date())}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-brand-400"
            />
          </div>
          <button
            onClick={applyCustom}
            disabled={!customStart || !customEnd || fromDateInput(customEnd) < fromDateInput(customStart)}
            className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
          >
            {s.range_apply}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Maintenance constants ────────────────────────────────────
const CAT_ICON: Record<MaintenanceCategory, string> = {
  equipment: '🔧', facility: '🏗️', electrical: '⚡', plumbing: '🚿', other: '📝',
}
const PRIORITY_COLOR: Record<MaintenancePriority, string> = {
  low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}
const STATUS_COLOR = { open: '#3b82f6', in_progress: '#f59e0b', resolved: '#10b981' }

// Build day-by-day buckets across a range. Caps at 90 buckets to avoid
// rendering hundreds of bars; for longer ranges, groups by week.
function bucketByDay(range: DateRange, lang: Lang) {
  const days = rangeDays(range)
  const dayKeys = lang === 'en' ? DAY_KEYS_EN : DAY_KEYS_BM
  const locale = langLocale(lang)

  if (days <= 60) {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(range.start); d.setDate(d.getDate() + i)
      return {
        date: d,
        // Single-day shows weekday; longer ranges use day/month
        label: days <= 7 ? dayKeys[d.getDay()] : d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
        isToday: isSameDay(d, TODAY),
      }
    })
  }
  // Week buckets (start of week = range.start + 7n)
  const weeks = Math.ceil(days / 7)
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(range.start); start.setDate(start.getDate() + i * 7)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    return {
      date: start,
      endDate: end,
      label: start.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
      isToday: TODAY >= start && TODAY <= end,
    }
  })
}

// ─── Tab: Task Reports ────────────────────────────────────────
function TaskTab({ range }: { range: DateRange }) {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const allSubs = state.submissions
  const taskGroups = state.taskGroups
  const role = state.user?.role
  const [allUsers, setAllUsers] = useState<User[]>([])

  useEffect(() => {
    if (!supabaseConfigured) return
    db.fetchUsers().then(u => { if (u) setAllUsers(u) })
  }, [])

  const stats = useMemo(() => {
    const subs = allSubs.filter(sub => inRange(new Date(sub.submittedAt), range))
    const total     = subs.length
    const approved  = subs.filter(sub => sub.status === 'approved').length
    const ratings   = subs.filter(sub => sub.rating > 0).map(sub => sub.rating)
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0
    const staffSet  = new Set(subs.map(sub => sub.staffName))
    const compRate  = total ? Math.round((approved / total) * 100) : 0

    const buckets = bucketByDay(range, lang)
    const trend = buckets.map(bk => {
      const bkEnd = (bk as { endDate?: Date }).endDate ?? bk.date
      const start = startOfDay(bk.date).getTime()
      const end = endOfDay(bkEnd).getTime()
      const count = subs.filter(sub => {
        const t = new Date(sub.submittedAt).getTime()
        return t >= start && t <= end
      }).length
      return { day: bk.label, completed: count, isToday: bk.isToday }
    })

    const branchMap = new Map<string, { count: number; approved: number; ratings: number[]; flags: number }>()
    for (const sub of subs) {
      if (!sub.branch) continue
      const b = branchMap.get(sub.branch) ?? { count: 0, approved: 0, ratings: [], flags: 0 }
      b.count++
      if (sub.status === 'approved') b.approved++
      if (sub.rating > 0) b.ratings.push(sub.rating)
      if (sub.flag) b.flags++
      branchMap.set(sub.branch, b)
    }
    const branches = Array.from(branchMap.entries()).map(([name, b]) => ({
      name,
      rate: b.count ? Math.round((b.approved / b.count) * 100) : 0,
      rating: b.ratings.length ? parseFloat((b.ratings.reduce((a, c) => a + c, 0) / b.ratings.length).toFixed(1)) : 0,
      late: b.flags,
      status: b.flags === 0 ? '✅' : '⚠️',
    })).sort((a, b) => b.rate - a.rate)

    const staffMap = new Map<string, { avatar: string; count: number; approved: number; ratings: number[] }>()
    for (const sub of subs) {
      const st = staffMap.get(sub.staffName) ?? { avatar: sub.staffAvatar, count: 0, approved: 0, ratings: [] }
      st.count++
      if (sub.status === 'approved') st.approved++
      if (sub.rating > 0) st.ratings.push(sub.rating)
      staffMap.set(sub.staffName, st)
    }
    const topStaff = Array.from(staffMap.entries())
      .map(([name, st]) => ({
        name, avatar: st.avatar,
        score: st.count ? Math.round((st.approved / st.count) * 100) : 0,
        streak: st.approved,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const taskFlagCount = new Map<string, number>()
    for (const sub of subs) {
      if (sub.flag) taskFlagCount.set(sub.taskTitle, (taskFlagCount.get(sub.taskTitle) ?? 0) + 1)
    }
    let insightTask = ''; let insightCount = 0
    taskFlagCount.forEach((count, title) => { if (count > insightCount) { insightTask = title; insightCount = count } })

    return { total, approved, compRate, avgRating, staffCount: staffSet.size, trend, branches, topStaff, insightTask, insightCount }
  }, [allSubs, lang, range])

  const inactiveStaff = useMemo(() => {
    const todayNames = new Set(
      allSubs.filter(sub => isSameDay(new Date(sub.submittedAt), TODAY)).map(sub => sub.staffName)
    )
    const branch = role === 'supervisor' ? state.user?.branch : undefined
    return allUsers.filter(u => u.role === 'staff' && !todayNames.has(u.name) && (!branch || u.branch === branch))
  }, [allUsers, allSubs, role, state.user?.branch])

  if (!state.dbReady) {
    return <div className="text-center py-20 text-[var(--text-muted)] text-sm">{s.loading}</div>
  }

  const pendingReview = allSubs.filter(sub => sub.status === 'pending').length

  const kpis = [
    { label: s.completion_rate, value: `${stats.compRate}%`,              icon: '📈', color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: s.avg_rating,      value: `${stats.avgRating.toFixed(1)} ⭐`, icon: '⭐', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: s.total_in_range,  value: String(stats.total),                icon: '✅', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: s.active_staff,    value: String(stats.staffCount),           icon: '👥', color: '#8b5cf6', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  ]

  const kitchenGroups = taskGroups.filter(g => g.department === 'kitchen').length
  const serviceGroups = taskGroups.filter(g => g.department === 'service').length
  const allGroups     = taskGroups.filter(g => g.department === 'all' || !g.department).length

  return (
    <div className="space-y-5">
      {(kitchenGroups > 0 || serviceGroups > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '🍳', label: 'Kitchen', value: kitchenGroups, bg: 'bg-orange-50 dark:bg-orange-900/20', color: 'text-orange-600' },
            { icon: '🛎️', label: 'Service', value: serviceGroups, bg: 'bg-sky-50 dark:bg-sky-900/20',    color: 'text-sky-600' },
            { icon: '🌐', label: s.all, value: allGroups, bg: 'bg-[var(--surface-2)]', color: 'text-[var(--text)]' },
          ].map(d => (
            <div key={d.label} className={`${d.bg} rounded-xl p-2.5 border border-[var(--border)] text-center`}>
              <div className="text-xl mb-1">{d.icon}</div>
              <div className={`font-mono text-2xl font-extrabold ${d.color}`}>{d.value}</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{d.label} {s.dash_groups}</div>
            </div>
          ))}
        </div>
      )}

      {pendingReview > 0 && (
        <Link
          to="/review"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {pendingReview} {s.pending} {s.review_title.toLowerCase()}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400">{s.select_submission}</div>
            </div>
          </div>
          <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{pendingReview}</span>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`${k.bg} rounded-lg p-3 sm:p-4 border border-[var(--border)]`}>
            <div className="text-xl mb-1">{k.icon}</div>
            <div className="font-mono text-2xl sm:text-3xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] sm:text-xs text-[var(--text-soft)] mt-0.5 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <h3 className="font-bold text-[var(--text)] mb-4">{s.daily_trend}</h3>
        {stats.total === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-[var(--text-muted)]">{s.no_data_range}</div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trend} barSize={Math.max(6, Math.min(28, Math.floor(280 / stats.trend.length)))} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--ink-500)' }} axisLine={false} tickLine={false} interval={stats.trend.length > 14 ? Math.floor(stats.trend.length / 7) : 0} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--ink-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                  {stats.trend.map((e, i) => <Cell key={i} fill={e.isToday ? '#2563eb' : '#93c5fd'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card padding="none">
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-bold text-[var(--text)]">{s.branch_performance}</h3>
          </div>
          {stats.branches.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">{s.no_data_range}</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {stats.branches.map(b => (
                <div key={b.name} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[var(--text)] truncate">{b.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${b.rate >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                      {b.rate}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: s.avg_rate, value: <StarRating value={Math.round(b.rating)} readonly size="sm" /> },
                      { label: s.late_tasks, value: <span className={`font-bold text-base ${b.late > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{b.late}</span> },
                      { label: s.status, value: <span>{b.status}</span> },
                    ].map((stat, i) => (
                      <div key={i} className="bg-[var(--surface-2)] rounded-lg px-2 py-1.5 text-center flex flex-col items-center justify-center gap-0.5">
                        {stat.value}
                        <div className="text-[9px] text-[var(--text-muted)] leading-tight">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-bold text-[var(--text)] mb-4">{s.top_performers}</h3>
          {stats.topStaff.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">{s.no_data_range}</div>
          ) : (
            <div className="space-y-3">
              {stats.topStaff.map((staff, i) => (
                <div key={staff.name} className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                  <span className="text-2xl">{MEDALS[i] ?? '🏅'}</span>
                  <Avatar emoji={staff.avatar} size="md" name={staff.name} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[var(--text)]">{staff.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">✅ {staff.streak} {s.approved}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-brand-600">{staff.score}%</div>
                    <div className="text-xs text-[var(--text-muted)]">{s.score_label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {stats.insightTask ? (
        <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <span className="text-2xl flex-shrink-0">💡</span>
          <div>
            <div className="font-semibold text-sm text-amber-800 dark:text-amber-400 mb-1">{s.ai_insight}</div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {`${s.dash_flagged_prefix} '${stats.insightTask}' ${s.dash_flagged_suffix} ${stats.insightCount}x ${s.dash_flagged_times}`}
            </p>
          </div>
        </div>
      ) : stats.branches.length > 0 ? (
        <div className="flex gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <span className="text-2xl flex-shrink-0">💡</span>
          <div>
            <div className="font-semibold text-sm text-emerald-800 dark:text-emerald-400 mb-1">{s.ai_insight}</div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {s.dash_no_flags}
            </p>
          </div>
        </div>
      ) : null}

      {/* Branch Comparison — owner only */}
      {role === 'owner' && stats.branches.length > 1 && (
        <Card>
          <h3 className="font-bold text-[var(--text)] mb-4">{s.dash_branch_comparison}</h3>
          <div className="space-y-3">
            {stats.branches.map(b => (
              <div key={b.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--text)] truncate flex-1 mr-2">{b.name}</span>
                  <span className={`text-xs font-bold flex-shrink-0 ${b.rate >= 80 ? 'text-emerald-600' : b.rate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                    {b.rate}%
                  </span>
                </div>
                <div className="w-full bg-[var(--surface-2)] rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${b.rate >= 80 ? 'bg-emerald-500' : b.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${b.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Inactive Staff Today */}
      <Card padding="none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-bold text-sm text-[var(--text)]">{s.dash_inactive_staff}</h3>
          {inactiveStaff.length > 0 && <Badge variant="warning">{inactiveStaff.length}</Badge>}
        </div>
        {inactiveStaff.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-sm text-[var(--text-muted)]">{s.dash_no_inactive}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {inactiveStaff.map(u => (
              <div key={u.id} className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-full pl-1 pr-3 py-1">
                <span className="text-base">{u.avatar}</span>
                <span className="text-xs font-medium text-[var(--text)]">{u.name.split(' ')[0]}</span>
                {role === 'owner' && (
                  <span className="text-[10px] text-[var(--text-muted)]">· {u.branch}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Tab: Maintenance ─────────────────────────────────────────
function MaintenanceTab({ range }: { range: DateRange }) {
  const { state } = useApp()
  const s = STRINGS[state.lang]
  const navigate = useNavigate()
  const reports = state.maintenanceReports

  const stats = useMemo(() => {
    const inRangeReports = reports.filter(r => inRange(r.reportedAt, range))
    const total      = inRangeReports.length
    const open       = inRangeReports.filter(r => r.status === 'open')
    const inProgress = inRangeReports.filter(r => r.status === 'in_progress')
    const resolved   = inRangeReports.filter(r => r.status === 'resolved')
    const urgent     = inRangeReports.filter(r => (r.priority === 'critical' || r.priority === 'high') && r.status !== 'resolved')
    const resolvedMonth = resolved.filter(r => r.resolvedAt && isSameMonth(r.resolvedAt))
    const resTimes   = resolved.filter(r => r.resolvedAt).map(r => daysBetween(r.reportedAt, r.resolvedAt!))
    const avgResolve = resTimes.length ? (resTimes.reduce((a, b) => a + b, 0) / resTimes.length).toFixed(1) : null

    const statusData = [
      { name: s.status_open,        value: open.length,       fill: STATUS_COLOR.open },
      { name: s.status_in_progress, value: inProgress.length, fill: STATUS_COLOR.in_progress },
      { name: s.status_resolved,    value: resolved.length,   fill: STATUS_COLOR.resolved },
    ].filter(d => d.value > 0)

    const catKeys: MaintenanceCategory[] = ['equipment', 'facility', 'electrical', 'plumbing', 'other']
    const catLabels: Record<MaintenanceCategory, string> = {
      equipment: s.cat_equipment, facility: s.cat_facility,
      electrical: s.cat_electrical, plumbing: s.cat_plumbing, other: s.cat_other,
    }
    const categoryData = catKeys.map(k => ({
      name: `${CAT_ICON[k]} ${catLabels[k]}`,
      open: inRangeReports.filter(r => r.category === k && r.status !== 'resolved').length,
      resolved: inRangeReports.filter(r => r.category === k && r.status === 'resolved').length,
    })).filter(d => d.open + d.resolved > 0)

    const priorityKeys: MaintenancePriority[] = ['critical', 'high', 'medium', 'low']
    const priorityLabels: Record<MaintenancePriority, string> = {
      critical: s.priority_critical, high: s.priority_high,
      medium: s.priority_medium, low: s.priority_low,
    }
    const priorityData = priorityKeys.map(k => ({
      name: priorityLabels[k],
      value: inRangeReports.filter(r => r.priority === k).length,
      fill: PRIORITY_COLOR[k],
    })).filter(d => d.value > 0)

    const branchMap = new Map<string, { open: number; inProgress: number; resolved: number; critical: number }>()
    for (const r of inRangeReports) {
      const b = branchMap.get(r.branch) ?? { open: 0, inProgress: 0, resolved: 0, critical: 0 }
      if (r.status === 'open')        b.open++
      if (r.status === 'in_progress') b.inProgress++
      if (r.status === 'resolved')    b.resolved++
      if (r.priority === 'critical' && r.status !== 'resolved') b.critical++
      branchMap.set(r.branch, b)
    }
    const branches = Array.from(branchMap.entries())
      .map(([name, b]) => ({ name, ...b }))
      .sort((a, b) => (b.critical - a.critical) || (b.open - a.open))

    const buckets = bucketByDay(range, state.lang)
    const trend = buckets.map(bk => {
      const bkEnd = (bk as { endDate?: Date }).endDate ?? bk.date
      const start = startOfDay(bk.date).getTime()
      const end = endOfDay(bkEnd).getTime()
      const count = inRangeReports.filter(r => {
        const t = r.reportedAt.getTime()
        return t >= start && t <= end
      }).length
      return { day: bk.label, count, isToday: bk.isToday }
    })

    const urgentList = urgent
      .sort((a, b) => a.reportedAt.getTime() - b.reportedAt.getTime())
      .slice(0, 8)

    return { total, urgentCount: urgent.length, inProgressCount: inProgress.length, resolvedMonthCount: resolvedMonth.length, avgResolve, statusData, categoryData, priorityData, branches, trend, urgentList }
  }, [reports, state.lang, s, range, state.dbReady])

  if (!state.dbReady) {
    return <div className="text-center py-20 text-[var(--text-muted)] text-sm">{s.loading}</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-[var(--text-muted)]">{stats.total} {s.dash_reports} {s.in_range}</p>
        <button onClick={() => navigate('/maintenance')} className="text-sm text-brand-600 hover:underline">
          → {s.maintenance_report}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: s.maint_dash_total,         value: stats.total,              icon: '🔧', color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: s.maint_dash_urgent,         value: stats.urgentCount,        icon: '🚨', color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: s.maint_dash_inprog,         value: stats.inProgressCount,    icon: '🔄', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: s.maint_dash_resolved_month, value: stats.resolvedMonthCount, icon: '✅', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-3 sm:p-4 border border-[var(--border)]`}>
            <div className="text-xl sm:text-2xl mb-1">{k.icon}</div>
            <div className="font-mono text-2xl sm:text-3xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] sm:text-xs text-[var(--text-soft)] mt-0.5 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {stats.avgResolve !== null && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-full text-sm text-[var(--text-soft)]">
          ⏱ {s.maint_dash_avg_resolve}: <span className="font-bold text-[var(--text)]">{stats.avgResolve} {s.maint_dash_days}</span>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.daily_trend}</h3>
          {stats.total === 0 ? (
            <div className="h-36 flex items-center justify-center text-sm text-[var(--text-muted)]">{s.no_data_range}</div>
          ) : (
            <div className="h-36 sm:h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.trend} barSize={Math.max(6, Math.min(20, Math.floor(280 / stats.trend.length)))} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--ink-500)' }} axisLine={false} tickLine={false} interval={stats.trend.length > 14 ? Math.floor(stats.trend.length / 7) : 0} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--ink-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(59,130,246,0.07)' }} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {stats.trend.map((e, i) => <Cell key={i} fill={e.isToday ? '#2563eb' : '#93c5fd'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.maint_priority}</h3>
          {stats.priorityData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-sm text-[var(--text-muted)]">{s.no_data_range}</div>
          ) : (
            <div className="flex items-center gap-3 md:flex-col md:items-stretch">
              <div className="h-24 w-24 flex-shrink-0 md:h-28 md:w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.priorityData} cx="50%" cy="50%" innerRadius={22} outerRadius={40} dataKey="value" paddingAngle={2}>
                      {stats.priorityData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 flex-1 justify-center">
                {stats.priorityData.map(p => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
                      <span className="text-[var(--text-soft)]">{p.name}</span>
                    </div>
                    <span className="font-semibold text-[var(--text)]">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.maint_dash_by_category}</h3>
          {stats.categoryData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-sm text-[var(--text-muted)]">{s.no_data_range}</div>
          ) : (
            <div className="h-40 sm:h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.categoryData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={64} tick={{ fontSize: 10, fill: 'var(--ink-500)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(59,130,246,0.07)' }} />
                  <Bar dataKey="open" name={s.status_open} fill="#93c5fd" radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="resolved" name={s.status_resolved} fill="#6ee7b7" radius={[0, 3, 3, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.maint_dash_by_status}</h3>
          {stats.statusData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-[var(--text-muted)]">{s.no_data_range}</div>
          ) : (
            <>
              <div className="h-28 sm:h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.statusData} barSize={32} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--ink-500)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--ink-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(59,130,246,0.07)' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {stats.statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-around mt-2">
                {stats.statusData.map(d => (
                  <div key={d.name} className="text-center">
                    <div className="font-mono font-bold text-base sm:text-lg" style={{ color: d.fill }}>{d.value}</div>
                    <div className="text-[10px] sm:text-xs text-[var(--text-muted)] leading-tight">{d.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card padding="none">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="font-bold text-sm text-[var(--text)]">{s.maint_dash_by_branch}</h3>
          </div>
          {stats.branches.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">{s.no_data_range}</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {stats.branches.map(b => (
                <div key={b.name} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[var(--text)] truncate">{b.name}</span>
                    {b.critical > 0 && (
                      <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">🚨 {b.critical}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: s.status_open,        value: b.open,       color: b.open > 0 ? 'text-blue-500' : 'text-[var(--text-muted)]' },
                      { label: s.status_in_progress, value: b.inProgress, color: b.inProgress > 0 ? 'text-amber-500' : 'text-[var(--text-muted)]' },
                      { label: s.status_resolved,    value: b.resolved,   color: 'text-emerald-500' },
                    ].map(stat => (
                      <div key={stat.label} className="bg-[var(--surface-2)] rounded-lg px-2 py-1.5 text-center">
                        <div className={`font-bold text-base ${stat.color}`}>{stat.value}</div>
                        <div className="text-[9px] text-[var(--text-muted)] leading-tight truncate">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="none">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--text)]">{s.maint_dash_urgent_list}</h3>
            {stats.urgentCount > 0 && <Badge variant="danger">{stats.urgentCount}</Badge>}
          </div>
          {stats.urgentList.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm text-[var(--text-muted)]">{s.maint_dash_no_urgent}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {stats.urgentList.map(r => {
                const daysOpen = daysBetween(r.reportedAt, TODAY)
                return (
                  <button
                    key={r.id}
                    onClick={() => navigate('/maintenance')}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <span className="text-lg mt-0.5 flex-shrink-0">{CAT_ICON[r.category]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-[var(--text-muted)]">📍 {r.branch}</span>
                        <span className={`text-xs font-semibold ${daysOpen >= 7 ? 'text-red-500' : 'text-amber-500'}`}>
                          {daysOpen} {s.maint_dash_days_open}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOR[r.priority] + '20', color: PRIORITY_COLOR[r.priority] }}>
                      {r.priority === 'critical' ? s.priority_critical : s.priority_high}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ─── Main Dashboard Page ──────────────────────────────────────
type Tab = 'tasks' | 'maintenance'

export default function DashboardPage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const [tab, setTab] = useState<Tab>('tasks')
  const [range, setRange] = useState<DateRange>(() => buildRange('7d'))

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'tasks',       label: s.dash_tab_tasks,       icon: '📊' },
    { id: 'maintenance', label: s.dash_tab_maintenance, icon: '🔧' },
  ]

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">📊 Dashboard</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {state.user?.branch} · <span className="text-brand-600 font-medium">{fmtRange(range, lang)}</span>
          </p>
        </div>
      </div>

      {/* Date range picker */}
      <DateRangePicker range={range} onChange={setRange} />

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'tasks'       && <TaskTab range={range} />}
      {tab === 'maintenance' && <MaintenanceTab range={range} />}
    </div>
  )
}
