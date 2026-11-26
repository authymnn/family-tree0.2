-- ============================================================================
-- สาแหรกตระกูล (Thai Family Tree) — Supabase Database & Admin Lock Setup
-- วิธีใช้: คัดลอกไฟล์นี้ทั้งหมดไปวางใน Supabase -> SQL Editor -> กด Run ครั้งเดียว
-- ============================================================================

-- 1. ตารางหลักเก็บข้อมูลผังตระกูล + การตั้งค่าล็อก/ปลดล็อกของแอดมิน
create table if not exists public.family_trees (
  id text primary key,
  tree_data jsonb not null,
  theme_settings jsonb,
  view_mode text not null default 'public' check (view_mode in ('public', 'pin')),
  view_pin text not null default '0000',
  edit_mode text not null default 'open' check (edit_mode in ('open', 'pin', 'locked')),
  edit_pin text not null default '8888',
  admin_pin text not null default '1234', -- แนะนำให้เปลี่ยนในหน้าแอดมินหลังติดตั้งเสร็จ
  updated_by text,
  updated_at timestamptz not null default now()
);

-- 2. ตารางสัญญาณแจ้งเตือน Realtime (เก็บเฉพาะ id กับเวลา ไม่มีข้อมูลส่วนตัว)
create table if not exists public.family_tree_sync (
  tree_id text primary key references public.family_trees(id) on delete cascade,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- เปิด Row Level Security (RLS) เพื่อป้องกันการเข้าถึงข้อมูลหรือรหัสผ่านโดยตรง
alter table public.family_trees enable row level security;
alter table public.family_tree_sync enable row level security;

-- ลบ Policy เก่าถ้ามี (เพื่อให้รันซ้ำได้อย่างปลอดภัย)
drop policy if exists "Allow public read sync signal" on public.family_tree_sync;
create policy "Allow public read sync signal"
  on public.family_tree_sync
  for select
  to anon, authenticated
  using (true);

-- เปิดใช้งาน Realtime บนตารางสัญญาณซิงก์
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_tree_sync'
  ) then
    alter publication supabase_realtime add table public.family_tree_sync;
  end if;
end $$;

