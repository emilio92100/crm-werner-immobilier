/* ═══ L'avenant au mandat de recherche ════════════════════════════════════
   Le demandeur monte son loyer maximum, ajoute un quartier, cherche aussi
   des bureaux, veut plus de temps, ou Werner change ses honoraires : le
   mandat signé ne se réécrit pas, on le modifie par un avenant, signé par
   les mêmes parties. Tout peut changer — le budget (loyer ou prix
   maximum), le local recherché, les secteurs, les honoraires, la durée — et
   une clause particulière, en texte libre, s'ajoute à volonté. Le reste du
   mandat reste inchangé.

   Il part d'un mandat de recherche signé : en ligne (depuis l'espace, table
   mandats_signatures) ou sur papier (Documents). La situation « actuelle »
   vient du mandat, et des avenants déjà signés à ce mandat (enchainer) ; la
   situation « nouvelle » vient de la recherche du moment, telle que le
   client l'a fait évoluer. Ce qui diffère est coché d'avance (preparer) :
   Werner relit, corrige, envoie. Les mots et les honoraires (HT, sur le
   loyer annuel ou sur le prix) sont ceux du mandat (mandat-recherche.ts).

   Pas de délai de rétractation : l'avenant modifie un mandat dont les 14
   jours ont déjà couru à sa signature, il n'en rouvre pas (choix
   d'Alexandre du 27 septembre 2026, à confirmer par son avocat ; comme
   l'avenant au mandat de vente). Un mandat terminé ne se prolonge pas par
   avenant, et un mandat simple ne devient pas exclusif par avenant : dans
   les deux cas, un nouveau mandat.

   ⚠️ Texte adapté pour Werner le 22 octobre 2026, à faire relire par un
   avocat avant le premier usage. */

import {
  euros, jourParis, BAREME, HONORAIRES_TAUX, tauxDe, forfaitDe, prixEtHonoraires, honorairesCourt, tauxTexte,
  decrireRecherche, decrireCourt, rechercheDepuis,
  type Recherche, type Contenu, type Mandant, type Societe, type Partie, type Bloc, type Fiche, type Resume,
} from '@/lib/mandat';
import { lignesMandataire, phraseFonds, type IdentiteAgence } from '@/lib/agence';
import {
  P, Pp, eurosLettres, nbLettres, pourcent, jourLong, aujourdhui, txt, num, liste, plusMois, couper,
  lirePersonnes, nomComplet, nomsCourts, fichePersonne, ficheAgence, blocDonnees, PERSONNE_VIDE,
  blocsSignature, manquesSignature, CHAMP_SIGNATURE, HONO_MODES,
  type Donnees, type Modele, type Etape, type Contexte, type Personne, type Repere, type Source, type CaseSignature,
} from './commun';
import { TYPES_BIEN, NATURES_R, typesDepuis } from './mandat-recherche';

type TypeR = 'simple' | 'exclusif';
const typeDe = (d: Donnees): TypeR => (d.type === 'exclusif' ? 'exclusif' : 'simple');
/* Le nom du mandat tel qu'il s'est appelé : « non exclusif » en ligne (son
   titre), « simple » ou « exclusif » sur papier. */
const nomMandat = (d: Donnees) => (typeDe(d) === 'exclusif' ? 'exclusif' : d.origine === 'en_ligne' ? 'non exclusif' : 'simple');
const change = (d: Donnees, k: string) => liste(d, 'objets').includes(k);
const enLigne = (d: Donnees) => d.origine === 'en_ligne';

function acquereursDe(d: Donnees): Personne[] {
  const l = lirePersonnes(d.acquereurs);
  return l.length ? l : [{ ...PERSONNE_VIDE }];
}
const nomMandant = (d: Donnees) => (d.qui === 'sci' ? txt(d, 'sciNom') || 'La société' : nomsCourts(acquereursDe(d)));
/* Les clauses de l'article 78, en caractères très apparents (comme au mandat papier). */
const MAJ = (t: string) => t.toLocaleUpperCase('fr-FR');
/* Les deux mandats s'étendent aux critères que le client donne ensuite :
   l'avenant le rappelle, pour que « remplacée » ne se lise pas comme une
   limite. */
const EXTENSION = 'Le mandat continue de s’étendre à tout local correspondant aux critères que le MANDANT communique ensuite à l’Agence, comme il le prévoit.';
const decoupe = (t: string) => t.split(/\s*[,;\n]\s*/).map(x => x.trim()).filter(Boolean);
const sansAccent = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ── Le local recherché : l'actuel (clés du mandat) ou le nouveau (suffixe 2,
   seulement pour ce qui change). ── */
function typesLibelles(d: Donnees, s: '' | '2'): string[] {
  return liste(d, 'types' + s).map(v => (v === 'autre' ? txt(d, 'typeAutre' + s) : TYPES_BIEN.find(t => t.v === v)?.l || '')).filter(Boolean);
}
/* Ce qu'il veut faire (prendre à bail, reprendre, acheter) : l'actuel, ou
   le nouveau quand le local recherché change. */
const naturesDe = (d: Donnees, s: '' | '2') => liste(d, 'natures' + s);
const naturesApres = (d: Donnees) => naturesDe(d, change(d, 'bien') ? '2' : '');
const loueN = (n: string[]) => !n.length || n.includes('location');
const acheteN = (n: string[]) => !n.length || n.some(x => x !== 'location');
const verbeN = (n: string[]) => (loueN(n) && acheteN(n) ? 'à prendre à bail, à reprendre ou à acquérir' : loueN(n) ? 'à prendre à bail' : 'à reprendre ou à acquérir');
const baseN = (n: string[]) => (loueN(n) && acheteN(n)
  ? 'du loyer annuel hors taxes et hors charges de la première année pour un bail, ou du prix hors honoraires pour une cession de droit au bail, de fonds de commerce ou une vente'
  : loueN(n) ? 'du loyer annuel hors taxes et hors charges de la première année du bail conclu'
    : 'du prix, hors honoraires, de la cession ou de la vente conclue');
function rechercheDe(d: Donnees, bien: boolean, secteurs: boolean): Recherche {
  const b = bien ? '2' : '';
  return {
    typeBien: typesLibelles(d, b).join(', ') || null,
    piecesMin: null,
    chambresMin: null,
    surfaceMin: num(d, 'surface' + b),
    secteurs: decoupe(txt(d, secteurs ? 'secteurs2' : 'secteurs')),
    budget: null,
    natures: naturesDe(d, b),
    activite: txt(d, 'activite' + b) || null,
  };
}
const rechercheApres = (d: Donnees) => rechercheDe(d, change(d, 'bien'), change(d, 'secteurs'));

/* ── L'argent ──
   Comme au mandat : un loyer annuel maximum HT HC (un bail) et/ou un prix
   maximum HORS honoraires (une cession, des murs) ; les honoraires, HT, sur
   le loyer annuel de la première année ou sur le prix. */
