-- Mitbringliste: Tabellen und Funktionen.
-- Einmal im SQL-Editor von Supabase ausführen (Projekt Petri_heil). Darf auch mehrmals laufen.
-- Die Tabellen sind nur über die Funktionen erreichbar (Row Level Security ohne Regeln).
-- Rollen: Klassencode (alle), Moderator (Person mit eigener PIN), Admin (Admin-Code).

create table if not exists mb_gruppe (
  id text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  name text not null default 'Mitbringliste',
  code text not null,                -- Klassencode (steht im geteilten Link)
  admin_hash text not null,          -- Admin-Code, nur als Prüfsumme
  sachen jsonb not null default '[]'::jsonb,
  einstellungen jsonb not null default '{}'::jsonb,
  erstellt timestamptz not null default now()
);

create table if not exists mb_person (
  gruppe text not null references mb_gruppe(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  mod_hash text,                     -- gesetzt = Moderator (Prüfsumme von "id:PIN")
  primary key (gruppe, id)
);
alter table mb_person add column if not exists mod_hash text;

create table if not exists mb_termin (
  gruppe text not null references mb_gruppe(id) on delete cascade,
  schluessel date not null,          -- regulärer Termin (erster Mittwoch)
  datum date,                        -- von Hand festgelegtes Datum
  abgesagt boolean not null default false,
  frei boolean not null default false, -- Liste schon vor Montag 18 Uhr freigegeben
  notiz text not null default '' check (length(notiz) <= 300),
  primary key (gruppe, schluessel)
);

create table if not exists mb_antwort (
  gruppe text not null,
  schluessel date not null,
  person uuid not null,
  dabei boolean not null,
  posten text check (length(posten) <= 200), -- gewählter Posten, z. B. 'mett'
  seit timestamptz,                  -- wann der Posten gewählt wurde (wer zuerst kommt ...)
  geaendert timestamptz not null default now(),
  primary key (gruppe, schluessel, person),
  foreign key (gruppe, person) references mb_person(gruppe, id) on delete cascade
);

alter table mb_gruppe enable row level security;
alter table mb_person enable row level security;
alter table mb_termin enable row level security;
alter table mb_antwort enable row level security;
revoke all on mb_gruppe, mb_person, mb_termin, mb_antwort from anon, authenticated;

create or replace function mb_hash(p_gruppe text, p_code text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p_gruppe || ':' || coalesce(p_code, ''), 'UTF8')), 'hex')
$$;

-- Wer ist das? 'admin' (Admin-Code), 'mod' ("Personen-ID:PIN" eines Moderators) oder 'klasse' (Klassencode)
create or replace function mb_rolle(p_gruppe text, p_code text) returns text
language plpgsql as $$
declare g mb_gruppe;
begin
  select * into g from mb_gruppe where id = p_gruppe;
  if not found then raise exception 'keine_gruppe'; end if;
  if mb_hash(p_gruppe, p_code) = g.admin_hash then return 'admin'; end if;
  if p_code ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.' and exists (
       select 1 from mb_person where gruppe = p_gruppe and id = split_part(p_code, ':', 1)::uuid
         and mod_hash = mb_hash(p_gruppe, p_code)) then
    return 'mod';
  end if;
  if p_code = g.code then return 'klasse'; end if;
  perform pg_sleep(0.4);
  raise exception 'falscher_code';
end $$;

