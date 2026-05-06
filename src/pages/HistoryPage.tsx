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
  const [lightbox, setLightbox] = useState<string | null>(null)

  const subs = filter === 'all' ? state.submissions : state.submissions.filter(sub => sub.status === filter)

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',      label: s.all_tasks },
    { key: 'approved', label: s.approved },
    { key: 'rejected', label: s.rejected },
    { key: 'pending',  label: s.pending },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[var(--text)]">{s.history}</h2>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">📷 Foto ({sub.photos.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {sub.photos.map((url, i) => (
                        <button key={i} onClick={() => setLightbox(url)} className="w-16 h-16 rounded-md overflow-hidden border border-[var(--border)] hover:opacity-80 transition-opacity">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
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
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">💬 {s.supervisor_comment}</p>
                    <p className="text-sm text-[var(--text)] bg-[var(--surface-2)] rounded-md px-3 py-2">{sub.supervisorComment}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center bg-black/40 rounded-full">×</button>
        </div>
      )}
    </div>
  )
}