type Argent = {
  prix: number | null; loyer: number | null; honoPrix: number | null; honoLoyer: number | null;
  honoraires: number | null; total: number | null; taux: number | null; forfait: number | null;
};
function argentDe(n: string[], prix0: number | null, loyer0: number | null, mode: unknown, taux: number | null, forfaitV: unknown): Argent {
  const forfait = mode === 'forfait' ? forfaitDe(forfaitV) : null;
  const t = mode === 'forfait' ? null : taux;
  const prix = acheteN(n) && prix0 && prix0 > 0 ? prix0 : null;
  const loyer = loueN(n) && loyer0 && loyer0 > 0 ? loyer0 : null;
  const sur = (base: number | null) => (forfait ? (base ? forfait : null) : base && t !== null && t >= 0 ? Math.round((base * t) / 100) : null);
  const honoPrix = sur(prix), honoLoyer = sur(loyer);
  return { prix, loyer, honoPrix, honoLoyer, honoraires: honoPrix ?? honoLoyer ?? (forfait || null),
    total: prix && honoPrix !== null ? prix + honoPrix : null, taux: t, forfait };
}
const argentAvant = (d: Donnees) => argentDe(naturesDe(d, ''), num(d, 'prixMax'), num(d, 'loyerMax'), d.honoMode, num(d, 'taux'), d.forfait);
function argentApres(d: Donnees): Argent {
  const h = change(d, 'honoraires');
  return argentDe(
    naturesApres(d),
    change(d, 'prix') ? num(d, 'nouveauPrixMax') : num(d, 'prixMax'),
    change(d, 'prix') ? num(d, 'nouveauLoyerMax') : num(d, 'loyerMax'),
    h ? d.honoMode2 : d.honoMode, h ? num(d, 'taux2') : num(d, 'taux'), h ? d.forfait2 : d.forfait,
  );
}

/* ══ Les questions ══════════════════════════════════════════════════════ */
const ETAPES: Etape[] = [
  {
    id: 'mandat', titre: 'Le mandat', court: 'Le mandat', sous: 'Repris du mandat signé : vérifie, c’est tout.', vers: 'Entre les soussignés', ic: 'doc',
    champs: [
      { t: 'texte', cle: 'mandatNumero', lib: 'N° du mandat', ic: 'livre', requis: true },
      { t: 'date', cle: 'mandatDate', lib: 'Signé le', ic: 'calendrier', requis: true },
      { t: 'choix', cle: 'origine', lib: 'Il a été signé', ic: 'plume', options: [{ v: 'en_ligne', l: 'En ligne', ic: 'mail' }, { v: 'papier', l: 'Sur papier', ic: 'doc' }] },
      { t: 'choix', cle: 'type', lib: 'Mandat', ic: 'cadenas', options: [{ v: 'simple', l: 'Simple', ic: 'ouvert' }, { v: 'exclusif', l: 'Exclusif', ic: 'cadenas' }] },
      { t: 'nombre', cle: 'avenantNo', lib: 'Avenant n°', ic: 'plume', aide: 'Compté tout seul d’après les avenants déjà faits à ce mandat.' },
    ],
  },
  {
    id: 'parties', titre: 'Les mandants', court: 'Les mandants', sous: 'Les mêmes que sur le mandat : chacun signe l’avenant.', vers: 'Entre les soussignés', ic: 'couple',
    champs: [
      { t: 'titre', cle: 't-a', lib: 'Les mandants', ic: 'personne', aide: 'Les mêmes que sur le mandat : chacun signe l’avenant.' },
      { t: 'choix', cle: 'qui', lib: 'Qui cherche ?', ic: 'personne', options: [
        { v: 'sci', l: 'Une société', ic: 'immeuble' }, { v: 'personne', l: 'Une personne', ic: 'personne' }, { v: 'couple', l: 'Deux personnes', ic: 'couple' }, { v: 'plusieurs', l: 'Plusieurs personnes', ic: 'groupe' },
      ] },
      { t: 'texte', cle: 'sciNom', lib: 'Nom de la société', ic: 'immeuble', requis: true, si: d => d.qui === 'sci' },
      /* V3.177 : la forme, le siège et l'immatriculation, facultatifs : une question Oui / Non. */
      { t: 'texte', cle: 'sciForme', lib: 'Forme', ic: 'doc', si: d => d.qui === 'sci', exemple: 'SAS',
        question: 'Préciser sa forme, son siège et son immatriculation ?', avec: ['sciSiege', 'sciRcs'] },
      { t: 'texte', cle: 'sciSiege', lib: 'Siège social', ic: 'lieu', large: true, si: d => d.qui === 'sci' },
      { t: 'texte', cle: 'sciRcs', lib: 'Immatriculation', ic: 'livre', si: d => d.qui === 'sci', exemple: 'RCS de Paris n° 123 456 789' },
      { t: 'personnes', cle: 'acquereurs', lib: 'Les mandants', ic: 'personne', un: 'Signataire', min: 1, max: 6, complet: d => d.qui !== 'sci',
        bornes: d => (d.qui === 'couple' ? { min: 2, max: 2 } : d.qui === 'plusieurs' ? { min: 2, max: 6 } : { min: 1, max: 1 }),
        nomCarte: (d, i) => (d.qui === 'sci' ? 'Celui qui signe pour la société' : d.qui === 'personne' ? 'Le mandant' : `Signataire ${i + 1}`),
        ajouter: () => 'Ajouter une personne' },
      { t: 'texte', cle: 'sciPouvoir', lib: 'Sa qualité', ic: 'plume', large: true, si: d => d.qui === 'sci', exemple: 'président', question: 'Préciser la qualité du signataire ?' },
    ],
  },
  {
    id: 'changements', titre: 'Ce qui change', court: 'Ce qui change', sous: 'Ce qui a bougé dans sa recherche est déjà coché : relis, corrige, ajoute.', vers: 'Il a été convenu ce qui suit', reperesApres: 'nouveauPrixMax', ic: 'plume',
    champs: [
      { t: 'cases', cle: 'objets', lib: 'L’avenant modifie', ic: 'plume', options: [
        { v: 'prix', l: 'Le budget', ic: 'etiquette' }, { v: 'bien', l: 'Le local recherché', ic: 'vitrine' },
        { v: 'secteurs', l: 'Les secteurs', ic: 'lieu' }, { v: 'honoraires', l: 'Les honoraires', ic: 'euro' },
        { v: 'duree', l: 'La durée', ic: 'calendrier' }, { v: 'clause', l: 'Une clause particulière', ic: 'plume' },
      ] },
      { t: 'guide', cle: 'g-av', si: d => change(d, 'clause') || change(d, 'duree'), titre: () => 'Un avenant ne change pas tout', points: () => [
        { ic: 'cadenas', x: 'Passer d’un mandat simple à un mandat exclusif : signe un nouveau mandat, avec un nouveau numéro de registre.' },
        { ic: 'calendrier', x: 'Un mandat déjà terminé ne se prolonge pas : il faut un nouveau mandat.' },
      ] },
      { t: 'titre', cle: 't-prix', lib: 'Le budget', ic: 'etiquette', si: d => change(d, 'prix') },
      { t: 'euros', cle: 'loyerMax', lib: 'Loyer annuel maximum actuel', ic: 'etiquette', unite: '€ HT HC par an', si: d => change(d, 'prix') && loueN(naturesApres(d)), aide: 'Celui du mandat, ou du dernier avenant signé.' },
      { t: 'euros', cle: 'nouveauLoyerMax', lib: 'Nouveau loyer annuel maximum', ic: 'etiquette', unite: '€ HT HC par an', si: d => change(d, 'prix') && loueN(naturesApres(d)) },
      { t: 'euros', cle: 'prixMax', lib: 'Prix maximum actuel', ic: 'etiquette', unite: '€ hors honoraires', si: d => change(d, 'prix') && acheteN(naturesApres(d)), aide: 'Celui du mandat, ou du dernier avenant signé.' },
      { t: 'euros', cle: 'nouveauPrixMax', lib: 'Nouveau prix maximum', ic: 'etiquette', unite: '€ hors honoraires', si: d => change(d, 'prix') && acheteN(naturesApres(d)),
        aide: 'Pour une cession ou des murs. Hors honoraires : ils viennent en plus.' },
      { t: 'titre', cle: 't-bien', lib: 'Le local recherché', ic: 'vitrine', si: d => change(d, 'bien'), aide: 'La nouvelle description remplace celle du mandat : corrige ce qui change.' },
      { t: 'cases', cle: 'natures2', lib: 'Il veut', ic: 'cle', si: d => change(d, 'bien'), options: NATURES_R.map(n => ({ v: n.v, l: n.l, ic: n.ic })) },
      { t: 'cases', cle: 'types2', lib: 'Type de local', ic: 'vitrine', si: d => change(d, 'bien'), options: TYPES_BIEN },
      { t: 'texte', cle: 'typeAutre2', lib: 'Précisez', ic: 'plume', large: true, si: d => change(d, 'bien') && liste(d, 'types2').includes('autre'), exemple: 'un showroom, une cave, un local de stockage…' },
      { t: 'nombre', cle: 'surface2', lib: 'Surface', ic: 'regle', unite: 'm² environ ou plus', si: d => change(d, 'bien') },
      { t: 'texte', cle: 'activite2', lib: 'Son activité', ic: 'sac', large: true, si: d => change(d, 'bien'), exemple: 'restauration rapide, cabinet de conseil…', question: 'Préciser son activité ?' },
      { t: 'zone', cle: 'criteres2', lib: 'Ses critères essentiels', ic: 'etoile', large: true, si: d => change(d, 'bien'),
        exemple: 'une extraction, une vitrine sur rue, un emplacement n° 1', question: 'Préciser ses critères essentiels ?', aide: 'Imprimés tels quels.' },
      { t: 'titre', cle: 't-sect', lib: 'Les secteurs', ic: 'lieu', si: d => change(d, 'secteurs') },
      { t: 'zone', cle: 'secteurs2', lib: 'Où il cherche désormais', ic: 'lieu', large: true, requis: true, si: d => change(d, 'secteurs'),
        exemple: 'Paris 8e, Paris 17e, Levallois-Perret', aide: 'Tous les secteurs, anciens et nouveaux, séparés par des virgules : la liste remplace celle du mandat.' },
      { t: 'titre', cle: 't-hono', lib: 'Les honoraires', ic: 'euro', si: d => change(d, 'honoraires') },
      { t: 'choix', cle: 'honoMode2', lib: 'Honoraires', ic: 'euro', si: d => change(d, 'honoraires'), options: HONO_MODES },
      { t: 'nombre', cle: 'taux2', lib: 'Nouveau taux', ic: 'pourcent', unite: '% HT', si: d => change(d, 'honoraires') && d.honoMode2 !== 'forfait',
        aide: 'Du loyer annuel HT HC de la première année pour un bail, du prix pour une cession ou des murs. TVA en sus.' },
      { t: 'euros', cle: 'forfait2', lib: 'Nouveau forfait', ic: 'euro', unite: '€ HT', si: d => change(d, 'honoraires') && d.honoMode2 === 'forfait', aide: 'Un montant fixe, hors taxes. TVA en sus.' },
      { t: 'titre', cle: 't-duree', lib: 'La durée', ic: 'calendrier', si: d => change(d, 'duree') },
      { t: 'date', cle: 'finActuelle', lib: 'Il devait finir le', ic: 'calendrier', si: d => change(d, 'duree') },
      { t: 'date', cle: 'finNouvelle', lib: 'Il finira le', ic: 'chrono', requis: true, si: d => change(d, 'duree') },
      { t: 'titre', cle: 't-clause', lib: 'La clause particulière', ic: 'plume', si: d => change(d, 'clause') },
      { t: 'zone', cle: 'clause', lib: 'Le texte', ic: 'plume', large: true, requis: true, si: d => change(d, 'clause'),
        exemple: 'La recherche est étendue aux locaux nécessitant des travaux d’aménagement.', aide: 'Une condition, une précision, toute autre modification : imprimée telle quelle.' },
    ],
  },
  {
    id: 'signature', titre: 'Signature', court: 'Signature', sous: 'Comment, où et quand il sera signé.', vers: 'Date et signatures', ic: 'plume',
    champs: [
      CHAMP_SIGNATURE,
      { t: 'texte', cle: 'faitA', lib: 'Fait à', ic: 'lieu', requis: true },
      { t: 'date', cle: 'date', lib: 'Le', ic: 'calendrier', requis: true },
    ],
  },
];

