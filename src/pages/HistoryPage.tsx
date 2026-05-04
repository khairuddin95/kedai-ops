import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import { SubStatusBadge } from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import StarRating from '../components/ui/StarRating'
import type { SubmissionStatus } from '../types'

type Filter = 'all' | SubmissionStatus

export default function HistoryPage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const subs = filter === 'all' ? state.submissions : state.submissions.filter(s => s.status === filter)

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',      label: s.all_tasks },
    { key: 'approved', label: s.approved },
    { key: 'rejected', label: s.rejected },
    { key: 'pending',  label: s.pending },
  ]

  const PHOTO_COLORS = ['#fbbf24','#34d399','#60a5fa','#f472b6']

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[var(--text)]">{s.history}</h2>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'border border-[var(--border-2)] text-[var(--text-soft)] hover:border-brand-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {subs.length === 0 && (
        <div className="py-16 text-center text-[var(--text-muted)]">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-sm">{s.no_submissions}</p>
        </div>
      )}

      <div className="space-y-3">
        {subs.map(sub => (
          <Card key={sub.id} hover padding="none">
            <button
              className="w-full text-left p-4"
              onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
            >
              <div className="flex items-start gap-3">
                <Avatar emoji={sub.staffAvatar} size="md" name={sub.staffName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-[var(--text)]">{sub.taskTitle}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {sub.groupTitle} · {sub.staffName} · {sub.branch}
                      </div>
                    </div>
                    <SubStatusBadge status={sub.status} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <StarRating value={sub.rating} readonly size="sm" />
                    <span className="text-xs text-[var(--text-muted)]">
                      {sub.submittedAt.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {sub.submittedAt.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <span className={`text-[var(--text-muted)] text-xs transition-transform ${expanded === sub.id ? 'rotate-90' : ''}`}>›</span>
              </div>
            </button>

            {/* Expanded detail */}
            {expanded === sub.id && (
              <div className="border-t border-[var(--border)] p-4 space-y-3 animate-fadeIn">
                {sub.photos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">📷 Foto</p>
                    <div className="flex gap-2">
                      {sub.photos.map((_c, i) => (
                        <div key={i} className="w-16 h-16 rounded-md flex items-center justify-center text-2xl" style={{ background: PHOTO_COLORS[i % PHOTO_COLORS.length] }}>📷</div>
                      ))}
                    </div>
                  </div>
                )}
                {sub.notes && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">📝 {s.notes_label}</p>
                    <p className="text-sm text-[var(--text)] bg-[var(--surface-2)] rounded-md px-3 py-2">{sub.notes}</p>
                  </div>
                )}
                {sub.supervisorComment && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">💬 Komen Supervisor</p>
                    <p className="text-sm text-[var(--text)] bg-[var(--surface-2)] rounded-md px-3 py-2">{sub.supervisorComment}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
