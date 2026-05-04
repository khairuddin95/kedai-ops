import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { SHIFTS } from '../data/mockData'
import { STRINGS } from '../utils/i18n'
import { supabaseConfigured } from '../lib/supabase'
import * as db from '../lib/db'
import type { Shift, User } from '../types'
import Button from '../components/ui/Button'

const PIN_LENGTH = 4

// ── PIN dot display ────────────────────────────────────────────
function PinDots({ value }: { value: string }) {
  return (
    <div className="flex gap-4 justify-center my-6">
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            i < value.length
              ? 'bg-brand-600 border-brand-600 scale-110'
              : 'border-[var(--border-2)]'
          }`}
        />
      ))}
    </div>
  )
}

// ── Numpad ─────────────────────────────────────────────────────
function Numpad({ onPress }: { onPress: (key: string) => void }) {
  const keys = ['1','2','3','4','5','6','7','8','9','⌫','0','']
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {keys.map((k, i) => (
        k === '' ? <div key={i} /> :
        <button
          key={k}
          type="button"
          onClick={() => onPress(k)}
          className={`h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
            k === '⌫'
              ? 'text-[var(--text-soft)] bg-[var(--surface-2)] hover:bg-[var(--surface-3,#e5e7eb)]'
              : 'text-[var(--text)] bg-[var(--surface-2)] hover:bg-[var(--surface-3,#e5e7eb)]'
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  )
}

