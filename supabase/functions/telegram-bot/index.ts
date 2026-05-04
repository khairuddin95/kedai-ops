/**
 * KedaiOps — Telegram Bot
 * Supabase Edge Function (Deno runtime)
 *
 * Setup:
 *  1. Create bot via @BotFather → get BOT_TOKEN
 *  2. Set env vars in Supabase Dashboard → Settings → Edge Functions → Secrets:
 *       TELEGRAM_BOT_TOKEN = <token from BotFather>
 *  3. Deploy:  supabase functions deploy telegram-bot
 *  4. Register webhook (run once):
 *       curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project-ref>.supabase.co/functions/v1/telegram-bot"
 *
 * Staff registration (self-service):
 *   Staff messages the bot: /daftar <username>
 *   Bot links their Telegram ID to the KedaiOps account.
 *
 * Commands after registration:
 *   /start | /menu | 0   → main menu
 *   1                    → list pending tasks today
 *   2 <num>              → mark task done  (e.g. "2 1")
 *   3                    → daily report  (supervisor / owner only)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Config ──────────────────────────────────────────────────
const BOT_TOKEN    = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Telegram helpers ────────────────────────────────────────
async function send(chatId: number, text: string) {
  await fetch(`${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

// ─── DB helpers ───────────────────────────────────────────────
type UserRow = { id: string; name: string; role: string; branch: string; avatar: string; username: string }

async function getByTelegramId(telegramId: string): Promise<UserRow | null> {
  const { data } = await supabase
    .from('users').select('id,name,role,branch,avatar,username')
    .eq('telegram_id', telegramId).single()
  return data
}

async function getByUsername(username: string): Promise<UserRow | null> {
  const { data } = await supabase
    .from('users').select('id,name,role,branch,avatar,username,telegram_id')
    .eq('username', username.toLowerCase().trim()).single()
  return data
}

async function linkTelegram(userId: string, telegramId: string): Promise<boolean> {
  const { error } = await supabase
    .from('users').update({ telegram_id: telegramId }).eq('id', userId)
  return !error
}

interface FlatTask { id: string; title: string; groupTitle: string; status: string }

async function getPendingTasks(userId: string): Promise<FlatTask[]> {
  const isSunday = new Date().getDay() === 0

  const { data: groups } = await supabase
    .from('task_groups')
    .select('id, title, shift, frequency, tasks(id, title)')
    .order('sort_order')

  const { data: states } = await supabase
    .from('task_states').select('task_id, status').eq('user_id', userId)
  const stateMap = new Map((states ?? []).map(s => [s.task_id, s.status]))

  return ((groups ?? []) as { id: string; title: string; shift: string; frequency: string; tasks: { id: string; title: string }[] }[])
    .filter(g => g.frequency !== 'weekly' || isSunday)
    .flatMap(g =>
      (g.tasks ?? []).map(t => ({
        id: t.id, title: t.title, groupTitle: g.title,
        status: stateMap.get(t.id) ?? 'pending',
      }))
    )
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
}

async function markDone(user: UserRow, task: FlatTask) {
  const now = new Date().toISOString()
  await supabase.from('task_states').upsert({
    user_id: user.id, task_id: task.id, status: 'done',
    checked_items: [], photos: [], notes: 'Siap via Telegram', rating: 0, updated_at: now,
  }, { onConflict: 'user_id,task_id' })

  await supabase.from('submissions').insert({
    task_id: task.id, task_title: task.title,
    staff_id: user.id, staff_name: user.name, staff_avatar: user.avatar,
    branch: user.branch,
    shift_id: new Date().getHours() < 15 ? 'morning' : 'evening',
    checked_items: [], photos: [], notes: 'Siap via Telegram',
    rating: 0, status: 'pending', group_title: task.groupTitle, group_color: null,
  })
}

// ─── Message handler ─────────────────────────────────────────
async function handle(chatId: number, telegramId: string, text: string) {
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
      await send(chatId, `❌ Username *${uname}* tidak dijumpai.\n\nSemak semula username anda dengan pengurus.`)
      return
    }
    const already = (existing as UserRow & { telegram_id?: string }).telegram_id
    if (already && already !== telegramId) {
      await send(chatId, '⚠️ Akaun ini sudah dipautkan ke Telegram lain.\n\nHubungi pengurus untuk buang pautan lama.')
      return
    }
    await linkTelegram(existing.id, telegramId)
    await send(chatId,
      `✅ Berjaya! Akaun *${existing.name}* (${existing.role}) kini dipautkan ke Telegram ini.\n\n` +
      `Taip /menu untuk mula.`
    )
    return
  }

  // ── Require registration for everything else ──────────────
  const user = await getByTelegramId(telegramId)
  if (!user) {
    await send(chatId,
      '👋 Selamat datang ke *KedaiOps Bot*!\n\n' +
      'Sila daftar dengan menaip:\n`/daftar <username>`\n\n' +
      'Contoh: `/daftar ahmad123`'
    )
    return
  }

  // ── Main menu ────────────────────────────────────────────
  if (['/start', '/menu', '0', ''].includes(lower)) {
    await send(chatId, [
      `Assalamualaikum, *${user.name}* ${user.avatar}`,
      '',
      '📋 *Menu KedaiOps*',
      '',
      '1️⃣  Tugasan hari ini',
      '2️⃣  Tandakan task siap  _(taip: 2 1)_',
      ...(user.role !== 'staff' ? ['3️⃣  Laporan hari ini'] : []),
      '',
      '_Balas nombor untuk pilih._',
    ].join('\n'))
    return
  }

  // ── List pending tasks ───────────────────────────────────
  if (lower === '1' || lower === '/tugasan') {
    const pending = await getPendingTasks(user.id)
    if (pending.length === 0) {
      await send(chatId, '✅ Semua tugasan hari ini telah siap! Taip /menu untuk kembali.')
      return
    }
    await send(chatId, [
      `📋 *Tugasan Belum Siap* (${pending.length})`,
      '',
      ...pending.map((t, i) => `${i + 1}. *${t.title}*\n   _${t.groupTitle}_`),
      '',
      'Taip *2 \\[nombor\\]* untuk tandakan siap.',
      'Contoh: *2 1*',
    ].join('\n'))
    return
  }

  // ── Mark task done ───────────────────────────────────────
  if (/^2\s+\d+$/.test(lower)) {
    const idx = parseInt(lower.split(/\s+/)[1]) - 1
    const pending = await getPendingTasks(user.id)
    if (isNaN(idx) || idx < 0 || idx >= pending.length) {
      await send(chatId, `❌ Nombor tidak sah. Ada *${pending.length}* tugasan belum siap.\n\nContoh: *2 1*`)
      return
    }
    const task = pending[idx]
    await markDone(user, task)
    await send(chatId, `✅ *${task.title}* telah ditandakan siap!\n\nTaip *1* untuk lihat senarai terkini.`)
    return
  }

  // ── Daily report ─────────────────────────────────────────
  if ((lower === '3' || lower === '/laporan') && user.role !== 'staff') {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data: subs } = await supabase
      .from('submissions').select('status')
      .gte('submitted_at', todayStart.toISOString())
    const all      = subs ?? []
    const pending  = all.filter(s => s.status === 'pending').length
    const approved = all.filter(s => s.status === 'approved').length
    const rejected = all.filter(s => s.status === 'rejected').length
    await send(chatId, [
      `📊 *Laporan Hari Ini*`,
      `_${new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' })}_`,
      '',
      `📋 Jumlah submission: *${all.length}*`,
      `⏳ Menunggu semak:    *${pending}*`,
      `✅ Diluluskan:         *${approved}*`,
      ...(rejected > 0 ? [`❌ Ditolak:             *${rejected}*`] : []),
      '',
      `_Cawangan: ${user.branch}_`,
    ].join('\n'))
    return
  }

  // ── Fallback ─────────────────────────────────────────────
  await send(chatId, 'Taip /menu untuk lihat pilihan yang tersedia.')
}

// ─── Entry point ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 })

  try {
    const body = await req.json()
    const msg  = body?.message ?? body?.edited_message
    if (msg?.text && msg?.chat?.id) {
      await handle(
        msg.chat.id,
        String(msg.from.id),
        msg.text,
      )
    }
  } catch (e) {
    console.error('telegram-bot error:', e)
  }

  return new Response('OK', { status: 200 })
})