/* ══ Le texte ═══════════════════════════════════════════════════════════ */
function rediger(d: Donnees, A: IdentiteAgence): Partie[] {
  const as = acquereursDe(d);
  const no = num(d, 'avenantNo') || 1;
  const numero = txt(d, 'mandatNumero');
  const date = txt(d, 'mandatDate');
  const sci = d.qui === 'sci';
  const [g, ...autres] = as;

  /* ── Les parties : les mêmes qu'au mandat ── */
  const fiches: Fiche[] = [];
  if (sci) {
    fiches.push({ ic: 'agence', titre: (txt(d, 'sciNom') || 'La société').toUpperCase(), lignes: [
      txt(d, 'sciForme'), txt(d, 'sciSiege') ? `Siège : ${txt(d, 'sciSiege')}` : '', txt(d, 'sciRcs'),
      `Représentée par ${nomComplet(g)}${txt(d, 'sciPouvoir') ? `, ${txt(d, 'sciPouvoir')}` : ''}.`,
    ].filter(Boolean), ...(autres.length ? {} : { pied: 'Ci-après « le MANDANT »' }) });
    autres.forEach((p, i) => fiches.push(fichePersonne(p, 'personne', i === autres.length - 1 ? 'Ci-après ensemble « le MANDANT »' : undefined)));
  } else {
    /* Sur papier, deux personnes ou plus signent « solidairement » (le
       mandat le dit) ; en ligne, la solidarité ne porte que sur les
       honoraires d'une affaire commune : l'avenant n'en redit rien. */
    const ensemble = !enLigne(d) && as.length > 1 ? 'Ci-après ensemble « le MANDANT », agissant solidairement' : 'Ci-après ensemble « le MANDANT »';
    as.forEach((p, i) => fiches.push(fichePersonne(p, 'personne',
      i === as.length - 1 ? (as.length > 1 ? ensemble : 'Ci-après « le MANDANT »') : undefined)));
  }
  fiches.push(ficheAgence(A, lignesMandataire(A), phraseFonds(A), 'Ci-après « l’Agence » ou « le MANDATAIRE »'));
  const entre: Bloc[] = [{ t: 'fiches', items: fiches }];
  if (sci && d.sciPerso === true) entre.push(P(`${nomComplet(g)} signe le présent avenant tant pour la société qu’en son nom personnel, comme au mandat.`));

  const sections: Partie['sections'] = [
    { titre: 'Entre les soussignés', blocs: entre },
    { titre: 'Il a été convenu ce qui suit', blocs: [
      P(`Par un mandat de recherche ${nomMandat(d)}${numero ? ` n° ${numero}` : ' n° ……'}, signé ${enLigne(d) ? 'en ligne ' : ''}le ${date ? jourLong(date) : '……………'}, le MANDANT a confié au MANDATAIRE la mission de rechercher pour son compte un local à usage professionnel ou commercial ${verbeN(naturesDe(d, ''))}, et de l’assister jusqu’à la signature du bail ou de l’acte. Les parties conviennent de modifier ce mandat comme suit.`, true),
    ] },
  ];

  const av = argentAvant(d), ap = argentApres(d);
  if (change(d, 'prix')) {
    const blocs: Bloc[] = [];
    const fixe = (num(d, 'avenantNo') || 1) > 1 ? 'fixé en dernier lieu à' : 'fixé au mandat à';
    const n = naturesApres(d);
    const loyerChange = loueN(n) && ap.loyer && ap.loyer !== av.loyer;
    const prixChange = acheteN(n) && ap.prix && ap.prix !== av.prix;
    if (loyerChange && ap.loyer) {
      const verbe = av.loyer && ap.loyer < av.loyer ? 'ramené' : 'porté';
      blocs.push(P(`Le loyer annuel maximum, hors taxes et hors charges${av.loyer ? `, ${fixe} ${euros(av.loyer)},` : ''} est ${verbe} à ${eurosLettres(ap.loyer)}.`, true));
    }
    if (prixChange && ap.prix) {
      const verbe = av.prix && ap.prix < av.prix ? 'ramené' : 'porté';
      blocs.push(P(`Le prix maximum d’une cession ou d’une acquisition, hors honoraires${av.prix ? `, ${fixe} ${euros(av.prix)},` : ''} est ${verbe} à ${eurosLettres(ap.prix)}.`, true));
      if (ap.total) blocs.push(P(`Avec les honoraires de l’Agence (hors TVA), le budget du MANDANT pour une cession ou une acquisition est donc de ${euros(ap.total)} au plus.`));
    }
    if (!blocs.length) blocs.push(P('Nouveau loyer ou prix maximum : à compléter.', true));
    else if (!change(d, 'honoraires') && ap.honoraires !== null) {
      blocs.push(P(ap.forfait
        ? `Les honoraires restent ceux du mandat : un forfait de ${euros(ap.forfait)} HT, TVA en sus.`
        : `Les honoraires restent calculés comme prévu au mandat, soit ${[
          prixChange && ap.honoPrix !== null ? `${euros(ap.honoPrix)} HT à ce prix maximum` : '',
          loyerChange && ap.honoLoyer !== null ? `${euros(ap.honoLoyer)} HT pour ce loyer` : '',
        ].filter(Boolean).join(', ou ')}, TVA en sus.`));
    }
    sections.push({ titre: 'Budget', ic: 'etiquette', blocs });
  }

  if (change(d, 'bien')) {
    const r = rechercheApres(d);
    const phrase = decrireRecherche(r);
    const blocs: Bloc[] = [
      P(`La description du local recherché figurant au mandat est remplacée par la suivante : ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`, true),
    ];
    if (txt(d, 'criteres2')) blocs.push(P(`Critères essentiels pour le MANDANT : ${txt(d, 'criteres2').replace(/\.$/, '')}.`));
    else if (txt(d, 'criteres')) blocs.push(P('Les critères essentiels cités au mandat ne s’appliquent plus.'));
    blocs.push(P(EXTENSION));
    sections.push({ titre: 'Le local recherché', ic: 'agence', blocs });
  } else if (change(d, 'secteurs')) {
    const nouveaux = decoupe(txt(d, 'secteurs2'));
    const anciens = decoupe(txt(d, 'secteurs'));
    sections.push({ titre: 'Les secteurs', ic: 'loupe', blocs: [
      P(nouveaux.length
        ? `Le MANDANT recherche désormais un local situé à ${nouveaux.join(', ').replace(/, ([^,]*)$/, ' ou $1')}, ou à proximité.`
        : 'Les secteurs de recherche : à compléter.', true),
      ...(anciens.length ? [P(`Ces secteurs remplacent ceux cités au mandat (${anciens.join(', ')}). Le reste de la description du local recherché est inchangé.`)] : []),
      P(EXTENSION),
    ] });
  }

  if (change(d, 'honoraires')) {
    const blocs: Bloc[] = [];
    const n = naturesApres(d);
    if (ap.forfait) {
      blocs.push(P(`Les honoraires de l’Agence sont désormais un forfait de ${eurosLettres(ap.forfait)} HT, TVA en sus, à la charge du MANDANT, en plus du loyer ou du prix.`, true));
    } else {
      const exemples = [
        acheteN(n) && ap.prix && ap.honoPrix !== null ? `${euros(ap.honoPrix)} HT pour un prix de ${euros(ap.prix)}` : '',
        loueN(n) && ap.loyer && ap.honoLoyer !== null ? `${euros(ap.honoLoyer)} HT pour un loyer annuel de ${euros(ap.loyer)}` : '',
      ].filter(Boolean).join(' ou ');
      blocs.push(P(`Les honoraires de l’Agence sont désormais de ${ap.taux !== null ? `${tauxTexte(ap.taux)} ${baseN(n)}${exemples ? `, soit ${exemples}` : ''}, TVA en sus` : '……'}.`, true));
      blocs.push(P('Ils sont à la charge du MANDANT, en plus du loyer ou du prix.'));
    }
    blocs.push(P('Ils restent dus dans les conditions prévues au mandat. Lorsqu’ils sont dus, ils sont payés le jour de la signature du bail, ou de l’acte de cession ou de vente : aucune somme n’est due, ni ne peut être versée à l’Agence, avant (article 6 de la loi du 2 janvier 1970).'));
    /* Le mandat papier prévoit des indemnités égales aux honoraires (clause
       de suite, clause pénale), en capitales : elles suivent le changement. */
    if (!enLigne(d)) blocs.push(P(MAJ('Toute indemnité prévue au mandat et égale aux honoraires est calculée sur les honoraires ainsi modifiés.'), true));
    sections.push({ titre: 'Honoraires', ic: 'euro', blocs });
  }

  if (change(d, 'duree')) {
    const fin = txt(d, 'finNouvelle'), avant = txt(d, 'finActuelle');
    const blocs: Bloc[] = d.dureeMode === 'prorogation'
      ? [P(`La limite de la durée totale du mandat est reportée au ${fin ? jourLong(fin) : '……………'}${avant ? `, au lieu du ${jourLong(avant)}` : ''}. Les autres règles de durée prévues au mandat sont inchangées.`, true)]
      : [P(`Le mandat est prolongé : il prendra fin le ${fin ? jourLong(fin) : '……………'}${avant ? `, au lieu du ${jourLong(avant)}` : ''}. Il prend fin de plein droit à cette date, sans reconduction.`, true)];
    if (typeDe(d) === 'exclusif') blocs.push(P(MAJ('L’exclusivité prévue au mandat s’applique jusqu’à cette nouvelle date.'), true));
    blocs.push(typeDe(d) === 'exclusif'
      ? P('Passé un délai de trois mois à compter de la signature du mandat, chaque partie peut y mettre fin à tout moment, par lettre recommandée avec avis de réception, avec un préavis de quinze jours (article 78 du décret du 20 juillet 1972).')
      : P('Chaque partie conserve la faculté d’y mettre fin à tout moment, avec un préavis de quinze jours, dans les formes prévues au mandat.'));
    sections.push({ titre: 'Durée', ic: 'calendrier', blocs });
  }

  if (change(d, 'clause')) sections.push({ titre: 'Clause particulière', ic: 'plume', blocs: [P(txt(d, 'clause') || 'À compléter.')] });

  sections.push({ titre: 'Le reste du mandat', ic: 'doc', blocs: [
    P(`Toutes les autres clauses du mandat demeurent inchangées. Le présent avenant en fait partie intégrante et se rattache à son numéro d’inscription au registre des mandats de l’Agence${numero ? ` (n° ${numero})` : ''}.`),
  ] });

  sections.push({ titre: 'Informations', ic: 'info', blocs: [
    blocDonnees(A),
    Pp(`Textes applicables : loi n° 70-9 du 2 janvier 1970 (dite loi Hoguet, art. 6 et 7) et décret n° 72-678 du 20 juillet 1972 (art. 72 et 78). Le présent avenant est soumis à la loi française.`),
  ] });

  const nbSig = (sci ? 1 + autres.length : as.length) + 1;
  sections.push({ titre: 'Date et signatures', ic: 'plume', blocs: blocsSignature(d, {
    papier: `Fait à ${txt(d, 'faitA') || '……………'}, le ${txt(d, 'date') ? jourLong(txt(d, 'date')) : '……………'}, en ${nbLettres(nbSig)} exemplaires originaux, dont un remis à chaque partie.`,
    mention: 'Chaque signataire date et signe, précédé de la mention manuscrite « Lu et approuvé ».',
    cases: casesAvenant(d, A),
  }) });

  const parties: Partie[] = [{
    titre: `Avenant n° ${no} au mandat de recherche${numero ? ` n° ${numero}` : ''}`,
    court: 'L’avenant',
    sous: `Au mandat de recherche ${nomMandat(d)}${date ? ` du ${jourLong(date)}` : ''}`,
    ic: 'doc',
    sections,
  }];
  return parties;
}

