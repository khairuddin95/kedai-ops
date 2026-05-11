import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import Avatar from '../components/ui/Avatar'
import { supabase, supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'
import type { GoogleReviewLog } from '../types'

const URL_KEY    = 'google_review_url'
const TARGET_KEY = 'gr_target'

export function getReviewTarget(): number {
  return parseInt(localStorage.getItem(TARGET_KEY) ?? '5', 10)
}

function timeAgo(d: Date, lang: 'bm' | 'en'): string {
  const diff = (Date.now() - d.getTime()) / 60000
  if (diff < 1) return lang === 'bm' ? 'baru sahaja' : 'just now'
  if (diff < 60) return `${Math.floor(diff)} ${lang === 'bm' ? 'min lalu' : 'min ago'}`
  if (diff < 1440) return `${Math.floor(diff / 60)} ${lang === 'bm' ? 'jam lalu' : 'hr ago'}`
  return `${Math.floor(diff / 1440)} ${lang === 'bm' ? 'hari lalu' : 'day(s) ago'}`
}

// ─── Staff view ───────────────────────────────────────────────
function StaffView() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]

  const [logs, setLogs]         = useState<GoogleReviewLog[]>([])
  const target                  = getReviewTarget()
  const reviewUrl               = localStorage.getItem(URL_KEY) ?? ''
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash]       = useState('')
  const [showQr, setShowQr]     = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!supabaseConfigured) return
    db.fetchGoogleReviewLogs(1, state.user?.branch).then(data => {
      if (!data) return
      // Staff sees only their own today's logs
      const mine = data.filter(l => l.staffId === state.user?.id)
      setLogs(mine)
    })
  }, [state.user?.id, state.user?.branch])

  // Real-time: own submissions today
  useEffect(() => {
    if (!supabase || !supabaseConfigured) return
    const ch = supabase.channel('gr-staff')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'google_review_logs' }, payload => {
        const row = payload.new as Record<string, unknown>
        if (row.staff_id !== state.user?.id) return
        db.fetchGoogleReviewLogs(1, state.user?.branch).then(data => {
          if (!data) return
          setLogs(data.filter(l => l.staffId === state.user?.id))
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'google_review_logs' }, payload => {
        const row = payload.new as Record<string, unknown>
        if (row.staff_id !== state.user?.id) return
        db.fetchGoogleReviewLogs(1, state.user?.branch).then(data => {
          if (!data) return
          setLogs(data.filter(l => l.staffId === state.user?.id))
        })
      })
      .subscribe()
    return () => { supabase?.removeChannel(ch) }
  }, [state.user?.id, state.user?.branch])

  const approvedToday = logs.filter(l => l.status === 'approved').length
  const count = logs.length
  const pct = Math.min(100, Math.round((approvedToday / target) * 100))
  const completed = approvedToday >= target

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || completed || submitting) return
    setSubmitting(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const photo = reader.result as string
      const inserted = await db.insertGoogleReviewLog({
        staffId:     state.user?.id ?? '',
        staffName:   state.user?.name ?? '',
        staffAvatar: state.user?.avatar ?? '👤',
        branch:      state.user?.branch ?? '',
        photoUrl:    photo,
      })
      if (inserted) {
        setLogs(prev => [inserted, ...prev])
        showFlash(s.gr_target_reached && approvedToday + 1 >= target ? s.gr_target_reached : s.saved ?? '✓ Berjaya!')
      } else {
        showFlash('❌ Gagal simpan. Cuba lagi.')
      }
      setSubmitting(false)
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

  const qrSrc = reviewUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(reviewUrl)}`
    : null

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-xl font-bold text-[var(--text)]">⭐ {s.google_review}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{state.user?.branch}</p>
      </div>

      {flash && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          {flash}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[var(--text)]">{s.gr_target_today}</span>
          {completed ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              ✓ {s.gr_completed_badge}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">{approvedToday}/{target} {s.gr_approved ?? 'diluluskan'}</span>
          )}
        </div>
        <ProgressBar value={pct} color={completed ? '#10b981' : '#f59e0b'} height="lg" />

        <div className="flex flex-col items-center mt-5 mb-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          <button
            onClick={() => !completed && !submitting && fileRef.current?.click()}
            disabled={completed || submitting}
            className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-lg ${
              completed
                ? 'bg-emerald-100 dark:bg-emerald-900/30 cursor-default'
                : submitting
                  ? 'bg-gray-200 dark:bg-gray-700 cursor-wait'
                  : 'bg-amber-400 hover:bg-amber-500'
            }`}
          >
            <span className="text-4xl">{completed ? '✅' : submitting ? '⏳' : '📷'}</span>
            <span className="text-xs font-bold text-white">
              {completed ? s.gr_done_btn : submitting ? '...' : s.gr_take_photo_btn}
            </span>
          </button>
          {!completed && count > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 text-center">
              {count} {lang === 'bm' ? 'foto dihantar, menunggu kelulusan' : 'photo(s) submitted, pending approval'}
            </p>
          )}
          {!completed && count === 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
              {s.gr_remaining_prefix && `${s.gr_remaining_prefix} `}{target - approvedToday} {s.gr_remaining_suffix}
            </p>
          )}
        </div>
      </Card>

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

      {logs.length > 0 && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="font-bold text-sm text-[var(--text)]">{s.gr_today_log}</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {logs.map((log, i) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-amber-400 font-bold text-sm w-5 text-center flex-shrink-0">{i + 1}</span>
                <button onClick={() => setLightbox(log.photoUrl)} className="flex-shrink-0">
                  <img src={log.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-[var(--border)]" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Avatar emoji={log.staffAvatar} size="sm" />
                    <div className="text-sm font-medium text-[var(--text)] truncate">{log.staffName}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    log.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                    log.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                    'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                  }`}>
                    {log.status === 'approved' ? s.gr_approved ?? '✓' : log.status === 'rejected' ? s.gr_rejected ?? '✗' : s.gr_pending ?? '⏳'}
                  </span>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {new Date(log.loggedAt).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center bg-black/40 rounded-full">×</button>
        </div>
      )}
    </div>
  )
}

// ─── Supervisor / Owner view ──────────────────────────────────
type TabKey = 'pending' | 'approved' | 'rejected'

function SupervisorView() {
  const { state } = useApp()
  const lang = state.lang
  const s = STRINGS[lang]
  const isOwner = state.user?.role === 'owner'

  const [logs, setLogs]           = useState<GoogleReviewLog[]>([])
  const [tab, setTab]             = useState<TabKey>('pending')
  const [loading, setLoading]     = useState(true)
  const [noteMap, setNoteMap]     = useState<Record<string, string>>({})
  const [reviewUrl, setReviewUrl] = useState(localStorage.getItem(URL_KEY) ?? '')
  const [editUrl, setEditUrl]     = useState(localStorage.getItem(URL_KEY) ?? '')
  const [editTarget, setEditTarget] = useState(String(getReviewTarget()))
  const [showSettings, setShowSettings] = useState(false)
  const [flash, setFlash]         = useState('')
  const [lightbox, setLightbox]   = useState<string | null>(null)

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  const load = async () => {
    setLoading(true)
    const data = await db.fetchGoogleReviewLogs(7)
    setLogs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return }
    load()
  }, [])

  // Real-time updates for supervisor/owner
  useEffect(() => {
    if (!supabase || !supabaseConfigured) return
    const ch = supabase.channel('gr-supervisor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'google_review_logs' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'google_review_logs' }, () => load())
      .subscribe()
    return () => { supabase?.removeChannel(ch) }
  }, [])

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    const note = noteMap[id]?.trim() || undefined
    const ok = await db.reviewGoogleLog(id, status, state.user?.name ?? '', note)
    if (ok) {
      setLogs(prev => prev.map(l => l.id === id ? {
        ...l, status, reviewedByName: state.user?.name, supervisorNote: note, reviewedAt: new Date(),
      } : l))
      setNoteMap(prev => { const n = { ...prev }; delete n[id]; return n })
    } else {
      showFlash('❌ Gagal kemaskini. Cuba lagi.')
    }
  }

  const saveSettings = () => {
    const t = Math.max(1, parseInt(editTarget) || 5)
    localStorage.setItem(TARGET_KEY, String(t))
    localStorage.setItem(URL_KEY, editUrl.trim())
    setReviewUrl(editUrl.trim())
    setShowSettings(false)
    showFlash(s.gr_url_saved)
  }

  const filtered = logs.filter(l => l.status === tab)
  const pendingCount = logs.filter(l => l.status === 'pending').length

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'pending',  label: `${s.gr_pending ?? 'Pending'} ${pendingCount > 0 ? `(${pendingCount})` : ''}` },
    { key: 'approved', label: s.gr_approved ?? 'Approved' },
    { key: 'rejected', label: s.gr_rejected ?? 'Rejected' },
  ]

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">⭐ {s.google_review}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{lang === 'bm' ? 'Semakan bukti staff' : 'Staff evidence review'}</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowSettings(v => !v)} className="text-xs text-brand-600 hover:underline">
            ⚙️ {s.gr_settings}
          </button>
        )}
      </div>

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
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.gr_daily_target}</label>
              <input
                type="number" min="1" max="50"
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

      {flash && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3">
          {flash}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">{s.loading}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">
            {tab === 'pending' ? '📭' : tab === 'approved' ? '✅' : '❌'}
          </div>
          <p className="text-sm text-[var(--text-muted)]">{s.gr_no_pending ?? 'Tiada rekod'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(log => (
            <Card key={log.id} padding="none">
              <div className="flex items-start gap-3 p-4">
                <button onClick={() => setLightbox(log.photoUrl)} className="flex-shrink-0">
                  <img src={log.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-[var(--border)]" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar emoji={log.staffAvatar} size="sm" />
                    <span className="font-semibold text-sm text-[var(--text)] truncate">{log.staffName}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">📍 {log.branch}</div>
                  <div className="text-xs text-[var(--text-muted)]">{timeAgo(new Date(log.loggedAt), lang)}</div>
                  {log.supervisorNote && (
                    <div className="mt-1 text-xs text-[var(--text-soft)] italic">"{log.supervisorNote}"</div>
                  )}
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                  log.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                  log.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                  'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                }`}>
                  {log.status === 'approved' ? s.gr_approved ?? '✓' :
                   log.status === 'rejected' ? s.gr_rejected ?? '✗' :
                   s.gr_pending ?? '⏳'}
                </span>
              </div>

              {log.status === 'pending' && (
                <div className="px-4 pb-4 space-y-2">
                  <input
                    value={noteMap[log.id] ?? ''}
                    onChange={e => setNoteMap(prev => ({ ...prev, [log.id]: e.target.value }))}
                    placeholder={s.gr_add_note ?? 'Tambah nota (pilihan)...'}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(log.id, 'rejected')}
                      className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors active:scale-95"
                    >
                      ✗ {s.gr_reject ?? 'Tolak'}
                    </button>
                    <button
                      onClick={() => handleReview(log.id, 'approved')}
                      className="flex-1 py-2 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors active:scale-95"
                    >
                      ✓ {s.gr_approve ?? 'Lulus'}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {!reviewUrl && isOwner && (
        <div className="text-center py-4 text-sm text-[var(--text-muted)]">
          ⚠️ {s.gr_set_link_hint}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center bg-black/40 rounded-full">×</button>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────
export default function GoogleReviewPage() {
  const { state } = useApp()
  if (state.user?.role === 'staff') return <StaffView />
  return <SupervisorView />
}
