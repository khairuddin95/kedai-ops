import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import StarRating from '../components/ui/StarRating'
import { SubStatusBadge } from '../components/ui/Badge'
import type { Submission, SubmissionStatus } from '../types'

type Tab = 'pending' | 'approved' | 'rejected'

export default function ReviewPage() {
  const { state, reviewSubmission } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const [tab, setTab] = useState<Tab>('pending')
  const [selected, setSelected] = useState<Submission | null>(null)
  const [comment, setComment] = useState('')
  const [deciding, setDeciding] = useState<SubmissionStatus | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  const visibleSubs = state.submissions.filter(sub => sub.status === tab)
  const pending = state.submissions.filter(sub => sub.status === 'pending').length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending',  label: `${s.pending} (${pending})` },
    { key: 'approved', label: s.approved },
    { key: 'rejected', label: s.rejected },
  ]

  const decide = async (status: SubmissionStatus) => {
    if (!selected || deciding) return
    setErrorMsg('')
    setDeciding(status)
    const ok = await reviewSubmission(selected.id, status as 'approved' | 'rejected', comment || undefined)
    setDeciding(null)
    if (!ok) {
      setErrorMsg(s.update_failed)
      setTimeout(() => setErrorMsg(''), 3000)
      return
    }
    setComment('')
    const next = visibleSubs.find(sub => sub.id !== selected.id)
    setSelected(next ?? null)
  }

  /* Mobile: show detail view when an item is selected */
  const showDetail = !!selected

  return (
    <div className="h-full">
      <h2 className="text-xl font-bold text-[var(--text)] mb-4">{s.review_title}</h2>

      <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-180px)]">
        {/* ── Left panel (list) — hidden on mobile when detail is open ── */}
        <div className={`md:w-[380px] md:min-w-[380px] flex-col bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden ${showDetail ? 'hidden md:flex' : 'flex'}`}>
          {/* Header + tabs */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-[var(--text)]">{s.review_title}</span>
              {pending > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending}</span>
              )}
            </div>
            <div className="flex gap-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setSelected(null) }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tab === t.key ? 'bg-brand-600 text-white' : 'text-[var(--text-soft)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
            {visibleSubs.length === 0 && (
              <div className="py-12 text-center text-[var(--text-muted)] text-sm">
                <div className="text-4xl mb-2">📭</div>
                {s.no_submissions}
              </div>
            )}
            {visibleSubs.map(sub => (
              <button
                key={sub.id}
                onClick={() => { setSelected(sub); setComment('') }}
                className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${
                  selected?.id === sub.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-[var(--surface-2)]'
                }`}
              >
                <Avatar emoji={sub.staffAvatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-sm font-semibold text-[var(--text)] truncate">{sub.staffName}</span>
                    {sub.flag && <span className="text-red-500 text-xs flex-shrink-0">🚩</span>}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate">{sub.taskTitle}</p>
                  <div className="flex items-center justify-between mt-1">
                    <StarRating value={sub.rating} readonly size="sm" />
                    <span className="text-xs text-[var(--text-muted)]">
                      {sub.submittedAt.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <span className="text-[var(--text-muted)] text-sm flex-shrink-0">›</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right panel (detail) — hidden on mobile when nothing selected ── */}
        <div className={`flex-1 flex-col bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden ${showDetail ? 'flex' : 'hidden md:flex'}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
              <div className="text-center">
                <div className="text-5xl mb-3">👈</div>
                <p className="text-sm">{s.select_submission}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Staff + task info */}
              <div className="p-4 border-b border-[var(--border)]">
                {/* Back button — mobile only */}
                <button
                  className="md:hidden flex items-center gap-1 text-brand-600 text-sm font-medium mb-3"
                  onClick={() => setSelected(null)}
                >
                  ‹ {lang === 'bm' ? 'Kembali' : 'Back'}
                </button>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar emoji={selected.staffAvatar} size="lg" name={selected.staffName} />
                  <div>
                    <div className="font-bold text-[var(--text)]">{selected.staffName}</div>
                    <div className="text-xs text-[var(--text-muted)]">{selected.branch} · Shift {selected.shift === 'morning' ? s.shift_morning : s.shift_evening}</div>
                  </div>
                  <div className="ml-auto">
                    <SubStatusBadge status={selected.status} />
                  </div>
                </div>
                <div className="bg-[var(--surface-2)] rounded-lg p-3">
                  <div className="text-sm font-semibold text-[var(--text)]">{selected.taskTitle}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{selected.groupTitle}</div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Photos */}
                {selected.photos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">📷 Foto ({selected.photos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selected.photos.map((url, i) => (
                        <button key={i} onClick={() => setLightbox(url)} className="aspect-square rounded-md overflow-hidden border border-[var(--border)] hover:opacity-80 transition-opacity">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">📝 {s.notes_title}</p>
                    <p className="text-sm bg-[var(--surface-2)] rounded-lg px-3 py-2 text-[var(--text)]">{selected.notes}</p>
                  </div>
                )}

                {/* Rating */}
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">⭐ {s.staff_rating}</p>
                  <StarRating value={selected.rating} readonly size="md" />
                </div>

                {/* Comment */}
                {selected.status === 'pending' && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">💬 {s.add_comment}</p>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      rows={3}
                      placeholder={s.add_comment}
                      className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors resize-none"
                    />
                  </div>
                )}

                {selected.supervisorComment && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">💬 {s.add_comment}</p>
                    <p className="text-sm bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 text-[var(--text)]">{selected.supervisorComment}</p>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="px-4 pt-2">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2">
                    ⚠️ {errorMsg}
                  </div>
                </div>
              )}
              {/* Action buttons */}
              {selected.status === 'pending' && (
                <div className="p-4 border-t border-[var(--border)] flex gap-3">
                  <Button
                    variant="danger" className="flex-1"
                    loading={deciding === 'rejected'}
                    disabled={deciding !== null}
                    onClick={() => decide('rejected')}
                  >
                    ✗ {s.reject}
                  </Button>
                  <Button
                    variant="success" className="flex-1"
                    loading={deciding === 'approved'}
                    disabled={deciding !== null}
                    onClick={() => decide('approved')}
                  >
                    ✓ {s.approve}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
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
