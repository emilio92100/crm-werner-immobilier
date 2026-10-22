/* ═══ Le mandat de commercialisation de Werner ════════════════════════════
   Un seul modèle (id `mandat_vente`, la clé que lisent la fiche d'une
   affaire, le registre et la signature), cinq natures et trois formes :

     nature          ce que le mandant confie            l'autre partie
     location        des locaux à louer, un bail neuf    le PRENEUR
     cession_bail    son droit au bail                   le CESSIONNAIRE
     fonds           son fonds de commerce               le CESSIONNAIRE
     murs            les murs, libres                    l'ACQUÉREUR
     murs_occupes    les murs, loués                     l'ACQUÉREUR

                          simple        semi-exclusif          exclusif
     traiter seul         oui           oui (honoraires        non
                                        réduits ou nuls)
     autre agence         oui           non                    non

   Les textes sont ceux des mandats de Werner (octobre 2026 : location
   n° 847, droit au bail n° 856, fonds n° 838, vente n° 859), repris tels
   quels autant que possible ; le semi-exclusif et l'exclusif, que ses
   modèles n'avaient pas, sont écrits sur le même ton.

   Ce qui est toujours imprimé, en caractères très apparents (capitales) :
     · les deux clauses pénales de Werner ;
     · le rappel de l'article 78 du décret du 20 juillet 1972 (passé trois
       mois, chacun peut dénoncer le mandat avec quinze jours de préavis par
       recommandé). Un mandat qui a une clause pénale sans ce rappel est nul
       (Cass. 1re civ., 3 novembre 2016, n° 15-23.534, des locaux
       commerciaux) : son mandat de location n° 847 ne l'avait pas.

   Mentions exigées : le numéro du registre (art. 72 du décret), la durée
   limitée (art. 7 de la loi Hoguet), les honoraires et qui les paie
   (art. 6), les actions promises et la reddition de comptes (art. 6, loi
   ALUR). Avec un mandant qui relève des règles du consommateur (un
   particulier, une petite entreprise hors de son activité) : l'information
   précontractuelle, le médiateur, Bloctel, la rétractation hors de
   l'agence ou à distance, et l'annexe L215 quand il se reconduit.

   L'argent. `prix` garde le sens de l'affaire (biens-vente.ts, argentBien) :
   le loyer annuel HT HC d'une location ; pour une cession ou une vente, le
   prix affiché, honoraires compris quand l'acquéreur les paie. C'est lui
   que la fiche de l'affaire reprend à la signature (mandat-bien.ts).
   `montant` est ce que Werner écrit dans son mandat : le loyer, ou le prix
   « hors honoraires » quand ils sont en sus. L'éditeur tient les deux
   d'accord (deduire).

   ⚠️ À faire relire par l'avocat d'Alexandre avant le premier usage. */

import { euros, enLettres, type Partie, type Bloc, type Fiche, type Resume } from '@/lib/mandat';
import { type IdentiteAgence } from '@/lib/agence';
import { NATURES, natureDe, TYPES_BAIL, INDICES, type NatureAffaire } from '@/lib/affaires';
import {
  P, Pp, paragraphes, lignesLibres, nbLettres, pourcent, jourLong, aujourdhui, txt, num, liste, lignes, couper,
  lirePersonnes, nomComplet, nomsCourts, fichePersonne,
  PERSONNE_VIDE, plusMois, veille, annexeL215, blocsSignature, manquesSignature, lieuDe, modeSignature, electronique, CHAMP_SIGNATURE, MANQUE_EXECUTION,
  ouiNon, IC_RYTHME, HONO_MODES, personneRegistre,
  baseHono, motBase, htTtc, montantHono, tauxHono, tauxHT, selonBase, champsBaseHono,
  type Donnees, type Champ, type Modele, type Etape, type Contexte, type Personne, type Repere, type Echeance, type CaseSignature,
} from './commun';

export type TypeMandat = 'simple' | 'semi' | 'exclusif';
export const TYPES: Record<TypeMandat, { court: string; nom: string; maj: string }> = {
  simple: { court: 'Simple', nom: 'simple', maj: 'NON EXCLUSIF' },
  semi: { court: 'Semi-exclusif', nom: 'semi-exclusif', maj: 'SEMI-EXCLUSIF' },
  exclusif: { court: 'Exclusif', nom: 'exclusif', maj: 'EXCLUSIF' },
};
export const typeDe = (d: Donnees): TypeMandat => (d.type === 'semi' || d.type === 'exclusif' ? d.type : 'simple');
/* Les caractères très apparents de l'article 78 : en CAPITALES. */
const MAJ = (t: string) => t.toLocaleUpperCase('fr-FR');

/* ── La nature et ses mots ── */
/* Sans nature choisie (un mandat qu'on commence à la main), le texte parle
   d'une location ; « ce qui manque » demande de la choisir. */
export const natureMandat = (d: Donnees): NatureAffaire => natureDe(d) || 'location';
const estLoc = (d: Donnees) => natureMandat(d) === 'location';
const estMursN = (d: Donnees) => natureMandat(d) === 'murs' || natureMandat(d) === 'murs_occupes';
/* Un bail existe déjà et passe avec l'affaire. */
const avecBailEnCours = (d: Donnees) => ['cession_bail', 'fonds', 'murs_occupes'].includes(natureMandat(d));

type Mots = {
  /* « Mandat simple de location » */
  titre: (t: string) => string;
  /* La phrase de l'objet, après « le MANDAT NON EXCLUSIF ». */
  objet: string;
  verbe: string; laChose: string; operation: string;
  /* L'autre partie, en capitales comme dans ses mandats. */
  autre: string; autreMin: string;
  acte: string; candidats: string;
  designation: string; prix: string;
  /* Les pièces que le mandant remet. */
  pieces: string;
  role: string;
};
const MOTS: Record<NatureAffaire, Mots> = {
  location: {
    titre: t => `Mandat ${t} de location`,
    objet: 'DE RECHERCHER UN LOCATAIRE pour les biens ci-après désignés, aux prix, charges et conditions convenus ci-après',
    verbe: 'louer', laChose: 'les biens', operation: 'la location', autre: 'PRENEUR', autreMin: 'preneur',
    acte: 'le bail', candidats: 'candidats à la location',
    designation: 'Désignation des biens à louer', prix: 'Conditions de la location',
    pieces: 'tous les documents, attestation de propriété, diagnostics techniques et informations utiles à la réalisation de sa mission',
    role: 'bailleur',
  },
  cession_bail: {
    titre: t => `Mandat ${t} de cession de droit au bail`,
    objet: 'de cession du droit au bail (ci-après désigné « le Bail ») dont il est titulaire, aux prix, charges et conditions convenus ci-après',
    verbe: 'céder', laChose: 'le droit au bail', operation: 'la cession du droit au bail', autre: 'CESSIONNAIRE', autreMin: 'cessionnaire',
    acte: 'l’acte de cession', candidats: 'candidats à la cession',
    designation: 'Désignation du droit au bail', prix: 'Prix de cession',
    pieces: 'tous les documents, bail, diagnostics techniques et autres documents et informations utiles à la réalisation de sa mission, ainsi qu’un état des privilèges et nantissements',
    role: 'cédant',
  },
  fonds: {
    titre: t => `Mandat ${t} de cession d’un fonds de commerce`,
    objet: 'de vendre le fonds de commerce (ci-après désigné « le Fonds ») dont il est propriétaire, aux prix, charges et conditions convenus ci-après',
    verbe: 'vendre', laChose: 'le fonds', operation: 'la vente du fonds', autre: 'CESSIONNAIRE', autreMin: 'cessionnaire',
    acte: 'l’acte de cession', candidats: 'candidats à l’achat',
    designation: 'Désignation du fonds à vendre', prix: 'Prix de vente du fonds',
    pieces: 'tous les documents, bail, bilans et justificatifs comptables, contrats de travail, diagnostics techniques et autres documents et informations utiles à la réalisation de sa mission, ainsi qu’un état des privilèges et nantissements',
    role: 'cédant',
  },
  murs: {
    titre: t => `Mandat ${t} de vente · immobilier professionnel`,
    objet: 'DE VENDRE les biens ci-après désignés, aux prix, charges et conditions convenus ci-après',
    verbe: 'vendre', laChose: 'les biens', operation: 'la vente', autre: 'ACQUÉREUR', autreMin: 'acquéreur',
    acte: 'l’acte authentique de vente', candidats: 'candidats à l’acquisition',
    designation: 'Désignation des biens à vendre', prix: 'Prix de vente',
    pieces: 'tous les documents nécessaires à l’exécution de son mandat, notamment le titre de propriété, les diagnostics, certificats et justificatifs rendus obligatoires',
    role: 'vendeur',
  },
  murs_occupes: {
    titre: t => `Mandat ${t} de vente · murs occupés`,
    objet: 'DE VENDRE les biens ci-après désignés, vendus occupés, aux prix, charges et conditions convenus ci-après',
    verbe: 'vendre', laChose: 'les biens', operation: 'la vente', autre: 'ACQUÉREUR', autreMin: 'acquéreur',
    acte: 'l’acte authentique de vente', candidats: 'candidats à l’acquisition',
    designation: 'Désignation des biens à vendre', prix: 'Prix de vente',
    pieces: 'tous les documents nécessaires à l’exécution de son mandat, notamment le titre de propriété, le bail en cours et ses avenants, les diagnostics, certificats et justificatifs rendus obligatoires',
    role: 'vendeur',
  },
};
export const motsDe = (d: Donnees): Mots => MOTS[natureMandat(d)];
/* « Mandat simple de location », « Mandat exclusif de cession de droit au bail » */
export const titreMandat = (d: Donnees) => motsDe(d).titre(TYPES[typeDe(d)].nom);

/* ── Les actions que l'Agence promet (cases à cocher, dans cet ordre) ──
   `titre` et `x` gardent la forme qu'avait la liste d'Emilio : l'avenant
   les lit. */
export const ACTIONS: { v: string; ic: string; l: string; titre: string; x: string }[] = [
  { v: 'dossier', ic: 'doc', l: 'Dossier de présentation', titre: 'Présenter', x: 'Réaliser un dossier de présentation' },
  { v: 'photos', ic: 'photo', l: 'Reportage photographique', titre: 'Photographier', x: 'Réaliser un reportage photographique pour valoriser la présentation' },
  { v: 'video', ic: 'cube', l: 'Vidéo de présentation', titre: 'Filmer', x: 'Réaliser une vidéo de présentation des locaux' },
  { v: 'site', ic: 'globe', l: 'Site de l’agence', titre: 'Publier', x: 'Diffuser l’annonce sur le site internet de l’Agence accessible au public' },
  { v: 'portails', ic: 'megaphone', l: 'Sites immobiliers', titre: 'Diffuser', x: 'Diffuser l’annonce sur les principaux sites internet immobiliers' },
  { v: 'fichier', ic: 'groupe', l: 'Portefeuille de clients', titre: 'Proposer', x: 'Proposer l’affaire aux clients de l’Agence dont la recherche correspond' },
  { v: 'reseaux', ic: 'partage', l: 'Réseaux sociaux', titre: 'Faire connaître', x: 'Présenter l’affaire sur les réseaux sociaux de l’Agence' },
  { v: 'panneau', ic: 'panneau', l: 'Panneau, vitrophanie', titre: 'Signaler', x: 'Poser un panneau ou une vitrophanie sur les locaux, avec l’accord du MANDANT' },
  { v: 'visites', ic: 'cle', l: 'Visites accompagnées', titre: 'Faire visiter', x: 'Organiser et accompagner chaque visite' },
  { v: 'offres', ic: 'accord', l: 'Transmission des offres', titre: 'Négocier', x: 'Transmettre au MANDANT, par écrit et sans délai, toute proposition reçue, et l’assister dans la négociation' },
];
const ACTIONS_DEFAUT = ['dossier', 'photos', 'site'];

export const RYTHMES: Record<string, string> = {
  visite: 'après chaque visite',
  semaine: 'chaque semaine',
  quinzaine: 'toutes les deux semaines',
  mois: 'chaque mois',
};

/* Ce que comprend un fonds de commerce. */
const COMPOSITION: { v: string; l: string; x: string; ic: string }[] = [
  { v: 'clientele', l: 'La clientèle', x: 'La clientèle et l’achalandage y attachés', ic: 'groupe' },
  { v: 'enseigne', l: 'L’enseigne', x: 'L’enseigne', ic: 'vitrine' },
  { v: 'nom', l: 'Le nom commercial', x: 'Le nom commercial', ic: 'etiquette' },
  { v: 'droitBail', l: 'Le droit au bail', x: 'Le droit au bail des locaux où le fonds est exploité', ic: 'bail' },
  { v: 'licence', l: 'Une licence', x: 'La licence d’exploitation attachée au fonds', ic: 'doc' },
  { v: 'materiel', l: 'Agencements, matériel, mobilier', x: 'Les agencements et installations, le matériel et le mobilier le garnissant et servant à son exploitation', ic: 'outil' },
  { v: 'stocks', l: 'Les stocks', x: 'Les stocks, qui seront évalués amiablement au jour de la cession définitive', ic: 'cube' },
];
const COMPOSITION_DEFAUT = ['clientele', 'enseigne', 'droitBail', 'materiel'];

const USAGES: Record<string, string> = {
  commerce: 'à usage de commerce',
  bureaux: 'à usage de bureaux',
  activite: 'à usage d’activité',
  professionnel: 'à usage professionnel',
  mixte: 'à usage mixte de commerce et de bureaux',
};
const REGIMES_BAIL: Record<string, string> = {
  commercial: 'Le bail sera soumis au statut des baux commerciaux, dont l’essentiel des dispositions figure aux articles L145-1 et suivants du Code de commerce.',
  professionnel: 'Le bail sera un bail professionnel, soumis à l’article 57 A de la loi n° 86-1290 du 23 décembre 1986.',
  derogatoire: 'Le bail sera un bail dérogatoire au statut des baux commerciaux, conclu pour une durée de trois ans au plus (article L145-5 du Code de commerce).',
  precaire: 'Les biens seront mis à disposition par une convention d’occupation précaire, hors du statut des baux commerciaux.',
  civil: 'Le bail sera un bail de droit commun, soumis aux articles 1709 et suivants du Code civil.',
};
const INDICES_TEXTE: Record<string, string> = {
  ilc: 'de l’indice des loyers commerciaux (ILC)',
  ilat: 'de l’indice des loyers des activités tertiaires (ILAT)',
  icc: 'de l’indice du coût de la construction (ICC)',
};