/* « Loyer maximum : 60 000 € HT HC · Secteurs : Paris 8e, Paris 17e » */
function changements(d: Donnees): string[] {
  const ap = argentApres(d), av = argentAvant(d);
  const out: string[] = [];
  if (change(d, 'prix')) {
    const bouts = [
      ap.loyer && ap.loyer !== av.loyer ? `loyer ${euros(ap.loyer)} HT HC` : '',
      ap.prix && ap.prix !== av.prix ? `prix ${euros(ap.prix)}` : '',
    ].filter(Boolean);
    out.push(`Budget : ${bouts.join(', ') || '…'}`);
  }
  if (change(d, 'bien')) out.push('Le local recherché');
  if (change(d, 'secteurs')) {
    /* Ce qui s'ajoute ou disparaît, plutôt que toute la liste. */
    const avant = decoupe(txt(d, 'secteurs')), apres = decoupe(txt(d, 'secteurs2'));
    const plus = apres.filter(x => !avant.some(y => sansAccent(y) === sansAccent(x)));
    const moins = avant.filter(x => !apres.some(y => sansAccent(y) === sansAccent(x)));
    const ecart = [plus.length ? `+ ${plus.join(', ')}` : '', moins.length ? `− ${moins.join(', ')}` : ''].filter(Boolean).join(' ; ');
    out.push(`Secteurs : ${couper(ecart || apres.join(', '), 48) || '…'}`);
  }
  if (change(d, 'honoraires')) out.push(`Honoraires : ${ap.forfait ? `${euros(ap.forfait)} HT` : ap.taux !== null ? tauxTexte(ap.taux) : '…'}`);
  if (change(d, 'duree')) out.push(`Fin : ${txt(d, 'finNouvelle') ? jourLong(txt(d, 'finNouvelle')) : '…'}`);
  if (change(d, 'clause')) out.push('Une clause particulière');
  return out;
}

