-- =====================================================================
-- FAHDAR | فَهْدَار — core schema
-- Owner: Fahad Mubarak
-- Security model:
--   * RLS on every table.
--   * Owner privileges come from profiles.role = 'owner', which no client
--     can write (column grants + trigger guard). Promotion is SQL-only.
--   * Usage limits (consultations / messages) are enforced inside
--     SECURITY DEFINER functions with row locks; clients have no direct
--     INSERT privilege on consultations or consultation_messages.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.app_role as enum ('user', 'owner');
create type public.request_status as enum
  ('new', 'under_review', 'needs_info', 'accepted', 'rejected', 'in_progress', 'completed');
create type public.project_type as enum
  ('mobile_app', 'website', 'platform', 'management_system', 'ecommerce', 'improvement', 'ai', 'other');
create type public.consultation_specialty as enum
  ('programming', 'web', 'mobile', 'ai', 'databases', 'cybersecurity', 'tools', 'general');
create type public.consultation_status as enum ('open', 'answered', 'closed');
create type public.portfolio_status as enum ('idea', 'in_progress', 'completed', 'paused');

-- ---------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '' check (char_length(full_name) <= 80),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  locale      text not null default 'ar' check (locale in ('ar', 'en')),
  role        public.app_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Owner check used by every policy. SECURITY DEFINER so it can read
-- profiles regardless of the caller's RLS view.
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'owner'
  );
$$;

-- Guard: nobody but a superuser/service context may change role or email.
create or replace function private.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role then
      raise exception 'ROLE_CHANGE_FORBIDDEN' using errcode = '42501';
    end if;
    if new.email is distinct from old.email or new.id is distinct from old.id then
      raise exception 'FIELD_READ_ONLY' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'ar' end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.sync_user_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.sync_user_email();

-- Promotion is only possible from the SQL editor / service context.
create or replace function private.promote_to_owner(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = 'owner' where lower(email) = lower(p_email);
  if not found then
    raise exception 'No profile with email %', p_email;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- admin_settings (singleton)
-- ---------------------------------------------------------------------
create table public.admin_settings (
  id                         smallint primary key default 1 check (id = 1),
  requests_enabled           boolean not null default true,
  requests_paused_message    text not null default '' check (char_length(requests_paused_message) <= 300),
  consultations_enabled      boolean not null default true,
  consultations_per_month    int not null default 2 check (consultations_per_month between 0 and 100),
  messages_per_consultation  int not null default 5 check (messages_per_consultation between 1 and 100),
  max_open_requests          int not null default 5 check (max_open_requests between 1 and 100),
  max_attachment_mb          int not null default 10 check (max_attachment_mb between 1 and 50),
  quota_timezone             text not null default 'Asia/Riyadh',
  updated_at                 timestamptz not null default now()
);
insert into public.admin_settings (id) values (1);
create trigger admin_settings_touch before update on public.admin_settings
  for each row execute function private.touch_updated_at();

create or replace function private.validate_timezone()
returns trigger language plpgsql as $$
begin
  perform now() at time zone new.quota_timezone;
  return new;
exception when others then
  raise exception 'INVALID_TIMEZONE' using errcode = '22023';
end $$;
create trigger admin_settings_tz before insert or update on public.admin_settings
  for each row execute function private.validate_timezone();

-- ---------------------------------------------------------------------
-- owner_profile (public identity, singleton) — no invented content.
-- ---------------------------------------------------------------------
create table public.owner_profile (
  id                 smallint primary key default 1 check (id = 1),
  full_name          text not null default 'فهد مبارك' check (char_length(full_name) <= 80),
  full_name_en       text not null default 'Fahad Mubarak' check (char_length(full_name_en) <= 80),
  headline           text not null default '' check (char_length(headline) <= 160),
  headline_en        text not null default '' check (char_length(headline_en) <= 160),
  bio                text not null default '' check (char_length(bio) <= 4000),
  bio_en             text not null default '' check (char_length(bio_en) <= 4000),
  avatar_url         text check (avatar_url is null or char_length(avatar_url) <= 500),
  interests          text[] not null default '{}',
  skills             text[] not null default '{}',
  programming_areas  text[] not null default '{}',
  social_links       jsonb not null default '[]'::jsonb check (jsonb_typeof(social_links) = 'array'),
  contact_email      text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at         timestamptz not null default now()
);
insert into public.owner_profile (id) values (1);
create trigger owner_profile_touch before update on public.owner_profile
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Portfolio content
-- ---------------------------------------------------------------------
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 2 and 120),
  title_en        text not null default '' check (char_length(title_en) <= 120),
  summary         text not null default '' check (char_length(summary) <= 300),
  summary_en      text not null default '' check (char_length(summary_en) <= 300),
  description     text not null default '' check (char_length(description) <= 8000),
  description_en  text not null default '' check (char_length(description_en) <= 8000),
  idea            text not null default '' check (char_length(idea) <= 3000),
  idea_en         text not null default '' check (char_length(idea_en) <= 3000),
  category        text not null default '' check (char_length(category) <= 60),
  technologies    text[] not null default '{}',
  status          public.portfolio_status not null default 'completed',
  cover_url       text check (cover_url is null or char_length(cover_url) <= 500),
  gallery         text[] not null default '{}',
  link            text check (link is null or link ~* '^https?://'),
  is_published    boolean not null default false,
  is_featured     boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index projects_public_idx on public.projects (is_published, sort_order, created_at desc);
