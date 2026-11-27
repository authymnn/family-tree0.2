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

-- 2b. ตารางเก็บประวัติสำรองข้อมูลอัตโนมัติทุกครั้งที่มีการบันทึก (กู้คืนย้อนหลังได้ตลอด!)
create table if not exists public.family_tree_history (
  id bigserial primary key,
  tree_id text not null references public.family_trees(id) on delete cascade,
  tree_data jsonb not null,
  member_count integer not null default 0,
  updated_by text,
  saved_at timestamptz not null default now()
);

create index if not exists idx_family_tree_history_tree_saved
  on public.family_tree_history (tree_id, saved_at desc);

alter table public.family_tree_history enable row level security;

-- ฟังก์ชันช่วยนับจำนวนสมาชิกใน JSON อย่างปลอดภัย
create or replace function public.count_tree_members(p_tree_data jsonb)
returns integer
language sql
immutable
as $$
  select case
    when p_tree_data is not null and jsonb_typeof(p_tree_data->'members') = 'object' then
      (select count(*)::integer from jsonb_object_keys(p_tree_data->'members'))
    else 0
  end;
$$;

-- ============================================================================
-- RPC 3: บันทึกข้อมูลผังตระกูล (พร้อมเกราะป้องกันข้อมูลทับกัน + เก็บประวัติอัตโนมัติ!)
-- ============================================================================
-- ลบ signature เก่าก่อนเพื่อป้องกันการเรียกข้ามเกราะป้องกันจากแท็บเก่าที่ค้างอยู่
drop function if exists public.save_family_tree(text, jsonb, jsonb, text, text, text);
drop function if exists public.save_family_tree(text, jsonb, jsonb, text, text, text, timestamptz, boolean);

create or replace function public.save_family_tree(
  p_tree_id text,
  p_tree_data jsonb,
  p_theme_settings jsonb default null,
  p_edit_pin text default '',
  p_admin_pin text default '',
  p_editor_name text default null,
  p_expected_updated_at timestamptz default null,
  p_force_overwrite boolean default false
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
  v_old_count integer := 0;
  v_new_count integer := 0;
begin
  select * into v_row from public.family_trees where id = p_tree_id for update;

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

  v_old_count := public.count_tree_members(v_row.tree_data);
  v_new_count := public.count_tree_members(p_tree_data);

  -- เกราะป้องกันชั้นที่ 1–3 (ยกเว้นกรณีแอดมินสั่งเขียนทับโดยตั้งใจ เช่น นำเข้าไฟล์/กู้คืน)
  if not (v_is_admin and coalesce(p_force_overwrite, false)) then
    -- 1) บล็อกแท็บเว็บเวอร์ชันเก่าที่ค้างไว้ (ไม่ได้ส่งเวลาอ้างอิง p_expected_updated_at)
    if p_expected_updated_at is null and v_old_count > 0 then
      return jsonb_build_object(
        'ok', false,
        'stale_client', true,
        'error', 'หน้าเว็บนี้เป็นเวอร์ชันเก่า กรุณากดรีเฟรชหน้าเว็บใหม่ก่อนแก้ไข เพื่อป้องกันข้อมูลทับกัน'
      );
    end if;

    -- 2) ตรวจการแก้ไขชนกันระดับเสี้ยววินาที (Optimistic Concurrency Control)
    if p_expected_updated_at is not null
       and abs(extract(epoch from (v_row.updated_at - p_expected_updated_at))) > 0.5 then
      return jsonb_build_object(
        'ok', false,
        'conflict', true,
        'server_updated_at', v_row.updated_at,
        'error', 'มีญาติเพิ่งบันทึกข้อมูลพร้อมกัน ระบบกำลังผสานข้อมูลให้อัตโนมัติ'
      );
    end if;

    -- 3) ป้องกันการลบหรือทำข้อมูลหายทีละหลายคนโดยไม่ตั้งใจ (ลดลงเกิน 2 คนพร้อมกัน)
    if v_old_count >= 5 and v_new_count < v_old_count - 2 then
      return jsonb_build_object(
        'ok', false,
        'error', 'ระบบป้องกันข้อมูลหาย: ไม่อนุญาตให้ลดจำนวนสมาชิกทีละหลายคนพร้อมกัน (ต้องทำผ่านสิทธิ์แอดมินเท่านั้น)'
      );
    end if;
  end if;

  -- บันทึกสำเนาเวอร์ชันก่อนหน้าเก็บไว้ในตารางประวัติอัตโนมัติ (ก่อนเขียนทับทุกครั้ง!)
  insert into public.family_tree_history (tree_id, tree_data, member_count, updated_by, saved_at)
  values (p_tree_id, v_row.tree_data, v_old_count, v_row.updated_by, v_row.updated_at);

  -- เก็บประวัติย้อนหลังล่าสุดไว้ 80 เวอร์ชันต่อผังตระกูล
  delete from public.family_tree_history
  where tree_id = p_tree_id
    and id not in (
      select id from public.family_tree_history
      where tree_id = p_tree_id
      order by saved_at desc, id desc
      limit 80
    );

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