function resume(d: Donnees): Resume {
  const ch = changements(d);
  const court = decrireCourt(rechercheApres(d));
  return [
    { titre: 'Le mandat', valeur: txt(d, 'mandatNumero') ? `N° ${txt(d, 'mandatNumero')}` : 'À compléter',
      detail: `mandat ${nomMandat(d)}${enLigne(d) ? ' signé en ligne' : ''}${txt(d, 'mandatDate') ? `${enLigne(d) ? '' : ', signé'} le ${jourLong(txt(d, 'mandatDate'))}` : ''}` },
    { titre: 'Le local recherché', valeur: court.valeur, detail: court.detail },
    { titre: 'Ce qui change', valeur: ch[0] || 'À compléter', detail: ch.slice(1).join(' · ') || '—' },
    { titre: 'Le reste', valeur: 'Inchangé', detail: 'toutes les autres clauses du mandat' },
  ];
}

function reperes(d: Donnees, etape: string): Repere[] {
  const out: Repere[] = [];
  if (etape !== 'changements') return out;
  const ap = argentApres(d);
  if (change(d, 'prix') || change(d, 'honoraires')) {
    const lib = ap.forfait ? 'Honoraires (forfait)' : `Honoraires (${tauxTexte(ap.taux || 0)})`;
    if (ap.loyer) out.push({ l: 'Loyer annuel maximum', v: `${euros(ap.loyer)} HT HC` });
    if (ap.loyer && ap.honoLoyer !== null) out.push({ l: `${lib}, sur ce loyer`, v: `${euros(ap.honoLoyer)} HT` });
    if (ap.prix) out.push({ l: 'Prix maximum, hors honoraires', v: euros(ap.prix) });
    if (ap.prix && ap.honoPrix !== null) out.push({ l: `${lib}, sur ce prix`, v: `${euros(ap.honoPrix)} HT` });
    if (ap.total) out.push({ l: 'Son budget, honoraires compris', v: euros(ap.total), ton: 'ok' });
    const budget = num(d, 'budgetFiche');
    if (ap.total && budget && ap.total > budget) out.push({ l: 'Au-dessus de sa fiche', v: `Son budget enregistré est de ${euros(budget)}, honoraires compris.`, ton: 'alerte' });
  }
  if (change(d, 'honoraires') && !ap.forfait && ap.taux !== null && ap.taux > BAREME) out.push({ l: 'Taux très élevé', v: `Au-dessus de ${pourcent(BAREME)} : vérifie la saisie.`, ton: 'alerte' });
  if (change(d, 'duree') && txt(d, 'finNouvelle') && txt(d, 'finActuelle') && txt(d, 'finNouvelle') <= txt(d, 'finActuelle')) {
    out.push({ l: 'Durée', v: 'La nouvelle fin doit venir après l’ancienne.', ton: 'alerte' });
  }
  if (!liste(d, 'objets').length) out.push({ l: 'Rien à modifier', v: 'Coche au moins une modification.', ton: 'alerte' });
  const clause = sansAccent(txt(d, 'clause'));
  if (change(d, 'clause') && /exclusi/.test(clause)) out.push({ l: 'Exclusivité', v: 'Un mandat simple ne devient pas exclusif par avenant : il faut un nouveau mandat.', ton: 'alerte' });
  if (change(d, 'clause') && /prolong|reconduc|prorog/.test(clause)) out.push({ l: 'Durée', v: 'Pour prolonger le mandat, coche plutôt « La durée » : la date s’y écrit proprement.', ton: 'alerte' });
  return out;
}

