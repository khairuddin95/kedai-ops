import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'

interface ReviewLog {
  id: string
  staffName: string
  staffAvatar: string
  branch: string
  note: string
  loggedAt: string
}

const TODAY_KEY = () => `gr_logs_${new Date().toDateString()}`
const URL_KEY   = 'google_review_url'

function loadTodayLogs(): ReviewLog[] {
  try { return JSON.parse(localStorage.getItem(TODAY_KEY()) ?? '[]') } catch { return [] }
}

function loadWeekCount(): number {
  let total = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    try {
      const logs = JSON.parse(localStorage.getItem(`gr_logs_${d.toDateString()}`) ?? '[]') as ReviewLog[]
      total += logs.length
    } catch { /* skip */ }
  }
  return total
}

export default function GoogleReviewPage() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const isOwner = state.user?.role === 'owner'

  const [logs, setLogs]           = useState<ReviewLog[]>(loadTodayLogs)
  const [note, setNote]           = useState('')
  const [reviewUrl, setReviewUrl] = useState(localStorage.getItem(URL_KEY) ?? '')
  const [editUrl, setEditUrl]     = useState(localStorage.getItem(URL_KEY) ?? '')
  const [showUrlForm, setShowUrl] = useState(false)
  const [flash, setFlash]         = useState('')
  const [photo, setPhoto]         = useState<{ blob: Blob; preview: string } | null>(null)
  const [sharing, setSharing]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const weekCount = loadWeekCount()

  useEffect(() => {
    localStorage.setItem(TODAY_KEY(), JSON.stringify(logs))
  }, [logs])

  // Clean up object URL on unmount or photo change
  useEffect(() => {
    return () => { if (photo) URL.revokeObjectURL(photo.preview) }
  }, [photo])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photo) URL.revokeObjectURL(photo.preview)
    setPhoto({ blob: file, preview: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  const handleShareAndOpen = async () => {
    if (!photo) { showFlash(s.gr_no_photo); return }
    setSharing(true)
    try {
      const file = new File([photo.blob], `review-${Date.now()}.jpg`, { type: photo.blob.type || 'image/jpeg' })

      // Try Web Share API with file (supported on iOS Safari 15+, Android Chrome)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Google Review' })
      } else {
        // Fallback: download image to device
        const a = document.createElement('a')
        a.href = photo.preview
        a.download = file.name
        a.click()
        showFlash(s.gr_share_fallback)
      }

      // Open review link after sharing
      if (reviewUrl) {
        setTimeout(() => window.open(reviewUrl, '_blank', 'noopener,noreferrer'), 500)
      } else {
        showFlash(s.gr_no_url)
      }

      // Auto-log the review
      const entry: ReviewLog = {
        id: `gr_${Date.now()}`,
        staffName:   state.user?.name ?? '',
        staffAvatar: state.user?.avatar ?? '👤',
        branch:      state.user?.branch ?? '',
        note:        note.trim(),
        loggedAt:    new Date().toISOString(),
      }
      setLogs(prev => [entry, ...prev])
      setNote('')
      setPhoto(null)
    } finally {
      setSharing(false)
    }
  }

  const logReview = () => {
    const entry: ReviewLog = {
      id: `gr_${Date.now()}`,
      staffName:   state.user?.name ?? '',
      staffAvatar: state.user?.avatar ?? '👤',
      branch:      state.user?.branch ?? '',
      note:        note.trim(),
      loggedAt:    new Date().toISOString(),
    }
    setLogs(prev => [entry, ...prev])
    setNote('')
    showFlash(s.gr_logged)
  }

  const saveUrl = () => {
    localStorage.setItem(URL_KEY, editUrl.trim())
    setReviewUrl(editUrl.trim())
    setShowUrl(false)
    showFlash(s.gr_url_saved)
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">⭐ {s.google_review}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{state.user?.branch}</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowUrl(v => !v)} className="text-xs text-brand-600 hover:underline">
            🔗 {s.gr_url_set}
          </button>
        )}
      </div>

      {/* Owner: set URL */}
      {showUrlForm && isOwner && (
        <Card>
          <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.gr_url_label}</label>
          <input
            value={editUrl}
            onChange={e => setEditUrl(e.target.value)}
            placeholder={s.gr_url_ph}
            className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
          />
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowUrl(false)}>{s.cancel}</Button>
            <Button className="flex-1" onClick={saveUrl}>{s.save}</Button>
          </div>
        </Card>
      )}

      {/* Flash */}
      {flash && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          ✅ {flash}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-amber-500">{logs.length}</div>
          <div className="text-xs text-[var(--text-soft)] mt-1">{s.gr_today_count}</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-brand-600">{weekCount}</div>
          <div className="text-xs text-[var(--text-soft)] mt-1">{s.gr_total_week}</div>
        </div>
      </div>

      {/* Photo + Review section */}
      <Card>
        <h3 className="font-bold text-sm text-[var(--text)] mb-3">📷 {s.gr_take_photo}</h3>

        {/* Hidden file input — camera on mobile */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Photo preview or take button */}
        {photo ? (
          <div className="relative mb-3">
            <img src={photo.preview} alt="" className="w-full rounded-xl object-cover max-h-64" />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full hover:bg-black/80"
            >
              {s.gr_retake}
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-36 rounded-xl border-2 border-dashed border-[var(--border-2)] flex flex-col items-center justify-center gap-2 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors mb-3"
          >
            <span className="text-4xl">📷</span>
            <span className="text-sm text-[var(--text-muted)]">{s.gr_take_photo}</span>
          </button>
        )}

        {/* Optional note */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={s.gr_note_ph}
          rows={2}
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors resize-none mb-3"
        />

        {/* Main CTA */}
        <Button
          className="w-full"
          loading={sharing}
          disabled={!photo}
          onClick={handleShareAndOpen}
        >
          {s.gr_send_review}
        </Button>

        {photo && (
          <p className="text-xs text-[var(--text-muted)] mt-2 text-center">💡 {s.gr_photo_tip}</p>
        )}

        {/* Log without photo */}
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <button
            onClick={logReview}
            className="w-full text-sm text-[var(--text-soft)] hover:text-[var(--text)] py-1.5 transition-colors"
          >
            {s.gr_log_btn}
          </button>
        </div>
      </Card>

      {/* Today's log */}
      <Card padding="none">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-bold text-sm text-[var(--text)]">{s.gr_today_log}</h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            <div className="text-3xl mb-2">⭐</div>
            {s.gr_no_log}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {logs.map(log => {
              const t = new Date(log.loggedAt)
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <Avatar emoji={log.staffAvatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text)]">{log.staffName}</div>
                    {log.note && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{log.note}</p>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                    {t.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