/* ── Les calculs d'argent ──
   Les mêmes qu'une affaire (biens-vente.ts, argentBien) : une location, les
   honoraires se calculent sur le loyer annuel et se paient à part ; une
   cession ou une vente à la charge de l'acquéreur, `prix` les comprend et le
   taux s'applique au prix hors honoraires ; à la charge du mandant, ils se
   prélèvent sur le prix. Arrondis à l'euro.
   22 octobre 2026 : `honoraires` est dans la base choisie (`baseHono`, HT
   par défaut, commun.ts) ; `ht` et `ttc` donnent les deux. */
export type Argent = {
  prix: number | null; net: number | null; honoraires: number | null; taux: number | null; forfait: number | null; charge: 'acquereur' | 'vendeur';
  /* Ce que le mandat écrit : le loyer, ou le prix hors honoraires en sus. */
  montant: number | null;
  /* Les honoraires HT et TTC, au taux de TVA du mandat. */
  ht: number | null; ttc: number | null; tva: number;
};
export function argent(d: Donnees): Argent {
  const prix = num(d, 'prix');
  const charge = d.charge === 'vendeur' ? 'vendeur' : 'acquereur';
  const forfait = d.honoMode === 'forfait' ? num(d, 'forfait') : null;
  const taux = d.honoMode === 'forfait' ? null : num(d, 'taux');
  const tva = num(d, 'tvaHono') ?? 20;
  const deux = (h: number | null) => (h === null ? { ht: null, ttc: null } : htTtc(d, h));
  if (!prix || prix <= 0) return { prix: null, net: null, honoraires: forfait, taux, forfait, charge, montant: null, ...deux(forfait), tva };
  let honoraires: number | null = null, net: number | null = null, montant: number | null = null;
  if (estLoc(d)) {
    net = prix; montant = prix;
    honoraires = forfait !== null ? Math.round(forfait) : taux !== null && taux >= 0 ? Math.round((prix * taux) / 100) : null;
  } else if (charge === 'acquereur') {
    if (forfait !== null) { honoraires = Math.round(forfait); net = prix - honoraires; }
    else if (taux !== null && taux >= 0) { net = Math.round(prix / (1 + taux / 100)); honoraires = prix - net; }
    montant = net ?? prix;
  } else {
    montant = prix;
    if (forfait !== null) honoraires = Math.round(forfait);
    else if (taux !== null && taux >= 0) honoraires = Math.round((prix * taux) / 100);
    net = honoraires !== null ? prix - honoraires : null;
  }
  return { prix, net, honoraires, taux, forfait, charge, montant, ...deux(honoraires), tva };
}

/* Ce que la fiche de l'affaire reçoit à la signature (mandat-bien.ts), en
   HT comme toute la fiche : le prix (au sens de l'affaire), qui paie, et le
   taux ou le forfait ramenés en HT quand le mandat compte en TTC. Pour une
   cession payée par l'acquéreur, le prix affiché est refait avec les
   honoraires HT, comme la fiche les calcule (argentBien). */
export function pourAffaire(d: Donnees): Donnees {
  const forfait = d.honoMode === 'forfait';
  const f = forfait ? num(d, 'forfait') : null;
  const t = forfait ? null : num(d, 'taux');
  const fHT = f === null ? null : htTtc(d, f).ht;
  const tHT = t === null ? null : tauxHT(d, t);
  const charge = d.charge === 'vendeur' ? 'vendeur' : 'acquereur';
  const a = argent(d);
  let prix = num(d, 'prix');
  if (baseHono(d) === 'ttc' && !estLoc(d) && charge === 'acquereur' && a.montant) {
    prix = fHT !== null ? a.montant + fHT : tHT !== null ? Math.round(a.montant * (1 + tHT / 100)) : prix;
  }
  return {
    ...(prix ? { prix } : {}), charge, honoMode: forfait ? 'forfait' : 'taux',
    ...(forfait ? { forfait: fHT } : { taux: tHT }),
  };
}
/* Le `prix` (au sens de l'affaire) à partir de ce que Werner écrit. */
function prixDepuisMontant(d: Donnees, montant: number): number {
  if (estLoc(d) || d.charge === 'vendeur') return montant;
  if (d.honoMode === 'forfait') return montant + Math.round(num(d, 'forfait') || 0);
  const t = num(d, 'taux');
  return t !== null && t >= 0 ? montant + Math.round((montant * t) / 100) : montant;
}
/* L'éditeur garde `prix` d'accord avec `montant` à chaque réponse ; à
   l'ouverture d'un mandat préparé depuis l'affaire (qui n'a que `prix`), le
   montant s'en déduit. */
function deduire(d0: Donnees, cle: string): Donnees {
  const d = { ...d0 };
  const m = num(d, 'montant');
  if (m === null) {
    if (cle === '' || cle === 'prix') {
      const a = argent(d);
      if (a.montant !== null) d.montant = a.montant;
    }
    return d;
  }
  if (cle !== '') d.prix = prixDepuisMontant(d, m);
  return d;
}

/* Le mandant relève-t-il des règles du consommateur ? Un particulier, ou
   une petite entreprise pour qui ce mandat sort de son activité principale
   (article L221-3 du Code de la consommation). */
export const conso = (d: Donnees) => d.conso === 'oui';
/* Le droit de rétractation : signé hors de l'agence ou à distance, avec un
   mandant qui relève de ces règles. */
export const retractation = (d: Donnees) => conso(d) && (lieuDe(d) === 'domicile' || lieuDe(d) === 'distance');

/* ── Le mandant ── */
export function vendeursDe(d: Donnees): Personne[] {
  const l = lirePersonnes(d.vendeurs);
  const nb = d.qui === 'couple' ? 2 : d.qui === 'personne' || d.qui === 'sci' ? 1 : Math.max(2, l.length);
  const out = l.slice(0, nb);
  while (out.length < nb) out.push({ ...PERSONNE_VIDE });
  return out;
}
/* Gardés pour l'avenant : plus de conjoint qui donne son accord dans un
   mandat de l'immobilier d'entreprise. */
export const aConjoint = (_d: Donnees) => false;
const nomMandant = (d: Donnees) => (d.qui === 'sci' ? txt(d, 'sciNom') || 'La société' : nomsCourts(vendeursDe(d)));

