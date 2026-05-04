import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import Avatar from '../components/ui/Avatar'

interface ReviewLog {
  id: string
  staffName: string
  staffAvatar: string
  branch: string
  loggedAt: string
}

const TODAY_KEY   = () => `gr_logs_${new Date().toDateString()}`
const URL_KEY     = 'google_review_url'
const TARGET_KEY  = 'gr_target'

export function loadTodayReviews(): ReviewLog[] {
  try { return JSON.parse(localStorage.getItem(TODAY_KEY()) ?? '[]') } catch { return [] }
}
export function getReviewTarget(): number {
  return parseInt(localStorage.getItem(TARGET_KEY) ?? '5', 10)
}

export default function GoogleReviewPage() {
  const { state } = useApp()
  const lang  = state.lang
  const s     = STRINGS[lang]
  const isOwner = state.user?.role === 'owner'

  const [logs, setLogs]           = useState<ReviewLog[]>(loadTodayReviews)
  const [target, setTarget]       = useState(getReviewTarget)
  const [reviewUrl, setReviewUrl] = useState(localStorage.getItem(URL_KEY) ?? '')
  const [editUrl, setEditUrl]     = useState(localStorage.getItem(URL_KEY) ?? '')
  const [editTarget, setEditTarget] = useState(String(getReviewTarget()))
  const [showSettings, setShowSettings] = useState(false)
  const [flash, setFlash]         = useState('')
  const [showQr, setShowQr]       = useState(false)
  const [pop, setPop]             = useState(false)

  const count     = logs.length
  const pct       = Math.min(100, Math.round((count / target) * 100))
  const completed = count >= target

  useEffect(() => {
    localStorage.setItem(TODAY_KEY(), JSON.stringify(logs))
  }, [logs])

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  const logReview = () => {
    if (completed) return
    const entry: ReviewLog = {
      id: `gr_${Date.now()}`,
      staffName:   state.user?.name ?? '',
      staffAvatar: state.user?.avatar ?? '👤',
      branch:      state.user?.branch ?? '',
      loggedAt:    new Date().toISOString(),
    }
    setLogs(prev => [entry, ...prev])
    setPop(true); setTimeout(() => setPop(false), 600)
    if (count + 1 >= target) showFlash(lang === 'bm' ? '🎉 Sasaran tercapai! Tugasan selesai!' : '🎉 Target reached! Task complete!')
  }

  const sendWhatsApp = () => {
    if (!reviewUrl) { showFlash(s.gr_no_url); return }
    const msg = lang === 'bm'
      ? `Terima kasih kerana melawati kedai kami! 😊 Boleh tinggalkan ulasan Google? ⭐\n\n${reviewUrl}`
      : `Thank you for visiting us! 😊 Mind leaving us a Google review? ⭐\n\n${reviewUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  const openLink = () => {
    if (!reviewUrl) { showFlash(s.gr_no_url); return }
    window.open(reviewUrl, '_blank', 'noopener,noreferrer')
  }

  const saveSettings = () => {
    const t = Math.max(1, parseInt(editTarget) || 5)
    localStorage.setItem(TARGET_KEY, String(t))
    localStorage.setItem(URL_KEY, editUrl.trim())
    setTarget(t)
    setReviewUrl(editUrl.trim())
    setShowSettings(false)
    showFlash(s.gr_url_saved)
  }

  const qrSrc = reviewUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(reviewUrl)}`
    : null

  return (
    <div className="space-y-5 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">⭐ {s.google_review}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{state.user?.branch}</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowSettings(v => !v)} className="text-xs text-brand-600 hover:underline">
            ⚙️ {lang === 'bm' ? 'Tetapan' : 'Settings'}
          </button>
        )}
      </div>

      {/* Owner settings */}
      {showSettings && isOwner && (
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">⚙️ {lang === 'bm' ? 'Tetapan Review' : 'Review Settings'}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.gr_url_label}</label>
              <input
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                placeholder={s.gr_url_ph}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {lang === 'bm' ? 'Dari Google Business Profile → "Dapatkan lebih banyak ulasan"' : 'From Google Business Profile → "Get more reviews"'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">
                {lang === 'bm' ? 'Sasaran harian' : 'Daily target'}
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={editTarget}
                onChange={e => setEditTarget(e.target.value)}
                className="w-24 bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-brand-400 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setShowSettings(false)}>{s.cancel}</Button>
            <Button className="flex-1" onClick={saveSettings}>{s.save}</Button>
          </div>
        </Card>
      )}

      {/* Flash */}
      {flash && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          {flash}
        </div>
      )}

      {/* Task progress card */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[var(--text)]">
            {lang === 'bm' ? 'Sasaran Review Hari Ini' : "Today's Review Target"}
          </span>
          {completed ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              ✓ {lang === 'bm' ? 'Selesai!' : 'Done!'}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">{count}/{target}</span>
          )}
        </div>
        <ProgressBar value={pct} color={completed ? '#10b981' : '#f59e0b'} height="lg" />

        {/* Big tap button */}
        <div className="flex flex-col items-center mt-5 mb-2">
          <button
            onClick={logReview}
            disabled={completed}
            className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-lg ${
              completed
                ? 'bg-emerald-100 dark:bg-emerald-900/30 cursor-default'
                : `bg-amber-400 hover:bg-amber-500 ${pop ? 'scale-110' : ''}`
            }`}
          >
            <span className="text-4xl">{completed ? '✅' : '⭐'}</span>
            <span className="text-xs font-bold text-white">
              {completed
                ? (lang === 'bm' ? 'Siap!' : 'Done!')
                : (lang === 'bm' ? 'Dapat Review' : 'Got Review')}
            </span>
          </button>
          {!completed && (
            <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
              {lang === 'bm' ? `Lagi ${target - count} review untuk selesai` : `${target - count} more to complete`}
            </p>
          )}
        </div>
      </Card>

      {/* Customer actions */}
      {reviewUrl && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-1">
            {lang === 'bm' ? 'Cara minta review dari pelanggan' : 'How to ask customer for review'}
          </p>

          <button
            onClick={() => setShowQr(v => !v)}
            className="w-full py-3.5 rounded-xl bg-[var(--surface)] border-2 border-brand-400 text-brand-600 font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="text-lg">📲</span>
            <span>{lang === 'bm' ? 'Tunjuk QR Code' : 'Show QR Code'}</span>
          </button>

          {showQr && qrSrc && (
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 border border-[var(--border)]">
              <p className="text-sm font-semibold text-gray-700 text-center">
                {lang === 'bm' ? 'Imbas untuk tinggalkan ulasan Google ⭐' : 'Scan to leave a Google review ⭐'}
              </p>
              <img src={qrSrc} alt="QR" className="w-52 h-52" />
              <p className="text-xs text-gray-400">{lang === 'bm' ? 'Buka kamera → imbas → tulis ulasan' : 'Open camera → scan → write review'}</p>
            </div>
          )}

          <button
            onClick={sendWhatsApp}
            className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] active:scale-95 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <span className="text-lg">💬</span>
            <span>{lang === 'bm' ? 'Hantar via WhatsApp' : 'Send via WhatsApp'}</span>
          </button>

          <button
            onClick={openLink}
            className="w-full py-3 rounded-xl bg-[var(--surface-2)] text-[var(--text-soft)] text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            🔗 {lang === 'bm' ? 'Buka Link Review' : 'Open Review Link'}
          </button>
        </div>
      )}

      {!reviewUrl && isOwner && (
        <div className="text-center py-4 text-sm text-[var(--text-muted)]">
          ⚠️ {lang === 'bm' ? 'Tetapkan link review dahulu (⚙️ di atas)' : 'Set review link first (⚙️ above)'}
        </div>
      )}

      {/* Today's log */}
      {logs.length > 0 && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="font-bold text-sm text-[var(--text)]">{s.gr_today_log}</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {logs.map((log, i) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-amber-400 font-bold text-sm w-5 text-center">{i + 1}</span>
                <Avatar emoji={log.staffAvatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text)]">{log.staffName}</div>
                </div>
                <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                  {new Date(log.loggedAt).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