export default function LoginPage() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const s = STRINGS[state.lang]

  // step: 1 = username, 2 = pin, 3 = shift
  const [step, setStep]               = useState<1 | 2 | 3>(1)
  const [username, setUsername]       = useState('')
  const [foundUser, setFoundUser]     = useState<db.UserPreview | null>(null)
  const [verifiedUser, setVerified]   = useState<User | null>(null)
  const [pin, setPin]                 = useState('')
  const [confirmPin, setConfirmPin]   = useState('')
  const [pinSubStep, setPinSubStep]   = useState<'enter' | 'confirm'>('enter')
  const [selectedShift, setShift]     = useState<Shift | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 1) inputRef.current?.focus()
  }, [step])

  // ── Step 1: check username ─────────────────────────────────
  const handleCheckUsername = async () => {
    setError('')
    if (!username.trim()) return
    setLoading(true)
    let preview: db.UserPreview | null = null
    if (supabaseConfigured) {
      preview = await db.checkUsername(username)
    }
    setLoading(false)
    if (!preview) { setError(s.user_not_found); return }
    setFoundUser(preview)
    setPin(''); setConfirmPin(''); setPinSubStep('enter')
    setStep(2)
  }

  // ── Numpad press handler ───────────────────────────────────
  const handleNumpad = (key: string) => {
    setError('')
    const isNew = foundUser && !foundUser.pinSet

    if (isNew) {
      // new user: fill enter then confirm
      if (pinSubStep === 'enter') {
        if (key === '⌫') { setPin(p => p.slice(0, -1)); return }
        if (pin.length >= PIN_LENGTH) return
        const next = pin + key
        setPin(next)
        if (next.length === PIN_LENGTH) setPinSubStep('confirm')
      } else {
        if (key === '⌫') { setConfirmPin(p => p.slice(0, -1)); return }
        if (confirmPin.length >= PIN_LENGTH) return
        const next = confirmPin + key
        setConfirmPin(next)
        if (next.length === PIN_LENGTH) handleSetPin(next)
      }
    } else {
      // existing user
      if (key === '⌫') { setPin(p => p.slice(0, -1)); return }
      if (pin.length >= PIN_LENGTH) return
      const next = pin + key
      setPin(next)
      if (next.length === PIN_LENGTH) handleVerifyPin(next)
    }
  }

  const handleSetPin = async (confirmedPin: string) => {
    if (pin !== confirmedPin) {
      setError(s.pin_mismatch_login)
      setPin(''); setConfirmPin(''); setPinSubStep('enter')
      return
    }
    setLoading(true)
    let user: User | null = null
    if (supabaseConfigured) {
      user = await db.setUserPin(foundUser!.username, pin)
    } else {
      user = { id: foundUser!.id, name: foundUser!.name, role: foundUser!.role as User['role'], branch: foundUser!.branch, avatar: foundUser!.avatar, username: foundUser!.username }
    }
    setLoading(false)
    if (!user) { setError('Gagal menyimpan PIN. Cuba lagi.'); setPin(''); setConfirmPin(''); setPinSubStep('enter'); return }
    setVerified(user)
    await autoLogin(user)
  }

  const handleVerifyPin = async (enteredPin: string) => {
    setLoading(true)
    let user = null
    let lockError = ''
    if (supabaseConfigured) {
      try {
        user = await db.verifyPin(foundUser!.username, enteredPin)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('LOCKED')) lockError = 'Terlalu banyak cubaan. Cuba lagi dalam 10 minit.'
      }
    }
    setLoading(false)
    if (lockError) { setError(lockError); setPin(''); return }
    if (!user) { setError(s.pin_incorrect); setTimeout(() => { setPin(''); setError('') }, 600); return }
    setVerified(user)
    await autoLogin(user)
  }

  // ── Try schedule → defaultShift → manual picker ───────────
  const autoLogin = async (user: User) => {
    // Owner/supervisor: auto-detect by time, skip shift picker
    if (user.role === 'owner' || user.role === 'supervisor') {
      const shiftId = new Date().getHours() < 15 ? 'morning' : 'evening'
      const shift = SHIFTS.find(s => s.id === shiftId)!
      dispatch({ type: 'LOGIN', user, shift })
      navigate('/dashboard')
      return
    }
    // Staff: 1. Check weekly schedule for today
    if (supabaseConfigured) {
      const todayShiftId = await db.getUserTodayShift(user.id)
      if (todayShiftId) {
        const shift = SHIFTS.find(s => s.id === todayShiftId)
        if (shift) { dispatch({ type: 'LOGIN', user, shift }); navigate('/'); return }
      }
    }
    // 2. Fall back to admin-assigned default shift
    if (user.defaultShift) {
      const shift = SHIFTS.find(s => s.id === user.defaultShift)
      if (shift) { dispatch({ type: 'LOGIN', user, shift }); navigate('/'); return }
    }
    // 3. Manual selection
    setStep(3)
  }

  // ── Step 3: start shift ────────────────────────────────────
  const handleStartShift = () => {
    if (!verifiedUser || !selectedShift) return
    dispatch({ type: 'LOGIN', user: verifiedUser, shift: selectedShift })
    navigate(verifiedUser.role === 'staff' ? '/' : '/dashboard')
  }

  const isNew = foundUser && !foundUser.pinSet

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-[#0a0f1c] dark:via-[#111827] dark:to-[#0a0f1c] px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-3xl mx-auto mb-3 shadow-lg">K</div>
        <h1 className="text-2xl font-extrabold text-[var(--text)]">KedaiOps</h1>
        <p className="text-sm text-[var(--text-soft)] mt-1">{s.tagline}</p>
      </div>

      <div className="w-full max-w-sm bg-[var(--surface)] rounded-xl shadow-modal border border-[var(--border)] overflow-hidden">

        {/* ── Step 1: Username ── */}
        {step === 1 && (
          <div className="p-6 animate-fadeIn">
            <h2 className="text-lg font-bold text-[var(--text)] mb-5">{s.login_title}</h2>
            <div>
              <label className="block text-xs font-medium text-[var(--text-soft)] mb-1">{s.enter_username_label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">👤</span>
                <input
                  ref={inputRef}
                  type="text"
                  autoCapitalize="none"
                  autoComplete="username"
                  value={username}
                  onChange={e => { setUsername(e.target.value.toLowerCase().replace(/\s/g, '')); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleCheckUsername()}
                  placeholder={s.username_placeholder}
                  className="w-full pl-9 pr-3 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-brand-400 transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 text-center animate-fadeIn">{error}</p>
            )}

            <Button className="w-full mt-4" size="lg" onClick={handleCheckUsername} loading={loading} disabled={!username.trim()}>
              {s.enter_username_btn} →
            </Button>
          </div>
        )}

        {/* ── Step 2: PIN ── */}
        {step === 2 && foundUser && (
          <div className="p-6 animate-fadeIn">
            <button onClick={() => { setStep(1); setError(''); setPin(''); setConfirmPin('') }}
              className="flex items-center gap-1.5 text-sm text-[var(--text-soft)] mb-4 hover:text-[var(--text)] transition-colors">
              ← {s.back}
            </button>

            {/* User card */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--surface-2)] rounded-xl">
              <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-2xl">
                {foundUser.avatar}
              </div>
              <div>
                <div className="font-bold text-[var(--text)]">{foundUser.name}</div>
                <div className="text-xs text-[var(--text-muted)] capitalize">{foundUser.role} · {foundUser.branch}</div>
              </div>
            </div>

            {/* Heading */}
            {isNew ? (
              <div className="text-center mb-1">
                <p className="font-bold text-[var(--text)]">
                  {pinSubStep === 'enter' ? s.set_pin_label : s.confirm_pin_label}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.setup_pin_desc}</p>
              </div>
            ) : (
              <p className="text-center font-bold text-[var(--text)]">{s.enter_pin_label}</p>
            )}

            {/* Dots */}
            <PinDots value={pinSubStep === 'confirm' ? confirmPin : pin} />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 text-center mb-2 animate-fadeIn">{error}</p>
            )}

            {loading && (
              <p className="text-center text-xs text-[var(--text-muted)] mb-2">{s.loading}</p>
            )}

            <Numpad onPress={handleNumpad} />

            {/* Back to re-enter PIN when confirming */}
            {isNew && pinSubStep === 'confirm' && (
              <button onClick={() => { setPinSubStep('enter'); setPin(''); setConfirmPin(''); setError('') }}
                className="w-full mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                ← {s.back}
              </button>
            )}
          </div>
        )}

        {/* ── Step 3: Shift ── */}
        {step === 3 && verifiedUser && (
          <div className="p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-5 p-3 bg-[var(--surface-2)] rounded-xl">
              <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xl">
                {verifiedUser.avatar}
              </div>
              <div>
                <div className="font-semibold text-sm text-[var(--text)]">{verifiedUser.name}</div>
                <div className="text-xs text-[var(--text-muted)] capitalize">{verifiedUser.role} · {verifiedUser.branch}</div>
              </div>
            </div>

            <h2 className="text-lg font-bold text-[var(--text)] mb-4">{s.select_shift}</h2>
            <div className="space-y-3 mb-5">
              {SHIFTS.map(shift => (
                <button
                  key={shift.id}
                  onClick={() => setShift(shift)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-150 text-left ${
                    selectedShift?.id === shift.id
                      ? shift.id === 'morning'
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-[var(--border)] hover:border-[var(--border-2)]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${shift.id === 'morning' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                    {shift.id === 'morning' ? '☀️' : '🌙'}
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--text)]">{shift.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{shift.startTime} – {shift.endTime}</div>
                  </div>
                  {selectedShift?.id === shift.id && <div className="ml-auto text-brand-600 font-bold">✓</div>}
                </button>
              ))}
            </div>

            <Button className="w-full" size="lg" onClick={handleStartShift} disabled={!selectedShift}>
              {s.start_shift} →
            </Button>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--text-muted)]">{s.version}</p>
    </div>
  )
}
