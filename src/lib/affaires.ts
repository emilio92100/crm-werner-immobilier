/* ═══ Les affaires de Werner : ce qu'on loue, ce qu'on cède, ce qu'on vend ═══
   Une affaire (une ligne de `biens_vente`) a une NATURE et un TYPE DE LOCAL.

   La nature dit ce qui change de main, et donc ce que veut dire le prix :
     · location        un local vide, un bail neuf : le prix est le loyer
                       annuel HT HC ;
     · cession_bail    le locataire cède son droit au bail : le prix est celui
                       du droit au bail, le loyer du bail en cours à côté ;
     · fonds           une affaire en activité (clientèle, bail, matériel) :
                       le prix du fonds, le loyer du bail à côté ;
     · murs            le local lui-même, libre : un prix de vente ;
     · murs_occupes    le local loué, pour un investisseur : un prix de vente,
                       le loyer en place et la rentabilité.

   La colonne `prix` de la base garde toujours LE montant de l'affaire (le
   loyer annuel pour une location) : les listes, la carte et le rapprochement
   la lisent sans rien savoir de plus. Ce fichier dit comment l'écrire.

   Isomorphe : le CRM, l'espace client et les bancs d'essai le lisent. */

import type { Donnees, Option } from '@/lib/actes';

export type NatureAffaire = 'location' | 'cession_bail' | 'fonds' | 'murs' | 'murs_occupes';

export const NATURES: (Option & { v: NatureAffaire; court: string; prix: string; prixCourt: string; ic: string })[] = [
  { v: 'location', l: 'Location', court: 'À louer', aide: 'Un local vide, un bail neuf', ic: 'cle', prix: 'Loyer annuel HT HC', prixCourt: 'Loyer' },
  { v: 'cession_bail', l: 'Cession de droit au bail', court: 'Droit au bail', aide: 'Le locataire cède son bail en cours', ic: 'bail', prix: 'Prix du droit au bail', prixCourt: 'Droit au bail' },
  { v: 'fonds', l: 'Cession de fonds de commerce', court: 'Fonds de commerce', aide: 'Une affaire en activité, avec sa clientèle', ic: 'sac', prix: 'Prix du fonds', prixCourt: 'Prix du fonds' },
  { v: 'murs', l: 'Vente des murs', court: 'Murs à vendre', aide: 'Le local lui-même, libre de toute occupation', ic: 'immeuble', prix: 'Prix de vente', prixCourt: 'Prix' },
  { v: 'murs_occupes', l: 'Murs occupés', court: 'Murs occupés', aide: 'Un local loué, pour un investisseur', ic: 'courbe', prix: 'Prix de vente', prixCourt: 'Prix' },
];
export const natureDe = (d: Donnees | null | undefined): NatureAffaire | null => {
  const v = d?.nature;
  return NATURES.some(n => n.v === v) ? (v as NatureAffaire) : null;
};
export const nomNature = (v: unknown) => NATURES.find(n => n.v === v)?.l || '';
export const natureCourte = (v: unknown) => NATURES.find(n => n.v === v)?.court || '';

/* Les familles de nature : ce qui décide des questions et des mots. */
export const estLocation = (d: Donnees) => natureDe(d) === 'location';
export const estCessionBail = (d: Donnees) => natureDe(d) === 'cession_bail';
export const estFonds = (d: Donnees) => natureDe(d) === 'fonds';
export const estMurs = (d: Donnees) => natureDe(d) === 'murs' || natureDe(d) === 'murs_occupes';
export const estMursOccupes = (d: Donnees) => natureDe(d) === 'murs_occupes';
/* Un bail existe déjà, et l'affaire le transmet (cession, fonds, murs loués). */
export const bailEnCours = (d: Donnees) => estCessionBail(d) || estFonds(d) || estMursOccupes(d);
/* Le preneur paiera un loyer : une location, ou un bail repris. */
export const avecLoyer = (d: Donnees) => estLocation(d) || bailEnCours(d);
/* Une vente au sens strict (un prix, un acte) : tout sauf la location. */
export const estCession = (d: Donnees) => !!natureDe(d) && !estLocation(d);

