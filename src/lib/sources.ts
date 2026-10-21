/* ═══ D'où vient un contact (V3.23) ════════════════════════════════════════
   À la création d'un contact, et à tout moment depuis sa fiche : comment on
   l'a eu. Facultatif — laissé vide, il reste vide.

   Deux colonnes sur `clients` (outils/sql/source-contact.sql) :
     · `source`        la clé ci-dessous (« recommandation », « zecible »…) ;
     · `source_detail` la précision, s'il y en a une : qui l'a recommandé,
                       quelle plateforme, ou le texte de « Autre ».
   Avant le SQL, les colonnes n'existent pas : on n'écrit la source que si
   elle a été choisie, et on le dit (colonneSourceAbsente). Isomorphe. */

/* 22 octobre 2026 : sans « Fichiers achetés » (ZeCible, Maline : des fichiers
   de particuliers, ceux d'Emilio Immobilier) ; les portails sont ceux de
   l'immobilier d'entreprise. Aucun contact n'avait ces sources. */
export type SourceContact =
  | 'recommandation' | 'relationnel' | 'ancien_client'
  | 'pige' | 'boitage' | 'panneau'
  | 'site' | 'plateforme' | 'reseaux' | 'appel_entrant'
  | 'autre';

export const FAMILLES_SOURCE: { k: string; lib: string }[] = [
  { k: 'bouche', lib: 'Bouche-à-oreille' },
  { k: 'prospection', lib: 'Prospection' },
  { k: 'internet', lib: 'Il nous a trouvés' },
  { k: 'autre', lib: 'Autre' },
];

/* `detail` : ce que la source demande en plus, et la question posée. */
export const SOURCES: { k: SourceContact; lib: string; ic: string; famille: string; detail?: 'contact' | 'plateforme' | 'texte'; question?: string }[] = [
  { k: 'recommandation', lib: 'Recommandation', ic: 'accord', famille: 'bouche', detail: 'contact', question: 'Qui vous l’a recommandé ?' },
  { k: 'relationnel', lib: 'Relationnel', ic: 'groupe', famille: 'bouche' },
  { k: 'ancien_client', lib: 'Ancien client', ic: 'etoile', famille: 'bouche' },
  { k: 'pige', lib: 'Pige', ic: 'loupe', famille: 'prospection' },
  { k: 'boitage', lib: 'Boîtage, flyers', ic: 'mail', famille: 'prospection' },
  { k: 'panneau', lib: 'Panneau, vitrine', ic: 'panneau', famille: 'prospection' },
  { k: 'site', lib: 'Site internet', ic: 'globe', famille: 'internet' },
  { k: 'plateforme', lib: 'Portail d’annonces', ic: 'ecran', famille: 'internet', detail: 'plateforme', question: 'Lequel ?' },
  { k: 'reseaux', lib: 'Réseaux sociaux', ic: 'partage', famille: 'internet' },
  { k: 'appel_entrant', lib: 'Appel entrant', ic: 'telephone', famille: 'internet' },
  { k: 'autre', lib: 'Autre source', ic: 'points', famille: 'autre', detail: 'texte', question: 'Laquelle ?' },
];

export const PLATEFORMES = ['SeLoger', 'Geolocaux', 'BureauxLocaux', 'Leboncoin', 'CessionPME'];

export const sourceDe = (k?: string | null) => SOURCES.find(s => s.k === k) || null;

/* « Recommandation · Hortense Marhic », « Pige », « Portail d’annonces · SeLoger ». */
export function libelleSource(k?: string | null, detail?: string | null): string {
  const s = sourceDe(k);
  if (!s) return '';
  const d = (detail || '').trim();
  return d ? `${s.lib} · ${d}` : s.lib;
}

/* L'erreur d'une base où outils/sql/source-contact.sql n'est pas encore passé. */
export const colonneSourceAbsente = (m: string) =>
  /source/i.test(m) && /(column|schema cache|could not find)/i.test(m);
export const MESSAGE_SQL_SOURCE = 'La source n’a pas été enregistrée : lancez d’abord outils/sql/source-contact.sql dans Supabase.';
