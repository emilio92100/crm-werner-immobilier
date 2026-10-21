-- ═══ Le registre commun avec le CRM d'Emilio (22 octobre 2026) ════════════
-- À passer une fois dans Supabase › SQL Editor (projet « CRM Werner
-- Immobilier »), APRÈS outils/sql/registre-mandats.sql. Relançable : rien
-- n'est effacé.
--
-- Werner travaille sous la carte de RT CONSEILS : ses mandats prennent leur
-- numéro dans le registre d'Alexandre (CRM Emilio Immobilier,
-- /api/registre/commun), à la suite des siens. Ce registre-ci en garde la
-- copie, avec le MÊME numéro (src/lib/registre-commun.ts) :
--   · registre_commun : une ligne = la numérotation vient d'ailleurs ;
--   · registre_inscrire accepte alors le numéro donné (`p.numero`), et
--     seulement du serveur (clé de service) : le navigateur ne choisit jamais
--     un numéro ;
--   · registre_verifier ne cherche plus de trou (les numéros d'Alexandre sont
--     entre ceux de Werner) : il vérifie les empreintes, dans l'ordre
--     d'inscription.

create table if not exists registre_commun (
  id integer primary key default 1 check (id = 1),
  depuis timestamptz not null default now(),
  aupres text not null default 'Registre des mandats de RT CONSEILS, tenu dans le CRM Emilio Immobilier'
);
alter table registre_commun enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'registre_commun' and policyname = 'crm_lecture') then
    create policy crm_lecture on registre_commun for select to authenticated using (true);
  end if;
end $$;
insert into registre_commun (id) values (1) on conflict (id) do nothing;

create or replace function registre_inscrire(p jsonb)
returns registre_mandats language plpgsql security definer set search_path = public, extensions as $$
declare d registre_depart; r registre_mandats; n integer; prec text; commun boolean;
begin
  perform pg_advisory_xact_lock(7201972);
  select * into d from registre_depart where id = 1;
  if not found then raise exception 'Le registre n''est pas encore démarré.'; end if;
  if nullif(p->>'document_id', '') is not null then
    select * into r from registre_mandats where document_id = (p->>'document_id')::uuid order by numero limit 1;
    if found then return r; end if;
  end if;
  if nullif(p->>'signature_id', '') is not null then
    select * into r from registre_mandats where signature_id = (p->>'signature_id')::uuid order by numero limit 1;
    if found then return r; end if;
  end if;
  if coalesce(p->>'source', '') = 'espace' and nullif(p->>'recherche_id', '') is not null then
    select m.* into r from registre_mandats m
      where m.recherche_id = (p->>'recherche_id')::uuid and m.source = 'espace'
        and not exists (select 1 from registre_observations o where o.registre_id = m.id and o.type in ('signe', 'sans_suite', 'retracte', 'annule', 'fin'))
      order by m.numero desc limit 1;
    if found then return r; end if;
  end if;
  if coalesce(p->>'nature', '') not in ('vente', 'recherche') then raise exception 'Nature du mandat inconnue : vente ou recherche.'; end if;
  if nullif(trim(coalesce(p->>'mandants', '')), '') is null then raise exception 'Les mandants manquent.'; end if;
  if nullif(trim(coalesce(p->>'objet', '')), '') is null then raise exception 'L''objet du mandat manque.'; end if;
  commun := exists (select 1 from registre_commun);
  if commun then
    -- Le numéro vient du registre d'Alexandre, et seulement par le serveur.
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'Le numéro vient du registre commun : il se prend par le serveur du CRM.';
    end if;
    if coalesce(p->>'numero', '') !~ '^\d+$' then raise exception 'Le numéro du registre commun manque.'; end if;
    n := (p->>'numero')::integer;
    if n < 1 then raise exception 'Numéro invalide.'; end if;
    if exists (select 1 from registre_mandats where numero = n) then raise exception 'Le n° % est déjà inscrit ici.', n; end if;
    select empreinte into prec from registre_mandats order by inscrit_le desc, numero desc limit 1;
  else
    select coalesce(max(numero) + 1, d.premier_numero) into n from registre_mandats;
    select empreinte into prec from registre_mandats order by numero desc limit 1;
  end if;
  r.id := gen_random_uuid(); r.numero := n; r.inscrit_le := clock_timestamp();
  r.nature := p->>'nature'; r.type_mandat := nullif(p->>'type_mandat', '');
  r.mandants := trim(p->>'mandants'); r.objet := trim(p->>'objet'); r.source := coalesce(nullif(p->>'source', ''), 'document');
  r.client_id := nullif(p->>'client_id', '')::uuid; r.recherche_id := nullif(p->>'recherche_id', '')::uuid;
  r.bien_vente_id := nullif(p->>'bien_vente_id', '')::uuid; r.document_id := nullif(p->>'document_id', '')::uuid;
  r.signature_id := nullif(p->>'signature_id', '')::uuid;
  r.empreinte_prec := coalesce(prec, d.empreinte);
  r.empreinte := registre_empreinte_ligne(r);
  insert into registre_mandats values (r.*);
  return r;