/* Le nom du montant principal, selon la nature (« Loyer annuel HT HC »). */
export const libPrix = (d: Donnees) => NATURES.find(n => n.v === natureDe(d))?.prix || 'Prix';
export const libPrixCourt = (d: Donnees) => NATURES.find(n => n.v === natureDe(d))?.prixCourt || 'Prix';
/* L'unité qu'on écrit après le montant : un loyer est annuel et hors taxes. */
export const unitePrix = (d: Donnees) => (estLocation(d) ? 'HT HC / an' : '');

/* ── Les types de local ───────────────────────────────────────────────────
   La clé est enregistrée dans `donnees.typeBien` et la colonne `type_bien` ;
   le libellé court est celui qu'une recherche écrit dans `recherches.type_bien`
   (« Bureaux, Local commercial »). `local` garde sa clé d'origine. */
export const TYPES_LOCAL: (Option & { court: string; ic: string })[] = [
  { v: 'bureaux', l: 'Bureaux', court: 'Bureaux', ic: 'bureau' },
  { v: 'local', l: 'Boutique, local commercial', court: 'Local commercial', ic: 'vitrine' },
  { v: 'restaurant', l: 'Restaurant, café, bar', court: 'Restaurant', ic: 'table' },
  { v: 'activite', l: 'Local d’activité', court: 'Local d’activité', ic: 'outil' },
  { v: 'entrepot', l: 'Entrepôt, stockage', court: 'Entrepôt', ic: 'cube' },
  { v: 'immeuble', l: 'Immeuble', court: 'Immeuble', ic: 'immeuble' },
  { v: 'terrain', l: 'Terrain', court: 'Terrain', ic: 'terrain' },
  { v: 'parking', l: 'Parking, box', court: 'Parking', ic: 'parking' },
  { v: 'autre', l: 'Autre', court: 'Autre', ic: 'plus' },
];
export const nomLocal = (v: unknown) => TYPES_LOCAL.find(t => t.v === v)?.l || '';
export const localCourt = (v: unknown) => TYPES_LOCAL.find(t => t.v === v)?.court || '';
/* Ceux qu'on décrit avec une vitrine, un emplacement, une extraction. */
export const estCommerce = (d: Donnees) => d.typeBien === 'local' || d.typeBien === 'restaurant';
export const estBureaux = (d: Donnees) => d.typeBien === 'bureaux';
export const estActivite = (d: Donnees) => d.typeBien === 'activite' || d.typeBien === 'entrepot';
/* Un local qui se décrit en surfaces et en aménagement (pas un terrain, pas un parking). */
export const estLocal = (d: Donnees) => !['terrain', 'parking'].includes(String(d.typeBien || ''));

/* Les types qu'un demandeur peut chercher, dans l'ordre des tuiles. */
export const TYPES_RECHERCHE = TYPES_LOCAL.filter(t => t.v !== 'autre').map(t => t.court);
/* Le libellé de recherche d'un type de local (« Local commercial »). */
export const typePourRecherche = (v: unknown) => localCourt(v) || 'Autre';

/* ── Les montants ─────────────────────────────────────────────────────── */
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;
/* « 48 000 € HT HC / an » pour un loyer, « 180 000 € » pour un prix. */
export function montantAffaire(n: number | null | undefined, d: Donnees): string {
  if (!n) return '';
  const u = unitePrix(d);
  return u ? `${fmt(n)} ${u}` : fmt(n);
}
/* Le loyer au mètre carré, à l'année (ce que lit un preneur). */
export function loyerM2(loyerAn: number | null | undefined, surface: number | null | undefined): string {
  if (!loyerAn || !surface) return '';
  return `${Math.round(loyerAn / surface).toLocaleString('fr-FR').replace(/ | /g, ' ')} € HT HC / m² / an`;
}
/* La rentabilité brute des murs occupés : loyer annuel ÷ prix. */
export function rentabilite(loyerAn: number | null | undefined, prix: number | null | undefined): string {
  if (!loyerAn || !prix) return '';
  return `${String(Math.round((loyerAn / prix) * 1000) / 10).replace('.', ',')} %`;
}

