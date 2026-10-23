-- ═══ Werner : les relances créées par le CRM lui-même (23 octobre 2026) ═══════
-- À passer une fois dans l'éditeur SQL du projet « CRM Werner Immobilier ».
-- Sans danger : la règle s'élargit, aucune ligne ne change.
--
-- La structure reprise d'origine n'acceptait que deux types de relance,
-- « auto » et « manuelle ». Or le code en écrit deux autres :
--   · « rappel_client » : une demande de rappel, une demande de visite, une
--     offre, une signature, une réponse au point automatique… (18 endroits) ;
--   · « message_client » : un message ou une annonce envoyés depuis l'espace.
-- Refusées par la base, ces relances ne se créaient pas (l'erreur n'allait que
-- dans les journaux du serveur) : la page Relances serait restée vide.

alter table public.relances drop constraint if exists relances_type_check;
alter table public.relances add constraint relances_type_check
  check (type = any (array['auto', 'manuelle', 'rappel_client', 'message_client']));

notify pgrst, 'reload schema';