/* Les cadres de signature : les mêmes signataires qu'au mandat (la société
   par son représentant, puis ceux qui signent en leur nom), puis l'agence. */
function casesAvenant(d: Donnees, A?: IdentiteAgence): CaseSignature[] {
  const as = acquereursDe(d);
  const [g, ...autres] = as;
  const out: CaseSignature[] = d.qui === 'sci'
    ? [
      { cle: 'sci', qui: 'Le mandant', nom: txt(d, 'sciNom') || 'La société', lignes: [`Représentée par ${nomComplet(g)}`, ...(d.sciPerso === true ? ['et en son nom personnel'] : [])], personne: g },
      ...autres.map((p, i): CaseSignature => ({ cle: `a${i + 1}`, qui: 'Le mandant', nom: nomComplet(p), lignes: [] as string[], personne: p })),
    ]
    : as.map((p, i): CaseSignature => ({ cle: `a${i}`, qui: 'Le mandant', nom: nomComplet(p), lignes: [] as string[], personne: p }));
  if (A) out.push({ cle: 'agence', qui: 'Le mandataire', nom: A.nom.toUpperCase(), lignes: [`Représentée par ${A.signataireNom}, ${A.signataireQualite}`], agence: true });
  return out;
}

function manques(d: Donnees): string[] {
  const out: string[] = [];
  if (!txt(d, 'mandatNumero') || !txt(d, 'mandatDate')) out.push('Le numéro et la date du mandat');
  if (d.mandatSigne === false) out.push('Un mandat signé : celui-ci ne l’est pas encore, il se modifie avant signature');
  if (d.mandatPartiel === true) out.push('Toutes les signatures du mandat : quelqu’un doit encore le signer (ou clos son invitation) avant l’avenant');
  if (enLigne(d) && typeDe(d) === 'exclusif') out.push('Un mandat simple : un mandat signé en ligne n’est jamais exclusif');
  if (txt(d, 'date') && txt(d, 'mandatDate') && txt(d, 'date') < txt(d, 'mandatDate')) out.push('Une date de signature après celle du mandat');
  const as = acquereursDe(d);
  as.forEach((p, i) => {
    if (!p.nom || !p.prenom) out.push(`Le nom ${d.qui === 'sci' && i === 0 ? 'de celui qui signe pour la société' : as.length > 1 ? `de la personne ${i + 1}` : 'du mandant'}`);
  });
  if (d.qui === 'sci' && !txt(d, 'sciNom')) out.push('Le nom de la société');
  if (!liste(d, 'objets').length) out.push('Ce que l’avenant modifie');
  if (change(d, 'prix')) {
    const n = naturesApres(d);
    const nl = loueN(n) ? num(d, 'nouveauLoyerMax') : null, np = acheteN(n) ? num(d, 'nouveauPrixMax') : null;
    if (!nl && !np) out.push(loueN(n) && acheteN(n) ? 'Le nouveau loyer ou prix maximum' : loueN(n) ? 'Le nouveau loyer annuel maximum' : 'Le nouveau prix maximum');
    else if ((!nl || nl === num(d, 'loyerMax')) && (!np || np === num(d, 'prixMax'))) out.push('Un nouveau loyer ou prix maximum, différent de l’actuel');
  }
  if (change(d, 'bien') && !typesLibelles(d, '2').length) out.push('Le type de local recherché');
  if (change(d, 'secteurs') && !decoupe(txt(d, 'secteurs2')).length) out.push('Les secteurs où il cherche');
  if (change(d, 'honoraires')) {
    const ap = argentApres(d);
    if (d.honoMode2 === 'forfait' ? !ap.forfait : ap.taux === null) out.push('Les nouveaux honoraires');
    else if (!ap.forfait && ap.taux !== null && ap.taux > BAREME) out.push(`Un taux de ${pourcent(BAREME)} HT au plus (vérifie la saisie)`);
  }
  if (change(d, 'duree') && !txt(d, 'finActuelle')) out.push('La date de fin actuelle du mandat');
  if (change(d, 'duree') && !txt(d, 'finNouvelle')) out.push('La nouvelle date de fin');
  else if (change(d, 'duree') && txt(d, 'finActuelle') && txt(d, 'finNouvelle') <= txt(d, 'finActuelle')) out.push('Une nouvelle date de fin après l’ancienne');
  if (change(d, 'clause') && !txt(d, 'clause')) out.push('Le texte de la clause particulière');
  if (txt(d, 'finActuelle') && txt(d, 'date') && txt(d, 'date') >= txt(d, 'finActuelle')) out.push(`Un mandat en cours : celui-ci a pris fin le ${jourLong(txt(d, 'finActuelle'))}, il faut en signer un nouveau`);
  if (!txt(d, 'faitA') || !txt(d, 'date')) out.push('Le lieu et la date de signature');
  /* Pas de « lieu » dans l'avenant : un ancien choix ne bloque rien. */
  out.push(...manquesSignature({ ...d, lieu: '' }, casesAvenant(d)));
  return out;
}

/* ══ D'où partent les réponses ═══════════════════════════════════════════ */

/* Les réponses du « nouveau » : ce que la recherche du moment dit. */
function nouveauDepuis(r: Recherche | null): Donnees {
  if (!r) return {};
  const { types, autre } = typesDepuis(r.typeBien);
  const forfait = forfaitDe(r.forfait);
  const taux = tauxDe(r.taux);
  return {
    nouveauPrixMax: prixEtHonoraires(r.budget, { taux, forfait }).prixMax, nouveauLoyerMax: r.loyerMax ?? null,
    natures2: r.natures || [], types2: types, typeAutre2: autre, surface2: r.surfaceMin, activite2: r.activite || '',
    secteurs2: r.secteurs.join(', '),
    honoMode2: forfait ? 'forfait' : 'taux', taux2: forfait ? HONORAIRES_TAUX : taux, forfait2: forfait,
    budgetFiche: r.budget,
  };
}