create trigger projects_touch before update on public.projects
  for each row execute function private.touch_updated_at();

create table public.achievements (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 2 and 160),
  title_en        text not null default '' check (char_length(title_en) <= 160),
  description     text not null default '' check (char_length(description) <= 1000),
  description_en  text not null default '' check (char_length(description_en) <= 1000),
  achieved_on     date,
  link            text check (link is null or link ~* '^https?://'),
  is_published    boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create table public.site_updates (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 2 and 160),
  title_en      text not null default '' check (char_length(title_en) <= 160),
  body          text not null default '' check (char_length(body) <= 2000),
  body_en       text not null default '' check (char_length(body_en) <= 2000),
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Project requests
-- ---------------------------------------------------------------------
create sequence public.request_number_seq start 1001;

create table public.project_requests (
  id              uuid primary key default gen_random_uuid(),
  request_number  text not null unique,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  project_name    text not null check (char_length(btrim(project_name)) between 2 and 120),
  description     text not null check (char_length(btrim(description)) between 20 and 5000),
  project_type    public.project_type not null,
  platforms       text[] not null default '{}'
                  check (platforms <@ array['android','ios','web','desktop','other']::text[]),
  budget          text check (budget is null or char_length(budget) <= 100),
  timeline        text check (timeline is null or char_length(timeline) <= 100),
  contact_name    text not null check (char_length(btrim(contact_name)) between 2 and 80),
  contact_email   text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone   text check (contact_phone is null or contact_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  status          public.request_status not null default 'new',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index project_requests_user_idx on public.project_requests (user_id, created_at desc);
create index project_requests_status_idx on public.project_requests (status, created_at desc);
create trigger project_requests_touch before update on public.project_requests
  for each row execute function private.touch_updated_at();

create or replace function private.before_request_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.admin_settings;
  open_count int;
begin
  select * into s from public.admin_settings where id = 1;
  if not s.requests_enabled and not public.is_owner() then
    raise exception 'REQUESTS_PAUSED' using errcode = 'P0001';
  end if;
  -- serialize per user so the open-request cap cannot be raced
  perform pg_advisory_xact_lock(hashtextextended('req:' || new.user_id::text, 0));
  select count(*) into open_count from public.project_requests
   where user_id = new.user_id
     and status in ('new', 'under_review', 'needs_info', 'accepted', 'in_progress');
  if open_count >= s.max_open_requests then
    raise exception 'OPEN_REQUESTS_LIMIT' using errcode = 'P0001';
  end if;
  new.status := 'new';
  new.created_at := now();
  new.updated_at := now();
  new.project_name := btrim(new.project_name);
  new.request_number := 'FHD-' || to_char(now(), 'YY') || '-'
                        || lpad(nextval('public.request_number_seq')::text, 5, '0');
  return new;
end $$;
create trigger project_requests_before_insert before insert on public.project_requests
  for each row execute function private.before_request_insert();

-- Request conversation & status timeline
create table public.request_messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.project_requests (id) on delete cascade,
  sender_id   uuid references public.profiles (id) on delete set null,
  is_owner    boolean not null default false,
  kind        text not null default 'message' check (kind in ('message', 'status')),
  new_status  public.request_status,
  body        text not null default '' check (char_length(body) <= 4000),
  created_at  timestamptz not null default now()
);
create index request_messages_req_idx on public.request_messages (request_id, created_at);

create or replace function private.before_request_message_insert()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.sender_id := auth.uid();
    new.is_owner := public.is_owner();
    new.kind := 'message';
    new.new_status := null;
    new.created_at := now();
    if char_length(btrim(new.body)) < 1 then
      raise exception 'EMPTY_MESSAGE' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger request_messages_before_insert before insert on public.request_messages
  for each row execute function private.before_request_message_insert();

-- ---------------------------------------------------------------------
-- Consultations
-- ---------------------------------------------------------------------
create table public.consultations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  specialty           public.consultation_specialty not null,
  subject             text not null check (char_length(btrim(subject)) between 3 and 150),
  status              public.consultation_status not null default 'open',
  user_message_count  int not null default 0 check (user_message_count >= 0),
  message_limit       int not null check (message_limit between 1 and 100),
  closed_at           timestamptz,
  closed_by           uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index consultations_user_idx on public.consultations (user_id, created_at desc);
create index consultations_status_idx on public.consultations (status, updated_at desc);
create trigger consultations_touch before update on public.consultations
  for each row execute function private.touch_updated_at();

create table public.consultation_messages (
  id               uuid primary key default gen_random_uuid(),
  consultation_id  uuid not null references public.consultations (id) on delete cascade,
  sender_id        uuid references public.profiles (id) on delete set null,
  is_owner         boolean not null default false,
  body             text not null default '' check (char_length(body) <= 4000),
  created_at       timestamptz not null default now()
);
create index consultation_messages_c_idx on public.consultation_messages (consultation_id, created_at);

-- Per-user, per-month overrides granted by the owner (e.g. extra consultations).
create table public.usage_limits (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  period_start         date not null,
  extra_consultations  int not null default 0 check (extra_consultations between 0 and 100),
  note                 text not null default '' check (char_length(note) <= 300),
  created_at           timestamptz not null default now(),
  unique (user_id, period_start)
);

-- ---------------------------------------------------------------------
-- Attachments (files live in the private "attachments" bucket)
-- ---------------------------------------------------------------------
create table public.attachments (
  id                       uuid primary key default gen_random_uuid(),
  uploaded_by              uuid references public.profiles (id) on delete cascade,
  path                     text not null unique check (char_length(path) <= 300),
  file_name                text not null check (char_length(file_name) between 1 and 200),
  mime_type                text not null check (char_length(mime_type) <= 100),
  size_bytes               bigint not null check (size_bytes > 0),
  request_id               uuid references public.project_requests (id) on delete cascade,
  consultation_id          uuid references public.consultations (id) on delete cascade,
  consultation_message_id  uuid references public.consultation_messages (id) on delete cascade,
  created_at               timestamptz not null default now()
);
create index attachments_request_idx on public.attachments (request_id);
create index attachments_consultation_idx on public.attachments (consultation_id);
create index attachments_uploader_idx on public.attachments (uploaded_by, created_at desc);

create or replace function private.before_attachment_insert()
returns trigger language plpgsql as $$
declare
  max_mb int;
begin
  if current_user in ('authenticated', 'anon') then
    new.uploaded_by := auth.uid();
    new.consultation_id := null;          -- linked only by send/start RPCs
    new.consultation_message_id := null;
    new.created_at := now();
    if split_part(new.path, '/', 1) <> auth.uid()::text then
      raise exception 'INVALID_PATH' using errcode = '42501';
    end if;
  end if;
  select max_attachment_mb into max_mb from public.admin_settings where id = 1;
  if new.size_bytes > max_mb::bigint * 1024 * 1024 then
    raise exception 'FILE_TOO_LARGE' using errcode = '22023';
  end if;
  if new.mime_type !~ '^(image/(png|jpeg|webp|gif|heic)|application/pdf|text/plain|application/zip|application/(msword|vnd\.openxmlformats-officedocument\.[a-z.]+)|application/vnd\.ms-(excel|powerpoint))$' then
    raise exception 'FILE_TYPE_NOT_ALLOWED' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger attachments_before_insert before insert on public.attachments
  for each row execute function private.before_attachment_insert();

-- ---------------------------------------------------------------------
-- Notifications & push tokens
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null check (char_length(type) <= 40),
  title       text not null check (char_length(title) <= 160),
  body        text not null default '' check (char_length(body) <= 1000),
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  token       text primary key check (char_length(token) between 10 and 300),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------
-- Activity log (owner-only reading; written by triggers / RPCs)
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);

