import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { STRINGS } from '../utils/i18n'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import {
  notifSupported, getPermission, requestPermission,
  getEnabled, setEnabled, sendNotification, type NotifPermission,
} from '../lib/notifications'
import * as db from '../lib/db'
import { supabaseConfigured } from '../lib/supabase'

const AVATARS = ['🧑‍🍳','👩‍🍳','👨‍🍳','🧑‍💼','👨‍💼','👩‍💼','🧑','👩','👦','👧','🙂','😊','🤩','😎','🥸','🤓']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">{title}</h3>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const lang = state.lang
  const s = STRINGS[lang]
  const user = state.user!

  // ── Avatar ────────────────────────────────────────────────
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')

  const handleSaveAvatar = async () => {
    if (selectedAvatar === user.avatar) return
    setSavingAvatar(true)
    let ok = true
    if (supabaseConfigured) {
      ok = await db.updateUser(user.id, {
        name: user.name, role: user.role, branch: user.branch, avatar: selectedAvatar,
      })
    }
    if (ok) {
      dispatch({ type: 'UPDATE_USER', updates: { avatar: selectedAvatar } })
      setAvatarMsg(s.set_avatar_saved)
      setTimeout(() => setAvatarMsg(''), 2500)
    }
    setSavingAvatar(false)
  }

  // ── PIN ───────────────────────────────────────────────────
  const [pinSet, setPinSet] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [pinMsg, setPinMsg] = useState('')
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    if (supabaseConfigured) {
      db.getUserPinStatus(user.id).then(setPinSet)
    }
  }, [user.id])

  const handleSavePin = async () => {
    setPinError('')
    setPinMsg('')
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { setPinError(s.set_pin_short); return }
    if (newPin !== confirmPin) { setPinError(s.set_pin_mismatch); return }

    setSavingPin(true)
    if (pinSet) {
      const verified = await db.verifyPin(user.username, currentPin)
      if (!verified) { setPinError(s.set_pin_wrong); setSavingPin(false); return }
    }
    const result = await db.setUserPin(user.username, newPin)
    setSavingPin(false)
    if (result) {
      setPinSet(true)
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
      setPinMsg(s.set_pin_saved)
      setTimeout(() => setPinMsg(''), 2500)
    } else {
      setPinError(s.pin_save_failed)
    }
  }

  // ── Notifications ─────────────────────────────────────────
  const [permission, setPermission] = useState<NotifPermission>(() => getPermission())
  const [notifOn, setNotifOn] = useState(() => getEnabled())

  const handleNotif = async () => {
    if (permission === 'denied') return
    if (permission === 'default') {
      const result = await requestPermission()
      setPermission(result)
      if (result === 'granted') {
        setEnabled(true); setNotifOn(true)
        sendNotification(s.notif_test_title, s.notif_test_body, 'test_settings')
      }
      return
    }
    const next = !notifOn
    setEnabled(next); setNotifOn(next)
    if (next) sendNotification(s.notif_test_title, s.notif_test_body, 'test_settings')
  }

  // ── Logout ────────────────────────────────────────────────
  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' })
    navigate('/login')
  }

  const roleLabel = user.role === 'owner' ? s.role_owner : user.role === 'supervisor' ? s.role_supervisor : s.role_staff

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-10">
      <h2 className="text-xl font-bold text-[var(--text)]">⚙️ {s.settings}</h2>

      {/* ── Profile ── */}
      <Section title={s.set_profile}>
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <Avatar emoji={selectedAvatar} size="lg" name={user.name} />
            <div>
              <div className="font-bold text-[var(--text)]">{user.name}</div>
              <div className="text-xs text-[var(--text-muted)]">@{user.username}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 rounded-full text-[var(--text-muted)] capitalize">{roleLabel}</span>
                <span className="text-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 rounded-full text-[var(--text-muted)]">📍 {user.branch}</span>
              </div>
            </div>
          </div>

          <p className="text-xs font-medium text-[var(--text-soft)] mb-2">{s.set_avatar}</p>
          <div className="grid grid-cols-8 gap-1.5 mb-3">
            {AVATARS.map(emoji => (
              <button
                key={emoji}
                onClick={() => setSelectedAvatar(emoji)}
                className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  selectedAvatar === emoji
                    ? 'bg-brand-100 dark:bg-brand-900/40 ring-2 ring-brand-500 scale-110'
                    : 'hover:bg-[var(--surface-2)]'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
          {avatarMsg && <p className="text-xs text-emerald-600 mb-2">{avatarMsg}</p>}
          <Button
            className="w-full"
            disabled={selectedAvatar === user.avatar || savingAvatar}
            loading={savingAvatar}
            onClick={handleSaveAvatar}
          >
            {s.save}
          </Button>
        </Card>
      </Section>

      {/* ── Security ── */}
      <Section title={s.set_security}>
        <Card>
          <h4 className="text-sm font-bold text-[var(--text)] mb-3">🔐 {s.set_change_pin}</h4>
          {!pinSet && (
            <p className="text-xs text-[var(--text-muted)] mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              ⚠️ {s.set_no_pin}
            </p>
          )}
          <div className="space-y-3">
            {pinSet && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.set_current_pin}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPin}
                  onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 tracking-widest"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.set_new_pin}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 tracking-widest"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.set_confirm_pin}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 tracking-widest"
              />
            </div>
          </div>
          {pinError && <p className="text-xs text-red-500 mt-2">{pinError}</p>}
          {pinMsg   && <p className="text-xs text-emerald-600 mt-2">{pinMsg}</p>}
          <Button
            className="w-full mt-3"
            loading={savingPin}
            disabled={!newPin || !confirmPin || (pinSet && !currentPin)}
            onClick={handleSavePin}
          >
            {s.save} PIN
          </Button>
        </Card>
      </Section>

      {/* ── Appearance ── */}
      <Section title={s.set_appearance}>
        <Card>
          <div className="space-y-1">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_DARK' })}
              className="w-full flex items-center justify-between px-1 py-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{state.dark ? '☀️' : '🌙'}</span>
                <span className="text-sm font-medium text-[var(--text)]">{s.dark_mode}</span>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${state.dark ? 'bg-brand-600' : 'bg-[var(--border-2)]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${state.dark ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            <button
              onClick={() => dispatch({ type: 'SET_LANG', lang: lang === 'bm' ? 'en' : 'bm' })}
              className="w-full flex items-center justify-between px-1 py-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🌐</span>
                <span className="text-sm font-medium text-[var(--text)]">{s.language}</span>
              </div>
              <span className="text-sm font-bold text-brand-600">{lang === 'bm' ? 'BM' : 'EN'}</span>
            </button>
          </div>
        </Card>
      </Section>

      {/* ── Notifications ── */}
      {notifSupported() && (
        <Section title={s.set_notif}>
          <Card>
            <button
              onClick={handleNotif}
              disabled={permission === 'denied'}
              className="w-full flex items-center justify-between px-1 py-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{notifOn && permission === 'granted' ? '🔔' : '🔕'}</span>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--text)]">{s.set_notif}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {permission === 'denied' ? s.notif_blocked :
                     notifOn ? s.notif_enabled : s.notif_disabled}
                  </div>
                </div>
              </div>
              {permission !== 'denied' && (
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${notifOn && permission === 'granted' ? 'bg-brand-600' : 'bg-[var(--border-2)]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${notifOn && permission === 'granted' ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              )}
            </button>
          </Card>
        </Section>
      )}

      {/* ── Account ── */}
      <Section title={s.set_account}>
        <Card>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-1 py-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <span className="text-xl">⏻</span>
            <span className="text-sm font-semibold">{s.set_logout}</span>
          </button>
        </Card>
      </Section>
    </div>
  )
}