/* Sans mandat choisi : le client et sa recherche. */
function defaut(c: Contexte): Donnees {
  const cl = c.client;
  const p: Personne = { ...PERSONNE_VIDE, prenom: cl?.prenom || '', nom: cl?.nom || '', adresse: cl?.adresse || '', email: cl?.emails?.[0] || '', telephone: cl?.telephones?.[0] || '' };
  const r = c.recherche || null;
  const rech = r ? rechercheDepuis(r) : null;
  const { types, autre } = typesDepuis(rech?.typeBien);
  const forfait = rech ? forfaitDe(rech.forfait) : null;
  const taux = rech ? tauxDe(rech.taux) : HONORAIRES_TAUX;
  const jour = r && typeof r.mandat_date_signature === 'string' ? r.mandat_date_signature.slice(0, 10) : '';
  const fin = r && typeof r.mandat_date_expiration === 'string' ? r.mandat_date_expiration.slice(0, 10) : '';
  return {
    mandatNumero: r && typeof r.mandat_numero === 'string' ? r.mandat_numero.trim() : '', mandatDate: jour,
    origine: 'en_ligne', type: r?.mandat_type === 'exclusif' ? 'exclusif' : 'simple', avenantNo: 1,
    qui: 'personne', acquereurs: [p], sciNom: '', sciForme: '', sciSiege: '', sciRcs: '', sciPouvoir: '',
    natures: rech?.natures || [], types: types.length ? types : ['local'], typeAutre: autre,
    surface: rech?.surfaceMin ?? null, activite: rech?.activite || '',
    secteurs: rech?.secteurs.join(', ') || '', criteres: '',
    prixMax: rech ? prixEtHonoraires(rech.budget, { taux, forfait }).prixMax : null, loyerMax: rech?.loyerMax ?? null,
    honoMode: forfait ? 'forfait' : 'taux', taux: forfait ? HONORAIRES_TAUX : taux, forfait,
    dureeMode: 'fixe', finActuelle: fin,
    objets: [], ...nouveauDepuis(rech), criteres2: '', finNouvelle: '', clause: '',
    signature: 'en_ligne', faitA: c.identite.ville, date: aujourdhui(),
  };
}

/* Les réponses « actuelles », reprises d'un mandat de recherche papier. */
const REPRIS_PAPIER = ['type', 'qui', 'acquereurs', 'sciNom', 'sciForme', 'sciSiege', 'sciRcs', 'sciPouvoir',
  'natures', 'types', 'typeAutre', 'surface', 'activite', 'secteurs', 'criteres',
  'prixMax', 'loyerMax', 'honoMode', 'taux', 'forfait', 'dureeMode'];

function deriver(src: Source): Donnees {
  const s = src.donnees || {};
  const out: Donnees = {};
  const reprises = src.modele === 'mandat_en_ligne' ? [...REPRIS_PAPIER, 'sciPerso', 'finActuelle'] : REPRIS_PAPIER;
  for (const k of reprises) if (k in s) out[k] = s[k];
  /* V3.50 : le jour de la signature à l'heure de Paris, pas en heure universelle. */
  const jour = src.signe_le ? jourParis(src.signe_le) : String(s.date || '').slice(0, 10);
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(jour);
  if (src.modele !== 'mandat_en_ligne') {
    const total = s.dureeMode === 'prorogation' ? (num(s, 'dureeMax') ?? 12) : (num(s, 'duree') ?? 12);
    out.finActuelle = ok ? plusMois(jour, total) : '';
  }
  return {
    ...out,
    origine: src.modele === 'mandat_en_ligne' ? 'en_ligne' : 'papier',
    mandatNumero: src.numero || txt(s, 'numero'), mandatDate: ok ? jour : '',
    mandatSigne: !!src.signe_le, mandatPartiel: src.modele === 'mandat_en_ligne' && s.statut === 'partiel',
  };
}

/* Un avenant déjà signé à ce mandat : ce qu'il a changé devient la
   situation actuelle du suivant. */
function enchainer(d: Donnees, a: Donnees): Donnees {
  const x: Donnees = { ...d };
  const ch = (k: string) => liste(a, 'objets').includes(k);
  if (ch('prix') && num(a, 'nouveauPrixMax')) x.prixMax = num(a, 'nouveauPrixMax');
  if (ch('prix') && num(a, 'nouveauLoyerMax')) x.loyerMax = num(a, 'nouveauLoyerMax');
  if (ch('bien')) {
    x.natures = liste(a, 'natures2'); x.types = liste(a, 'types2'); x.typeAutre = txt(a, 'typeAutre2');
    x.surface = num(a, 'surface2'); x.activite = txt(a, 'activite2'); x.criteres = txt(a, 'criteres2');
  }
  if (ch('secteurs') && txt(a, 'secteurs2')) x.secteurs = txt(a, 'secteurs2');
  if (ch('honoraires')) { x.honoMode = a.honoMode2; x.taux = a.taux2; x.forfait = a.forfait2; }
  if (ch('duree') && txt(a, 'finNouvelle')) x.finActuelle = txt(a, 'finNouvelle');
  return x;
}

/* Une fois tout repris : le « nouveau » manquant copie l'actuel, et ce qui
   diffère (sa recherche a bougé) est coché d'avance. */
function preparer(d: Donnees): Donnees {
  const x: Donnees = { ...d };
  const vide = (k: string) => x[k] === null || x[k] === undefined || x[k] === '' || (Array.isArray(x[k]) && !(x[k] as unknown[]).length);
  for (const [n, a] of [['natures2', 'natures'], ['types2', 'types'], ['typeAutre2', 'typeAutre'], ['activite2', 'activite'],
    ['surface2', 'surface'], ['criteres2', 'criteres'], ['secteurs2', 'secteurs'], ['nouveauPrixMax', 'prixMax'], ['nouveauLoyerMax', 'loyerMax'],
    ['honoMode2', 'honoMode'], ['taux2', 'taux'], ['forfait2', 'forfait']] as const) {
    if (vide(n)) x[n] = x[a] ?? null;
  }
  if (!txt(x, 'finNouvelle') && txt(x, 'finActuelle')) x.finNouvelle = plusMois(txt(x, 'finActuelle'), 6);
  const objets: string[] = [];
  const pa = num(x, 'prixMax'), pn = num(x, 'nouveauPrixMax');
  const la = num(x, 'loyerMax'), ln = num(x, 'nouveauLoyerMax');
  if ((pa && pn && pa !== pn) || (la && ln && la !== ln)) objets.push('prix');
  const memeListe = (a: string[], b: string[]) => a.map(sansAccent).sort().join('|') === b.map(sansAccent).sort().join('|');
  const autre = (k: string) => (num(x, k + '2') ?? null) !== (num(x, k) ?? null);
  if (!memeListe(typesLibelles(x, ''), typesLibelles(x, '2')) || !memeListe(naturesDe(x, ''), naturesDe(x, '2')) || autre('surface')) objets.push('bien');
  if (!memeListe(decoupe(txt(x, 'secteurs')), decoupe(txt(x, 'secteurs2')))) objets.push('secteurs');
  const hA = x.honoMode === 'forfait' ? `f${forfaitDe(x.forfait) ?? ''}` : `t${num(x, 'taux') ?? ''}`;
  const hN = x.honoMode2 === 'forfait' ? `f${forfaitDe(x.forfait2) ?? ''}` : `t${num(x, 'taux2') ?? ''}`;
  if (hA !== hN) objets.push('honoraires');
  x.objets = objets;
  return x;
}

/* Signé (sur papier, « Il est signé ») : la fin du mandat et ses honoraires
   sur la recherche, s'ils changent. Le numéro et la date du mandat, eux, ne
   bougent pas. */