create or replace function mb_einrichten(p_gruppe text, p_name text, p_code text, p_admin text, p_sachen jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_gruppe !~ '^[a-z0-9-]{3,40}$' then raise exception 'ungueltig'; end if;
  if length(coalesce(p_code, '')) < 4 or length(coalesce(p_admin, '')) < 6 then raise exception 'code_zu_kurz'; end if;
  if p_code = p_admin then raise exception 'codes_gleich'; end if;
  if jsonb_typeof(p_sachen) <> 'array' then raise exception 'ungueltig'; end if;
  insert into mb_gruppe (id, name, code, admin_hash, sachen)
  values (p_gruppe, coalesce(nullif(trim(p_name), ''), 'Mitbringliste'), p_code, mb_hash(p_gruppe, p_admin), p_sachen)
  on conflict (id) do nothing;
  if not found then raise exception 'gibt_es_schon'; end if;
  return '{}'::jsonb;
end $$;

create or replace function mb_laden(p_gruppe text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g mb_gruppe; v_rolle text;
begin
  v_rolle := mb_rolle(p_gruppe, p_code);
  select * into g from mb_gruppe where id = p_gruppe;
  return jsonb_build_object(
    'name', g.name,
    'code', g.code,
    'sachen', g.sachen,
    'einstellungen', g.einstellungen,
    'rolle', v_rolle,
    'personen', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'mod', mod_hash is not null)
                          order by lower(name))
                          from mb_person where gruppe = p_gruppe), '[]'::jsonb),
    'termine', coalesce((select jsonb_agg(jsonb_build_object('schluessel', schluessel, 'datum', datum,
                          'abgesagt', abgesagt, 'frei', frei, 'notiz', notiz))
                         from mb_termin where gruppe = p_gruppe and schluessel >= current_date - 120), '[]'::jsonb),
    'antworten', coalesce((select jsonb_agg(jsonb_build_object('schluessel', schluessel, 'person', person,
                            'dabei', dabei, 'posten', posten, 'seit', seit))
                           from mb_antwort where gruppe = p_gruppe and schluessel >= current_date - 120), '[]'::jsonb)
  );
end $$;

