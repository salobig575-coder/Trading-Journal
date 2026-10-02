-- Trading Journal – Supabase-Schema
-- Im Supabase-Dashboard: SQL Editor -> New query -> einfuegen -> Run

create table if not exists public.journal_data (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  store      text    not null,            -- trades | analyses | collections | checklists | weeks | settings
  id         text    not null,            -- Datensatz-ID bzw. Key
  data       jsonb,                       -- kompletter Datensatz (null bei geloeschten)
  deleted    boolean not null default false,
  updated_at bigint  not null,            -- Client-Zeitstempel (ms) fuer "letzte Aenderung gewinnt"
  synced_at  timestamptz not null default now(), -- Server-Zeit: damit andere Geraete neue Zeilen sicher finden
  primary key (user_id, store, id)
);

create index if not exists journal_data_user_synced on public.journal_data (user_id, synced_at);

create or replace function public.journal_touch_synced() returns trigger
language plpgsql as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists journal_touch_synced on public.journal_data;
create trigger journal_touch_synced before insert or update on public.journal_data
  for each row execute function public.journal_touch_synced();

-- Jeder Nutzer sieht und aendert ausschliesslich seine eigenen Zeilen
alter table public.journal_data enable row level security;

drop policy if exists "own rows select" on public.journal_data;
drop policy if exists "own rows insert" on public.journal_data;
drop policy if exists "own rows update" on public.journal_data;
drop policy if exists "own rows delete" on public.journal_data;

create policy "own rows select" on public.journal_data for select using (user_id = auth.uid());
create policy "own rows insert" on public.journal_data for insert with check (user_id = auth.uid());
create policy "own rows update" on public.journal_data for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.journal_data for delete using (user_id = auth.uid());