function surRecherche(d: Donnees): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (change(d, 'duree') && txt(d, 'finNouvelle')) {
    out.mandat_date_expiration = txt(d, 'finNouvelle');
    const debut = txt(d, 'mandatDate');
    if (debut) {
      const [a1, m1] = debut.split('-').map(Number), [a2, m2] = txt(d, 'finNouvelle').split('-').map(Number);
      out.mandat_duree = Math.max(1, (a2 - a1) * 12 + (m2 - m1));
    }
  }
  if (change(d, 'honoraires')) {
    const ap = argentApres(d);
    out.mandat_honoraires = honorairesCourt({ taux: ap.taux, forfait: ap.forfait });
    out.mandat_taux = ap.forfait ? null : tauxDe(ap.taux);
    out.mandat_forfait = ap.forfait || null;
  }
  return out;
}

/* ══ Le mandat signé en ligne, vu comme une source ═══════════════════════
   La ligne de mandats_signatures et ceux qui ont signé avec lui : les
   réponses « actuelles », dans les clés du mandat papier. */
export type MandatEnLigneSource = {
  id: string; numero: string | null; statut: string; signe_le: string | null;
  client_id: string | null; recherche_id: string | null;
  mandant: Mandant | null; societe?: Societe | null;
  contenu: Pick<Contenu, 'recherche' | 'prixMax' | 'taux'> & { forfait?: number | null } | null;
};
const personneDe = (m: Partial<Mandant> | null | undefined): Personne => ({
  ...PERSONNE_VIDE, civilite: m?.civilite === 'Madame' || m?.civilite === 'Monsieur' ? m.civilite : '',
  prenom: m?.prenom || '', nom: m?.nom || '', naissanceDate: m?.naissanceDate || '', naissanceLieu: m?.naissanceLieu || '',
  adresse: m?.adresse || '', email: m?.email || '', telephone: m?.telephone || '',
});
export function donneesMandatEnLigne(l: MandatEnLigneSource, signataires: Partial<Mandant>[]): Donnees {
  const r = l.contenu?.recherche || null;
  const { types, autre } = typesDepuis(r?.typeBien);
  const forfait = forfaitDe(l.contenu?.forfait);
  const acquereurs = [personneDe(l.mandant), ...signataires.map(personneDe)];
  const s = l.societe || null;
  const siren = s?.siren ? s.siren.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : '';
  const jour = l.signe_le ? jourParis(l.signe_le) : '';
  return {
    type: 'simple', qui: s ? 'sci' : acquereurs.length === 1 ? 'personne' : acquereurs.length === 2 ? 'couple' : 'plusieurs',
    acquereurs,
    sciNom: s?.denomination || '', sciForme: s?.forme && s.forme !== 'Autre' ? s.forme : '', sciSiege: s?.siege || '',
    sciRcs: s ? [s.rcsVille ? `RCS de ${s.rcsVille}` : '', siren ? `n° ${siren}` : ''].filter(Boolean).join(' ') : '',
    sciPouvoir: s?.qualite ? s.qualite.toLowerCase() : '', sciPerso: !!s,
    natures: r?.natures || [], types, typeAutre: autre, surface: r?.surfaceMin ?? null, activite: r?.activite || '',
    secteurs: (r?.secteurs || []).join(', '), criteres: '',
    prixMax: l.contenu?.prixMax ?? null, loyerMax: r?.loyerMax ?? null,
    honoMode: forfait ? 'forfait' : 'taux', taux: forfait ? HONORAIRES_TAUX : tauxDe(l.contenu?.taux), forfait,
    dureeMode: 'fixe', finActuelle: /^\d{4}-\d{2}-\d{2}$/.test(jour) ? plusMois(jour, 12) : '',
    date: jour, statut: l.statut,
  };
}

/* Les limites du mandat en ligne, avenants signés compris : ce que
   « Sa recherche dépasse son mandat signé » compare à la recherche. */
export function contenuApresAvenants(c: Contenu, avenants: Donnees[]): Contenu {
  let x: Contenu = { ...c, recherche: { ...c.recherche, secteurs: [...(c.recherche.secteurs || [])] } };
  for (const a of [...avenants].sort((p, q) => (num(p, 'avenantNo') ?? 0) - (num(q, 'avenantNo') ?? 0))) {
    const ch = (k: string) => liste(a, 'objets').includes(k);
    const r = { ...x.recherche };
    if (ch('bien')) {
      r.typeBien = typesLibelles(a, '2').join(', ') || null;
      r.natures = liste(a, 'natures2'); r.surfaceMin = num(a, 'surface2'); r.activite = txt(a, 'activite2') || null;
    }
    if (ch('prix') && num(a, 'nouveauLoyerMax')) r.loyerMax = num(a, 'nouveauLoyerMax');
    if (ch('secteurs')) r.secteurs = decoupe(txt(a, 'secteurs2'));
    const hono = ch('honoraires')
      ? { taux: a.honoMode2 === 'forfait' ? x.taux : tauxDe(a.taux2), forfait: a.honoMode2 === 'forfait' ? forfaitDe(a.forfait2) : null }
      : { taux: x.taux, forfait: x.forfait ?? null };
    x = { ...x, recherche: r, taux: hono.taux, forfait: hono.forfait, prixMax: ch('prix') && num(a, 'nouveauPrixMax') ? num(a, 'nouveauPrixMax') : x.prixMax };
  }
  return x;
}

export const AVENANT_RECHERCHE: Modele = {
  id: 'avenant_recherche',
  categorie: 'mandats_recherche',
  titre: 'Avenant au mandat de recherche',
  description: 'Budget (loyer ou prix), local recherché, secteurs, honoraires, durée, ou une clause libre : il reprend le mandat signé, en ligne ou sur papier, et l’identité des mandants.',
  ic: 'plume',
  signataires: 'Les mêmes signataires que le mandat',
  etapes: ETAPES,
  defaut,
  titreDoc: d => `Avenant n° ${num(d, 'avenantNo') || 1} · ${nomMandant(d)}`,
  sousTitre: d => couper([txt(d, 'mandatNumero') ? `Mandat n° ${txt(d, 'mandatNumero')}` : '', ...changements(d)].filter(Boolean).join(' · '), 120),
  pour: nomMandant,
  rediger,
  resume,
  garde: d => ({
    titre: 'Avenant',
    sous: `au mandat de recherche ${nomMandat(d)}`,
    etiquette: `AVENANT N° ${num(d, 'avenantNo') || 1}${txt(d, 'mandatNumero') ? ` · MANDAT N° ${txt(d, 'mandatNumero')}` : ''}`,
    pour: 'ÉTABLI POUR',
    ics: ['doc', 'loupe', 'plume', 'check'],
  }),
  entete: d => `Avenant n° ${num(d, 'avenantNo') || 1} au mandat${txt(d, 'mandatNumero') ? ` n° ${txt(d, 'mandatNumero')}` : ''}`,
  manques,
  badge: () => 'Avenant',
  reperes,
  lien: 'mandat',
  deriver: { de: ['mandat_recherche', 'mandat_en_ligne'], fn: deriver },
  enchainer,
  preparer,
  surRecherche,
  cases: casesAvenant,
  accepter: () => 'J’ai lu l’avenant en entier et je l’accepte.',
};
