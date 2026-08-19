-- Team Cornetas / Mitos y Leyendas
-- Esquema cloud propuesto para la fase compartida del MVP.
-- Lectura pública; escritura solo para usuarios autenticados.

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  played_on date not null default current_date,
  format text not null default 'lunch' check (format in ('lunch', 'bo3')),
  player_a text not null check (char_length(trim(player_a)) > 0),
  race_a text not null check (char_length(trim(race_a)) > 0),
  player_b text not null check (char_length(trim(player_b)) > 0),
  race_b text not null check (char_length(trim(race_b)) > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint different_players check (lower(trim(player_a)) <> lower(trim(player_b)))
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  game_number smallint not null check (game_number between 1 and 3),
  dice_winner text not null check (dice_winner in ('a', 'b')),
  winner text not null check (winner in ('a', 'b')),
  created_at timestamptz not null default now(),
  constraint unique_game_number unique (encounter_id, game_number)
);

create index if not exists encounters_played_on_idx on public.encounters (played_on desc);
create index if not exists encounters_created_by_idx on public.encounters (created_by);
create index if not exists games_encounter_id_idx on public.games (encounter_id);

alter table public.encounters enable row level security;
alter table public.games enable row level security;

-- Supabase cambió en 2026 la exposición automática de tablas nuevas al Data API.
-- Los GRANT son explícitos; RLS sigue controlando las filas accesibles.
grant select on table public.encounters to anon, authenticated;
grant select on table public.games to anon, authenticated;
grant insert, update, delete on table public.encounters to authenticated;
grant insert, update, delete on table public.games to authenticated;

create policy "encounters_public_read"
on public.encounters
for select
to anon, authenticated
using (true);

create policy "encounters_authenticated_insert"
on public.encounters
for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "encounters_owner_update"
on public.encounters
for update
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

create policy "encounters_owner_delete"
on public.encounters
for delete
to authenticated
using ((select auth.uid()) = created_by);

create policy "games_public_read"
on public.games
for select
to anon, authenticated
using (true);

create policy "games_owner_insert"
on public.games
for insert
to authenticated
with check (
  exists (
    select 1
    from public.encounters e
    where e.id = encounter_id
      and e.created_by = (select auth.uid())
  )
);

create policy "games_owner_update"
on public.games
for update
to authenticated
using (
  exists (
    select 1
    from public.encounters e
    where e.id = encounter_id
      and e.created_by = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.encounters e
    where e.id = encounter_id
      and e.created_by = (select auth.uid())
  )
);

create policy "games_owner_delete"
on public.games
for delete
to authenticated
using (
  exists (
    select 1
    from public.encounters e
    where e.id = encounter_id
      and e.created_by = (select auth.uid())
  )
);