/* ── Les baux ─────────────────────────────────────────────────────────── */
export const TYPES_BAIL: Option[] = [
  { v: 'commercial', l: 'Bail commercial 3/6/9', aide: 'Neuf ans, résiliable tous les trois ans', ic: 'bail' },
  { v: 'professionnel', l: 'Bail professionnel', aide: 'Six ans, pour une profession libérale', ic: 'valise' },
  { v: 'derogatoire', l: 'Bail dérogatoire', aide: 'Trois ans au plus, hors statut', ic: 'chrono' },
  { v: 'precaire', l: 'Convention d’occupation précaire', ic: 'horloge' },
  { v: 'civil', l: 'Bail civil', aide: 'Un parking, un entrepôt, une SCI', ic: 'doc' },
];
export const INDICES: Option[] = [
  { v: 'ilc', l: 'ILC', aide: 'Loyers commerciaux', ic: 'courbe' },
  { v: 'ilat', l: 'ILAT', aide: 'Activités tertiaires, bureaux', ic: 'courbe' },
  { v: 'icc', l: 'ICC', aide: 'Coût de la construction', ic: 'courbe' },
  { v: 'aucun', l: 'Pas d’indexation', ic: 'croix' },
];

/* ── Ce que le preneur peut faire du local ───────────────────────────── */
export const DESTINATIONS: Option[] = [
  { v: 'tous', l: 'Tous commerces', aide: 'Toute activité commerciale', ic: 'sac' },
  { v: 'sauf', l: 'Tous commerces sauf…', aide: 'Souvent sauf restauration, nuisances', ic: 'croix' },
  { v: 'restauration', l: 'Restauration possible', aide: 'Avec ou sans extraction', ic: 'table' },
  { v: 'precise', l: 'Une activité précise', ic: 'cible' },
  { v: 'bureaux', l: 'Bureaux, activité tertiaire', ic: 'bureau' },
  { v: 'liberal', l: 'Profession libérale', ic: 'balance' },
];

/* ── L'emplacement d'un commerce ─────────────────────────────────────── */
export const EMPLACEMENTS: Option[] = [
  { v: 'n1', l: 'N° 1', aide: 'La meilleure rue commerçante du quartier', ic: 'etoilePleine' },
  { v: 'n1bis', l: 'N° 1 bis', aide: 'Juste à côté du meilleur passage', ic: 'etoile' },
  { v: 'n2', l: 'N° 2', aide: 'Une rue secondaire, un commerce de destination', ic: 'lieu' },
  { v: 'quartier', l: 'Commerce de quartier', ic: 'immeuble' },
  { v: 'centre', l: 'Centre commercial, galerie', ic: 'sac' },
  { v: 'zone', l: 'Zone commerciale ou d’activité', ic: 'voiture' },
];

/* ── Les équipements d'un local ───────────────────────────────────────
   Les mêmes clés pour l'affaire (`donnees.equipements`) et pour les critères
   d'un demandeur (`recherches.exigences`, souhaité ou indispensable) : le
   rapprochement compare clé à clé. `pour` : les types de local où on le
   propose (rien : tous). */
export const EQUIPEMENTS: (Option & { ic: string; pour?: string[] })[] = [
  { v: 'clim', l: 'Climatisation', ic: 'flocon' },
  { v: 'fauxPlafond', l: 'Faux plafond', ic: 'toit', pour: ['bureaux', 'activite', 'local'] },
  { v: 'plancherTech', l: 'Plancher technique', ic: 'sol', pour: ['bureaux'] },
  { v: 'cablage', l: 'Câblage informatique', ic: 'wifi', pour: ['bureaux', 'activite'] },
  { v: 'fibre', l: 'Fibre', ic: 'wifi' },
  { v: 'ascenseur', l: 'Ascenseur', ic: 'ascenseur' },
  { v: 'monteCharge', l: 'Monte-charge', ic: 'cube', pour: ['activite', 'entrepot', 'local', 'restaurant'] },
  { v: 'pmr', l: 'Accès PMR', ic: 'pmr' },
  { v: 'parking', l: 'Parking', ic: 'parking' },
  { v: 'extraction', l: 'Extraction', ic: 'flamme', pour: ['local', 'restaurant', 'activite'] },
  { v: 'rideau', l: 'Rideau métallique', ic: 'volet', pour: ['local', 'restaurant'] },
  { v: 'vitrineEq', l: 'Vitrine', ic: 'vitrine', pour: ['local', 'restaurant'] },
  { v: 'reserve', l: 'Réserve', ic: 'cube', pour: ['local', 'restaurant'] },
  { v: 'cuisinePro', l: 'Cuisine équipée', ic: 'cuisine', pour: ['restaurant'] },
  { v: 'chambreFroide', l: 'Chambre froide', ic: 'flocon', pour: ['restaurant', 'local'] },
  { v: 'terrasse', l: 'Terrasse', ic: 'parasol' },
  { v: 'quai', l: 'Quai de chargement', ic: 'voiture', pour: ['activite', 'entrepot'] },
  { v: 'acces', l: 'Accès poids lourds', ic: 'voiture', pour: ['activite', 'entrepot'] },
  { v: 'alarme', l: 'Alarme', ic: 'alarme' },
  { v: 'surveillance', l: 'Vidéosurveillance', ic: 'oeil' },
  { v: 'accueil', l: 'Accueil, gardien', ic: 'personne', pour: ['bureaux'] },
  { v: 'lumineux', l: 'Lumineux', ic: 'soleil' },
  { v: 'meuble', l: 'Loué équipé, meublé', ic: 'canape', pour: ['bureaux'] },
];
export const nomEquipement = (v: unknown) => EQUIPEMENTS.find(e => e.v === v)?.l || '';

