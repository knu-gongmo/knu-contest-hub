-- =====================================================================
-- KNU 스퀘어 Q&A · 팀원모집 게시판 스키마 (Supabase SQL Editor에 통째로 붙여넣고 Run)
--
-- 핵심 원칙: "경북대 메일(@knu.ac.kr)로 인증한 사용자만 읽기·쓰기 가능"
--   → 웹페이지 JS가 아니라 데이터베이스(RLS)에서 강제하므로,
--     누가 API를 직접 호출해도 경북대 계정이 아니면 아무것도 볼 수 없습니다.
-- 여러 번 실행해도 안전하도록 작성되어 있습니다.
-- =====================================================================

-- 1) 현재 로그인 사용자가 경북대 메일 인증 사용자인지 확인
create or replace function public.is_knu_user()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role() = 'authenticated', false)
     and coalesce(lower(auth.jwt() ->> 'email') like '%@knu.ac.kr', false);
$$;

-- 2) 테이블 ------------------------------------------------------------
create table if not exists public.qna_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category      text not null default 'team' check (category in ('team', 'question', 'tip')),
  author_name   text not null check (char_length(btrim(author_name)) between 1 and 30),
  contest_title text not null default '' check (char_length(contest_title) <= 200),
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  content       text not null check (char_length(btrim(content)) between 1 and 2000),
  status        text not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now()
);

create table if not exists public.qna_replies (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.qna_posts (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 30),
  content     text not null check (char_length(btrim(content)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create table if not exists public.qna_likes (
  post_id    uuid not null references public.qna_posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists qna_posts_created_idx on public.qna_posts (created_at desc);
create index if not exists qna_replies_post_idx on public.qna_replies (post_id, created_at);

-- 3) 권한: 익명(anon)은 테이블 접근 불가, 로그인 사용자는 필요한 컬럼만 -----
revoke all on public.qna_posts, public.qna_replies, public.qna_likes from anon, authenticated;

grant select on public.qna_posts, public.qna_replies, public.qna_likes to authenticated;
-- user_id, created_at, status 는 클라이언트가 직접 지정할 수 없음 (기본값 사용)
grant insert (category, author_name, contest_title, title, content) on public.qna_posts to authenticated;
grant update (status) on public.qna_posts to authenticated;
grant delete on public.qna_posts to authenticated;
grant insert (post_id, author_name, content) on public.qna_replies to authenticated;
grant delete on public.qna_replies to authenticated;
grant insert (post_id) on public.qna_likes to authenticated;
grant delete on public.qna_likes to authenticated;

-- 4) 행 단위 보안(RLS) -------------------------------------------------
alter table public.qna_posts   enable row level security;
alter table public.qna_replies enable row level security;
alter table public.qna_likes   enable row level security;

drop policy if exists "knu read posts"    on public.qna_posts;
drop policy if exists "knu insert posts"  on public.qna_posts;
drop policy if exists "owner update posts" on public.qna_posts;
drop policy if exists "owner delete posts" on public.qna_posts;
create policy "knu read posts"     on public.qna_posts for select to authenticated using (public.is_knu_user());
create policy "knu insert posts"   on public.qna_posts for insert to authenticated with check (public.is_knu_user() and user_id = auth.uid());
create policy "owner update posts" on public.qna_posts for update to authenticated using (public.is_knu_user() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner delete posts" on public.qna_posts for delete to authenticated using (public.is_knu_user() and user_id = auth.uid());

drop policy if exists "knu read replies"    on public.qna_replies;
drop policy if exists "knu insert replies"  on public.qna_replies;
drop policy if exists "owner delete replies" on public.qna_replies;
create policy "knu read replies"     on public.qna_replies for select to authenticated using (public.is_knu_user());
create policy "knu insert replies"   on public.qna_replies for insert to authenticated with check (public.is_knu_user() and user_id = auth.uid());
create policy "owner delete replies" on public.qna_replies for delete to authenticated using (public.is_knu_user() and user_id = auth.uid());

drop policy if exists "knu read likes"   on public.qna_likes;
drop policy if exists "knu insert likes" on public.qna_likes;
drop policy if exists "owner delete likes" on public.qna_likes;
create policy "knu read likes"     on public.qna_likes for select to authenticated using (public.is_knu_user());
create policy "knu insert likes"   on public.qna_likes for insert to authenticated with check (public.is_knu_user() and user_id = auth.uid());
create policy "owner delete likes" on public.qna_likes for delete to authenticated using (public.is_knu_user() and user_id = auth.uid());

-- 5) 도배 방지: 1인당 하루 글 10개, 답변 60개 ----------------------------
create or replace function public.qna_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  if tg_table_name = 'qna_posts' then
    select count(*) into recent from public.qna_posts
      where user_id = auth.uid() and created_at > now() - interval '1 day';
    if recent >= 10 then
      raise exception 'RATE_LIMIT: 하루 게시글 한도(10개)를 넘었습니다.';
    end if;
  else
    select count(*) into recent from public.qna_replies
      where user_id = auth.uid() and created_at > now() - interval '1 day';
    if recent >= 60 then
      raise exception 'RATE_LIMIT: 하루 답변 한도(60개)를 넘었습니다.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists qna_posts_rate_limit on public.qna_posts;
create trigger qna_posts_rate_limit before insert on public.qna_posts
  for each row execute function public.qna_rate_limit();
drop trigger if exists qna_replies_rate_limit on public.qna_replies;
create trigger qna_replies_rate_limit before insert on public.qna_replies
  for each row execute function public.qna_rate_limit();

-- 6) 로그인 전 화면에 보여줄 "글 개수"만 공개 (내용은 비공개) ---------------
create or replace function public.qna_public_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'posts', count(*),
    'openTeams', count(*) filter (where category = 'team' and status = 'open')
  )
  from public.qna_posts;
$$;

revoke all on function public.qna_public_stats() from public;
grant execute on function public.qna_public_stats() to anon, authenticated;

-- 7) 회원 탈퇴: 본인 계정(메일 주소)과 본인이 쓴 글·댓글·공감을 즉시 삭제 ------
--    auth.users 행을 지우면 on delete cascade로 게시판 데이터도 함께 지워집니다.
create or replace function public.qna_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_LOGGED_IN';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.qna_delete_my_account() from public, anon;
grant execute on function public.qna_delete_my_account() to authenticated;
