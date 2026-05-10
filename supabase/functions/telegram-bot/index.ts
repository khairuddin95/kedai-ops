// KedaiOps — Telegram Bot v2 (inline keyboards)
// Deploy: supabase functions deploy telegram-bot
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Staff self-registration: /daftar <username>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN      = Deno.env.get('TELEGRAM_BOT_TOKEN')        ?? ''
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')   ?? ''
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')              ?? ''
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Telegram API helpers ──────────────────────────────────────
type Btn = { text: string; callback_data: string }
type KB  = Btn[][]

async function tg(method: string, body: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) console.error(`[tg] ${method}:`, await r.text())
}

function mkb(kb?: KB) {
  return kb ? { reply_markup: { inline_keyboard: kb } } : {}
}

const send = (chat: number, text: string, kb?: KB) =>
  tg('sendMessage', { chat_id: chat, text, parse_mode: 'Markdown', ...mkb(kb) })

const edit = (chat: number, msg: number, text: string, kb?: KB) =>
  tg('editMessageText', { chat_id: chat, message_id: msg, text, parse_mode: 'Markdown', ...mkb(kb) })

const ack  = (id: string) => tg('answerCallbackQuery', { callback_query_id: id })

function esc(s: string) { return s.replace(/([_*`[\]])/g, '\\$1') }

// ── DB types & helpers ────────────────────────────────────────
type UserRow  = { id: string; name: string; role: string; branch: string; avatar: string; username: string; department: string | null; telegram_id?: string | null }
type FlatTask = { id: string; title: string; groupTitle: string; requiresPhoto: boolean; status: string }

async function getByTid(tid: string): Promise<UserRow | null> {
  const { data } = await sb.from('users')
    .select('id,name,role,branch,avatar,username,department')
    .eq('telegram_id', tid).single()
  return data
}

async function getByUsername(u: string): Promise<UserRow | null> {
  const { data } = await sb.from('users')
    .select('id,name,role,branch,avatar,username,department,telegram_id')
    .eq('username', u.toLowerCase().trim()).single()
  return data
}

async function linkTelegram(uid: string, tid: string): Promise<boolean> {
  const { error } = await sb.from('users').update({ telegram_id: tid }).eq('id', uid)
  return !error
}

async function getShift(uid: string): Promise<'morning' | 'evening'> {
  const { data } = await sb.from('schedules').select('shift_id')
    .eq('user_id', uid).eq('day_of_week', new Date().getDay()).maybeSingle()
  return (data?.shift_id as 'morning' | 'evening') ?? (new Date().getHours() < 15 ? 'morning' : 'evening')
}

async function getPending(user: UserRow): Promise<FlatTask[]> {
  const isSunday = new Date().getDay() === 0
  const shift    = await getShift(user.id)

  const { data: groups } = await sb.from('task_groups')
    .select('id,title,shift,frequency,department,tasks(id,title,requires_photo,sort_order)')
    .order('sort_order')

  const { data: states } = await sb.from('task_states')
    .select('task_id,status').eq('user_id', user.id)
  const sm = new Map((states ?? []).map(s => [s.task_id, s.status]))

  type G = {
    title: string; shift: string; frequency: string; department: string | null;
    tasks: { id: string; title: string; requires_photo: boolean; sort_order: number }[]
  }

  return ((groups ?? []) as G[])
    .filter(g => {
      if (g.frequency === 'weekly' && !isSunday) return false
      if (g.shift && g.shift !== 'both' && g.shift !== shift) return false
      const d = g.department ?? 'all'
      if (d !== 'all' && user.department && d !== user.department) return false
      return true
    })
    .flatMap(g =>
      [...(g.tasks ?? [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(t => ({
          id: t.id, title: t.title, groupTitle: g.title,
          requiresPhoto: t.requires_photo ?? false,
          status: sm.get(t.id) ?? 'pending',
        }))
    )
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
}

async function markDone(user: UserRow, task: FlatTask): Promise<boolean> {
  const now = new Date().toISOString()
  const shift = await getShift(user.id)
  const { error: e1 } = await sb.from('task_states').upsert({
    user_id: user.id, task_id: task.id, status: 'done',
    checked_items: [], photos: [], notes: 'Disiapkan via Telegram',
    rating: 0, updated_at: now,
  }, { onConflict: 'user_id,task_id' })
  if (e1) return false
  const { error: e2 } = await sb.from('submissions').insert({
    task_id: task.id, task_title: task.title,
    staff_id: user.id, staff_name: user.name, staff_avatar: user.avatar,
    branch: user.branch, shift_id: shift,
    checked_items: [], photos: [], notes: 'Disiapkan via Telegram',
    rating: 0, status: 'pending',
    group_title: task.groupTitle, group_color: null,
  })
  return !e2
}

// ── Screen builders ───────────────────────────────────────────
function menuScreen(user: UserRow): { text: string; kb: KB } {
  const sup = user.role !== 'staff'
  return {
    text: [
      `Assalamualaikum, *${esc(user.name)}* ${user.avatar}`,
      `_${esc(user.branch)} · ${user.role}_`,
      '',
      '📱 *Menu Utama KedaiOps*',
    ].join('\n'),
    kb: [
      [{ text: '📋 Tugasan Hari Ini', callback_data: 'tasks' }],
      ...(sup
        ? [
            [{ text: '⏳ Semak Submission', callback_data: 'review' }],
            [{ text: '📊 Laporan Hari Ini',  callback_data: 'report' }],
          ]
        : []),
      [{ text: 'ℹ️ Bantuan', callback_data: 'help' }],
    ],
  }
}

async function tasksScreen(user: UserRow): Promise<{ text: string; kb: KB }> {
  const pending = await getPending(user)
  if (pending.length === 0) {
    return {
      text: '✅ *Semua tugasan hari ini telah siap!*\n\n_Tahniah, kerja bagus!_ 🎉',
      kb: [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]],
    }
  }
  const hasPhoto = pending.some(t => t.requiresPhoto)
  const text = [
    `📋 *Tugasan Belum Siap* (${pending.length})`,
    '',
    ...pending.map((t, i) =>
      `${i + 1}. *${esc(t.title)}*${t.requiresPhoto ? ' 📷' : ''}\n   _${esc(t.groupTitle)}_`
    ),
    ...(hasPhoto ? ['', '📷 _Bertanda perlu foto — guna aplikasi web._'] : []),
  ].join('\n')
  const kb: KB = [
    ...pending.slice(0, 8).map(t =>
      t.requiresPhoto
        ? [{ text: `📷 ${t.title.slice(0, 32)}`, callback_data: `photo_warn:${t.id}` }]
        : [{ text: `✅ ${t.title.slice(0, 32)}`, callback_data: `task_detail:${t.id}` }]
    ),
    [{ text: '🏠 Menu Utama', callback_data: 'menu' }],
  ]
  return { text, kb }
}

async function taskDetailScreen(user: UserRow, taskId: string): Promise<{ text: string; kb: KB }> {
  const all  = await getPending(user)
  const task = all.find(t => t.id === taskId)
  if (!task) {
    return {
      text: '❌ Tugasan tidak dijumpai atau sudah siap.',
      kb: [[{ text: '📋 Tugasan', callback_data: 'tasks' }]],
    }
  }
  return {
    text: [
      `📌 *${esc(task.title)}*`,
      '',
      `📂 Kumpulan: _${esc(task.groupTitle)}_`,
      `📷 Perlu foto: ${task.requiresPhoto ? 'Ya' : 'Tidak'}`,
      '',
      task.requiresPhoto
        ? '_Tugasan ini perlu foto. Sila buka aplikasi web._'
        : '_Tekan butang di bawah untuk tandakan siap._',
    ].join('\n'),
    kb: task.requiresPhoto
      ? [[{ text: '🔙 Kembali', callback_data: 'tasks' }]]
      : [
          [{ text: '✅ Tandakan Siap', callback_data: `task_done:${taskId}` }],
          [{ text: '🔙 Kembali',       callback_data: 'tasks' }],
        ],
  }
}

async function reportScreen(user: UserRow): Promise<{ text: string; kb: KB }> {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  let q = sb.from('submissions').select('status')
    .gte('submitted_at', start.toISOString())
  if (user.role === 'supervisor') q = q.eq('branch', user.branch)
  const { data: subs } = await q
  const all      = subs ?? []
  const pending  = all.filter(s => s.status === 'pending').length
  const approved = all.filter(s => s.status === 'approved').length
  const rejected = all.filter(s => s.status === 'rejected').length
  const scope    = user.role === 'owner' ? 'Semua cawangan' : esc(user.branch)
  const date     = new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' })
  return {
    text: [
      '📊 *Laporan Hari Ini*',
      `_${date}_`,
      `_${scope}_`,
      '',
      `📋 Jumlah: *${all.length}*`,
      `⏳ Menunggu: *${pending}*`,
      `✅ Diluluskan: *${approved}*`,
      ...(rejected > 0 ? [`❌ Ditolak: *${rejected}*`] : []),
    ].join('\n'),
    kb: [
      [{ text: '⏳ Semak Submission', callback_data: 'review' }],
      [{ text: '🏠 Menu Utama',        callback_data: 'menu' }],
    ],
  }
}

type SubRow = { id: string; task_title: string; staff_name: string; branch: string; group_title: string; notes: string; status: string; submitted_at: string; photos: unknown[] }

async function getPendingSubs(user: UserRow): Promise<SubRow[]> {
  let q = sb.from('submissions')
    .select('id,task_title,staff_name,branch,group_title,notes,status,submitted_at,photos')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
    .limit(10)
  if (user.role === 'supervisor') q = q.eq('branch', user.branch)
  const { data } = await q
  return (data ?? []) as SubRow[]
}

async function reviewScreen(user: UserRow): Promise<{ text: string; kb: KB }> {
  const subs = await getPendingSubs(user)
  if (subs.length === 0) {
    return {
      text: '✅ *Tiada submission menunggu semakan.*',
      kb: [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]],
    }
  }
  const showBranch = user.role === 'owner'
  return {
    text: [
      `⏳ *Submission Menunggu Semakan* (${subs.length})`,
      '',
      ...subs.map((s, i) =>
        `${i + 1}. *${esc(s.task_title)}*\n   👤 ${esc(s.staff_name)}${showBranch ? ` · ${esc(s.branch)}` : ''}`
      ),
      '',
      '_Pilih submission untuk semak._',
    ].join('\n'),
    kb: [
      ...subs.slice(0, 5).map(s => ([
        { text: `👁 ${s.staff_name} — ${s.task_title.slice(0, 24)}`, callback_data: `sub_detail:${s.id}` },
      ])),
      [{ text: '🏠 Menu Utama', callback_data: 'menu' }],
    ],
  }
}

async function subDetailScreen(user: UserRow, subId: string): Promise<{ text: string; kb: KB }> {
  const { data: sub } = await sb.from('submissions')
    .select('id,task_title,staff_name,branch,group_title,notes,status,submitted_at,photos')
    .eq('id', subId).single()
  if (!sub || sub.status !== 'pending') {
    return {
      text: '❌ Submission tidak dijumpai atau sudah diproses.',
      kb: [[{ text: '⏳ Kembali', callback_data: 'review' }]],
    }
  }
  const time     = new Date(sub.submitted_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
  const hasPhoto = Array.isArray(sub.photos) && sub.photos.length > 0
  return {
    text: [
      `📄 *${esc(sub.task_title)}*`,
      '',
      `👤 Staff: *${esc(sub.staff_name)}*`,
      `📂 Kumpulan: _${esc(sub.group_title)}_`,
      `🏢 Cawangan: _${esc(sub.branch)}_`,
      `🕒 Dihantar: _${time}_`,
      ...(sub.notes && sub.notes !== 'Disiapkan via Telegram'
        ? [`📝 Nota: _${esc(sub.notes)}_`] : []),
      ...(hasPhoto ? [`📷 ${sub.photos.length} foto tersedia`] : []),
    ].join('\n'),
    kb: [
      [
        { text: '✅ Lulus',  callback_data: `sub_approve:${subId}` },
        { text: '❌ Tolak',  callback_data: `sub_reject:${subId}` },
      ],
      [{ text: '🔙 Kembali', callback_data: 'review' }],
    ],
  }
}

// ── Message handler ───────────────────────────────────────────
async function onMessage(chat: number, tid: string, text: string): Promise<void> {
  const lower = text.trim().toLowerCase()

  // Registration (works before login)
  if (lower.startsWith('/daftar')) {
    const uname = text.trim().split(/\s+/)[1]
    if (!uname) {
      await send(chat, '⚠️ Sila masukkan username.\n\nContoh: `/daftar ahmad123`'); return
    }
    const existing = await getByUsername(uname)
    if (!existing) {
      await send(chat, `❌ Username *${esc(uname)}* tidak dijumpai.\n\nSemak semula dengan pengurus.`); return
    }
    if (existing.telegram_id && existing.telegram_id !== tid) {
      await send(chat, '⚠️ Akaun ini sudah dipautkan ke Telegram lain.\n\nHubungi pengurus.'); return
    }
    const ok = await linkTelegram(existing.id, tid)
    if (!ok) { await send(chat, '❌ Gagal mendaftar. Sila cuba lagi.'); return }
    const { text: t, kb } = menuScreen(existing as UserRow)
    await send(chat, `✅ Berjaya! Akaun *${esc(existing.name)}* dipautkan.\n\n` + t, kb)
    return
  }

  if (lower === '/bantuan' || lower === '/help') {
    await send(chat, [
      '🆘 *Bantuan KedaiOps*',
      '',
      '`/daftar <username>` — daftar akaun',
      '`/menu` — buka menu utama',
      '',
      '_Semua pilihan tersedia melalui butang di mesej._',
    ].join('\n'), [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]])
    return
  }

  const user = await getByTid(tid)
  if (!user) {
    await send(chat,
      '👋 Selamat datang ke *KedaiOps Bot*!\n\n' +
      'Sila daftar:\n`/daftar <username>`\n\nContoh: `/daftar ahmad123`')
    return
  }

  const { text: t, kb } = menuScreen(user)
  await send(chat, t, kb)
}

// ── Callback handler ──────────────────────────────────────────
async function onCallback(
  chat: number, msgId: number, cqId: string, tid: string, data: string
): Promise<void> {
  await ack(cqId)

  const user = await getByTid(tid)
  if (!user) {
    await edit(chat, msgId, '⚠️ Akaun tidak dijumpai. Sila daftar: `/daftar <username>`'); return
  }

  if (data === 'menu') {
    const { text, kb } = menuScreen(user)
    await edit(chat, msgId, text, kb); return
  }

  if (data === 'tasks') {
    const { text, kb } = await tasksScreen(user)
    await edit(chat, msgId, text, kb); return
  }

  if (data.startsWith('task_detail:')) {
    const { text, kb } = await taskDetailScreen(user, data.slice(12))
    await edit(chat, msgId, text, kb); return
  }

  if (data.startsWith('task_done:')) {
    const taskId  = data.slice(10)
    const all     = await getPending(user)
    const task    = all.find(t => t.id === taskId)
    if (!task) {
      await edit(chat, msgId, '❌ Tugasan tidak dijumpai.',
        [[{ text: '📋 Tugasan', callback_data: 'tasks' }]]); return
    }
    const ok = await markDone(user, task)
    const { text, kb } = await tasksScreen(user)
    await edit(chat, msgId,
      ok ? `✅ *${esc(task.title)}* telah ditandakan siap!\n\n` + text
         : `❌ Gagal tandakan. Cuba lagi.\n\n` + text,
      kb); return
  }

  if (data.startsWith('photo_warn:')) {
    await edit(chat, msgId,
      '📷 Tugasan ini memerlukan foto bukti.\n\nSila buka *aplikasi web KedaiOps* untuk hantar tugasan ini.',
      [[{ text: '🔙 Kembali', callback_data: 'tasks' }]]); return
  }

  if (data === 'report') {
    if (user.role === 'staff') {
      await edit(chat, msgId, '⚠️ Anda tidak mempunyai akses.',
        [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]]); return
    }
    const { text, kb } = await reportScreen(user)
    await edit(chat, msgId, text, kb); return
  }

  if (data === 'review') {
    if (user.role === 'staff') {
      await edit(chat, msgId, '⚠️ Anda tidak mempunyai akses.',
        [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]]); return
    }
    const { text, kb } = await reviewScreen(user)
    await edit(chat, msgId, text, kb); return
  }

  if (data.startsWith('sub_detail:')) {
    if (user.role === 'staff') return
    const { text, kb } = await subDetailScreen(user, data.slice(11))
    await edit(chat, msgId, text, kb); return
  }

  if (data.startsWith('sub_approve:') || data.startsWith('sub_reject:')) {
    if (user.role === 'staff') return
    const isApprove = data.startsWith('sub_approve:')
    const subId  = data.slice(isApprove ? 12 : 11)
    const status = isApprove ? 'approved' : 'rejected'
    const { error } = await sb.from('submissions')
      .update({ status, supervisor_comment: null })
      .eq('id', subId)
    const { text, kb } = await reviewScreen(user)
    const prefix = isApprove ? '✅ *Submission diluluskan!*' : '❌ *Submission ditolak.*'
    await edit(chat, msgId,
      !error ? `${prefix}\n\n` + text : '❌ Gagal proses. Cuba lagi.',
      !error ? kb : [[{ text: '⏳ Cuba lagi', callback_data: 'review' }]]); return
  }

  if (data === 'help') {
    await edit(chat, msgId, [
      '🆘 *Bantuan KedaiOps*',
      '',
      '📋 *Tugasan Hari Ini* — senarai tugasan belum siap',
      '⏳ *Semak Submission* — luluskan / tolak (supervisor & owner)',
      '📊 *Laporan Hari Ini* — ringkasan hari ini (supervisor & owner)',
      '',
      'Tugasan bertanda 📷 perlu diselesaikan di aplikasi web.',
    ].join('\n'),
    [[{ text: '🏠 Menu Utama', callback_data: 'menu' }]]); return
  }
}

// ── Entry point ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 })

  if (WEBHOOK_SECRET) {
    if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== WEBHOOK_SECRET) {
      console.warn('[tg] rejected bad secret')
      return new Response('Forbidden', { status: 403 })
    }
  } else {
    console.warn('[tg] WEBHOOK_SECRET not set — bot is open to spoofed requests')
  }

  try {
    const body = await req.json()

    if (body?.callback_query) {
      const cq   = body.callback_query
      const chat = cq.message?.chat?.id
      const msgId = cq.message?.message_id
      const tid  = String(cq.from?.id)
      if (chat && msgId && tid) {
        await onCallback(chat, msgId, cq.id, tid, cq.data ?? '')
      }
      return new Response('OK', { status: 200 })
    }

    const msg = body?.message ?? body?.edited_message
    if (msg?.text && msg?.chat?.id && msg?.from?.id) {
      await onMessage(msg.chat.id, String(msg.from.id), msg.text)
    }
  } catch (e) {
    console.error('[tg] error:', e)
  }

  return new Response('OK', { status: 200 })
})
