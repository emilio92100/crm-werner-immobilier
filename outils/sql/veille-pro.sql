-- ═══ Werner : la veille garde ce que l'annonce dit du local (23 octobre 2026) ═══
-- À passer une fois dans l'éditeur SQL du projet « CRM Werner Immobilier ».
-- Sans danger : n'ajoute qu'une colonne, si elle n'existe pas déjà.
--
-- · veille_propositions.pro : la nature de l'affaire (location, cession de
--   droit au bail, fonds, murs), le loyer annuel HT HC ou le prix, le bail, la
--   destination, la vitrine, l'extraction, les équipements — le même résumé
--   que biens.pro (src/lib/affaires.ts, ProBien). « Retenir » le recopie sur
--   le bien, et l'espace du demandeur le montre.
-- Tant qu'elle n'existe pas, la veille dépose sans elle (rien ne se perd du
-- reste de l'annonce).

alter table public.veille_propositions add column if not exists pro jsonb not null default '{}'::jsonb;

-- PostgREST relit la structure : la nouvelle colonne est lisible tout de suite.
notify pgrst, 'reload schema';
