/* ═══ Les biens (à vendre) ═══════════════════════════════════════════════════
   Les biens qu'Alexandre vend ou pourrait vendre pour un propriétaire : un
   projet à suivre, une estimation, un mandat, jusqu'à la vente. La rubrique
   « Biens » du CRM.

   Une ligne de `biens_vente` par bien. Les colonnes servent à la liste ;
   tout le reste vit dans `donnees` (les réponses du formulaire, comme les
   documents juridiques) : les pièces une à une (`detailPieces` ; `pieces`
   est leur nombre), l'intérieur, l'extérieur,
   l'énergie, la copropriété, les charges, le prix, la visite, l'annonce, les
   photos et les pièces du dossier. Le suivi (visites hors CRM, offres,
   étapes, notes) est dans `biens_vente_suivi`. Voir outils/sql/biens-vente.sql.

   Ce fichier est isomorphe : le CRM (navigateur) et les bancs d'essai le lisent. */

import { euros } from '@/lib/mandat';
import {
  PERSONNE_VIDE, lirePersonnes, nomComplet, nomsCourts, txt, num, liste, jourLong,
  type Champ, type Donnees, type Personne, type Option,
} from '@/lib/actes';
import type { BienCorr } from '@/lib/correspondance';
import {
  DESTINATIONS, EMPLACEMENTS, EQUIPEMENTS, INDICES, NATURES, TYPES_BAIL, TYPES_LOCAL,
  auPoste, avecLoyer, bailEnCours, estActivite, estBureaux, estCessionBail, estCommerce, estFonds, estLocal, estLocation, estMurs, estMursOccupes,
  loyerM2, montantAffaire, natureDe, nbPostesDe, proDuBien, rentabilite, typePourRecherche,
} from '@/lib/affaires';

export type { Donnees };

/* ── Les étapes de la vente ─────────────────────────────────────────────── */
/* `a_suivre` : un propriétaire qui pense vendre, pas encore estimé. La
   colonne `etape` est un texte libre (pas de contrainte en base). */
export type EtapeVente = 'a_suivre' | 'estimation' | 'mandat' | 'suspendu' | 'offre' | 'compromis' | 'vendu' | 'retire' | 'annonce_type';
export const ETAPES_VENTE: { k: EtapeVente; lib: string; court: string; pluriel: string; c: string }[] = [
  /* Werner : les clés restent (la base et ses déclencheurs les lisent), les
     mots sont ceux d'une affaire : un local à louer, un droit au bail, un
     fonds ou des murs à céder. « compromis » couvre la signature du bail,
     de la promesse ou de l'acte de cession ; « vendu », l'affaire conclue. */
  { k: 'a_suivre', lib: 'À suivre', court: 'À suivre', pluriel: 'À suivre', c: '#0ea5a4' },
  { k: 'estimation', lib: 'Estimation', court: 'Estimation', pluriel: 'Estimations', c: '#8b5cf6' },
  { k: 'mandat', lib: 'Mandat en cours', court: 'Disponible', pluriel: 'Affaires en cours', c: '#10b981' },
  { k: 'suspendu', lib: 'En pause', court: 'En pause', pluriel: 'En pause', c: '#94a3b8' },
  { k: 'offre', lib: 'Sous offre', court: 'Sous offre', pluriel: 'Sous offre', c: '#f59e0b' },
  { k: 'compromis', lib: 'En signature', court: 'En signature', pluriel: 'En signature', c: '#3b82f6' },
  { k: 'vendu', lib: 'Affaire conclue', court: 'Conclue', pluriel: 'Conclues', c: '#2e3034' },
  { k: 'retire', lib: 'Retirée du marché', court: 'Retirée', pluriel: 'Retirées', c: '#b4532a' },
  /* Une annonce pour faire venir des demandeurs, sans vraie affaire derrière
     (un local proche d'un autre qu'on ne peut pas diffuser) : hors du
     parcours, sans propriétaire, sans visite ni offre. */
  { k: 'annonce_type', lib: 'Annonce type', court: 'Annonce type', pluriel: 'Annonces type', c: '#c026d3' },
];
/* « Paris 16e » plutôt que « Paris » (V3.80, Alexandre : « pour Paris, on
   n'a pas le détail de l'arrondissement ») : depuis le code postal (75016,
   75116 pour le 16e nord), de même pour Lyon (69001…) et Marseille (13001…).
   Une ville qui porte déjà son arrondissement, ou un code postal qui n'en
   dit rien, reste telle quelle. */
export function villeAffichee(ville: string | null | undefined, cp: string | null | undefined): string {
  const v = (ville || '').trim();
  const c = (cp || '').replace(/\s/g, '');
  const sans = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const arr = (nom: string, n: number) => `${nom} ${n}${n === 1 ? 'er' : 'e'}`;
  if (/^75\d{3}$/.test(c) && (!v || sans === 'paris')) {
    const n = c === '75116' ? 16 : Number(c.slice(3));
    if (n >= 1 && n <= 20) return arr('Paris', n);
  }
  if (/^6900[1-9]$/.test(c) && (!v || sans === 'lyon')) return arr('Lyon', Number(c.slice(3)));
  if (/^130(0[1-9]|1[0-6])$/.test(c) && (!v || sans === 'marseille')) return arr('Marseille', Number(c.slice(3)));
  return v;
}

/* Le fil du bandeau de la fiche : le chemin normal d'une vente. */
export const PARCOURS: EtapeVente[] = ['a_suivre', 'estimation', 'mandat', 'offre', 'compromis', 'vendu'];
/* Avant le mandat : pas de mandat, pas d'annonce, pas de visite. */
export const AVANT_MANDAT: EtapeVente[] = ['a_suivre', 'estimation'];
export const avantMandat = (e: string | null | undefined) => AVANT_MANDAT.includes(e as EtapeVente);
export const etapeDe = (k: string | null | undefined) => ETAPES_VENTE.find(e => e.k === k) || ETAPES_VENTE[0];
/* « En cours » : ce qui se travaille (le compteur du menu). */
export const EN_COURS: EtapeVente[] = ['mandat', 'offre', 'compromis'];

/* ══ Ce qu'on peut faire d'un bien, selon son étape (V3.48) ══════════════
   Alexandre : « est-ce qu'on peut faire des visites quand le bien est
   vendu ? ». Avant, tout était possible à toute étape : une offre notée sur
   un bien vendu le repassait « Sous offre », une visite se calait sur un
   bien retiré. Un seul endroit décide, pour la fiche, ses fenêtres, l'onglet
   Acheteurs et les cartes d'offre :
     · avant le mandat : ni visite, ni offre, ni prix (c'est l'estimation) ;
     · en vente, sous offre : tout ;
     · sous compromis, en pause : on peut encore, mais on le confirme ;
     · vendu, retiré, archivé : plus de visite, d'offre, de prix ni de
       réponse aux offres — on archive, on remet en vente, on revend. */
export type PermisBien = {
  visite: boolean; offre: boolean; prix: boolean; repondreOffre: boolean; presenter: boolean;
  /* Sous compromis, en pause : la phrase de la confirmation avant une visite,
     une offre ou un envoi à un acheteur. */
  attention: string | null;
  /* « Une offre est arrivée » peut faire passer le bien « Sous offre ». */
  passerSousOffre: boolean;
  archiver: boolean;
  /* Le prix et les honoraires ne se changent plus dans l'éditeur (FenPrix). */
  prixFige: boolean;
};
export function permisBien(b: { etape: EtapeVente; archive?: boolean | null }): PermisBien {
  const e = b.etape;
  const ferme = e === 'vendu' || e === 'retire' || !!b.archive;
  /* V3.79 : une annonce type n'a ni visite ni offre (l'acheteur intéressé
     se suit sur le vrai bien) ; son prix, lui, se change. */
  const annonceType = e === 'annonce_type';
  const ouvert = !ferme && !avantMandat(e) && !annonceType;
  return {
    visite: ouvert, offre: ouvert, prix: ouvert || (annonceType && !ferme), repondreOffre: !ferme && !annonceType, presenter: ouvert,
    attention: e === 'compromis' ? 'Le bien est en signature. Continuer quand même ?'
      : e === 'suspendu' ? 'La vente est en pause. Continuer quand même ?' : null,
    passerSousOffre: e === 'mandat' || e === 'suspendu',
    archiver: e === 'vendu' || e === 'retire' || annonceType || !!b.archive,
    prixFige: e === 'offre' || e === 'compromis' || e === 'vendu',
  };
}

/* ── Les lignes de la base ─────────────────────────────────────────────── */
export type BienVente = {
  id: string; reference: string | null; etape: EtapeVente; archive: boolean;
  client_id: string | null; document_id: string | null;
  titre: string | null; type_bien: string | null; adresse: string | null; code_postal: string | null; ville: string | null; quartier: string | null;
  prix: number | null; surface: number | null; nb_pieces: number | null; nb_chambres: number | null; etage: number | null;
  mandat_type: string | null; mandat_numero: string | null; mandat_fin: string | null; photo: string | null;
  donnees: Donnees; etape_le: string | null; en_vente_le: string | null; vendu_le: string | null;
  created_at: string; updated_at: string;
};
export type SuiviVente = {
  id: string; bien_id: string; type: 'visite' | 'offre' | 'etape' | 'note' | 'prix' | 'envoi'; le: string; qui: string | null;
  client_id: string | null; recherche_id: string | null; montant: number | null; statut: string | null;
  avis: string | null; commentaire: string | null; donnees: Record<string, unknown>; created_at: string;
};
export const tableAbsente = (m: string) => /biens_vente|relation .* does not exist|schema cache/i.test(m);

/* ── La négociation d'une offre (V3.45) ───────────────────────────────────
   Alexandre : « s'il y a quatre contre-offres sur la même offre, ça fait
   quatre blocs ? ». Non : une offre = un acquéreur = un bloc, et ses
   allers-retours vivent dans `donnees.echanges`, dans l'ordre. Le statut
   dit qui doit répondre : 'en_attente' (le vendeur), 'contre' (l'acquéreur).
   Les offres d'avant n'ont pas la liste : elle se déduit du montant et de
   la dernière contre-offre (`donnees.contre`). */
export type Echange = { le: string; par: 'acquereur' | 'vendeur'; montant: number };
export function echangesDe(o: SuiviVente): Echange[] {
  const d = (o.donnees || {}) as Record<string, unknown>;
  const l = Array.isArray(d.echanges)
    ? (d.echanges as unknown[]).filter((x): x is Echange => !!x && typeof x === 'object' && typeof (x as Echange).montant === 'number' && ((x as Echange).par === 'acquereur' || (x as Echange).par === 'vendeur'))
    : [];
  if (l.length) return l;
  /* Avant la V3.45, `contre` restait posé après « Remettre en attente » ou
     « Acceptée » : il ne compte que tant que l'offre attend l'acquéreur. */
  const out: Echange[] = [{ le: (o.le || '').slice(0, 10), par: 'acquereur', montant: o.montant || 0 }];
  if (o.statut === 'contre' && typeof d.contre === 'number' && d.contre > 0) out.push({ le: typeof d.reponse_le === 'string' ? d.reponse_le : (o.le || '').slice(0, 10), par: 'vendeur', montant: d.contre });
  return out;
}
/* Le montant sur la table : celui convenu, sinon la dernière proposition. */
export function montantActuel(o: SuiviVente): number {
  const d = (o.donnees || {}) as Record<string, unknown>;
  if (o.statut === 'acceptee' && typeof d.accepte_a === 'number' && d.accepte_a > 0) return d.accepte_a;
  const l = echangesDe(o);
  return l[l.length - 1]?.montant || o.montant || 0;
}
export type Reponse =
  | { k: 'accepte' } | { k: 'refuse' } | { k: 'renonce' } | { k: 'retire' } | { k: 'rouvrir' }
  | { k: 'contre'; montant: number } | { k: 'propose'; montant: number };
/* Ce que devient l'offre après une réponse, sans rien écrire : le statut et
   les réponses à poser. `jour` : la date du jour (AAAA-MM-JJ). */
export function apresReponse(o: SuiviVente, r: Reponse, jour: string): { statut: string; donnees: Record<string, unknown> } {
  const avant = { ...((o.donnees || {}) as Record<string, unknown>) };
  delete avant.accepte_a;
  /* `contre` : la contre-offre qui attend l'acquéreur, rien d'autre. */
  delete avant.contre;
  const l = echangesDe(o);
  const dernier = l[l.length - 1];
  const tour = dernier?.par === 'vendeur' ? 'contre' : 'en_attente';
  switch (r.k) {
    case 'contre': {
      const echanges = [...l, { le: jour, par: 'vendeur' as const, montant: r.montant }];
      return { statut: 'contre', donnees: { ...avant, echanges, contre: r.montant, reponse_le: jour } };
    }
    case 'propose': {
      const echanges = [...l, { le: jour, par: 'acquereur' as const, montant: r.montant }];
      return { statut: 'en_attente', donnees: { ...avant, echanges, reponse_le: jour } };
    }
    case 'accepte':
      return { statut: 'acceptee', donnees: { ...avant, echanges: l, reponse_le: jour, ...(dernier && dernier.montant !== o.montant ? { accepte_a: dernier.montant } : {}) } };
    case 'refuse': case 'renonce': case 'retire':
      return { statut: r.k === 'refuse' ? 'refusee' : 'retiree', donnees: { ...avant, echanges: l, reponse_le: jour } };
    case 'rouvrir':
      return { statut: tour, donnees: { ...avant, echanges: l, ...(tour === 'contre' ? { contre: dernier.montant } : {}) } };
  }
}

/* ── Les listes de choix ───────────────────────────────────────────────── */
/* Werner : les types de local (src/lib/affaires.ts). La clé reste dans
   `donnees.typeBien` et la colonne `type_bien`. */
export const TYPES_BIEN: Option[] = TYPES_LOCAL.map(({ v, l, ic }) => ({ v, l, ic }));
export const nomType = (v: unknown) => TYPES_BIEN.find(t => t.v === v)?.l || 'Local';
const estTerrain = (d: Donnees) => d.typeBien === 'terrain';
/* Un local qui se décrit en espaces, en aménagement (pas un terrain, pas un parking). */
const aDesPieces = (d: Donnees) => estLocal(d);
/* Un local dans un immeuble : un étage, des parties communes. Un immeuble
   entier, un terrain, un entrepôt de plain-pied n'en ont pas. */
const enImmeuble = (d: Donnees) => !['terrain', 'immeuble', 'entrepot'].includes(String(d.typeBien || ''));
const estRestaurant = (d: Donnees) => d.typeBien === 'restaurant';

export const EXPOSITIONS: Option[] = [
  { v: 'N', l: 'Nord' }, { v: 'NE', l: 'Nord-Est' }, { v: 'E', l: 'Est' }, { v: 'SE', l: 'Sud-Est' },
  { v: 'S', l: 'Sud' }, { v: 'SO', l: 'Sud-Ouest' }, { v: 'O', l: 'Ouest' }, { v: 'NO', l: 'Nord-Ouest' },
];
export const nomExpo = (v: unknown) => EXPOSITIONS.find(e => e.v === v)?.l || (typeof v === 'string' ? v : '');

/* Les niveaux d'un espace : une boutique a son rez-de-chaussée, son
   sous-sol, parfois une mezzanine ; un plateau de bureaux, son étage. */
export const NIVEAUX: string[] = [
  'Niveau principal', 'Rez-de-chaussée', 'Sous-sol', 'Mezzanine', 'Entresol',
  '1er étage', '2e étage', '3e étage', '4e étage', '5e étage', '6e étage et plus', 'Extérieur',
];
/* Les espaces qu'on voit le plus : on clique, puis on ajuste. « Autre » laisse
   écrire son propre nom. */
