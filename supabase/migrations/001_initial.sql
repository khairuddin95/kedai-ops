-- ============================================================
-- KedaiOps — Initial Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─────────────────────────────────
-- TABLES
-- ─────────────────────────────────

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text not null check (role in ('staff','supervisor','owner')),
  branch      text not null,
  avatar      text not null default '👤',
  pin         text not null,
  created_at  timestamptz default now()
);

create table if not exists public.shifts (
  id          text primary key,   -- 'morning' | 'evening'
  label       text not null,
  start_time  text not null,
  end_time    text not null
);

create table if not exists public.task_groups (
  id          text primary key,
  title       text not null,
  time        text not null,
  icon        text not null,
  color       text not null,
  sort_order  int  default 0
);

create table if not exists public.tasks (
  id              text primary key,
  title           text not null,
  est             int  not null default 5,
  items           text[] not null default '{}',
  requires_photo  boolean default false,
  group_id        text references public.task_groups(id) on delete cascade,
  sort_order      int default 0
);

create table if not exists public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  task_id             text references public.tasks(id),
  task_title          text not null,
  staff_id            uuid references public.users(id),
  staff_name          text not null,
  staff_avatar        text not null,
  branch              text not null,
  shift_id            text not null,
  submitted_at        timestamptz default now(),
  checked_items       int[] default '{}',
  photos              text[] default '{}',
  notes               text default '',
  rating              int  check (rating between 0 and 5),
  status              text default 'pending' check (status in ('pending','approved','rejected')),
  supervisor_comment  text,
  flag                boolean default false,
  group_title         text,
  group_color         text
);

create table if not exists public.task_states (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete cascade,
  task_id       text references public.tasks(id) on delete cascade,
  status        text default 'pending' check (status in ('pending','in_progress','done','late')),
  checked_items int[]   default '{}',
  photos        text[]  default '{}',
  notes         text    default '',
  rating        int     default 0 check (rating between 0 and 5),
  updated_at    timestamptz default now(),
  unique (user_id, task_id)
);

-- ─────────────────────────────────
-- INDEXES
-- ─────────────────────────────────
create index if not exists idx_submissions_staff   on public.submissions(staff_id);
create index if not exists idx_submissions_status  on public.submissions(status);
create index if not exists idx_task_states_user    on public.task_states(user_id);
create index if not exists idx_tasks_group         on public.tasks(group_id);

-- ─────────────────────────────────
-- ROW LEVEL SECURITY (optional — enable for production)
-- ─────────────────────────────────
-- alter table public.users        enable row level security;
-- alter table public.submissions  enable row level security;
-- alter table public.task_states  enable row level security;

-- ─────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────

-- Shifts
insert into public.shifts (id, label, start_time, end_time) values
  ('morning', 'Shift Pagi',   '10:00 pagi',  '3:00 petang'),
  ('evening', 'Shift Petang', '3:00 petang', '12:00 malam')
on conflict (id) do nothing;

-- Task Groups
insert into public.task_groups (id, title, time, icon, color, sort_order) values
  ('opening',     'Buka Kedai',             '10:00 pagi',   'sunrise',  '#f59e0b', 1),
  ('cleaning',    'Kebersihan Tengahari',    '2:30 petang',  'sparkles', '#10b981', 2),
  ('maintenance', 'Maintenance',            '4:00 petang',  'wrench',   '#8b5cf6', 3),
  ('closing',     'Tutup Kedai',            '12:00 malam',  'moon',     '#3b82f6', 4)
on conflict (id) do nothing;

-- Tasks
insert into public.tasks (id, title, est, items, requires_photo, group_id, sort_order) values
  ('op1','Hidup lampu & kipas',  2, array['Lampu utama','Lampu dapur','Kipas siling x4','Kipas dinding'], false,'opening',1),
  ('op2','Sapu & lap meja',     15, array['Sapu lantai depan','Sapu lantai dapur','Lap semua meja (12)','Lap kerusi'],true,'opening',2),
  ('op3','Setup kaunter & POS',  5, array['Hidup POS','Check printer resit','Tukar duit kecik','Susun menu'],false,'opening',3),
  ('op4','Cek stok bahan',      10, array['Sayur & ulam','Daging & ayam','Beras & minyak','Sos & rempah'],true,'opening',4),
  ('cl1','Cuci tandas',         20, array['Mop lantai','Cuci sinki','Tukar tisu','Spray pewangi'],true,'cleaning',1),
  ('cl2','Buang sampah dapur',  10, array['Sampah dapur','Sampah area meja','Tukar plastik baru'],false,'cleaning',2),
  ('mt1','Cek peralatan dapur', 12, array['Stove (4 burner)','Kuali besar','Periuk nasi','Chiller (suhu < 5°C)'],true,'maintenance',1),
  ('cs1','Kira jualan & duit',  15, array['Print closing report','Kira cash','Cocok dengan POS','Simpan dalam safe'],false,'closing',1),
  ('cs2','Tutup peralatan',      5, array['Tutup gas utama','Tutup chiller pintu','Tutup lampu','Lock pintu belakang'],false,'closing',2)
on conflict (id) do nothing;

-- Users (PINs stored as plain text for MVP — hash with pgcrypto in production)
insert into public.users (id, name, role, branch, avatar, pin) values
  ('11111111-1111-1111-1111-111111111111', 'Khairuddin',  'staff',      'Bangsar', '🧑‍🍳', '1234'),
  ('22222222-2222-2222-2222-222222222222', 'Siti Noor',   'staff',      'Bangsar', '👩‍🍳', '2222'),
  ('33333333-3333-3333-3333-333333333333', 'Razif',       'supervisor', 'Bangsar', '👨‍💼', '3333'),
  ('44444444-4444-4444-4444-444444444444', 'Puan Aishah', 'owner',      'Semua',   '👩‍💼', '0000')
on conflict (id) do nothing;

-- Sample submissions
insert into public.submissions
  (task_id, task_title, staff_id, staff_name, staff_avatar, branch, shift_id, submitted_at, checked_items, photos, notes, rating, status, group_title, group_color)
values
  ('op1','Hidup lampu & kipas',
   '11111111-1111-1111-1111-111111111111','Khairuddin','🧑‍🍳','Bangsar','morning',
   now() - interval '2 hours', array[0,1,2,3], '{}', 'Semua OK', 5, 'approved','Buka Kedai','#f59e0b'),
  ('op2','Sapu & lap meja',
   '22222222-2222-2222-2222-222222222222','Siti Noor','👩‍🍳','Bangsar','morning',
   now() - interval '90 minutes', array[0,1,2,3], array['photo1'], '', 4, 'pending','Buka Kedai','#f59e0b'),
  ('cl1','Cuci tandas',
   '11111111-1111-1111-1111-111111111111','Khairuddin','🧑‍🍳','Bangsar','morning',
   now() - interval '30 minutes', array[0,1,2,3], array['photo2'], 'Tisu dah habis, dah tukar yang baru', 3, 'pending','Kebersihan Tengahari','#10b981');