-- Dabei (true), nicht dabei (false) oder Antwort zurücknehmen (null)
create or replace function mb_antworten(p_gruppe text, p_code text, p_schluessel date, p_person uuid, p_dabei boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform mb_rolle(p_gruppe, p_code);
  if not exists (select 1 from mb_person where gruppe = p_gruppe and id = p_person) then raise exception 'keine_person'; end if;
  if p_dabei is null then
    delete from mb_antwort where gruppe = p_gruppe and schluessel = p_schluessel and person = p_person;
    return;
  end if;
  insert into mb_antwort (gruppe, schluessel, person, dabei, posten, seit, geaendert)
  values (p_gruppe, p_schluessel, p_person, p_dabei, null, null, now())
  on conflict (gruppe, schluessel, person) do update set
    dabei = excluded.dabei,
    posten = case when excluded.dabei then mb_antwort.posten end,
    seit = case when excluded.dabei then mb_antwort.seit end,
    geaendert = now();
end $$;

-- Posten wählen (macht einen auch zu "dabei") oder abgeben (p_posten null)
create or replace function mb_nehmen(p_gruppe text, p_code text, p_schluessel date, p_person uuid, p_posten text)
returns void language plpgsql security definer set search_path = public as $$
declare v_posten text := nullif(trim(coalesce(p_posten, '')), '');
begin
  perform mb_rolle(p_gruppe, p_code);
  if not exists (select 1 from mb_person where gruppe = p_gruppe and id = p_person) then raise exception 'keine_person'; end if;
  insert into mb_antwort (gruppe, schluessel, person, dabei, posten, seit, geaendert)
  values (p_gruppe, p_schluessel, p_person, true, v_posten, case when v_posten is not null then clock_timestamp() end, now())
  on conflict (gruppe, schluessel, person) do update set
    dabei = true, posten = excluded.posten, seit = excluded.seit, geaendert = now();
end $$;

-- Verwaltung: Moderatoren und Admin. Moderatoren, Codes und Löschen der Liste nur mit dem Admin-Code.
create or replace function mb_admin(p_gruppe text, p_admin text, p_aktion text, p_daten jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_text text; v_tag date; v_rolle text;
begin
  v_rolle := mb_rolle(p_gruppe, p_admin);
  if v_rolle = 'klasse' then
    perform pg_sleep(0.4);
    raise exception 'falscher_code';
  end if;
  if v_rolle <> 'admin' and p_aktion in ('mod_setzen', 'mod_entfernen', 'klassencode', 'admincode', 'gruppe_loeschen') then
    raise exception 'nur_admin';
  end if;
  case p_aktion
  when 'pruefen' then
    return jsonb_build_object('rolle', v_rolle);
  when 'sachen' then
    if jsonb_typeof(p_daten) <> 'array' or jsonb_array_length(p_daten) > 40 then raise exception 'ungueltig'; end if;
    update mb_gruppe set sachen = p_daten where id = p_gruppe;
  when 'einstellungen' then
    update mb_gruppe set
      name = coalesce(nullif(trim(p_daten->>'name'), ''), name),
      einstellungen = coalesce(p_daten->'einstellungen', einstellungen)
    where id = p_gruppe;
  when 'person_neu' then
    v_text := trim(p_daten->>'name');
    if v_text is null or length(v_text) not between 1 and 40 then raise exception 'ungueltig'; end if;
    insert into mb_person (gruppe, name) values (p_gruppe, v_text) returning id into v_id;
    return jsonb_build_object('id', v_id);
  when 'person_name' then
    v_text := trim(p_daten->>'name');
    if v_text is null or length(v_text) not between 1 and 40 then raise exception 'ungueltig'; end if;
    update mb_person set name = v_text where gruppe = p_gruppe and id = (p_daten->>'id')::uuid;
  when 'person_loeschen' then
    delete from mb_person where gruppe = p_gruppe and id = (p_daten->>'id')::uuid;
  when 'mod_setzen' then
    v_id := (p_daten->>'id')::uuid;
    v_text := p_daten->>'pin';
    if length(coalesce(v_text, '')) < 4 then raise exception 'pin_zu_kurz'; end if;
    update mb_person set mod_hash = mb_hash(p_gruppe, v_id::text || ':' || v_text) where gruppe = p_gruppe and id = v_id;
  when 'mod_entfernen' then
    update mb_person set mod_hash = null where gruppe = p_gruppe and id = (p_daten->>'id')::uuid;
  when 'termin' then
    v_tag := (p_daten->>'schluessel')::date;
    insert into mb_termin (gruppe, schluessel, datum, abgesagt, frei, notiz)
    values (p_gruppe, v_tag, nullif(p_daten->>'datum', '')::date,
            coalesce((p_daten->>'abgesagt')::boolean, false), coalesce((p_daten->>'frei')::boolean, false),
            left(coalesce(p_daten->>'notiz', ''), 300))
    on conflict (gruppe, schluessel) do update set
      datum = excluded.datum, abgesagt = excluded.abgesagt, frei = excluded.frei, notiz = excluded.notiz;
    delete from mb_termin where gruppe = p_gruppe and schluessel = v_tag
      and datum is null and not abgesagt and not frei and notiz = '';
  when 'klassencode' then
    v_text := p_daten->>'code';
    if length(coalesce(v_text, '')) < 4 then raise exception 'code_zu_kurz'; end if;
    if mb_hash(p_gruppe, v_text) = (select admin_hash from mb_gruppe where id = p_gruppe) then raise exception 'codes_gleich'; end if;
    update mb_gruppe set code = v_text where id = p_gruppe;
  when 'admincode' then
    v_text := p_daten->>'code';
    if length(coalesce(v_text, '')) < 6 then raise exception 'code_zu_kurz'; end if;
    if v_text = (select code from mb_gruppe where id = p_gruppe) then raise exception 'codes_gleich'; end if;
    update mb_gruppe set admin_hash = mb_hash(p_gruppe, v_text) where id = p_gruppe;
  when 'gruppe_loeschen' then
    delete from mb_gruppe where id = p_gruppe;
  else
    raise exception 'unbekannte_aktion';
  end case;
  return '{}'::jsonb;
end $$;

revoke execute on function mb_hash(text, text) from public, anon, authenticated;
revoke execute on function mb_rolle(text, text) from public, anon, authenticated;
grant execute on function mb_einrichten(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function mb_laden(text, text) to anon, authenticated;
grant execute on function mb_antworten(text, text, date, uuid, boolean) to anon, authenticated;
grant execute on function mb_nehmen(text, text, date, uuid, text) to anon, authenticated;
grant execute on function mb_admin(text, text, text, jsonb) to anon, authenticated;