-- ============================================================================
-- RPC 1: ตรวจสอบสถานะผังตระกูล (ว่าถูกล็อกหน้าดูหรือล็อกการแก้ไขอยู่หรือไม่)
-- ============================================================================
create or replace function public.get_family_tree_status(p_tree_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_trees%rowtype;
begin
  select * into v_row from public.family_trees where id = p_tree_id;
  if not found then
    return jsonb_build_object(
      'exists', false,
      'view_mode', 'public',
      'edit_mode', 'open'
    );
  end if;

  return jsonb_build_object(
    'exists', true,
    'clan_name', coalesce(v_row.tree_data->>'clanName', 'ผังตระกูล'),
    'view_mode', v_row.view_mode,
    'edit_mode', v_row.edit_mode,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by
  );
end;
$$;

-- ============================================================================
-- RPC 2: ดึงข้อมูลผังตระกูล (ตรวจรหัสเข้าบ้าน / รหัสแก้ไข / รหัสแอดมิน)
-- ============================================================================
create or replace function public.get_family_tree(
  p_tree_id text,
  p_view_pin text default '',
  p_edit_pin text default '',
  p_admin_pin text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_trees%rowtype;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
begin
  select * into v_row from public.family_trees where id = p_tree_id;
  if not found then
    return jsonb_build_object(
      'ok', true,
      'exists', false,
      'view_mode', 'public',
      'edit_mode', 'open',
      'is_admin', (p_admin_pin = '1234'),
      'can_edit', true
    );
  end if;

  v_is_admin := (coalesce(p_admin_pin, '') <> '' and p_admin_pin = v_row.admin_pin);

  -- ตรวจสิทธิ์การดู
  if v_row.view_mode = 'pin' and not v_is_admin and coalesce(p_view_pin, '') <> v_row.view_pin then
    return jsonb_build_object(
      'ok', false,
      'locked_view', true,
      'clan_name', coalesce(v_row.tree_data->>'clanName', 'ผังตระกูล'),
      'view_mode', v_row.view_mode,
      'edit_mode', v_row.edit_mode,
      'error', 'กรุณากรอกรหัสผ่านเข้าบ้านเพื่อดูผังตระกูล'
    );
  end if;

  -- ตรวจสิทธิ์การแก้ไข
  if v_is_admin then
    v_can_edit := true;
  elsif v_row.edit_mode = 'open' then
    v_can_edit := true;
  elsif v_row.edit_mode = 'pin' and coalesce(p_edit_pin, '') = v_row.edit_pin then
    v_can_edit := true;
  else
    v_can_edit := false;
  end if;

  return jsonb_build_object(
    'ok', true,
    'exists', true,
    'tree_data', v_row.tree_data,
    'theme_settings', v_row.theme_settings,
    'view_mode', v_row.view_mode,
    'edit_mode', v_row.edit_mode,
    'is_admin', v_is_admin,
    'can_edit', v_can_edit,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by
  );
end;
$$;

-- ============================================================================
-- RPC 3: บันทึกข้อมูลผังตระกูล (ตรวจสิทธิ์ล็อก/ปลดล็อกบน Server ทุกครั้ง)
-- ============================================================================
create or replace function public.save_family_tree(
  p_tree_id text,
  p_tree_data jsonb,
  p_theme_settings jsonb default null,
  p_edit_pin text default '',
  p_admin_pin text default '',
  p_editor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_trees%rowtype;
  v_is_admin boolean := false;
  v_now timestamptz := now();
begin
  select * into v_row from public.family_trees where id = p_tree_id;

  if not found then
    insert into public.family_trees (id, tree_data, theme_settings, updated_by, updated_at)
    values (p_tree_id, p_tree_data, p_theme_settings, p_editor_name, v_now);

    insert into public.family_tree_sync (tree_id, updated_by, updated_at)
    values (p_tree_id, p_editor_name, v_now)
    on conflict (tree_id) do update
      set updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;

    return jsonb_build_object('ok', true, 'updated_at', v_now);
  end if;

  v_is_admin := (coalesce(p_admin_pin, '') <> '' and p_admin_pin = v_row.admin_pin);

  if not v_is_admin then
    if v_row.edit_mode = 'locked' then
      return jsonb_build_object(
        'ok', false,
        'error', 'แอดมินได้ล็อกการแก้ไขชั่วคราว กรุณาติดต่อแอดมินเพื่อปลดล็อก'
      );
    elsif v_row.edit_mode = 'pin' and coalesce(p_edit_pin, '') <> v_row.edit_pin then
      return jsonb_build_object(
        'ok', false,
        'error', 'รหัสผ่านสำหรับแก้ไขไม่ถูกต้อง'
      );
    end if;
  end if;

  update public.family_trees
  set
    tree_data = p_tree_data,
    theme_settings = coalesce(p_theme_settings, theme_settings),
    updated_by = p_editor_name,
    updated_at = v_now
  where id = p_tree_id;

  insert into public.family_tree_sync (tree_id, updated_by, updated_at)
  values (p_tree_id, p_editor_name, v_now)
  on conflict (tree_id) do update
    set updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return jsonb_build_object('ok', true, 'updated_at', v_now);
end;
$$;

-- ============================================================================
-- RPC 4: ฟังก์ชันแอดมิน — ล็อก/ปลดล็อกสิทธิ์ดู, สิทธิ์แก้ไข, และเปลี่ยนรหัสผ่าน
-- ============================================================================
create or replace function public.update_tree_access_settings(
  p_tree_id text,
  p_admin_pin text,
  p_view_mode text,
  p_edit_mode text,
  p_new_view_pin text default null,
  p_new_edit_pin text default null,
  p_new_admin_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_trees%rowtype;
  v_now timestamptz := now();
begin
  select * into v_row from public.family_trees where id = p_tree_id;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'ยังไม่มีข้อมูลตระกูลบน Cloud กรุณากดซิงก์ข้อมูลขึ้น Cloud ก่อน'
    );
  end if;

  if coalesce(p_admin_pin, '') <> v_row.admin_pin then
    return jsonb_build_object('ok', false, 'error', 'รหัสผ่านแอดมินไม่ถูกต้อง');
  end if;

  update public.family_trees
  set
    view_mode = case when p_view_mode in ('public', 'pin') then p_view_mode else view_mode end,
    edit_mode = case when p_edit_mode in ('open', 'pin', 'locked') then p_edit_mode else edit_mode end,
    view_pin = case when coalesce(trim(p_new_view_pin), '') <> '' then trim(p_new_view_pin) else view_pin end,
    edit_pin = case when coalesce(trim(p_new_edit_pin), '') <> '' then trim(p_new_edit_pin) else edit_pin end,
    admin_pin = case when coalesce(trim(p_new_admin_pin), '') <> '' then trim(p_new_admin_pin) else admin_pin end,
    updated_at = v_now
  where id = p_tree_id;

  -- แจ้งเตือนทุกเครื่องที่เปิดอยู่ให้รีเฟรชสถานะสิทธิ์ทันที
  insert into public.family_tree_sync (tree_id, updated_by, updated_at)
  values (p_tree_id, 'admin_access_change', v_now)
  on conflict (tree_id) do update
    set updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'view_mode', p_view_mode,
    'edit_mode', p_edit_mode
  );
end;
$$;

-- อนุญาตให้ Client (anon / authenticated) เรียกใช้เฉพาะ RPC ทั้ง 4 ฟังก์ชันนี้
grant execute on function public.get_family_tree_status(text) to anon, authenticated;
grant execute on function public.get_family_tree(text, text, text, text) to anon, authenticated;
grant execute on function public.save_family_tree(text, jsonb, jsonb, text, text, text) to anon, authenticated;
grant execute on function public.update_tree_access_settings(text, text, text, text, text, text, text) to anon, authenticated;

-- ============================================================================
-- 5. Storage Bucket สำหรับเก็บรูปโปรไฟล์และอัลบั้มภาพครอบครัว (จุรูปได้เยอะมาก!)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('family-photos', 'family-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public view family photos" on storage.objects;
create policy "Public view family photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'family-photos');

drop policy if exists "Allow family upload photos" on storage.objects;
create policy "Allow family upload photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'family-photos');
