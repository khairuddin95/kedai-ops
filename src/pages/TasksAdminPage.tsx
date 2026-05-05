import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import { ICONS } from '../components/ui/GroupIcon'
import GroupIcon from '../components/ui/GroupIcon'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import type { TaskGroup, TaskGroupDepartment, TaskGroupFrequency, TaskGroupShift } from '../types'

const PRESET_COLORS = [
  '#f59e0b','#10b981','#3b82f6','#8b5cf6',
  '#ef4444','#f472b6','#06b6d4','#84cc16',
]

const DEPT_OPTIONS: { value: TaskGroupDepartment; icon: string; label: string }[] = [
  { value: 'all',     icon: '🌐', label: 'Semua' },
  { value: 'kitchen', icon: '🍳', label: 'Kitchen' },
  { value: 'service', icon: '🛎️', label: 'Service' },
]

const blankGroup = { title: '', time: '', icon: 'sunrise', color: '#f59e0b', shift: 'both' as TaskGroupShift, frequency: 'daily' as TaskGroupFrequency, department: 'all' as TaskGroupDepartment }

const SHIFT_OPTIONS: { value: TaskGroupShift; icon: string; labelKey: string }[] = [
  { value: 'morning', icon: '☀️', labelKey: 'shift_morning_only' },
  { value: 'evening', icon: '🌙', labelKey: 'shift_evening_only' },
  { value: 'both',    icon: '🌐', labelKey: 'shift_both' },
]
const blankTask  = { title: '', est: 10, requiresPhoto: false, items: [''] }

