-- Team Cornetas / modo de perfiles sin login
-- Ejecutar DESPUÉS de supabase/schema.sql.
-- La identidad elegida en la app es de conveniencia, no autenticación.

alter table public.encounters
  alter column created_by drop not null;

alter table public.encounters
  add column if not exists submitted_by text;

alter table public.encounters
  drop constraint if exists submitted_by_team_player;

alter table public.encounters
  add constraint submitted_by_team_player
  check (
    submitted_by is null
    or submitted_by in (
      'Braulio',
      'Wladimick',
      'Ignacio',
      'Diego',
      'Claudio',
      'Diever',
      'Cristobal',
      'Renzo'
    )
  );

grant insert on table public.encounters to anon;
grant insert on table public.games to anon;

drop policy if exists "encounters_anon_insert" on public.encounters;
create policy "encounters_anon_insert"
on public.encounters
for insert
to anon
with check (
  created_by is null
  and submitted_by in (
    'Braulio',
    'Wladimick',
    'Ignacio',
    'Diego',
    'Claudio',
    'Diever',
    'Cristobal',
    'Renzo'
  )
);

drop policy if exists "games_anon_insert" on public.games;
create policy "games_anon_insert"
on public.games
for insert
to anon
with check (
  exists (
    select 1
    from public.encounters e
    where e.id = encounter_id
      and e.created_by is null
      and e.submitted_by is not null
  )
);

-- Intencionalmente NO se concede UPDATE/DELETE a anon.
-- Todos pueden ver y registrar, pero un visitante no puede borrar el historial.
