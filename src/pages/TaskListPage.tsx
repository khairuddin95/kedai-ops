import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import { TaskStatusBadge } from '../components/ui/Badge'
import Card from '../components/ui/Card'
import GroupIcon from '../components/ui/GroupIcon'
import type { TaskStatus } from '../types'

type Filter = 'all' | TaskStatus

export default function TaskListPage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const lang = state.lang
  const s = STRINGS[lang]
  const ts = state.taskStates

  const shiftId = state.shift?.id
  const isSunday = new Date().getDay() === 0
  const ALL_TASKS = state.taskGroups
    .filter(g =>
      (!g.shift || g.shift === 'both' || g.shift === shiftId) &&
      (g.frequency !== 'weekly' || isSunday)
    )
    .flatMap(g => g.tasks.map(t => ({ ...t, groupId: g.id, groupTitle: g.title, groupColor: g.color, groupIcon: g.icon })))

  const [filter, setFilter] = useState<Filter>('all')

  const getStatus = (id: string): TaskStatus => ts[id]?.status ?? 'pending'

  const counts: Record<Filter, number> = {
    all:         ALL_TASKS.length,
    pending:     ALL_TASKS.filter(t => getStatus(t.id) === 'pending').length,
    in_progress: ALL_TASKS.filter(t => getStatus(t.id) === 'in_progress').length,
    done:        ALL_TASKS.filter(t => getStatus(t.id) === 'done').length,
    late:        ALL_TASKS.filter(t => getStatus(t.id) === 'late').length,
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',         label: `${s.all_tasks} (${counts.all})` },
    { key: 'pending',     label: `${s.not_done} (${counts.pending})` },
    { key: 'in_progress', label: `${s.in_progress} (${counts.in_progress})` },
    { key: 'done',        label: `${s.done} (${counts.done})` },
    { key: 'late',        label: `${s.late} (${counts.late})` },
  ]

  const visible = filter === 'all' ? ALL_TASKS : ALL_TASKS.filter(t => getStatus(t.id) === filter)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[var(--text)]">{s.tasks}</h2>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
              filter === f.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'border border-[var(--border-2)] text-[var(--text-soft)] hover:border-brand-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card padding="none">
        <div className="divide-y divide-[var(--border)]">
          {visible.length === 0 && (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">
              <div className="text-4xl mb-2">📭</div>
              {s.no_submissions}
            </div>
          )}
          {visible.map(task => {
            const status = getStatus(task.id)
            return (
              <button
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-2)] transition-colors text-left"
              >
                {/* Checkbox */}
                <div className={`w-[26px] h-[26px] rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  status === 'done'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : status === 'late'
                    ? 'border-red-400'
                    : 'border-[var(--border-2)]'
                }`}>
                  {status === 'done' && <span className="text-xs">✓</span>}
                </div>

                {/* Group icon + info */}
                <GroupIcon icon={task.groupIcon ?? 'sunrise'} color={task.groupColor ?? '#3b82f6'} size={32} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
                    {task.title}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{task.groupTitle}</div>
                </div>

                {/* Est time */}
                <div className="hidden sm:block text-xs text-[var(--text-muted)] w-[110px] text-right">
                  {task.est} {s.min}
                </div>

                {/* Status */}
                <div className="w-[130px] flex justify-end">
                  <TaskStatusBadge status={status} />
                </div>

                <span className="text-[var(--text-muted)] text-xs">›</span>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
