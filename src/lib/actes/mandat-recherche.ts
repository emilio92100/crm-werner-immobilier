/* ═══ Le mandat de recherche sur papier : simple ou exclusif ══════════════
   Werner (22 octobre 2026) : un local à usage professionnel ou commercial
   à prendre à bail, à reprendre (droit au bail, fonds de commerce) ou à
   acheter (murs). Les clés des données n'ont pas changé (`acquereurs`,
   `qui: 'sci'` pour une société, `prixMax`…) : seuls les mots et les
   questions l'ont fait. Les honoraires se disent HT, sur le loyer annuel HT
   HC de la première année d'un bail, ou sur le prix d'une cession ou d'une
   vente — comme le mandat en ligne (src/lib/mandat.ts), qui dit la même
   chose avec les mêmes phrases quand c'est possible.

   Le mandat de recherche EN LIGNE (src/lib/mandat.ts : bloc Mandat de la
   fiche client, signé depuis l'espace avec un code) reste la voie rapide :
   une personne ou une société, mandat simple, douze mois. Celui-ci couvre
   le reste :
     · deux personnes, plusieurs, ou une société avec ses pièces ;
     · l'exclusivité : les actions promises et la façon d'en rendre compte
       (art. 6 de la loi Hoguet), la clause d'exclusivité en caractères très
       apparents et la fin possible après trois mois (art. 78 du décret) ;
     · une durée au choix, et les échéances de l'article L215-1 ;
     · la signature sur place, à l'agence ou chez le client (rétractation
       et formulaire seulement hors de l'agence).
   Signé (« Il est signé »), il remplit le bloc Mandat de la recherche
   (surRecherche) : l'espace voit un mandat valide et ne propose plus d'en
   signer un en ligne.

   La clause pénale ne joue que si un bail, une reprise ou une acquisition a
   réellement eu lieu en méconnaissance du mandat : un client qui n'a rien
   conclu ne doit rien.
   Les clauses de l'article 78 (exclusivité, engagement exclusif, clause de
   suite, clause pénale) sont en CAPITALES : le reste du texte a déjà ses
   encadrés, elles doivent se distinguer d'eux (caractères très apparents).
   Relu par un second agent le 27 septembre 2026 (préemption, non-cumul,
   déclenchement de la clause pénale, double rémunération).

   ⚠️ Texte adapté pour Werner le 22 octobre 2026, à faire relire par un
   avocat avant le premier usage. */

import {
  euros, BAREME, HONORAIRES_TAUX, tauxDe, forfaitDe, prixEtHonoraires, honorairesCourt,
  decrireRecherche, decrireCourt, rechercheDepuis, HONO_DETAIL, tauxTexte, type Recherche, type Partie, type Bloc, type Fiche, type Resume,
} from '@/lib/mandat';
import { TYPES_LOCAL } from '@/lib/affaires';
import { lignesMandataire, phraseFonds, type IdentiteAgence } from '@/lib/agence';
import {
  P, Pp, paragraphes, eurosLettres, nbLettres, pourcent, jourLong, aujourdhui, txt, num, liste, vrai, plusMois, couper,
  lirePersonnes, nomComplet, nomsCourts, fichePersonne, lignesPersonne, blocsInformations, ficheAgence, formulaireType, annexeL215,
  PERSONNE_VIDE, blocsSignature, manquesSignature, lieuDe, modeSignature, electronique, CHAMP_SIGNATURE, MANQUE_EXECUTION,
  ouiNon, IC_RYTHME, HONO_MODES, personneRegistre,
  type Donnees, type Modele, type Etape, type Contexte, type Personne, type Repere, type CaseSignature,
} from './commun';
import { echeances } from './mandat-vente';

type TypeR = 'simple' | 'exclusif';
const TYPES: Record<TypeR, { court: string; nom: string; maj: string }> = {
  simple: { court: 'Simple', nom: 'simple', maj: 'NON EXCLUSIF' },
  exclusif: { court: 'Exclusif', nom: 'exclusif', maj: 'EXCLUSIF' },
};
const typeDe = (d: Donnees): TypeR => (d.type === 'exclusif' ? 'exclusif' : 'simple');
/* Les clauses de l'article 78, en caractères très apparents. */
const MAJ = (t: string) => t.toLocaleUpperCase('fr-FR');


/* Ce que l'Agence promet de faire : cases à cocher, dans cet ordre. */
const ACTIONS: { v: string; ic: string; l: string; titre: string; x: string }[] = [
  { v: 'annonces', ic: 'loupe', l: 'Suivi des annonces', titre: 'Rechercher', x: 'Suivre les annonces correspondant à la recherche du MANDANT, y compris celles des propriétaires et des commerçants qui cèdent.' },
  { v: 'reseau', ic: 'groupe', l: 'Réseau et hors marché', titre: 'Chercher hors marché', x: 'Rechercher des locaux qui ne sont pas encore annoncés, auprès de son réseau de confrères et de son carnet d’adresses.' },
  { v: 'selection', ic: 'cle', l: 'Visites préalables', titre: 'Visiter et sélectionner', x: 'Visiter les locaux susceptibles de convenir avant de les proposer, et ne présenter que ceux qui correspondent à la recherche.' },
  { v: 'visites', ic: 'calendrier', l: 'Visites accompagnées', titre: 'Faire visiter', x: 'Organiser les visites du MANDANT et l’y accompagner.' },
  { v: 'dossier', ic: 'doc', l: 'Étude du dossier', titre: 'Vérifier', x: 'Obtenir et étudier le dossier de chaque local retenu avant toute offre : le bail en cours et sa destination, les charges et taxes refacturées, les diagnostics et, en copropriété, le règlement et les travaux votés.' },
  { v: 'avis', ic: 'courbe', l: 'Avis sur le loyer ou le prix', titre: 'Conseiller', x: 'Donner au MANDANT un avis argumenté sur le loyer ou le prix de chaque local retenu, au regard du marché du secteur.' },
  { v: 'negociation', ic: 'accord', l: 'Offres et négociation', titre: 'Négocier', x: 'Préparer et transmettre ses offres, et négocier pour son compte le loyer, les conditions du bail ou le prix.' },
  { v: 'suivi', ic: 'plume', l: 'Suivi jusqu’à la signature', titre: 'Accompagner jusqu’à la signature', x: 'L’accompagner jusqu’à la signature du bail, ou de l’acte de cession ou de vente, en lien avec l’avocat ou le notaire.' },
  { v: 'espace', ic: 'ecran', l: 'Espace personnel en ligne', titre: 'Tenir informé', x: 'Tenir à jour, dans l’espace personnel en ligne du MANDANT, le suivi de sa recherche et les locaux présentés.' },
];
const ACTIONS_DEFAUT = ACTIONS.map(a => a.v);

const RYTHMES: Record<string, string> = {
  semaine: 'chaque semaine',
  quinzaine: 'toutes les deux semaines',
  mois: 'chaque mois',
};

/* Les types de local : les mêmes mots que les critères d'un demandeur
   (CriteresRecherche, TYPES_BIEN), pour que le mandat signé et sa
   recherche se comparent (horsMandat, familleType). */
const LIB_TYPE: Record<string, string> = {
  bureaux: 'Bureaux', local: 'Local commercial', restaurant: 'Restaurant', activite: 'Local d’activité',
  entrepot: 'Entrepôt', immeuble: 'Immeuble', terrain: 'Terrain', parking: 'Parking', autre: 'Autre',
};
export const TYPES_BIEN: { v: string; l: string; ic: string }[] = TYPES_LOCAL.map(t => ({ v: String(t.v), l: LIB_TYPE[String(t.v)] || t.court, ic: t.ic }));

/* Ce qu'il cherche à faire : les natures d'affaire (src/lib/affaires.ts). */
export const NATURES_R: { v: string; l: string; ic: string; aide: string }[] = [
  { v: 'location', l: 'Prendre à bail', ic: 'cle', aide: 'Un local vide, un bail neuf' },
  { v: 'cession_bail', l: 'Reprendre un droit au bail', ic: 'bail', aide: 'Le bail en cours d’un locataire' },
  { v: 'fonds', l: 'Reprendre un fonds de commerce', ic: 'sac', aide: 'Une affaire en activité' },
  { v: 'murs', l: 'Acheter des murs', ic: 'immeuble', aide: 'Pour s’y installer' },
  { v: 'murs_occupes', l: 'Acheter des murs occupés', ic: 'courbe', aide: 'Un local déjà loué, pour investir' },
];
/* Prendre à bail, ou payer un prix (cession, fonds, murs) : les deux à la fois possibles. */
export const loueR = (d: Donnees) => { const n = liste(d, 'natures'); return !n.length || n.includes('location'); };
export const acheteR = (d: Donnees) => { const n = liste(d, 'natures'); return !n.length || n.some(x => x !== 'location'); };
const verbeR = (d: Donnees) => (loueR(d) && acheteR(d) ? 'à prendre à bail, à reprendre ou à acquérir' : loueR(d) ? 'à prendre à bail' : 'à reprendre ou à acquérir');
/* La base des honoraires, selon ce qu'il cherche (la même que le mandat en ligne). */
const baseHono = (d: Donnees) => (loueR(d) && acheteR(d)
  ? 'du loyer annuel hors taxes et hors charges de la première année pour un bail, ou du prix hors honoraires pour une cession de droit au bail, de fonds de commerce ou une vente'
  : loueR(d) ? 'du loyer annuel hors taxes et hors charges de la première année du bail conclu'
    : 'du prix, hors honoraires, de la cession ou de la vente conclue');

