-- V3.236 (23 octobre 2026) — Les autres adresses du dossier d'un contact :
-- notaire, avocat, syndic, banque… [{ "email": "…", "etiquette": "Notaire" }].
-- Elles ne reçoivent rien d'office ; « Nouveau mail » les propose, rangées
-- sous leur étiquette. À lancer une fois dans Supabase (SQL Editor).
alter table public.clients add column if not exists adresses_dossier jsonb not null default '[]'::jsonb;
