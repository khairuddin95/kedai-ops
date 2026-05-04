import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ProgressBar from '../components/ui/ProgressBar'
import StarRating from '../components/ui/StarRating'
import ChecklistItem from '../components/task/ChecklistItem'
import GroupIcon from '../components/ui/GroupIcon'
import Badge from '../components/ui/Badge'
import type { Submission } from '../types'

const PHOTO_COLORS = ['#fbbf24','#34d399','#60a5fa','#f472b6','#a78bfa','#fb923c']

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state, saveTaskState, submitTask } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]

  const allTasks = state.taskGroups.flatMap(g =>
    g.tasks.map(t => ({ ...t, groupId: g.id, groupTitle: g.title, groupColor: g.color, groupIcon: g.icon }))
  )
  const task = allTasks.find(t => t.id === id)
  if (!task) return (
    <div className="text-center py-20 text-[var(--text-muted)]">
      <div className="text-5xl mb-3">🔍</div>
      <p>{STRINGS[lang ?? 'bm'].task_not_found}</p>
      <Button className="mt-4" variant="secondary" onClick={() => navigate('/tasks')}>{STRINGS[lang ?? 'bm'].back}</Button>
    </div>
  )

  const existing = state.taskStates[task.id]
  const [checked, setChecked] = useState<number[]>(existing?.checkedItems ?? [])
  const [photos, setPhotos]   = useState<string[]>(existing?.photos ?? [])
  const [notes, setNotes]     = useState(existing?.notes ?? '')
  const [rating, setRating]   = useState(existing?.rating ?? 0)
  const [submitting, setSub]  = useState(false)

  const totalItems = task.items.length
  const checkCount = checked.length
  const checkPct = totalItems ? Math.round((checkCount / totalItems) * 100) : 0
  const photosOk = !task.requiresPhoto || photos.length > 0
  const canSubmit = checkCount === totalItems && photosOk && rating > 0

  useEffect(() => {
    saveTaskState({
      taskId: task.id,
      checkedItems: checked, photos, notes, rating,
      status: checked.length === totalItems ? 'done' : checked.length > 0 ? 'in_progress' : 'pending',
    })
  }, [checked, photos, notes, rating])

  const toggleItem = (i: number) =>
    setChecked(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  const addPhoto = () =>
    setPhotos(prev => [...prev, PHOTO_COLORS[prev.length % PHOTO_COLORS.length]])

  const handleSubmit = async () => {
    setSub(true)
    const sub: Submission = {
      id: `sub_${Date.now()}`,
      taskId: task.id,
      taskTitle: task.title,
      staffName: state.user?.name ?? '',
      staffAvatar: state.user?.avatar ?? '👤',
      branch: state.user?.branch ?? '',
      shift: state.shift?.id ?? 'morning',
      submittedAt: new Date(),
      checkedItems: checked,
      photos,
      notes,
      rating,
      status: 'pending',
      groupTitle: task.groupTitle,
      groupColor: task.groupColor,
    }
    await submitTask(sub)
    await saveTaskState({ taskId: task.id, checkedItems: checked, photos, notes, rating, status: 'done' })
    navigate(`/tasks/${task.id}/submitted`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-28">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--text-soft)] hover:text-[var(--text)] transition-colors">
        ← {s.back}
      </button>

      {/* Header card */}
      <Card>
        <div className="flex items-start gap-4">
          <GroupIcon icon={task.groupIcon ?? 'sunrise'} color={task.groupColor ?? '#3b82f6'} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-bold text-lg text-[var(--text)]">{task.title}</h2>
                <p className="text-xs text-[var(--text-muted)]">{task.groupTitle} · {task.est} {s.min}</p>
              </div>
              {task.requiresPhoto && (
                <Badge variant="warning">📷 {s.photo_required}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <ProgressBar value={checkPct} color={task.groupColor} />
              <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                {checkCount}/{totalItems} {s.items_checked}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">⏱ {task.est} {s.min} {s.est_time}</p>
          </div>
        </div>
      </Card>

      {/* Checklist */}
      <Card>
        <h3 className="font-bold text-sm text-[var(--text)] mb-3">{s.checklist}</h3>
        <div className="space-y-2">
          {task.items.map((item, i) => (
            <ChecklistItem
              key={i}
              index={i}
              label={item}
              checked={checked.includes(i)}
              onToggle={() => toggleItem(i)}
            />
          ))}
        </div>
      </Card>

      {/* Photo upload */}
      {task.requiresPhoto && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-[var(--text)]">{s.upload_photo}</h3>
            <span className="text-xs text-[var(--text-muted)]">{photos.length} foto</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((color, i) => (
              <div key={i} className="aspect-square rounded-md flex items-center justify-center text-white text-2xl relative overflow-hidden" style={{ background: color }}>
                📷
                <button
                  onClick={() => setPhotos(p => p.filter((_,j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/40 rounded-full text-white text-xs flex items-center justify-center hover:bg-black/60"
                >×</button>
              </div>
            ))}
            {photos.length < 6 && (
              <button
                onClick={addPhoto}
                className="aspect-square rounded-md border-2 border-dashed border-[var(--border-2)] flex flex-col items-center justify-center gap-1 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
              >
                <span className="text-2xl text-[var(--text-muted)]">+</span>
                <span className="text-xs text-[var(--text-muted)]">{s.add_photo}</span>
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">💡 {s.photo_tip}</p>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-bold text-sm text-[var(--text)]">{s.notes_label}</h3>
          <span className="text-xs text-[var(--text-muted)]">({s.optional})</span>
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder={s.notes_placeholder}
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors resize-none"
        />
      </Card>

      {/* Rating */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm text-[var(--text)]">{s.quality_rating}</h3>
          {rating > 0 && <span className="text-xs text-amber-500 font-medium">{rating}/5 ⭐</span>}
        </div>
        <StarRating value={rating} onChange={setRating} size="lg" />
        <p className="text-xs text-[var(--text-muted)] mt-2">💡 {s.rating_tip}</p>
      </Card>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[220px] p-4 bg-[var(--surface)] border-t border-[var(--border)] flex gap-3 z-30">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => navigate('/tasks')}
        >
          {s.save_draft}
        </Button>
        <Button
          className="flex-1"
          disabled={!canSubmit}
          loading={submitting}
          onClick={handleSubmit}
        >
          {s.submit_task}
        </Button>
      </div>
    </div>
  )
}
