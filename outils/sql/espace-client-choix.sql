-- ═══ L'espace client, au choix de Werner (21 octobre 2026) ═══════════════
-- Alexandre : « pour beaucoup de clients, il ne voudra pas qu'il y ait un
-- espace » ; par défaut, pas d'espace.
--
-- `clients.espace_client` :
--   false (défaut) : les locaux envoyés par mail mènent à leur fiche publique
--                    (/bien/<id>) ; aucun mail ne parle d'espace ; son lien
--                    d'espace mène à « Ce lien n'est plus actif ».
--   true           : comme le CRM d'origine (l'espace, ses réponses, le point
--                    automatique, le mail de bienvenue).
--
-- Werner l'active ou le coupe sur la fiche du demandeur, onglet « Son espace ».
-- Sans risque à relancer.

alter table clients add column if not exists espace_client boolean not null default false;

select 'clients.espace_client' as quoi,
  case when exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'espace_client') then 'oui' else 'NON' end as present;
