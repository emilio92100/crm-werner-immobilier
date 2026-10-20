-- ═══ Structure initiale du CRM Werner Immobilier ═══════════════════════════
-- Reprise de la structure du CRM Emilio (relevée en lecture seule le 20/10/2026),
-- SANS AUCUNE DONNÉE. Retirés : la table « partenaires » et les colonnes
-- clients.vendeur_* (plus rien ne les lisait). Les colonnes du logement restent
-- pour l'instant : elles changeront avec chaque module adapté au commercial.
-- À passer UNE fois sur une base vide. Tout passe ou rien ne passe.

begin;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table public."annonces_client" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid,
  "recherche_id" uuid,
  "url" text,
  "portail" text,
  "photos" text[] default '{}'::text[] not null,
  "aime" text[] default '{}'::text[] not null,
  "mot" text,
  "statut" text default 'nouveau'::text not null,
  "reponse" text,
  "avis" text,
  "decide_le" timestamp with time zone,
  "bien_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "fiche" jsonb
);
create table public."biens" (
  "id" uuid default extensions.uuid_generate_v4() not null,
  "client_id" uuid,
  "url" text,
  "source_portail" text,
  "titre" text,
  "adresse" text,
  "ville" text,
  "code_postal" text,
  "type_bien" text,
  "surface" numeric,
  "nb_pieces" integer,
  "nb_chambres" integer,
  "etage" integer,
  "parking" boolean default false,
  "dpe" text,
  "description" text,
  "points_forts" text[] default '{}'::text[],
  "prix_vendeur" integer,
  "commission_type" text default 'pourcentage'::text,
  "commission_val" numeric,
  "prix_acquereur" integer,
  "photos" text[] default '{}'::text[],
  "photo_principale" text,
  "agence_nom" text,
  "agence_adresse" text,
  "agence_tel" text,
  "agence_contact" text,
  "badge_retour" text default 'propose'::text,
  "commentaire" text,
  "note_conseiller" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "ges" text,
  "dpe_conso" integer,
  "ges_emissions" integer,
  "exposition" text,
  "nb_salles_bain" integer,
  "nb_wc" integer,
  "chauffage" text,
  "source_energie" text,
  "annee_construction" integer,
  "charges_trimestrielles" integer,
  "taxe_fonciere" integer,
  "etage_total" integer,
  "nb_lots" integer,
  "quartier" text,
  "balcon" boolean default false,
  "terrasse" boolean default false,
  "cave" boolean default false,
  "ascenseur" boolean default false,
  "gardien" boolean default false,
  "cuisine_equipee" boolean default false,
  "climatisation" boolean default false,
  "jardin" boolean default false,
  "surface_balcon" numeric,
  "surface_terrasse" numeric,
  "surface_jardin" numeric,
  "etat_general" text,
  "traversant" boolean default false,
  "recherche_id" uuid,
  "etape" text default 'selection'::text,
  "envoye_le" timestamp with time zone,
  "canal_envoi" text,
  "retour_client" text,
  "retour_le" timestamp with time zone,
  "pdf_statut" text,
  "pdf_demande_le" timestamp with time zone,
  "pdf_pret_le" timestamp with time zone,
  "pdf_url" text,
  "pdf_message" text,
  "yanport_id" text,
  "est_particulier" boolean default false,
  "historique_prix" jsonb default '[]'::jsonb,
  "date_derniere_baisse" timestamp with time zone,
  "date_publication" timestamp with time zone,
  "prix_initial" numeric,
  "nb_baisses" integer,
  "nb_agences" integer,
  "adresse_probable" text,
  "situation" text,
  "surface_sejour" numeric,
  "surface_exterieur" numeric,
  "nb_parking" integer,
  "score" integer,
  "points_attention" text[],
  "vu_le" timestamp with time zone,
  "nb_vues" integer default 0,
  "retour_par" text,
  "verdict" text,
  "appreciation" text,
  "plans" text[] default '{}'::text[] not null,
  "charges_comprises" text,
  "bien_vente_id" uuid,
  "inter" jsonb,
  "chauffage_emetteurs" text,
  "indispo" jsonb,
  "agence_interlocuteur" text,
  "agence_email" text,
  "agence_interlocuteur_tel" text
);
create table public."biens_vente" (
  "id" uuid default gen_random_uuid() not null,
  "reference" text,
  "etape" text default 'estimation'::text not null,
  "archive" boolean default false not null,
  "client_id" uuid,
  "document_id" uuid,
  "titre" text,
  "type_bien" text,
  "adresse" text,
  "code_postal" text,
  "ville" text,
  "quartier" text,
  "prix" numeric,
  "surface" numeric,
  "nb_pieces" integer,
  "nb_chambres" integer,
  "etage" integer,
  "mandat_type" text,
  "mandat_numero" text,
  "mandat_fin" date,
  "photo" text,
  "donnees" jsonb default '{}'::jsonb not null,
  "etape_le" timestamp with time zone,
  "en_vente_le" timestamp with time zone,
  "vendu_le" date,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "rapprochement_ia" jsonb
);
create table public."biens_vente_suivi" (
  "id" uuid default gen_random_uuid() not null,
  "bien_id" uuid not null,
  "type" text not null,
  "le" timestamp with time zone default now() not null,
  "qui" text,
  "client_id" uuid,
  "recherche_id" uuid,
  "montant" numeric,
  "statut" text,
  "avis" text,
  "commentaire" text,
  "donnees" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
create table public."clients" (
  "id" uuid default extensions.uuid_generate_v4() not null,
  "reference" text not null,
  "prenom" text not null,
  "nom" text not null,
  "adresse" text,
  "emails" text[] default '{}'::text[],
  "telephones" text[] default '{}'::text[],
  "statut" text default 'prospect'::text,
  "chaleur" text default 'tiede'::text,
  "raison_perte" text,
  "notes" text,
  "type_bien" text,
  "budget_min" integer,
  "budget_max" integer,
  "surface_min" integer,
  "surface_max" integer,
  "nb_pieces_min" integer,
  "nb_pieces_max" integer,
  "secteurs" text[] default '{}'::text[],
  "est_vendeur" boolean default false,
  "mandat_date_signature" date,
  "mandat_duree" integer,
  "mandat_honoraires" text,
  "mandat_date_expiration" date,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "chambres_min" integer,
  "parking" boolean default false,
  "cave" boolean default false,
  "balcon" boolean default false,
  "terrasse" boolean default false,
  "jardin" boolean default false,
  "ascenseur" boolean default false,
  "gardien" boolean default false,
  "interphone" boolean default false,
  "digicode" boolean default false,
  "rdc_exclu" boolean default false,
  "dernier_etage" boolean default false,
  "etage_min" integer,
  "dpe_max" character varying(1),
  "annee_construction_min" integer,
  "etat_souhaite" text,
  "exposition_souhaitee" text,
  "surface_sejour_min" integer,
  "etage_max" integer,
  "urgence" text,
  "financement" text,
  "apport" integer,
  "statut_occupation" text,
  "bien_actuel_type" text,
  "bien_actuel_surface" integer,
  "bien_actuel_valeur" integer,
  "bien_actuel_a_vendre" boolean default false,
  "bien_actuel_notes" text,
  "bien_actuel_adresse" text,
  "token_espace" text,
  "civilite" text,
  "couple" boolean default false not null,
  "conjoint" jsonb,
  "types" text[] default ARRAY['acheteur'::text] not null,
  "pro" jsonb default '{}'::jsonb not null,
  "archive" boolean default false not null,
  "suspension" jsonb,
  "source" text,
  "source_detail" text
);
create table public."contact_submissions" (
  "id" uuid default gen_random_uuid() not null,
  "form_type" text default 'contact'::text not null,
  "name" text not null,
  "email" text not null,
  "phone" text,
  "message" text,
  "budget" text,
  "property_type" text,
  "desired_location" text,
  "desired_surface" text,
  "timeline" text,
  "property_ref" text,
  "property_title" text,
  "is_called" boolean default false not null,
  "admin_notes" text,
  "created_at" timestamp with time zone default now() not null,
  "statut" text default 'nouveau'::text not null,
  "statut_le" timestamp with time zone,
  "a_rappeler_le" date,
  "archive" boolean default false not null,
  "archive_le" timestamp with time zone,
  "client_id" uuid,
  "notifie_le" timestamp with time zone,
  "source" text,
  "lead_id" text
);
create table public."documents" (
  "id" uuid default gen_random_uuid() not null,
  "modele" text not null,
  "categorie" text not null,
  "statut" text default 'brouillon'::text not null,
  "titre" text,
  "sous_titre" text,
  "badge" text,
  "numero" text,
  "donnees" jsonb default '{}'::jsonb not null,
  "identite" jsonb,
  "client_id" uuid,
  "recherche_id" uuid,
  "bien_id" uuid,
  "pdf_chemin" text,
  "signe_chemin" text,
  "finalise_le" timestamp with time zone,
  "signe_le" timestamp with time zone,
  "annule_le" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "signature" jsonb,
  "envois" jsonb default '[]'::jsonb not null
);
create table public."documents_signataires" (
  "id" uuid default gen_random_uuid() not null,
  "document_id" uuid not null,
  "cle" text not null,
  "rang" integer default 1 not null,
  "role" text,
  "nom" text,
  "mode" text default 'en_ligne'::text not null,
  "statut" text default 'invite'::text not null,
  "personne" jsonb default '{}'::jsonb not null,
  "jeton" text,
  "lien_expire_le" timestamp with time zone,
  "invite_le" timestamp with time zone,
  "ouvert_le" timestamp with time zone,
  "relances" integer default 0 not null,
  "relance_le" timestamp with time zone,
  "code_hash" text,
  "code_expire_le" timestamp with time zone,
  "code_essais" integer default 0 not null,
  "codes_envoyes" integer default 0 not null,
  "code_envoye_le" timestamp with time zone,
  "signe_le" timestamp with time zone,
  "ip" text,
  "appareil" text,
  "email_verifie" text,
  "griffe_chemin" text,
  "deroule" jsonb default '[]'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
create table public."envois" (
  "id" uuid default extensions.uuid_generate_v4() not null,
  "client_id" uuid,
  "type" text not null,
  "objet" text,
  "corps" text,
  "pdf_url" text,
  "biens_ids" uuid[] default '{}'::uuid[],
  "destinataires" text[] default '{}'::text[],
  "sms_envoye" boolean default false,
  "sms_message" text,
  "created_at" timestamp with time zone default now(),
  "recherche_id" uuid
);
create table public."espace_evenements" (
  "id" uuid default gen_random_uuid() not null,
  "recherche_id" uuid,
  "client_id" uuid,
  "bien_id" uuid,
  "type" text not null,
  "detail" text,
  "created_at" timestamp with time zone default now()
);
create table public."geocodes" (
  "cle" text not null,
  "adresse" text,
  "lat" double precision,
  "lng" double precision,
  "precision" text default 'aucun'::text not null,
  "score" real,
  "libelle" text,
  "cherche_le" timestamp with time zone default now() not null
);
create table public."journal" (
  "id" uuid default extensions.uuid_generate_v4() not null,
  "client_id" uuid,
  "type" text not null,
  "titre" text not null,
  "description" text,
  "metadata" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "recherche_id" uuid,
  "bien_id" uuid
);
create table public."mandats_cosignataires" (
  "id" uuid default gen_random_uuid() not null,
  "signature_id" uuid not null,
  "recherche_id" uuid,
  "rang" integer default 2 not null,
  "statut" text default 'prevu'::text not null,
  "saisi" jsonb default '{}'::jsonb not null,
  "personne" jsonb default '{}'::jsonb not null,
  "jeton" text,
  "lien_expire_le" timestamp with time zone,
  "invite_le" timestamp with time zone,
  "ouvert_le" timestamp with time zone,
  "relances" integer default 0 not null,
  "relance_le" timestamp with time zone,
  "code_hash" text,
  "code_expire_le" timestamp with time zone,
  "code_essais" integer default 0 not null,
  "codes_envoyes" integer default 0 not null,
  "code_envoye_le" timestamp with time zone,
  "signe_le" timestamp with time zone,
  "ip" text,
  "appareil" text,
  "email_verifie" text,
  "execution_immediate" boolean,
  "griffe_chemin" text,
  "decline_le" timestamp with time zone,
  "retracte_le" timestamp with time zone,
  "deroule" jsonb default '[]'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
create table public."mandats_signatures" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "recherche_id" uuid,
  "client_id" uuid,
  "numero" text not null,
  "type" text default 'simple'::text not null,
  "statut" text default 'en_cours'::text not null,
  "mandant" jsonb default '{}'::jsonb not null,
  "contenu" jsonb default '{}'::jsonb not null,
  "execution_immediate" boolean,
  "code_hash" text,
  "code_expire_le" timestamp with time zone,
  "code_essais" integer default 0 not null,
  "codes_envoyes" integer default 0 not null,
  "code_envoye_le" timestamp with time zone,
  "email_verifie" text,
  "signe_le" timestamp with time zone,
  "ip" text,
  "appareil" text,
  "empreinte" text,
  "pdf_chemin" text,
  "pdf_mandat_chemin" text,
  "retracte_le" timestamp with time zone,
  "deroule" jsonb default '[]'::jsonb not null,
  "societe" jsonb,
  "kbis_chemin" text,
  "griffe_chemin" text
);
create table public."parametres" (
  "id" uuid default extensions.uuid_generate_v4() not null,
  "cle" text not null,
  "valeur" text,
  "updated_at" timestamp with time zone default now()
);
create table public."propositions_agences" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid,
  "recherche_id" uuid,
  "url" text,
  "portail" text,
  "photos" text[] default '{}'::text[] not null,
  "adresse" text,
  "prix" numeric,
  "surface" numeric,
  "mot" text,
  "agence" text,
  "interlocuteur" text,
  "tel" text,
  "email" text,
  "lecture" text,
  "fiche" jsonb,
  "statut" text default 'nouveau'::text not null,
  "bien_id" uuid,
  "decide_le" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "pdf" jsonb,
  "envoi" jsonb
);
create table public."push_abonnements" (
  "id" uuid default gen_random_uuid() not null,
  "recherche_id" uuid not null,
  "client_id" uuid,
  "endpoint" text not null,
  "p256dh" text,
  "auth" text,
  "appareil" text,
  "cree_le" timestamp with time zone default now() not null,
  "dernier_ok" timestamp with time zone,
  "echecs" integer default 0 not null
);
create table public."recherches" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "nom" text default 'Recherche principale'::text not null,
  "active" boolean default true not null,
  "type_bien" text,
  "budget_min" integer,
  "budget_max" integer,
  "surface_min" integer,
  "surface_max" integer,
  "nb_pieces_min" integer,
  "nb_pieces_max" integer,
  "chambres_min" integer,
  "surface_sejour_min" integer,
  "secteurs" text[] default '{}'::text[],
  "etage_min" integer,
  "etage_max" integer,
  "rdc_exclu" boolean default false,
  "dernier_etage" boolean default false,
  "dpe_max" text,
  "annee_construction_min" integer,
  "etat_souhaite" text,
  "exposition_souhaitee" text,
  "parking" boolean default false,
  "cave" boolean default false,
  "balcon" boolean default false,
  "terrasse" boolean default false,
  "jardin" boolean default false,
  "ascenseur" boolean default false,
  "gardien" boolean default false,
  "interphone" boolean default false,
  "digicode" boolean default false,
  "urgence" text,
  "financement" text,
  "apport" integer,
  "sans_mandat" boolean default false,
  "mandat_date_signature" date,
  "mandat_duree" integer,
  "mandat_honoraires" text,
  "mandat_date_expiration" date,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "token_espace" text,
  "espace_actif" boolean default true,
  "espace_ouvert_le" timestamp with time zone,
  "transport_minutes" integer,
  "transport_lignes" text[] default '{}'::text[],
  "transport_arrets" jsonb default '[]'::jsonb,
  "exigences" jsonb default '{}'::jsonb,
  "etage_max_sans_ascenseur" integer,
  "cuisine_type" text,
  "exterieur_surface_min" integer,
  "historique_vu_le" timestamp with time zone,
  "bienvenue_envoye_le" timestamp with time zone,
  "mandat_numero" text,
  "mandat_type" text default 'simple'::text,
  "mandat_propose_le" timestamp with time zone,
  "mandat_taux" numeric,
  "mandat_forfait" numeric,
  "appris_masques" text[] default '{}'::text[],
  "parcours" jsonb,
  "token_agences" text,
  "precisions_agences" text
);
create table public."registre_depart" (
  "id" integer default 1 not null,
  "premier_numero" integer not null,
  "demarre_le" timestamp with time zone default now() not null,
  "reprise" text,
  "empreinte" text not null
);
create table public."registre_mandats" (
  "id" uuid default gen_random_uuid() not null,
  "numero" integer not null,
  "inscrit_le" timestamp with time zone default now() not null,
  "nature" text not null,
  "type_mandat" text,
  "mandants" text not null,
  "objet" text not null,
  "source" text default 'document'::text not null,
  "client_id" uuid,
  "recherche_id" uuid,
  "bien_vente_id" uuid,
  "document_id" uuid,
  "signature_id" uuid,
  "empreinte_prec" text not null,
  "empreinte" text not null
);
create table public."registre_observations" (
  "id" uuid default gen_random_uuid() not null,
  "rang" bigint generated always as identity not null,
  "registre_id" uuid not null,
  "le" timestamp with time zone default now() not null,
  "type" text not null,
  "texte" text not null,
  "document_id" uuid,
  "empreinte_prec" text not null,
  "empreinte" text not null
);
create table public."relances" (
  "id" uuid default extensions.uuid_generate_v4() not null,
  "client_id" uuid,
  "bien_id" uuid,
  "type" text default 'auto'::text,
  "statut" text default 'en_attente'::text,
  "date_echeance" timestamp with time zone not null,
  "note" text,
  "resultat" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "recherche_id" uuid
);
create table public."rendez_vous" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "type" text default 'client'::text not null,
  "titre" text not null,
  "debut" timestamp with time zone not null,
  "fin" timestamp with time zone not null,
  "lieu" text,
  "notes" text,
  "client_id" uuid,
  "recherche_id" uuid,
  "details" jsonb default '{}'::jsonb not null,
  "relance_id" uuid,
  "statut" text default 'a_venir'::text not null
);
create table public."suivis_agence" (
  "id" uuid default gen_random_uuid() not null,
  "bien_id" uuid not null,
  "recherche_id" uuid,
  "client_id" uuid,
  "genre" text default 'note'::text not null,
  "avec" text,
  "contact" jsonb default '{}'::jsonb not null,
  "reponse" text,
  "dispo" text,
  "texte" text,
  "creneaux" jsonb default '[]'::jsonb not null,
  "ensuite" text,
  "rappel_le" date,
  "relance_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "montrer" boolean default true not null,
  "mot_client" text
);
create table public."transactions" (
  "id" uuid default extensions.uuid_generate_v4() not null,
  "client_id" uuid,
  "bien_id" uuid,
  "etape_actuelle" text default 'offre'::text,
  "offre_montant" integer,
  "offre_date" date,
  "offre_note" text,
  "contre_offres" jsonb default '[]'::jsonb,
  "prix_final" integer,
  "accord_date" date,
  "compromis_date" date,
  "compromis_notaire" text,
  "sru_date_fin" date,
  "financement_type" text default 'pret'::text,
  "pret_montant" integer,
  "pret_apport" integer,
  "pret_duree" integer,
  "pret_taux" numeric,
  "pret_cond_susp_date" date,
  "pret_offre_recue_date" date,
  "pret_offre_acceptee_date" date,
  "pret_banque" text,
  "acte_date_prevue" date,
  "acte_date_effective" date,
  "acte_notaire_acheteur" text,
  "acte_notaire_vendeur" text,
  "honoraires_ht" integer,
  "honoraires_tva" numeric default 20,
  "honoraires_ttc" integer,
  "economie_negociee" integer,
  "notes_finales" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "recherche_id" uuid
);
create table public."veille_passages" (
  "id" uuid default gen_random_uuid() not null,
  "recherche_id" uuid,
  "demarre_le" timestamp with time zone default now() not null,
  "termine_le" timestamp with time zone,
  "nb_lues" integer default 0,
  "nb_proposees" integer default 0,
  "nb_ecartees" integer default 0,
  "statut" text default 'en_cours'::text,
  "message" text
);
create table public."veille_propositions" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "recherche_id" uuid not null,
  "url" text not null,
  "portail" text,
  "date_annonce" date,
  "titre" text,
  "type_bien" text,
  "ville" text,
  "code_postal" text,
  "quartier" text,
  "adresse" text,
  "prix" integer,
  "surface" numeric,
  "nb_pieces" integer,
  "nb_chambres" integer,
  "surface_sejour" numeric,
  "etage" integer,
  "etage_total" integer,
  "annee_construction" integer,
  "nb_lots" integer,
  "charges_trimestrielles" integer,
  "taxe_fonciere" integer,
  "dpe" text,
  "ges" text,
  "terrasse" boolean default false,
  "balcon" boolean default false,
  "jardin" boolean default false,
  "parking" boolean default false,
  "nb_parking" integer,
  "ascenseur" boolean default false,
  "cave" boolean default false,
  "gardien" boolean default false,
  "surface_exterieur" numeric,
  "exposition" text,
  "description" text,
  "photos" text[] default '{}'::text[],
  "points_forts" text[] default '{}'::text[],
  "points_attention" text[] default '{}'::text[],
  "score" integer,
  "statut" text default 'nouveau'::text not null,
  "motif_ecart" text,
  "bien_id" uuid,
  "decide_le" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "adresse_probable" text,
  "situation" text,
  "agence" text,
  "date_publication" date,
  "prix_initial" integer,
  "nb_baisses" integer,
  "nb_agences" integer,
  "photos_nettoyees" boolean default false,
  "yanport_id" text,
  "est_particulier" boolean default false,
  "sources" text[] default '{}'::text[],
  "historique_prix" jsonb default '[]'::jsonb,
  "date_derniere_baisse" timestamp with time zone,
  "verdict" text,
  "appreciation" text,
  "plans" text[] default '{}'::text[] not null,
  "charges_comprises" text,
  "agence_tel" text,
  "chauffage" text,
  "source_energie" text,
  "chauffage_emetteurs" text
);
create table public."visites" (
  "id" uuid default extensions.uuid_generate_v4() not null,
  "client_id" uuid,
  "bien_id" uuid,
  "statut" text default 'a_venir'::text,
  "date_visite" timestamp with time zone,
  "heure" text,
  "adresse_bien" text,
  "contact_agence" text,
  "tel_agence" text,
  "note_etoiles" integer,
  "points_positifs" text,
  "points_negatifs" text,
  "ressenti" text,
  "suite_donnee" text,
  "commentaire" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "recherche_id" uuid,
  "duree_min" integer,
  "rappel_relance_id" uuid,
  "rappel_envoye_le" timestamp with time zone,
  "issue" text,
  "issue_par" text,
  "issue_le" timestamp with time zone,
  "motifs" text[],
  "aime" text[],
  "mot_client" text,
  "avis_client_le" timestamp with time zone,
  "prix_envisage" integer,
  "retenir" boolean default true,
  "avis_client" text
);