export const PIECES_GROUPES: { g: string; l: string[] }[] = [
  { g: 'Bureaux', l: ['Accueil', 'Open space', 'Bureau', 'Bureau de direction', 'Salle de réunion', 'Espace de travail', 'Salle de formation'] },
  { g: 'Vente et salle', l: ['Surface de vente', 'Salle de restaurant', 'Bar', 'Cabine d’essayage', 'Show-room', 'Salle d’attente'] },
  { g: 'Cuisine et repas', l: ['Cuisine professionnelle', 'Office', 'Kitchenette', 'Espace détente'] },
  { g: 'Sanitaires', l: ['Sanitaires', 'WC', 'Douche', 'Vestiaire'] },
  { g: 'Stockage et technique', l: ['Réserve', 'Stockage', 'Archives', 'Local technique', 'Salle serveur', 'Chambre froide', 'Local poubelles'] },
  { g: 'Activité', l: ['Atelier', 'Laboratoire', 'Zone de production', 'Quai de chargement'] },
  { g: 'Niveaux et annexes', l: ['Mezzanine', 'Sous-sol', 'Cave', 'Parking', 'Terrasse', 'Cour'] },
];
export const PIECES_RAPIDES = ['Accueil', 'Open space', 'Bureau', 'Salle de réunion', 'Surface de vente', 'Réserve', 'Sanitaires', 'Kitchenette', 'Sous-sol'];
/* Les tuiles « Ajouter un espace » de l'éditeur, dans l'ordre d'une visite. */
export const PIECES_TUILES = ['Accueil', 'Open space', 'Bureau', 'Salle de réunion', 'Surface de vente', 'Salle de restaurant', 'Cuisine professionnelle', 'Office', 'Kitchenette', 'Sanitaires', 'Vestiaire', 'Réserve', 'Archives', 'Local technique', 'Atelier', 'Mezzanine', 'Sous-sol', 'Terrasse'];
/* L'icône d'un espace, d'après son nom (« Bureau 2 » → le bureau). */
const PICTO_PIECE: [RegExp, string][] = [
  [/^accueil|^salle d.attente/, 'porte'], [/^open space|^espace de travail|^salle de formation/, 'groupe'], [/^bureau/, 'bureau'],
  [/^salle de reunion/, 'table'], [/^(surface de vente|show-room|vitrine)/, 'vitrine'], [/^(salle de restaurant|bar)/, 'table'],
  [/^(cuisine|office|kitchenette)/, 'cuisine'], [/^espace detente/, 'canape'], [/^(sanitaires|wc|toilettes)/, 'wc'], [/^douche/, 'douche'],
  [/^(vestiaire|cabine)/, 'cintre'], [/^(reserve|stockage)/, 'cube'], [/^archives/, 'dossier'], [/^(local technique|salle serveur)/, 'eclair'],
  [/^chambre froide/, 'flocon'], [/^local poubelles/, 'corbeille'], [/^(atelier|laboratoire|zone de production)/, 'outil'], [/^quai/, 'voiture'],
  [/^(mezzanine|sous-sol|entresol)/, 'escalier'], [/^cave/, 'cave'], [/^parking/, 'voiture'], [/^terrasse/, 'parasol'], [/^cour/, 'terrain'],
];
export function pictoPiece(nom: string): string {
  const n = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").toLowerCase().trim();
  return PICTO_PIECE.find(([r]) => r.test(n))?.[1] || 'plan';
}
/* `etat`, `sol`, `atouts` : notés pendant la visite sur place (V3.16). */
export type Piece = { id: string; niveau: string; nom: string; surface: number | null; expo: string; note: string; etat?: string; sol?: string; atouts?: string[] };
export const lirePieces = (x: unknown): Piece[] => (Array.isArray(x) ? x : []).map((p, i) => {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const s = typeof o.surface === 'number' ? o.surface : typeof o.surface === 'string' ? parseFloat(String(o.surface).replace(',', '.')) : NaN;
  return {
    id: typeof o.id === 'string' && o.id ? o.id : `p${i}`, niveau: typeof o.niveau === 'string' ? o.niveau : '',
    nom: typeof o.nom === 'string' ? o.nom : '', surface: Number.isFinite(s) ? s : null,
    expo: typeof o.expo === 'string' ? o.expo : '', note: typeof o.note === 'string' ? o.note : '',
    ...(typeof o.etat === 'string' && o.etat ? { etat: o.etat } : {}),
    ...(typeof o.sol === 'string' && o.sol ? { sol: o.sol } : {}),
    ...(Array.isArray(o.atouts) && o.atouts.length ? { atouts: o.atouts.filter((a): a is string => typeof a === 'string') } : {}),
  };
});

/* ── La visite sur place (V3.16) : ce qu'on note d'un espace, d'un coup
   d'œil, et ce qu'on retient du local. ── */
export const ETATS_PIECE: { v: string; l: string; c: string }[] = [
  { v: 'a_renover', l: 'À rénover', c: '#dc2626' }, { v: 'rafraichir', l: 'À rafraîchir', c: '#f59e0b' },
  { v: 'bon', l: 'Bon état', c: '#10b981' }, { v: 'neuf', l: 'Refait à neuf', c: '#0ea5a4' },
];
export const SOLS = ['Moquette', 'Carrelage', 'Parquet', 'Béton', 'Béton ciré', 'Résine', 'Vinyle', 'Plancher technique'];
export const ATOUTS_PIECE = ['Lumineux', 'Calme', 'Sur rue', 'Sur cour', 'Climatisé', 'Faux plafond', 'Câblé', 'Belle hauteur', 'Vitré', 'Cloisonnable'];
export const ATOUTS_BIEN = ['Emplacement n° 1', 'Fort passage', 'Belle vitrine', 'Angle de rue', 'Lumineux', 'Belle hauteur sous plafond', 'Climatisé', 'Câblé, fibre', 'Divisible', 'Accès PMR', 'Parking', 'Proche transports', 'Immeuble de standing', 'Rénové récemment', 'Extraction', 'Terrasse', 'Livraison facile'];
export const DEFAUTS_BIEN = ['Travaux à prévoir', 'Emplacement secondaire', 'Peu de vitrine', 'Pas d’extraction', 'Sans ascenseur', 'Pas accessible PMR', 'Hauteur sous plafond faible', 'Sombre', 'Pas de parking', 'Charges élevées', 'Mise aux normes à prévoir', 'DPE F ou G'];

export type Photo = { url: string; chemin: string; legende: string };
export const lirePhotos = (x: unknown): Photo[] => (Array.isArray(x) ? x : [])
  .map(p => (p && typeof p === 'object' ? p : {}) as Record<string, unknown>)
  .filter(o => typeof o.url === 'string' && o.url)
  .map(o => ({ url: String(o.url), chemin: typeof o.chemin === 'string' ? o.chemin : '', legende: typeof o.legende === 'string' ? o.legende : '' }));

/* ── Le dossier : diagnostics et pièces à réunir ──
   `etat` : recu · demande · nc (non concerné). Un fichier déposé va dans le
   bucket privé « mandats », sous biens-vente/<id>/ (voir /api/biens-vente).
   Werner : les pièces d'une location, d'une cession de bail ou de fonds,
   d'une vente de murs. `groupe` : 'diag' (diagnostics), 'copro'
   (copropriété), 'vendeur' (ce que le mandant fournit : bail, fonds,
   propriété). */
export type EtatPiece = 'recu' | 'demande' | 'nc' | '';
/* `taille` (V3.30) : en octets, notée au dépôt — l'envoi par mail dit à
   l'avance si les fichiers partiront en pièces jointes ou en liens. */
/* `dans` (V3.31) : l'id d'un fichier de `donnees.fichiers` qui contient
   cette pièce — un dossier de diagnostic technique (DDT) d'un seul PDF couvre
   le DPE, l'amiante… Le fichier n'est stocké qu'une fois. */
/* V3.90 : `demandeLe` (AAAA-MM-JJ) et `demandeA` (le nom de qui l'on a
   sollicité) quand la pièce est demandée ; `relanceLe` à chaque relance. */
export type PieceDossier = { etat: EtatPiece; date: string; chemin: string; nom: string; taille?: number; dans?: string; demandeLe?: string; demandeA?: string; relanceLe?: string };
export type LigneDossier = { k: string; l: string; aide?: string; si?: (d: Donnees) => boolean; groupe: 'diag' | 'copro' | 'vendeur' };
export const DOSSIER: LigneDossier[] = [
  { k: 'dpe', l: 'DPE', aide: 'Pour louer ou vendre, valable 10 ans', groupe: 'diag' },
  { k: 'amiante', l: 'Dossier technique amiante (DTA)', aide: 'Permis de construire avant juillet 1997', groupe: 'diag' },
  { k: 'erp', l: 'État des risques (ERP)', aide: 'Valable 6 mois', groupe: 'diag' },
  { k: 'termites', l: 'Termites', aide: 'Zone fixée par arrêté, valable 6 mois', groupe: 'diag' },
  { k: 'carrez', l: 'Mesurage loi Carrez', aide: 'La vente d’un lot de copropriété', si: d => d.copro === 'oui' && estMurs(d), groupe: 'diag' },
  { k: 'annexeEnv', l: 'Annexe environnementale', aide: 'Bail de bureaux ou de commerce de plus de 2 000 m²', si: d => avecLoyer(d) && (num(d, 'surface') || 0) > 2000, groupe: 'diag' },
  { k: 'securite', l: 'Avis de la commission de sécurité', aide: 'Un établissement recevant du public', si: d => estCommerce(d) || d.erp === 'oui', groupe: 'diag' },
  { k: 'reglement', l: 'Règlement de copropriété et état descriptif', aide: 'Ce qu’il permet comme activité', si: d => d.copro === 'oui', groupe: 'copro' },
  { k: 'pvag', l: 'PV d’assemblée générale (3 dernières années)', si: d => d.copro === 'oui', groupe: 'copro' },
  { k: 'fiche', l: 'Fiche synthétique de la copropriété', si: d => d.copro === 'oui' && estMurs(d), groupe: 'copro' },
  { k: 'preetat', l: 'Pré-état daté', si: d => d.copro === 'oui' && estMurs(d), groupe: 'copro' },
  { k: 'titre', l: 'Titre de propriété', si: d => estMurs(d) || estLocation(d), groupe: 'vendeur' },
  { k: 'taxe', l: 'Dernier avis de taxe foncière', groupe: 'vendeur' },
  { k: 'bail', l: 'Bail en cours et ses avenants', si: bailEnCours, groupe: 'vendeur' },
  { k: 'quittance', l: 'Dernier avis d’échéance du loyer', si: bailEnCours, groupe: 'vendeur' },
  { k: 'inventaire', l: 'Inventaire des charges, impôts et taxes', aide: 'Annexé au bail (loi Pinel)', si: avecLoyer, groupe: 'vendeur' },
  { k: 'travauxPinel', l: 'État des travaux passés et prévus', aide: 'Les trois dernières années et les trois à venir (loi Pinel)', si: avecLoyer, groupe: 'vendeur' },
  { k: 'edl', l: 'État des lieux d’entrée', si: bailEnCours, groupe: 'vendeur' },
  { k: 'kbis', l: 'Extrait Kbis du cédant', si: d => estCessionBail(d) || estFonds(d), groupe: 'vendeur' },
  { k: 'bilans', l: 'Bilans des trois derniers exercices', si: estFonds, groupe: 'vendeur' },
  { k: 'chiffres', l: 'Chiffre d’affaires mois par mois', aide: 'Attesté par l’expert-comptable', si: estFonds, groupe: 'vendeur' },
  { k: 'materiel', l: 'Liste du matériel cédé', si: estFonds, groupe: 'vendeur' },
  { k: 'personnel', l: 'Registre du personnel et contrats de travail', si: estFonds, groupe: 'vendeur' },
  { k: 'licence', l: 'Licence (IV, restaurant)', si: estRestaurant, groupe: 'vendeur' },
  { k: 'factures', l: 'Factures des travaux récents', groupe: 'vendeur' },
  { k: 'urbanisme', l: 'Autorisations d’urbanisme', aide: 'Changement de destination, enseigne, terrasse', groupe: 'vendeur' },
];
export const lireDossier = (x: unknown): Record<string, PieceDossier> => {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const out: Record<string, PieceDossier> = {};
  for (const [k, v] of Object.entries(o)) {
    const p = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    const e = p.etat === 'recu' || p.etat === 'demande' || p.etat === 'nc' ? p.etat : '';
    out[k] = {
      etat: e, date: typeof p.date === 'string' ? p.date : '', chemin: typeof p.chemin === 'string' ? p.chemin : '', nom: typeof p.nom === 'string' ? p.nom : '',
      ...(typeof p.taille === 'number' && p.taille > 0 ? { taille: p.taille } : {}),
      ...(typeof p.dans === 'string' && p.dans ? { dans: p.dans } : {}),
      ...(typeof p.demandeLe === 'string' && p.demandeLe ? { demandeLe: p.demandeLe } : {}),
      ...(typeof p.demandeA === 'string' && p.demandeA ? { demandeA: p.demandeA } : {}),
      ...(typeof p.relanceLe === 'string' && p.relanceLe ? { relanceLe: p.relanceLe } : {}),
    };
  }
  return out;
};
/* Les autres documents du local (V3.30) : ceux qui ne sont pas une ligne du
   dossier — un DDT complet, un plan, un courrier du syndic. Même
   stockage privé, rangés dans `donnees.fichiers`. */
/* `sorte` (V3.31) : 'ddt' pour un dossier de diagnostics en un seul fichier ;
   les lignes qu'il couvre portent son id dans `dans`. */
export type FichierBien = { id: string; titre: string; chemin: string; nom: string; taille?: number; le: string; sorte?: 'ddt' };
export const lireFichiers = (x: unknown): FichierBien[] => (Array.isArray(x) ? x : [])
  .map(f => (f && typeof f === 'object' ? f : {}) as Record<string, unknown>)
  .filter(o => typeof o.chemin === 'string' && o.chemin)
  .map((o, i) => ({
    id: typeof o.id === 'string' && o.id ? o.id : `f${i}`, titre: typeof o.titre === 'string' ? o.titre : '',
    chemin: String(o.chemin), nom: typeof o.nom === 'string' ? o.nom : '', le: typeof o.le === 'string' ? o.le : '',
    ...(typeof o.taille === 'number' && o.taille > 0 ? { taille: o.taille } : {}),
    ...(o.sorte === 'ddt' ? { sorte: 'ddt' as const } : {}),
  }));
/* Les pièces ajoutées à la main (V3.31) : les statuts d'une société, un
   avenant… avec leur nom et leur groupe. Rangées dans `donnees.piecesPerso`,
   elles se comportent comme les autres : reçu, demandé, non concerné, un
   fichier. */
export type LignePerso = { k: string; l: string; groupe: LigneDossier['groupe'] };
export const lirePiecesPerso = (x: unknown): LignePerso[] => (Array.isArray(x) ? x : [])
  .map(o => (o && typeof o === 'object' ? o : {}) as Record<string, unknown>)
  .filter(o => typeof o.k === 'string' && o.k && typeof o.l === 'string' && o.l.trim())
  .map(o => ({ k: String(o.k), l: String(o.l).trim(), groupe: o.groupe === 'copro' || o.groupe === 'vendeur' ? o.groupe : 'diag' as LigneDossier['groupe'] }));
export const estPerso = (k: string) => k.startsWith('perso');
export const lignesDossier = (d: Donnees): LigneDossier[] => [
  ...DOSSIER.filter(l => !l.si || l.si(d)),
  ...lirePiecesPerso(d.piecesPerso).map(p => ({ k: p.k, l: p.l, groupe: p.groupe })),
];

/* ── Les champs propres à cette rubrique (en plus de ceux des documents) ── */
type BaseB = { cle: string; lib: string; aide?: string; si?: (d: Donnees) => boolean; ic?: string };
export type ChampBien = Champ
  | (BaseB & { t: 'lettres'; genre: 'dpe' | 'ges' })
  | (BaseB & { t: 'pieces' })
  | (BaseB & { t: 'photos' })
  | (BaseB & { t: 'dossier' })
  | (BaseB & { t: 'proprio' })
  | (BaseB & { t: 'annonce' })
  | (BaseB & { t: 'eurosAn' })
  /* Un nombre entier au – / + (bureaux, sanitaires, étage…) ; `mots` : ce
     qu'on écrit à côté (0 → « RDC »). */
  | (BaseB & { t: 'compteur'; min?: number; max?: number; mots?: (n: number) => string })
  /* L'adresse, proposée pendant la frappe (base adresse nationale) : un
     choix remplit aussi le code postal et la ville. */
  | (BaseB & { t: 'adresse' })
  /* Une liste d'observations (V3.16) : des travaux, un sinistre, ce que dit
     un PV d'AG. Chaque ligne : sa nature, sa date, un commentaire ; `idees` :
     les natures proposées d'un clic ; `enCours` : « réglé » ou « en cours ». */
  | (BaseB & { t: 'journal'; un: string; idees: string[]; enCours?: boolean });
export type Observation = { id: string; nature: string; quand: string; note: string; enCours?: boolean };
export const lireObservations = (x: unknown): Observation[] => (Array.isArray(x) ? x : [])
  .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
  .map((o, i) => ({
    id: typeof o.id === 'string' && o.id ? o.id : `o${i}`, nature: typeof o.nature === 'string' ? o.nature : '',
    quand: typeof o.quand === 'string' ? o.quand : '', note: typeof o.note === 'string' ? o.note : '',
    ...(typeof o.enCours === 'boolean' ? { enCours: o.enCours } : {}),
  }));