export default function TasksAdminPage() {
  const { state, addTaskGroup, addTask, deleteTask, deleteTaskGroup, updateTaskGroup } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]

  const [expanded, setExpanded]       = useState<Record<string, boolean>>({})
  const [showGroupForm, setShowGroup] = useState(false)
  const [gForm, setGForm]             = useState({ ...blankGroup })
  const [savingG, setSavingG]         = useState(false)

  // per-group "add task" form state
  const [addingTask, setAddingTask]   = useState<string | null>(null)  // groupId
  const [tForm, setTForm]             = useState({ ...blankTask })
  const [savingT, setSavingT]         = useState(false)

  const [toast, setToast]             = useState('')
  const [error, setError]             = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Group form ──────────────────────────────────────────────

  const handleSaveGroup = async () => {
    if (!gForm.title.trim() || !gForm.time.trim()) { setError(s.fill_all); return }
    setError(''); setSavingG(true)
    const id = `grp_${Date.now()}`
    await addTaskGroup({ id, title: gForm.title.trim(), time: gForm.time.trim(), icon: gForm.icon, color: gForm.color, shift: gForm.shift, frequency: gForm.frequency, department: gForm.department } as Omit<TaskGroup, 'tasks'>)
    setSavingG(false)
    setShowGroup(false)
    setGForm({ ...blankGroup })
    showToast(s.group_added)
  }

  // ── Task form ───────────────────────────────────────────────

  const openTaskForm = (groupId: string) => {
    setAddingTask(groupId)
    setTForm({ ...blankTask })
    setError('')
  }

  const updateItem = (i: number, val: string) =>
    setTForm(f => { const items = [...f.items]; items[i] = val; return { ...f, items } })

  const addItem = () => setTForm(f => ({ ...f, items: [...f.items, ''] }))

  const removeItem = (i: number) =>
    setTForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))

  const handleSaveTask = async (groupId: string) => {
    const items = tForm.items.map(s => s.trim()).filter(Boolean)
    if (!tForm.title.trim() || items.length === 0) { setError(s.fill_all); return }
    setError(''); setSavingT(true)
    await addTask({ title: tForm.title.trim(), est: tForm.est, requiresPhoto: tForm.requiresPhoto, items }, groupId)
    setSavingT(false)
    setAddingTask(null)
    setTForm({ ...blankTask })
    showToast(s.task_added)
  }

  const handleDeleteTask = async (taskId: string, groupId: string) => {
    if (!confirm(s.confirm_del_task)) return
    await deleteTask(taskId, groupId)
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm(s.confirm_del_group)) return
    await deleteTaskGroup(groupId)
  }

  const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">{s.task_mgmt}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {state.taskGroups.length} kumpulan · {state.taskGroups.reduce((n, g) => n + g.tasks.length, 0)} {s.tasks_count}
          </p>
        </div>
        {!showGroupForm && (
          <Button onClick={() => { setShowGroup(true); setGForm({ ...blankGroup }); setError('') }}>
            + {s.add_group}
          </Button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          ✅ {toast}
        </div>
      )}

      {/* Add Group form */}
      {showGroupForm && (
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-4">+ {s.add_group}</h3>

          {/* Color picker */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--text-soft)] mb-2">{s.group_color}</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setGForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full transition-all ${gForm.color === c ? 'ring-2 ring-offset-2 ring-[var(--text)] scale-110' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Icon picker */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--text-soft)] mb-2">{s.group_icon}</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(ICONS).map(([key, emoji]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGForm(f => ({ ...f, icon: key }))}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    gForm.icon === key
                      ? 'ring-2 ring-brand-500 scale-110'
                      : 'bg-[var(--surface-2)]'
                  }`}
                  style={gForm.icon === key ? { background: gForm.color + '33' } : {}}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.group_name}</label>
              <input
                value={gForm.title}
                onChange={e => setGForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Contoh: Persediaan Lunch"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.group_time}</label>
              <input
                value={gForm.time}
                onChange={e => setGForm(f => ({ ...f, time: e.target.value }))}
                placeholder="10:00 pagi"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-2">{s.group_shift}</label>
              <div className="flex gap-2">
                {SHIFT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGForm(f => ({ ...f, shift: opt.value }))}
                    className={`flex-1 py-2 rounded-md text-xs font-medium border transition-all ${
                      gForm.shift === opt.value
                        ? opt.value === 'morning'
                          ? 'bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : opt.value === 'evening'
                          ? 'bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                          : 'bg-brand-100 border-brand-400 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                        : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {opt.icon} {s[opt.labelKey as keyof typeof s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-2">{s.group_frequency}</label>
              <div className="flex gap-2">
                {(['daily', 'weekly'] as TaskGroupFrequency[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setGForm(prev => ({ ...prev, frequency: f }))}
                    className={`flex-1 py-2 rounded-md text-xs font-medium border transition-all ${
                      gForm.frequency === f
                        ? f === 'daily'
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {f === 'daily' ? '📅' : '📆'} {f === 'daily' ? s.freq_daily : s.freq_weekly}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-2">
                {lang === 'bm' ? 'Jabatan' : 'Department'}
              </label>
              <div className="flex gap-2">
                {DEPT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGForm(f => ({ ...f, department: opt.value }))}
                    className={`flex-1 py-2 rounded-md text-xs font-medium border transition-all ${
                      gForm.department === opt.value
                        ? opt.value === 'kitchen'
                          ? 'bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : opt.value === 'service'
                          ? 'bg-sky-100 border-sky-400 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                          : 'bg-brand-100 border-brand-400 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                        : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{error}</p>}

          <div className="flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowGroup(false); setError('') }}>{s.cancel}</Button>
            <Button className="flex-1" loading={savingG} onClick={handleSaveGroup}>{s.save}</Button>
          </div>
        </Card>
      )}

      {/* Task groups */}
      {state.taskGroups.map(group => (
        <div key={group.id} className="border border-[var(--border)] rounded-xl overflow-hidden">
          {/* Group header */}
          <button
            onClick={() => toggle(group.id)}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors text-left"
          >
            <GroupIcon icon={group.icon} color={group.color} size={36} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-[var(--text)]">{group.title}</div>
              <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
                <span>⏱ {group.time} · {group.tasks.length} {s.tasks_count}</span>
                <span>{group.shift === 'morning' ? '☀️' : group.shift === 'evening' ? '🌙' : '🌐'}</span>
                <span>{group.frequency === 'weekly' ? '📆' : '📅'}</span>
                <span>{group.department === 'kitchen' ? '🍳' : group.department === 'service' ? '🛎️' : '🌐'}</span>
              </div>
            </div>
            <span className="text-[var(--text-muted)] text-sm transition-transform duration-200" style={{ display: 'inline-block', transform: expanded[group.id] ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
          </button>

          {/* Expanded content */}
          {expanded[group.id] && (
            <div className="border-t border-[var(--border)] bg-[var(--surface-2)]">
              {/* Shift + frequency inline edit */}
              <div className="px-4 py-3 border-b border-[var(--border)] space-y-2">
                <div>
                  <p className="text-xs font-medium text-[var(--text-soft)] mb-1.5">{s.group_shift}</p>
                  <div className="flex gap-1.5">
                    {SHIFT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateTaskGroup(group.id, { shift: opt.value })}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          group.shift === opt.value
                            ? opt.value === 'morning'
                              ? 'bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : opt.value === 'evening'
                              ? 'bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                              : 'bg-brand-100 border-brand-400 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
                        }`}
                      >
                        {opt.icon} {s[opt.labelKey as keyof typeof s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-soft)] mb-1.5">{s.group_frequency}</p>
                  <div className="flex gap-1.5">
                    {(['daily', 'weekly'] as TaskGroupFrequency[]).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => updateTaskGroup(group.id, { frequency: f })}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          group.frequency === f
                            ? f === 'daily'
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
                        }`}
                      >
                        {f === 'daily' ? '📅' : '📆'} {f === 'daily' ? s.freq_daily : s.freq_weekly}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-soft)] mb-1.5">{lang === 'bm' ? 'Jabatan' : 'Department'}</p>
                  <div className="flex gap-1.5">
                    {DEPT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateTaskGroup(group.id, { department: opt.value })}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          (group.department ?? 'all') === opt.value
                            ? opt.value === 'kitchen'
                              ? 'bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : opt.value === 'service'
                              ? 'bg-sky-100 border-sky-400 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                              : 'bg-brand-100 border-brand-400 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
                        }`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Task list */}
              {group.tasks.length === 0 && addingTask !== group.id && (
                <p className="px-5 py-4 text-sm text-[var(--text-muted)]">{s.no_tasks}</p>
              )}
              {group.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] last:border-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: group.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text)]">{task.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--text-muted)]">⏱ {task.est} {s.min}</span>
                      <span className="text-xs text-[var(--text-muted)]">· {task.items.length} item</span>
                      {task.requiresPhoto && <span className="text-xs text-amber-600 dark:text-amber-400">📷</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTask(task.id, group.id)}
                    className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                  >
                    🗑
                  </button>
                </div>
              ))}

              {/* Add task form */}
              {addingTask === group.id ? (
                <div className="px-5 py-4 space-y-3 border-t border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--text-soft)]">+ {s.add_task}</p>

                  <input
                    value={tForm.title}
                    onChange={e => setTForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={s.task_title}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
                  />

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-[var(--text-soft)] mb-1">{s.task_est}</label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={tForm.est}
                        onChange={e => setTForm(f => ({ ...f, est: Number(e.target.value) }))}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-5">
                      <input
                        type="checkbox"
                        checked={tForm.requiresPhoto}
                        onChange={e => setTForm(f => ({ ...f, requiresPhoto: e.target.checked }))}
                        className="w-4 h-4 accent-brand-600"
                      />
                      <span className="text-sm text-[var(--text-soft)]">📷 {s.task_photo}</span>
                    </label>
                  </div>

                  {/* Checklist items */}
                  <div>
                    <label className="block text-xs text-[var(--text-soft)] mb-2">{s.task_items}</label>
                    <div className="space-y-2">
                      {tForm.items.map((item, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={item}
                            onChange={e => updateItem(i, e.target.value)}
                            placeholder={`${i + 1}. ${s.item_placeholder}`}
                            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
                          />
                          {tForm.items.length > 1 && (
                            <button
                              onClick={() => removeItem(i)}
                              className="text-[var(--text-muted)] hover:text-red-500 transition-colors px-2"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addItem}
                      className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                    >
                      + {s.add_item}
                    </button>
                  </div>

                  {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{error}</p>}

                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => { setAddingTask(null); setError('') }}>{s.cancel}</Button>
                    <Button className="flex-1" loading={savingT} onClick={() => handleSaveTask(group.id)}>{s.save}</Button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 flex items-center justify-between border-t border-[var(--border)]">
                  <button
                    onClick={() => openTaskForm(group.id)}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1.5 transition-colors"
                  >
                    + {s.add_task}
                  </button>
                  {group.tasks.length === 0 && (
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      🗑 {s.delete_group}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