alter table public."annonces_client" add constraint "annonces_client_pkey" PRIMARY KEY (id);
alter table public."biens" add constraint "biens_pkey" PRIMARY KEY (id);
alter table public."biens_vente" add constraint "biens_vente_pkey" PRIMARY KEY (id);
alter table public."biens_vente_suivi" add constraint "biens_vente_suivi_pkey" PRIMARY KEY (id);
alter table public."clients" add constraint "clients_pkey" PRIMARY KEY (id);
alter table public."contact_submissions" add constraint "contact_submissions_pkey" PRIMARY KEY (id);
alter table public."documents" add constraint "documents_pkey" PRIMARY KEY (id);
alter table public."documents_signataires" add constraint "documents_signataires_pkey" PRIMARY KEY (id);
alter table public."envois" add constraint "envois_pkey" PRIMARY KEY (id);
alter table public."espace_evenements" add constraint "espace_evenements_pkey" PRIMARY KEY (id);
alter table public."geocodes" add constraint "geocodes_pkey" PRIMARY KEY (cle);
alter table public."journal" add constraint "journal_pkey" PRIMARY KEY (id);
alter table public."mandats_cosignataires" add constraint "mandats_cosignataires_pkey" PRIMARY KEY (id);
alter table public."mandats_signatures" add constraint "mandats_signatures_pkey" PRIMARY KEY (id);
alter table public."parametres" add constraint "parametres_pkey" PRIMARY KEY (id);
alter table public."propositions_agences" add constraint "propositions_agences_pkey" PRIMARY KEY (id);
alter table public."push_abonnements" add constraint "push_abonnements_pkey" PRIMARY KEY (id);
alter table public."recherches" add constraint "recherches_pkey" PRIMARY KEY (id);
alter table public."registre_depart" add constraint "registre_depart_pkey" PRIMARY KEY (id);
alter table public."registre_mandats" add constraint "registre_mandats_pkey" PRIMARY KEY (id);
alter table public."registre_observations" add constraint "registre_observations_pkey" PRIMARY KEY (id);
alter table public."relances" add constraint "relances_pkey" PRIMARY KEY (id);
alter table public."rendez_vous" add constraint "rendez_vous_pkey" PRIMARY KEY (id);
alter table public."suivis_agence" add constraint "suivis_agence_pkey" PRIMARY KEY (id);
alter table public."transactions" add constraint "transactions_pkey" PRIMARY KEY (id);
alter table public."veille_passages" add constraint "veille_passages_pkey" PRIMARY KEY (id);
alter table public."veille_propositions" add constraint "veille_propositions_pkey" PRIMARY KEY (id);
alter table public."visites" add constraint "visites_pkey" PRIMARY KEY (id);
alter table public."clients" add constraint "clients_reference_key" UNIQUE (reference);
alter table public."documents_signataires" add constraint "documents_signataires_jeton_key" UNIQUE (jeton);
alter table public."mandats_cosignataires" add constraint "mandats_cosignataires_jeton_key" UNIQUE (jeton);
alter table public."parametres" add constraint "parametres_cle_key" UNIQUE (cle);
alter table public."push_abonnements" add constraint "push_abonnements_endpoint_key" UNIQUE (endpoint);
alter table public."registre_mandats" add constraint "registre_mandats_numero_key" UNIQUE (numero);
alter table public."registre_observations" add constraint "registre_observations_rang_key" UNIQUE (rang);
alter table public."biens" add constraint "biens_badge_retour_check" CHECK ((badge_retour = ANY (ARRAY['propose'::text, 'interesse'::text, 'souhaite_visiter'::text, 'visite'::text, 'offre_faite'::text, 'refuse'::text])));
alter table public."biens" add constraint "biens_verdict_check" CHECK (((verdict IS NULL) OR (verdict = ANY (ARRAY['priorite'::text, 'appeler'::text, 'reserve'::text, 'ecarter'::text]))));
alter table public."clients" add constraint "clients_chaleur_check" CHECK ((chaleur = ANY (ARRAY['tres_chaud'::text, 'interesse'::text, 'tiede'::text, 'froid'::text])));
alter table public."clients" add constraint "clients_statut_check" CHECK ((statut = ANY (ARRAY['prospect'::text, 'actif'::text, 'suspendu'::text, 'bien_trouve'::text, 'perdu'::text])));
alter table public."envois" add constraint "envois_type_check" CHECK ((type = ANY (ARRAY['mail_libre'::text, 'envoi_bien'::text, 'selection_biens'::text, 'compte_rendu_visite'::text]))) NOT VALID;
alter table public."registre_depart" add constraint "registre_depart_id_check" CHECK ((id = 1));
alter table public."registre_depart" add constraint "registre_depart_premier_numero_check" CHECK ((premier_numero > 0));
alter table public."registre_mandats" add constraint "registre_mandats_nature_check" CHECK ((nature = ANY (ARRAY['vente'::text, 'recherche'::text])));
alter table public."relances" add constraint "relances_statut_check" CHECK ((statut = ANY (ARRAY['en_attente'::text, 'cloturee'::text, 'reportee'::text])));
alter table public."relances" add constraint "relances_type_check" CHECK ((type = ANY (ARRAY['auto'::text, 'manuelle'::text])));
alter table public."transactions" add constraint "transactions_etape_actuelle_check" CHECK ((etape_actuelle = ANY (ARRAY['offre'::text, 'negociation'::text, 'offre_acceptee'::text, 'compromis'::text, 'acte'::text, 'finalise'::text])));
alter table public."veille_passages" add constraint "veille_passages_statut_check" CHECK ((statut = ANY (ARRAY['en_cours'::text, 'termine'::text, 'erreur'::text])));
alter table public."veille_propositions" add constraint "veille_propositions_statut_check" CHECK ((statut = ANY (ARRAY['nouveau'::text, 'retenu'::text, 'ecarte'::text])));
alter table public."veille_propositions" add constraint "veille_propositions_verdict_check" CHECK (((verdict IS NULL) OR (verdict = ANY (ARRAY['priorite'::text, 'appeler'::text, 'reserve'::text, 'ecarter'::text]))));
alter table public."visites" add constraint "visites_note_etoiles_check" CHECK (((note_etoiles IS NULL) OR ((note_etoiles >= 0) AND (note_etoiles <= 5))));
alter table public."visites" add constraint "visites_statut_check" CHECK ((statut = ANY (ARRAY['a_venir'::text, 'effectuee'::text, 'annulee'::text])));
alter table public."annonces_client" add constraint "annonces_client_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE SET NULL;
alter table public."annonces_client" add constraint "annonces_client_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."annonces_client" add constraint "annonces_client_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."biens" add constraint "biens_bien_vente_id_fkey" FOREIGN KEY (bien_vente_id) REFERENCES biens_vente(id) ON DELETE SET NULL;
alter table public."biens" add constraint "biens_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."biens" add constraint "biens_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."biens_vente" add constraint "biens_vente_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public."biens_vente" add constraint "biens_vente_document_id_fkey" FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
alter table public."biens_vente_suivi" add constraint "biens_vente_suivi_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens_vente(id) ON DELETE CASCADE;
alter table public."biens_vente_suivi" add constraint "biens_vente_suivi_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public."biens_vente_suivi" add constraint "biens_vente_suivi_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE SET NULL;
alter table public."contact_submissions" add constraint "contact_submissions_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public."documents" add constraint "documents_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE SET NULL;
alter table public."documents" add constraint "documents_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public."documents" add constraint "documents_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE SET NULL;
alter table public."documents_signataires" add constraint "documents_signataires_document_id_fkey" FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public."envois" add constraint "envois_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."envois" add constraint "envois_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."espace_evenements" add constraint "espace_evenements_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE SET NULL;
alter table public."espace_evenements" add constraint "espace_evenements_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."espace_evenements" add constraint "espace_evenements_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."journal" add constraint "journal_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE SET NULL;
alter table public."journal" add constraint "journal_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."journal" add constraint "journal_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE SET NULL;
alter table public."mandats_cosignataires" add constraint "mandats_cosignataires_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE SET NULL;
alter table public."mandats_cosignataires" add constraint "mandats_cosignataires_signature_id_fkey" FOREIGN KEY (signature_id) REFERENCES mandats_signatures(id) ON DELETE CASCADE;
alter table public."mandats_signatures" add constraint "mandats_signatures_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public."mandats_signatures" add constraint "mandats_signatures_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE SET NULL;
alter table public."propositions_agences" add constraint "propositions_agences_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE SET NULL;
alter table public."propositions_agences" add constraint "propositions_agences_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."propositions_agences" add constraint "propositions_agences_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."push_abonnements" add constraint "push_abonnements_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."push_abonnements" add constraint "push_abonnements_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."recherches" add constraint "recherches_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."registre_observations" add constraint "registre_observations_registre_id_fkey" FOREIGN KEY (registre_id) REFERENCES registre_mandats(id);
alter table public."relances" add constraint "relances_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE SET NULL;
alter table public."relances" add constraint "relances_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."relances" add constraint "relances_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."rendez_vous" add constraint "rendez_vous_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."rendez_vous" add constraint "rendez_vous_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."suivis_agence" add constraint "suivis_agence_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE CASCADE;
alter table public."suivis_agence" add constraint "suivis_agence_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table public."suivis_agence" add constraint "suivis_agence_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE SET NULL;
alter table public."transactions" add constraint "transactions_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE CASCADE;
alter table public."transactions" add constraint "transactions_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."transactions" add constraint "transactions_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."veille_passages" add constraint "veille_passages_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."veille_propositions" add constraint "veille_propositions_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE SET NULL;
alter table public."veille_propositions" add constraint "veille_propositions_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."veille_propositions" add constraint "veille_propositions_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;
alter table public."visites" add constraint "visites_bien_id_fkey" FOREIGN KEY (bien_id) REFERENCES biens(id) ON DELETE CASCADE;
alter table public."visites" add constraint "visites_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
alter table public."visites" add constraint "visites_recherche_id_fkey" FOREIGN KEY (recherche_id) REFERENCES recherches(id) ON DELETE CASCADE;