/* Une étape du formulaire. `pour` : les étapes de l'affaire où elle se
   montre. Tout ce qui décrit le local se remplit dès « à suivre » (V3.15),
   et les indications de visite (clés, codes) aussi depuis la V3.16 : seule
   l'estimation (fourchette, montant) attend l'étape « estimation ».
   `avant` : son titre tant que le mandat n'est pas signé. */
export type EtapeBien = {
  id: string; titre: string; court: string; sous: string; ic: string; champs: ChampBien[];
  pour?: (e: EtapeVente) => boolean;
  /* Werner : une partie qui ne vaut que pour certaines affaires (« Le fonds
     de commerce » pour une cession de fonds). Sans les données (la fiche,
     l'annonce), elle se montre. */
  si?: (d: Donnees) => boolean;
  avant?: { titre: string; court: string; sous: string };
};
export const estChampActe = (c: ChampBien): c is Champ => !['lettres', 'pieces', 'photos', 'dossier', 'proprio', 'annonce', 'eurosAn', 'compteur', 'adresse', 'journal'].includes(c.t);
/* Dans l'éditeur, les données portent l'étape sous `_stade` (jamais
   enregistrée) : un champ réservé au mandat s'efface avant. Sans `_stade`
   (la fiche, l'annonce), tout se montre. */
const sousMandat = (d: Donnees) => !avantMandat(String(d._stade || '')) && d._stade !== 'annonce_type';
const pasASuivre = (e: EtapeVente) => e !== 'a_suivre';
/* Des réponses qui reviennent : chacune avec son dessin (V3.16). */
const OUI_NON: Option[] = [{ v: 'oui', l: 'Oui', ic: 'check' }, { v: 'non', l: 'Non', ic: 'croix' }];
export const DELAIS: Option[] = [
  { v: 'vite', l: 'Dès que possible', ic: 'eclair' }, { v: '3mois', l: 'Sous 3 mois', ic: 'chrono' },
  { v: '6mois', l: 'Sous 6 mois', ic: 'calendrier' }, { v: 'libre', l: 'Il n’est pas pressé', ic: 'horloge' },
];
const ETATS_GENERAUX: Option[] = [
  { v: 'tres_bon', l: 'Très bon état', ic: 'etincelle' }, { v: 'bon', l: 'Bon état', ic: 'check' }, { v: 'moyen', l: 'Moyen', ic: 'lignes' }, { v: 'a_refaire', l: 'À rafraîchir', ic: 'pinceau' },
];
/* Les équipements d'un local : les mêmes clés que les critères d'un
   demandeur (src/lib/affaires.ts, EQUIPEMENTS), pour que le rapprochement
   compare ce qui se compare. */
const OPT_EQUIPEMENTS: Option[] = EQUIPEMENTS.map(({ v, l, ic }) => ({ v, l, ic }));