/* ── Qui cherche (les clés gardent leur nom d'origine : `acquereurs`) ── */
function acquereursDe(d: Donnees): Personne[] {
  const l = lirePersonnes(d.acquereurs);
  const nb = d.qui === 'couple' ? 2 : d.qui === 'plusieurs' ? Math.max(2, l.length) : 1;
  const out = l.slice(0, nb);
  while (out.length < nb) out.push({ ...PERSONNE_VIDE });
  return out;
}
const plusieurs = (d: Donnees) => d.qui === 'couple' || d.qui === 'plusieurs';
/* Ce que le registre des mandats inscrit (V3.18). */
export function registreRecherche(d: Donnees): { nature: 'recherche'; type_mandat: string; mandants: string; objet: string } {
  const as = acquereursDe(d).filter(p => p.nom.trim() || p.prenom.trim());
  const mandants = d.qui === 'sci'
    ? [[txt(d, 'sciNom'), txt(d, 'sciForme')].filter(Boolean).join(', '), txt(d, 'sciSiege') ? `siège ${txt(d, 'sciSiege')}` : '', txt(d, 'sciRcs'),
      as[0] ? `représentée par ${nomComplet(as[0])}` : ''].filter(Boolean).join(', ')
    : as.map(personneRegistre).join(' ; ');
  const prix = num(d, 'prixMax'), loyer = num(d, 'loyerMax');
  const objet = [objetRecherche(d),
    loueR(d) && loyer ? `loyer annuel maximum ${euros(loyer)} HT HC` : '',
    acheteR(d) && prix ? `prix maximum ${euros(prix)} hors honoraires` : ''].filter(Boolean).join(' · ');
  return { nature: 'recherche', type_mandat: typeDe(d), mandants, objet };
}
/* Le local recherché, en une ligne (le registre, la délégation). */
export const objetRecherche = (d: Donnees) => 'Recherche : ' + couper(decrireRecherche(rechercheDe(d)), 180);

const nomMandant = (d: Donnees) => (d.qui === 'sci' ? txt(d, 'sciNom') || 'La société' : nomsCourts(acquereursDe(d)));

function guideTitre(d: Donnees): string {
  return d.qui === 'sci' ? 'Une société : ce qu’il te faut'
    : d.qui === 'couple' ? 'Deux personnes : ce qu’il te faut'
      : d.qui === 'plusieurs' ? 'Plusieurs personnes : ce qu’il te faut'
        : 'Une personne : ce qu’il te faut';
}
function guidePoints(d: Donnees): { ic?: string; x: string }[] {
  if (d.qui === 'sci') return [
    { ic: 'immeuble', x: 'Le nom de la société, sa forme, son siège et son numéro RCS : tout est sur l’extrait Kbis (moins de 3 mois).' },
    { ic: 'personne', x: 'L’identité du dirigeant qui signe pour elle (gérant, président…).' },
    { ic: 'livre', x: 'Les statuts : ils disent si le dirigeant peut engager la société seul. Sinon, demande la décision des associés et joins-la au mandat.' },
    { ic: 'info', x: 'La société n’existe pas encore ? Choisis plutôt « Une personne » ou « Deux personnes » : le mandat couvre aussi un bail ou un achat par la société qu’ils créeront pour cette affaire.' },
  ];
  if (d.qui === 'couple') return [
    { ic: 'couple', x: 'L’état civil complet des deux : nom, prénoms, date et lieu de naissance, adresse.' },
    { ic: 'plume', x: 'Les deux signent : le mandat les engage ensemble. Si l’un ne peut pas être là, une procuration écrite de sa part, jointe au mandat.' },
  ];
  if (d.qui === 'plusieurs') return [
    { ic: 'groupe', x: 'Chaque personne, avec son état civil complet : toutes signent.' },
    { ic: 'plus', x: 'Deux fiches sont ouvertes ; « Ajouter une personne » en ajoute d’autres.' },
  ];
  return [
    { ic: 'personne', x: 'Son état civil complet : nom, prénoms, date et lieu de naissance, adresse.' },
    { ic: 'couple', x: 'Il s’installe avec un associé ? Choisis « Deux personnes » : les deux signent, et les honoraires restent dus quel que soit celui qui signe le bail ou l’acte.' },
  ];
}

/* ── L'argent ──
   Werner : un loyer annuel maximum HT HC (un bail) et/ou un prix maximum
   HORS honoraires (une cession, des murs). Les honoraires, HT, se calculent
   sur le loyer annuel de la première année, ou sur le prix ; un forfait est
   un montant fixe HT. `honoraires` : ceux du prix s'il y en a un, sinon ceux
   du loyer (la délégation et le contrôle « hors mandat » les reprennent). */
type Argent = {
  prix: number | null; honoraires: number | null; total: number | null; taux: number | null; forfait: number | null;
  loyer: number | null; honoPrix: number | null; honoLoyer: number | null;
};
function argent(d: Donnees): Argent {
  const prix0 = acheteR(d) ? num(d, 'prixMax') : null;
  const loyer0 = loueR(d) ? num(d, 'loyerMax') : null;
  const prix = prix0 && prix0 > 0 ? prix0 : null, loyer = loyer0 && loyer0 > 0 ? loyer0 : null;
  const forfait = d.honoMode === 'forfait' ? forfaitDe(d.forfait) : null;
  const taux = d.honoMode === 'forfait' ? null : num(d, 'taux');
  const sur = (base: number | null) => (forfait ? (base ? forfait : null) : base && taux !== null && taux >= 0 ? Math.round((base * taux) / 100) : null);
  const honoPrix = sur(prix), honoLoyer = sur(loyer);
  const honoraires = honoPrix ?? honoLoyer ?? (forfait || null);
  return { prix, honoraires, total: prix && honoPrix !== null ? prix + honoPrix : null, taux, forfait, loyer, honoPrix, honoLoyer };
}

export const retractation = (d: Donnees) => lieuDe(d) === 'domicile' || lieuDe(d) === 'distance';
/* Le loyer ou le prix maximum, et les honoraires (la délégation les rappelle). */
export const argentRecherche = (d: Donnees) => argent(d);

/* La recherche telle que decrireRecherche() l'attend (la même phrase que
   le mandat en ligne). */
function rechercheDe(d: Donnees): Recherche {
  const types = liste(d, 'types').map(v => (v === 'autre' ? txt(d, 'typeAutre') : TYPES_BIEN.find(t => t.v === v)?.l || '')).filter(Boolean);
  return {
    typeBien: types.join(', ') || null,
    piecesMin: null,
    chambresMin: null,
    surfaceMin: num(d, 'surface'),
    secteurs: txt(d, 'secteurs').split(/\s*[,;\n]\s*/).map(x => x.trim()).filter(Boolean),
    budget: null,
    natures: liste(d, 'natures'),
    loyerMax: loueR(d) ? num(d, 'loyerMax') : null,
    activite: txt(d, 'activite') || null,
  };
}

/* ══ Les questions ══════════════════════════════════════════════════════ */
/* V3.18 : six étapes courtes (qui cherche, le local recherché, le mandat et
   sa durée, le budget et les honoraires, les engagements, la signature),
   rangées en blocs ; chaque réponse a son dessin. Les réponses, les clés et
   le texte n'ont pas changé. */