create or replace function private.log_activity(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- Private config (push dispatch); not exposed through the API.
-- ---------------------------------------------------------------------
create table private.app_config (
  key    text primary key,
  value  text not null
);

-- ---------------------------------------------------------------------
-- Localised notification text + delivery
-- ---------------------------------------------------------------------
create or replace function private.status_label(p_status public.request_status, p_locale text)
returns text language sql immutable as $$
  select case when p_locale = 'en' then
    case p_status
      when 'new' then 'New' when 'under_review' then 'Under review'
      when 'needs_info' then 'Needs more information' when 'accepted' then 'Accepted'
      when 'rejected' then 'Rejected' when 'in_progress' then 'In progress'
      when 'completed' then 'Completed' end
  else
    case p_status
      when 'new' then 'جديد' when 'under_review' then 'قيد المراجعة'
      when 'needs_info' then 'يحتاج معلومات إضافية' when 'accepted' then 'مقبول'
      when 'rejected' then 'مرفوض' when 'in_progress' then 'قيد التنفيذ'
      when 'completed' then 'مكتمل' end
  end;
$$;

create or replace function private.notify(p_user uuid, p_type text, p_data jsonb, p_title text default null, p_body text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  loc text;
  t text;
  b text;
  ref text := coalesce(p_data ->> 'request_number', p_data ->> 'subject', '');
begin
  select locale into loc from public.profiles where id = p_user;
  if not found then return; end if;
  if p_title is not null then
    t := p_title; b := coalesce(p_body, '');
  elsif loc = 'en' then
    case p_type
      when 'request_received' then t := 'Request received'; b := 'Your request ' || ref || ' was received. We''ll review it soon.';
      when 'request_status'   then t := 'Request status updated'; b := ref || ': ' || private.status_label((p_data ->> 'status')::public.request_status, 'en');
      when 'request_accepted' then t := 'Request accepted'; b := 'Great news! Request ' || ref || ' was accepted.';
      when 'request_rejected' then t := 'Request declined'; b := 'Request ' || ref || ' was declined. Check the details in the app.';
      when 'request_needs_info' then t := 'More information needed'; b := 'Request ' || ref || ' needs additional information from you.';
      when 'request_reply'    then t := 'New reply on your request'; b := 'You have a new reply on request ' || ref || '.';
      when 'consultation_reply' then t := 'New reply to your consultation'; b := ref;
      when 'consultation_closed' then t := 'Consultation closed'; b := ref;
      when 'owner_new_request' then t := 'New project request'; b := ref;
      when 'owner_request_message' then t := 'New message on a request'; b := ref;
      when 'owner_new_consultation' then t := 'New consultation'; b := ref;
      when 'owner_consultation_message' then t := 'New consultation message'; b := ref;
      else t := 'FAHDAR'; b := '';
    end case;
  else
    case p_type
      when 'request_received' then t := 'تم استلام طلبك'; b := 'استلمنا طلبك ' || ref || ' وسيتم مراجعته قريباً.';
      when 'request_status'   then t := 'تحديث حالة الطلب'; b := ref || ': ' || private.status_label((p_data ->> 'status')::public.request_status, 'ar');
      when 'request_accepted' then t := 'تم قبول طلبك'; b := 'أخبار رائعة! تم قبول الطلب ' || ref || '.';
      when 'request_rejected' then t := 'تم الاعتذار عن الطلب'; b := 'تم الاعتذار عن الطلب ' || ref || '. اطّلع على التفاصيل في التطبيق.';
      when 'request_needs_info' then t := 'مطلوب معلومات إضافية'; b := 'الطلب ' || ref || ' يحتاج إلى معلومات إضافية منك.';
      when 'request_reply'    then t := 'رد جديد على طلبك'; b := 'لديك رد جديد على الطلب ' || ref || '.';
      when 'consultation_reply' then t := 'رد جديد على استشارتك'; b := ref;
      when 'consultation_closed' then t := 'تم إغلاق الاستشارة'; b := ref;
      when 'owner_new_request' then t := 'طلب مشروع جديد'; b := ref;
      when 'owner_request_message' then t := 'رسالة جديدة على طلب'; b := ref;
      when 'owner_new_consultation' then t := 'استشارة جديدة'; b := ref;
      when 'owner_consultation_message' then t := 'رسالة استشارة جديدة'; b := ref;
      else t := 'فَهْدَار'; b := '';
    end case;
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, left(t, 160), left(coalesce(b, ''), 1000), coalesce(p_data, '{}'::jsonb));
end $$;

create or replace function private.notify_owners(p_type text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select id from public.profiles where role = 'owner' loop
    perform private.notify(r.id, p_type, p_data);
  end loop;
end $$;

-- Push: after a notification row is stored, call the push-dispatch Edge
-- Function through pg_net (if configured in private.app_config).
create or replace function private.dispatch_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  fn_url text;
  secret text;
begin
  select value into fn_url from private.app_config where key = 'push_function_url';
  select value into secret from private.app_config where key = 'push_webhook_secret';
  if fn_url is null or secret is null then
    return new;
  end if;
  if not exists (select 1 from public.push_tokens where user_id = new.user_id) then
    return new;
  end if;
  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret)
  );
  return new;