/* ── Ce qu'une affaire dit d'elle-même, en dehors de sa fiche ─────────────
   Le résumé que lisent le rapprochement (BienCorr.pro), l'espace d'un
   demandeur et la page publique (`biens.pro`). Rien de privé : ni le mandant,
   ni les chiffres du fonds, ni les notes. */
export type ProBien = {
  nature: NatureAffaire | null; type: string | null;
  /* Le loyer annuel HT HC que paiera le preneur (une location, un bail repris). */
  loyerAn: number | null;
  /* Le prix d'une cession ou d'une vente (droit au bail, fonds, murs). */
  prix: number | null;
  droitEntree: number | null; chargesAn: number | null; taxeFonciere: number | null; depotMois: number | null;
  divisible: boolean; surfDivMin: number | null; vitrine: number | null; emplacement: string | null;
  extraction: string | null; destinationType: string | null; destination: string | null;
  bailType: string | null; bailFin: string | null; activite: string | null;
  equipements: string[];
};
const n0 = (d: Donnees, k: string): number | null => {
  const v = d[k];
  const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/\s/g, '').replace(',', '.')) : NaN;
  return Number.isFinite(x) && x > 0 ? x : null;
};
const t0 = (d: Donnees, k: string): string | null => (typeof d[k] === 'string' && String(d[k]).trim() ? String(d[k]).trim() : null);
export function proDuBien(d: Donnees): ProBien {
  const nat = natureDe(d);
  const prix = n0(d, 'prix');
  const eq = Array.isArray(d.equipements) ? (d.equipements as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  /* Les équipements tenus ailleurs dans la fiche comptent aussi. */
  const imm = Array.isArray(d.immeuble) ? (d.immeuble as unknown[]) : [];
  const ann = Array.isArray(d.annexes) ? (d.annexes as unknown[]) : [];
  const tous = new Set(eq);
  if (imm.includes('ascenseur')) tous.add('ascenseur');
  if (imm.includes('monteCharge')) tous.add('monteCharge');
  if (ann.includes('parking') || ann.includes('box')) tous.add('parking');
  if (ann.includes('terrasse')) tous.add('terrasse');
  if (ann.includes('quai')) tous.add('quai');
  if (d.extraction === 'oui') tous.add('extraction');
  if (d.clim === 'reversible' || d.clim === 'froid') tous.add('clim');
  return {
    nature: nat, type: typeof d.typeBien === 'string' && d.typeBien ? d.typeBien : null,
    loyerAn: nat === 'location' ? prix : bailEnCours(d) ? n0(d, 'loyerAn') : null,
    prix: nat && nat !== 'location' ? prix : null,
    droitEntree: nat === 'location' ? n0(d, 'droitEntree') : null,
    chargesAn: n0(d, 'chargesAn'), taxeFonciere: n0(d, 'taxeFonciere'), depotMois: n0(d, 'depotMois'),
    divisible: d.divisible === 'oui', surfDivMin: d.divisible === 'oui' ? n0(d, 'surfDivMin') : null,
    vitrine: n0(d, 'vitrine'), emplacement: t0(d, 'emplacement'),
    extraction: t0(d, 'extraction'), destinationType: t0(d, 'destinationType'), destination: t0(d, 'destination'),
    bailType: t0(d, 'bailType'), bailFin: t0(d, 'bailFin'), activite: nat === 'fonds' ? t0(d, 'activite') : null,
    equipements: [...tous],
  };
}