const ETAPES: Etape[] = [
  {
    id: 'qui', titre: 'Qui cherche', court: 'Qui cherche', sous: 'Ce que la fiche client connaissait est déjà rempli.', vers: 'Entre les soussignés', ic: 'personne',
    champs: [
      { t: 'choix', cle: 'qui', lib: 'Qui cherche ?', ic: 'personne', tuiles: true, options: [
        { v: 'sci', l: 'Une société', aide: 'Son dirigeant signe pour elle.', ic: 'immeuble' },
        { v: 'personne', l: 'Une personne', aide: 'Elle cherche en son nom.', ic: 'personne' },
        { v: 'couple', l: 'Deux personnes', aide: 'Deux associés, deux co-preneurs…', ic: 'couple' },
        { v: 'plusieurs', l: 'Plusieurs personnes', aide: 'Trois associés ou plus.', ic: 'groupe' },
      ] },
      { t: 'guide', cle: 'g-qui', titre: guideTitre, points: guidePoints },
      { t: 'titre', cle: 't-sci', lib: 'La société', ic: 'immeuble', si: d => d.qui === 'sci' },
      { t: 'texte', cle: 'sciNom', lib: 'Nom de la société', ic: 'immeuble', requis: true, si: d => d.qui === 'sci', exemple: 'SAS LE BISTROT DU MARCHÉ' },
      { t: 'texte', cle: 'sciSiege', lib: 'Siège social', ic: 'lieu', large: true, requis: true, si: d => d.qui === 'sci' },
      /* V3.177 : la forme, le capital et l'immatriculation, facultatifs : une question Oui / Non. */
      { t: 'texte', cle: 'sciForme', lib: 'Forme et capital', ic: 'doc', si: d => d.qui === 'sci', exemple: 'SAS au capital de 10 000 €',
        question: 'Préciser sa forme, son capital et son immatriculation ?', aide: 'Sur l’extrait Kbis.', avec: ['sciRcs'] },
      { t: 'texte', cle: 'sciRcs', lib: 'Immatriculation', ic: 'livre', si: d => d.qui === 'sci', exemple: 'RCS de Paris n° 123 456 789' },
      { t: 'titre', cle: 't-acheteurs', lib: 'Qui signe', ic: 'couple', aide: 'L’état civil, tel que le mandat le reprendra.' },
      { t: 'personnes', cle: 'acquereurs', lib: 'Qui signe', ic: 'personne', un: 'Signataire', min: 1, max: 6, complet: d => d.qui !== 'sci',
        bornes: d => (d.qui === 'couple' ? { min: 2, max: 2 } : d.qui === 'plusieurs' ? { min: 2, max: 6 } : { min: 1, max: 1 }),
        nomCarte: (d, i) => (d.qui === 'sci' ? 'Le dirigeant qui signe' : d.qui === 'personne' ? 'Le mandant' : `Signataire ${i + 1}`),
        ajouter: () => 'Ajouter une personne' },
      { t: 'texte', cle: 'sciPouvoir', lib: 'Qualité du signataire', ic: 'plume', large: true, si: d => d.qui === 'sci', exemple: 'président, en vertu des statuts', question: 'Préciser la qualité du signataire ?' },
      { t: 'choix', cle: 'represente', lib: 'L’un représente l’autre ?', ic: 'plume', si: d => d.qui === 'couple', options: [
        { v: 'non', l: 'Non, les deux signent', ic: 'couple' }, { v: '0', l: 'Le premier représente le second', ic: 'fleche' }, { v: '1', l: 'Le second représente le premier', ic: 'retour' },
      ], aide: 'Seulement avec une procuration écrite, jointe au mandat.' },
      { t: 'zone', cle: 'noteAcquereurs', lib: 'Une précision', ic: 'plume', large: true, question: 'Une précision à imprimer sous les signataires ?' },
    ],
  },
  {
    id: 'recherche', titre: 'Le local recherché', court: 'Le local recherché', sous: 'Repris de sa recherche : l’essentiel, sans l’enfermer.', vers: 'Le local recherché', ic: 'loupe',
    champs: [
      { t: 'cases', cle: 'natures', lib: 'Il veut', ic: 'cle', options: NATURES_R.map(n => ({ v: n.v, l: n.l, ic: n.ic })),
        aide: 'Une ou plusieurs : le mandat dit « à prendre à bail », « à reprendre » ou « à acquérir », et les honoraires suivent.' },
      { t: 'cases', cle: 'types', lib: 'Type de local', ic: 'vitrine', options: TYPES_BIEN },
      { t: 'texte', cle: 'typeAutre', lib: 'Précisez', ic: 'plume', large: true, si: d => liste(d, 'types').includes('autre'), exemple: 'un showroom, une cave, un local de stockage…' },
      { t: 'nombre', cle: 'surface', lib: 'Surface', ic: 'regle', unite: 'm² environ ou plus' },
      { t: 'titre', cle: 't-ou', lib: 'Où, et pour quelle activité', ic: 'lieu' },
      { t: 'zone', cle: 'secteurs', lib: 'Où', ic: 'lieu', large: true, requis: true, exemple: 'Paris 8e, Paris 17e, Levallois-Perret', aide: 'Séparés par des virgules. Le mandat ajoute « ou à proximité ».' },
      { t: 'texte', cle: 'activite', lib: 'Son activité', ic: 'sac', large: true, exemple: 'restauration rapide, cabinet de conseil, boutique de prêt-à-porter…',
        question: 'Préciser son activité ?', aide: 'Imprimée dans le mandat : elle guide la recherche (destination du bail, extraction, accueil du public…).' },
      { t: 'zone', cle: 'criteres', lib: 'Ses critères essentiels', ic: 'etoile', large: true, exemple: 'une extraction, une vitrine sur rue, un emplacement n° 1', question: 'Préciser ses critères essentiels ?',
        aide: 'Imprimés tels quels. Seulement l’essentiel : le reste vit dans son espace et peut évoluer.' },
    ],
  },
  {
    id: 'mandat', titre: 'Le mandat et sa durée', court: 'Mandat et durée', sous: 'Simple ou exclusif, et combien de temps.', vers: 'Durée', ic: 'cadenas',
    champs: [
      { t: 'choix', cle: 'type', lib: 'Quel mandat ?', ic: 'cadenas', tuiles: true, options: [
        { v: 'simple', l: 'Simple', aide: 'Il reste libre de chercher seul et par d’autres agences.', ic: 'ouvert' },
        { v: 'exclusif', l: 'Exclusif', aide: 'Toi seul cherches pour lui pendant le mandat.', ic: 'cadenas' },
      ] },
      { t: 'titre', cle: 't-duree', lib: 'La durée', ic: 'calendrier' },
      { t: 'nombre', cle: 'duree', lib: 'Durée', ic: 'chrono', unite: 'mois', requis: true, rapides: [3, 6, 9, 12] },
      { t: 'choix', cle: 'dureeMode', lib: 'À son terme', ic: 'drapeau', tuiles: true, options: [
        { v: 'fixe', l: 'Il prend fin', aide: 'Sans suite : on en signe un autre si besoin.', ic: 'drapeau' },
        { v: 'prorogation', l: 'Il se poursuit', aide: 'Par périodes, jusqu’à une limite totale.', ic: 'boucle' },
      ] },
      { t: 'nombre', cle: 'periode', lib: 'Par périodes de', ic: 'boucle', unite: 'mois', si: d => d.dureeMode === 'prorogation', rapides: [3, 6, 12] },
      { t: 'nombre', cle: 'dureeMax', lib: 'Dans la limite de', ic: 'drapeau', unite: 'mois au total', si: d => d.dureeMode === 'prorogation', rapides: [12, 18, 24] },
    ],
  },
  {
    id: 'prix', titre: 'Budget et honoraires', court: 'Budget et honoraires', sous: 'Le loyer ou le prix maximum, tes honoraires.', vers: 'Budget', reperesApres: 'forfait', ic: 'euro',
    champs: [
      { t: 'euros', cle: 'loyerMax', lib: 'Loyer annuel maximum', ic: 'etiquette', unite: '€ HT HC par an', si: loueR,
        aide: 'Pour un bail : le loyer de l’année, hors taxes et hors charges.' },
      { t: 'euros', cle: 'prixMax', lib: 'Prix maximum', ic: 'etiquette', unite: '€ hors honoraires', si: acheteR,
        aide: 'Pour une cession (droit au bail, fonds) ou des murs. Hors honoraires : ils viennent en plus.' },
      { t: 'choix', cle: 'financement', lib: 'Pour payer le prix', ic: 'banque', si: acheteR, options: [
        { v: 'pret', l: 'Avec un prêt', ic: 'banque' }, { v: 'comptant', l: 'Sans prêt', ic: 'euro' }, { v: '', l: 'Ne pas le dire', ic: 'oeilBarre' },
      ] },
      { t: 'titre', cle: 't-hono', lib: 'Tes honoraires', ic: 'euro' },
      { t: 'choix', cle: 'honoMode', lib: 'Honoraires', ic: 'euro', options: HONO_MODES },
      { t: 'nombre', cle: 'taux', lib: 'Taux', ic: 'pourcent', unite: '% HT', si: d => d.honoMode !== 'forfait',
        aide: `Par défaut : ${String(HONORAIRES_TAUX).replace('.', ',')} % HT, du loyer annuel HT HC de la première année pour un bail, du prix pour une cession ou des murs. TVA en sus.` },
      { t: 'euros', cle: 'forfait', lib: 'Forfait', ic: 'euro', unite: '€ HT', si: d => d.honoMode === 'forfait', aide: 'Un montant fixe, hors taxes, quel que soit le loyer ou le prix. TVA en sus.' },
    ],
  },
  {
    id: 'engagements', titre: 'Engagements', court: 'Engagements', sous: 'Ce que tu fais pour lui, et comment tu en rends compte.', vers: 'Engagements de l’Agence', ic: 'etoile',
    champs: [
      { t: 'cases', cle: 'actions', lib: 'Ce que tu t’engages à faire', ic: 'etoile', options: ACTIONS.map(a => ({ v: a.v, l: a.l, ic: a.ic })) },
      { t: 'choix', cle: 'rythme', lib: 'Comptes rendus, en plus d’un après chaque visite', ic: 'horloge', options: Object.entries(RYTHMES).map(([v, l]) => ({ v, l: l.charAt(0).toUpperCase() + l.slice(1), ic: IC_RYTHME[v] })) },
      { t: 'cases', cle: 'pouvoirs', lib: 'Pouvoirs donnés à l’agence', ic: 'cle', options: [
        { v: 'renseignements', l: 'Demander les documents aux bailleurs et cédants', ic: 'doc' }, { v: 'offres', l: 'Transmettre ses offres écrites', ic: 'accord' }, { v: 'delegation', l: 'Déléguer à un confrère', ic: 'groupe' },
      ], aide: '« Déléguer à un confrère » est coché d’office : tu pourras confier la recherche à un confrère sans avenant.' },
      { t: 'titre', cle: 't-clauses', lib: 'Les clauses', ic: 'balance' },
      { t: 'choix', cle: 'penale', lib: 'Clause pénale', ic: 'balance', si: d => d.type === 'exclusif', options: ouiNon(),
        aide: 'S’il conclut en chargeant une autre agence de sa recherche pendant le mandat, il doit une indemnité égale à tes honoraires. Elle ne joue que s’il conclut réellement. Il reste libre de traiter seul pour un local trouvé par lui-même.' },
      { t: 'nombre', cle: 'suite', lib: 'Pas d’affaire sans toi pour un local présenté, pendant le mandat et', ic: 'chrono', unite: 'mois après', aide: 'Un local que tu lui as présenté ou fait visiter : pas de bail, de reprise ni d’achat sans toi. 12 mois au plus.' },
      { t: 'choix', cle: 'infoJointe', lib: 'Joindre l’information précontractuelle', ic: 'info', options: [{ v: 'oui', l: 'Oui', ic: 'trombone' }, { v: 'non', l: 'Non, remise à part', ic: 'envoyer' }],
        aide: 'Obligatoire avant la signature avec un particulier ou un petit professionnel (5 salariés au plus). Jointe, elle forme la 2e partie du document.' },
      { t: 'zone', cle: 'clause', lib: 'Clause particulière', ic: 'plume', large: true, question: 'Ajouter une clause particulière ?', aide: 'Imprimée telle quelle, avant les signatures.' },
    ],
  },
  {
    id: 'signature', titre: 'La signature', court: 'Signature', sous: 'Comment, où, et le numéro du registre.', vers: 'Date et signatures', ic: 'plume',
    champs: [
      CHAMP_SIGNATURE,
      { t: 'choix', cle: 'lieu', lib: 'Où sera-t-il signé ?', ic: 'lieu', tuiles: true, si: d => modeSignature(d) !== 'en_ligne', options: [
        { v: 'agence', l: 'À l’agence', ic: 'agence' }, { v: 'domicile', l: 'Chez lui ou dans ses locaux', ic: 'immeuble' }, { v: 'distance', l: 'À distance', ic: 'ecran' },
      ], aide: 'Hors de l’agence ou à distance, il a 14 jours pour se rétracter : le mandat le dit, avec le formulaire.' },
      { t: 'choix', cle: 'execution', lib: 'Commencer avant la fin des 14 jours ?', ic: 'eclair', si: retractation, options: [
        { v: 'oui', l: 'Oui, il le demande', ic: 'eclair' }, { v: 'non', l: 'Non, il attend', ic: 'horloge' }, { v: '', l: 'Il cochera sur place', ic: 'plume' },
      ], aide: 'En ligne ou sur place, « Oui » lui fait cocher lui-même une case à part en signant : c’est sa demande expresse.' },
      { t: 'titre', cle: 't-registre', lib: 'Le registre et la date', ic: 'livre' },
      { t: 'texte', cle: 'numero', lib: 'N° du registre des mandats', ic: 'livre', requis: true, aide: 'Il doit figurer sur le mandat avant la signature.' },
      { t: 'texte', cle: 'faitA', lib: 'Fait à', ic: 'lieu', requis: true },
      { t: 'date', cle: 'date', lib: 'Le', ic: 'calendrier', requis: true },
    ],
  },
];

