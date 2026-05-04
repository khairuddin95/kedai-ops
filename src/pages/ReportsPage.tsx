import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import StarRating from '../components/ui/StarRating'

const MEDALS = ['🥇', '🥈', '🥉']
const DAY_KEYS_BM = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab']
const DAY_KEYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TODAY = new Date()

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function ReportsPage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const subs = state.submissions

  const stats = useMemo(() => {
    const total      = subs.length
    const approved   = subs.filter(s => s.status === 'approved').length
    const todaySubs  = subs.filter(s => isSameDay(new Date(s.submittedAt), TODAY))
    const ratings    = subs.filter(s => s.rating > 0).map(s => s.rating)
    const avgRating  = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0
    const staffSet   = new Set(subs.map(s => s.staffName))
    const compRate   = total ? Math.round((approved / total) * 100) : 0

    // Weekly bar chart — last 7 days
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(TODAY); d.setDate(d.getDate() - (6 - i))
      const dayKeys = lang === 'en' ? DAY_KEYS_EN : DAY_KEYS_BM
      const count = subs.filter(s => isSameDay(new Date(s.submittedAt), d)).length
      return { day: dayKeys[d.getDay()], completed: count, isToday: i === 6 }
    })

    // Branch stats
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

    // Top staff — rank by approved count then avg rating
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

    // AI insight — find most flagged task
    const taskFlagCount = new Map<string, number>()
    for (const sub of subs) {
      if (sub.flag) taskFlagCount.set(sub.taskTitle, (taskFlagCount.get(sub.taskTitle) ?? 0) + 1)
    }
    let insightTask = ''
    let insightCount = 0
    taskFlagCount.forEach((count, title) => { if (count > insightCount) { insightTask = title; insightCount = count } })

    return { total, approved, compRate, todayCount: todaySubs.length, avgRating, staffCount: staffSet.size, weekly, branches, topStaff, insightTask, insightCount }
  }, [subs, lang])

  const kpis = [
    { label: s.completion_rate, value: `${stats.compRate}%`,                      icon: '📈', color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: s.avg_rating,      value: `${stats.avgRating.toFixed(1)} ⭐`,         icon: '⭐', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: s.total_today,     value: String(stats.todayCount),                   icon: '✅', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: s.active_staff,    value: String(stats.staffCount),                   icon: '👥', color: '#8b5cf6', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-[var(--text)]">{s.reports_title}</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`${k.bg} rounded-lg p-4 border border-[var(--border)]`}>
            <div className="text-2xl mb-1">{k.icon}</div>
            <div className="font-mono text-2xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-[var(--text-soft)] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly trend */}
      <Card>
        <h3 className="font-bold text-[var(--text)] mb-4">{s.weekly_trend}</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.weekly} barSize={28} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--ink-500)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--ink-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
              />
              <Bar dataKey="completed" radius={[4,4,0,0]}>
                {stats.weekly.map((entry, i) => (
                  <Cell key={i} fill={entry.isToday ? '#2563eb' : '#93c5fd'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Branch performance */}
        <Card padding="none">
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-bold text-[var(--text)]">{s.branch_performance}</h3>
          </div>
          {stats.branches.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">{s.no_submissions}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {[s.branch, s.completion, s.avg_rate, s.late_tasks, s.status].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs text-[var(--text-muted)] font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.branches.map(b => (
                    <tr key={b.name} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{b.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${b.rate}%` }} />
                          </div>
                          <span className="text-xs text-[var(--text-soft)]">{b.rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StarRating value={Math.round(b.rating)} readonly size="sm" /></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold ${b.late > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{b.late}</span>
                      </td>
                      <td className="px-4 py-3 text-center">{b.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Top performers */}
        <Card>
          <h3 className="font-bold text-[var(--text)] mb-4">{s.top_performers}</h3>
          {stats.topStaff.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">{s.no_submissions}</div>
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

      {/* AI Insight — only shown when there is data to analyse */}
      {stats.insightTask ? (
        <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <span className="text-2xl flex-shrink-0">💡</span>
          <div>
            <div className="font-semibold text-sm text-amber-800 dark:text-amber-400 mb-1">{s.ai_insight}</div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {lang === 'bm'
                ? `Tugasan '${stats.insightTask}' telah diflag ${stats.insightCount}x. Pertimbangkan untuk menyemak atau agih semula kepada staf lain.`
                : `Task '${stats.insightTask}' has been flagged ${stats.insightCount}x. Consider reviewing or reassigning it.`}
            </p>
          </div>
        </div>
      ) : stats.branches.length > 0 ? (
        <div className="flex gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <span className="text-2xl flex-shrink-0">💡</span>
          <div>
            <div className="font-semibold text-sm text-emerald-800 dark:text-emerald-400 mb-1">{s.ai_insight}</div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {lang === 'bm' ? 'Tiada tugasan yang diflag. Prestasi semua cawangan baik!' : 'No flagged tasks. All branches are performing well!'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
