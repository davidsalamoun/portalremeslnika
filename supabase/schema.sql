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

-- ---------------------------------------------------------------------------
-- Online podpis smlouvy zákazníkem
-- ---------------------------------------------------------------------------
-- Řemeslník vytvoří odkaz s náhodným tajným kódem (token). Zákazník se nepřihlašuje: k tabulce nemá
-- přístup vůbec, smlouvu čte a podepisuje jen přes dvě funkce níže a jen se znalostí tokenu.
create table if not exists public.sign_shares (
  token            text        primary key check (token ~ '^[A-Za-z0-9_-]{32,128}$'),
  user_id          uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  contract_id      text        not null check (char_length(contract_id) between 1 and 128),
  contract_data    jsonb       not null,
  status           text        not null default 'pending' check (status in ('pending', 'signed')),
  client_signature text,
  signer_name      text,
  signed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '90 days'
);

create index if not exists sign_shares_user_contract_idx on public.sign_shares (user_id, contract_id);

drop trigger if exists set_updated_at on public.sign_shares;
create trigger set_updated_at before insert or update on public.sign_shares
  for each row execute function public.set_updated_at();

alter table public.sign_shares enable row level security;
revoke all on public.sign_shares from anon;
grant select, insert, update, delete on public.sign_shares to authenticated;

-- Řemeslník: vidí a maže své odkazy; zakládat a měnit smí jen nepodepsané (podepsaný záznam už nejde přepsat)
drop policy if exists "vlastni odkazy - cteni" on public.sign_shares;
create policy "vlastni odkazy - cteni" on public.sign_shares
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "vlastni odkazy - zalozeni" on public.sign_shares;
create policy "vlastni odkazy - zalozeni" on public.sign_shares
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and client_signature is null and signed_at is null);

drop policy if exists "vlastni odkazy - uprava nepodepsanych" on public.sign_shares;
create policy "vlastni odkazy - uprava nepodepsanych" on public.sign_shares
  for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
  with check ((select auth.uid()) = user_id and status = 'pending' and client_signature is null and signed_at is null);

drop policy if exists "vlastni odkazy - smazani" on public.sign_shares;
create policy "vlastni odkazy - smazani" on public.sign_shares
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Zákazník: načtení smlouvy k podpisu podle tokenu (null = nenalezeno nebo vypršelo)
create or replace function public.get_sign_share(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', s.status,
    'contract', s.contract_data,
    'signerName', s.signer_name,
    'signedAt', s.signed_at,
    'clientSignature', s.client_signature
  )
  from public.sign_shares s
  where s.token = p_token
    and (s.status = 'signed' or s.expires_at > now());
$$;

-- Zákazník: odeslání podpisu. Podepsat lze jen jednou; obsah smlouvy změnit nelze.
-- Vrací 'signed', 'already_signed', 'not_found' nebo 'invalid'.
create or replace function public.submit_sign_share(p_token text, p_signature text, p_signer_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_signature is null
     or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
     or char_length(p_signature) > 700000
     or char_length(btrim(coalesce(p_signer_name, ''))) not between 1 and 200 then
    return 'invalid';
  end if;

  update public.sign_shares s
     set status = 'signed',
         client_signature = p_signature,
         signer_name = btrim(p_signer_name),
         signed_at = now()
   where s.token = p_token and s.status = 'pending' and s.expires_at > now();
  if found then
    return 'signed';
  end if;

  select s.status into v_status from public.sign_shares s where s.token = p_token;
  if v_status = 'signed' then
    return 'already_signed';
  end if;
  return 'not_found';
end;
$$;

revoke all on function public.get_sign_share(text) from public;
revoke all on function public.submit_sign_share(text, text, text) from public;
grant execute on function public.get_sign_share(text) to anon, authenticated;
grant execute on function public.submit_sign_share(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Úložiště obrázků (fotky, účtenky, podpisy)
-- ---------------------------------------------------------------------------
-- Soukromý bucket; každý uživatel má složku pojmenovanou svým ID a vidí jen ji.
-- Ve smlouvách je místo obrázku jen odkaz "@img:<id>", soubor je na cestě <user_id>/<id>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vlastni fotky - cteni" on storage.objects;
create policy "vlastni fotky - cteni" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vlastni fotky - nahrani" on storage.objects;
create policy "vlastni fotky - nahrani" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vlastni fotky - prepis" on storage.objects;
create policy "vlastni fotky - prepis" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vlastni fotky - smazani" on storage.objects;
create policy "vlastni fotky - smazani" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