/* ══ Le texte ═══════════════════════════════════════════════════════════ */
function rediger(d: Donnees, A: IdentiteAgence): Partie[] {
  const type = typeDe(d);
  const T = TYPES[type];
  const as = acquereursDe(d);
  const a = argent(d);
  const retr = retractation(d);
  const actions = liste(d, 'actions');
  const pouvoirs = liste(d, 'pouvoirs');
  const suite = num(d, 'suite') ?? 12;
  const duree = num(d, 'duree') ?? 3;
  const periode = num(d, 'periode') ?? 3;
  const dureeMax = num(d, 'dureeMax') ?? 12;
  const numero = txt(d, 'numero');

  /* ── Les parties ── */
  const fiches: Fiche[] = [];
  if (d.qui === 'sci') {
    const g = as[0];
    fiches.push({ ic: 'agence', titre: (txt(d, 'sciNom') || 'La société').toUpperCase(), lignes: [
      txt(d, 'sciForme'), txt(d, 'sciSiege') ? `Siège : ${txt(d, 'sciSiege')}` : '', txt(d, 'sciRcs'),
      `Représentée par ${nomComplet(g)}${txt(d, 'sciPouvoir') ? `, ${txt(d, 'sciPouvoir')}` : ''}.`,
      [g.telephone, g.email].filter(Boolean).join(' · '),
    ].filter(Boolean), pied: 'Ci-après « le MANDANT »' });
  } else if (d.qui === 'couple') {
    const [p1, p2] = as;
    fiches.push({ ic: 'personne', titre: `${nomComplet(p1)} et ${nomComplet(p2)}`, lignes: [
      ...lignesPersonne(p1).map((l, i) => (i === 0 ? `${p1.prenom || 'Le premier'} : ${l.charAt(0).toLowerCase()}${l.slice(1)}` : l)),
      ...lignesPersonne(p2).map((l, i) => (i === 0 ? `${p2.prenom || 'Le second'} : ${l.charAt(0).toLowerCase()}${l.slice(1)}` : l)),
    ], pied: 'Ci-après ensemble « le MANDANT », agissant solidairement' });
  } else {
    as.forEach((p, i) => fiches.push(fichePersonne(p, 'personne',
      as.length > 1 ? (i === as.length - 1 ? 'Ci-après ensemble « le MANDANT », agissant solidairement' : undefined) : 'Ci-après « le MANDANT »')));
  }
  fiches.push(ficheAgence(A, lignesMandataire(A), phraseFonds(A), 'Ci-après « l’Agence » ou « le MANDATAIRE »'));
  const entre: Bloc[] = [{ t: 'fiches', items: fiches }];
  const repr = d.qui === 'couple' && (d.represente === '0' || d.represente === '1') ? Number(d.represente) : -1;
  if (repr >= 0) entre.push(Pp(`${nomComplet(as[repr])} agit tant en son nom personnel qu’au nom de ${nomComplet(as[1 - repr])}, en vertu d’une procuration écrite annexée au présent mandat.`));
  entre.push(...paragraphes(txt(d, 'noteAcquereurs'), 'Précision : '));

  /* ── L'objet ── */
  const objet: Bloc[] = type === 'exclusif'
    ? [
      P(`Le MANDANT confie au MANDATAIRE, qui l’accepte, un mandat EXCLUSIF de rechercher pour son compte un local à usage professionnel ou commercial ${verbeR(d)}, correspondant à la description ci-après, et de l’assister jusqu’à la signature du bail ou de l’acte.`, true),
      P(MAJ('Clause d’exclusivité : pendant toute la durée du mandat, le MANDANT s’interdit de confier la recherche d’un tel local à un autre intermédiaire. Il reste libre de traiter lui-même, directement avec le bailleur, le cédant ou le propriétaire et sans aucun intermédiaire, pour un local qu’il aurait trouvé seul.'), true),
    ]
    : [P(`Le MANDANT confie au MANDATAIRE, qui l’accepte, un mandat NON EXCLUSIF de rechercher pour son compte un local à usage professionnel ou commercial ${verbeR(d)}, correspondant à la description ci-après, et de l’assister jusqu’à la signature du bail ou de l’acte. Il reste libre de chercher lui-même et de confier d’autres mandats non exclusifs.`, true)];

  /* ── Le local recherché ── */
  const r = rechercheDe(d);
  const cherche: Bloc[] = [
    P(r.typeBien || r.secteurs.length || r.surfaceMin || r.natures?.length ? decrireRecherche(r) : 'Description du local recherché : à compléter.', true),
  ];
  if (txt(d, 'criteres')) cherche.push(P(`Critères essentiels pour le MANDANT : ${txt(d, 'criteres').replace(/\.$/, '')}.`));
  cherche.push(P('Le mandat s’étend à tout local correspondant aux critères que le MANDANT communiquera ensuite par écrit à l’Agence, notamment depuis son espace personnel en ligne.'));

  /* ── Le budget : le loyer annuel maximum (un bail), le prix maximum (une
     cession, des murs), ou les deux. ── */
  const prix: Bloc[] = [];
  if (loueR(d)) prix.push(a.loyer
    ? P(`Loyer annuel maximum, hors taxes et hors charges : ${eurosLettres(a.loyer)}.`, true)
    : P('Loyer annuel maximum, hors taxes et hors charges : à compléter.', true));
  if (acheteR(d)) {
    if (a.prix) {
      prix.push(P(`Prix maximum d’une cession ou d’une acquisition, hors honoraires : ${eurosLettres(a.prix)}.`, true));
      if (a.total) {
        prix.push(P(`Avec les honoraires de l’Agence (hors TVA), le budget du MANDANT pour une cession ou une acquisition est donc de ${euros(a.total)} au plus.`));
        prix.push(P(`Lorsqu’aucun honoraire n’est dû au titre du présent mandat (local proposé par une autre agence qui partage ses honoraires avec l’Agence, voir « Honoraires »), le prix peut atteindre ce budget, soit ${euros(a.total)}.`));
      }
    } else prix.push(P('Prix maximum d’une cession ou d’une acquisition, hors honoraires : à compléter.', true));
    if (d.financement === 'pret') prix.push(P('Le MANDANT prévoit de financer ce prix, en tout ou partie, au moyen d’un prêt.'));
    if (d.financement === 'comptant') prix.push(P('Le MANDANT prévoit de financer ce prix sans recourir à un prêt.'));
  }
  prix.push(P(loueR(d) && acheteR(d) ? 'Ce loyer et ce prix maximum ne peuvent être modifiés que d’un commun accord, par avenant écrit signé des parties.'
    : loueR(d) ? 'Ce loyer maximum ne peut être modifié que d’un commun accord, par avenant écrit signé des parties.'
      : 'Ce prix maximum ne peut être modifié que d’un commun accord, par avenant écrit signé des parties.'));

  /* ── Les honoraires ── */
  const hono: Bloc[] = [];
  if (a.forfait) {
    hono.push(P(`Honoraires de l’Agence : un forfait de ${eurosLettres(a.forfait)} HT, TVA en sus.`, true));
  } else {
    const exemples = [
      acheteR(d) && a.prix && a.honoPrix ? `${euros(a.honoPrix)} HT pour un prix de ${euros(a.prix)}` : '',
      loueR(d) && a.loyer && a.honoLoyer ? `${euros(a.honoLoyer)} HT pour un loyer annuel de ${euros(a.loyer)}` : '',
    ].filter(Boolean).join(' ou ');
    hono.push(P(`Honoraires de l’Agence : ${a.taux !== null ? `${tauxTexte(a.taux)} ${baseHono(d)}${exemples ? `, soit ${exemples}` : ''}, TVA en sus` : 'à préciser'}.`, true));
  }
  /* Les deux cas (V3.144), comme le mandat en ligne (src/lib/mandat.ts). */
  hono.push(P('Ils ne sont dus que si le bail, la cession ou la vente se conclut par l’entremise de l’Agence, et selon l’un des deux cas suivants :'));
  hono.push({ t: 'l', items: [
    'Le local est proposé par une autre agence, qui partage avec l’Agence les honoraires prévus à son propre mandat : le MANDANT ne doit alors aucun honoraire au titre du présent mandat, et l’Agence est rémunérée par cette autre agence.',
    'Dans tous les autres cas (local proposé par son propriétaire ou par son locataire, agence qui ne partage pas ses honoraires, local trouvé hors des annonces…) : les honoraires ci-dessus sont à la charge du MANDANT, en plus du loyer ou du prix.',
  ] });
  hono.push(P('L’Agence indique au MANDANT par écrit, avant toute offre, dans lequel de ces deux cas se trouve le local, notamment dans son espace personnel.', true));
  hono.push(P('Dans l’espace personnel du MANDANT, le loyer ou le prix affiché pour chaque local est celui de son annonce. Si des honoraires de l’Agence s’y ajoutent (second cas ci-dessus), l’espace le précise sur le local concerné, avec leur montant.'));
  hono.push(P('Le bail, la reprise ou l’acquisition s’entendent aussi de ceux conclus par le MANDANT avec d’autres personnes, ou par une société qu’il constitue ou contrôle pour cette affaire.'));
  hono.push(P('Lorsqu’ils sont dus, les honoraires sont payés le jour de la signature du bail, ou de l’acte de cession ou de vente : aucune somme n’est due, ni ne peut être versée à l’Agence, avant (article 6 de la loi du 2 janvier 1970, qui interdit tout versement avant que l’opération soit effectivement conclue).'));
  if (acheteR(d)) hono.push(P('En cas d’exercice d’un droit de préemption sur une cession ou une vente, le MANDANT, qui ne conclut pas, ne doit aucun honoraire ; lorsque leur montant et leur charge figurent dans l’avant-contrat et la déclaration préalable, ils sont dus par le titulaire du droit de préemption, substitué au MANDANT.'));
  hono.push(P('Si le local fait l’objet d’un mandat (de location, de cession ou de vente) confié à l’Agence, elle en informe le MANDANT par écrit avant de le lui présenter ; elle ne perçoit alors qu’une seule rémunération pour cette affaire, et le MANDANT ne paie au plus que les honoraires prévus au présent mandat.'));

  /* ── La durée ── */
  const dur: Bloc[] = [];
  if (d.dureeMode === 'prorogation') {
    dur.push(P(`Le mandat prend effet à sa signature pour une durée de ${nbLettres(duree)} mois. À ce terme, il se poursuit par périodes de ${nbLettres(periode)} mois, dans la limite de ${nbLettres(dureeMax)} mois au total, sauf si l’une des parties y met fin. Chaque partie peut s’opposer à cette poursuite par écrit (lettre ou e-mail), au plus tard la veille de l’échéance ; le mandat prend alors fin à l’échéance.`));
    dur.push(P('Avant chaque échéance, au plus tôt trois mois et au plus tard un mois avant, l’Agence rappelle par écrit au MANDANT qu’il peut ne pas poursuivre le mandat (article L215-1 du Code de la consommation, reproduit en annexe avec les articles L215-1-1 à L215-3 et L241-3).'));
  } else {
    dur.push(P(`Le mandat prend effet à sa signature et dure ${nbLettres(duree)} mois. Il prend fin de plein droit à son terme, sans reconduction.`));
  }
  dur.push(type === 'exclusif'
    ? P('Passé un délai de trois mois à compter de sa signature, chaque partie peut y mettre fin à tout moment, par lettre recommandée avec avis de réception, avec un préavis de quinze jours (article 78 du décret du 20 juillet 1972).', true)
    : P('Chaque partie peut y mettre fin à tout moment, par lettre recommandée avec avis de réception ou par e-mail, avec un préavis de quinze jours.', true));

  /* ── Les engagements de l'Agence ── */
  const acts = ACTIONS.filter(x => actions.includes(x.v));
  const rythme = RYTHMES[String(d.rythme)] || RYTHMES.semaine;
  const engA: Bloc[] = [
    P('Le MANDATAIRE s’engage à :'),
    { t: 'etapes', items: [
      ...acts.map(x => ({ titre: x.titre, x: x.x })),
      { titre: 'Rendre compte', x: `Adresser au MANDANT un compte rendu écrit après chaque visite, et un point sur l’avancement de sa recherche ${rythme}, par e-mail ou dans son espace personnel.` },
    ] },
  ];

  /* ── Les engagements du mandant ── */
  const engM: Bloc[] = [
    P(d.qui === 'sci'
      ? 'Le MANDANT, par son représentant, déclare que son objet social et ses statuts lui permettent de conclure l’affaire recherchée, et que son représentant a le pouvoir de signer le présent mandat.'
      : `Le MANDANT déclare avoir la capacité de contracter${plusieurs(d) ? ' ; chacun des signataires s’engage solidairement' : ''}.`),
  ];
  if (type === 'exclusif') {
    engM.push(P(MAJ('Pendant toute la durée du mandat, le MANDANT ne charge aucun autre intermédiaire de rechercher un local pour lui.'), true));
    engM.push(P('S’il s’intéresse à un local proposé par un autre professionnel, il le signale à l’Agence, qui l’accompagne pour la visite et la négociation.'));
  } else {
    engM.push(P('Il déclare n’avoir confié aucun mandat exclusif de recherche portant sur les mêmes locaux.'));
  }
  engM.push(P('S’il prend à bail, reprend ou acquiert un local, avec ou sans l’Agence, il l’en informe sans délai et lui indique, à sa demande, le bailleur ou le cédant, le loyer ou le prix, et l’avocat ou le notaire chargé de l’acte. Il communique à l’Agence les informations utiles à sa recherche, notamment sur son activité et sa capacité de financement.'));
  engM.push(P(MAJ(`Pendant le mandat et les ${nbLettres(suite)} mois qui suivent sa fin, le MANDANT s’interdit de prendre à bail, de reprendre ou d’acquérir sans l’Agence, directement ou par personne interposée, un local qu’elle lui a présenté ou fait visiter. S’il le fait, il doit à l’Agence, à titre de clause pénale, une indemnité forfaitaire égale aux honoraires prévus au présent mandat, calculés sur le loyer ou le prix de l’affaire conclue. ${d.qui === 'sci' ? 'Il s’en porte fort pour ses associés et dirigeants, et pour toute société qu’ils contrôlent' : 'Il s’en porte fort pour son conjoint, son partenaire de PACS, son concubin, toute personne avec qui il traiterait et toute société qu’il constituerait ou contrôlerait pour cette affaire'}.`), true));

  /* ── Les pouvoirs ── */
  const pvs: string[] = [
    'rechercher des locaux correspondant à la recherche du MANDANT, et les visiter ;',
    ...(pouvoirs.includes('renseignements') ? ['demander aux bailleurs, aux cédants, aux propriétaires, à leurs mandataires et aux syndics de copropriété les renseignements et documents utiles ;'] : []),
    ...(pouvoirs.includes('offres') ? ['transmettre aux bailleurs, aux cédants ou aux vendeurs, ou à leurs mandataires, les offres écrites et signées du MANDANT ;'] : []),
    ...(pouvoirs.includes('delegation') ? [`déléguer tout ou partie de sa mission à un autre professionnel titulaire de la carte « Transactions sur immeubles et fonds de commerce », pour trouver le local recherché dans les meilleures conditions, sans frais supplémentaires pour le MANDANT ; l’Agence reste responsable envers lui de la personne qu’elle se substitue (article 1994 du Code civil) et l’informe de toute délégation ;`] : []),
    'négocier pour son compte le loyer, les conditions du bail ou le prix.',
  ];
  const pouvoirsBlocs: Bloc[] = [
    P('Le MANDANT donne au MANDATAIRE le pouvoir de :'),
    { t: 'l', items: pvs },
    P('L’Agence ne peut pas engager le MANDANT : aucune offre, aucun bail ni aucun avant-contrat ne l’engage sans sa propre signature.'),
  ];

  /* ── La partie 1 ── */
  const sections: Partie['sections'] = [
    { titre: 'Entre les soussignés', blocs: entre },
    { titre: 'Il a été convenu ce qui suit', blocs: objet },
    { titre: 'Le local recherché', ic: 'agence', blocs: cherche },
    { titre: 'Budget', ic: 'etiquette', blocs: prix },
    { titre: 'Honoraires', ic: 'euro', blocs: hono },
    { titre: 'Durée', ic: 'calendrier', blocs: dur },
    { titre: 'Engagements de l’Agence', ic: 'etoile', blocs: engA },
    { titre: 'Engagements du mandant', ic: 'personne', blocs: engM },
    { titre: 'Pouvoirs', ic: 'doc', blocs: pouvoirsBlocs },
  ];
  if (type === 'exclusif' && vrai(d, 'penale')) {
    sections.push({ titre: 'Clause pénale', ic: 'balance', blocs: [
      P(MAJ('Si, pendant la durée du mandat, le MANDANT signe un bail, une promesse ou un avant-contrat portant sur un local correspondant à sa recherche par l’entremise d’un autre intermédiaire qu’il aurait chargé de sa recherche, et que l’affaire se conclut, il devra à l’Agence, à titre de clause pénale, une indemnité forfaitaire égale aux honoraires prévus au présent mandat, calculés sur le loyer ou le prix de cette affaire.'), true),
      Pp('Cette indemnité n’est due que si l’affaire est effectivement conclue, et ne se cumule pas avec celle prévue aux engagements du mandant pour un local présenté par l’Agence. Le juge peut la modérer ou l’augmenter si elle est manifestement excessive ou dérisoire (article 1231-5 du Code civil).'),
    ] });
  }
  if (retr) {
    const ex = d.execution === 'oui' ? true : d.execution === 'non' ? false : null;
    sections.push({ titre: 'Droit de rétractation', ic: 'retour', blocs: [
      P(`Le mandat étant signé ${lieuDe(d) === 'distance' ? 'à distance' : 'hors des locaux de l’Agence'}, le MANDANT peut se rétracter sans avoir à se justifier pendant ${nbLettres(14)} jours à compter du lendemain de sa signature (délai prolongé jusqu’au premier jour ouvrable s’il finit un samedi, un dimanche ou un jour férié), par une déclaration écrite dénuée d’ambiguïté — lettre, e-mail, ou le formulaire joint — adressée à l’Agence, ${A.adresse}, ${A.cp} ${A.ville}, ${A.mail}.`, true),
      P('L’Agence ne commence sa mission qu’à la fin de ce délai, sauf demande expresse du MANDANT. S’il demande qu’elle commence plus tôt, il garde son droit de rétractation tant que la mission n’est pas entièrement exécutée ; aucun honoraire n’est dû s’il se rétracte avant d’avoir conclu.'),
      { t: 'case', coche: ex === true, x: 'Le MANDANT DEMANDE que la mission commence dès la signature, sans attendre la fin du délai de rétractation.' },
      { t: 'case', coche: ex === false, x: 'Le MANDANT préfère que la mission commence à la fin du délai de rétractation.' },
    ] });
  }
  sections.push({ titre: 'Informations', ic: 'info', blocs: [
    ...(numero ? [P(`Le présent mandat est inscrit sous le numéro ${numero} au registre des mandats de l’Agence.`)] : [P('Numéro au registre des mandats : ……………')]),
    P(`Le MANDANT reconnaît avoir reçu, avant de signer, l’information précontractuelle prévue par le Code de la consommation${retr ? ' et le formulaire de rétractation' : ''}${vrai(d, 'infoJointe') ? ', qui forme' + (retr ? 'nt' : '') + ' la suite du présent document' : ''}.`),
    ...blocsInformations(A, 'le MANDANT', {
      lcbft: 'Le MANDANT s’engage à lui fournir les justificatifs demandés à ce titre, notamment sur l’origine des fonds.',
      textes: [
        'loi n° 70-9 du 2 janvier 1970 (dite loi Hoguet, art. 6 et 7) et décret n° 72-678 du 20 juillet 1972 (art. 72 et 78)',
        `Code de la consommation (art. L111-1${d.dureeMode === 'prorogation' ? ', L215-1 à L215-3' : ''}${retr ? ', L221-5, L221-18 et suivants' : ''}, L612-1)`,
        ...(type === 'exclusif' && vrai(d, 'penale') ? ['Code civil (art. 1231-5)'] : []),
      ].join(' ; '),
    }),
  ] });
  if (txt(d, 'clause')) sections.push({ titre: 'Clause particulière', ic: 'plume', blocs: paragraphes(txt(d, 'clause')) });
  const signataires = d.qui === 'sci' ? 1 : repr >= 0 ? 1 : as.length;
  sections.push({ titre: 'Date et signatures', ic: 'plume', blocs: blocsSignature(d, {
    papier: `Fait à ${txt(d, 'faitA') || '……………'}, le ${txt(d, 'date') ? jourLong(txt(d, 'date')) : '……………'}, en ${nbLettres(signataires + 1)} exemplaires originaux, dont un remis à chaque partie.`,
    mention: 'Chaque signataire date et signe, précédé de la mention manuscrite « Lu et approuvé, bon pour mandat ».',
    cases: casesRecherche(d, A),
  }) });

  const parties: Partie[] = [{
    titre: `Mandat de recherche ${T.nom}${numero ? ` n° ${numero}` : ''}`,
    court: 'Le mandat de recherche',
    sous: type === 'exclusif' ? 'Mandat exclusif, d’un local professionnel ou commercial' : 'Mandat simple, non exclusif, d’un local professionnel ou commercial',
    ic: 'doc',
    sections,
  }];
  if (d.dureeMode === 'prorogation') parties.push(annexeL215());
  if (vrai(d, 'infoJointe')) parties.push(infoPrecontractuelle(d, A));
  if (retr) parties.push(formulaireType(A, {
    contrat: `mandat de recherche${numero ? ` n° ${numero}` : ''}`,
    /* Signé en ligne ou sur place : conclu à la dernière signature. */
    conclu: electronique(d) ? '……………… (la date de la dernière signature, sur le certificat joint)' : txt(d, 'date') ? jourLong(txt(d, 'date')) : '',
    noms: d.qui === 'sci' ? txt(d, 'sciNom') : as.map(nomComplet).join(', '),
    adresse: d.qui === 'sci' ? txt(d, 'sciSiege') : as[0]?.adresse || '',
  }));
  return parties;
}

