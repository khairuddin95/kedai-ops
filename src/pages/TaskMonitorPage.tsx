import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import GroupIcon from '../components/ui/GroupIcon'
import * as db from '../lib/db'
import { supabaseConfigured } from '../lib/supabase'
import type { User, ShiftId } from '../types'

type ShiftFilter = 'all' | ShiftId

function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function todayLabel(lang: 'bm' | 'en'): string {
  return new Date().toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-MY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function TaskMonitorPage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]

  const [staffList, setStaffList] = useState<User[]>([])
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all')
  const [showPendingOnly, setShowPendingOnly] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) return
    db.fetchUsers().then(users => {
      if (!users) return
      const branch = state.user?.branch ?? ''
      const catchAll = ['all', 'semua', 'semua cawangan', 'all branches']
      setStaffList(
        users.filter(u =>
          u.role === 'staff' &&
          (catchAll.includes(branch.toLowerCase()) || u.branch.toLowerCase() === branch.toLowerCase())
        )
      )
    })
  }, [state.user?.branch])

  const todayMs = todayStart().getTime()

  const todaySubmissions = useMemo(
    () => state.submissions.filter(sub => new Date(sub.submittedAt).getTime() >= todayMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.submissions, todayMs]
  )

  const filteredGroups = useMemo(() => {
    return state.taskGroups.filter(g => {
      if (shiftFilter === 'all') return true
      return g.shift === shiftFilter || g.shift === 'both'
    })
  }, [state.taskGroups, shiftFilter])

  // Total pending tasks across all filtered groups
  const totalPending = useMemo(() => {
    let count = 0
    for (const g of filteredGroups) {
      for (const t of g.tasks) {
        const subs = todaySubmissions.filter(sub => sub.taskId === t.id)
        if (subs.length === 0) count++
      }
    }
    return count
  }, [filteredGroups, todaySubmissions])

  const totalTasks = filteredGroups.reduce((n, g) => n + g.tasks.length, 0)

  const shiftTabs: { key: ShiftFilter; label: string }[] = [
    { key: 'all',     label: lang === 'bm' ? 'Semua' : 'All' },
    { key: 'morning', label: lang === 'bm' ? 'Pagi' : 'Morning' },
    { key: 'evening', label: lang === 'bm' ? 'Petang' : 'Evening' },
  ]

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[var(--text)]">📌 {s.task_monitor}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{todayLabel(lang)}</p>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap">
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-soft)]">
          {filteredGroups.length} {lang === 'bm' ? 'kumpulan' : 'groups'}
        </span>
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-soft)]">
          {totalTasks} {lang === 'bm' ? 'task' : 'tasks'}
        </span>
        {totalPending > 0 ? (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            ❌ {totalPending} {lang === 'bm' ? 'belum ada submission' : 'no submission yet'}
          </span>
        ) : (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            ✅ {lang === 'bm' ? 'Semua ada submission' : 'All tasks submitted'}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Shift tabs */}
        <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl">
          {shiftTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setShiftFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                shiftFilter === t.key
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Pending only toggle */}
        <button
          onClick={() => setShowPendingOnly(v => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
            showPendingOnly
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 border-red-200 dark:border-red-800'
              : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-transparent'
          }`}
        >
          {lang === 'bm' ? 'Belum sahaja' : 'Pending only'}
        </button>
      </div>

      {/* Task Groups */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm text-[var(--text-muted)]">
            {lang === 'bm' ? 'Tiada kumpulan tugasan' : 'No task groups'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const tasksToShow = showPendingOnly
              ? group.tasks.filter(t => todaySubmissions.filter(sub => sub.taskId === t.id).length === 0)
              : group.tasks

            if (showPendingOnly && tasksToShow.length === 0) return null

            const groupDone = group.tasks.filter(t => todaySubmissions.some(sub => sub.taskId === t.id)).length
            const groupTotal = group.tasks.length

            return (
              <Card key={group.id} padding="none">
                {/* Group header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                  <GroupIcon icon={group.icon} color={group.color} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-[var(--text)]">{group.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {group.time} ·{' '}
                      {group.shift === 'morning' ? (lang === 'bm' ? 'Pagi' : 'Morning') :
                       group.shift === 'evening' ? (lang === 'bm' ? 'Petang' : 'Evening') :
                       (lang === 'bm' ? 'Semua shift' : 'All shifts')}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    groupDone === groupTotal
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                      : groupDone === 0
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                  }`}>
                    {groupDone}/{groupTotal}
                  </span>
                </div>

                {/* Tasks */}
                <div className="divide-y divide-[var(--border)]">
                  {tasksToShow.map(task => {
                    const subs = todaySubmissions.filter(sub => sub.taskId === task.id)
                    const hasSub = subs.length > 0

                    // Unique submitters
                    const submitters = subs.reduce<{ name: string; avatar: string }[]>((acc, sub) => {
                      if (!acc.some(a => a.name === sub.staffName)) {
                        acc.push({ name: sub.staffName, avatar: sub.staffAvatar })
                      }
                      return acc
                    }, [])

                    // Staff who haven't submitted (if we have staff list)
                    const pending = staffList.filter(
                      u => !subs.some(sub => sub.staffName === u.name)
                    )

                    return (
                      <div key={task.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {/* Status icon */}
                          <span className={`text-base flex-shrink-0 mt-0.5 ${hasSub ? 'opacity-100' : 'opacity-100'}`}>
                            {hasSub ? '✅' : '❌'}
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${hasSub ? 'text-[var(--text)]' : 'text-red-600 dark:text-red-400'}`}>
                              {task.title}
                            </div>

                            {hasSub ? (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {submitters.map(staff => (
                                  <div key={staff.name} className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full pl-1 pr-2.5 py-0.5">
                                    <Avatar emoji={staff.avatar} size="sm" />
                                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{staff.name}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-1">
                                {staffList.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {pending.map(u => (
                                      <div key={u.id} className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 rounded-full pl-1 pr-2.5 py-0.5">
                                        <Avatar emoji={u.avatar} size="sm" />
                                        <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{u.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[var(--text-muted)]">
                                    {lang === 'bm' ? 'Belum ada submission' : 'No submission yet'}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Partial: show who hasn't submitted */}
                            {hasSub && staffList.length > 0 && pending.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {pending.map(u => (
                                  <div key={u.id} className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 rounded-full pl-1 pr-2.5 py-0.5">
                                    <Avatar emoji={u.avatar} size="sm" />
                                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">{u.name}</span>
                                  </div>
                                ))}
                                <span className="text-[11px] text-[var(--text-muted)] self-center">
                                  {lang === 'bm' ? 'belum' : 'pending'}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Submission count */}
                          {subs.length > 0 && (
                            <span className="text-xs text-[var(--text-muted)] flex-shrink-0 mt-0.5">
                              {subs.length}×
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