CREATE INDEX idx_transactions_recherche ON public.transactions USING btree (recherche_id);
CREATE INDEX idx_envois_client ON public.envois USING btree (client_id);
CREATE INDEX idx_envois_recherche ON public.envois USING btree (recherche_id);
CREATE INDEX idx_journal_client ON public.journal USING btree (client_id);
CREATE INDEX idx_journal_bien_id ON public.journal USING btree (bien_id);
CREATE INDEX idx_journal_bien ON public.journal USING btree (bien_id);
CREATE INDEX idx_passages_recherche ON public.veille_passages USING btree (recherche_id, demarre_le DESC);
CREATE INDEX idx_clients_statut ON public.clients USING btree (statut);
CREATE UNIQUE INDEX clients_token_espace_key ON public.clients USING btree (token_espace) WHERE (token_espace IS NOT NULL);
CREATE INDEX mandats_cosignataires_signature_idx ON public.mandats_cosignataires USING btree (signature_id, rang);
CREATE INDEX mandats_cosignataires_statut_idx ON public.mandats_cosignataires USING btree (statut);
CREATE INDEX idx_relances_client ON public.relances USING btree (client_id);
CREATE INDEX idx_relances_statut ON public.relances USING btree (statut);
CREATE INDEX idx_relances_recherche ON public.relances USING btree (recherche_id);
CREATE UNIQUE INDEX idx_veille_unique_url ON public.veille_propositions USING btree (recherche_id, url);
CREATE INDEX idx_veille_recherche_statut ON public.veille_propositions USING btree (recherche_id, statut, created_at DESC);
CREATE INDEX idx_veille_client ON public.veille_propositions USING btree (client_id);
CREATE INDEX idx_veille_yanport ON public.veille_propositions USING btree (recherche_id, yanport_id) WHERE (yanport_id IS NOT NULL);
CREATE INDEX idx_recherches_client ON public.recherches USING btree (client_id);
CREATE UNIQUE INDEX idx_recherches_token ON public.recherches USING btree (token_espace) WHERE (token_espace IS NOT NULL);
CREATE UNIQUE INDEX recherches_token_agences_idx ON public.recherches USING btree (token_agences) WHERE (token_agences IS NOT NULL);
CREATE INDEX idx_biens_recherche ON public.biens USING btree (recherche_id);
CREATE INDEX idx_biens_client ON public.biens USING btree (client_id);
CREATE INDEX idx_biens_etape ON public.biens USING btree (recherche_id, etape);
CREATE INDEX idx_biens_pdf ON public.biens USING btree (pdf_statut) WHERE (pdf_statut IS NOT NULL);
CREATE INDEX idx_biens_vu ON public.biens USING btree (recherche_id, vu_le);
CREATE INDEX biens_bien_vente_idx ON public.biens USING btree (bien_vente_id);
CREATE INDEX idx_espace_evt ON public.espace_evenements USING btree (recherche_id, created_at DESC);
CREATE INDEX idx_espace_evt_bien ON public.espace_evenements USING btree (bien_id);
CREATE INDEX idx_push_recherche ON public.push_abonnements USING btree (recherche_id);
CREATE INDEX rendez_vous_debut_idx ON public.rendez_vous USING btree (debut);
CREATE INDEX rendez_vous_recherche_idx ON public.rendez_vous USING btree (recherche_id);
CREATE INDEX documents_categorie_idx ON public.documents USING btree (categorie, updated_at DESC);
CREATE INDEX documents_client_idx ON public.documents USING btree (client_id);
CREATE INDEX mandats_signatures_recherche_idx ON public.mandats_signatures USING btree (recherche_id);
CREATE INDEX mandats_signatures_client_idx ON public.mandats_signatures USING btree (client_id);
CREATE INDEX idx_visites_client ON public.visites USING btree (client_id);
CREATE INDEX idx_visites_recherche ON public.visites USING btree (recherche_id);
CREATE INDEX documents_signataires_document_idx ON public.documents_signataires USING btree (document_id, rang);
CREATE INDEX documents_signataires_statut_idx ON public.documents_signataires USING btree (statut);
CREATE INDEX biens_vente_suivi_bien_idx ON public.biens_vente_suivi USING btree (bien_id, le DESC);
CREATE INDEX biens_vente_etape_idx ON public.biens_vente USING btree (archive, etape);
CREATE INDEX biens_vente_client_idx ON public.biens_vente USING btree (client_id);
CREATE INDEX propositions_agences_recherche_idx ON public.propositions_agences USING btree (recherche_id, created_at DESC);
CREATE INDEX registre_mandats_document_idx ON public.registre_mandats USING btree (document_id);
CREATE INDEX registre_mandats_recherche_idx ON public.registre_mandats USING btree (recherche_id);
CREATE INDEX registre_mandats_client_idx ON public.registre_mandats USING btree (client_id);
CREATE INDEX registre_observations_ligne_idx ON public.registre_observations USING btree (registre_id, rang);
CREATE INDEX suivis_agence_bien_idx ON public.suivis_agence USING btree (bien_id, created_at DESC);
CREATE INDEX suivis_agence_recherche_idx ON public.suivis_agence USING btree (recherche_id);
CREATE INDEX contact_submissions_created_at ON public.contact_submissions USING btree (created_at DESC);
CREATE UNIQUE INDEX contact_submissions_lead_id ON public.contact_submissions USING btree (lead_id);
CREATE INDEX annonces_client_recherche_idx ON public.annonces_client USING btree (recherche_id, created_at DESC);
CREATE INDEX annonces_client_bien_idx ON public.annonces_client USING btree (bien_id);