/* ── L'information précontractuelle (L111-1 et L221-5 du Code de la
   consommation) : ce qu'il faut savoir avant de signer, en fiches. ── */
function infoPrecontractuelle(d: Donnees, A: IdentiteAgence): Partie {
  const type = typeDe(d);
  const a = argent(d);
  const retr = retractation(d);
  const duree = num(d, 'duree') ?? 3;
  const combien = a.forfait
    ? `Un forfait de ${euros(a.forfait)} HT (TVA en sus)`
    : a.taux !== null ? `${tauxTexte(a.taux)} ${baseHono(d)} (TVA en sus)` : 'À préciser';
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
        ], note: phraseFonds(A) },
        { ic: 'loupe', titre: 'Le service proposé', lignes: [
          `Rechercher pour vous un local professionnel ou commercial ${verbeR(d)} : annonces et recherche hors marché, visites préalables, étude des dossiers (bail, charges, diagnostics), négociation, suivi jusqu’à la signature du bail ou de l’acte.`,
          type === 'exclusif' ? 'Mandat exclusif : l’Agence est seule chargée de votre recherche pendant la durée du mandat.'
            : 'Mandat simple : vous restez libre de chercher vous-même et par d’autres agences.',
        ] },
        { ic: 'euro', titre: 'Le prix du service', lignes: [
          `${combien}, à votre charge, en plus du loyer ou du prix.`,
          'Rien à payer si le local est proposé par une autre agence qui partage ses honoraires avec l’Agence : elle est alors rémunérée par cette agence.',
          'Dus uniquement si vous concluez grâce à l’Agence, le jour de la signature du bail ou de l’acte : rien n’est versé avant.',
          type === 'exclusif'
            ? 'Si vous concluez sans l’Agence pour un local qu’elle vous a présenté, pendant le mandat et les mois qui suivent, ou par un autre intermédiaire chargé de votre recherche pendant le mandat, une indemnité égale à ces honoraires est due.'
            : 'Si vous concluez sans l’Agence pour un local qu’elle vous a présenté, pendant le mandat et les mois qui suivent, une indemnité égale à ces honoraires est due.',
          'Les honoraires de l’Agence sont affichés à l’Agence et sur son site.',
        ] },
        { ic: 'calendrier', titre: 'La durée', lignes: [
          d.dureeMode === 'prorogation'
            ? `${duree} mois, puis par périodes de ${num(d, 'periode') ?? 3} mois, dans la limite de ${num(d, 'dureeMax') ?? 12} mois.`
            : `${duree} mois, sans reconduction.`,
          type === 'exclusif' ? 'Après trois mois, chacun peut y mettre fin avec quinze jours de préavis, par lettre recommandée.'
            : 'Chacun peut y mettre fin à tout moment, avec quinze jours de préavis.',
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

/* ── Le résumé de la page de garde ── */
function resume(d: Donnees): Resume {
  const a = argent(d);
  const duree = num(d, 'duree') ?? 3;
  const r = rechercheDe(d);
  const court = decrireCourt(r);
  const budget = loueR(d) && a.loyer
    ? { valeur: `${euros(a.loyer)} HT HC par an`, detail: acheteR(d) && a.prix ? `ou ${euros(a.prix)} hors honoraires pour une reprise ou un achat` : 'loyer annuel maximum' }
    : acheteR(d) && a.prix ? { valeur: `${euros(a.prix)} hors honoraires`, detail: a.total ? `soit ${euros(a.total)} honoraires compris` : 'prix maximum' }
      : { valeur: 'À compléter', detail: '—' };
  const sur = loueR(d) && acheteR(d) ? 'du loyer annuel ou du prix' : loueR(d) ? 'du loyer annuel HT HC' : 'du prix';
  return [
    { titre: 'Le local recherché', valeur: r.typeBien || r.natures?.length ? court.valeur : 'À compléter', detail: r.secteurs.length || r.surfaceMin ? court.detail : '—' },
    { titre: loueR(d) && !acheteR(d) ? 'Loyer maximum' : acheteR(d) && !loueR(d) ? 'Prix maximum' : 'Budget', ...budget },
    { titre: 'Honoraires', valeur: a.forfait ? `${euros(a.forfait)} HT, au forfait` : a.taux !== null ? `${tauxTexte(a.taux)} ${sur}` : 'À compléter', detail: HONO_DETAIL },
    { titre: 'Durée', valeur: `${duree} mois`, detail: d.dureeMode === 'prorogation' ? `puis par périodes, ${num(d, 'dureeMax') ?? 12} mois au plus` : typeDe(d) === 'exclusif' ? 'sans reconduction · fin possible après 3 mois' : 'sans reconduction · fin possible à tout moment' },
  ];
}

function reperes(d: Donnees, etape: string): Repere[] {
  const out: Repere[] = [];
  if (etape === 'prix') {
    const a = argent(d);
    const lib = a.forfait ? 'Honoraires (forfait)' : `Honoraires (${tauxTexte(a.taux || 0)})`;
    if (a.loyer) out.push({ l: 'Loyer annuel maximum', v: `${euros(a.loyer)} HT HC` });
    if (a.loyer && a.honoLoyer !== null) out.push({ l: `${lib}, sur ce loyer`, v: `${euros(a.honoLoyer)} HT` });
    if (a.prix) out.push({ l: 'Prix maximum, hors honoraires', v: euros(a.prix) });
    if (a.prix && a.honoPrix !== null) out.push({ l: `${lib}, sur ce prix`, v: `${euros(a.honoPrix)} HT` });
    if (a.total) out.push({ l: 'Son budget, honoraires compris', v: euros(a.total), ton: 'ok' });
    const budget = num(d, 'budgetFiche');
    if (a.total && budget && a.total > budget) out.push({ l: 'Au-dessus de sa fiche', v: `Son budget enregistré est de ${euros(budget)}, honoraires compris.`, ton: 'alerte' });
    const loyerFiche = num(d, 'loyerFiche');
    if (a.loyer && loyerFiche && a.loyer > loyerFiche) out.push({ l: 'Au-dessus de sa fiche', v: `Son loyer maximum enregistré est de ${euros(loyerFiche)} HT HC par an.`, ton: 'alerte' });
    if (!a.forfait && a.taux !== null && a.taux > BAREME) out.push({ l: 'Taux très élevé', v: `Au-dessus de ${pourcent(BAREME)} : vérifie la saisie.`, ton: 'alerte' });
    if (loueR(d) && acheteR(d) && !a.loyer && !a.prix) out.push({ l: 'Budget', v: 'Indique le loyer maximum, le prix maximum, ou les deux.', ton: 'alerte' });
  }
  /* V3.18 : chaque repère suit la question qu'il commente dans ses étapes. */
  if (etape === 'mandat') {
    const duree = num(d, 'duree');
    if (duree !== null && d.dureeMode === 'prorogation' && (num(d, 'dureeMax') ?? 12) < duree) out.push({ l: 'Durée', v: 'La limite totale est plus courte que la première période.', ton: 'alerte' });
  }
  if (etape === 'signature' && !txt(d, 'numero')) out.push({ l: 'Registre des mandats', v: 'Réserve le numéro avant de faire signer : il doit figurer sur le mandat.', ton: 'alerte' });
  if (etape === 'engagements' && typeDe(d) === 'exclusif' && !liste(d, 'actions').length) {
    out.push({ l: 'Mandat exclusif', v: 'La loi impose de dire ce que tu feras pour lui : coche au moins une action.', ton: 'alerte' });
  }
  return out;
}

/* Les cadres de signature : chaque signataire (ou celui qui représente
   l'autre, ou le dirigeant pour la société), puis l'agence. */
export function casesRecherche(d: Donnees, A?: IdentiteAgence): CaseSignature[] {
  const as = acquereursDe(d);
  const repr = d.qui === 'couple' && (d.represente === '0' || d.represente === '1') ? Number(d.represente) : -1;
  const out: CaseSignature[] = d.qui === 'sci'
    ? [{ cle: 'sci', qui: 'Le mandant', nom: txt(d, 'sciNom') || 'La société', lignes: [`Représentée par ${nomComplet(as[0])}`], personne: as[0] }]
    : as.map((p, i): CaseSignature => ({ cle: `a${i}`, qui: 'Le mandant', nom: nomComplet(p), lignes: [] as string[], personne: p }))
      .filter((_, i) => repr < 0 || i === repr)
      .map(c => (repr >= 0 ? { ...c, lignes: [`En son nom et pour ${nomComplet(as[1 - repr])}, par procuration`] } : c));
  if (A) out.push({ cle: 'agence', qui: 'Le mandataire', nom: A.nom.toUpperCase(), lignes: [`Représentée par ${A.signataireNom}, ${A.signataireQualite}`], agence: true });
  return out;
}

function manques(d: Donnees): string[] {
  const out: string[] = [];
  const as = acquereursDe(d);
  as.forEach((p, i) => {
    const qui = as.length > 1 ? `la personne ${i + 1}` : d.qui === 'sci' ? 'le dirigeant' : 'le mandant';
    if (!p.nom || !p.prenom) out.push(`Le nom de ${qui}`);
    else if (d.qui !== 'sci' && (!p.naissanceDate || !p.naissanceLieu)) out.push(`La date et le lieu de naissance de ${nomComplet(p)}`);
    else if (d.qui !== 'sci' && !p.adresse) out.push(`L’adresse de ${nomComplet(p)}`);
  });
  if (d.qui === 'sci' && (!txt(d, 'sciNom') || !txt(d, 'sciSiege'))) out.push('Le nom et le siège de la société');
  if (!liste(d, 'natures').length) out.push('Ce qu’il veut faire : prendre à bail, reprendre, acheter');
  if (!liste(d, 'types').length) out.push('Le type de local recherché');
  if (!txt(d, 'secteurs')) out.push('Où il cherche');
  if (loueR(d) && !acheteR(d) && !num(d, 'loyerMax')) out.push('Le loyer annuel maximum');
  else if (acheteR(d) && !loueR(d) && !num(d, 'prixMax')) out.push('Le prix maximum');
  else if (!num(d, 'loyerMax') && !num(d, 'prixMax')) out.push('Le loyer ou le prix maximum');
  if (d.honoMode === 'forfait' ? !forfaitDe(d.forfait) : num(d, 'taux') === null) out.push('Les honoraires');
  if (!num(d, 'duree')) out.push('La durée');
  if (d.dureeMode === 'prorogation' && (num(d, 'dureeMax') ?? 12) < (num(d, 'duree') ?? 0)) out.push('Une limite totale au moins égale à la première durée');
  const suite = num(d, 'suite');
  if (suite === null || suite < 1 || suite > 12) out.push('La durée pendant laquelle il ne traite pas sans toi après le mandat : de 1 à 12 mois');
  if (!txt(d, 'numero')) out.push('Le numéro du registre des mandats');
  if (!txt(d, 'faitA') || !txt(d, 'date')) out.push('Le lieu et la date de signature');
  if (typeDe(d) === 'exclusif' && !liste(d, 'actions').length) out.push('Les actions promises (obligatoires pour un mandat exclusif)');
  if (electronique(d) && retractation(d) && d.execution !== 'oui' && d.execution !== 'non') out.push(MANQUE_EXECUTION);
  out.push(...manquesSignature(d, casesRecherche(d)));
  return out;
}

/* Les types de la fiche (« Bureaux, Restaurant ») vers les cases. */
export function typesDepuis(t: unknown): { types: string[]; autre: string } {
  const types: string[] = [], autres: string[] = [];
  for (const x of String(t || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const y = x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const v = /bureau/.test(y) ? 'bureaux' : /restau|cafe|\bbar\b|brasserie/.test(y) ? 'restaurant' : /commerc|boutique|magasin/.test(y) ? 'local'
      : /activite|atelier/.test(y) ? 'activite' : /entrepot|stockage|logistique/.test(y) ? 'entrepot' : /immeuble/.test(y) ? 'immeuble'
        : /terrain/.test(y) ? 'terrain' : /parking|\bbox\b/.test(y) ? 'parking' : '';
    if (v) { if (!types.includes(v)) types.push(v); } else autres.push(x.toLowerCase());
  }
  if (autres.length) types.push('autre');
  return { types, autre: autres.join(', ') };
}

function defaut(c: Contexte): Donnees {
  const cl = c.client;
  const p: Personne = { ...PERSONNE_VIDE, prenom: cl?.prenom || '', nom: cl?.nom || '', adresse: cl?.adresse || '', email: cl?.emails?.[0] || '', telephone: cl?.telephones?.[0] || '' };
  const r = c.recherche || null;
  const rech = r ? rechercheDepuis(r) : null;
  const forfait = r ? forfaitDe(r.mandat_forfait) : null;
  const taux = r ? tauxDe(r.mandat_taux) : HONORAIRES_TAUX;
  const { types, autre } = typesDepuis(rech?.typeBien);
  const prixMax = rech ? prixEtHonoraires(rech.budget, { taux, forfait }).prixMax : null;
  const natures = rech?.natures?.length ? rech.natures : ['location'];
  /* Un numéro déjà réservé sur la recherche (pour le mandat en ligne), pas
     encore signé : c'est le même mandat, il le garde. */
  const numero = r && !r.mandat_date_signature && typeof r.mandat_numero === 'string' ? r.mandat_numero.trim() : '';
  return {
    qui: 'personne', acquereurs: [p], represente: 'non',
    natures, types: types.length ? types : ['local'], typeAutre: autre,
    surface: rech?.surfaceMin ?? null, activite: rech?.activite || '',
    secteurs: rech?.secteurs.join(', ') || '', criteres: '',
    type: 'simple', prixMax, budgetFiche: rech?.budget ?? null, loyerMax: rech?.loyerMax ?? null, loyerFiche: rech?.loyerMax ?? null, financement: '',
    honoMode: forfait ? 'forfait' : 'taux', taux: forfait ? HONORAIRES_TAUX : taux, forfait,
    duree: 12, dureeMode: 'fixe', periode: 3, dureeMax: 12,
    signature: 'papier', lieu: 'agence', execution: '', numero, faitA: c.identite.ville, date: aujourdhui(),
    actions: ACTIONS_DEFAUT, rythme: 'semaine', penale: 'non', suite: 12,
    pouvoirs: ['renseignements', 'offres', 'delegation'], infoJointe: 'oui',
  };
}

/* Signé : le bloc Mandat de la recherche se remplit, comme après une
   signature en ligne (/api/espace/mandat). La date de fin est la limite
   totale quand le mandat se poursuit par périodes. */
function surRecherche(d: Donnees, jour: string): Record<string, unknown> {
  const a = argent(d);
  const total = d.dureeMode === 'prorogation' ? (num(d, 'dureeMax') ?? 12) : (num(d, 'duree') ?? 12);
  const numero = txt(d, 'numero');
  return {
    mandat_date_signature: jour, mandat_duree: Math.round(total), mandat_date_expiration: plusMois(jour, Math.round(total)),
    mandat_honoraires: honorairesCourt({ taux: a.taux, forfait: a.forfait }), sans_mandat: false,
    mandat_type: typeDe(d), mandat_taux: a.forfait ? null : tauxDe(a.taux), mandat_forfait: a.forfait || null,
    ...(numero ? { mandat_numero: numero } : {}),
    updated_at: new Date().toISOString(),
  };
}

export const MANDAT_RECHERCHE: Modele = {
  id: 'mandat_recherche',
  categorie: 'mandats_recherche',
  titre: 'Mandat de recherche',
  description: 'Simple ou exclusif, signé à la main, en ligne ou sur place : une société, deux associés. Signé, il remplit le bloc Mandat de sa recherche.',
  ic: 'loupe',
  signataires: 'Le ou les mandants, puis l’agence',
  etapes: ETAPES,
  defaut,
  titreDoc: d => `Mandat de recherche ${TYPES[typeDe(d)].nom} · ${nomMandant(d)}`,
  sousTitre: d => couper(rechercheDe(d).secteurs.join(', '), 80),
  pour: nomMandant,
  rediger,
  resume,
  garde: d => {
    const t = typeDe(d);
    return {
      titre: 'Mandat de recherche',
      sous: t === 'exclusif' ? 'exclusif, d’un local professionnel ou commercial' : 'simple, d’un local professionnel ou commercial',
      etiquette: `MANDAT ${TYPES[t].maj}${txt(d, 'numero') ? ` · N° ${txt(d, 'numero')}` : ''}`,
      pour: 'ÉTABLI POUR',
      ics: ['loupe', 'etiquette', 'euro', 'calendrier'],
    };
  },
  entete: d => `Mandat de recherche ${TYPES[typeDe(d)].nom}${txt(d, 'numero') ? ` n° ${txt(d, 'numero')}` : ''}`,
  manques,
  numero: true,
  registre: registreRecherche,
  badge: d => TYPES[typeDe(d)].court,
  reperes,
  echeances,
  lien: 'recherche',
  surRecherche,
  cases: casesRecherche,
  accepter: () => 'J’ai lu le mandat en entier, y compris les clauses écrites en capitales, et je l’accepte : bon pour mandat.',
};