/* ── Les lots d'une copropriété (les murs) ── */
const estCopro = (d: Donnees) => estMursN(d) && d.copro === 'oui';
/* Le total des tantièmes, gardé pour l'avenant (qui les demande encore). */
export function baseTantiemes(d: Donnees): string {
  if (d.tantiemesBase === 'autre') {
    const n = Number(String(d.tantiemesTotal ?? '').replace(/[\s  ]/g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : '…';
  }
  return d.tantiemesBase === '10000' || d.tantiemesBase === '100000' ? String(d.tantiemesBase) : '1000';
}
export const totalTantiemes = (d: Donnees) => baseTantiemes(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export function tantiemes(d: Donnees, v: string): string {
  if (!v) return '';
  if (v.includes('/')) return v;
  const t = totalTantiemes(d);
  return t === '…' ? `${v}/…` : `${v}/${t}es`;
}
export const champTotalTantiemes = (si: (d: Donnees) => boolean): Champ => ({
  t: 'nombre', cle: 'tantiemesTotal', lib: 'Sur combien ?', ic: 'pourcent', requis: true,
  si: d => si(d) && d.tantiemesBase === 'autre',
  aide: 'Le total de la copropriété, tel qu’il est écrit dans le règlement (par exemple 2 347).',
});
export function iconeLot(l: Record<string, string>): string {
  const n = (l.nature || '').toLowerCase();
  if (/cave|cellier|r[ée]serve/.test(n)) return 'cave';
  if (/parking|box|garage|stationnement/.test(n)) return 'parking';
  if (/bureau/.test(n)) return 'bureau';
  if (/boutique|commerce|local|magasin/.test(n)) return 'vitrine';
  return 'lots';
}

/* ── Le registre et la délégation : l'affaire en une ligne ── */
export function objetVente(d: Donnees): string {
  const lieu = [txt(d, 'adresse'), [txt(d, 'cp'), txt(d, 'ville')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const lots = estCopro(d) ? lignes(d, 'lots').map(l => l.numero).filter(Boolean) : [];
  const nat = NATURES.find(n => n.v === natureDe(d))?.l || '';
  return [nat, lieu, couper(txt(d, 'activite') || txt(d, 'description'), 140), lots.length ? `lot${lots.length > 1 ? 's' : ''} n° ${lots.join(', ')}` : ''].filter(Boolean).join(' · ');
}
export function registreVente(d: Donnees): { nature: 'vente'; type_mandat: string; mandants: string; objet: string } {
  const vs = vendeursDe(d).filter(p => p.nom.trim() || p.prenom.trim());
  const mandants = d.qui === 'sci'
    ? [[txt(d, 'sciNom'), txt(d, 'sciForme')].filter(Boolean).join(', '), txt(d, 'sciSiege') ? `siège ${txt(d, 'sciSiege')}` : '', txt(d, 'sciRcs'),
      vs[0] ? `représentée par ${nomComplet(vs[0])}` : ''].filter(Boolean).join(', ')
    : vs.map(personneRegistre).join(' ; ');
  const a = argent(d);
  const montant = a.montant ? `${estLoc(d) ? 'loyer annuel' : 'prix'} ${euros(a.montant)}${estLoc(d) ? ' HT HC' : ''}` : '';
  return { nature: 'vente', type_mandat: typeDe(d), mandants, objet: [objetVente(d), montant].filter(Boolean).join(' · ') };
}

/* « Ce qu'il te faut », selon qui confie l'affaire. */
function guidePoints(d: Donnees): { ic?: string; x: string }[] {
  if (d.qui === 'sci') return [
    { ic: 'immeuble', x: 'Le nom de la société, sa forme et son capital, son siège et son numéro RCS : tout est sur l’extrait Kbis (moins de 3 mois).' },
    { ic: 'personne', x: 'Celui qui signe pour elle et sa qualité (gérant, président…). Sa date de naissance n’est pas utile.' },
    { ic: 'agence', x: 'Un administrateur de biens qui confie les locaux de son client : la société, c’est lui ; note pour qui il agit (« Agit-elle pour le compte du propriétaire ? »).' },
  ];
  if (d.qui === 'indivision') return [
    { ic: 'groupe', x: 'Toutes les personnes à qui appartient l’affaire : chacune signe le mandat.' },
    { ic: 'plus', x: 'Deux fiches sont ouvertes ; « Ajouter une personne » en ajoute d’autres.' },
  ];
  return [
    { ic: 'personne', x: 'Son nom, son adresse, son mail et son téléphone.' },
    { ic: 'sac', x: 'Un commerçant ou un artisan en nom propre : note son immatriculation et son enseigne (« Exerce-t-il en nom propre ? »).' },
  ];
}

/* ══ Les questions ══════════════════════════════════════════════════════ */
const pourNature = (n: NatureAffaire[]) => (d: Donnees) => n.includes(natureMandat(d));
const NATURES_OPTIONS = NATURES.map(n => ({ v: n.v, l: n.l, aide: n.aide, ic: n.ic }));

const ETAPES: Etape[] = [
  {
    id: 'affaire', titre: 'L’affaire et le mandat', court: 'Affaire', sous: 'Ce que le mandant confie, et à quel point il s’engage.', vers: 'Objet du mandat', ic: 'cadenas',
    champs: [
      { t: 'choix', cle: 'nature', lib: 'Que te confie-t-il ?', ic: 'immeuble', tuiles: true, requis: true, options: NATURES_OPTIONS },
      { t: 'choix', cle: 'type', lib: 'Quel mandat ?', ic: 'cadenas', tuiles: true, options: [
        { v: 'simple', l: 'Simple', aide: 'Il reste libre : il traite seul ou avec d’autres agences.', ic: 'ouvert' },
        { v: 'semi', l: 'Semi-exclusif', aide: 'Aucune autre agence ; il peut encore traiter seul, en direct.', ic: 'bouclier' },
        { v: 'exclusif', l: 'Exclusif', aide: 'Toi seul, pendant toute la durée du mandat.', ic: 'cadenas' },
      ] },
      { t: 'guide', cle: 'g-type', titre: d => `Un mandat ${TYPES[typeDe(d)].nom} : ce qu’il dit`, points: d => [
        typeDe(d) === 'exclusif'
          ? { ic: 'cadenas', x: 'Le mandant ne peut ni traiter seul ni passer par une autre agence pendant toute la durée du mandat. Tes actions commerciales sont obligatoires : coche-les à l’étape « Engagements ».' }
          : typeDe(d) === 'semi'
            ? { ic: 'bouclier', x: 'Aucune autre agence pendant le mandat. S’il trouve lui-même, en direct, il ne te doit rien ou des honoraires réduits : tu choisis à l’étape des honoraires.' }
            : { ic: 'ouvert', x: 'Le mandant reste libre. Il te prévient s’il conclut sans toi, et ne peut pas traiter en direct avec une personne que tu lui as présentée.' },
        { ic: 'balance', x: 'Tes deux clauses pénales, et le rappel de l’article 78 (passé trois mois, chacun peut y mettre fin avec quinze jours de préavis par recommandé), sont toujours imprimés en capitales : sans ce rappel, un mandat avec clause pénale est nul.' },
      ] },
    ],
  },
  {
    id: 'mandant', titre: 'Le mandant', court: 'Mandant', sous: 'Qui te confie l’affaire, et qui signe.', vers: 'Entre les soussignés', ic: 'personne',
    champs: [
      { t: 'choix', cle: 'qui', lib: 'Qui te confie l’affaire ?', ic: 'personne', tuiles: true, options: [
        { v: 'sci', l: 'Une société', aide: 'SCI, SARL, SAS, foncière, administrateur de biens…', ic: 'immeuble' },
        { v: 'personne', l: 'Une personne', aide: 'En son nom propre.', ic: 'personne' },
        { v: 'indivision', l: 'Plusieurs personnes', aide: 'Une indivision, une succession…', ic: 'groupe' },
      ] },
      { t: 'guide', cle: 'g-qui', titre: d => (d.qui === 'sci' ? 'Une société : ce qu’il te faut' : d.qui === 'indivision' ? 'Plusieurs personnes : ce qu’il te faut' : 'Une personne : ce qu’il te faut'), points: guidePoints },
      { t: 'titre', cle: 't-sci', lib: 'La société', ic: 'immeuble', si: d => d.qui === 'sci' },
      { t: 'texte', cle: 'sciNom', lib: 'Raison sociale', ic: 'immeuble', requis: true, si: d => d.qui === 'sci', exemple: 'AL.Z' },
      { t: 'texte', cle: 'sciForme', lib: 'Forme et capital', ic: 'doc', large: true, requis: true, si: d => d.qui === 'sci', exemple: 'Société à responsabilité limitée au capital de 1 000 €' },
      { t: 'texte', cle: 'sciSiege', lib: 'Siège social', ic: 'lieu', large: true, requis: true, si: d => d.qui === 'sci', exemple: '39 rue Escudier, 92100 Boulogne-Billancourt' },
      { t: 'texte', cle: 'sciRcs', lib: 'Immatriculation', ic: 'livre', requis: true, si: d => d.qui === 'sci', exemple: 'RCS de Nanterre n° 889 981 783' },
      { t: 'titre', cle: 't-vendeurs', lib: 'Qui signe', ic: 'plume', aide: 'Son nom tel qu’il signera, son adresse, son mail et son téléphone.' },
      { t: 'personnes', cle: 'vendeurs', lib: 'Qui signe', ic: 'personne', un: 'Mandant', min: 1, max: 6, complet: d => d.qui !== 'sci',
        bornes: d => (d.qui === 'indivision' ? { min: 2, max: 6 } : { min: 1, max: 1 }),
        nomCarte: (d, i) => (d.qui === 'sci' ? 'Son représentant, qui signe' : d.qui === 'personne' ? 'Le mandant' : `Mandant ${i + 1}`),
        ajouter: () => 'Ajouter une personne' },
      { t: 'texte', cle: 'sciPouvoir', lib: 'Sa qualité', ic: 'plume', requis: true, si: d => d.qui === 'sci', exemple: 'gérante' },
      { t: 'texte', cle: 'pourCompte', lib: 'Pour le compte de', ic: 'agence', large: true, si: d => d.qui === 'sci', exemple: 'en qualité de mandataire de la SCI DES LILAS, propriétaire des biens',
        question: 'Agit-elle pour le compte du propriétaire ?', aide: 'Un administrateur de biens, un gestionnaire : écris pour qui il agit.' },
      { t: 'texte', cle: 'persoPro', lib: 'Son activité', ic: 'sac', large: true, si: d => d.qui !== 'sci', exemple: 'commerçant immatriculé au RCS de Paris sous le n° 123 456 789, exploitant sous l’enseigne « Le Comptoir »',
        question: 'Exerce-t-il en nom propre ?' },
      { t: 'titre', cle: 't-conso', lib: 'Les règles du consommateur', ic: 'balance' },
      { t: 'choix', cle: 'conso', lib: 'Relève-t-il des règles du consommateur ?', ic: 'balance', options: [
        { v: 'non', l: 'Non : une entreprise, pour son activité', ic: 'immeuble' },
        { v: 'oui', l: 'Oui : un particulier', aide: 'Ou une petite entreprise (5 salariés au plus) pour qui ce mandat sort de son activité principale.', ic: 'personne' },
      ] },
      { t: 'guide', cle: 'g-conso', si: conso, titre: () => 'Ce que le mandat ajoute pour lui', points: d => [
        { ic: 'info', x: 'L’information avant de signer, le médiateur de la consommation et Bloctel.' },
        { ic: 'retour', x: 'Signé hors de l’agence ou à distance (en ligne, par exemple) : 14 jours pour se rétracter, avec le formulaire joint.' },
        ...(d.dureeMode === 'prorogation' ? [{ ic: 'boucle', x: 'Il se poursuit par tacite reconduction : l’annexe des articles L215, et un courrier avant chaque échéance.' }] : []),
      ] },
      { t: 'zone', cle: 'noteVendeurs', lib: 'Une précision', ic: 'plume', large: true, question: 'Une précision à imprimer sous le mandant ?' },
    ],
  },
  {
    id: 'local', titre: 'Ce qu’il confie', court: 'Le local', sous: 'L’adresse et la désignation, telles que le mandat les écrira.', vers: d => motsDe(d).designation, ic: 'immeuble',
    champs: [
      { t: 'texte', cle: 'adresse', lib: 'Où se trouve-t-il ?', ic: 'lieu', large: true, requis: true, exemple: '55 rue de la Saussière', avec: ['cp', 'ville'],
        aide: 'Tape le début : l’adresse se propose, le code postal et la ville se remplissent.' },
      { t: 'texte', cle: 'cp', lib: 'Code postal', ic: 'mail', requis: true },
      { t: 'texte', cle: 'ville', lib: 'Ville', ic: 'immeuble', requis: true },
      { t: 'texte', cle: 'activite', lib: 'Le fonds', ic: 'sac', large: true, requis: true, si: pourNature(['fonds']), exemple: 'Un fonds de commerce de restauration' },
      { t: 'zone', cle: 'description', lib: 'La désignation', ic: 'doc', large: true, requis: true,
        exemple: 'Boutique d’une superficie d’environ 50 m² au rez-de-chaussée et 20 m² au sous-sol, avec un accès sur rue et un accès par les parties communes.',
        aide: 'Ce que le mandat dit des locaux : la surface, les niveaux, les accès, ce qu’il y a dedans. Une ligne par paragraphe.' },
      { t: 'titre', cle: 't-lots', lib: 'La copropriété', ic: 'lots', si: estMursN },
      { t: 'choix', cle: 'copro', lib: 'Les biens sont-ils en copropriété ?', ic: 'immeuble', si: estMursN, options: ouiNon() },
      { t: 'lignes', cle: 'lots', lib: 'Les lots', ic: 'lots', un: 'Lot', max: 40, large: true, si: estCopro, icone: iconeLot, colonnes: [
        { cle: 'numero', lib: 'N° du lot', exemple: '64' },
        { cle: 'nature', lib: 'Ce que c’est', exemple: 'le local, un parking, une servitude de passage…' },
      ], aide: 'Un lot par ligne, tel que le titre de propriété les décrit.' },
      { t: 'titre', cle: 't-compo', lib: 'Ce que comprend le fonds', ic: 'sac', si: pourNature(['fonds']) },
      { t: 'cases', cle: 'composition', lib: 'Le fonds comprend', ic: 'sac', si: pourNature(['fonds']), options: COMPOSITION.map(c => ({ v: c.v, l: c.l, ic: c.ic })) },
      { t: 'texte', cle: 'compositionAutre', lib: 'Autre chose', ic: 'plus', large: true, si: pourNature(['fonds']), question: 'Autre chose dans le fonds ?', exemple: 'le droit de terrasse' },
      { t: 'titre', cle: 't-dispo', lib: 'La disponibilité et l’usage', ic: 'calendrier', si: pourNature(['location']) },
      { t: 'texte', cle: 'disponible', lib: 'Disponibilité', ic: 'calendrier', large: true, si: pourNature(['location']), exemple: 'Sera libre d’occupation début avril' },
      { t: 'choix', cle: 'usage', lib: 'Les biens seront loués', ic: 'sac', si: pourNature(['location']), options: [
        { v: 'commerce', l: 'À usage de commerce', ic: 'vitrine' }, { v: 'bureaux', l: 'À usage de bureaux', ic: 'bureau' },
        { v: 'activite', l: 'À usage d’activité', ic: 'outil' }, { v: 'professionnel', l: 'À usage professionnel', ic: 'balance' }, { v: 'mixte', l: 'Usage mixte', ic: 'lots' },
      ] },
      { t: 'zone', cle: 'activites', lib: 'Activités autorisées', ic: 'sac', large: true, si: pourNature(['location', 'cession_bail']), exemple: 'Tout commerce sauf restauration et nuisances' },
      { t: 'zone', cle: 'noteBien', lib: 'Une précision', ic: 'plume', large: true, question: 'Une précision sur les biens ?' },
    ],
  },
  {
    id: 'bail', titre: 'Le bail', court: 'Le bail', sous: 'Le bail qui sera signé, ou celui qui passe avec l’affaire.', ic: 'bail',
    vers: d => (estLoc(d) ? 'Conditions de la location' : 'Caractéristiques du bail'),
    champs: [
      { t: 'guide', cle: 'g-murs', si: pourNature(['murs']), titre: () => 'Des murs libres : pas de bail', points: () => [
        { ic: 'cle', x: 'Le mandat dit que les biens seront libres de toute occupation au jour de la vente. Loués ? Choisis « Murs occupés » à la première étape.' },
      ] },
      { t: 'choix', cle: 'bailType', lib: 'Le bail qui sera signé', ic: 'bail', si: pourNature(['location']), options: TYPES_BAIL },
      { t: 'choix', cle: 'bailType', lib: 'Le bail en cours', ic: 'bail', si: avecBailEnCours, options: TYPES_BAIL },
      { t: 'nombre', cle: 'bailDuree', lib: 'Sa durée', ic: 'chrono', unite: 'ans', si: pourNature(['location']), rapides: [3, 6, 9, 10, 12] },
      { t: 'texte', cle: 'preneurNom', lib: 'Le locataire en place', ic: 'personne', large: true, si: pourNature(['murs_occupes']), exemple: 'la société LE COMPTOIR, qui y exploite un restaurant' },
      { t: 'date', cle: 'bailDebut', lib: 'Il a commencé le', ic: 'calendrier', si: avecBailEnCours },
      { t: 'date', cle: 'bailFin', lib: 'Il finit le', ic: 'drapeau', si: avecBailEnCours },
      { t: 'euros', cle: 'loyerAn', lib: 'Loyer annuel du bail', ic: 'euro', unite: '€ HT HC / an', si: avecBailEnCours, aide: 'Hors taxes et hors charges.' },
      { t: 'choix', cle: 'indexation', lib: 'Indexation du loyer', ic: 'courbe', si: d => !pourNature(['murs'])(d), options: INDICES },
      { t: 'choix', cle: 'tvaLoyer', lib: 'Le loyer est-il soumis à la TVA ?', ic: 'fiscal', si: d => !pourNature(['murs'])(d), options: [
        { v: 'oui', l: 'Oui', ic: 'check' }, { v: 'non', l: 'Non', ic: 'croix' }, { v: 'sansobjet', l: 'Sans objet', ic: 'points' },
      ] },
      { t: 'euros', cle: 'chargesAn', lib: 'Provision sur charges', ic: 'lots', unite: '€ HT / an', si: d => !pourNature(['murs'])(d) },
      { t: 'euros', cle: 'taxeFonciere', lib: 'Taxe foncière', ic: 'fiscal', unite: '€ / an', si: d => !pourNature(['murs'])(d), question: 'Préciser la taxe foncière ?' },
      { t: 'choix', cle: 'tfRefacturee', lib: 'Elle est', ic: 'fiscal', si: d => !pourNature(['murs'])(d) && num(d, 'taxeFonciere') !== null, options: [
        { v: 'oui', l: 'Remboursée par le preneur', ic: 'personne' }, { v: 'non', l: 'À la charge du bailleur', ic: 'immeuble' },
      ] },
      { t: 'nombre', cle: 'depotMois', lib: 'Dépôt de garantie', ic: 'banque', unite: 'mois de loyer', si: d => !pourNature(['murs'])(d), rapides: [3, 6] },
      { t: 'euros', cle: 'droitEntree', lib: 'Droit d’entrée', ic: 'cle', unite: '€ HT', si: pourNature(['location']), question: 'Un droit d’entrée (pas-de-porte) ?' },
      { t: 'texte', cle: 'franchise', lib: 'Franchise', ic: 'calendrier', large: true, si: pourNature(['location']), question: 'Une franchise de loyer ?', exemple: 'deux mois de loyer, à l’entrée dans les lieux' },
      { t: 'zone', cle: 'conditionCession', lib: 'La condition', ic: 'balance', large: true, si: pourNature(['cession_bail', 'fonds']), question: 'Le bail met-il une condition à sa cession ?',
        exemple: 'Agrément préalable du bailleur, appelé à l’acte de cession' },
      { t: 'zone', cle: 'noteBail', lib: 'Une précision', ic: 'plume', large: true, si: d => !pourNature(['murs'])(d), question: 'Une précision sur le bail ?' },
    ],
  },
  {
    id: 'prix', titre: 'Le montant et les honoraires', court: 'Honoraires', sous: 'Ce que tu annonces, qui paie tes honoraires, et combien.', vers: d => (estLoc(d) ? 'Rémunération du mandataire' : motsDe(d).prix), reperesApres: 'honoNote', ic: 'euro',
    champs: [
      { t: 'euros', cle: 'montant', lib: 'Loyer annuel HT HC', ic: 'etiquette', unite: '€ HT HC / an', requis: true, si: pourNature(['location']), aide: 'Hors taxes et hors charges. Le mandat écrit aussi le loyer mensuel.' },
      { t: 'euros', cle: 'montant', lib: 'Prix du droit au bail', ic: 'etiquette', requis: true, si: pourNature(['cession_bail']), aide: 'Ce que le cessionnaire paie au cédant, hors droits et frais. Sans tes honoraires quand il les paie en plus.' },
      { t: 'euros', cle: 'montant', lib: 'Prix du fonds', ic: 'etiquette', requis: true, si: pourNature(['fonds']), aide: 'Hors stock. Sans tes honoraires quand le cessionnaire les paie en plus.' },
      { t: 'euros', cle: 'montant', lib: 'Prix de vente', ic: 'etiquette', requis: true, si: estMursN, aide: 'Sans tes honoraires quand l’acquéreur les paie en plus.' },
      { t: 'choix', cle: 'charge', lib: 'Tes honoraires sont à la charge…', ic: 'euro', tuiles: true, si: pourNature(['location']), options: [
        { v: 'acquereur', l: 'Du preneur', aide: 'Il les paie à la signature du bail.', ic: 'cle' },
        { v: 'vendeur', l: 'Du bailleur', aide: 'Le mandant.', ic: 'immeuble' },
      ] },
      { t: 'choix', cle: 'charge', lib: 'Tes honoraires sont à la charge…', ic: 'euro', tuiles: true, si: d => !estLoc(d), options: [
        { v: 'acquereur', l: 'De l’acquéreur', aide: 'En plus du prix : il paie le prix et tes honoraires.', ic: 'cle' },
        { v: 'vendeur', l: 'Du mandant', aide: 'Prélevés sur le prix, le jour de l’acte.', ic: 'immeuble' },
      ] },
      { t: 'choix', cle: 'honoMode', lib: 'Tes honoraires', ic: 'euro', options: HONO_MODES },
      ...champsBaseHono(),
      ...selonBase({ t: 'nombre', cle: 'taux', lib: 'Taux', ic: 'pourcent', si: d => d.honoMode !== 'forfait' && estLoc(d) }, b => `% ${b} du loyer annuel`),
      ...selonBase({ t: 'nombre', cle: 'taux', lib: 'Taux', ic: 'pourcent', si: d => d.honoMode !== 'forfait' && !estLoc(d) }, b => `% ${b} du prix`),
      ...selonBase({ t: 'euros', cle: 'forfait', lib: 'Forfait', ic: 'euro', si: d => d.honoMode === 'forfait' }, b => `€ ${b}`),
      { t: 'choix', cle: 'semiDirect', lib: 'S’il traite lui-même, en direct', ic: 'bouclier', si: d => d.type === 'semi', options: [
        { v: 'aucun', l: 'Aucun honoraire', ic: 'ouvert' }, { v: 'reduits', l: 'Des honoraires réduits', ic: 'pourcent' },
      ] },
      ...selonBase({ t: 'euros', cle: 'semiMontant', lib: 'Honoraires réduits', ic: 'euro', si: d => d.type === 'semi' && d.semiDirect === 'reduits' }, b => `€ ${b}`),
      { t: 'zone', cle: 'honoNote', lib: 'Précision sur les honoraires', ic: 'plume', large: true, question: 'Une précision sur les honoraires ?',
        aide: 'Imprimée juste sous les honoraires. Par exemple : un partage entre le preneur et le bailleur. Une ligne par paragraphe.' },
    ],
  },
  {
    id: 'duree', titre: 'La durée', court: 'Durée', sous: 'Combien de temps, et ce qui se passe à son terme.', vers: 'Durée du mandat', ic: 'calendrier',
    champs: [
      { t: 'nombre', cle: 'duree', lib: 'Durée initiale', ic: 'chrono', unite: 'mois', requis: true, rapides: [3, 6, 9, 12] },
      { t: 'choix', cle: 'dureeMode', lib: 'À son terme', ic: 'drapeau', tuiles: true, options: [
        { v: 'fixe', l: 'Il prend fin', aide: 'Sans suite : vous en signez un autre si besoin.', ic: 'drapeau' },
        { v: 'prorogation', l: 'Il se poursuit', aide: 'Par périodes, jusqu’à une limite totale.', ic: 'boucle' },
      ] },
      { t: 'nombre', cle: 'periode', lib: 'Par périodes de', ic: 'boucle', unite: 'mois', si: d => d.dureeMode === 'prorogation', rapides: [3, 6] },
      { t: 'nombre', cle: 'dureeMax', lib: 'Dans la limite de', ic: 'drapeau', unite: 'mois au total', si: d => d.dureeMode === 'prorogation', rapides: [6, 9, 12] },
      { t: 'guide', cle: 'g-duree', si: d => d.dureeMode === 'prorogation', titre: () => 'Comment le mandat l’écrit', points: d => {
        const duree = num(d, 'duree') ?? 3, periode = num(d, 'periode') ?? 3, max = num(d, 'dureeMax') ?? 6;
        return [
          duree + periode === max
            ? { ic: 'boucle', x: `${duree} mois, puis prorogé une seule fois de ${periode} mois : il prend fin au bout de ${max} mois, comme ton mandat de location.` }
            : { ic: 'boucle', x: `${duree} mois, puis tacite reconduction par périodes de ${periode} mois, sans dépasser ${max} mois au total, comme tes mandats de vente et de cession.` },
          { ic: 'balance', x: 'Le rappel de l’article 78 est imprimé dessous, en capitales : passé trois mois, chacun peut y mettre fin avec quinze jours de préavis par recommandé.' },
        ];
      } },
      { t: 'date', cle: 'effet', lib: 'Il prend effet le', ic: 'calendrier', question: 'Il prend effet à une autre date que sa signature ?' },
    ],
  },
  {
    id: 'engagements', titre: 'Engagements et clauses', court: 'Engagements', sous: 'Ce que tu fais, ce que le mandant promet, et les clauses en plus.', vers: 'Actions commerciales', ic: 'etoile',
    champs: [
      { t: 'cases', cle: 'actions', lib: 'Tes actions commerciales, à tes frais', ic: 'etoile', options: ACTIONS.map(a => ({ v: a.v, l: a.l, ic: a.ic })) },
      { t: 'zone', cle: 'actionsAutres', lib: 'Tu t’engages en outre à', ic: 'plus', large: true, question: 'Autre chose que tu t’engages à faire ?', exemple: 'Proposer les locaux aux enseignes de mon portefeuille' },
      { t: 'choix', cle: 'rythme', lib: 'Tes comptes rendus', ic: 'horloge', options: Object.entries(RYTHMES).map(([v, l]) => ({ v, l: l.charAt(0).toUpperCase() + l.slice(1), ic: IC_RYTHME[v] })) },
      { t: 'cases', cle: 'pouvoirs', lib: 'Il t’autorise aussi à', ic: 'cle', options: [
        { v: 'delegation', l: 'Déléguer à un confrère', ic: 'accord' },
        { v: 'redaction', l: 'Rédiger l’acte sous seing privé', ic: 'plume' },
        { v: 'cles', l: 'Détenir les clés', ic: 'cle' },
      ], aide: '« Rédiger l’acte » : le bail d’une location, l’avant-contrat d’une vente, et recueillir les signatures.' },
      { t: 'titre', cle: 't-mandant', lib: 'Ce que le mandant promet', ic: 'personne' },
      { t: 'nombre', cle: 'delaiDocs', lib: 'Il te remet les documents sous', ic: 'doc', unite: 'jours', rapides: [8, 15] },
      { t: 'nombre', cle: 'delaiReponse', lib: 'Il répond à une proposition sous', ic: 'horloge', unite: 'jours', rapides: [8, 15] },
      { t: 'nombre', cle: 'suite', lib: 'Pas de traité en direct avec une personne présentée : pendant le mandat et', ic: 'chrono', unite: 'mois après', requis: true, rapides: [6, 12],
        aide: 'Douze mois dans tes mandats, au plus. Au-delà, plus rien n’est dû.' },
      { t: 'zone', cle: 'clause', lib: 'Clauses particulières', ic: 'plume', large: true, question: 'Ajouter une clause particulière ?',
        aide: 'Imprimées telles quelles, avant les signatures. Une ligne par paragraphe : chaque ligne devient un paragraphe.' },
    ],
  },
  {
    id: 'signature', titre: 'La signature', court: 'Signature', sous: 'Comment, où, et le numéro du registre.', vers: 'Date et signatures', ic: 'plume',
    champs: [
      CHAMP_SIGNATURE,
      { t: 'choix', cle: 'lieu', lib: 'Où sera-t-il signé ?', ic: 'lieu', tuiles: true, si: d => modeSignature(d) !== 'en_ligne', options: [
        { v: 'agence', l: 'À l’agence', ic: 'agence' }, { v: 'domicile', l: 'Chez le mandant', ic: 'immeuble' }, { v: 'distance', l: 'À distance', ic: 'ecran' },
      ], aide: 'Avec un mandant qui relève des règles du consommateur, hors de l’agence ou à distance : 14 jours de rétractation, avec le formulaire.' },
      { t: 'choix', cle: 'execution', lib: 'Commencer avant la fin des 14 jours ?', ic: 'eclair', si: d => retractation(d), options: [
        { v: 'oui', l: 'Oui, il le demande', ic: 'eclair' }, { v: 'non', l: 'Non, il attend', ic: 'horloge' }, { v: '', l: 'Il cochera sur place', ic: 'plume' },
      ], aide: 'En ligne ou sur place, « Oui » lui fait cocher lui-même une case à part en signant : c’est sa demande expresse.' },
      { t: 'choix', cle: 'infoJointe', lib: 'L’information avant de signer', ic: 'info', si: conso, options: [
        { v: 'oui', l: 'Jointe au mandat', ic: 'trombone' }, { v: 'non', l: 'Remise à part', ic: 'envoyer' },
      ] },
      { t: 'choix', cle: 'rgpd', lib: 'Ses données pour ta prospection', ic: 'cadenas', options: [
        { v: 'oui', l: 'Il accepte', ic: 'check' }, { v: 'non', l: 'Il refuse', ic: 'croix' }, { v: '', l: 'Il cochera lui-même', ic: 'plume' },
      ], aide: 'La case de ton mandat : « En cochant cette case, le MANDANT l’accepte expressément ». En ligne, choisis pour lui ce qu’il t’a dit.' },
      { t: 'titre', cle: 't-registre', lib: 'Le registre et la date', ic: 'livre' },
      { t: 'texte', cle: 'numero', lib: 'N° du registre des mandats', ic: 'livre', requis: true, aide: 'Il doit figurer sur le mandat avant la signature.' },
      { t: 'texte', cle: 'faitA', lib: 'Fait à', ic: 'lieu', requis: true },
      { t: 'date', cle: 'date', lib: 'Le', ic: 'calendrier', requis: true },
    ],
  },
];

/* ══ Le texte ═══════════════════════════════════════════════════════════ */
const fin = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`);
const mois = (n: number) => `${nbLettres(n)} mois`;
/* « douze mille euros HT (12 000 € HT) » */
const montantLettres = (n: number, suffixe = '') => `${enLettres(n)} euros${suffixe ? ` ${suffixe}` : ''} (${euros(n)}${suffixe ? ` ${suffixe}` : ''})`;

function ficheMandataire(A: IdentiteAgence): Fiche {
  const rep = A.representantLegal ? `, représentée par ${A.representantLegal}` : '';
  return {
    ic: 'agence', titre: A.societe.toUpperCase(),
    lignes: [
      `${A.forme}, dont le siège est situé ${A.siege}, ${A.rcs}${rep}.`,
      `Titulaire de la carte professionnelle « ${A.carteMention} » n° ${A.carte}, délivrée par ${A.carteDelivree}${A.tva ? ` ; TVA ${A.tva}` : ''}.`,
      `Assurée en responsabilité civile professionnelle par ${A.assureur}${A.assureurAdresse ? `, ${A.assureurAdresse}` : ''}, sous le n° ${A.police}.`,
      `Régulièrement représentée par ${A.signataireNom}, ${A.signataireQualite}, ayant tous pouvoirs à l’effet des présentes.`,
      `${A.nom} · ${A.adresse}, ${A.cp} ${A.ville} · ${A.tel} · ${A.mail}`,
    ],
    note: A.fonds === 'garantie'
      ? `Garantie financière : ${A.garant}${A.garantAdresse ? `, ${A.garantAdresse}` : ''}, pour ${A.garantMontant}.`
      : MAJ('Déclarant ne pouvoir ni recevoir ni détenir d’autres fonds, effets ou valeurs que ceux représentatifs de sa rémunération.'),
    pied: 'Ci-après « l’Agence » ou « le MANDATAIRE »',
  };
}

function rediger(d: Donnees, A: IdentiteAgence): Partie[] {
  const type = typeDe(d);
  const T = TYPES[type];
  const nat = natureMandat(d);
  const M = MOTS[nat];
  const loc = nat === 'location';
  const vs = vendeursDe(d);
  const a = argent(d);
  const retr = retractation(d);
  const actions = liste(d, 'actions');
  const pouvoirs = liste(d, 'pouvoirs');
  const suite = num(d, 'suite') ?? 12;
  const duree = num(d, 'duree') ?? 3;
  const periode = num(d, 'periode') ?? 3;
  const dureeMax = num(d, 'dureeMax') ?? 6;
  const numero = txt(d, 'numero');
  const adresse = [txt(d, 'adresse'), [txt(d, 'cp'), txt(d, 'ville')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const A_ = M.autre;

  /* ── Les parties ── */
  const fiches: Fiche[] = [];
  if (d.qui === 'sci') {
    const g = vs[0];
    fiches.push({ ic: 'agence', titre: (txt(d, 'sciNom') || 'La société').toUpperCase(), lignes: [
      txt(d, 'sciForme'), txt(d, 'sciSiege') ? `Dont le siège social est situé ${txt(d, 'sciSiege')}` : '', txt(d, 'sciRcs') ? `Immatriculée au ${txt(d, 'sciRcs')}` : '',
      `Représentée par ${nomComplet(g)}${txt(d, 'sciPouvoir') ? `, agissant en qualité de ${txt(d, 'sciPouvoir')}` : ''}, ayant tous pouvoirs à l’effet des présentes.`,
      txt(d, 'pourCompte') ? fin(txt(d, 'pourCompte').charAt(0).toUpperCase() + txt(d, 'pourCompte').slice(1)) : '',
      [g.telephone, g.email].filter(Boolean).join(' · '),
    ].filter(Boolean), pied: 'Ci-après « le MANDANT »' });
  } else {
    vs.forEach((p, i) => {
      const f = fichePersonne(p, 'personne', vs.length > 1 ? (i === vs.length - 1 ? 'Ci-après ensemble « le MANDANT », agissant solidairement' : undefined) : 'Ci-après « le MANDANT »');
      fiches.push(i === 0 && txt(d, 'persoPro') ? { ...f, lignes: [...f.lignes.filter(l => !/à compléter/.test(l)), fin(txt(d, 'persoPro').charAt(0).toUpperCase() + txt(d, 'persoPro').slice(1))] } : f);
    });
  }
  fiches.push(ficheMandataire(A));
  const entre: Bloc[] = [{ t: 'fiches', items: fiches }, ...paragraphes(txt(d, 'noteVendeurs'), 'Précision : ')];

  /* ── L'objet ── */
  const objet: Bloc[] = [
    P(`Par les présentes, le MANDANT confère au MANDATAIRE, qui l’accepte, le MANDAT ${T.maj} ${M.objet}.`, true),
  ];
  if (type === 'exclusif') objet.push(P(MAJ(`Clause d’exclusivité : pendant toute la durée du mandat, le MANDANT s’interdit de ${M.verbe} ${M.laChose}, directement ou par l’intermédiaire de tout autre mandataire. Il s’engage à adresser au MANDATAIRE toute personne qui le contacterait, directement ou par un tiers, et à lui transmettre toute proposition reçue.`), true));
  if (type === 'semi') objet.push(P(MAJ(`Clause de semi-exclusivité : pendant toute la durée du mandat, le MANDANT s’interdit de confier ${M.operation} à un autre intermédiaire. Il reste libre de traiter lui-même, directement, avec une personne qui ne lui a été présentée par aucun intermédiaire ; il en informe alors aussitôt le MANDATAIRE par écrit.`), true));

  /* ── La désignation ── */
  const desig: Bloc[] = [];
  if (nat === 'fonds') {
    desig.push(P(fin(txt(d, 'activite') || 'Un fonds de commerce, à désigner'), true));
    desig.push(...paragraphes(txt(d, 'description')));
    desig.push(P(`Exploité ${adresse ? `${adresse}` : 'à l’adresse à compléter'}.`));
    const compo = COMPOSITION.filter(c => liste(d, 'composition').includes(c.v)).map(c => c.x);
    if (txt(d, 'compositionAutre')) compo.push(txt(d, 'compositionAutre').charAt(0).toUpperCase() + txt(d, 'compositionAutre').slice(1));
    if (compo.length) desig.push(P('Le fonds comprend :'), { t: 'coches', items: compo });
  } else if (nat === 'cession_bail') {
    desig.push(P(`Désignation des locaux : ${adresse || 'adresse à compléter'}.`, true));
    desig.push(...(txt(d, 'description') ? paragraphes(txt(d, 'description')) : [P('Description à compléter.')]));
  } else {
    desig.push(P(`Adresse : ${adresse || 'à compléter'}.`, true));
    if (estCopro(d)) {
      const lots = lignes(d, 'lots');
      desig.push(P(`Les biens sont compris dans un ensemble immobilier soumis à la loi du 10 juillet 1965 fixant le statut de la copropriété${lots.length ? `, dont ils constituent ${lots.length > 1 ? 'les lots' : 'le lot'} :` : '.'}`));
      if (lots.length) desig.push({ t: 'l', items: lots.map(l => `Lot n° ${l.numero || '…'}${l.nature ? ` : ${l.nature}` : ''}.`) });
    }
    desig.push(P('Description :'));
    desig.push(...(txt(d, 'description') ? paragraphes(txt(d, 'description')) : [P('À compléter.')]));
    if (loc) {
      if (txt(d, 'disponible')) desig.push(P(`Disponibilité : ${fin(txt(d, 'disponible').charAt(0).toLowerCase() + txt(d, 'disponible').slice(1))}`));
      desig.push(P(`Destination : les biens seront loués ${USAGES[String(d.usage)] || USAGES.commerce}.`));
    }
    if (nat === 'murs') desig.push(P('État d’occupation : le MANDANT déclare que les biens à vendre seront libres de tout titre locatif ou occupation au jour du transfert de jouissance.'));
  }
  if ((loc || nat === 'cession_bail') && txt(d, 'activites')) desig.push(P(`Activité(s) autorisée(s) : ${fin(txt(d, 'activites'))}`));
  desig.push(...paragraphes(txt(d, 'noteBien'), 'Précision : '));

  /* ── Le bail : celui qui sera signé, ou celui qui passe avec l'affaire ── */
  const bail: Bloc[] = [];
  const loyerAn = loc ? a.montant : num(d, 'loyerAn');
  const ligneTva = d.tvaLoyer === 'oui' ? 'le loyer est soumis à la TVA' : d.tvaLoyer === 'non' ? 'le loyer n’est pas soumis à la TVA' : 'sans objet';
  const chargesAn = num(d, 'chargesAn');
  const tf = num(d, 'taxeFonciere');
  const depot = num(d, 'depotMois');
  const indice = INDICES_TEXTE[String(d.indexation)];
  if (loc) {
    const regime = REGIMES_BAIL[String(d.bailType)] || REGIMES_BAIL.commercial;
    const ans = num(d, 'bailDuree') ?? (d.bailType === 'derogatoire' ? 3 : d.bailType === 'professionnel' ? 6 : 9);
    bail.push(P(`Régime juridique : ${regime.charAt(0).toLowerCase()}${regime.slice(1)}`));
    bail.push(P(`Durée du bail : le bail sera consenti pour une durée initiale de ${nbLettres(ans)} ans${d.bailType === 'commercial' || !d.bailType ? ', le preneur pouvant y mettre fin à l’expiration de chaque période triennale' : ''}.`));
    bail.push(P(loyerAn
      ? `Loyer : ${montantLettres(loyerAn, 'HT HC')} par an, soit ${euros(Math.round(loyerAn / 12))} HT HC par mois.`
      : 'Loyer : à compléter.', true));
  } else {
    if (nat === 'murs_occupes') bail.push(P(`Les biens sont vendus occupés${txt(d, 'preneurNom') ? `, loués à ${txt(d, 'preneurNom')}` : ''} ; le bail en cours se poursuivra avec l’acquéreur.`, true));
    const tb = TYPES_BAIL.find(x => x.v === d.bailType);
    if (tb) bail.push(P(`Nature du bail : ${tb.l.charAt(0).toLowerCase()}${tb.l.slice(1)}.`));
    if (txt(d, 'bailDebut')) bail.push(P(`Date d’effet du bail : ${jourLong(txt(d, 'bailDebut'))}.`));
    bail.push(P(`Durée du bail restant à courir : ${txt(d, 'bailFin') ? `jusqu’au ${jourLong(txt(d, 'bailFin'))}` : 'à compléter'}.`));
    if (nat === 'cession_bail' && txt(d, 'activites')) bail.push(P(`Activité(s) autorisée(s) par le bail : ${fin(txt(d, 'activites'))}`));
    bail.push(P(loyerAn ? `Montant du loyer annuel : ${euros(loyerAn)} HT HC, soit ${euros(Math.round(loyerAn / 12))} HT HC par mois.` : 'Montant du loyer annuel : à compléter.'));
  }
  if (indice) bail.push(P(`Indexation du loyer : le montant du loyer sera révisé tous les ans en fonction de l’évolution ${indice}.`));
  else if (d.indexation === 'aucun') bail.push(P('Indexation du loyer : aucune.'));
  bail.push(P(`Fiscalité : ${ligneTva}.`));
  if (chargesAn) bail.push(P(`Charges : le montant ${loc ? 'initial ' : ''}de la provision sur charges est fixé à ${euros(chargesAn)} HT par an, soit ${euros(Math.round(chargesAn / 12))} HT par mois.`));
  if (tf) bail.push(P(`Taxe foncière : ${euros(tf)} par an${d.tfRefacturee === 'oui' ? ', remboursée par le preneur' : d.tfRefacturee === 'non' ? ', à la charge du bailleur' : ''}.`));
  if (depot) bail.push(P(`${loc ? 'Dépôt de garantie' : 'Garantie'} : ${nbLettres(depot)} mois de loyer${loyerAn ? `, soit ${euros(Math.round((loyerAn / 12) * depot))}` : ''}${loc ? '' : ' (dépôt de garantie)'}.`));
  if (loc && num(d, 'droitEntree')) bail.push(P(`Droit d’entrée : ${euros(num(d, 'droitEntree') || 0)} HT, versé au bailleur à la signature du bail.`));
  if (loc && txt(d, 'franchise')) bail.push(P(`Franchise de loyer : ${fin(txt(d, 'franchise'))}`));
  if (txt(d, 'conditionCession')) bail.push(P(`Condition prévue par le bail pour sa cession : ${fin(txt(d, 'conditionCession'))}`));
  if (nat === 'murs_occupes' && (d.bailType === 'commercial' || !d.bailType)) bail.push(P('Le MANDANT est informé que le preneur d’un local à usage commercial ou artisanal bénéficie, en cas de vente, d’un droit de préférence (article L145-46-1 du Code de commerce) : la vente devra lui être notifiée avant d’être conclue avec un tiers.'));
  bail.push(...paragraphes(txt(d, 'noteBail'), 'Précision : '));

  /* ── Le prix (une cession ou une vente) ── */
  const prix: Bloc[] = [];
  if (!loc) {
    const m = a.montant;
    if (nat === 'cession_bail') {
      prix.push(P(m ? `Le droit au bail devra être présenté au prix de ${montantLettres(m)}.` : 'Le prix du droit au bail : à compléter.', true));
      prix.push(P('Ce prix s’entend hors droits et hors frais, payables par l’acquéreur au plus tard le jour de la signature de l’acte de cession.'));
      prix.push(P('Le prix sera réglé comptant au plus tard le jour de la signature de l’acte de cession.'));
    } else if (nat === 'fonds') {
      prix.push(P(m ? `Le prix du fonds est de ${montantLettres(m)}.` : 'Le prix du fonds : à compléter.', true));
      if (liste(d, 'composition').includes('stocks')) prix.push(P('Les stocks ne sont pas compris dans ce prix : ils seront évalués amiablement au jour de la cession définitive.'));
      prix.push(P('L’éventuelle ventilation entre les éléments corporels et incorporels sera précisée dans l’acte de cession.'));
      prix.push(P('Le prix sera réglé comptant au plus tard le jour de la signature de l’acte de cession.'));
    } else {
      prix.push(P(m ? `Le prix de vente est de ${montantLettres(m)}.` : 'Le prix de vente : à compléter.', true));
      prix.push(P('Le prix sera réglé comptant au plus tard le jour de la signature de l’acte définitif de vente.'));
      prix.push(P('Le MANDANT est informé qu’il pourra le cas échéant être assujetti à l’impôt sur les plus-values immobilières.'));
    }
    prix.push(P('Le prix ne peut être modifié que d’un commun accord, par avenant écrit signé des parties.'));
  }

  /* ── La rémunération ── */
  const hono: Bloc[] = [];
  const h = a.honoraires;
  const baseTaux = loc ? 'du loyer annuel HT HC' : 'du prix';
  const combien = h !== null
    ? `${montantHono(d, h, true)}${a.forfait === null && a.taux !== null ? `, représentant ${tauxHono(d, a.taux)} ${baseTaux}` : ''}`
    : a.taux !== null ? `${tauxHono(d, a.taux)} ${baseTaux}` : 'à préciser';
  const payeur = a.charge === 'acquereur' ? `au ${A_}` : 'au MANDANT';
  hono.push(P(`En cas de réalisation de l’opération, le MANDATAIRE aura droit à des honoraires d’un montant de ${combien}.`, true));
  hono.push(P(`Le paiement de ces honoraires incombera ${payeur}.${!loc && a.charge === 'acquereur' ? ` Les honoraires à la charge du ${A_} ne sont pas inclus dans le prix indiqué ci-dessus.` : ''}${!loc && a.charge === 'vendeur' ? ' Ils sont compris dans le prix indiqué ci-dessus et seront prélevés sur celui-ci le jour de l’acte.' : ''}`));
  if (!loc && a.charge === 'acquereur' && a.prix && h !== null) hono.push(Pp(`Soit un montant affiché, honoraires compris, de ${euros(a.prix)}.`));
  if (a.forfait === null && a.taux !== null) hono.push(P(`Si l’opération se conclut à d’autres conditions, les honoraires sont calculés de la même façon, au même taux, ${loc ? 'sur le loyer annuel HT HC' : 'sur le prix'} effectivement convenu.`));
  hono.push(...paragraphes(txt(d, 'honoNote')));
  hono.push(P(`Le montant de ces honoraires sera payable à la conclusion effective ${loc ? 'du bail' : 'de l’opération constatée dans un seul acte écrit'}. Le taux de TVA appliqué aux honoraires sera le taux en vigueur à la date de leur exigibilité. Aucune somme n’est due au MANDATAIRE avant que l’opération ne soit effectivement conclue (article 6 de la loi du 2 janvier 1970).`));
  if (loc) hono.push(P('Si le présent mandat porte sur la location de plusieurs biens distincts, il est convenu que les honoraires dus au MANDATAIRE seront exigibles dès que la location de l’un d’entre eux aura été effectivement conclue et constatée dans un seul acte écrit contenant l’engagement des parties.'));
  else hono.push(P(`En cas d’exercice d’un droit de préemption ou d’une faculté de substitution, son bénéficiaire sera subrogé dans tous les droits et obligations du ${A_}. À ce titre, il sera notamment tenu de régler ces honoraires si leur paiement lui incombe.`));
  if (type === 'semi') hono.push(P(d.semiDirect === 'reduits' && num(d, 'semiMontant')
    ? `Si le MANDANT traite lui-même, directement, avec une personne qui ne lui a été présentée par aucun intermédiaire, les honoraires sont ramenés à ${montantHono(d, num(d, 'semiMontant') || 0)}.`
    : 'Si le MANDANT traite lui-même, directement, avec une personne qui ne lui a été présentée par aucun intermédiaire, aucun honoraire n’est dû.'));
  hono.push(P(`${pouvoirs.includes('redaction') ? 'Dans l’hypothèse où le MANDATAIRE ne serait pas le rédacteur des actes, le' : 'Le'} MANDANT se porte fort de mentionner la rémunération du MANDATAIRE et ses modalités de paiement dans l’acte constatant ${M.operation} objet des présentes, et il s’engage à remettre au MANDATAIRE une copie de cet acte ou un courrier reprenant les principales caractéristiques de l’opération.`));

  /* ── La durée ── */
  const dur: Bloc[] = [];
  const effet = txt(d, 'effet');
  const prorogeUneFois = d.dureeMode === 'prorogation' && duree + periode === dureeMax;
  if (d.dureeMode === 'prorogation' && prorogeUneFois) {
    dur.push(P(`Le présent MANDAT ${T.maj}${effet ? `, qui prendra effet le ${jourLong(effet)},` : ''} est consenti pour une durée de ${mois(duree)}. À l’issue de cette période initiale, il sera prorogé pour une durée de ${mois(periode)}, au terme de laquelle il prendra automatiquement fin.`, true));
  } else if (d.dureeMode === 'prorogation') {
    dur.push(P(`Le présent MANDAT ${T.maj}${effet ? `, qui prendra effet le ${jourLong(effet)},` : ''} est consenti pour une durée de ${mois(duree)}. À l’issue de sa durée initiale, il se renouvellera par tacite reconduction, par périodes de ${mois(periode)}, sans que la durée totale du mandat ne puisse dépasser au total ${mois(dureeMax)} à compter de la date de sa signature.`, true));
    dur.push(P('Chaque partie peut s’opposer à cette reconduction par écrit, au plus tard la veille de l’échéance ; le mandat prend alors fin à l’échéance.'));
    if (conso(d)) dur.push(P('Avant chaque échéance, au plus tôt trois mois et au plus tard un mois avant, le MANDATAIRE rappelle par écrit au MANDANT qu’il peut ne pas reconduire le mandat (article L215-1 du Code de la consommation, reproduit en annexe avec les articles L215-1-1 à L215-3 et L241-3).'));
  } else {
    dur.push(P(`Le présent MANDAT ${T.maj}${effet ? `, qui prendra effet le ${jourLong(effet)},` : ''} est consenti pour une durée de ${mois(duree)}. Il prendra fin de plein droit à son terme, sans reconduction.`, true));
  }
  dur.push(P(MAJ('Il est rappelé qu’aux termes du deuxième alinéa de l’article 78 du décret du 20 juillet 1972, passé un délai de trois mois à compter de sa signature, le présent mandat peut être dénoncé à tout moment par chacune des parties, à charge pour celle qui entend y mettre fin d’en aviser l’autre partie quinze jours au moins à l’avance par lettre recommandée avec demande d’avis de réception.'), true));
  dur.push(P('Le présent mandat ne peut être dénoncé qu’en totalité et en aucun cas partiellement.'));
  if (!effet) dur.push(P('Le présent mandat prend effet à compter de sa signature.'));

  /* ── Le mandant : ses déclarations, ses engagements, ses interdictions ── */
  const delaiDocs = num(d, 'delaiDocs');
  const delaiRep = num(d, 'delaiReponse');
  const mandant: Bloc[] = [
    P(`Le MANDANT déclare, sous sa propre responsabilité :`),
    { t: 'l', items: [
      type === 'simple'
        ? `ne pas avoir consenti de mandat exclusif portant sur ${M.laChose}, non expiré ou non dénoncé, et s’interdire de consentir un mandat exclusif pendant la durée des présentes sans avoir préalablement dénoncé le présent mandat ;`
        : `ne pas avoir consenti à un autre intermédiaire de mandat portant sur ${M.laChose}, non expiré ou non dénoncé ;`,
      `avoir la capacité juridique de disposer ${nat === 'cession_bail' ? 'du droit au bail' : nat === 'fonds' ? 'du fonds' : 'desdits biens'} et ne faire l’objet d’aucune mesure restreignant sa capacité à agir (tutelle, curatelle, etc.) ;`,
      'ne faire l’objet d’aucune procédure collective, de redressement ou de liquidation judiciaire ;',
      `qu’aucune restriction ne s’oppose à ${M.operation} objet du présent mandat${estMursN(d) || loc ? ', et notamment que les biens ne font l’objet d’aucune procédure de saisie immobilière' : ''}.`,
    ] },
    P('En conséquence du présent mandat, le MANDANT autorise le MANDATAIRE à :'),
    { t: 'l', items: [
      `présenter${nat === 'cession_bail' || nat === 'fonds' ? ` ${M.laChose}` : ' et faire visiter les biens'} à toutes les personnes qu’il jugera susceptibles d’être intéressées ;`,
      'entreprendre toutes les actions de communication qu’il jugera utiles ;',
      `communiquer tout élément relatif à ${M.operation} à toute personne intéressée ;`,
      ...(estMursN(d) ? ['réclamer auprès de toutes personnes publiques ou privées toutes les pièces justificatives concernant les biens à vendre ;', 'en cas d’exercice d’un droit de préemption, négocier avec le bénéficiaire de ce droit ;'] : []),
      ...(pouvoirs.includes('cles') ? ['détenir les clés des locaux pour les visites, contre récépissé ;'] : []),
      ...(pouvoirs.includes('delegation') ? ['déléguer tout ou partie des pouvoirs qui lui sont conférés par le présent mandat à un autre professionnel titulaire de la carte « Transactions sur immeubles et fonds de commerce », dont il reste responsable envers le MANDANT (article 1994 du Code civil).'] : ['faire appel, en tant que de besoin et sous sa responsabilité, à tout concours extérieur utile.']),
    ] },
    P('Le MANDANT s’engage à :'),
    { t: 'l', items: [
      `permettre au MANDATAIRE d’effectuer les visites${nat === 'fonds' ? ' des locaux dépendant du fonds' : ''}, étant précisé qu’en sa qualité de seul gardien, le MANDANT prendra toutes les dispositions pour en assurer la bonne conservation et souscrire toute assurance qu’il estime nécessaire ;`,
      `remettre à ses frais au MANDATAIRE${delaiDocs ? `, au plus tard dans les ${nbLettres(delaiDocs)} jours de la signature du présent mandat,` : ''} ${M.pieces} ;`,
      `informer sans délai le MANDATAIRE de toutes modifications tant juridiques que matérielles susceptibles d’affecter ${nat === 'cession_bail' ? 'le droit au bail' : nat === 'fonds' ? 'le fonds' : 'les biens'} ;`,
      `répondre ${delaiRep ? `dans un délai maximum de ${nbLettres(delaiRep)} jours` : 'à bref délai'} à toute proposition transmise par le MANDATAIRE ;`,
      `s’il accepte une offre, signe tout contrat préparatoire ou conclut ${M.operation} sans l’intermédiaire du MANDATAIRE, l’en informer immédiatement et lui communiquer les coordonnées de l’offrant ou du ${M.autreMin}, les conditions de l’opération, les nom et adresse du rédacteur de l’acte et, le cas échéant, de l’intermédiaire qui y aura concouru ;`,
      `si la rédaction de ${M.acte} est confiée à un tiers à la suite de l’intermédiation du MANDATAIRE, l’informer des date, heure et lieu de signature, afin de lui permettre d’être présent.`,
    ] },
    P('Le MANDANT s’engage à exécuter le présent mandat de bonne foi. Le MANDANT s’interdit de refuser de réaliser l’opération aux conditions convenues dans le présent MANDAT puis de conclure l’opération en privant le MANDATAIRE de la rémunération à laquelle il aurait pu légitimement prétendre.'),
    P(MAJ('En cas de manquement à cet engagement, le MANDANT s’oblige expressément et de manière irrévocable à verser au MANDATAIRE une somme égale au montant total, TVA incluse, de la rémunération prévue aux présentes et ce, à titre d’indemnité forfaitaire et définitive.'), true),
    P('Le MANDANT s’interdit :'),
    { t: 'l', items: [
      ...(type === 'exclusif' ? [`pendant toute la durée du mandat, de ${M.verbe} ${M.laChose} directement ou par l’intermédiaire de tout autre mandataire ;`] : []),
      ...(type === 'semi' ? [`pendant toute la durée du mandat, de confier ${M.operation} à un autre intermédiaire ;`] : []),
      `pendant la durée du mandat, de négocier directement ou indirectement ${M.operation} avec une personne présentée par le MANDATAIRE ;`,
      `pendant la durée du présent mandat et durant les ${nbLettres(suite)} mois suivant sa révocation ou son expiration, de traiter, directement ou indirectement, avec une personne physique ou morale à laquelle ${nat === 'cession_bail' ? 'ce droit au bail' : nat === 'fonds' ? 'ce fonds' : 'ces biens'} aura été présenté${nat === 'cession_bail' || nat === 'fonds' ? '' : 's'} par le MANDATAIRE, ou un mandataire qu’il se sera substitué, et dont l’identité aura été communiquée au MANDANT, ou avec une personne ayant un lien quelconque avec elle.`,
    ] },
    P(`Le MANDANT s’oblige, s’il conclut ${M.operation} pendant la durée du présent mandat ou durant ce même délai de ${nbLettres(suite)} mois suivant sa révocation ou son expiration, à communiquer immédiatement au MANDATAIRE, par téléphone ou par mail confirmé par lettre recommandée avec demande d’avis de réception, la date et les conditions de l’opération, les nom et adresse du ${M.autreMin} et, le cas échéant, de l’intermédiaire qui aura permis sa conclusion, ainsi que les coordonnées du rédacteur de l’acte.`),
    P(MAJ('En cas de manquement à l’une ou l’autre de ces interdictions ou obligations, le MANDANT s’oblige expressément et de manière irrévocable à verser au MANDATAIRE une somme égale au montant total, TVA incluse, de la rémunération prévue aux présentes et ce, à titre d’indemnité forfaitaire et définitive.'), true),
    Pp('Le juge peut modérer ou augmenter une indemnité manifestement excessive ou dérisoire (article 1231-5 du Code civil).'),
  ];

  /* ── Le mandataire ── */
  const mandataire: Bloc[] = [
    P('Tenu par une obligation de moyens et non de résultat, le MANDATAIRE entreprendra toute démarche et mettra en œuvre tous les moyens qu’il jugera utiles en vue de la réalisation de la mission confiée. Il pourra ou devra notamment :'),
    { t: 'l', items: [
      `faire tout ce qui sera nécessaire aux fins de parvenir à ${M.operation} ;`,
      'effectuer toute publicité et communication qu’il jugera utiles par tous moyens et supports ;',
      `prospecter, présenter et faire visiter les locaux${nat === 'fonds' ? ' dépendant du fonds' : ''} à la clientèle potentielle ;`,
      `informer le MANDANT des éléments pouvant influer sur ${M.operation} ;`,
      `assister le MANDANT lors de la négociation des conditions de ${M.operation} ;`,
      `apprécier la capacité juridique et la solvabilité des ${M.candidats}${pouvoirs.includes('redaction') ? ' ;' : '.'}`,
      ...(pouvoirs.includes('redaction') ? [loc
        ? 'établir tout acte sous seing privé, et notamment le bail, aux conditions du présent mandat, et recueillir la signature des parties.'
        : estMursN(d)
          ? 'établir tout acte sous seing privé aux clauses et conditions nécessaires à l’accomplissement des présentes, la vente pouvant être assortie d’une condition suspensive d’obtention de prêt, et recueillir la signature de l’acquéreur.'
          : 'établir tout acte sous seing privé aux clauses et conditions nécessaires à l’accomplissement des présentes, et recueillir la signature des parties.'] : []),
    ] },
    P('Le MANDATAIRE ne peut pas engager le MANDANT : l’opération ne sera conclue qu’avec son accord, sur un acte qu’il signera lui-même.'),
  ];

  /* ── Les actions et la reddition de comptes ── */
  const acts = ACTIONS.filter(x => actions.includes(x.v)).map(x => {
    const quoi = x.v === 'dossier' ? ` ${nat === 'cession_bail' ? 'du droit au bail' : nat === 'fonds' ? 'du fonds' : 'des biens'}` : x.v === 'photos' ? ` ${nat === 'fonds' ? 'du fonds' : 'des locaux'}` : '';
    return `${x.x}${quoi}`;
  });
  const actionsBlocs: Bloc[] = acts.length
    ? [P('Le MANDATAIRE s’engage à réaliser à ses frais les actions de communication suivantes :'), { t: 'coches', items: acts }]
    : [P('Le MANDATAIRE réalisera à ses frais les actions de communication qu’il jugera utiles.')];
  if (txt(d, 'actionsAutres')) actionsBlocs.push(P('Le MANDATAIRE s’engage en outre à :'), ...paragraphes(txt(d, 'actionsAutres')));
  const rythme = RYTHMES[String(d.rythme)] || RYTHMES.visite;
  const reddition: Bloc[] = [
    P(`Le MANDATAIRE s’engage à tenir informé le MANDANT du suivi de ses actions et à lui communiquer ${rythme} un compte rendu${d.rythme === 'visite' || !d.rythme ? ' mentionnant les observations éventuelles des prospects' : ' de ses actions et des visites, avec les observations éventuelles des prospects'}.`),
  ];

  /* ── Les informations ── */
  const infos: Bloc[] = [
    ...(numero ? [P(`Le présent mandat est inscrit sous le numéro ${numero} au registre des mandats du MANDATAIRE.`)] : [P('Numéro au registre des mandats : ……………')]),
    ...(conso(d) ? [P(`Le MANDANT reconnaît avoir reçu, avant de signer, l’information précontractuelle prévue par le Code de la consommation${retr ? ' et le formulaire de rétractation' : ''}${d.infoJointe === 'oui' ? `, qui forme${retr ? 'nt' : ''} la suite du présent document` : ''}.`)] : []),
    P('Informations Tracfin : le MANDATAIRE informe le MANDANT qu’il est tenu de se conformer aux dispositions des articles L561-1 et suivants du Code monétaire et financier, relatives à la lutte contre le blanchiment de capitaux et le financement du terrorisme : il vérifie l’identité de ses clients et s’informe de l’origine des fonds. Le MANDANT s’engage à lui fournir les justificatifs demandés à ce titre.'),
  ];
  const discrimination: Bloc[] = [
    P('Constitue une discrimination toute distinction opérée entre les personnes sur le fondement de leur origine, de leur sexe, de leur situation de famille, de leur grossesse, de leur apparence physique, de la particulière vulnérabilité résultant de leur situation économique, apparente ou connue de son auteur, de leur patronyme, de leur lieu de résidence, de leur état de santé, de leur perte d’autonomie, de leur handicap, de leurs caractéristiques génétiques, de leurs mœurs, de leur orientation sexuelle, de leur identité de genre, de leur âge, de leurs opinions politiques, de leurs activités syndicales, de leur qualité de lanceur d’alerte, de facilitateur ou de personne en lien avec un lanceur d’alerte, de leur capacité à s’exprimer dans une langue autre que le français, de leur appartenance ou de leur non-appartenance, vraie ou supposée, à une ethnie, une Nation, une prétendue race ou une religion déterminée (article 225-1 du Code pénal).'),
    P(`Le MANDATAIRE informe le MANDANT que toute discrimination commise à l’égard d’une personne est punie pénalement. En conséquence, les parties prennent l’engagement exprès de n’opposer à un ${loc ? 'candidat à la location' : 'candidat à l’acquisition'} aucun refus fondé sur un motif discriminatoire. Le MANDANT s’interdit expressément de donner au MANDATAIRE des directives et consignes, verbales ou écrites, tendant à refuser ${M.operation} pour des motifs discriminatoires.`),
  ];
  const donnees: Bloc[] = [
    P('Le MANDANT est informé que les données à caractère personnel le concernant, collectées par le MANDATAIRE à l’occasion des présentes, feront l’objet des traitements informatiques nécessaires à leur exécution. Ces traitements se fondent sur le présent contrat, sur le respect d’obligations légales, notamment en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme, ou sur la poursuite d’intérêts légitimes.'),
    P('Dans le cadre de l’exécution du contrat, ces données pourront être transmises à des fins exclusivement techniques à des prestataires informatiques assurant leur traitement, leur hébergement et leur archivage, ainsi qu’aux intervenants participant à la réalisation de l’opération (avocats, notaires, diagnostiqueurs, prestataires de signature électronique et, le cas échéant, professionnels de l’immobilier intervenant dans le cadre d’une délégation de mandat). Elles sont conservées pendant toute la durée de l’exécution du présent contrat, augmentée des délais légaux de prescription applicables.'),
    P('Le MANDANT est également informé que ces données pourront être utilisées par le MANDATAIRE dans le cadre de la gestion de ses fichiers de prospects et de clients, et pour la réalisation d’opérations de prospection et de marketing direct.'),
    { t: 'case', coche: d.rgpd === 'oui', x: 'En cochant cette case, le MANDANT l’accepte expressément.' },
    P(`Le MANDANT dispose des droits d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité de ses données, en adressant un courriel à ${A.mail} ou un courrier à l’adresse du MANDATAIRE indiquée en tête des présentes. Toute réclamation pourra être introduite auprès de la Commission nationale de l’informatique et des libertés (www.cnil.fr).`),
  ];
  const consoBlocs: Bloc[] = conso(d) ? [
    P(`Réclamations et médiation : par écrit au MANDATAIRE. Sans réponse satisfaisante sous trente jours, le MANDANT peut saisir gratuitement le médiateur de la consommation : ${A.mediateurNom}, ${A.mediateurAdresse}, ${A.mediateurSite}.`),
    P('Démarchage téléphonique : le consommateur est informé qu’il est interdit de le démarcher par téléphone sans son consentement préalable, sauf lorsque cette sollicitation intervient dans le cadre de l’exécution d’un contrat en cours (article L223-1 du Code de la consommation). Il peut s’inscrire gratuitement sur la liste d’opposition Bloctel (www.bloctel.gouv.fr). Le MANDANT déclare ne pas avoir fait l’objet d’un démarchage non autorisé avant la signature du présent mandat.'),
  ] : [];
  const textes = [
    'loi n° 70-9 du 2 janvier 1970 (dite loi Hoguet) et décret n° 72-678 du 20 juillet 1972',
    ...(conso(d) ? [`Code de la consommation (art. L111-1${d.dureeMode === 'prorogation' ? ', L215-1 à L215-3' : ''}${retr ? ', L221-5, L221-18 et suivants' : ''}, L612-1)`] : []),
    'Code civil (art. 1231-5)',
  ].join(' ; ');

  /* ── Les sections ── */
  const sections: Partie['sections'] = [
    { titre: 'Entre les soussignés', blocs: entre },
    { titre: 'Objet du mandat', ic: 'doc', blocs: objet },
    { titre: M.designation, ic: 'agence', blocs: desig },
    ...(loc ? [{ titre: 'Conditions de la location', ic: 'doc' as const, blocs: bail }]
      : avecBailEnCours(d) ? [{ titre: 'Caractéristiques du bail', ic: 'doc' as const, blocs: bail }] : []),
    ...(!loc ? [{ titre: M.prix, ic: 'etiquette' as const, blocs: prix }] : []),
    { titre: 'Rémunération du mandataire', ic: 'euro', blocs: hono },
    { titre: 'Durée du mandat', ic: 'calendrier', blocs: dur },
    { titre: 'Déclarations et obligations du mandant', ic: 'personne', blocs: mandant },
    { titre: 'Obligations et pouvoirs du mandataire', ic: 'bouclier', blocs: mandataire },
    { titre: 'Actions commerciales', ic: 'etoile', blocs: actionsBlocs },
    { titre: 'Reddition de comptes', ic: 'check', blocs: reddition },
  ];
  if (retr) {
    const ex = d.execution === 'oui' ? true : d.execution === 'non' ? false : null;
    sections.push({ titre: 'Droit de rétractation', ic: 'retour', blocs: [
      P(`Le mandat étant signé ${lieuDe(d) === 'distance' ? 'à distance' : 'hors des locaux du MANDATAIRE'}, le MANDANT peut se rétracter sans avoir à se justifier pendant ${nbLettres(14)} jours à compter du lendemain de sa signature (délai prolongé jusqu’au premier jour ouvrable s’il finit un samedi, un dimanche ou un jour férié), par une déclaration écrite dénuée d’ambiguïté — lettre, e-mail, ou le formulaire joint — adressée au MANDATAIRE, ${A.adresse}, ${A.cp} ${A.ville}, ${A.mail}.`, true),
      P('Le MANDATAIRE ne commence sa mission qu’à la fin de ce délai, sauf demande expresse du MANDANT. S’il demande qu’elle commence plus tôt, il garde son droit de rétractation tant que la mission n’est pas entièrement exécutée ; aucun honoraire n’est dû s’il se rétracte avant la conclusion de l’opération.'),
      { t: 'case', coche: ex === true, x: 'Le MANDANT DEMANDE que la mission commence dès la signature, sans attendre la fin du délai de rétractation.' },
      { t: 'case', coche: ex === false, x: 'Le MANDANT préfère que la mission commence à la fin du délai de rétractation.' },
    ] });
  }
  sections.push({ titre: 'Informations', ic: 'info', blocs: [...infos, ...consoBlocs, Pp(`Textes applicables : ${textes}. Le présent mandat est soumis à la loi française.`)] });
  sections.push({ titre: 'Engagement de non-discrimination', ic: 'balance', blocs: discrimination });
  sections.push({ titre: 'Collecte et exploitation des données personnelles', ic: 'cadenas', blocs: donnees });
  sections.push({ titre: 'Élection de domicile', ic: 'livre', blocs: [
    P('Pour l’exécution des présentes et de leurs suites, les parties font élection de domicile à leurs adresses respectives telles qu’indiquées en tête des présentes. En cas de modification, chacune des parties devra en informer l’autre par lettre recommandée avec demande d’avis de réception dans les huit jours ; à défaut, toute notification faite à l’adresse indiquée en tête des présentes sera réputée valablement faite.'),
  ] });
  if (txt(d, 'clause')) sections.push({ titre: 'Clauses particulières', ic: 'plume', blocs: paragraphes(txt(d, 'clause')) });
  const nbEx = vs.length + 1;
  sections.push({ titre: 'Date et signatures', ic: 'plume', blocs: blocsSignature(d, {
    papier: `Fait à ${txt(d, 'faitA') || '……………'}, le ${txt(d, 'date') ? jourLong(txt(d, 'date')) : '……………'}, en ${nbLettres(nbEx)} exemplaires originaux, dont un remis à chaque partie.`,
    mention: 'Chaque signataire date et signe, précédé de la mention manuscrite « Lu et approuvé, bon pour mandat », et paraphe chaque page.',
    cases: casesVente(d, A),
  }) });

  const parties: Partie[] = [{
    titre: `${titreMandat(d)}${numero ? ` n° ${numero}` : ''}`,
    court: 'Le mandat',
    sous: `Mandat ${T.maj.toLowerCase()} · ${nat === 'location' || estMursN(d) ? 'immobilier professionnel' : nat === 'fonds' ? 'fonds de commerce' : 'droit au bail'}`,
    ic: 'doc',
    sections,
  }];
  if (conso(d) && d.dureeMode === 'prorogation') parties.push(annexeL215());
  if (conso(d) && d.infoJointe === 'oui') parties.push(infoPrecontractuelle(d, A));
  if (retr) parties.push(formulaireRetractation(d, A));
  return parties;
}

/* ── L'information précontractuelle (L111-1 et L221-5 du Code de la
   consommation), pour un mandant qui en relève. ── */
export function infoPrecontractuelle(d: Donnees, A: IdentiteAgence): Partie {
  const type = typeDe(d);
  const M = motsDe(d);
  const a = argent(d);
  const retr = retractation(d);
  const duree = num(d, 'duree') ?? 3;
  const combien = a.honoraires !== null
    ? `${montantHono(d, a.honoraires)}${a.forfait === null && a.taux !== null ? ` (${tauxHono(d, a.taux)} ${estLoc(d) ? 'du loyer annuel' : 'du prix'})` : ''}`
    : a.taux !== null ? `${tauxHono(d, a.taux)} ${estLoc(d) ? 'du loyer annuel' : 'du prix'}` : 'À préciser';
  return {
    titre: 'Information précontractuelle',
    court: 'Information précontractuelle',
    sous: 'Ce qu’il faut savoir avant de signer',
    ic: 'info',
    sections: [{ blocs: [
      { t: 'fiches', items: [
        { ic: 'agence', titre: 'Qui nous sommes', lignes: [
          `${A.nom} — ${A.societe}, ${A.forme}, ${A.rcs}${A.tva ? `, TVA ${A.tva}` : ''}.`,
          `${A.adresse}, ${A.cp} ${A.ville} · ${A.tel} · ${A.mail}`,
          `Carte professionnelle « ${A.carteMention} » n° ${A.carte}, délivrée par ${A.carteDelivree}.`,
          `Assurance de responsabilité civile professionnelle : ${A.assureur}, police n° ${A.police}.`,
        ] },
        { ic: 'loupe', titre: 'Le service proposé', lignes: [
          `Rechercher ${estLoc(d) ? 'un preneur' : `un ${M.autreMin}`} et négocier ${M.operation} : présentation et publicité, visites, transmission des propositions, suivi jusqu’à la signature.`,
          type === 'exclusif' ? 'Mandat exclusif : l’Agence est seule chargée de l’opération pendant la durée du mandat.'
            : type === 'semi' ? 'Mandat semi-exclusif : aucune autre agence, mais vous restez libre de traiter vous-même.'
              : 'Mandat simple : vous restez libre de traiter vous-même ou par d’autres agences.',
        ] },
        { ic: 'euro', titre: 'Le prix du service', lignes: [
          `${combien}, à la charge ${a.charge === 'acquereur' ? `du ${M.autreMin}` : 'du mandant'}.`,
          ...lignesLibres(txt(d, 'honoNote')),
          'Dus uniquement si l’opération est effectivement conclue : rien n’est versé avant.',
          'Si vous traitez sans l’Agence avec une personne qu’elle vous a présentée, pendant le mandat et les mois qui suivent, une indemnité égale à ces honoraires est due.',
        ] },
        { ic: 'calendrier', titre: 'La durée', lignes: [
          d.dureeMode === 'prorogation'
            ? `${duree} mois, puis par périodes de ${num(d, 'periode') ?? 3} mois, dans la limite de ${num(d, 'dureeMax') ?? 6} mois.`
            : `${duree} mois, sans reconduction.`,
          'Après trois mois, chacun peut y mettre fin avec quinze jours de préavis, par lettre recommandée.',
        ] },
        { ic: 'retour', titre: 'Votre droit de rétractation', lignes: retr
          ? ['Signé hors de l’Agence ou à distance, le mandat vous permet de vous rétracter sans motif pendant 14 jours, avec le formulaire joint ou par tout écrit clair.',
            'Vous pouvez demander que la mission commence avant la fin de ce délai.']
          : ['Signé dans les locaux de l’Agence, le mandat n’ouvre pas de droit de rétractation.'] },
        { ic: 'balance', titre: 'En cas de litige', lignes: [
          'Écrivez d’abord à l’Agence. Sans réponse satisfaisante sous 30 jours, vous pouvez saisir gratuitement le médiateur de la consommation :',
          `${A.mediateurNom}, ${A.mediateurAdresse}, ${A.mediateurSite}.`,
        ] },
      ] },
    ] }],
  };
}

export function formulaireRetractation(d: Donnees, A: IdentiteAgence): Partie {
  const vs = vendeursDe(d);
  return {
    titre: 'Formulaire de rétractation',
    court: 'Formulaire de rétractation',
    sous: 'À renvoyer uniquement si vous souhaitez vous rétracter',
    ic: 'retour',
    sections: [{ blocs: [
      P(`À l’attention de : ${A.nom.toUpperCase()}, ${A.adresse}, ${A.cp} ${A.ville} — ${A.mail}`, true),
      { t: 'l', items: [
        `Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de service ci-dessous : ${titreMandat(d).toLowerCase()}${txt(d, 'numero') ? ` n° ${txt(d, 'numero')}` : ''}, pour les biens situés ${[txt(d, 'adresse'), txt(d, 'cp'), txt(d, 'ville')].filter(Boolean).join(' ') || '………………'}.`,
        `Conclu le : ${electronique(d) ? '……………… (la date de la dernière signature, sur le certificat joint)' : txt(d, 'date') ? jourLong(txt(d, 'date')) : '………………'}`,
        `Nom du ou des consommateurs : ${d.qui === 'sci' ? txt(d, 'sciNom') || '………………' : vs.map(nomComplet).join(', ')}`,
        `Adresse : ${d.qui === 'sci' ? txt(d, 'sciSiege') || '………………' : vs[0]?.adresse || '………………'}`,
        'Signature (uniquement si ce formulaire est envoyé sur papier) :',
        'Date :',
      ] },
    ] }],
  };
}

/* ── Le résumé de la page de garde ── */
function resume(d: Donnees): Resume {
  const a = argent(d);
  const M = motsDe(d);
  const duree = num(d, 'duree') ?? 3;
  const loc = estLoc(d);
  const nat = NATURES.find(n => n.v === natureDe(d));
  return [
    { titre: 'L’affaire', valeur: txt(d, 'adresse') || 'À compléter', detail: couper([nat?.l || '', txt(d, 'ville'), txt(d, 'activite')].filter(Boolean).join(' · '), 110) || '—' },
    { titre: loc ? 'Loyer annuel' : nat?.prix || 'Prix', valeur: a.montant ? `${euros(a.montant)}${loc ? ' HT HC' : ''}` : 'À compléter',
      detail: loc && a.montant ? `soit ${euros(Math.round(a.montant / 12))} HT HC par mois` : !loc && a.charge === 'acquereur' ? 'honoraires en sus' : !loc ? 'honoraires compris' : '—' },
    { titre: 'Honoraires', valeur: a.honoraires !== null ? `${euros(a.honoraires)} ${motBase(d)}` : a.taux !== null ? tauxHono(d, a.taux) : 'À compléter',
      detail: `à la charge ${a.charge === 'acquereur' ? `du ${M.autreMin}` : 'du mandant'} · dus à la conclusion` },
    { titre: 'Durée', valeur: `${duree} mois`, detail: d.dureeMode === 'prorogation' ? `puis par périodes, ${num(d, 'dureeMax') ?? 6} mois au plus` : 'sans reconduction · fin possible après 3 mois' },
  ];
}

/* Les repères de l'éditeur : le calcul sous les yeux, et ce qui mérite un
   second regard. */
function reperes(d: Donnees, etape: string): Repere[] {
  const out: Repere[] = [];
  if (etape === 'prix') {
    const a = argent(d);
    const loc = estLoc(d);
    if (a.montant) out.push({ l: loc ? 'Loyer annuel HT HC' : 'Prix écrit au mandat', v: euros(a.montant) });
    if (loc && a.montant) out.push({ l: 'Soit par mois', v: `${euros(Math.round(a.montant / 12))} HT HC` });
    if (a.honoraires !== null && (a.montant || a.forfait !== null)) out.push({ l: a.forfait !== null ? 'Honoraires (forfait)' : `Honoraires (${tauxHono(d, a.taux || 0)})`, v: `${euros(a.ht || 0)} HT · ${euros(a.ttc || 0)} TTC` });
    if (!loc && a.charge === 'acquereur' && a.prix && a.honoraires !== null) out.push({ l: 'Affiché dans l’annonce, honoraires compris', v: euros(a.prix), ton: 'ok' });
    if (!loc && a.charge === 'vendeur' && a.net !== null) out.push({ l: 'Net pour le mandant', v: euros(a.net), ton: 'ok' });
  }
  if (etape === 'duree') {
    const duree = num(d, 'duree');
    if (duree !== null && d.dureeMode === 'prorogation' && (num(d, 'dureeMax') ?? 6) < duree) out.push({ l: 'Durée', v: 'La limite totale est plus courte que la durée initiale.', ton: 'alerte' });
  }
  if (etape === 'signature' && !txt(d, 'numero')) out.push({ l: 'Registre des mandats', v: 'Réserve le numéro avant de faire signer : il doit figurer sur le mandat.', ton: 'alerte' });
  if (etape === 'engagements' && typeDe(d) === 'exclusif' && !liste(d, 'actions').length && !txt(d, 'actionsAutres')) {
    out.push({ l: 'Mandat exclusif', v: 'La loi impose de dire ce que tu feras : coche au moins une action.', ton: 'alerte' });
  }
  return out;
}

/* Signé et poursuivi par périodes : les échéances, et avant chacune la
   fenêtre où il faut écrire au mandant (article L215-1 du Code de la
   consommation). Le mandat de recherche et le courrier lisent aussi cette
   fonction : elle ne regarde que la durée. */
export function echeances(d: Donnees, signeLe: string): Echeance[] {
  const jour = String(signeLe || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return [];
  const duree = num(d, 'duree') ?? 3;
  const out: Echeance[] = [];
  if (d.dureeMode !== 'prorogation') {
    out.push({ le: plusMois(jour, duree), quoi: 'Fin du mandat' });
    return out;
  }
  const periode = Math.max(1, num(d, 'periode') ?? 3), max = num(d, 'dureeMax') ?? 12;
  for (let t = duree; t < max && out.length < 24; t += periode) {
    const limite = veille(plusMois(jour, t));
    out.push({ le: plusMois(jour, t), quoi: 'Le mandat se prolonge', du: plusMois(limite, -3), au: plusMois(limite, -1) });
  }
  out.push({ le: plusMois(jour, max), quoi: 'Fin du mandat (limite totale)' });
  return out;
}
/* Un mandant professionnel n'attend pas de courrier avant la reconduction :
   les échéances restent, sans fenêtre à respecter. */
const echeancesMandat = (d: Donnees, signeLe: string): Echeance[] =>
  conso(d) ? echeances(d, signeLe) : echeances(d, signeLe).map(e => ({ le: e.le, quoi: e.quoi }));

/* Les cadres de signature : chaque mandant (ou le représentant de la
   société), puis l'agence. */
export function casesVente(d: Donnees, A?: IdentiteAgence): CaseSignature[] {
  const vs = vendeursDe(d);
  const out: CaseSignature[] = d.qui === 'sci'
    ? [{ cle: 'sci', qui: 'Le mandant', nom: txt(d, 'sciNom') || 'La société', lignes: [`Représentée par ${nomComplet(vs[0])}${txt(d, 'sciPouvoir') ? `, ${txt(d, 'sciPouvoir')}` : ''}`], personne: vs[0] }]
    : vs.map((p, i): CaseSignature => ({ cle: `v${i}`, qui: 'Le mandant', nom: nomComplet(p), lignes: [] as string[], personne: p }));
  if (A) out.push({ cle: 'agence', qui: 'Le mandataire', nom: A.societe.toUpperCase(), lignes: [`Représentée par ${A.signataireNom}`, A.signataireQualite], agence: true });
  return out;
}

function manques(d: Donnees): string[] {
  const out: string[] = [];
  if (!natureDe(d)) out.push('Ce que le mandant te confie (location, droit au bail, fonds, murs)');
  const vs = vendeursDe(d);
  vs.forEach((p, i) => {
    const qui = vs.length > 1 ? `le mandant ${i + 1}` : d.qui === 'sci' ? 'celui qui signe pour la société' : 'le mandant';
    if (!p.nom || !p.prenom) out.push(`Le nom de ${qui}`);
    else if (d.qui !== 'sci' && !p.adresse) out.push(`L’adresse de ${nomComplet(p)}`);
  });
  if (d.qui === 'sci') {
    if (!txt(d, 'sciNom') || !txt(d, 'sciSiege')) out.push('Le nom et le siège de la société');
    if (!txt(d, 'sciForme') || !txt(d, 'sciRcs')) out.push('La forme, le capital et l’immatriculation de la société');
    if (!txt(d, 'sciPouvoir')) out.push('La qualité de celui qui signe pour la société (gérant, président…)');
  }
  if (!txt(d, 'adresse') || !txt(d, 'ville')) out.push('L’adresse des biens');
  if (natureMandat(d) === 'fonds' && !txt(d, 'activite')) out.push('L’activité du fonds');
  if (!txt(d, 'description')) out.push('La désignation des biens');
  if (!argent(d).montant) out.push(estLoc(d) ? 'Le loyer annuel' : 'Le prix');
  if (d.honoMode === 'forfait' ? num(d, 'forfait') === null : num(d, 'taux') === null) out.push('Les honoraires');
  if (!num(d, 'duree')) out.push('La durée');
  if (d.dureeMode === 'prorogation' && (num(d, 'dureeMax') ?? 6) < (num(d, 'duree') ?? 0)) out.push('Une limite totale au moins égale à la durée initiale');
  const suite = num(d, 'suite');
  if (suite === null || suite < 1 || suite > 12) out.push('La durée d’interdiction de traiter en direct après le mandat : de 1 à 12 mois');
  if (!txt(d, 'numero')) out.push('Le numéro du registre des mandats');
  if (!txt(d, 'faitA') || !txt(d, 'date')) out.push('Le lieu et la date de signature');
  if (typeDe(d) === 'exclusif' && !liste(d, 'actions').length && !txt(d, 'actionsAutres')) out.push('Les actions promises (obligatoires pour un mandat exclusif)');
  if (electronique(d) && retractation(d) && d.execution !== 'oui' && d.execution !== 'non') out.push(MANQUE_EXECUTION);
  out.push(...manquesSignature(d, casesVente(d)));
  return out;
}

function defaut(c: Contexte): Donnees {
  const cl = c.client;
  const p: Personne = { ...PERSONNE_VIDE, prenom: cl?.prenom || '', nom: cl?.nom || '', adresse: cl?.adresse || '', email: cl?.emails?.[0] || '', telephone: cl?.telephones?.[0] || '' };
  const b = c.bien;
  return {
    nature: '', type: 'simple',
    qui: 'sci', conso: 'non', vendeurs: [p], sciNom: '', sciForme: '', sciSiege: '', sciRcs: '', sciPouvoir: '',
    adresse: b?.adresse || '', cp: b?.code_postal || '', ville: b?.ville || '', description: '',
    copro: 'non', lots: [], composition: COMPOSITION_DEFAUT, usage: 'commerce',
    bailType: 'commercial', bailDuree: 9, indexation: 'ilc', tvaLoyer: 'sansobjet',
    montant: null, prix: b?.prix_acquereur || null, charge: 'acquereur', honoMode: 'taux', taux: null, semiDirect: 'aucun',
    duree: 3, dureeMode: 'prorogation', periode: 3, dureeMax: 6,
    actions: ACTIONS_DEFAUT, rythme: 'visite', pouvoirs: ['delegation'], suite: 12, delaiDocs: 8, delaiReponse: 8,
    signature: 'en_ligne', lieu: 'agence', execution: '', infoJointe: 'non', rgpd: '',
    numero: '', faitA: c.identite.ville, date: aujourdhui(),
  };
}

export const MANDAT_VENTE: Modele = {
  id: 'mandat_vente',
  categorie: 'mandats_vente',
  titre: 'Mandat de commercialisation',
  description: 'Location, droit au bail, fonds de commerce ou murs : simple, semi-exclusif ou exclusif, avec tes clauses.',
  ic: 'immeuble',
  signataires: 'Le mandant, puis l’agence',
  etapes: ETAPES,
  defaut,
  titreDoc: d => `${titreMandat(d)} · ${nomMandant(d)}`,
  sousTitre: d => [txt(d, 'adresse'), txt(d, 'ville')].filter(Boolean).join(', '),
  pour: nomMandant,
  rediger,
  resume,
  garde: d => {
    const t = typeDe(d);
    const nat = natureMandat(d);
    const titre = nat === 'location' ? 'Mandat de location' : nat === 'cession_bail' ? 'Mandat de cession de droit au bail' : nat === 'fonds' ? 'Mandat de cession d’un fonds de commerce' : 'Mandat de vente';
    return {
      titre,
      sous: `${TYPES[t].nom}${nat === 'location' || estMursN(d) ? ' · immobilier professionnel' : ''}`,
      etiquette: `MANDAT ${TYPES[t].maj}${txt(d, 'numero') ? ` · N° ${txt(d, 'numero')}` : ''}`,
      pour: 'ÉTABLI POUR',
      ics: ['agence', 'etiquette', 'euro', 'calendrier'],
    };
  },
  entete: d => `${titreMandat(d)}${txt(d, 'numero') ? ` n° ${txt(d, 'numero')}` : ''}`,
  manques,
  numero: true,
  registre: registreVente,
  badge: d => TYPES[typeDe(d)].court,
  reperes,
  echeances: echeancesMandat,
  cases: casesVente,
  deduire,
  accepter: () => 'J’ai lu le mandat en entier, y compris les clauses écrites en capitales, et je l’accepte : bon pour mandat.',
};
