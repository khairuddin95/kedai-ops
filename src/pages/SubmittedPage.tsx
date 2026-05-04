import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Button from '../components/ui/Button'
import StarRating from '../components/ui/StarRating'

const CONFETTI_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899']

const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  left: `${(i * 4.17 + 1.5) % 100}%`,
  delay: `${(i * 0.035) % 0.8}s`,
  size: `${6 + (i % 4) * 2}px`,
  round: i % 2 === 0,
}))

function Confetti() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {CONFETTI_PIECES.map(p => (
        <div
          key={p.id}
          className="confetti-piece absolute"
          style={{
            left: p.left, top: '-10px',
            background: p.color,
            animationDelay: p.delay,
            width: p.size, height: p.size,
            borderRadius: p.round ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  )
}

export default function SubmittedPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const [show, setShow] = useState(false)

  const allTasks = useMemo(
    () => state.taskGroups.flatMap(g => g.tasks.map(t => ({ ...t, groupId: g.id, groupTitle: g.title }))),
    [state.taskGroups]
  )

  const task    = allTasks.find(t => t.id === id)
  const ts      = state.taskStates[id ?? '']
  const sub     = state.submissions.find(sub => sub.taskId === id)

  useEffect(() => { setTimeout(() => setShow(true), 50) }, [])

  const nextTask = allTasks.find(t => {
    const status = state.taskStates[t.id]?.status ?? 'pending'
    return t.id !== id && status !== 'done'
  })

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="relative w-full max-w-md text-center">
        <Confetti />

        <div className={`w-24 h-24 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6 transition-all duration-500 ${show ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
          <span className="text-5xl">✅</span>
        </div>

        <h1 className={`text-2xl font-extrabold text-[var(--text)] mb-2 transition-all duration-500 delay-100 ${show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          {s.submit_success}
        </h1>
        <p className={`text-sm text-[var(--text-soft)] mb-6 transition-all duration-500 delay-150 ${show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          {s.submit_msg}
        </p>

        <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-6 text-left space-y-3 transition-all duration-500 delay-200 ${show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">{s.task_label}</span>
            <span className="font-semibold text-[var(--text)]">{task?.title ?? id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">{s.staff}</span>
            <span className="font-semibold text-[var(--text)]">{state.user?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">{s.submitted_at}</span>
            <span className="font-semibold text-[var(--text)]">{new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--text-muted)]">{s.rating_label}</span>
            <StarRating value={ts?.rating ?? sub?.rating ?? 0} readonly size="sm" />
          </div>
        </div>

        <div className={`flex gap-3 transition-all duration-500 delay-300 ${show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/')}>
            {s.back_home}
          </Button>
          {nextTask ? (
            <Button className="flex-1" onClick={() => navigate(`/tasks/${nextTask.id}`)}>
              {s.next_task} →
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => navigate('/history')}>
              {s.history} →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
