import { useState, useEffect, useRef } from 'react'
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
  photo: string   // base64 data URL
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

  const [logs, setLogs]             = useState<ReviewLog[]>(loadTodayReviews)
  const [target, setTarget]         = useState(getReviewTarget)
  const [reviewUrl, setReviewUrl]   = useState(localStorage.getItem(URL_KEY) ?? '')
  const [editUrl, setEditUrl]       = useState(localStorage.getItem(URL_KEY) ?? '')
  const [editTarget, setEditTarget] = useState(String(getReviewTarget()))
  const [showSettings, setShowSettings] = useState(false)
  const [flash, setFlash]           = useState('')
  const [showQr, setShowQr]         = useState(false)
  const [lightbox, setLightbox]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const count     = logs.length
  const pct       = Math.min(100, Math.round((count / target) * 100))
  const completed = count >= target

  useEffect(() => {
    localStorage.setItem(TODAY_KEY(), JSON.stringify(logs))
  }, [logs])

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || completed) return
    const reader = new FileReader()
    reader.onload = () => {
      const photo = reader.result as string
      const entry: ReviewLog = {
        id: `gr_${Date.now()}`,
        staffName:   state.user?.name ?? '',
        staffAvatar: state.user?.avatar ?? '👤',
        branch:      state.user?.branch ?? '',
        photo,
        loggedAt:    new Date().toISOString(),
      }
      setLogs(prev => [entry, ...prev])
      if (count + 1 >= target) showFlash(s.gr_target_reached)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const sendWhatsApp = () => {
    if (!reviewUrl) { showFlash(s.gr_no_url); return }
    const msg = lang === 'bm'
      ? `Terima kasih kerana melawati kedai kami! 😊 Boleh tinggalkan ulasan Google? ⭐\n\n${reviewUrl}`
      : `Thank you for visiting! 😊 Mind leaving us a Google review? ⭐\n\n${reviewUrl}`
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
            ⚙️ {s.gr_settings}
          </button>
        )}
      </div>

      {/* Owner settings */}
      {showSettings && isOwner && (
        <Card>
          <h3 className="font-bold text-sm text-[var(--text)] mb-3">⚙️ {s.gr_settings_title}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.gr_url_label}</label>
              <input
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                placeholder={s.gr_url_ph}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">{s.gr_business_hint}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.gr_daily_target}</label>
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
          <span className="text-sm font-semibold text-[var(--text)]">{s.gr_target_today}</span>
          {completed ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              ✓ {s.gr_completed_badge}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">{count}/{target}</span>
          )}
        </div>
        <ProgressBar value={pct} color={completed ? '#10b981' : '#f59e0b'} height="lg" />

        {/* Camera button */}
        <div className="flex flex-col items-center mt-5 mb-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhoto}
          />
          <button
            onClick={() => !completed && fileRef.current?.click()}
            disabled={completed}
            className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-lg ${
              completed
                ? 'bg-emerald-100 dark:bg-emerald-900/30 cursor-default'
                : 'bg-amber-400 hover:bg-amber-500'
            }`}
          >
            <span className="text-4xl">{completed ? '✅' : '📷'}</span>
            <span className="text-xs font-bold text-white">
              {completed ? s.gr_done_btn : s.gr_take_photo_btn}
            </span>
          </button>
          {!completed && (
            <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
              {s.gr_remaining_prefix && `${s.gr_remaining_prefix} `}{target - count} {s.gr_remaining_suffix}
            </p>
          )}
        </div>
      </Card>

      {/* Customer actions */}
      {reviewUrl && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-1">{s.gr_how_to_ask}</p>

          <button
            onClick={() => setShowQr(v => !v)}
            className="w-full py-3.5 rounded-xl bg-[var(--surface)] border-2 border-brand-400 text-brand-600 font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="text-lg">📲</span>
            <span>{s.gr_show_qr}</span>
          </button>

          {showQr && qrSrc && (
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 border border-[var(--border)]">
              <p className="text-sm font-semibold text-gray-700 text-center">{s.gr_scan_prompt}</p>
              <img src={qrSrc} alt="QR" className="w-52 h-52" />
              <p className="text-xs text-gray-400">{s.gr_scan_hint}</p>
            </div>
          )}

          <button
            onClick={sendWhatsApp}
            className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] active:scale-95 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <span className="text-lg">💬</span>
            <span>{s.gr_send_whatsapp}</span>
          </button>

          <button
            onClick={openLink}
            className="w-full py-3 rounded-xl bg-[var(--surface-2)] text-[var(--text-soft)] text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            🔗 {s.gr_open_link}
          </button>
        </div>
      )}

      {!reviewUrl && isOwner && (
        <div className="text-center py-4 text-sm text-[var(--text-muted)]">
          ⚠️ {s.gr_set_link_hint}
        </div>
      )}

      {/* Today's log */}
      {logs.length > 0 && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--text)]">{s.gr_today_log}</h3>
            <button
              onClick={() => { if (confirm(s.gr_delete_all_confirm)) setLogs([]) }}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              {s.gr_delete_all}
            </button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {logs.map((log, i) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-amber-400 font-bold text-sm w-5 text-center flex-shrink-0">{i + 1}</span>
                <button onClick={() => setLightbox(log.photo)} className="flex-shrink-0">
                  <img src={log.photo} alt="" className="w-12 h-12 rounded-lg object-cover border border-[var(--border)]" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Avatar emoji={log.staffAvatar} size="sm" />
                    <div className="text-sm font-medium text-[var(--text)] truncate">{log.staffName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(log.loggedAt).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => setLogs(prev => prev.filter(l => l.id !== log.id))}
                    className="text-[var(--text-muted)] hover:text-red-500 transition-colors text-sm p-1"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