end $$;

create or replace function registre_verifier()
returns table (quoi text, numero integer, probleme text) language plpgsql security definer set search_path = public, extensions as $$
declare d registre_depart; r registre_mandats; o registre_observations; attendu integer; prec text; commun boolean;
begin
  select * into d from registre_depart where id = 1;
  if not found then return; end if;
  commun := exists (select 1 from registre_commun);
  if d.empreinte <> registre_sha(concat_ws('|', 'depart', d.premier_numero::text, registre_heure(d.demarre_le), coalesce(d.reprise, ''))) then
    quoi := 'depart'; numero := d.premier_numero; probleme := 'Le départ du registre a été modifié.'; return next;
  end if;
  attendu := d.premier_numero; prec := d.empreinte;
  if commun then
    -- Les numéros viennent du registre d'Alexandre : pas de trou à chercher
    -- ici ; la chaîne des empreintes suit l'ordre d'inscription.
    for r in select * from registre_mandats order by inscrit_le, numero loop
      if r.empreinte_prec <> prec then quoi := 'mandat'; numero := r.numero; probleme := 'Le lien avec la ligne précédente est rompu.'; return next; end if;
      if r.empreinte <> registre_empreinte_ligne(r) then quoi := 'mandat'; numero := r.numero; probleme := 'Le contenu de la ligne ne correspond plus à son empreinte.'; return next; end if;
      prec := r.empreinte;
    end loop;
  else
    for r in select * from registre_mandats order by numero loop
      if r.numero <> attendu then quoi := 'mandat'; numero := r.numero; probleme := format('Numéro attendu : %s. Un numéro manque ou a été sauté.', attendu); return next; end if;
      if r.empreinte_prec <> prec then quoi := 'mandat'; numero := r.numero; probleme := 'Le lien avec la ligne précédente est rompu.'; return next; end if;
      if r.empreinte <> registre_empreinte_ligne(r) then quoi := 'mandat'; numero := r.numero; probleme := 'Le contenu de la ligne ne correspond plus à son empreinte.'; return next; end if;
      attendu := r.numero + 1; prec := r.empreinte;
    end loop;
  end if;
  prec := d.empreinte;
  for o in select * from registre_observations order by rang loop
    if o.empreinte_prec <> prec or o.empreinte <> registre_empreinte_obs(o) then
      quoi := 'observation'; select m.numero into numero from registre_mandats m where m.id = o.registre_id;
      probleme := 'Une observation ne correspond plus à son empreinte.'; return next;
    end if;
    prec := o.empreinte;
  end loop;
end $$;

revoke all on function registre_inscrire(jsonb) from public, anon;
revoke all on function registre_verifier() from public, anon;
grant execute on function registre_inscrire(jsonb) to authenticated, service_role;
grant execute on function registre_verifier() to authenticated, service_role;

-- Le départ de la copie, s'il n'est pas déjà posé : le numéro qui suit le
-- dernier du registre d'Alexandre au jour du branchement (à remplacer par le
-- bon chiffre avant de lancer cette ligne).
-- select registre_demarrer(4401, 'Copie des mandats de Werner Immobilier, inscrits au registre de RT CONSEILS (CRM Emilio Immobilier), numérotation commune');
