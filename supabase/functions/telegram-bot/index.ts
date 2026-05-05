/**
 * KedaiOps — Telegram Bot
 * Supabase Edge Function (Deno runtime)
 *
 * Setup:
 *  1. Create bot via @BotFather → get BOT_TOKEN
 *  2. Set env vars in Supabase Dashboard → Settings → Edge Functions → Secrets:
 *       TELEGRAM_BOT_TOKEN     = <token from BotFather>
 *       TELEGRAM_WEBHOOK_SECRET = <any random string, used to authenticate
 *                                  webhook requests from Telegram>
 *  3. Deploy:  supabase functions deploy telegram-bot
 *  4. Register webhook with the secret (run once):
 *       curl "https://api.telegram.org/bot<TOKEN>/setWebhook?\
 *         url=https://<project-ref>.supabase.co/functions/v1/telegram-bot&\
 *         secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 *
 * Staff registration (self-service):
 *   Staff messages the bot: /daftar <username>
 *
 * Commands:
 *   /start | /menu | 0   → main menu
 *   /bantuan | /help     → help
 *   1                    → list pending tasks today
 *   2 <num>              → mark task done  (e.g. "2 1")
 *   3                    → daily report  (supervisor / owner only)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Config ──────────────────────────────────────────────────
const BOT_TOKEN       = Deno.env.get('TELEGRAM_BOT_TOKEN')      ?? ''
const WEBHOOK_SECRET  = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')            ?? ''
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Telegram helpers ────────────────────────────────────────
// Escape special chars for MarkdownV2. The current bot uses 'Markdown' (legacy)
// which only treats _ * ` [ as special, but those are still enough to break
// formatting if a task title contains them. We escape conservatively.
function esc(text: string): string {
  return text.replace(/([_*`\[\]])/g, '\\$1')
}

async function send(chatId: number, text: string): Promise<void> {
  try {
    const res = await fetch(`${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
    if (!res.ok) console.error('[tg] send failed:', res.status, await res.text())
  } catch (err) {
    console.error('[tg] send error:', err)
  }
}

// ─── DB types + helpers ──────────────────────────────────────
type UserRow = {
  id: string; name: string; role: string; branch: string;
  avatar: string; username: string; department: string | null;
}

async function getByTelegramId(telegramId: string): Promise<UserRow | null> {
  const { data } = await supabase
    .from('users')
    .select('id,name,role,branch,avatar,username,department')
    .eq('telegram_id', telegramId)
    .single()
  return data
}

async function getByUsername(username: string): Promise<(UserRow & { telegram_id: string | null }) | null> {
  const { data } = await supabase
    .from('users')
    .select('id,name,role,branch,avatar,username,department,telegram_id')
    .eq('username', username.toLowerCase().trim())
    .single()
  return data
}

async function linkTelegram(userId: string, telegramId: string): Promise<boolean> {
  const { error } = await supabase
    .from('users').update({ telegram_id: telegramId }).eq('id', userId)
  if (error) console.error('[tg] linkTelegram:', error)
  return !error
}

async function getUserTodayShift(userId: string): Promise<'morning' | 'evening' | null> {
  const day = new Date().getDay()
  const { data } = await supabase
    .from('schedules').select('shift_id')
    .eq('user_id', userId).eq('day_of_week', day).maybeSingle()
  return (data?.shift_id as 'morning' | 'evening') ?? null
}

interface FlatTask {
  id: string; title: string; groupTitle: string; status: string;
  requiresPhoto: boolean;
}

async function getPendingTasks(user: UserRow): Promise<FlatTask[]> {
  const isSunday = new Date().getDay() === 0

  // Determine the user's current shift: schedule first, then time-of-day fallback.
  // This mirrors what the web app does for staff at login.
  const scheduledShift = await getUserTodayShift(user.id)
  const currentShift = scheduledShift ?? (new Date().getHours() < 15 ? 'morning' : 'evening')

  const { data: groups, error: gErr } = await supabase
    .from('task_groups')
    .select('id, title, shift, frequency, department, tasks(id, title, requires_photo, sort_order)')
    .order('sort_order')
  if (gErr) console.error('[tg] getPendingTasks groups:', gErr)

  const { data: states, error: sErr } = await supabase
    .from('task_states').select('task_id, status').eq('user_id', user.id)
  if (sErr) console.error('[tg] getPendingTasks states:', sErr)
  const stateMap = new Map((states ?? []).map(s => [s.task_id, s.status]))

  type GroupShape = {
    id: string; title: string; shift: string; frequency: string;
    department: string | null;
    tasks: { id: string; title: string; requires_photo: boolean; sort_order: number }[]
  }

  return ((groups ?? []) as GroupShape[])
    .filter(g => {
      // Frequency: weekly groups only show on Sunday
      if (g.frequency === 'weekly' && !isSunday) return false
      // Shift: 'both' always shows; otherwise must match user's current shift
      if (g.shift && g.shift !== 'both' && g.shift !== currentShift) return false
      // Department: 'all' / unset always shows; otherwise must match user's dept
      const groupDept = g.department ?? 'all'
      if (groupDept !== 'all' && user.department && groupDept !== user.department) return false
      return true
    })
    .flatMap(g =>
      [...(g.tasks ?? [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(t => ({
          id: t.id, title: t.title, groupTitle: g.title,
          requiresPhoto: t.requires_photo ?? false,
          status: stateMap.get(t.id) ?? 'pending',
        }))
    )
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
}

async function markDone(user: UserRow, task: FlatTask): Promise<boolean> {
  const now = new Date().toISOString()
  const scheduledShift = await getUserTodayShift(user.id)
  const shiftId = scheduledShift ?? (new Date().getHours() < 15 ? 'morning' : 'evening')

  const { error: stateErr } = await supabase.from('task_states').upsert({
    user_id: user.id, task_id: task.id, status: 'done',
    checked_items: [], photos: [], notes: 'Disiapkan via Telegram',
    rating: 0, updated_at: now,
  }, { onConflict: 'user_id,task_id' })
  if (stateErr) { console.error('[tg] markDone state:', stateErr); return false }

  const { error: subErr } = await supabase.from('submissions').insert({
    task_id: task.id, task_title: task.title,
    staff_id: user.id, staff_name: user.name, staff_avatar: user.avatar,
    branch: user.branch,
    shift_id: shiftId,
    checked_items: [], photos: [], notes: 'Disiapkan via Telegram',
    rating: 0, status: 'pending',
    group_title: task.groupTitle, group_color: null,
  })
  if (subErr) { console.error('[tg] markDone submission:', subErr); return false }
  return true
}

// ─── Message handler ─────────────────────────────────────────
async function handle(chatId: number, telegramId: string, text: string): Promise<void> {
  const lower = text.trim().toLowerCase()

  // ── Registration ─────────────────────────────────────────
  if (lower.startsWith('/daftar')) {
    const parts = text.trim().split(/\s+/)
    const uname = parts[1]
    if (!uname) {
      await send(chatId, '⚠️ Sila masukkan username anda.\n\nContoh: `/daftar ahmad123`')
      return
    }
    const existing = await getByUsername(uname)
    if (!existing) {
      await send(chatId, `❌ Username *${esc(uname)}* tidak dijumpai.\n\nSemak semula dengan pengurus.`)
      return
    }
    if (existing.telegram_id && existing.telegram_id !== telegramId) {
      await send(chatId, '⚠️ Akaun ini sudah dipautkan ke Telegram lain.\n\nHubungi pengurus untuk buang pautan lama.')
      return
    }
    const ok = await linkTelegram(existing.id, telegramId)
    if (!ok) { await send(chatId, '❌ Gagal mendaftar. Sila cuba lagi.'); return }
    await send(chatId,
      `✅ Berjaya! Akaun *${esc(existing.name)}* (${esc(existing.role)}) kini dipautkan.\n\n` +
      `Taip /menu untuk mula.`
    )
    return
  }

  // ── Help (works without registration) ─────────────────────
  if (lower === '/bantuan' || lower === '/help') {
    await send(chatId, [
      '🆘 *Bantuan KedaiOps*',
      '',
      '*Daftar:*',
      '`/daftar <username>` — pautkan Telegram dengan akaun KedaiOps',
      '',
      '*Selepas daftar:*',
      '`/menu` atau `0` — menu utama',
      '`1` — senarai tugasan belum siap',
      '`2 <nombor>` — tandakan task siap (cth. `2 1`)',
      '`3` — laporan hari ini (supervisor & owner)',
      '',
      '_Tugasan yang perlu foto, sila gunakan aplikasi web._',
    ].join('\n'))
    return
  }

  // ── Require registration for everything else ──────────────
  const user = await getByTelegramId(telegramId)
  if (!user) {
    await send(chatId,
      '👋 Selamat datang ke *KedaiOps Bot*!\n\n' +
      'Sila daftar dengan menaip:\n`/daftar <username>`\n\n' +
      'Contoh: `/daftar ahmad123`\n\n' +
      'Taip `/bantuan` untuk maklumat lanjut.'
    )
    return
  }

  // ── Main menu ────────────────────────────────────────────
  if (['/start', '/menu', '0', ''].includes(lower)) {
    await send(chatId, [
      `Assalamualaikum, *${esc(user.name)}* ${user.avatar}`,
      '',
      '📋 *Menu KedaiOps*',
      '',
      '1️⃣  Tugasan hari ini',
      '2️⃣  Tandakan task siap  _(taip: 2 1)_',
      ...(user.role !== 'staff' ? ['3️⃣  Laporan hari ini'] : []),
      '',
      '_Balas nombor untuk pilih._',
      '_Taip /bantuan untuk bantuan._',
    ].join('\n'))
    return
  }

  // ── List pending tasks ───────────────────────────────────
  if (lower === '1' || lower === '/tugasan') {
    const pending = await getPendingTasks(user)
    if (pending.length === 0) {
      await send(chatId, '✅ Semua tugasan hari ini telah siap! Taip /menu untuk kembali.')
      return
    }
    await send(chatId, [
      `📋 *Tugasan Belum Siap* (${pending.length})`,
      '',
      ...pending.map((t, i) => {
        const photo = t.requiresPhoto ? ' 📷' : ''
        return `${i + 1}. *${esc(t.title)}*${photo}\n   _${esc(t.groupTitle)}_`
      }),
      '',
      'Taip *2 \\[nombor\\]* untuk tandakan siap.',
      'Contoh: *2 1*',
      '',
      '_Tugasan dengan 📷 perlu foto — sila gunakan aplikasi web._',
    ].join('\n'))
    return
  }

  // ── Mark task done ───────────────────────────────────────
  if (/^2\s+\d+$/.test(lower)) {
    const idx = parseInt(lower.split(/\s+/)[1]) - 1
    const pending = await getPendingTasks(user)
    if (isNaN(idx) || idx < 0 || idx >= pending.length) {
      await send(chatId, `❌ Nombor tidak sah. Ada *${pending.length}* tugasan belum siap.\n\nContoh: *2 1*`)
      return
    }
    const task = pending[idx]
    if (task.requiresPhoto) {
      await send(chatId,
        `📷 *${esc(task.title)}* memerlukan foto bukti.\n\n` +
        `Sila buka aplikasi web untuk muat naik foto dan hantar tugasan ini.`
      )
      return
    }
    const ok = await markDone(user, task)
    if (!ok) {
      await send(chatId, '❌ Gagal tandakan task. Sila cuba lagi.')
      return
    }
    await send(chatId, `✅ *${esc(task.title)}* telah ditandakan siap!\n\nTaip *1* untuk lihat senarai terkini.`)
    return
  }

  // ── Daily report (supervisor/owner) ──────────────────────
  if ((lower === '3' || lower === '/laporan') && user.role !== 'staff') {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    // Owners see all branches; supervisors see only their own branch
    let q = supabase
      .from('submissions').select('status, branch')
      .gte('submitted_at', todayStart.toISOString())
    if (user.role === 'supervisor') q = q.eq('branch', user.branch)

    const { data: subs, error } = await q
    if (error) {
      console.error('[tg] /laporan:', error)
      await send(chatId, '❌ Gagal ambil laporan. Sila cuba lagi.')
      return
    }
    const all      = subs ?? []
    const pending  = all.filter(s => s.status === 'pending').length
    const approved = all.filter(s => s.status === 'approved').length
    const rejected = all.filter(s => s.status === 'rejected').length
    const scope    = user.role === 'owner'
      ? 'Semua cawangan'
      : esc(user.branch)
    await send(chatId, [
      `📊 *Laporan Hari Ini*`,
      `_${new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' })}_`,
      '',
      `📋 Jumlah submission: *${all.length}*`,
      `⏳ Menunggu semak:    *${pending}*`,
      `✅ Diluluskan:         *${approved}*`,
      ...(rejected > 0 ? [`❌ Ditolak:             *${rejected}*`] : []),
      '',
      `_${scope}_`,
    ].join('\n'))
    return
  }

  // ── Fallback ─────────────────────────────────────────────
  await send(chatId, 'Taip /menu untuk lihat pilihan, atau /bantuan untuk bantuan.')
}

// ─── Entry point ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 })

  // Webhook authentication: Telegram sends this header on every update if we
  // registered the webhook with `secret_token`. Without this check, anyone
  // who guesses the function URL can POST fake updates and impersonate users.
  if (WEBHOOK_SECRET) {
    const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (got !== WEBHOOK_SECRET) {
      console.warn('[tg] rejected request with bad secret token')
      return new Response('Forbidden', { status: 403 })
    }
  } else {
    console.warn('[tg] WEBHOOK_SECRET not set — bot is open to spoofed requests')
  }

  try {
    const body = await req.json()
    const msg  = body?.message ?? body?.edited_message
    if (msg?.text && msg?.chat?.id && msg?.from?.id) {
      await handle(msg.chat.id, String(msg.from.id), msg.text)
    }
  } catch (e) {
    console.error('[tg] top-level error:', e)
  }

  return new Response('OK', { status: 200 })
})
