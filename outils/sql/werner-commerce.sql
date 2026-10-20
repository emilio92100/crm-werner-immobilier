-- ═══ Werner : les critères et les fiches de l'immobilier d'entreprise ═══════
-- À passer une fois dans l'éditeur SQL du projet « CRM Werner Immobilier ».
-- Sans danger : n'ajoute que des colonnes, si elles n'existent pas déjà.
--
-- · recherches.criteres_pro : ce qu'un demandeur cherche en plus des colonnes
--   d'origine (la nature — location, droit au bail, fonds, murs —, le loyer
--   annuel, le linéaire de vitrine, l'emplacement, l'activité…). Les
--   équipements souhaités ou indispensables restent dans `exigences`.
-- · biens.pro : ce qu'une affaire proposée à un demandeur porte en plus (sa
--   nature, son loyer, le prix du droit au bail, le bail, la destination…),
--   pour son espace et sa fiche.

begin;

alter table public.recherches add column if not exists criteres_pro jsonb not null default '{}'::jsonb;
alter table public.biens add column if not exists pro jsonb not null default '{}'::jsonb;

commit;

-- PostgREST relit la structure : les nouvelles colonnes sont lisibles tout de suite.
notify pgrst, 'reload schema';
