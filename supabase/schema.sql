-- Portál živnostníka – databázové schéma pro Supabase
-- Spusťte celé jednou v Supabase: SQL Editor → New query → vložit → Run.
-- Skript lze spustit opakovaně, nic nesmaže.

-- Společná funkce: při každém zápisu nastaví čas poslední změny podle hodin serveru
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Všech pět tabulek má stejný tvar:
--   user_id    vlastník řádku (přihlášený uživatel)
--   id         identifikátor záznamu z aplikace
--   data       celý záznam tak, jak ho aplikace používá
--   updated_at čas poslední změny (nastavuje server)
--   deleted_at čas smazání; smazané záznamy zůstávají jako značka, aby se smazání propsalo i na další zařízení
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'clients', 'contracts', 'calendar_events', 'price_list_items']
  loop
    execute format($f$
      create table if not exists public.%1$I (
        user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
        id         text        not null check (char_length(id) between 1 and 128),
        data       jsonb       not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        primary key (user_id, id)
      )
    $f$, t);

    execute format('create index if not exists %1$I on public.%2$I (user_id, updated_at)', t || '_user_updated_idx', t);

    execute format('drop trigger if exists set_updated_at on public.%1$I', t);
    execute format(
      'create trigger set_updated_at before insert or update on public.%1$I
         for each row execute function public.set_updated_at()', t);

    -- Zabezpečení: každý uživatel vidí a mění jen své řádky, nepřihlášený nic
    execute format('alter table public.%1$I enable row level security', t);
    execute format('drop policy if exists "vlastni radky" on public.%1$I', t);
    execute format($f$
      create policy "vlastni radky" on public.%1$I
        for all to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $f$, t);

    execute format('revoke all on public.%1$I from anon', t);
    execute format('grant select, insert, update, delete on public.%1$I to authenticated', t);
  end loop;
end;
$$;
