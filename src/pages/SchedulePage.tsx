import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import { supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'
import type { Branch, ShiftId, User } from '../types'
import { USERS as MOCK_USERS, BRANCHES as MOCK_BRANCHES } from '../data/mockData'

// Mon→Sun display order (JS day index)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAYS_BM   = ['Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab', 'Ahd']
const DAYS_EN   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TODAY_DOW = new Date().getDay()

type ShiftCell = ShiftId | null   // null = off

function nextShift(current: ShiftCell): ShiftCell {
  if (current === null)     return 'morning'
  if (current === 'morning') return 'evening'
  return null
}

function ShiftBadge({ shift }: { shift: ShiftCell }) {
  if (!shift) return <span className="text-[var(--text-muted)] text-xs">—</span>
  if (shift === 'morning') return <span className="text-xs font-bold text-amber-600 dark:text-amber-400">☀️</span>
  return <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">🌙</span>
}

export default function SchedulePage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]

  const [users, setUsers]       = useState<User[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)  // 'userId-day' key
  const [filterBranch, setFilterBranch] = useState('')
  const [filterDept, setFilterDept] = useState<'all' | 'kitchen' | 'service'>('all')

  // schedMap[userId][dayOfWeek] = shift | null
  const [schedMap, setSchedMap] = useState<Record<string, Record<number, ShiftCell>>>({})

  const days = lang === 'bm' ? DAYS_BM : DAYS_EN

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [userData, branchData, schedData] = await Promise.all([
        supabaseConfigured ? db.fetchUsers()      : Promise.resolve(MOCK_USERS),
        supabaseConfigured ? db.fetchBranches()   : Promise.resolve(MOCK_BRANCHES),
        supabaseConfigured ? db.fetchSchedules()  : Promise.resolve([]),
      ])

      setUsers(userData ?? [])
      setBranches(branchData ?? [])

      const map: Record<string, Record<number, ShiftCell>> = {}
      for (const entry of (schedData ?? [])) {
        if (!map[entry.userId]) map[entry.userId] = {}
        map[entry.userId][entry.dayOfWeek] = entry.shiftId
      }
      setSchedMap(map)
      setLoading(false)
    })()
  }, [])

  const [errorMsg, setErrorMsg] = useState('')

  const handleCell = async (user: User, dayOfWeek: number) => {
    const current = schedMap[user.id]?.[dayOfWeek] ?? null
    const next    = nextShift(current)
    const key     = `${user.id}-${dayOfWeek}`

    // Optimistic update
    setSchedMap(prev => ({
      ...prev,
      [user.id]: { ...(prev[user.id] ?? {}), [dayOfWeek]: next },
    }))

    setSaving(key)
    const ok = await db.upsertSchedule({ userId: user.id, dayOfWeek, shiftId: next })
    setSaving(null)

    if (!ok) {
      // Roll back so the UI matches what's actually in the DB
      setSchedMap(prev => ({
        ...prev,
        [user.id]: { ...(prev[user.id] ?? {}), [dayOfWeek]: current },
      }))
      setErrorMsg(s.save_failed)
      setTimeout(() => setErrorMsg(''), 3000)
    }
  }

  const filteredUsers = users
    .filter(u => !filterBranch || u.branch === filterBranch)
    .filter(u => filterDept === 'all' || u.department === filterDept)

  const staffOnly = filteredUsers.filter(u => u.role === 'staff' || u.role === 'supervisor')

  if (loading) {
    return <div className="text-center py-20 text-[var(--text-muted)] text-sm">{s.loading}</div>
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">📅 {s.sched_title}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{s.sched_hint}</p>
        </div>
        {branches.length > 0 && (
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400"
          >
            <option value="">{s.sched_all_branches}</option>
            {branches.filter(b => b.status === 'active').map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Error toast */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Department tabs */}
      <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl">
        {([['all', '🌐', s.all], ['kitchen', '🍳', 'Kitchen'], ['service', '🛎️', 'Service']] as const).map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setFilterDept(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              filterDept === id ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px]">☀️</span>
          {s.sched_legend_morning}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px]">🌙</span>
          {s.sched_legend_evening}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-[var(--surface-2)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">—</span>
          {s.sched_legend_off}
        </span>
        <span className="text-[var(--text-muted)]">|</span>
        <span className="font-semibold text-brand-600">{s.sched_legend_today}</span>
      </div>

      {/* Grid */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] w-48 sticky left-0 bg-[var(--surface)] z-10">
                  {s.sched_col_name}
                </th>
                {DAY_ORDER.map((dow, i) => (
                  <th
                    key={dow}
                    className={`px-2 py-3 text-xs font-semibold text-center min-w-[52px] ${
                      dow === TODAY_DOW
                        ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/20'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {days[i]}
                    {dow === TODAY_DOW && (
                      <div className="w-1 h-1 rounded-full bg-brand-500 mx-auto mt-0.5" />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffOnly.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                    {s.sched_no_staff}
                  </td>
                </tr>
              ) : staffOnly.map((user, idx) => (
                <tr
                  key={user.id}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    idx % 2 === 0 ? '' : 'bg-[var(--surface-2)]/40'
                  }`}
                >
                  {/* Staff name — sticky on scroll */}
                  <td className="px-4 py-2 sticky left-0 bg-[var(--surface)] z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-lg flex-shrink-0">{user.avatar}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--text)] leading-tight line-clamp-2">{user.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">@{user.username}</div>
                      </div>
                    </div>
                  </td>

                  {/* Day cells */}
                  {DAY_ORDER.map(dow => {
                    const shift  = schedMap[user.id]?.[dow] ?? null
                    const key    = `${user.id}-${dow}`
                    const isSaving = saving === key
                    const isToday  = dow === TODAY_DOW

                    return (
                      <td key={dow} className={`px-1 py-2 text-center ${isToday ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
                        <button
                          onClick={() => handleCell(user, dow)}
                          disabled={isSaving}
                          title={
                            shift === null ? s.sched_cell_off
                            : shift === 'morning' ? s.sched_cell_morning
                            : s.sched_cell_evening
                          }
                          className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-all active:scale-90 ${
                            isSaving ? 'opacity-50' :
                            shift === 'morning' ? 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50' :
                            shift === 'evening' ? 'bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50' :
                            'bg-[var(--surface-2)] hover:bg-[var(--surface-3,#e5e7eb)]'
                          }`}
                        >
                          {isSaving
                            ? <span className="text-[10px] text-[var(--text-muted)]">…</span>
                            : <ShiftBadge shift={shift} />
                          }
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary — how many staff per shift today */}
      {(() => {
        const todaySchedules = staffOnly.map(u => schedMap[u.id]?.[TODAY_DOW] ?? null)
        const morningCount = todaySchedules.filter(s => s === 'morning').length
        const eveningCount = todaySchedules.filter(s => s === 'evening').length
        const offCount     = todaySchedules.filter(s => s === null).length
        return (
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '☀️', label: s.sched_morning_today, value: morningCount, color: 'text-amber-600',          bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { icon: '🌙', label: s.sched_evening_today, value: eveningCount, color: 'text-indigo-600',         bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
              { icon: '—',  label: s.sched_off_today,     value: offCount,     color: 'text-[var(--text-muted)]', bg: 'bg-[var(--surface-2)]' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} rounded-xl p-3 border border-[var(--border)] text-center`}>
                <div className="text-xl mb-1">{stat.icon}</div>
                <div className={`font-mono text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