-- Fonctions (dans l'ordre où elles se servent les unes des autres)
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_veille_propositions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registre_heure(t timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$function$;

CREATE OR REPLACE FUNCTION public.registre_sha(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select encode(extensions.digest(convert_to(t, 'UTF8'), 'sha256'), 'hex')
$function$;

CREATE OR REPLACE FUNCTION public.registre_immuable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'Le registre des mandats ne se modifie pas et ne s''efface pas : ajoute une observation.';
end $function$;

CREATE OR REPLACE FUNCTION public.registre_empreinte_ligne(r registre_mandats)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select registre_sha(concat_ws('|', 'mandat', r.numero::text, registre_heure(r.inscrit_le), r.nature, coalesce(r.type_mandat, ''),
    r.mandants, r.objet, r.source, coalesce(r.client_id::text, ''), coalesce(r.recherche_id::text, ''), coalesce(r.bien_vente_id::text, ''),
    coalesce(r.document_id::text, ''), coalesce(r.signature_id::text, ''), r.empreinte_prec))
$function$;

CREATE OR REPLACE FUNCTION public.registre_empreinte_obs(o registre_observations)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select registre_sha(concat_ws('|', 'observation', o.registre_id::text, registre_heure(o.le), o.type, o.texte, coalesce(o.document_id::text, ''), o.empreinte_prec))
$function$;

CREATE OR REPLACE FUNCTION public.registre_obs_empreinte()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  new.empreinte := registre_empreinte_obs(new);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.registre_demarrer(p_premier integer, p_reprise text DEFAULT NULL::text)
 RETURNS registre_depart
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare d registre_depart;
begin
  if exists (select 1 from registre_depart) then raise exception 'Le registre est déjà démarré.'; end if;
  if p_premier is null or p_premier < 1 then raise exception 'Le premier numéro doit être un nombre positif.'; end if;
  d.id := 1; d.premier_numero := p_premier; d.demarre_le := now(); d.reprise := nullif(trim(coalesce(p_reprise, '')), '');
  d.empreinte := registre_sha(concat_ws('|', 'depart', p_premier::text, registre_heure(d.demarre_le), coalesce(d.reprise, '')));
  insert into registre_depart values (d.*);
  return d;
end $function$;

CREATE OR REPLACE FUNCTION public.registre_inscrire(p jsonb)
 RETURNS registre_mandats
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare d registre_depart; r registre_mandats; n integer; prec text;
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
  select coalesce(max(numero) + 1, d.premier_numero) into n from registre_mandats;
  select empreinte into prec from registre_mandats order by numero desc limit 1;
  -- L'heure réelle, prise sous le verrou (now() serait celle du début de la
  -- transaction : un numéro pourrait paraître inscrit avant le précédent).
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
end $function$;

CREATE OR REPLACE FUNCTION public.registre_observer(p jsonb)
 RETURNS registre_observations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare l registre_mandats; o registre_observations; prec text; d registre_depart;
begin
  perform pg_advisory_xact_lock(7201973);
  if nullif(p->>'registre_id', '') is not null then select * into l from registre_mandats where id = (p->>'registre_id')::uuid;
  elsif nullif(p->>'document_id_mandat', '') is not null then select * into l from registre_mandats where document_id = (p->>'document_id_mandat')::uuid order by numero limit 1;
  elsif nullif(p->>'signature_id', '') is not null then select * into l from registre_mandats where signature_id = (p->>'signature_id')::uuid order by numero limit 1;
  elsif nullif(p->>'numero', '') is not null and (p->>'numero') ~ '^\d+$' then select * into l from registre_mandats where numero = (p->>'numero')::integer;
  end if;
  if l.id is null then return null; end if;
  if nullif(trim(coalesce(p->>'type', '')), '') is null or nullif(trim(coalesce(p->>'texte', '')), '') is null then
    raise exception 'Une observation a un type et un texte.';
  end if;
  if nullif(p->>'document_id', '') is not null then
    select * into o from registre_observations where registre_id = l.id and type = p->>'type' and document_id = (p->>'document_id')::uuid limit 1;
    if found then return o; end if;
  end if;
  select * into d from registre_depart where id = 1;
  select empreinte into prec from registre_observations order by rang desc limit 1;
  insert into registre_observations (registre_id, le, type, texte, document_id, empreinte_prec, empreinte)
  values (l.id, clock_timestamp(), trim(p->>'type'), trim(p->>'texte'), nullif(p->>'document_id', '')::uuid, coalesce(prec, d.empreinte), 'calculée par le déclencheur')
  returning * into o;
  return o;
end $function$;

CREATE OR REPLACE FUNCTION public.registre_verifier()
 RETURNS TABLE(quoi text, numero integer, probleme text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare d registre_depart; r registre_mandats; o registre_observations; attendu integer; prec text;
begin
  select * into d from registre_depart where id = 1;
  if not found then return; end if;
  if d.empreinte <> registre_sha(concat_ws('|', 'depart', d.premier_numero::text, registre_heure(d.demarre_le), coalesce(d.reprise, ''))) then
    quoi := 'depart'; numero := d.premier_numero; probleme := 'Le départ du registre a été modifié.'; return next;
  end if;
  attendu := d.premier_numero; prec := d.empreinte;
  for r in select * from registre_mandats order by numero loop
    if r.numero <> attendu then quoi := 'mandat'; numero := r.numero; probleme := format('Numéro attendu : %s. Un numéro manque ou a été sauté.', attendu); return next; end if;
    if r.empreinte_prec <> prec then quoi := 'mandat'; numero := r.numero; probleme := 'Le lien avec la ligne précédente est rompu.'; return next; end if;
    if r.empreinte <> registre_empreinte_ligne(r) then quoi := 'mandat'; numero := r.numero; probleme := 'Le contenu de la ligne ne correspond plus à son empreinte.'; return next; end if;
    attendu := r.numero + 1; prec := r.empreinte;
  end loop;
  prec := d.empreinte;
  for o in select * from registre_observations order by rang loop
    if o.empreinte_prec <> prec or o.empreinte <> registre_empreinte_obs(o) then
      quoi := 'observation'; select m.numero into numero from registre_mandats m where m.id = o.registre_id;
      probleme := 'Une observation ne correspond plus à son empreinte.'; return next;
    end if;
    prec := o.empreinte;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.emilio_types_vente(cid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t text[]; arch boolean; vend boolean; possede boolean; vendu boolean; n text[];
begin
  if cid is null then return; end if;
  select types, coalesce(archive, false) into t, arch from clients where id = cid;
  if not found or arch then return; end if;
  if t is null or cardinality(t) = 0 then t := array['acheteur']; end if;
  select coalesce(bool_or(etape in ('mandat', 'offre', 'compromis')), false),
         coalesce(bool_or(etape not in ('vendu', 'annonce_type')), false),
         coalesce(bool_or(etape = 'vendu'), false)
    into vend, possede, vendu
    from biens_vente where client_id = cid and coalesce(archive, false) = false;
  if vend then
    n := array_remove(array_remove(t, 'vendeur_signe'), 'proprietaire');
    if not ('vendeur' = any(n)) then n := n || 'vendeur'::text; end if;
  elsif 'vendeur' = any(t) then
    if not possede and vendu then return; end if;
    n := array_remove(t, 'vendeur');
    if (possede or cardinality(n) = 0) and not ('proprietaire' = any(n)) then n := n || 'proprietaire'::text; end if;
  elsif possede and not ('proprietaire' = any(t)) then
    n := t || 'proprietaire'::text;
  else
    return;
  end if;
  if (select array_agg(x order by x) from unnest(n) x) is distinct from (select array_agg(x order by x) from unnest(t) x) then
    update clients set types = n where id = cid;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.emilio_types_vente_bien()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op <> 'INSERT' then perform emilio_types_vente(old.client_id); end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.client_id is distinct from old.client_id) then
    perform emilio_types_vente(new.client_id);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.annonce_client_presentee()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare propose_le timestamptz;
begin
  if new.etape = 'presente' and old.etape is distinct from 'presente'
     and (new.badge_retour is null or new.badge_retour = 'propose') then
    select a.created_at into propose_le from annonces_client a
     where a.bien_id = new.id and a.statut = 'retenu'
     order by a.created_at limit 1;
    if propose_le is not null then
      new.badge_retour := 'interesse';
      if new.retour_le is null then new.retour_le := propose_le; end if;
    end if;
  end if;
  return new;
end $function$;

-- Déclencheurs
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER biens_updated_at BEFORE UPDATE ON public.biens FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER visites_updated_at BEFORE UPDATE ON public.visites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER relances_updated_at BEFORE UPDATE ON public.relances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_touch_veille BEFORE UPDATE ON public.veille_propositions FOR EACH ROW EXECUTE FUNCTION touch_veille_propositions();
CREATE TRIGGER registre_depart_immuable BEFORE DELETE OR UPDATE ON public.registre_depart FOR EACH ROW EXECUTE FUNCTION registre_immuable();
CREATE TRIGGER registre_mandats_immuable BEFORE DELETE OR UPDATE ON public.registre_mandats FOR EACH ROW EXECUTE FUNCTION registre_immuable();
CREATE TRIGGER registre_observations_immuable BEFORE DELETE OR UPDATE ON public.registre_observations FOR EACH ROW EXECUTE FUNCTION registre_immuable();
CREATE TRIGGER registre_depart_tronque BEFORE TRUNCATE ON public.registre_depart FOR EACH STATEMENT EXECUTE FUNCTION registre_immuable();
CREATE TRIGGER registre_mandats_tronque BEFORE TRUNCATE ON public.registre_mandats FOR EACH STATEMENT EXECUTE FUNCTION registre_immuable();
CREATE TRIGGER registre_observations_tronque BEFORE TRUNCATE ON public.registre_observations FOR EACH STATEMENT EXECUTE FUNCTION registre_immuable();
CREATE TRIGGER registre_observations_empreinte BEFORE INSERT ON public.registre_observations FOR EACH ROW EXECUTE FUNCTION registre_obs_empreinte();
CREATE TRIGGER biens_vente_types_vendeur_ajout AFTER INSERT OR DELETE ON public.biens_vente FOR EACH ROW EXECUTE FUNCTION emilio_types_vente_bien();
CREATE TRIGGER biens_vente_types_vendeur_maj AFTER UPDATE OF etape, client_id, archive ON public.biens_vente FOR EACH ROW WHEN (((old.etape IS DISTINCT FROM new.etape) OR (old.client_id IS DISTINCT FROM new.client_id) OR (old.archive IS DISTINCT FROM new.archive))) EXECUTE FUNCTION emilio_types_vente_bien();
CREATE TRIGGER annonce_client_presentee BEFORE UPDATE ON public.biens FOR EACH ROW EXECUTE FUNCTION annonce_client_presentee();

alter table public."annonces_client" enable row level security;
alter table public."biens" enable row level security;
alter table public."biens_vente" enable row level security;
alter table public."biens_vente_suivi" enable row level security;
alter table public."clients" enable row level security;
alter table public."contact_submissions" enable row level security;
alter table public."documents" enable row level security;
alter table public."documents_signataires" enable row level security;
alter table public."envois" enable row level security;
alter table public."espace_evenements" enable row level security;
alter table public."geocodes" enable row level security;
alter table public."journal" enable row level security;
alter table public."mandats_cosignataires" enable row level security;
alter table public."mandats_signatures" enable row level security;
alter table public."parametres" enable row level security;
alter table public."propositions_agences" enable row level security;
alter table public."push_abonnements" enable row level security;
alter table public."recherches" enable row level security;
alter table public."registre_depart" enable row level security;
alter table public."registre_mandats" enable row level security;
alter table public."registre_observations" enable row level security;
alter table public."relances" enable row level security;
alter table public."rendez_vous" enable row level security;
alter table public."suivis_agence" enable row level security;
alter table public."transactions" enable row level security;
alter table public."veille_passages" enable row level security;
alter table public."veille_propositions" enable row level security;
alter table public."visites" enable row level security;

create policy "crm_authentifie" on public."annonces_client" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."biens" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."biens_vente" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."biens_vente_suivi" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."clients" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."contact_submissions" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."documents" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."documents_signataires" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."envois" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."espace_evenements" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."geocodes" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."journal" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."mandats_cosignataires" as permissive for all to authenticated using (true) with check (true);
create policy "crm_tout" on public."mandats_signatures" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."parametres" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."propositions_agences" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."push_abonnements" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."recherches" as permissive for all to authenticated using (true) with check (true);
create policy "crm_lecture" on public."registre_depart" as permissive for select to authenticated using (true);
create policy "crm_lecture" on public."registre_mandats" as permissive for select to authenticated using (true);
create policy "crm_lecture" on public."registre_observations" as permissive for select to authenticated using (true);
create policy "crm_authentifie" on public."relances" as permissive for all to authenticated using (true) with check (true);
create policy "crm_tout" on public."rendez_vous" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."suivis_agence" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."transactions" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."veille_passages" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."veille_propositions" as permissive for all to authenticated using (true) with check (true);
create policy "crm_authentifie" on public."visites" as permissive for all to authenticated using (true) with check (true);
create policy "site_depose" on public."contact_submissions" as permissive for insert to anon with check (((form_type = ANY (ARRAY['contact'::text, 'mandat_recherche'::text, 'rappel_bien'::text, 'estimation'::text])) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)) AND (char_length(email) <= 320) AND (COALESCE(char_length(phone), 0) <= 50) AND (COALESCE(char_length(message), 0) <= 5000) AND (COALESCE(char_length(budget), 0) <= 200) AND (COALESCE(char_length(property_type), 0) <= 200) AND (COALESCE(char_length(desired_location), 0) <= 500) AND (COALESCE(char_length(desired_surface), 0) <= 200) AND (COALESCE(char_length(timeline), 0) <= 200) AND (COALESCE(char_length(property_ref), 0) <= 200) AND (COALESCE(char_length(property_title), 0) <= 500)));

-- Espaces de stockage
insert into storage.buckets (id, name, public) values ('photos-biens', 'photos-biens', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('photos-vente', 'photos-vente', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('mandats', 'mandats', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('agences-pdf', 'agences-pdf', false, 20971520, array['application/pdf']) on conflict (id) do nothing;
create policy "mandats_agence_depot" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'mandats'::text) AND ((storage.foldername(name))[1] = 'agence'::text)));
create policy "mandats_agence_remplacement" on storage.objects as permissive for update to authenticated using (((bucket_id = 'mandats'::text) AND ((storage.foldername(name))[1] = 'agence'::text))) with check (((bucket_id = 'mandats'::text) AND ((storage.foldername(name))[1] = 'agence'::text)));
create policy "mandats_crm_lecture" on storage.objects as permissive for select to authenticated using ((bucket_id = 'mandats'::text));
create policy "photos_vente_crm" on storage.objects as permissive for all to authenticated using ((bucket_id = 'photos-vente'::text)) with check ((bucket_id = 'photos-vente'::text));

commit;
