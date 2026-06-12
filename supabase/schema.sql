create table if not exists public.rooms (
  id uuid primary key,
  code text not null unique,
  host_id text not null,
  status text not null check (
    status in ('lobby', 'betting', 'playing', 'round_result', 'finished')
  ),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at on public.rooms;

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

drop policy if exists "rooms are readable by anon players" on public.rooms;
create policy "rooms are readable by anon players"
on public.rooms for select
to anon, authenticated
using (true);

drop policy if exists "rooms are insertable by anon players" on public.rooms;
create policy "rooms are insertable by anon players"
on public.rooms for insert
to anon, authenticated
with check (true);

drop policy if exists "rooms are updatable by anon players" on public.rooms;
create policy "rooms are updatable by anon players"
on public.rooms for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "rooms are deletable by anon players" on public.rooms;
create policy "rooms are deletable by anon players"
on public.rooms for delete
to anon, authenticated
using (true);