-- ============================================================================
-- RPC 5: แอดมิน — ดูรายการประวัติสำรองข้อมูลย้อนหลัง (Version History)
-- ============================================================================
create or replace function public.get_family_tree_history(
  p_tree_id text,
  p_admin_pin text,
  p_limit integer default 40
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_trees%rowtype;
  v_items jsonb;
begin
  select * into v_row from public.family_trees where id = p_tree_id;
  if not found then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb);
  end if;

  if coalesce(p_admin_pin, '') <> v_row.admin_pin then
    return jsonb_build_object('ok', false, 'error', 'รหัสผ่านแอดมินไม่ถูกต้อง');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'member_count', h.member_count,
        'clan_name', coalesce(h.tree_data->>'clanName', 'ผังตระกูล'),
        'updated_by', h.updated_by,
        'saved_at', h.saved_at
      )
      order by h.saved_at desc, h.id desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select id, tree_data, member_count, updated_by, saved_at
    from public.family_tree_history
    where tree_id = p_tree_id
    order by saved_at desc, id desc
    limit greatest(1, least(coalesce(p_limit, 40), 80))
  ) h;

  return jsonb_build_object('ok', true, 'items', v_items);
end;
$$;

-- ============================================================================
-- RPC 6: แอดมิน — กู้คืนข้อมูลย้อนหลัง 1 คลิก (พร้อมสำรองข้อมูลปัจจุบันเก็บไว้ก่อน)
-- ============================================================================
create or replace function public.restore_family_tree_version(
  p_tree_id text,
  p_admin_pin text,
  p_history_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.family_trees%rowtype;
  v_hist public.family_tree_history%rowtype;
  v_now timestamptz := now();
begin
  select * into v_row from public.family_trees where id = p_tree_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ไม่พบข้อมูลผังตระกูล');
  end if;

  if coalesce(p_admin_pin, '') <> v_row.admin_pin then
    return jsonb_build_object('ok', false, 'error', 'รหัสผ่านแอดมินไม่ถูกต้อง');
  end if;

  select * into v_hist
  from public.family_tree_history
  where id = p_history_id and tree_id = p_tree_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'ไม่พบเวอร์ชันประวัติที่เลือก');
  end if;

  -- สำรองข้อมูลปัจจุบันเก็บไว้ในประวัติก่อนกู้คืน (สามารถย้อนกลับมาได้เสมอ!)
  insert into public.family_tree_history (tree_id, tree_data, member_count, updated_by, saved_at)
  values (
    p_tree_id,
    v_row.tree_data,
    public.count_tree_members(v_row.tree_data),
    coalesce(v_row.updated_by, 'ก่อนการกู้คืน'),
    v_row.updated_at
  );

  update public.family_trees
  set
    tree_data = v_hist.tree_data,
    updated_by = 'แอดมินกู้คืนข้อมูลย้อนหลัง',
    updated_at = v_now
  where id = p_tree_id;

  insert into public.family_tree_sync (tree_id, updated_by, updated_at)
  values (p_tree_id, 'แอดมินกู้คืนข้อมูลย้อนหลัง', v_now)
  on conflict (tree_id) do update
    set updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'updated_at', v_now,
    'restored_member_count', v_hist.member_count
  );
end;
$$;

-- อนุญาตให้ Client (anon / authenticated) เรียกใช้เฉพาะ RPC ทั้ง 6 ฟังก์ชันนี้
grant execute on function public.get_family_tree_status(text) to anon, authenticated;
grant execute on function public.get_family_tree(text, text, text, text) to anon, authenticated;
grant execute on function public.save_family_tree(text, jsonb, jsonb, text, text, text, timestamptz, boolean) to anon, authenticated;
grant execute on function public.update_tree_access_settings(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_family_tree_history(text, text, integer) to anon, authenticated;
grant execute on function public.restore_family_tree_version(text, text, bigint) to anon, authenticated;

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