/* ══ Le formulaire : étape par étape, ou tout sur une page ═══════════════ */
export const ETAPES_BIEN: EtapeBien[] = [
  {
    id: 'proprio', titre: 'Le mandant', court: 'Mandant', sous: 'Qui confie l’affaire, et pourquoi.', ic: 'personne',
    pour: e => e !== 'annonce_type',
    champs: [
      { t: 'proprio', cle: 'clientId', lib: 'Sa fiche contact' },
      { t: 'choix', cle: 'qui', lib: 'Qui confie l’affaire ?', tuiles: true, options: [
        { v: 'sci', l: 'Une société', aide: 'SCI, SAS, SARL, foncière…', ic: 'immeuble' },
        { v: 'personne', l: 'Une personne', aide: 'En son nom propre', ic: 'personne' },
        { v: 'indivision', l: 'Plusieurs propriétaires', aide: 'Indivision, succession', ic: 'groupe' },
      ] },
      { t: 'texte', cle: 'sciNom', lib: 'Nom de la société', ic: 'immeuble', si: d => d.qui === 'sci' },
      { t: 'personnes', cle: 'proprietaires', lib: 'Les personnes', un: 'Personne', min: 1, max: 5,
        bornes: d => (d.qui === 'indivision' ? { min: 2, max: 6 } : { min: 1, max: 1 }),
        nomCarte: (d, i) => (d.qui === 'sci' ? 'Son représentant' : d.qui === 'indivision' ? `Propriétaire ${i + 1}` : 'Le propriétaire'),
        ajouter: () => 'Ajouter une personne' },
      { t: 'titre', cle: 't-projet', lib: 'Son projet', ic: 'drapeau' },
      { t: 'choix', cle: 'motif', lib: 'Pourquoi il confie l’affaire', ic: 'drapeau', tuiles: true, options: [
        { v: 'vacant', l: 'Local vacant', aide: 'Le locataire est parti', ic: 'porte' },
        { v: 'demenagement', l: 'Il déménage', aide: 'Plus grand, ailleurs, regroupement', ic: 'valise' },
        { v: 'retraite', l: 'Départ à la retraite', aide: 'Il cède son affaire', ic: 'horloge' },
        { v: 'arbitrage', l: 'Arbitrage', aide: 'Il vend un actif, réinvestit ailleurs', ic: 'courbe' },
        { v: 'succession', l: 'Succession', ic: 'bail' },
        { v: 'difficultes', l: 'Changement d’activité', aide: 'Il arrête, se reconvertit', ic: 'separation' },
        { v: 'autre', l: 'Autre', ic: 'points' },
      ] },
      { t: 'choix', cle: 'delai', lib: 'Son délai', ic: 'chrono', options: DELAIS },
      { t: 'choix', cle: 'origine', lib: 'Comment il est venu', ic: 'boussole', options: [
        { v: 'recommandation', l: 'Recommandation', ic: 'bulle' }, { v: 'client', l: 'Ancien client', ic: 'etoile' }, { v: 'prospection', l: 'Prospection, pige', ic: 'loupe' },
        { v: 'boitage', l: 'Panneau, courrier', ic: 'mail' }, { v: 'portail', l: 'Portail, réseaux', ic: 'globe' }, { v: 'autre', l: 'Autre', ic: 'points' },
      ] },
      { t: 'texte', cle: 'notaire', lib: 'Son notaire ou son avocat', ic: 'balance', exemple: 'Maître Durand, Paris 8e' },
    ],
  },
  {
    id: 'bien', titre: 'L’affaire et le local', court: 'Le local', sous: 'Ce qui est proposé, où, et ses surfaces.', ic: 'agence',
    champs: [
      { t: 'choix', cle: 'nature', lib: 'Ce qui est proposé', tuiles: true, requis: true, options: NATURES.map(({ v, l, aide, ic }) => ({ v, l, aide, ic })) },
      { t: 'choix', cle: 'typeBien', lib: 'Type de local', tuiles: true, requis: true, options: TYPES_BIEN },
      { t: 'titre', cle: 't-adresse', lib: 'Adresse', ic: 'lieu' },
      { t: 'adresse', cle: 'adresse', lib: 'Adresse', ic: 'lieu' },
      { t: 'texte', cle: 'cp', lib: 'Code postal', ic: 'drapeau', exemple: '75008' },
      { t: 'texte', cle: 'ville', lib: 'Ville', ic: 'immeuble', requis: true, exemple: 'Paris' },
      { t: 'texte', cle: 'quartier', lib: 'Quartier', ic: 'boussole', exemple: 'Triangle d’or, Sentier, Haut Marais…' },
      { t: 'texte', cle: 'lot', lib: 'N° de lot', ic: 'lots', si: d => d.copro === 'oui', exemple: '12' },
      { t: 'texte', cle: 'cadastre', lib: 'Cadastre', ic: 'plan', si: d => estMurs(d) || estTerrain(d) || d.typeBien === 'immeuble', exemple: 'Section AB, parcelle 123' },
      { t: 'titre', cle: 't-surf', lib: 'Les surfaces', ic: 'regle' },
      { t: 'nombre', cle: 'surface', lib: 'Surface totale', ic: 'regle', unite: 'm²', si: d => !estTerrain(d), aide: 'Toute la surface du local, niveaux compris' },
      { t: 'nombre', cle: 'surfRdc', lib: 'Dont rez-de-chaussée', ic: 'vitrine', unite: 'm²', si: d => estLocal(d) && d.typeBien !== 'bureaux' },
      { t: 'nombre', cle: 'surfEtage', lib: 'Dont étage', ic: 'escalier', unite: 'm²', si: estLocal },
      { t: 'nombre', cle: 'surfSousSol', lib: 'Dont sous-sol', ic: 'cave', unite: 'm²', si: estLocal },
      { t: 'nombre', cle: 'surfMezzanine', lib: 'Dont mezzanine', ic: 'escalier', unite: 'm²', si: estLocal },
      { t: 'nombre', cle: 'surfReserve', lib: 'Dont réserve, stockage', ic: 'cube', unite: 'm²', si: d => estCommerce(d) || estActivite(d) },
      { t: 'nombre', cle: 'surfBureaux', lib: 'Dont bureaux', ic: 'bureau', unite: 'm²', si: estActivite },
      { t: 'nombre', cle: 'surfPonderee', lib: 'Surface pondérée', ic: 'regle', unite: 'm²', si: estCommerce, aide: 'La surface utile d’une boutique, celle qui sert à juger le loyer' },
      { t: 'nombre', cle: 'carrez', lib: 'Surface loi Carrez', ic: 'regle', unite: 'm²', si: d => estMurs(d) && d.copro === 'oui' },
      { t: 'nombre', cle: 'terrain', lib: 'Terrain', ic: 'terrain', unite: 'm²', si: d => estTerrain(d) || estActivite(d) || d.typeBien === 'immeuble' },
      { t: 'choix', cle: 'divisible', lib: 'Divisible', ic: 'lots', si: estLocal, options: OUI_NON },
      { t: 'nombre', cle: 'surfDivMin', lib: 'À partir de', ic: 'regle', unite: 'm²', si: d => d.divisible === 'oui' },
      { t: 'nombre', cle: 'postes', lib: 'Postes de travail', ic: 'bureau', si: d => estBureaux(d), aide: 'À peu près un poste pour 10 à 12 m²' },
      { t: 'nombre', cle: 'hsp', lib: 'Hauteur sous plafond', ic: 'regle', unite: 'm', si: estLocal },
      { t: 'titre', cle: 't-commerce', lib: 'L’emplacement commercial', ic: 'vitrine', si: estCommerce },
      { t: 'choix', cle: 'emplacement', lib: 'Emplacement', ic: 'cible', si: estCommerce, options: EMPLACEMENTS },
      { t: 'nombre', cle: 'vitrine', lib: 'Linéaire de vitrine', ic: 'vitrine', unite: 'm', si: estCommerce },
      { t: 'choix', cle: 'angle', lib: 'En angle de rue', ic: 'droite', si: estCommerce, options: OUI_NON },
      { t: 'choix', cle: 'flux', lib: 'Passage devant le local', ic: 'groupe', si: estCommerce, options: [
        { v: 'fort', l: 'Fort', ic: 'groupe' }, { v: 'moyen', l: 'Moyen', ic: 'personne' }, { v: 'faible', l: 'Faible', ic: 'lune' },
      ] },
      { t: 'texte', cle: 'voisins', lib: 'Les enseignes voisines', ic: 'sac', si: estCommerce, large: true, exemple: 'Monoprix, Sephora, une boulangerie' },
      { t: 'titre', cle: 't-imm', lib: 'L’immeuble', ic: 'immeuble', si: estLocal },
      { t: 'compteur', cle: 'etage', lib: 'Étage', ic: 'ascenseur', min: 0, si: enImmeuble, mots: n => (n === 0 ? 'RDC' : '') },
      { t: 'compteur', cle: 'etages', lib: 'Étages en tout', ic: 'immeuble', min: 0, si: d => estLocal(d) && d.typeBien !== 'entrepot' },
      { t: 'nombre', cle: 'annee', lib: 'Année de construction', ic: 'calendrier', si: estLocal, exemple: '1968' },
      { t: 'choix', cle: 'standing', lib: 'Standing', ic: 'etoile', si: estLocal, options: [
        { v: 'standard', l: 'Standard', ic: 'immeuble' }, { v: 'bon', l: 'Bon standing', ic: 'etoile' }, { v: 'haut', l: 'Haut de gamme', ic: 'etoilePleine' }, { v: 'prestige', l: 'Prestige', ic: 'colonne' },
      ] },
      { t: 'choix', cle: 'etatCommuns', lib: 'Parties communes', ic: 'escalier', si: enImmeuble, options: ETATS_GENERAUX },
      { t: 'choix', cle: 'etatExterieur', lib: 'Façade', ic: 'immeuble', si: estLocal, options: ETATS_GENERAUX },
      { t: 'cases', cle: 'immeuble', lib: 'Dans l’immeuble', ic: 'immeuble', si: estLocal, options: [
        { v: 'ascenseur', l: 'Ascenseur', ic: 'ascenseur' }, { v: 'monteCharge', l: 'Monte-charge', ic: 'cube' }, { v: 'gardien', l: 'Gardien', ic: 'personne' },
        { v: 'accueil', l: 'Accueil, hôtesse', ic: 'porte' }, { v: 'controle', l: 'Contrôle d’accès', ic: 'cle' }, { v: 'rie', l: 'Restaurant d’entreprise', ic: 'table' },
        { v: 'velos', l: 'Local vélos', ic: 'velo' }, { v: 'fibre', l: 'Fibre', ic: 'wifi' },
      ] },
      { t: 'choix', cle: 'certification', lib: 'Certification', ic: 'etoile', si: estBureaux, options: [
        { v: 'hqe', l: 'HQE', ic: 'etoile' }, { v: 'breeam', l: 'BREEAM', ic: 'etoile' }, { v: 'leed', l: 'LEED', ic: 'etoile' }, { v: 'aucune', l: 'Aucune', ic: 'croix' },
      ] },
      { t: 'titre', cle: 't-prox', lib: 'Accès et transports', ic: 'carte' },
      { t: 'nombre', cle: 'proxMetro', lib: 'Métro', ic: 'metro', unite: 'min' },
      { t: 'nombre', cle: 'proxRer', lib: 'RER, train', ic: 'train', unite: 'min' },
      { t: 'nombre', cle: 'proxBus', lib: 'Bus', ic: 'bus', unite: 'min' },
      { t: 'nombre', cle: 'proxTram', lib: 'Tramway', ic: 'train', unite: 'min' },
      { t: 'texte', cle: 'stations', lib: 'Les stations', ic: 'metro', large: true, exemple: 'Saint-Lazare (lignes 3, 12, 13, 14), RER E Haussmann' },
      { t: 'zone', cle: 'situation', lib: 'La situation', ic: 'lieu', exemple: 'Rue commerçante à fort passage, entre la place et le marché ; accès livraison par la cour' },
    ],
  },
  {
    id: 'interieur', titre: 'L’aménagement', court: 'Aménagement', sous: 'L’état, la configuration, les équipements.', ic: 'bureau',
    si: estLocal,
    champs: [
      { t: 'titre', cle: 't-etat', lib: 'L’état', ic: 'pinceau' },
      { t: 'choix', cle: 'etat', lib: 'Dans quel état ?', ic: 'pinceau', tuiles: true, options: [
        { v: 'brut', l: 'Brut de béton', aide: 'Tout à aménager', ic: 'cube' }, { v: 'a_renover', l: 'À rénover', aide: 'Gros travaux', ic: 'outil' },
        { v: 'travaux_legers', l: 'À rafraîchir', aide: 'Peintures, sols', ic: 'pinceau' }, { v: 'bon_etat', l: 'Bon état', aide: 'Rien d’urgent', ic: 'check' },
        { v: 'refait_neuf', l: 'Refait à neuf', aide: 'Travaux récents', ic: 'etincelle' },
      ] },
      { t: 'titre', cle: 't-config', lib: 'La configuration', ic: 'plan', si: d => estBureaux(d) || estActivite(d) },
      { t: 'choix', cle: 'config', lib: 'Les bureaux sont', ic: 'plan', si: d => estBureaux(d) || estActivite(d), options: [
        { v: 'open', l: 'En open space', ic: 'groupe' }, { v: 'cloisonne', l: 'Cloisonnés', ic: 'porte' }, { v: 'mixte', l: 'Mixtes', ic: 'lots' },
      ] },
      { t: 'compteur', cle: 'nbBureaux', lib: 'Bureaux fermés', ic: 'bureau', si: d => estBureaux(d) || estActivite(d) },
      { t: 'compteur', cle: 'nbReunion', lib: 'Salles de réunion', ic: 'table', si: d => estBureaux(d) || estActivite(d) },
      { t: 'compteur', cle: 'wc', lib: 'Sanitaires', ic: 'wc' },
      { t: 'choix', cle: 'office', lib: 'Coin repas', ic: 'cuisine', si: d => !estRestaurant(d), options: [
        { v: 'office', l: 'Office, cuisine', ic: 'cuisine' }, { v: 'kitchenette', l: 'Kitchenette', ic: 'cuisine' }, { v: 'aucun', l: 'Aucun', ic: 'croix' },
      ] },
      { t: 'titre', cle: 't-activite', lib: 'Pour l’activité', ic: 'sac', si: d => estCommerce(d) || estActivite(d) },
      { t: 'choix', cle: 'extraction', lib: 'Extraction', ic: 'flamme', si: d => estCommerce(d) || estActivite(d), aide: 'Un conduit pour les fumées de cuisson, jusqu’au toit', options: [
        { v: 'oui', l: 'Oui, en place', ic: 'check' }, { v: 'possible', l: 'Possible', ic: 'outil' }, { v: 'non', l: 'Non', ic: 'croix' },
      ] },
      { t: 'choix', cle: 'licence', lib: 'Licence', ic: 'doc', si: estRestaurant, options: [
        { v: 'iv', l: 'Licence IV', ic: 'doc' }, { v: 'restaurant', l: 'Licence restaurant', ic: 'table' }, { v: 'petite', l: 'Petite licence', ic: 'doc' }, { v: 'aucune', l: 'Aucune', ic: 'croix' },
      ] },
      { t: 'compteur', cle: 'couverts', lib: 'Places assises', ic: 'table', si: estRestaurant },
      { t: 'choix', cle: 'erp', lib: 'Établissement recevant du public', ic: 'groupe', si: d => estCommerce(d) || estActivite(d), options: OUI_NON },
      { t: 'texte', cle: 'erpCategorie', lib: 'Catégorie ERP', ic: 'groupe', si: d => d.erp === 'oui', exemple: '5e catégorie, type M' },
      { t: 'titre', cle: 't-chauf', lib: 'Chauffage et climatisation', ic: 'flocon' },
      { t: 'choix', cle: 'clim', lib: 'Climatisation', ic: 'flocon', options: [
        { v: 'reversible', l: 'Réversible', aide: 'Chaud et froid', ic: 'flocon' }, { v: 'froid', l: 'Froid seul', ic: 'flocon' }, { v: 'aucune', l: 'Aucune', ic: 'croix' },
      ] },
      { t: 'choix', cle: 'chauffageMode', lib: 'Chauffage', ic: 'radiateur', options: [{ v: 'individuel', l: 'Individuel', ic: 'personne' }, { v: 'collectif', l: 'Collectif', ic: 'immeuble' }, { v: 'aucun', l: 'Aucun', ic: 'croix' }] },
      { t: 'choix', cle: 'chauffageEnergie', lib: 'Énergie', ic: 'eclair', si: d => d.chauffageMode !== 'aucun', options: [
        { v: 'electrique', l: 'Électrique', ic: 'eclair' }, { v: 'gaz', l: 'Gaz', ic: 'flamme' }, { v: 'pac', l: 'Pompe à chaleur', ic: 'pac' },
        { v: 'urbain', l: 'Réseau urbain', ic: 'usine' }, { v: 'fioul', l: 'Fioul', ic: 'fioul' },
      ] },
      { t: 'titre', cle: 't-equip', lib: 'Ce qu’il a', ic: 'etoile' },
      { t: 'cases', cle: 'equipements', lib: 'Équipements', ic: 'etoile', options: OPT_EQUIPEMENTS },
      { t: 'zone', cle: 'interieurNote', lib: 'Ce qu’il faut savoir de l’aménagement', ic: 'bulle', exemple: 'Plateau lumineux sur rue, 4 bureaux fermés et un open space de 12 postes ; câblage refait en 2023' },
    ],
  },
  {
    id: 'exterieur', titre: 'Annexes et stationnement', court: 'Annexes', sous: 'Terrasse, cour, parkings, quai.', ic: 'parking',
    champs: [
      { t: 'cases', cle: 'annexes', lib: 'Ce qu’il y a', ic: 'parasol', options: [
        { v: 'terrasse', l: 'Terrasse', ic: 'parasol' }, { v: 'cour', l: 'Cour', ic: 'cour' }, { v: 'parking', l: 'Parking', ic: 'parking' }, { v: 'box', l: 'Box', ic: 'box' },
        { v: 'cave', l: 'Cave', ic: 'cave' }, { v: 'quai', l: 'Quai de chargement', ic: 'voiture' }, { v: 'jardin', l: 'Espace vert', ic: 'terrain' },
      ] },
      { t: 'nombre', cle: 'surfTerrasse', lib: 'Terrasse', ic: 'parasol', unite: 'm²', si: d => liste(d, 'annexes').includes('terrasse') },
      { t: 'choix', cle: 'terrasseRue', lib: 'Terrasse sur le trottoir', ic: 'parasol', si: estRestaurant, aide: 'Une autorisation de la mairie, renouvelée chaque année', options: [
        { v: 'oui', l: 'Oui, autorisée', ic: 'check' }, { v: 'possible', l: 'À demander', ic: 'horloge' }, { v: 'non', l: 'Non', ic: 'croix' },
      ] },
      { t: 'nombre', cle: 'surfCour', lib: 'Cour', ic: 'cour', unite: 'm²', si: d => liste(d, 'annexes').includes('cour') },
      { t: 'nombre', cle: 'surfCave', lib: 'Cave', ic: 'cave', unite: 'm²', si: d => liste(d, 'annexes').includes('cave') },
      { t: 'compteur', cle: 'nbParking', lib: 'Places de parking', ic: 'parking', si: d => liste(d, 'annexes').some(x => ['parking', 'box'].includes(x)) },
      { t: 'choix', cle: 'stationnement', lib: 'Stationnement', ic: 'parking', si: d => liste(d, 'annexes').some(x => ['parking', 'box'].includes(x)), options: [
        { v: 'sousSol', l: 'En sous-sol', ic: 'escalier' }, { v: 'exterieur', l: 'En extérieur', ic: 'soleil' }, { v: 'couvert', l: 'Couvert', ic: 'toit' }, { v: 'ferme', l: 'Box fermé', ic: 'cadenas' },
      ] },
      { t: 'euros', cle: 'loyerParking', lib: 'Loyer d’une place', ic: 'euro', unite: '€ HT / an', si: d => estLocation(d) && liste(d, 'annexes').some(x => ['parking', 'box'].includes(x)), aide: 'Quand les places se louent en plus du local' },
      { t: 'zone', cle: 'exterieurNote', lib: 'Ce qu’il faut savoir', ic: 'bulle', exemple: 'Deux places en sous-sol en plus ; cour de livraison commune, accès poids lourds' },
    ],
  },
  {
    id: 'pieces', titre: 'Les espaces', court: 'Espaces', sous: 'Un par un, dans l’ordre de la visite : l’espace, sa surface, son niveau.', ic: 'plan',
    si: estLocal,
    champs: [{ t: 'pieces', cle: 'detailPieces', lib: 'Les espaces' }],
  },
  {
    id: 'energie', titre: 'L’énergie', court: 'Énergie', sous: 'Le DPE, ses valeurs, les dépenses estimées.', ic: 'eclair',
    si: d => d.typeBien !== 'parking',
    champs: [
      { t: 'choix', cle: 'dpeStatut', lib: 'Le DPE', ic: 'doc', options: [
        { v: 'fait', l: 'Réalisé', ic: 'check' }, { v: 'encours', l: 'Commandé', ic: 'horloge' }, { v: 'vierge', l: 'Vierge', ic: 'fiscal' }, { v: 'non', l: 'Non soumis', ic: 'croix' },
      ] },
      { t: 'lettres', cle: 'dpe', lib: 'Classe énergie (DPE)', ic: 'eclair', genre: 'dpe', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' },
      { t: 'nombre', cle: 'dpeValeur', lib: 'Consommation', ic: 'eclair', unite: 'kWh/m²/an', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' },
      { t: 'lettres', cle: 'ges', lib: 'Classe climat (GES)', ic: 'nuage', genre: 'ges', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' },
      { t: 'nombre', cle: 'gesValeur', lib: 'Émissions', ic: 'nuage', unite: 'kg CO₂/m²/an', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' },
      { t: 'date', cle: 'dpeDate', lib: 'Date du DPE', ic: 'calendrier', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' },
      { t: 'texte', cle: 'dpeNumero', lib: 'N° ADEME du DPE', ic: 'doc', exemple: '2392E0123456K', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' },
      { t: 'titre', cle: 't-cout', lib: 'Les dépenses d’énergie écrites sur le DPE', ic: 'euro', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non',
        aide: 'Ce ne sont pas les charges : c’est l’estimation du DPE pour chauffer, refroidir et éclairer le local.' },
      { t: 'euros', cle: 'coutMin', lib: 'Montant bas', ic: 'bas', unite: '€/an', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' },
      { t: 'euros', cle: 'coutMax', lib: 'Montant haut', ic: 'haut', unite: '€/an', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' },
      { t: 'nombre', cle: 'coutAnnee', lib: 'Prix de l’énergie de l’année', ic: 'calendrier', exemple: '2024', si: d => d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non', aide: 'Écrite sur le DPE, à côté des montants' },
    ],
  },
  {
    id: 'copro', titre: 'Charges, taxes et copropriété', court: 'Charges et taxes', sous: 'Ce que le local coûte chaque année, puis la copropriété.', ic: 'lots',
    champs: [
      { t: 'titre', cle: 't-fin', lib: 'Charges et taxes', ic: 'euro' },
      { t: 'eurosAn', cle: 'chargesAn', lib: 'Charges', ic: 'lots', aide: 'Le montant annuel, hors taxes. Tape l’un ou l’autre : le second se calcule.' },
      { t: 'choix', cle: 'chargesMode', lib: 'Elles se règlent', ic: 'calendrier', si: avecLoyer, options: [
        { v: 'provision', l: 'Par provision', aide: 'Régularisée chaque année', ic: 'calendrier' }, { v: 'forfait', l: 'Au forfait', ic: 'euro' },
      ] },
      { t: 'cases', cle: 'chargesInclus', lib: 'Elles comprennent', ic: 'liste', options: [
        { v: 'chauffage', l: 'Chauffage', ic: 'radiateur' }, { v: 'clim', l: 'Climatisation', ic: 'flocon' }, { v: 'eau', l: 'Eau', ic: 'eau' },
        { v: 'gardien', l: 'Gardien', ic: 'personne' }, { v: 'ascenseur', l: 'Ascenseur', ic: 'ascenseur' }, { v: 'menage', l: 'Ménage des parties communes', ic: 'pinceau' },
      ] },
      { t: 'euros', cle: 'taxeFonciere', lib: 'Taxe foncière', ic: 'fiscal', unite: '€/an' },
      { t: 'choix', cle: 'tfRefacturee', lib: 'Remboursée par le locataire', ic: 'fiscal', si: avecLoyer, options: OUI_NON },
      { t: 'euros', cle: 'taxeBureaux', lib: 'Taxe sur les bureaux (Île-de-France)', ic: 'fiscal', unite: '€/an', si: d => estBureaux(d) || estActivite(d) },
      { t: 'titre', cle: 't-copro', lib: 'La copropriété', ic: 'lots' },
      { t: 'choix', cle: 'copro', lib: 'En copropriété ?', ic: 'lots', options: OUI_NON },
      { t: 'nombre', cle: 'lots', lib: 'Nombre de lots', ic: 'lots', si: d => d.copro === 'oui' },
      { t: 'choix', cle: 'procedure', lib: 'Procédure en cours contre le syndicat ?', ic: 'balance', si: d => d.copro === 'oui', options: [{ v: 'non', l: 'Non', ic: 'croix' }, { v: 'oui', l: 'Oui', ic: 'check' }] },
      { t: 'texte', cle: 'procedureNature', lib: 'Laquelle', ic: 'balance', large: true, si: d => d.copro === 'oui' && d.procedure === 'oui' },
      { t: 'texte', cle: 'syndic', lib: 'Syndic', ic: 'agence', si: d => d.copro === 'oui', exemple: 'Foncia Paris 8' },
      { t: 'euros', cle: 'fondsTravaux', lib: 'Fonds de travaux du lot', ic: 'banque', si: d => d.copro === 'oui' && estMurs(d) },
    ],
  },
  {
    /* Werner : le bail proposé (une location) ou celui que l'affaire
       transmet (un droit au bail, un fonds, des murs loués). */
    id: 'bail', titre: 'Le bail', court: 'Bail', sous: 'Le bail, le loyer, ce que le preneur peut y faire.', ic: 'bail',
    si: d => avecLoyer(d),
    champs: [
      { t: 'titre', cle: 't-bail', lib: 'Le bail proposé', ic: 'bail', si: estLocation },
      { t: 'titre', cle: 't-bail-cours', lib: 'Le bail en cours', ic: 'bail', si: bailEnCours },
      { t: 'choix', cle: 'bailType', lib: 'Type de bail', ic: 'bail', options: TYPES_BAIL },
      { t: 'nombre', cle: 'bailDuree', lib: 'Durée', ic: 'chrono', unite: 'ans', rapides: [3, 6, 9, 12] },
      { t: 'date', cle: 'bailDebut', lib: 'Il a commencé le', ic: 'calendrier', si: bailEnCours },
      { t: 'date', cle: 'bailEcheance', lib: 'Prochaine échéance triennale', ic: 'calendrier', si: bailEnCours },
      { t: 'date', cle: 'bailFin', lib: 'Il finit le', ic: 'calendrier', si: bailEnCours },
      { t: 'euros', cle: 'loyerAn', lib: 'Loyer annuel HT HC', ic: 'euro', unite: '€/an', si: bailEnCours, aide: 'Le loyer du bail en cours, hors taxes et hors charges' },
      { t: 'choix', cle: 'tvaLoyer', lib: 'Loyer soumis à la TVA', ic: 'fiscal', options: OUI_NON },
      { t: 'choix', cle: 'loyerPaiement', lib: 'Payable', ic: 'calendrier', options: [
        { v: 'mensuel', l: 'Par mois', ic: 'calendrier' }, { v: 'trimestriel', l: 'Par trimestre', ic: 'calendrier' },
      ] },
      { t: 'choix', cle: 'indexation', lib: 'Indexation', ic: 'courbe', options: INDICES },
      { t: 'nombre', cle: 'depotMois', lib: 'Dépôt de garantie', ic: 'banque', unite: 'mois de loyer', rapides: [3, 6] },
      { t: 'nombre', cle: 'franchise', lib: 'Franchise de loyer', ic: 'chrono', unite: 'mois', si: estLocation, aide: 'Les premiers mois sans loyer, souvent contre des travaux' },
      { t: 'titre', cle: 't-destination', lib: 'Ce que le preneur peut y faire', ic: 'sac' },
      { t: 'choix', cle: 'destinationType', lib: 'Activités permises', ic: 'sac', tuiles: true, options: DESTINATIONS },
      { t: 'zone', cle: 'destination', lib: 'La destination du bail', ic: 'sac', si: d => !!d.destinationType && d.destinationType !== 'tous', exemple: 'Prêt-à-porter, accessoires de mode, à l’exclusion de toute restauration' },
      { t: 'choix', cle: 'cessionBail', lib: 'Cession du bail', ic: 'accord', si: bailEnCours, options: [
        { v: 'libre', l: 'Libre', ic: 'ouvert' }, { v: 'agrement', l: 'Avec l’accord du bailleur', ic: 'accord' }, { v: 'fonds', l: 'Seulement avec le fonds', ic: 'sac' },
      ] },
      { t: 'choix', cle: 'sousLocation', lib: 'Sous-location', ic: 'groupe', options: [{ v: 'oui', l: 'Autorisée', ic: 'check' }, { v: 'non', l: 'Interdite', ic: 'croix' }] },
      { t: 'zone', cle: 'bailNote', lib: 'Ce qu’il faut savoir du bail', ic: 'bulle', exemple: 'Renouvelé en 2022 ; déspécialisation partielle obtenue ; gros travaux (article 606) à la charge du bailleur' },
    ],
  },
  {
    id: 'fonds', titre: 'Le fonds de commerce', court: 'Fonds', sous: 'L’activité, ses chiffres, ce qui est cédé avec.', ic: 'sac',
    si: estFonds,
    champs: [
      { t: 'texte', cle: 'activite', lib: 'Activité exercée', ic: 'sac', requis: true, exemple: 'Boulangerie-pâtisserie' },
      { t: 'texte', cle: 'enseigne', lib: 'Enseigne', ic: 'vitrine', exemple: 'Au Pain Doré' },
      { t: 'nombre', cle: 'creeEn', lib: 'Créé en', ic: 'calendrier', exemple: '2009' },
      { t: 'titre', cle: 't-chiffres', lib: 'Les chiffres', ic: 'courbe', aide: 'Ceux du dernier exercice clos. Jamais dans une annonce sans l’accord du cédant.' },
      { t: 'euros', cle: 'caHt', lib: 'Chiffre d’affaires HT', ic: 'courbe', unite: '€/an' },
      { t: 'euros', cle: 'ebe', lib: 'Excédent brut d’exploitation', ic: 'euro', unite: '€/an' },
      { t: 'euros', cle: 'resultat', lib: 'Résultat net', ic: 'euro', unite: '€/an' },
      { t: 'compteur', cle: 'salaries', lib: 'Salariés', ic: 'groupe', min: 0 },
      { t: 'titre', cle: 't-cede', lib: 'Ce qui est cédé', ic: 'cube' },
      { t: 'euros', cle: 'stock', lib: 'Stock', ic: 'cube', aide: 'En plus du prix, à sa valeur au jour de la cession' },
      { t: 'zone', cle: 'materiel', lib: 'Matériel et agencements', ic: 'outil', exemple: 'Four à sole, deux vitrines réfrigérées, laboratoire équipé' },
      { t: 'nombre', cle: 'accompagnement', lib: 'Accompagnement du cédant', ic: 'personne', unite: 'semaines' },
      { t: 'zone', cle: 'fondsNote', lib: 'Ce qu’il faut savoir du fonds', ic: 'bulle', exemple: 'Clientèle de quartier fidèle ; ouvert six jours sur sept ; potentiel en livraison' },
    ],
  },
  {
    /* V3.16 : ce qu'on garde pour soi, dès l'ajout de l'affaire. Les travaux
       et les sinistres du local, ce que disent les PV d'AG, les notes.
       Jamais dans une annonce ni dans un espace client. */
    id: 'observations', titre: 'Les observations', court: 'Observations', sous: 'Pour toi seul : les travaux, les sinistres, ce que disent les PV d’AG, tes notes.', ic: 'loupe',
    champs: [
      { t: 'titre', cle: 't-obs-log', lib: 'Le local : travaux et sinistres', ic: 'outil', aide: 'Jamais dans l’annonce ni dans un espace client.' },
      { t: 'journal', cle: 'travauxFaits', lib: 'Travaux réalisés', ic: 'outil', un: 'des travaux',
        idees: ['Électricité', 'Climatisation', 'Plomberie', 'Façade, vitrine', 'Sols', 'Faux plafond', 'Extraction', 'Mise aux normes', 'Toiture', 'Peintures'] },
      { t: 'choix', cle: 'sinistre', lib: 'Un sinistre, un dégât des eaux ?', ic: 'eau', options: [
        { v: 'non', l: 'Aucun, à sa connaissance', ic: 'check' }, { v: 'oui', l: 'Oui', ic: 'eau' },
      ] },
      { t: 'journal', cle: 'sinistres', lib: 'Les sinistres', ic: 'eau', un: 'un sinistre', enCours: true, si: d => d.sinistre === 'oui',
        idees: ['Dégât des eaux', 'Infiltration', 'Humidité', 'Fissures', 'Incendie', 'Canalisation'] },
      { t: 'zone', cle: 'travaux', lib: 'Autres remarques sur les travaux', ic: 'crayon', exemple: 'Mise aux normes PMR à prévoir ; devis de 12 000 € HT pour la climatisation' },
      { t: 'titre', cle: 't-obs-copro', lib: 'La copropriété : ce que disent les PV d’AG', ic: 'lots', si: d => d.copro === 'oui' },
      { t: 'journal', cle: 'coproVotes', lib: 'Gros travaux votés', ic: 'accord', un: 'des travaux votés', si: d => d.copro === 'oui',
        idees: ['Ravalement', 'Toiture', 'Ascenseur', 'Chaufferie', 'Colonnes d’eau', 'Canalisations', 'Cage d’escalier', 'Mise aux normes'] },
      { t: 'journal', cle: 'coproFaits', lib: 'Gros travaux réalisés', ic: 'check', un: 'des travaux réalisés', si: d => d.copro === 'oui',
        idees: ['Ravalement', 'Toiture', 'Ascenseur', 'Chaufferie', 'Colonnes d’eau', 'Canalisations', 'Cage d’escalier', 'Mise aux normes'] },
      { t: 'journal', cle: 'coproAVenir', lib: 'Gros travaux à venir', ic: 'horloge', un: 'des travaux à venir', si: d => d.copro === 'oui', aide: 'Évoqués dans les derniers PV d’AG, pas encore votés.',
        idees: ['Ravalement', 'Toiture', 'Ascenseur', 'Chaufferie', 'Colonnes d’eau', 'Canalisations', 'Cage d’escalier', 'Mise aux normes'] },
      { t: 'zone', cle: 'travauxVotes', lib: 'Autres remarques sur la copropriété', ic: 'crayon', si: d => d.copro === 'oui', exemple: 'Ravalement voté en AG 2025 : 8 400 € de quote-part, à la charge du bailleur' },
      { t: 'titre', cle: 't-obs-notes', lib: 'Tes notes', ic: 'cadenas' },
      { t: 'zone', cle: 'notes', lib: 'Notes internes', ic: 'cadenas', aide: 'Visibles par toi seul, jamais dans un espace client ni une annonce.', exemple: 'Le bailleur accepte trois mois de franchise, sans le dire dans l’annonce' },
    ],
  },
  {
    id: 'prix', titre: 'Prix et mandat', court: 'Prix et mandat', sous: 'Le montant affiché, les honoraires, le mandat.', ic: 'euro', pour: pasASuivre,
    avant: { titre: 'L’estimation et le prix', court: 'Estimation', sous: 'Le rendez-vous, la fourchette, le montant conseillé et les honoraires.' },
    champs: [
      { t: 'titre', cle: 't-estim', lib: 'L’estimation de l’agence', ic: 'regle' },
      /* V3.50 : l'heure et l'agenda se règlent depuis la fiche (« Définir l'estimation ») ;
         ici, changer la date déplace aussi le rendez-vous de l'agenda, à la même heure. */
      { t: 'date', cle: 'rdvEstimation', lib: 'Rendez-vous d’estimation', ic: 'calendrier', aide: 'L’heure, et le rendez-vous dans ton agenda : depuis la fiche de l’affaire, « Définir l’estimation ».' },
      { t: 'date', cle: 'avisEnvoye', lib: 'Avis de valeur envoyé le', ic: 'envoyer' },
      { t: 'euros', cle: 'estimBasse', lib: 'Fourchette basse', ic: 'bas', aide: 'Un loyer annuel pour une location, un prix pour une cession ou une vente' },
      { t: 'euros', cle: 'estimHaute', lib: 'Fourchette haute', ic: 'haut' },
      { t: 'euros', cle: 'prixSouhaite', lib: 'Montant espéré par le mandant', ic: 'personne', si: d => !sousMandat(d) },
      { t: 'titre', cle: 't-prix', lib: 'Le prix', ic: 'etiquette' },
      /* 21 octobre 2026 : un bureau équipé, un coworking se louent au poste. */
      { t: 'choix', cle: 'parPoste', lib: 'Il se loue', ic: 'cle', si: estLocation, options: [
        { v: 'non', l: 'Le local entier', ic: 'immeuble' }, { v: 'oui', l: 'Au poste de travail', aide: 'Bureau équipé, coworking', ic: 'bureau' },
      ] },
      { t: 'nombre', cle: 'nbPostes', lib: 'Nombre de postes dans le bureau', ic: 'groupe', si: auPoste },
      { t: 'eurosAn', cle: 'prix', lib: 'Prix d’un poste', ic: 'etiquette', si: auPoste, aide: 'Tape le prix d’un poste par mois, hors taxes : l’année se calcule. Ce qui est compris (internet, ménage, salle de réunion) va dans le texte de l’annonce.' },
      { t: 'euros', cle: 'prix', lib: 'Loyer annuel HT HC', ic: 'etiquette', unite: '€/an', si: d => estLocation(d) && !auPoste(d), aide: 'Hors taxes et hors charges. À l’estimation : la valeur locative conseillée.' },
      { t: 'euros', cle: 'prix', lib: 'Prix du droit au bail', ic: 'etiquette', si: estCessionBail, aide: 'Ce que le preneur paie au locataire sortant. Le loyer du bail est dans « Le bail ».' },
      { t: 'euros', cle: 'prix', lib: 'Prix du fonds', ic: 'etiquette', si: estFonds, aide: 'Hors stock. Le loyer du bail est dans « Le bail ».' },
      { t: 'euros', cle: 'prix', lib: 'Prix de vente', ic: 'etiquette', si: d => estMurs(d) || !natureDe(d), aide: 'Honoraires compris quand ils sont à la charge de l’acquéreur.' },
      { t: 'euros', cle: 'droitEntree', lib: 'Droit d’entrée', ic: 'cle', si: estLocation, aide: 'Le pas-de-porte versé au bailleur, en plus du loyer' },
      { t: 'choix', cle: 'charge', lib: 'Honoraires à la charge', ic: 'personne', si: estLocation, options: [{ v: 'acquereur', l: 'Du preneur', ic: 'cle' }, { v: 'vendeur', l: 'Du bailleur', ic: 'immeuble' }] },
      { t: 'choix', cle: 'charge', lib: 'Honoraires à la charge', ic: 'personne', si: d => !estLocation(d), options: [{ v: 'acquereur', l: 'De l’acquéreur', ic: 'cle' }, { v: 'vendeur', l: 'Du cédant ou du vendeur', ic: 'immeuble' }] },
      { t: 'choix', cle: 'honoMode', lib: 'Honoraires', ic: 'euro', options: [{ v: 'taux', l: 'En pourcentage', ic: 'pourcent' }, { v: 'forfait', l: 'Forfait', ic: 'euro' }] },
      { t: 'nombre', cle: 'taux', lib: 'Taux', ic: 'pourcent', unite: '% HT', si: d => d.honoMode !== 'forfait', aide: 'Du loyer annuel HT HC pour une location, du prix pour une cession ou une vente' },
      { t: 'euros', cle: 'forfait', lib: 'Forfait', ic: 'euro', unite: '€ HT', si: d => d.honoMode === 'forfait' },
      { t: 'titre', cle: 't-mandat', lib: 'Le mandat', ic: 'plume', si: sousMandat },
      { t: 'choix', cle: 'mandatType', lib: 'Type de mandat', ic: 'plume', si: sousMandat, options: [{ v: 'simple', l: 'Simple', ic: 'doc' }, { v: 'semi', l: 'Semi-exclusif', ic: 'accord' }, { v: 'exclusif', l: 'Exclusif', ic: 'etoile' }] },
      { t: 'texte', cle: 'mandatNumero', lib: 'N° du registre', ic: 'liste', exemple: '4331', si: sousMandat },
      { t: 'date', cle: 'mandatDate', lib: 'Signé le', ic: 'calendrier', si: sousMandat },
      { t: 'date', cle: 'mandatFin', lib: 'Exclusivité ou mandat jusqu’au', ic: 'calendrier', si: sousMandat },
    ],
  },
  {
    /* V3.16 : ouvert dès l'ajout (occupé ou libre, clés, codes), plus
       seulement au mandat. */
    id: 'pratique', titre: 'Les indications de visite', court: 'Indications', sous: 'Libre ou occupé, les clés, les codes, qui appeler sur place.', ic: 'cle',
    pour: e => e !== 'annonce_type',
    champs: [
      { t: 'titre', cle: 't-occup', lib: 'L’occupation', ic: 'porte' },
      { t: 'choix', cle: 'occupation', lib: 'Le local est', ic: 'porte', options: [
        { v: 'libre', l: 'Libre', ic: 'ouvert' }, { v: 'exploite', l: 'Exploité, ouvert au public', ic: 'vitrine' }, { v: 'occupe', l: 'Occupé par le propriétaire', ic: 'personne' }, { v: 'loue', l: 'Loué', ic: 'bail' },
      ] },
      { t: 'texte', cle: 'disponible', lib: 'Disponible', ic: 'calendrier', exemple: 'immédiatement, ou à partir du 1er mars' },
      { t: 'titre', cle: 't-cles', lib: 'Les clés', ic: 'cle' },
      { t: 'choix', cle: 'cles', lib: 'Où sont-elles ?', ic: 'cle', options: [
        { v: 'agence', l: 'À l’agence', ic: 'agence' }, { v: 'vendeur', l: 'Chez le mandant', ic: 'personne' }, { v: 'gardien', l: 'Chez le gardien', ic: 'immeuble' }, { v: 'autre', l: 'Ailleurs', ic: 'lieu' },
      ] },
      { t: 'texte', cle: 'trousseau', lib: 'Trousseau', ic: 'cle', exemple: 'N° 12', si: d => d.cles === 'agence' },
      { t: 'titre', cle: 't-acces', lib: 'Pour arriver jusqu’au local', ic: 'carte' },
      { t: 'cases', cle: 'accesBas', lib: 'En bas', ic: 'immeuble', options: [
        { v: 'gardien', l: 'Un gardien', ic: 'personne' }, { v: 'vigile', l: 'Un accueil, une sécurité', ic: 'bouclier' }, { v: 'interphone', l: 'Un interphone', ic: 'interphone' },
        { v: 'digicode', l: 'Un digicode', ic: 'clavier' }, { v: 'badge', l: 'Un badge', ic: 'cle' }, { v: 'libre', l: 'Porte ouverte', ic: 'ouvert' },
      ] },
      { t: 'texte', cle: 'interphone', lib: 'Nom sur l’interphone', ic: 'interphone' },
      { t: 'texte', cle: 'digicode', lib: 'Digicode', ic: 'clavier', exemple: '4721B' },
      { t: 'texte', cle: 'porte', lib: 'Bâtiment, étage, porte', ic: 'porte', exemple: 'Bât. B, 3e étage, porte gauche' },
      { t: 'choix', cle: 'accesAscenseur', lib: 'En sortant de l’ascenseur', ic: 'ascenseur', si: d => enImmeuble(d) || !d.typeBien, options: [
        { v: 'gauche', l: 'À gauche', ic: 'gauche' }, { v: 'droite', l: 'À droite', ic: 'droite' }, { v: 'face', l: 'En face', ic: 'haut' }, { v: 'aucun', l: 'Pas d’ascenseur', ic: 'escalier' },
      ] },
      { t: 'zone', cle: 'itineraire', lib: 'Le chemin jusqu’au local', ic: 'carte', exemple: 'Bât. B au fond de la cour, 3e étage : à gauche en sortant de l’ascenseur' },
      { t: 'texte', cle: 'annexesNum', lib: 'Cave, parkings', ic: 'cave', exemple: 'Cave 14 · places 7 et 8' },
      { t: 'titre', cle: 't-contact', lib: 'Sur place', ic: 'telephone' },
      { t: 'texte', cle: 'contactNom', lib: 'Contact sur place', ic: 'personne' },
      { t: 'texte', cle: 'contactTel', lib: 'Son téléphone', ic: 'tel' },
      { t: 'texte', cle: 'creneaux', lib: 'Heures de visite', ic: 'horloge', large: true, exemple: 'en semaine de 9 h à 11 h, avant l’ouverture' },
      { t: 'zone', cle: 'consignes', lib: 'Consignes de visite', ic: 'info', exemple: 'Boutique ouverte : visite discrète, le personnel n’est pas au courant de la cession' },
    ],
  },
  {
    /* V3.81 : l'annonce s'écrit à toutes les étapes. */
    id: 'annonce', titre: 'L’annonce', court: 'Annonce', sous: 'Le texte de l’annonce, prêt à copier.', ic: 'megaphone',
    champs: [
      { t: 'texte', cle: 'annonceTitre', lib: 'Titre de l’annonce', ic: 'megaphone', large: true, exemple: 'Paris 8e, bureaux de 240 m² rénovés, divisibles, proches Saint-Lazare' },
      { t: 'annonce', cle: 'annonceTexte', lib: 'L’annonce' },
    ],
  },
  {
    id: 'photos', titre: 'Photos et dossier', court: 'Photos et dossier', sous: 'Les photos, les diagnostics, les pièces à réunir.', ic: 'photo',
    champs: [
      { t: 'photos', cle: 'photos', lib: 'Les photos' },
      { t: 'dossier', cle: 'dossier', lib: 'Le dossier' },
    ],
  },
];

/* Les étapes du formulaire pour un bien à cette étape de vente, avec le
   titre qui lui va (« L'estimation et le prix » tant que rien n'est signé). */
export function etapesDuBien(e: EtapeVente, d?: Donnees): EtapeBien[] {
  const avant = avantMandat(e);
  return ETAPES_BIEN.filter(x => (!x.pour || x.pour(e)) && (!d || !x.si || x.si(d))).map(x => (avant && x.avant ? { ...x, ...x.avant } : x));
}

/* ══ Les calculs ═══════════════════════════════════════════════════════ */

/* Le prix et les honoraires. `prix` est le prix affiché : honoraires compris
   s'ils sont à la charge de l'acquéreur (le net vendeur s'en déduit), égal au
   net vendeur sinon. */
export function argentBien(d: Donnees) {
  const prix = num(d, 'prix');
  const acq = d.charge !== 'vendeur';
  const forfait = d.honoMode === 'forfait';
  const taux = forfait ? null : num(d, 'taux');
  const f = forfait ? num(d, 'forfait') : null;
  let net: number | null = null, hono: number | null = null;
  /* Werner : une location. Le loyer ne comprend jamais les honoraires : ils
     se calculent sur le loyer annuel HT HC et se paient à part, par le
     preneur ou par le bailleur. */
  if (prix && estLocation(d)) {
    net = prix;
    hono = forfait ? f : taux !== null ? Math.round((prix * taux) / 100) : null;
    return { prix, net, hono, acq, taux: hono !== null ? (hono / prix) * 100 : taux };
  }
  if (prix) {
    if (acq) {
      if (forfait && f !== null) { hono = f; net = prix - f; }
      else if (taux !== null) { net = Math.round(prix / (1 + taux / 100)); hono = prix - net; }
    } else {
      net = prix;
      hono = forfait ? f : taux !== null ? Math.round((prix * taux) / 100) : null;
      if (hono !== null) net = prix - hono;
    }
  }
  /* Le pourcentage affiché : sur le prix hors honoraires quand l'acquéreur
     paie (la mention légale de l'annonce), sur le prix quand c'est le cédant
     (V3.43 : un mandat à 5 % vendeur s'affichait « 5,26 % »). */
  const tauxNet = hono !== null && prix && !acq ? (hono / prix) * 100 : hono !== null && net ? (hono / net) * 100 : taux;
  return { prix, net, hono, acq, taux: tauxNet };
}
/* Les honoraires pour un autre prix (une offre, un compromis) : le forfait
   du mandat, ou son taux appliqué à ce prix. */
export function honorairesPour(d: Donnees, prix: number | null): number | null {
  if (!prix) return null;
  if (d.honoMode === 'forfait') return num(d, 'forfait');
  const t = num(d, 'taux');
  if (t === null) return null;
  /* Une location : le taux s'applique au loyer annuel, sans rien en retirer. */
  if (estLocation(d)) return Math.round((prix * t) / 100);
  return d.charge !== 'vendeur' ? Math.round(prix - prix / (1 + t / 100)) : Math.round((prix * t) / 100);
}
export const pourcent = (x: number) => `${(Math.round(x * 100) / 100).toString().replace('.', ',')} %`;
export const m2 = (x: number) => `${String(Math.round(x * 100) / 100).replace('.', ',')} m²`;

const nb = (d: Donnees, k: string) => num(d, k);
/* « Appartement 4 pièces · 92 m² » */
export function titreBien(d: Donnees): string {
  /* « Bureaux · 240 m² », « Local commercial · 85 m² » : le type de local, puis la surface. */
  const s = nb(d, 'surface') ?? nb(d, 'terrain');
  const t = d.typeBien ? (d.typeBien === 'local' ? 'Local commercial' : nomType(d.typeBien)) : 'Nouvelle affaire';
  return [t, s ? m2(s) : ''].filter(Boolean).join(' · ');
}
export const etageTexte = (e: number | null, total?: number | null) =>
  e === null ? '' : e === 0 ? 'Rez-de-chaussée' : `${e}${e === 1 ? 'er' : 'e'} étage${total ? ` sur ${total}` : ''}`;
/* « 4 pièces · 92 m² · 3e étage » : la ligne des cartes. */
export function specsBien(d: Donnees): string {
  /* « À louer · 240 m² · divisible · 3e étage » : la ligne des cartes. */
  const s = nb(d, 'surface') ?? nb(d, 'terrain');
  const e = nb(d, 'etage');
  const nat = natureDe(d);
  return [
    nat ? (NATURES.find(n => n.v === nat)?.court || '') : '',
    s ? m2(s) : '',
    d.divisible === 'oui' ? (nb(d, 'surfDivMin') ? `divisible dès ${m2(nb(d, 'surfDivMin') as number)}` : 'divisible') : '',
    estCommerce(d) && nb(d, 'vitrine') ? `vitrine ${String(nb(d, 'vitrine')).replace('.', ',')} m` : '',
    enImmeuble(d) && e !== null ? etageTexte(e).replace('Rez-de-chaussée', 'RDC') : '',
  ].filter(Boolean).join(' · ');
}
export const proprietairesDe = (d: Donnees): Personne[] => {
  const l = lirePersonnes(d.proprietaires).filter(p => p.nom || p.prenom);
  return l;
};
/* « Claire Dumas », « Paul et Claire Martin », « Paul Martin et Claire Durand » :
   le nom qu'on lit sur une carte. Les documents gardent leur forme
   (« M. et Mme Martin », nomsCourts). */
const etListe = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : l[0] || '');
export const nomProprio = (d: Donnees): string => {
  if (d.qui === 'sci' && txt(d, 'sciNom')) return txt(d, 'sciNom');
  const l = proprietairesDe(d).map(p => ({ p: p.prenom.trim(), n: p.nom.trim() }));
  if (!l.length) return '';
  if (l.length > 1 && l.every(x => x.n && x.p && x.n.toLowerCase() === l[0].n.toLowerCase())) return `${etListe(l.map(x => x.p))} ${l[0].n}`;
  return etListe(l.map(x => `${x.p} ${x.n}`.trim()));
};
export const nomProprioActe = (d: Donnees): string =>
  d.qui === 'sci' && txt(d, 'sciNom') ? txt(d, 'sciNom') : proprietairesDe(d).length ? nomsCourts(proprietairesDe(d)) : '';

/* Les colonnes de la liste, recalculées à chaque enregistrement. */
export function colonnesBien(d: Donnees) {
  const a = argentBien(d);
  const photos = lirePhotos(d.photos);
  return {
    titre: titreBien(d), type_bien: typeof d.typeBien === 'string' ? d.typeBien : null,
    client_id: typeof d.clientId === 'string' && d.clientId ? d.clientId : null,
    adresse: txt(d, 'adresse') || null, code_postal: txt(d, 'cp') || null, ville: txt(d, 'ville') || null, quartier: txt(d, 'quartier') || null,
    prix: a.prix, surface: nb(d, 'surface') ?? nb(d, 'terrain'), nb_pieces: nb(d, 'pieces'), nb_chambres: nb(d, 'chambres'), etage: nb(d, 'etage'),
    mandat_type: typeof d.mandatType === 'string' && d.mandatType ? d.mandatType : null,
    mandat_numero: txt(d, 'mandatNumero') || null, mandat_fin: txt(d, 'mandatFin') || null,
    photo: photos[0]?.url || null,
  };
}

/* La référence du bien : EMI-V-<année>-<numéro>, à la suite des précédentes. */
export function referenceSuivante(dernieres: (string | null)[]): string {
  const an = new Date().getFullYear();
  const n = dernieres.map(r => (r && r.startsWith(`WER-A-${an}-`) ? parseInt(r.split('-')[3], 10) : 0)).filter(Number.isFinite);
  return `WER-A-${an}-${String(Math.max(0, ...n) + 1).padStart(3, '0')}`;
}

export const joursDepuis = (iso: string | null | undefined) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86_400_000)) : null;
};
export const joursAvant = (ymd: string | null | undefined) => {
  if (!ymd) return null;
  const t = Date.parse(`${ymd}T12:00:00`);
  return Number.isFinite(t) ? Math.ceil((t - Date.now()) / 86_400_000) : null;
};
/* V3.45 : avec l'année (« 12 février 2026 ») — Alexandre : « il n'y a pas
   l'année, il faut la mettre ». Les fiches reprises d'Immofacile ont des
   dates d'autres années. */
export const dateCourte = (ymd: string | null | undefined) => {
  if (!ymd) return '';
  const x = new Date(ymd.length <= 10 ? `${ymd}T12:00:00` : ymd);
  return isNaN(x.getTime()) ? '' : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1 /, '1er ');
};
export const dateLongue = (ymd: string | null | undefined) => (ymd ? jourLong(ymd.slice(0, 10)) : '');

/* Où en est le mandat de vente du bien dans Documents (V3.42) : le plus
   avancé de ceux qui ne sont pas annulés. Lu avec la liste des biens. */
export type EtatMandatDoc = { id: string; statut: 'brouillon' | 'pret' | 'signe'; enSignature: boolean; numero: string | null };
/* Le même, en deux mots (une puce de la liste, le bandeau de la fiche). */
export function motMandat(m: EtatMandatDoc): string {
  return m.statut === 'brouillon' ? 'Mandat en préparation' : m.statut === 'signe' ? 'Mandat signé' : m.enSignature ? 'Mandat en signature' : 'Mandat prêt à signer';
}

/* La ligne d'état d'une carte : ce qui compte à cette étape, et son dessin.
   V3.42 : « En vente » sans mandat signé noté, elle dit où en est le mandat
   dans Documents (en préparation, en signature) au lieu de « Mandat en
   cours ». */
export type LigneEtat = { t: string; ton: 'neutre' | 'alerte' | 'ok'; ic: string };
export function ligneEtat(b: BienVente, suivi: SuiviVente[], mandat: EtatMandatDoc | null = null): LigneEtat {
  const e = ligneEtatBrute(b, suivi, mandat);
  return { ...e, ic: e.ic || 'drapeau' };
}
function ligneEtatBrute(b: BienVente, suivi: SuiviVente[], mandat: EtatMandatDoc | null): { t: string; ton: LigneEtat['ton']; ic?: string } {
  const d = b.donnees || {};
  const derniere = (type: string) => suivi.filter(x => x.type === type).sort((x, y) => y.le.localeCompare(x.le))[0];
  const etapeInfo = derniere('etape');
  const ed = (etapeInfo?.donnees || {}) as Record<string, string>;
  if (b.etape === 'vendu') return { t: `Conclue${b.vendu_le ? ` le ${dateCourte(b.vendu_le)}` : ''}`, ton: 'ok', ic: 'check' };
  if (b.etape === 'a_suivre') {
    const rdv0 = txt(d, 'rdvEstimation');
    /* V3.48 : mis en attente, il ne montre plus son ancien rendez-vous. */
    const enAttente = etapeInfo?.statut === 'a_suivre' && ed.de === 'estimation';
    const h0 = txt(d, 'rdvEstimationHeure');
    if (rdv0 && !enAttente && (joursAvant(rdv0) ?? -1) >= 0) return { t: `Rendez-vous d’estimation le ${dateCourte(rdv0)}${h0 ? ` à ${h0.replace(':', ' h ')}` : ''}`, ton: 'neutre', ic: 'calendrier' };
    /* Mis en attente à l'estimation (V3.32) : pourquoi, et quand le rappeler. */
    if (etapeInfo?.statut === 'a_suivre' && ed.de === 'estimation') return { t: ['En attente', ed.raison, ed.reprise ? `à recontacter vers le ${dateCourte(ed.reprise)}` : ''].filter(Boolean).join(' · '), ton: 'neutre', ic: 'pause' };
    const delai: Record<string, string> = { vite: 'dès que possible', '3mois': 'sous 3 mois', '6mois': 'sous 6 mois', libre: 'pas pressé' };
    return { t: typeof d.delai === 'string' && delai[d.delai] ? `Projet : ${delai[d.delai]}` : 'Projet à suivre', ton: 'neutre' };
  }
  if (b.etape === 'retire') return { t: `Retirée du marché${ed.raison ? ` · ${ed.raison}` : ''}`, ton: 'neutre', ic: 'archive' };
  /* V3.130 : une annonce type tombait dans l'estimation (« Avis de valeur à envoyer »). */
  if (b.etape === 'annonce_type') return { t: 'Une annonce, pour faire venir des demandeurs', ton: 'neutre', ic: 'megaphone' };
  if (b.etape === 'suspendu') return { t: [ed.raison || 'Commercialisation en pause', ed.reprise ? `reprise le ${dateCourte(ed.reprise)}` : ''].filter(Boolean).join(' · '), ton: 'neutre', ic: 'pause' };
  if (b.etape === 'compromis') {
    const pret = ed.pretLimite ? `fin du délai de prêt le ${dateCourte(ed.pretLimite)}` : '';
    const acte = ed.acte ? `signature le ${dateCourte(ed.acte)}` : '';
    const t = [pret, acte].filter(Boolean).join(' · ');
    return { t: t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Accord trouvé, signature à venir', ton: 'neutre', ic: 'accord' };
  }
  if (b.etape === 'offre') {
    const o = suivi.filter(x => x.type === 'offre' && (x.statut === 'en_attente' || x.statut === 'acceptee' || x.statut === 'contre'))
      .sort((x, y) => (y.montant || 0) - (x.montant || 0))[0];
    const jusq = o ? String((o.donnees as Record<string, unknown>).jusquau || '') : '';
    return { t: o ? `Offre à ${montantAffaire(montantActuel(o), d)}${o.statut === 'acceptee' ? ' · acceptée' : jusq ? ` · réponse attendue le ${dateCourte(jusq)}` : ''}` : 'Sous offre', ton: 'alerte', ic: 'euro' };
  }
  if (b.etape === 'mandat') {
    /* En vente sans mandat signé noté (V3.42) : où il en est dans Documents. */
    const signe = txt(d, 'mandatDate');
    if (!signe && !b.mandat_fin) {
      if (mandat) return { t: motMandat(mandat), ton: mandat.statut === 'signe' ? 'ok' : 'neutre', ic: 'plume' };
      return { t: 'Mandat pas encore signé', ton: 'alerte', ic: 'plume' };
    }
    const j = joursAvant(b.mandat_fin);
    const excl = b.mandat_type === 'exclusif' || b.mandat_type === 'semi';
    if (j !== null && j <= 15 && j >= 0) return { t: `${excl ? 'Exclusivité' : 'Mandat'} : fin dans ${j} jour${j > 1 ? 's' : ''}`, ton: 'alerte', ic: 'horloge' };
    if (j !== null && j < 0) return { t: `${excl ? 'Exclusivité' : 'Mandat'} terminé${excl ? 'e' : ''} depuis le ${dateCourte(b.mandat_fin)}`, ton: 'alerte', ic: 'horloge' };
    if (b.mandat_fin) return { t: `${excl ? 'Exclusivité' : 'Mandat'} jusqu’au ${dateCourte(b.mandat_fin)}`, ton: 'neutre', ic: 'plume' };
    return { t: `Mandat signé le ${dateCourte(signe)}`, ton: 'neutre', ic: 'plume' };
  }
  /* L'estimation (V3.16) : le rendez-vous, puis le montant, puis l'avis
     de valeur. Le montant lui-même est sur la carte (prixCarte). */
  const a = num(d, 'estimBasse'), h = num(d, 'estimHaute'), p = num(d, 'prix');
  const rdv = txt(d, 'rdvEstimation'), avis = txt(d, 'avisEnvoye');
  const hRdv = txt(d, 'rdvEstimationHeure');
  const aH = hRdv ? ` à ${hRdv.replace(':', ' h ')}` : '';
  const j = joursAvant(rdv);
  if (avis) return { t: `Avis de valeur envoyé le ${dateCourte(avis)}`, ton: 'ok', ic: 'check' };
  if (rdv && (j ?? -1) >= 0) return { t: j === 0 ? `Rendez-vous d’estimation aujourd’hui${aH}` : `Rendez-vous d’estimation le ${dateCourte(rdv)}${aH}`, ton: 'neutre', ic: 'calendrier' };
  if (a || h || p) return { t: p && (a || h) ? `Conseillé ${montantAffaire(p, d)} · avis de valeur à envoyer` : 'Avis de valeur à envoyer', ton: 'neutre', ic: 'etiquette' };
  return { t: rdv ? `Vu le ${dateCourte(rdv)} · montant à définir` : 'Pas encore de rendez-vous', ton: 'neutre', ic: rdv ? 'etiquette' : 'calendrier' };
}

/* ══ L'estimation (V3.16) ══════════════════════════════════════════════
   Le montant se donne en passant le bien « estimation », ou plus tard avec
   « Définir l'estimation » : la fourchette (estimBasse, estimHaute) et le
   prix conseillé, rangé dans `prix` (il deviendra le prix affiché au
   mandat). Rien ne s'efface quand le bien change d'étape : en pause ou
   retiré, la carte garde son montant. */
export const estimationFaite = (d: Donnees) => !!(num(d, 'estimBasse') || num(d, 'estimHaute') || num(d, 'prix'));
/* Pour bien estimer : ce que la fiche dit déjà, et ce qui manque encore. */
export function pretPourEstimer(d: Donnees): { l: string; ic: string; ok: boolean }[] {
  const terr = estTerrain(d);
  const etage = d.etage;
  return [
    { l: 'Ce qui est proposé', ic: 'agence', ok: !!natureDe(d) },
    { l: 'La surface', ic: 'regle', ok: terr ? !!num(d, 'terrain') : !!num(d, 'surface') },
    ...(estLocal(d) ? [{ l: 'L’état', ic: 'pinceau', ok: !!d.etat }] : []),
    ...(enImmeuble(d) ? [{ l: 'L’étage', ic: 'ascenseur', ok: etage !== undefined && etage !== null && etage !== '' }] : []),
    ...(estCommerce(d) ? [{ l: 'L’emplacement et la vitrine', ic: 'vitrine', ok: !!d.emplacement || !!num(d, 'vitrine') }] : []),
    ...(bailEnCours(d) ? [{ l: 'Le bail en cours et son loyer', ic: 'bail', ok: !!num(d, 'loyerAn') }] : []),
    ...(estFonds(d) ? [{ l: 'Le chiffre d’affaires', ic: 'courbe', ok: !!num(d, 'caHt') }] : []),
    { l: 'Les charges', ic: 'lots', ok: !!num(d, 'chargesAn') },
    { l: 'La taxe foncière', ic: 'fiscal', ok: !!num(d, 'taxeFonciere') },
    /* V3.48 : une nouvelle affaire reprend les espaces d'avant ; seule la visite de celle-ci compte. */
    { l: 'La visite', ic: 'tablette', ok: !!txt(d, 'visiteLe') || (!d.venteAvant && lirePieces(d.detailPieces).length > 0) },
  ];
}
/* Une ligne d'historique : « Estimation : 850 000 € à 900 000 €, prix
   conseillé 875 000 € ». */
export function texteEstimation(x: { basse: number | null; haute: number | null; prix: number | null }): string {
  const f = x.basse && x.haute ? `${euros(x.basse)} à ${euros(x.haute)}` : x.basse || x.haute ? euros((x.basse || x.haute) as number) : '';
  const p = x.prix ? `montant conseillé ${euros(x.prix)}` : '';
  return `Estimation : ${[f, p].filter(Boolean).join(', ') || 'montant retiré'}`;
}

/* ══ L'annonce : ce qui est obligatoire, ce qui manque ═══════════════════
   Les mentions qu'une annonce de vente doit porter (loi ALUR, arrêté du
   10 janvier 2017 sur les honoraires, DPE depuis 2022). */
/* `ou` (V3.108) : la partie de l'éditeur où ça se remplit. */
export function controleAnnonce(d: Donnees): { ok: boolean; l: string; aide?: string; ou?: string }[] {
  /* Werner : ce qu'une annonce de local professionnel doit porter. Le
     montant et ce qu'il est (loyer annuel HT HC, prix), les honoraires HT
     et qui les paie, la surface, le DPE ; le bail transmis pour une cession. */
  const a = argentBien(d);
  const copro = d.copro === 'oui';
  const dpeFait = d.dpeStatut !== 'vierge' && d.dpeStatut !== 'non' && d.typeBien !== 'parking' && !estTerrain(d);
  const out: { ok: boolean; l: string; aide?: string; ou?: string }[] = [
    { ok: !!natureDe(d), l: 'Ce qui est proposé (location, cession, vente)', ou: 'bien' },
    { ok: !!a.prix, l: auPoste(d) ? 'Le prix d’un poste' : estLocation(d) ? 'Le loyer annuel HT HC' : 'Le prix', ou: 'prix' },
    { ok: a.hono !== null || d.charge === 'vendeur', l: 'Les honoraires HT et qui les paie', aide: estLocation(d) ? 'Le taux du loyer annuel, ou le forfait' : 'À la charge de l’acquéreur : le taux et le prix hors honoraires', ou: 'prix' },
    { ok: !!num(d, 'surface') || estTerrain(d), l: 'La surface', ou: 'bien' },
    ...(bailEnCours(d) ? [{ ok: !!num(d, 'loyerAn'), l: 'Le loyer du bail en cours', ou: 'bail' }] : []),
    ...(avecLoyer(d) ? [{ ok: !!num(d, 'chargesAn'), l: 'Les charges annuelles', ou: 'copro' }] : []),
    ...(copro && estMurs(d) ? [{ ok: !!num(d, 'carrez'), l: 'La surface loi Carrez', ou: 'bien' }] : []),
    { ok: !dpeFait || (!!d.dpe && !!d.ges), l: 'Les classes DPE et GES', ou: 'energie' },
    { ok: !dpeFait || (!!num(d, 'dpeValeur') && !!num(d, 'gesValeur')), l: 'Les valeurs du DPE et du GES', ou: 'energie' },
    ...(copro && estMurs(d) ? [
      { ok: !!num(d, 'lots'), l: 'Le nombre de lots de la copropriété', ou: 'copro' },
      { ok: d.procedure === 'oui' || d.procedure === 'non', l: 'Une procédure en cours ou non', ou: 'copro' },
    ] : []),
  ];
  return out;
}
/* Classe F ou G : la mention « logement à consommation énergétique excessive ». */
export const passoire = (d: Donnees) => d.dpe === 'F' || d.dpe === 'G';

/* Un texte d'annonce à partir de la fiche, à retoucher. Aucun mot de métier,
   aucune promesse : les faits de la fiche, dans l'ordre où on les lit. */
export function brouillonAnnonce(d: Donnees): string {
  /* Un texte d'annonce à partir de la fiche, à retoucher : les faits, dans
     l'ordre où un preneur les lit. Aucune promesse, aucun chiffre du fonds. */
  const nat = natureDe(d);
  const type = d.typeBien === 'local' ? 'local commercial' : (nomType(d.typeBien) || 'local').toLowerCase();
  const s = nb(d, 'surface'), e = nb(d, 'etage');
  const lieu = [villeAffichee(txt(d, 'ville'), txt(d, 'cp')), txt(d, 'quartier') ? `quartier ${txt(d, 'quartier')}` : ''].filter(Boolean).join(', ');
  const phrases: string[] = [];
  const quoi = nat === 'location' ? 'à louer' : nat === 'cession_bail' ? 'en cession de droit au bail' : nat === 'fonds' ? `: cession d’un fonds de commerce${txt(d, 'activite') ? ` de ${txt(d, 'activite').toLowerCase()}` : ''}` : nat === 'murs' ? 'à vendre, libre' : nat === 'murs_occupes' ? 'à vendre, loué' : 'disponible';
  const article = /^(bureaux)$/.test(type) ? '' : /^[aeéiou]/.test(type) ? 'un ' : 'un ';
  phrases.push(`À ${lieu || '…'}, ${article}${type}${s ? ` de ${m2(s)}` : ''} ${quoi}${enImmeuble(d) && e !== null ? `, au ${e === 0 ? 'rez-de-chaussée' : `${e}${e === 1 ? 'er' : 'e'} étage`}${liste(d, 'immeuble').includes('ascenseur') ? ' avec ascenseur' : ''}` : ''}.`);
  const surf: string[] = [];
  if (nb(d, 'surfRdc')) surf.push(`${m2(nb(d, 'surfRdc') as number)} en rez-de-chaussée`);
  if (nb(d, 'surfEtage')) surf.push(`${m2(nb(d, 'surfEtage') as number)} à l’étage`);
  if (nb(d, 'surfSousSol')) surf.push(`${m2(nb(d, 'surfSousSol') as number)} en sous-sol`);
  if (nb(d, 'surfMezzanine')) surf.push(`${m2(nb(d, 'surfMezzanine') as number)} de mezzanine`);
  if (surf.length) phrases.push(`La surface se répartit en ${surf.join(', ').replace(/, ([^,]*)$/, ' et $1')}.`);
  if (d.divisible === 'oui') phrases.push(`Les surfaces sont divisibles${nb(d, 'surfDivMin') ? ` à partir de ${m2(nb(d, 'surfDivMin') as number)}` : ''}.`);
  if (estCommerce(d)) {
    const c: string[] = [];
    if (nb(d, 'vitrine')) c.push(`un linéaire de vitrine de ${String(nb(d, 'vitrine')).replace('.', ',')} m`);
    if (d.angle === 'oui') c.push('un emplacement d’angle');
    const emp = EMPLACEMENTS.find(x => x.v === d.emplacement);
    if (emp) c.push(`un emplacement ${emp.l.startsWith('N°') ? emp.l : emp.l.toLowerCase()}`);
    if (c.length) phrases.push(`Il offre ${c.join(', ').replace(/, ([^,]*)$/, ' et $1')}.`);
    if (d.extraction === 'oui') phrases.push('Une extraction est en place.');
    else if (d.extraction === 'possible') phrases.push('Une extraction est possible.');
  }
  if (estBureaux(d)) {
    const b: string[] = [];
    if (nb(d, 'nbBureaux')) b.push(`${nb(d, 'nbBureaux')} bureau${(nb(d, 'nbBureaux') as number) > 1 ? 'x' : ''} fermé${(nb(d, 'nbBureaux') as number) > 1 ? 's' : ''}`);
    if (d.config === 'open' || d.config === 'mixte') b.push('un open space');
    if (nb(d, 'nbReunion')) b.push(`${(nb(d, 'nbReunion') as number) > 1 ? `${nb(d, 'nbReunion')} salles` : 'une salle'} de réunion`);
    if (b.length) phrases.push(`Les bureaux comprennent ${b.join(', ').replace(/, ([^,]*)$/, ' et $1')}.`);
    if (nb(d, 'postes')) phrases.push(`Environ ${nb(d, 'postes')} postes de travail.`);
  }
  const eq = liste(d, 'equipements').map(v => EQUIPEMENTS.find(x => x.v === v)?.l).filter(Boolean) as string[];
  if (eq.length) phrases.push(`Prestations : ${eq.join(', ').toLowerCase()}.`);
  if (d.etat === 'refait_neuf') phrases.push('Le local a été entièrement refait.');
  else if (d.etat === 'bon_etat') phrases.push('Le local est en bon état.');
  else if (d.etat === 'brut') phrases.push('Le local est livré brut, à aménager.');
  const dest = DESTINATIONS.find(x => x.v === d.destinationType);
  if (dest && avecLoyer(d)) phrases.push(d.destinationType === 'tous' ? 'Le bail permet tous commerces.' : `Destination : ${txt(d, 'destination') || dest.l.toLowerCase()}.`);
  if (txt(d, 'stations')) phrases.push(`Accès : ${txt(d, 'stations')}.`);
  if (txt(d, 'disponible')) phrases.push(`Disponible ${txt(d, 'disponible')}.`);
  return `${phrases.join(' ')}\n\n${mentionsAnnonce(d)}`;
}

/* Les mentions obligatoires, écrites depuis la fiche (V3.79 : à part, pour
   que la reformulation par l'IA les reprenne mot pour mot, sans jamais les
   écrire elle-même) : le prix et les honoraires, la copropriété, le DPE,
   Géorisques. */
export function mentionsAnnonce(d: Donnees): string {
  /* Les mentions écrites depuis la fiche, à part, pour que la reformulation
     par l'IA les reprenne mot pour mot (V3.79). Werner : un montant
     professionnel se dit hors taxes ; le loyer annuel, les charges, la
     taxe foncière, le dépôt ; le prix d'une cession et le bail transmis. */
  const a = argentBien(d);
  const legal: string[] = [];
  const fmt = (n: number) => euros(n);
  if (a.prix) {
    if (estLocation(d)) {
      const l = [auPoste(d)
        ? `Prix d’un poste : ${fmt(a.prix / 12)} HT par mois, soit ${fmt(a.prix)} HT par an${nbPostesDe(d) ? ` (${nbPostesDe(d)} postes dans le bureau)` : ''}${d.tvaLoyer === 'oui' ? ', TVA en sus' : ''}.`
        : `Loyer : ${fmt(a.prix)} HT HC par an${nb(d, 'surface') ? ` (${loyerM2(a.prix, nb(d, 'surface'))})` : ''}${d.tvaLoyer === 'oui' ? ', TVA en sus' : ''}.`];
      if (nb(d, 'chargesAn')) l.push(`Charges : ${fmt(nb(d, 'chargesAn') as number)} HT par an${d.chargesMode === 'forfait' ? ', au forfait' : ', par provision'}.`);
      if (nb(d, 'taxeFonciere')) l.push(`Taxe foncière : ${fmt(nb(d, 'taxeFonciere') as number)} par an${d.tfRefacturee === 'oui' ? ', remboursée par le preneur' : d.tfRefacturee === 'non' ? ', à la charge du bailleur' : ''}.`);
      if (nb(d, 'depotMois')) l.push(`Dépôt de garantie : ${nb(d, 'depotMois')} mois de loyer.`);
      if (nb(d, 'droitEntree')) l.push(`Droit d’entrée : ${fmt(nb(d, 'droitEntree') as number)}.`);
      if (a.hono !== null) l.push(`Honoraires : ${fmt(a.hono)} HT${a.taux !== null ? ` (${pourcent(a.taux)} du loyer annuel HT HC)` : ''}, à la charge du ${d.charge === 'vendeur' ? 'bailleur' : 'preneur'}.`);
      legal.push(...l);
    } else {
      const mot = estCessionBail(d) ? 'Prix du droit au bail' : estFonds(d) ? 'Prix du fonds' : 'Prix';
      if (a.acq && a.net && a.hono !== null && a.taux !== null) legal.push(`${mot} : ${fmt(a.prix)} honoraires inclus, dont ${pourcent(a.taux)} HT à la charge de l’acquéreur (${fmt(a.net)} hors honoraires).`);
      else if (d.charge === 'vendeur') legal.push(`${mot} : ${fmt(a.prix)}, honoraires à la charge du ${estMurs(d) ? 'vendeur' : 'cédant'}.`);
      else legal.push(`${mot} : ${fmt(a.prix)} honoraires inclus (le pourcentage à la charge de l’acquéreur est à compléter).`);
      if (bailEnCours(d) && nb(d, 'loyerAn')) legal.push(`Loyer du bail en cours : ${fmt(nb(d, 'loyerAn') as number)} HT HC par an.${estMursOccupes(d) ? ` Rentabilité brute : ${rentabilite(nb(d, 'loyerAn'), a.prix)}.` : ''}`);
      if (bailEnCours(d) && d.bailType) legal.push(`${TYPES_BAIL.find(x => x.v === d.bailType)?.l || 'Bail'}${txt(d, 'bailFin') ? ` jusqu’au ${dateCourte(txt(d, 'bailFin'))}` : ''}.`);
      if (estFonds(d) && nb(d, 'stock')) legal.push(`Stock en sus, à sa valeur au jour de la cession.`);
    }
  }
  if (d.copro === 'oui' && estMurs(d)) {
    legal.push(`Copropriété de ${nb(d, 'lots') || '…'} lots. ${d.procedure === 'oui' ? `Procédure en cours${txt(d, 'procedureNature') ? ` : ${txt(d, 'procedureNature')}` : ''}.` : 'Aucune procédure en cours.'}`);
  }
  if (d.dpeStatut === 'vierge') legal.push('DPE vierge.');
  else if (d.dpeStatut === 'non') legal.push('Non soumis au DPE.');
  else if (d.dpe) {
    legal.push(`DPE : classe ${d.dpe}${nb(d, 'dpeValeur') ? ` (${nb(d, 'dpeValeur')} kWh/m²/an)` : ''}, GES : classe ${d.ges || '…'}${nb(d, 'gesValeur') ? ` (${nb(d, 'gesValeur')} kg CO₂/m²/an)` : ''}.`);
    if (nb(d, 'coutMin') && nb(d, 'coutMax')) legal.push(`Montant estimé des dépenses annuelles d’énergie : entre ${fmt(nb(d, 'coutMin') as number)} et ${fmt(nb(d, 'coutMax') as number)}${nb(d, 'coutAnnee') ? ` (prix de l’énergie de ${nb(d, 'coutAnnee')})` : ''}.`);
  }
  legal.push('Les informations sur les risques auxquels ce bien est exposé sont disponibles sur le site Géorisques : www.georisques.gouv.fr.');
  return legal.join('\n');
}

/* ══ L'annonce, assez longue pour être bien référencée (V3.79) ════════════
   Alexandre : « minimum 2 100 caractères, pour que ce soit bien référencé,
   pas un petit texte ». Compté sur tout le texte, mentions comprises. */
export const LONGUEUR_ANNONCE = 2100;

/* Ce que la fiche dit du bien, ligne à ligne, pour la reformulation par
   l'IA (src/app/api/biens-vente/annonce). Seulement ce qu'une annonce peut
   dire : ni le propriétaire, ni l'adresse exacte, ni les codes, les clés,
   le contact sur place ou les consignes de visite, ni les notes et les
   observations (« pour toi seul »), ni le mandat. Le prix, les honoraires,
   la copropriété et le DPE n'y sont pas non plus : le CRM les écrit lui-même
   à la fin (mentionsAnnonce). */
const ETAPES_FAITS = ['bien', 'interieur', 'exterieur', 'bail', 'fonds', 'pratique'];
const CLES_TUES = new Set([
  'adresse', 'cp', 'lot', 'cadastre', 'interphone', 'digicode', 'porte', 'itineraire', 'annexesNum', 'contactNom', 'contactTel',
  'creneaux', 'consignes', 'trousseau', 'cles', 'accesBas', 'accesAscenseur', 'loyer', 'finBail',
  /* Werner : les chiffres du fonds et les notes ne partent jamais sans l'accord du cédant. */
  'caHt', 'ebe', 'resultat', 'salaries', 'bailNote', 'fondsNote', 'voisins',
]);
export function faitsAnnonce(d: Donnees): string {
  const l: string[] = [];
  const val = (v: unknown) => (typeof v === 'number' ? String(v).replace('.', ',') : typeof v === 'string' ? v.trim() : '');
  for (const e of ETAPES_BIEN) {
    if (!ETAPES_FAITS.includes(e.id)) continue;
    for (const c0 of e.champs) {
      const c = c0 as { t: string; cle?: string; lib?: string; si?: (d: Donnees) => boolean; options?: Option[]; unite?: string; mots?: (n: number) => string };
      if (!c.cle || CLES_TUES.has(c.cle) || c.t === 'titre' || c.t === 'guide') continue;
      if (c.si && !c.si(d)) continue;
      const v = d[c.cle];
      let x = '';
      if (c.t === 'choix' && typeof v === 'string') x = c.options?.find(o => o.v === v)?.l || '';
      else if (c.t === 'cases') x = liste(d, c.cle).map(k => c.options?.find(o => o.v === k)?.l || '').filter(Boolean).join(', ');
      else if (c.t === 'nombre' || c.t === 'compteur') {
        const n = num(d, c.cle);
        if (n !== null) x = `${val(n)}${c.unite ? ` ${c.unite}` : ''}${c.mots && c.mots(n) ? ` (${c.mots(n)})` : ''}`;
      } else if (c.t === 'texte' || c.t === 'zone') x = val(v);
      if (x) l.push(`${c.lib} : ${x}`);
    }
  }
  if (d.typeBien) l.unshift(`Type de local : ${nomType(d.typeBien)}`);
  if (natureDe(d)) l.unshift(`Ce qui est proposé : ${NATURES.find(n => n.v === natureDe(d))?.l}`);
  const pieces = lirePieces(d.detailPieces).filter(p => p.nom);
  if (pieces.length) {
    l.push('Les espaces, dans l’ordre de la visite :');
    for (const p of pieces) l.push(`- ${[p.nom, p.surface ? m2(p.surface) : '', p.expo ? `exposée ${nomExpo(p.expo).toLowerCase()}` : '', p.niveau ? `niveau ${p.niveau}` : '', p.note].filter(Boolean).join(', ')}`);
  }
  if (d.copro === 'oui') l.push('En copropriété');
  if (typeof d.dpe === 'string' && d.dpe) l.push(`Classe énergie : ${d.dpe}`);
  return l.join('\n');
}

/* ══ Vers les autres rubriques ══════════════════════════════════════════ */

/* Pour la note de correspondance (src/lib/correspondance.ts). */
export function versCorrespondance(b: BienVente): BienCorr {
  const d = b.donnees || {};
  const ann = liste(d, 'annexes');
  const imm = liste(d, 'immeuble');
  const eq = liste(d, 'equipements');
  return {
    prix: argentBien(d).prix, ville: txt(d, 'ville') || null, code_postal: txt(d, 'cp') || null, quartier: txt(d, 'quartier') || null,
    surface: nb(d, 'surface'), pieces: null, chambres: null, sejour: null,
    etage: enImmeuble(d) ? nb(d, 'etage') : null, etageTotal: nb(d, 'etages'),
    expo: null, dpe: typeof d.dpe === 'string' && d.dpe ? d.dpe : null, annee: nb(d, 'annee'),
    terrasse: ann.includes('terrasse') || eq.includes('terrasse'), balcon: false, jardin: ann.includes('jardin'),
    parking: ann.some(x => ['parking', 'box'].includes(x)) || eq.includes('parking'), cave: ann.includes('cave'),
    ascenseur: imm.includes('ascenseur') || eq.includes('ascenseur'), gardien: imm.includes('gardien'),
    exterieur: nb(d, 'surfTerrasse'), surfaceTerrasse: nb(d, 'surfTerrasse'), surfaceBalcon: null,
    equipConnus: { annexes: ann.length > 0, immeuble: imm.length > 0 || eq.length > 0 },
    quartierSur: true,
    /* Werner : de quoi comparer une affaire à un demandeur, clé à clé. */
    pro: proDuBien(d),
  };
}
/* Le type de bien tel que les recherches l'écrivent (« Appartement, Maison »). */
export const typeRecherche = (v: unknown) => typePourRecherche(v);
/* Une recherche qui ne dit rien du type accepte tout ; un duplex ou un loft
   est aussi un appartement. */
export function typeCompatible(v: unknown, typesRecherche: string | null | undefined): boolean {
  const l = String(typesRecherche || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!l.length) return true;
  const t = typeRecherche(v).toLowerCase();
  if (l.includes(t)) return true;
  /* Une boutique et un restaurant sont tous deux des locaux commerciaux. */
  return t === 'restaurant' && l.includes('local commercial');
}

/* Le prix que voit l'acheteur dans son espace, tiré du bien en vente. Un
   bien de l'agence : le prix affiché est celui que paie l'acheteur,
   honoraires de vente compris. Pas d'honoraires de recherche en plus.
   Servi à la création de la copie (versBienAcheteur) et à chaque changement
   de prix ou d'honoraires (repercuterPrix, biens/outils). */
/* V3.50 : honoraires à la charge du vendeur, la copie portait le net
   vendeur (475 000) sans commission : tout écran qui recalcule le prix de
   l'acheteur (prix_vendeur + commission, comme la fiche client ou l'envoi
   de biens) affichait 475 000 au lieu des 500 000 qu'il paie. Désormais la
   copie dit toujours ce que paie l'acheteur : à la charge de l'acquéreur, le
   net + les honoraires ; à la charge du vendeur, le prix entier, sans
   commission (les honoraires ne le regardent pas). */
/* V3.113 : `etape`, l'étape du bien en vente. Avant le mandat (à suivre,
   estimation), le prix de la fiche est le prix CONSEILLÉ de l'estimation,
   pas un prix affiché : il reste entre Alexandre et le vendeur. La copie part
   donc sans prix (l'espace dit « Prix à venir », le mail n'en met pas), et
   le prix arrive chez l'acheteur à la signature du mandat (changerEtape,
   mandatSigneSurBien). Avant, l'avertissement disait « sans prix » et
   l'acheteur voyait le prix conseillé. Sans `etape` : le prix, comme avant. */
export function prixCopie(d: Donnees, etape?: string | null) {
  if (avantMandat(etape)) return { prix_vendeur: null, commission_type: 'fixe', commission_val: 0, prix_acquereur: null };
  const a = argentBien(d);
  /* Werner : un loyer se montre tel quel ; les honoraires d'une location se
     paient à part, ils ne s'y ajoutent pas. */
  if (estLocation(d)) return { prix_vendeur: a.prix, commission_type: 'fixe', commission_val: 0, prix_acquereur: a.prix };
  return a.acq
    ? { prix_vendeur: a.net ?? a.prix, commission_type: 'fixe', commission_val: a.hono || 0, prix_acquereur: a.prix }
    : { prix_vendeur: a.prix, commission_type: 'fixe', commission_val: 0, prix_acquereur: a.prix };
}

/* Le bien dans le dossier d'un acheteur (table `biens`) : exactement les
   colonnes qu'écrit l'ajout d'un bien depuis la fiche client (FicheClient,
   saveBien), plus le lien vers le bien en vente. */
export function versBienAcheteur(b: BienVente, o: { clientId: string; rechercheId: string; quand: string }) {
  const d = b.donnees || {};
  const ann = liste(d, 'annexes'), eq = liste(d, 'equipements'), imm = liste(d, 'immeuble');
  const photos = lirePhotos(d.photos).map(p => p.url);
  const energie = { gaz: 'Gaz', electrique: 'Électrique', pac: 'Pompe à chaleur', fioul: 'Fioul', urbain: 'Réseau urbain' } as Record<string, string>;
  const chargesAn = nb(d, 'chargesAn');
  const COMPRIS: Record<string, string> = { chauffage: 'chauffage', clim: 'climatisation', eau: 'eau', gardien: 'gardien', ascenseur: 'ascenseur', menage: 'ménage des parties communes' };
  const compris = liste(d, 'chargesInclus').map(v => COMPRIS[v]).filter(Boolean);
  return {
    client_id: o.clientId, recherche_id: o.rechercheId, bien_vente_id: b.id,
    etape: 'presente', envoye_le: o.quand, canal_envoi: 'lien', badge_retour: 'propose',
    url: null, titre: b.titre || titreBien(d), ville: txt(d, 'ville') || null, code_postal: txt(d, 'cp') || null, quartier: txt(d, 'quartier') || null,
    type_bien: typeRecherche(d.typeBien),
    surface: nb(d, 'surface'), nb_pieces: null, nb_chambres: null,
    nb_salles_bain: null, nb_wc: nb(d, 'wc'),
    etage: enImmeuble(d) ? nb(d, 'etage') : null, etage_total: nb(d, 'etages'), annee_construction: nb(d, 'annee'),
    exposition: null,
    dpe: typeof d.dpe === 'string' && d.dpe ? d.dpe : null, dpe_conso: nb(d, 'dpeValeur'),
    ges: typeof d.ges === 'string' && d.ges ? d.ges : null, ges_emissions: nb(d, 'gesValeur'),
    chauffage: d.chauffageMode === 'collectif' ? 'Collectif' : d.chauffageMode === 'individuel' ? 'Individuel' : null,
    source_energie: typeof d.chauffageEnergie === 'string' ? energie[d.chauffageEnergie] || null : null,
    chauffage_emetteurs: null,
    parking: ann.some(x => ['parking', 'box'].includes(x)) || eq.includes('parking'), balcon: false, terrasse: ann.includes('terrasse') || eq.includes('terrasse'),
    jardin: ann.includes('jardin'), cave: ann.includes('cave'), ascenseur: imm.includes('ascenseur') || eq.includes('ascenseur'), gardien: imm.includes('gardien'),
    cuisine_equipee: eq.includes('cuisinePro'), climatisation: eq.includes('clim') || (!!d.clim && d.clim !== 'aucune'), traversant: false,
    surface_balcon: null, surface_terrasse: nb(d, 'surfTerrasse'),
    etat_general: typeof d.etat === 'string' && d.etat ? d.etat : null,
    description: txt(d, 'annonceTexte') || brouillonAnnonce(d),
    ...prixCopie(d, b.etape),
    charges_trimestrielles: chargesAn ? Math.round(chargesAn / 4) : null, taxe_fonciere: nb(d, 'taxeFonciere'),
    nb_lots: d.copro === 'oui' ? nb(d, 'lots') : null,
    ...(chargesAn && compris.length ? { charges_comprises: compris.join(', ') } : {}),
    photos, source_portail: 'Werner Immobilier', agence_nom: 'Werner Immobilier', agence_tel: null,
    /* Werner : ce que l'espace du demandeur montre d'une affaire (biens.pro). */
    pro: proDuBien(d),
  };
}

/* Le « bien » que les modèles de documents savent lire (Contexte.bien), à
   partir d'un bien en vente. `id` vide : le document n'est pas rattaché à un
   bien d'acheteur ; son lien au bien en vente est `donnees.bienVenteId`. */
export function contexteDocument(b: BienVente) {
  const d = b.donnees || {};
  return {
    id: '', titre: b.titre, adresse: txt(d, 'adresse') || null, code_postal: txt(d, 'cp') || null, ville: txt(d, 'ville') || null,
    quartier: txt(d, 'quartier') || null, type_bien: typeRecherche(d.typeBien), surface: nb(d, 'surface'), nb_pieces: nb(d, 'pieces'),
    etage: nb(d, 'etage'), prix_acquereur: argentBien(d).prix, prix_vendeur: argentBien(d).net, agence_nom: 'Werner Immobilier', description: null,
  };
}
/* Le mandat de commercialisation prérempli depuis l'affaire : le mandant,
   la nature, les locaux, le bail, le prix et les honoraires
   (src/lib/actes/mandat-vente.ts). `prix` garde le sens de l'affaire ; le
   montant que le mandat écrit s'en déduit à l'ouverture de l'éditeur. */
export function versMandatVente(b: BienVente, base: Donnees): Donnees {
  const d = b.donnees || {};
  const vs = lirePersonnes(d.proprietaires);
  const t = typeof d.typeBien === 'string' ? d.typeBien : '';
  const nat = natureDe(d);
  const description = [
    titreBien(d),
    enImmeuble(d) && nb(d, 'etage') !== null ? `au ${etageTexte(nb(d, 'etage')).toLowerCase()}` : '',
  ].filter(Boolean).join(', ');
  const qui = d.qui === 'indivision' || d.qui === 'personne' ? d.qui : 'sci';
  const dest = DESTINATIONS.find(x => x.v === d.destinationType);
  const activites = d.destinationType === 'tous' ? 'Tous commerces' : txt(d, 'destination') || (dest ? dest.l : '');
  const usage = t === 'bureaux' || d.destinationType === 'bureaux' ? 'bureaux' : d.destinationType === 'liberal' ? 'professionnel'
    : t === 'activite' || t === 'entrepot' ? 'activite' : 'commerce';
  const garder = (k: string) => (d[k] !== undefined && d[k] !== null && d[k] !== '' ? { [k]: d[k] } : {});
  return {
    ...base,
    bienVenteId: b.id,
    ...(nat ? { nature: nat } : {}),
    qui, conso: qui === 'sci' ? 'non' : 'oui',
    ...(qui === 'sci' ? { sciNom: txt(d, 'sciNom') } : {}),
    vendeurs: vs.length ? vs : base.vendeurs,
    adresse: txt(d, 'adresse'), cp: txt(d, 'cp'), ville: txt(d, 'ville'), description,
    copro: d.copro === 'oui' ? 'oui' : 'non',
    ...(d.copro === 'oui' && txt(d, 'lot') ? { lots: [{ numero: txt(d, 'lot'), nature: nomType(t) }] } : {}),
    ...(nat === 'fonds' && txt(d, 'activite') ? { activite: `Un fonds de commerce de ${txt(d, 'activite').charAt(0).toLowerCase()}${txt(d, 'activite').slice(1)}` } : {}),
    ...(nat === 'location' ? { usage, ...garder('disponible'), ...garder('droitEntree') } : {}),
    ...(activites ? { activites } : {}),
    ...(d.bailType ? { bailType: d.bailType } : {}),
    ...garder('bailDebut'), ...garder('bailFin'), ...garder('loyerAn'), ...garder('indexation'),
    ...garder('chargesAn'), ...garder('taxeFonciere'), ...garder('tfRefacturee'), ...garder('depotMois'),
    type: d.mandatType === 'simple' || d.mandatType === 'semi' || d.mandatType === 'exclusif' ? d.mandatType : base.type,
    prix: num(d, 'prix') ?? base.prix, montant: null, charge: d.charge === 'vendeur' ? 'vendeur' : 'acquereur',
    honoMode: d.honoMode === 'forfait' ? 'forfait' : 'taux',
    ...(num(d, 'taux') !== null ? { taux: num(d, 'taux') } : {}), ...(num(d, 'forfait') !== null ? { forfait: num(d, 'forfait') } : {}),
    numero: txt(d, 'mandatNumero') || base.numero || '',
  };
}

/* Le propriétaire tel que sa fiche client l'enregistre. */
export function personneDepuisClient(c: { civilite?: string | null; prenom?: string | null; nom?: string | null; adresse?: string | null; emails?: string[] | null; telephones?: string[] | null }): Personne {
  return {
    ...PERSONNE_VIDE, civilite: c.civilite === 'Madame' || c.civilite === 'Monsieur' ? c.civilite : '',
    prenom: c.prenom || '', nom: c.nom || '', adresse: c.adresse || '', email: c.emails?.[0] || '', telephone: c.telephones?.[0] || '',
  };
}
export { nomComplet };