exception when others then
  -- never block the business transaction because push failed
  return new;
end $$;
create trigger notifications_dispatch_push after insert on public.notifications
  for each row execute function private.dispatch_push();

-- ---------------------------------------------------------------------
-- Business triggers: notifications + activity
-- ---------------------------------------------------------------------
create or replace function private.after_request_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb := jsonb_build_object('request_id', new.id, 'request_number', new.request_number);
begin
  perform private.notify(new.user_id, 'request_received', d);
  perform private.notify_owners('owner_new_request', d || jsonb_build_object('subject', new.request_number || ' — ' || new.project_name));
  perform private.log_activity('request.created', 'project_request', new.id::text,
    jsonb_build_object('number', new.request_number, 'type', new.project_type));
  return new;
end $$;
create trigger project_requests_after_insert after insert on public.project_requests
  for each row execute function private.after_request_insert();

create or replace function private.after_request_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  d jsonb := jsonb_build_object('request_id', new.id, 'request_number', new.request_number, 'status', new.status);
  ntype text;
begin
  if new.status is distinct from old.status then
    insert into public.request_messages (request_id, sender_id, is_owner, kind, new_status, body)
    values (new.id, auth.uid(), true, 'status', new.status, '');
    ntype := case new.status
      when 'accepted' then 'request_accepted'
      when 'rejected' then 'request_rejected'
      when 'needs_info' then 'request_needs_info'
      else 'request_status' end;
    perform private.notify(new.user_id, ntype, d);
    perform private.log_activity('request.status_changed', 'project_request', new.id::text,
      jsonb_build_object('number', new.request_number, 'from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger project_requests_after_status after update of status on public.project_requests
  for each row execute function private.after_request_status();

create or replace function private.after_request_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  req public.project_requests;
  d jsonb;
begin
  if new.kind <> 'message' then return new; end if;
  select * into req from public.project_requests where id = new.request_id;
  d := jsonb_build_object('request_id', req.id, 'request_number', req.request_number);
  if new.is_owner then
    perform private.notify(req.user_id, 'request_reply', d);
  else
    perform private.notify_owners('owner_request_message', d || jsonb_build_object('subject', req.request_number || ' — ' || req.project_name));
  end if;
  return new;
end $$;
create trigger request_messages_after_insert after insert on public.request_messages
  for each row execute function private.after_request_message();

-- ---------------------------------------------------------------------
-- Owner-only content audit (projects, achievements, updates, settings)
-- ---------------------------------------------------------------------
create or replace function private.audit_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rid text;
  lbl text;
begin
  if tg_op = 'DELETE' then
    rid := old.id::text;
  else
    rid := new.id::text;
  end if;
  lbl := case when tg_op = 'DELETE' then to_jsonb(old) ->> 'title' else to_jsonb(new) ->> 'title' end;
  perform private.log_activity(tg_table_name || '.' || lower(tg_op), tg_table_name, rid,
    case when lbl is null then '{}'::jsonb else jsonb_build_object('title', lbl) end);
  return null;
end $$;
create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function private.audit_content();
create trigger achievements_audit after insert or update or delete on public.achievements
  for each row execute function private.audit_content();
create trigger site_updates_audit after insert or update or delete on public.site_updates
  for each row execute function private.audit_content();
create trigger admin_settings_audit after update on public.admin_settings
  for each row execute function private.audit_content();
create trigger owner_profile_audit after update on public.owner_profile
  for each row execute function private.audit_content();

-- ---------------------------------------------------------------------
-- Quota helpers & consultation RPCs
-- ---------------------------------------------------------------------
create or replace function private.period_start(p_tz text)
returns timestamptz language sql stable as $$
  select date_trunc('month', now() at time zone p_tz) at time zone p_tz;
$$;

create or replace function public.my_consultation_quota()
returns table (
  used int,
  monthly_limit int,
  extra int,
  remaining int,
  messages_per_consultation int,
  resets_at timestamptz,
  enabled boolean
) language plpgsql stable security definer set search_path = '' as $$
declare
  s public.admin_settings;
  p_start timestamptz;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into s from public.admin_settings where id = 1;
  p_start := private.period_start(s.quota_timezone);
  select count(*)::int into used from public.consultations c
   where c.user_id = uid and c.created_at >= p_start;
  select coalesce(sum(u.extra_consultations), 0)::int into extra from public.usage_limits u
   where u.user_id = uid and u.period_start = (p_start at time zone s.quota_timezone)::date;
  monthly_limit := s.consultations_per_month;
  remaining := greatest(monthly_limit + extra - used, 0);
  messages_per_consultation := s.messages_per_consultation;
  resets_at := (date_trunc('month', now() at time zone s.quota_timezone) + interval '1 month') at time zone s.quota_timezone;
  enabled := s.consultations_enabled;
  return next;
end $$;

create or replace function private.link_message_attachments(p_ids uuid[], p_consultation uuid, p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare linked int;
begin
  if p_ids is null or cardinality(p_ids) = 0 then return; end if;
  if cardinality(p_ids) > 5 then
    raise exception 'TOO_MANY_ATTACHMENTS' using errcode = '22023';
  end if;
  update public.attachments
     set consultation_id = p_consultation, consultation_message_id = p_message
   where id = any (p_ids)
     and uploaded_by = auth.uid()
     and consultation_id is null and request_id is null;
  get diagnostics linked = row_count;
  if linked <> cardinality(p_ids) then
    raise exception 'INVALID_ATTACHMENTS' using errcode = '22023';
  end if;
end $$;

create or replace function public.start_consultation(
  p_specialty public.consultation_specialty,
  p_subject text,
  p_body text,
  p_attachment_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  s public.admin_settings;
  q record;
  cid uuid;
  mid uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_subject, ''))) < 3 or char_length(p_subject) > 150 then
    raise exception 'INVALID_SUBJECT' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 10 or char_length(p_body) > 4000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;
  select * into s from public.admin_settings where id = 1;
  if not s.consultations_enabled then
    raise exception 'CONSULTATIONS_PAUSED' using errcode = 'P0001';
  end if;
  -- serialize concurrent calls for the same user
  perform pg_advisory_xact_lock(hashtextextended('cons:' || uid::text, 0));
  select * into q from public.my_consultation_quota();
  if q.remaining <= 0 then
    raise exception 'MONTHLY_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.consultations (user_id, specialty, subject, status, user_message_count, message_limit)
  values (uid, p_specialty, btrim(p_subject), 'open', 1, s.messages_per_consultation)
  returning id into cid;
  insert into public.consultation_messages (consultation_id, sender_id, is_owner, body)
  values (cid, uid, false, btrim(p_body))
  returning id into mid;
  perform private.link_message_attachments(p_attachment_ids, cid, mid);

  perform private.notify_owners('owner_new_consultation',
    jsonb_build_object('consultation_id', cid, 'subject', btrim(p_subject)));
  perform private.log_activity('consultation.created', 'consultation', cid::text,
    jsonb_build_object('specialty', p_specialty));
  return cid;
end $$;

create or replace function public.send_consultation_message(
  p_consultation_id uuid,
  p_body text,
  p_attachment_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_owner boolean := public.is_owner();
  c public.consultations;
  mid uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 1 and coalesce(cardinality(p_attachment_ids), 0) = 0 then
    raise exception 'EMPTY_MESSAGE' using errcode = '22023';
  end if;
  if char_length(coalesce(p_body, '')) > 4000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;

  select * into c from public.consultations where id = p_consultation_id for update;
  if not found or (c.user_id <> uid and not v_owner) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if c.status = 'closed' then
    raise exception 'CONSULTATION_CLOSED' using errcode = 'P0001';
  end if;

  if v_owner and c.user_id <> uid then
    update public.consultations set status = 'answered' where id = c.id;
  else
    if c.user_message_count >= c.message_limit then
      raise exception 'MESSAGE_LIMIT_REACHED' using errcode = 'P0001';
    end if;
    update public.consultations
       set user_message_count = user_message_count + 1, status = 'open'
     where id = c.id;
  end if;

  insert into public.consultation_messages (consultation_id, sender_id, is_owner, body)
  values (c.id, uid, v_owner and c.user_id <> uid, btrim(coalesce(p_body, '')))
  returning id into mid;
  perform private.link_message_attachments(p_attachment_ids, c.id, mid);

  if v_owner and c.user_id <> uid then
    perform private.notify(c.user_id, 'consultation_reply',
      jsonb_build_object('consultation_id', c.id, 'subject', c.subject));
  else
    perform private.notify_owners('owner_consultation_message',
      jsonb_build_object('consultation_id', c.id, 'subject', c.subject));
  end if;
  return mid;
end $$;

create or replace function public.close_consultation(p_consultation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_owner boolean := public.is_owner();
  c public.consultations;
begin
  select * into c from public.consultations where id = p_consultation_id for update;
  if not found or (c.user_id <> uid and not v_owner) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if c.status = 'closed' then return; end if;
  update public.consultations
     set status = 'closed', closed_at = now(), closed_by = uid
   where id = c.id;
  if v_owner and c.user_id <> uid then
    perform private.notify(c.user_id, 'consultation_closed',
      jsonb_build_object('consultation_id', c.id, 'subject', c.subject));
  end if;
  perform private.log_activity('consultation.closed', 'consultation', c.id::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- Owner RPCs
-- ---------------------------------------------------------------------
create or replace function private.assert_owner()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end $$;

create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  s public.admin_settings;
  p_start timestamptz;
begin
  perform private.assert_owner();
  select * into s from public.admin_settings where id = 1;
  p_start := private.period_start(s.quota_timezone);
  return jsonb_build_object(
    'users_total',            (select count(*) from public.profiles where role = 'user'),
    'users_this_month',       (select count(*) from public.profiles where role = 'user' and created_at >= p_start),
    'requests_total',         (select count(*) from public.project_requests),
    'requests_new',           (select count(*) from public.project_requests where status = 'new'),
    'requests_in_progress',   (select count(*) from public.project_requests where status = 'in_progress'),
    'requests_pending',       (select count(*) from public.project_requests where status in ('under_review','needs_info','accepted')),
    'requests_completed',     (select count(*) from public.project_requests where status = 'completed'),
    'consultations_open',     (select count(*) from public.consultations where status = 'open'),
    'consultations_answered', (select count(*) from public.consultations where status = 'answered'),
    'consultations_total',    (select count(*) from public.consultations),
    'messages_total',         (select count(*) from public.consultation_messages) + (select count(*) from public.request_messages where kind = 'message'),
    'projects_total',         (select count(*) from public.projects),
    'attachments_total',      (select count(*) from public.attachments),
    'attachments_bytes',      (select coalesce(sum(size_bytes), 0) from public.attachments)
  );
end $$;

create or replace function public.admin_broadcast(p_title text, p_body text, p_user_id uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  r record;
begin
  perform private.assert_owner();
  if char_length(btrim(coalesce(p_title, ''))) < 2 or char_length(p_title) > 160 then
    raise exception 'INVALID_TITLE' using errcode = '22023';
  end if;
  if char_length(coalesce(p_body, '')) > 1000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;
  for r in select id from public.profiles where (p_user_id is null or id = p_user_id) loop
    perform private.notify(r.id, 'broadcast', '{}'::jsonb, btrim(p_title), coalesce(p_body, ''));
    n := n + 1;
  end loop;
  perform private.log_activity('notification.broadcast', 'notification', null,
    jsonb_build_object('title', p_title, 'recipients', n, 'target', p_user_id));
  return n;
end $$;

create or replace function public.admin_grant_extra_consultations(p_user_id uuid, p_extra int, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare s public.admin_settings;
begin
  perform private.assert_owner();
  select * into s from public.admin_settings where id = 1;
  insert into public.usage_limits (user_id, period_start, extra_consultations, note)
  values (p_user_id, (private.period_start(s.quota_timezone) at time zone s.quota_timezone)::date, p_extra, coalesce(p_note, ''))
  on conflict (user_id, period_start)
  do update set extra_consultations = excluded.extra_consultations, note = excluded.note;
  perform private.log_activity('usage.extra_granted', 'profile', p_user_id::text, jsonb_build_object('extra', p_extra));
end $$;

-- Registers an Expo push token for the caller (moves it if another user had it).
create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

-- ---------------------------------------------------------------------
-- Attachment read check (used by storage policies)
-- ---------------------------------------------------------------------
create or replace function public.can_read_attachment(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_owner()
      or split_part(p_path, '/', 1) = (select auth.uid())::text
      or exists (
        select 1 from public.attachments a
        left join public.project_requests r on r.id = a.request_id
        left join public.consultations c on c.id = a.consultation_id
        where a.path = p_path
          and (r.user_id = (select auth.uid()) or c.user_id = (select auth.uid()))
      );
$$;

-- =====================================================================
-- Privileges: start from nothing, grant only what each role needs.
-- =====================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Public (anon + authenticated) read of published content
grant select on public.owner_profile, public.projects, public.achievements,
               public.site_updates, public.admin_settings to anon, authenticated;
grant execute on function public.is_owner() to anon, authenticated;
grant execute on function public.can_read_attachment(text) to authenticated;

-- Owner write on content (RLS restricts to owner)
grant insert, update, delete on public.projects, public.achievements, public.site_updates to authenticated;
grant update on public.owner_profile, public.admin_settings to authenticated;

-- profiles: users may only touch harmless columns
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, locale) on public.profiles to authenticated;

-- requests
grant select on public.project_requests to authenticated;
grant insert (project_name, description, project_type, platforms, budget, timeline,
              contact_name, contact_email, contact_phone, user_id)
  on public.project_requests to authenticated;
grant update (status) on public.project_requests to authenticated;
grant usage on sequence public.request_number_seq to authenticated;
grant select, insert on public.request_messages to authenticated;

-- consultations: read-only tables; writes go through RPCs
grant select on public.consultations, public.consultation_messages to authenticated;
grant update (message_limit) on public.consultations to authenticated;
grant select on public.usage_limits to authenticated;
grant insert, update, delete on public.usage_limits to authenticated;

-- attachments
grant select, delete on public.attachments to authenticated;
grant insert (path, file_name, mime_type, size_bytes, request_id) on public.attachments to authenticated;

-- notifications & tokens
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, delete on public.push_tokens to authenticated;

-- activity log (owner only via RLS)
grant select on public.activity_logs to authenticated;

-- RPCs
grant execute on function public.my_consultation_quota() to authenticated;
grant execute on function public.start_consultation(public.consultation_specialty, text, text, uuid[]) to authenticated;
grant execute on function public.send_consultation_message(uuid, text, uuid[]) to authenticated;
grant execute on function public.close_consultation(uuid) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_broadcast(text, text, uuid) to authenticated;
grant execute on function public.admin_grant_extra_consultations(uuid, int, text) to authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;

-- service_role keeps full access for Edge Functions
grant all on all tables in schema public to service_role;
grant usage on schema private to service_role;
grant select on private.app_config to service_role;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles              enable row level security;
alter table public.admin_settings        enable row level security;
alter table public.owner_profile         enable row level security;
alter table public.projects              enable row level security;
alter table public.achievements          enable row level security;
alter table public.site_updates          enable row level security;
alter table public.project_requests      enable row level security;
alter table public.request_messages      enable row level security;
alter table public.consultations         enable row level security;
alter table public.consultation_messages enable row level security;
alter table public.usage_limits          enable row level security;
alter table public.attachments           enable row level security;
alter table public.notifications         enable row level security;
alter table public.push_tokens           enable row level security;
alter table public.activity_logs         enable row level security;
alter table private.app_config           enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_owner());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- singletons & content
create policy settings_read on public.admin_settings for select to anon, authenticated using (true);
create policy settings_owner_update on public.admin_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy owner_profile_read on public.owner_profile for select to anon, authenticated using (true);
create policy owner_profile_update on public.owner_profile for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy projects_read on public.projects for select to anon, authenticated
  using (is_published or public.is_owner());
create policy projects_owner_insert on public.projects for insert to authenticated with check (public.is_owner());
create policy projects_owner_update on public.projects for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy projects_owner_delete on public.projects for delete to authenticated using (public.is_owner());

create policy achievements_read on public.achievements for select to anon, authenticated
  using (is_published or public.is_owner());
create policy achievements_owner_insert on public.achievements for insert to authenticated with check (public.is_owner());
create policy achievements_owner_update on public.achievements for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy achievements_owner_delete on public.achievements for delete to authenticated using (public.is_owner());

create policy updates_read on public.site_updates for select to anon, authenticated
  using (is_published or public.is_owner());
create policy updates_owner_insert on public.site_updates for insert to authenticated with check (public.is_owner());
create policy updates_owner_update on public.site_updates for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy updates_owner_delete on public.site_updates for delete to authenticated using (public.is_owner());

-- project requests
create policy requests_select on public.project_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner());
create policy requests_insert on public.project_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy requests_owner_update on public.project_requests for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy request_messages_select on public.request_messages for select to authenticated
  using (public.is_owner() or exists (
    select 1 from public.project_requests r
    where r.id = request_id and r.user_id = (select auth.uid())));
create policy request_messages_insert on public.request_messages for insert to authenticated
  with check (public.is_owner() or exists (
    select 1 from public.project_requests r
    where r.id = request_id and r.user_id = (select auth.uid())
      and r.status not in ('rejected', 'completed')));

-- consultations (no insert/delete policies: RPC only)
create policy consultations_select on public.consultations for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner());
create policy consultations_owner_update on public.consultations for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy consultation_messages_select on public.consultation_messages for select to authenticated
  using (public.is_owner() or exists (
    select 1 from public.consultations c
    where c.id = consultation_id and c.user_id = (select auth.uid())));

-- usage limits
create policy usage_limits_select on public.usage_limits for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner());
create policy usage_limits_owner_insert on public.usage_limits for insert to authenticated with check (public.is_owner());
create policy usage_limits_owner_update on public.usage_limits for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy usage_limits_owner_delete on public.usage_limits for delete to authenticated using (public.is_owner());

-- attachments
create policy attachments_select on public.attachments for select to authenticated
  using (
    uploaded_by = (select auth.uid())
    or public.is_owner()
    or exists (select 1 from public.project_requests r where r.id = request_id and r.user_id = (select auth.uid()))
    or exists (select 1 from public.consultations c where c.id = consultation_id and c.user_id = (select auth.uid()))
  );
create policy attachments_insert on public.attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (request_id is null or public.is_owner() or exists (
      select 1 from public.project_requests r where r.id = request_id and r.user_id = (select auth.uid())))
  );
create policy attachments_delete on public.attachments for delete to authenticated
  using (public.is_owner() or (uploaded_by = (select auth.uid()) and request_id is null and consultation_id is null));

-- notifications
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- push tokens
create policy push_tokens_select on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_tokens_delete on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

-- activity log
create policy activity_owner_read on public.activity_logs for select to authenticated
  using (public.is_owner());

-- =====================================================================
-- Storage buckets & policies
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments', 'attachments', false, 52428800, null),
  ('public-media', 'public-media', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']),
  ('avatars', 'avatars', true, 3145728, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "attachments: upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments: read permitted" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_read_attachment(name));
create policy "attachments: delete own or owner" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_owner()));

create policy "public-media: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and public.is_owner());
create policy "public-media: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and public.is_owner());
create policy "public-media: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and public.is_owner());

create policy "avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =====================================================================
-- Realtime
-- =====================================================================
alter publication supabase_realtime add table
  public.notifications,
  public.consultation_messages,
  public.consultations,
  public.request_messages,
  public.project_requests;
