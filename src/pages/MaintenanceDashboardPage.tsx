import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import { supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import type { MaintenanceCategory, MaintenancePriority, MaintenanceReport } from '../types'

const CAT_ICON: Record<MaintenanceCategory, string> = {
  equipment: '🔧', facility: '🏗️', electrical: '⚡', plumbing: '🚿', other: '📝',
}

const PRIORITY_COLOR: Record<MaintenancePriority, string> = {
  low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}

const STATUS_COLOR = { open: '#3b82f6', in_progress: '#f59e0b', resolved: '#10b981' }

const TODAY = new Date()

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

function isSameMonth(d: Date) {
  return d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear()
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function MaintenanceDashboardPage() {
  const { state } = useApp()
  const s = STRINGS[state.lang]
  const navigate = useNavigate()

  const [reports, setReports] = useState<MaintenanceReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const data = supabaseConfigured ? await db.fetchMaintenanceReports() : []
      setReports(data ?? [])
      setLoading(false)
    })()
  }, [])

  const stats = useMemo(() => {
    const total       = reports.length
    const open        = reports.filter(r => r.status === 'open')
    const inProgress  = reports.filter(r => r.status === 'in_progress')
    const resolved    = reports.filter(r => r.status === 'resolved')
    const urgent      = reports.filter(r => (r.priority === 'critical' || r.priority === 'high') && r.status !== 'resolved')
    const resolvedMonth = resolved.filter(r => r.resolvedAt && isSameMonth(r.resolvedAt))

    // Avg resolution time (days) for resolved reports that have resolvedAt
    const resTimes = resolved
      .filter(r => r.resolvedAt)
      .map(r => daysBetween(r.reportedAt, r.resolvedAt!))
    const avgResolve = resTimes.length ? (resTimes.reduce((a, b) => a + b, 0) / resTimes.length).toFixed(1) : null

    // Status chart
    const statusData = [
      { name: s.status_open,        value: open.length,       fill: STATUS_COLOR.open },
      { name: s.status_in_progress, value: inProgress.length, fill: STATUS_COLOR.in_progress },
      { name: s.status_resolved,    value: resolved.length,   fill: STATUS_COLOR.resolved },
    ].filter(d => d.value > 0)

    // Category chart
    const catKeys: MaintenanceCategory[] = ['equipment', 'facility', 'electrical', 'plumbing', 'other']
    const catLabels: Record<MaintenanceCategory, string> = {
      equipment: s.cat_equipment, facility: s.cat_facility,
      electrical: s.cat_electrical, plumbing: s.cat_plumbing, other: s.cat_other,
    }
    const categoryData = catKeys.map(k => ({
      name: `${CAT_ICON[k]} ${catLabels[k]}`,
      open: reports.filter(r => r.category === k && r.status !== 'resolved').length,
      resolved: reports.filter(r => r.category === k && r.status === 'resolved').length,
    })).filter(d => d.open + d.resolved > 0)

    // Priority donut
    const priorityKeys: MaintenancePriority[] = ['critical', 'high', 'medium', 'low']
    const priorityLabels: Record<MaintenancePriority, string> = {
      critical: s.priority_critical, high: s.priority_high,
      medium: s.priority_medium, low: s.priority_low,
    }
    const priorityData = priorityKeys.map(k => ({
      name: priorityLabels[k],
      value: reports.filter(r => r.priority === k).length,
      fill: PRIORITY_COLOR[k],
    })).filter(d => d.value > 0)

    // Branch table
    const branchMap = new Map<string, { open: number; inProgress: number; resolved: number; critical: number }>()
    for (const r of reports) {
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

    // 14-day trend
    const DAY_KEYS_BM = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab']
    const DAY_KEYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dayKeys = state.lang === 'bm' ? DAY_KEYS_BM : DAY_KEYS_EN
    const trend = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(TODAY); d.setDate(d.getDate() - (13 - i))
      const count = reports.filter(r => isSameDay(r.reportedAt, d)).length
      return { day: dayKeys[d.getDay()], count, isToday: i === 13 }
    })

    // Urgent list: open or in-progress, priority critical/high, sorted oldest first
    const urgentList = urgent
      .sort((a, b) => a.reportedAt.getTime() - b.reportedAt.getTime())
      .slice(0, 8)

    return { total, urgentCount: urgent.length, inProgressCount: inProgress.length, resolvedMonthCount: resolvedMonth.length, avgResolve, statusData, categoryData, priorityData, branches, trend, urgentList }
  }, [reports, state.lang, s])

  if (loading) {
    return <div className="text-center py-20 text-[var(--text-muted)] text-sm">{s.loading}</div>
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">{s.maint_dashboard}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{stats.total} laporan keseluruhan</p>
        </div>
        <button
          onClick={() => navigate('/maintenance')}
          className="text-sm text-brand-600 hover:underline"
        >
          → {s.maintenance_report}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: s.maint_dash_total,           value: stats.total,                icon: '🔧', color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: s.maint_dash_urgent,           value: stats.urgentCount,          icon: '🚨', color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: s.maint_dash_inprog,           value: stats.inProgressCount,      icon: '🔄', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: s.maint_dash_resolved_month,   value: stats.resolvedMonthCount,   icon: '✅', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-[var(--border)]`}>
            <div className="text-2xl mb-1">{k.icon}</div>
            <div className="font-mono text-3xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-[var(--text-soft)] mt-0.5 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Avg resolution time pill */}
      {stats.avgResolve !== null && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-full text-sm text-[var(--text-soft)]">
          ⏱ {s.maint_dash_avg_resolve}: <span className="font-bold text-[var(--text)]">{stats.avgResolve} {s.maint_dash_days}</span>
        </div>
      )}

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* 14-day trend */}
        <Card className="md:col-span-2">
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.maint_dash_trend}</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trend} barSize={14} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--ink-500)' }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--ink-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'rgba(59,130,246,0.07)' }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {stats.trend.map((e, i) => (
                    <Cell key={i} fill={e.isToday ? '#2563eb' : '#93c5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Priority donut */}
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.maint_priority}</h3>
          {stats.priorityData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-[var(--text-muted)]">{s.no_maintenance}</div>
          ) : (
            <>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.priorityData} cx="50%" cy="50%" innerRadius={28} outerRadius={52}
                      dataKey="value" paddingAngle={2}>
                      {stats.priorityData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                {stats.priorityData.map(p => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.fill }} />
                      <span className="text-[var(--text-soft)]">{p.name}</span>
                    </div>
                    <span className="font-semibold text-[var(--text)]">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Category + Status charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Category chart */}
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.maint_dash_by_category}</h3>
          {stats.categoryData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-sm text-[var(--text-muted)]">{s.no_maintenance}</div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.categoryData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'var(--ink-500)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: 'rgba(59,130,246,0.07)' }}
                  />
                  <Bar dataKey="open" name={s.status_open} fill="#93c5fd" radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="resolved" name={s.status_resolved} fill="#6ee7b7" radius={[0, 3, 3, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Status chart */}
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.maint_dash_by_status}</h3>
          {stats.statusData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-[var(--text-muted)]">{s.no_maintenance}</div>
          ) : (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.statusData} barSize={40} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink-500)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--ink-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: 'rgba(59,130,246,0.07)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {stats.statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-around mt-1">
                {stats.statusData.map(d => (
                  <div key={d.name} className="text-center">
                    <div className="font-mono font-bold text-lg" style={{ color: d.fill }}>{d.value}</div>
                    <div className="text-xs text-[var(--text-muted)]">{d.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Branch summary + Urgent issues */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Branch table */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="font-bold text-sm text-[var(--text)]">{s.maint_dash_by_branch}</h3>
          </div>
          {stats.branches.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">{s.no_maintenance}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {[s.branch, s.status_open, s.status_in_progress, s.status_resolved, '🚨'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs text-[var(--text-muted)] font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.branches.map(b => (
                    <tr key={b.name} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-3 py-2.5 font-medium text-[var(--text)] whitespace-nowrap">{b.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-semibold ${b.open > 0 ? 'text-blue-500' : 'text-[var(--text-muted)]'}`}>{b.open}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-semibold ${b.inProgress > 0 ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>{b.inProgress}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-semibold text-emerald-500">{b.resolved}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {b.critical > 0
                          ? <span className="font-bold text-red-500">{b.critical}</span>
                          : <span className="text-emerald-500">✓</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Urgent issues list */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--text)]">{s.maint_dash_urgent_list}</h3>
            {stats.urgentCount > 0 && (
              <Badge variant="danger">{stats.urgentCount}</Badge>
            )}
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
                    <div className="flex-shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                        background: PRIORITY_COLOR[r.priority] + '20',
                        color: PRIORITY_COLOR[r.priority],
                      }}>
                        {r.priority === 'critical' ? s.priority_critical : s.priority_high}
                      </span>
                    </div>
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
