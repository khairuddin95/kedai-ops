import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import ProgressBar from '../components/ui/ProgressBar'
import { TaskStatusBadge } from '../components/ui/Badge'
import GroupIcon from '../components/ui/GroupIcon'
import { loadTodayReviews, getReviewTarget } from './GoogleReviewPage'
import type { TaskStatus } from '../types'

function getGreeting(name: string, lang: 'bm' | 'en') {
  const h = new Date().getHours()
  const s = STRINGS[lang]
  const greet = h < 12 ? s.good_morning : h < 18 ? s.good_afternoon : s.good_evening
  return `${greet}, ${name} 👋`
}

function getTaskStatus(taskId: string, states: Record<string, { status: TaskStatus }>): TaskStatus {
  return states[taskId]?.status ?? 'pending'
}

export default function HomePage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const lang = state.lang
  const s = STRINGS[lang]
  const ts = state.taskStates

  const shiftId = state.shift?.id
  const isSunday = new Date().getDay() === 0
  const TASK_GROUPS = state.taskGroups.filter(g =>
    (!g.shift || g.shift === 'both' || g.shift === shiftId) &&
    (g.frequency !== 'weekly' || isSunday)
  )
  const ALL_TASKS = TASK_GROUPS.flatMap(g =>
    g.tasks.map(t => ({ ...t, groupId: g.id, groupTitle: g.title, groupColor: g.color, groupIcon: g.icon }))
  )

  const today = new Date().toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-MY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const allTasks = ALL_TASKS
  const total = allTasks.length
  const done = allTasks.filter(t => getTaskStatus(t.id, ts) === 'done').length
  const inProg = allTasks.filter(t => getTaskStatus(t.id, ts) === 'in_progress').length
  const late = allTasks.filter(t => getTaskStatus(t.id, ts) === 'late').length
  const upcoming = total - done - inProg - late
  const pct = total ? Math.round((done / total) * 100) : 0

  const statCards = [
    { label: s.tasks_done,        value: done,     color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: '✅' },
    { label: s.tasks_in_progress, value: inProg,   color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20',    icon: '🕐' },
    { label: s.tasks_upcoming,    value: upcoming, color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20',      icon: '📋' },
    { label: s.tasks_late,        value: late,     color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',        icon: '⚠️' },
  ]

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{today}</p>
            <h2 className="text-xl font-bold text-[var(--text)]">
              {getGreeting(state.user?.name ?? '', lang)}
            </h2>
            <p className="text-sm text-[var(--text-soft)] mt-1">
              {state.shift?.label} · {state.shift?.startTime} – {state.shift?.endTime}
            </p>
          </div>
          {done > 0 && (
            <div className="flex flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-semibold whitespace-nowrap">
                🔥 {done} {s.streak}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Progress */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[var(--text)]">{s.today_progress}</h3>
          <span className="font-mono text-lg font-bold text-brand-600">{pct}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-3xl font-extrabold text-[var(--text)]">{done}/{total}</span>
          <div className="flex-1">
            <ProgressBar value={pct} height="lg" color="#3b82f6" />
            <p className="text-xs text-[var(--text-muted)] mt-1">{s.tasks_done.toLowerCase()}</p>
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(c => (
          <div key={c.label} className={`${c.bg} rounded-lg p-3.5 border border-[var(--border)]`}>
            <div className="text-xl mb-1">{c.icon}</div>
            <div className="font-mono text-2xl font-extrabold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-[var(--text-soft)] mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Google Review task card */}
      {(() => {
        const grLogs   = loadTodayReviews()
        const grTarget = getReviewTarget()
        const grCount  = grLogs.length
        const grPct    = Math.min(100, Math.round((grCount / grTarget) * 100))
        const grDone   = grCount >= grTarget
        return (
          <button
            onClick={() => navigate('/google-review')}
            className="w-full text-left"
          >
            <Card hover padding="none">
              <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xl flex-shrink-0">⭐</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[var(--text)]">{s.google_review}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {grDone
                      ? (lang === 'bm' ? '✅ Sasaran tercapai!' : '✅ Target reached!')
                      : (lang === 'bm' ? `${grCount}/${grTarget} review` : `${grCount}/${grTarget} reviews`)}
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  grDone
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                }`}>
                  {grPct}%
                </span>
              </div>
              <div className="px-4 py-2">
                <ProgressBar value={grPct} color={grDone ? '#10b981' : '#f59e0b'} />
              </div>
            </Card>
          </button>
        )
      })()}

      {/* Task groups */}
      <div>
        <h3 className="font-bold text-[var(--text)] mb-3">{s.tasks_today}</h3>
        <div className="space-y-3">
          {TASK_GROUPS.map(group => {
            const groupDone = group.tasks.filter(t => getTaskStatus(t.id, ts) === 'done').length
            return (
              <Card key={group.id} padding="none">
                {/* Group header */}
                <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
                  <GroupIcon icon={group.icon} color={group.color} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[var(--text)]">{group.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">{group.time}</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: group.color + '22', color: group.color }}>
                    {groupDone}/{group.tasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="divide-y divide-[var(--border)]">
                  {group.tasks.map(task => {
                    const status = getTaskStatus(task.id, ts)
                    return (
                      <button
                        key={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors text-left"
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          status === 'done'
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-[var(--border-2)]'
                        }`}>
                          {status === 'done' && <span className="text-xs animate-checkPop">✓</span>}
                        </div>
                        <span className={`flex-1 text-sm font-medium ${status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
                          {task.title}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] mr-2">{task.est} {s.min}</span>
                        <TaskStatusBadge status={status} />
                        <span className="text-[var(--text-muted)] text-xs ml-1">›</span>
                      </button>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
