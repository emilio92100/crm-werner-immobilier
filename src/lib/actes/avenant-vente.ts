/* ═══ L'avenant au mandat de commercialisation ════════════════════════════
   Un mandat signé ne se réécrit pas : on le modifie par un avenant, signé
   par les mêmes parties. Les cas courants : le loyer ou le prix (une baisse,
   le plus souvent), les honoraires, la durée (une prolongation), ou autre
   chose. Tout le reste du mandat reste inchangé.

   Il part d'un mandat signé (Nouveau document › Avenant, ou « Préparer un
   avenant » depuis la fiche du mandat) : le mandant, l'affaire, sa nature
   (location, droit au bail, fonds, murs), le numéro, la date, le montant et
   les honoraires sont repris ; seul ce qui change est à saisir.

   Werner, 22 octobre 2026 (repris du modèle d'Emilio, qui vendait des
   appartements) :
     · `montant` est ce que le mandat écrit : le loyer annuel HT HC d'une
       location, ou le prix « hors honoraires » quand l'acquéreur ou le
       cessionnaire les paie en plus, le prix tout court sinon ;
       `nouveauPrix` est le nouveau MONTANT, au même sens (mandat-vente.ts) ;
     · les honoraires se calculent toujours sur ce montant, dans la base
       choisie (HT ou TTC, commun.ts) ; la fiche de l'affaire, elle, les
       reçoit en HT (affaireApresAvenant, documents-avenant-bien.ts).

   Pas de délai de rétractation : l'avenant modifie un mandat dont les 14
   jours ont déjà couru à sa signature, il n'en rouvre pas. Un mandat terminé
   ne se prolonge pas par avenant, et un mandat simple ne devient pas
   exclusif par avenant : dans les deux cas, un nouveau mandat, avec un
   nouveau numéro.

   ⚠️ À faire relire par l'avocat d'Alexandre avant le premier usage. */

import { euros, enLettres, jourParis, type Partie, type Bloc, type Fiche, type Resume } from '@/lib/mandat';
import { lignesMandataire, phraseFonds, type IdentiteAgence } from '@/lib/agence';
import { NATURES, natureDe } from '@/lib/affaires';
import {
  P, Pp, nbLettres, jourLong, aujourdhui, txt, num, liste, lignes, plusMois, couper, paragraphes,
  nomComplet, nomsCourts, fichePersonne, ficheAgence, blocDonnees,
  blocsSignature, manquesSignature, CHAMP_SIGNATURE, IC_RYTHME, HONO_MODES, ouiNon,
  motBase, montantHono, montantHonoCourt, tauxHono, selonBase, champsBaseHono,
  type Donnees, type Modele, type Etape, type Contexte, type Repere, type Source,
} from './commun';
import {
  TYPES, typeDe, argent, vendeursDe, ACTIONS, RYTHMES, iconeLot, casesVente, natureMandat, motsDe, titreMandat, pourAffaire,
} from './mandat-vente';

/* Les réponses reprises du mandat d'origine. */
const REPRIS = ['qui', 'vendeurs', 'sciNom', 'sciForme', 'sciSiege', 'sciRcs', 'sciPouvoir', 'pourCompte', 'persoPro',
  'adresse', 'cp', 'ville', 'type', 'nature', 'copro', 'description', 'lots', 'activite', 'conso', 'usage',
  'actions', 'rythme', 'charge', 'honoMode', 'taux', 'forfait', 'prix', 'montant', 'tvaHono', 'baseHono',
  'duree', 'dureeMode', 'periode', 'dureeMax',
  /* L'affaire du CRM (V3.32) : l'avenant apparaît dans l'onglet Documents de l'affaire. */
  'bienVenteId'];

const change = (d: Donnees, k: string) => liste(d, 'objets').includes(k);
const estLoc = (d: Donnees) => natureMandat(d) === 'location';
const estMursN = (d: Donnees) => natureMandat(d) === 'murs' || natureMandat(d) === 'murs_occupes';
const estCopro = (d: Donnees) => estMursN(d) && d.copro === 'oui';
const nomMandant = (d: Donnees) => (d.qui === 'sci' ? txt(d, 'sciNom') || 'La société' : nomsCourts(vendeursDe(d)));
const adresseBien = (d: Donnees) => [txt(d, 'adresse'), [txt(d, 'cp'), txt(d, 'ville')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
/* « douze mille euros HT HC (12 000 € HT HC) » */
const montantLettres = (n: number, suffixe = '') => `${enLettres(n)} euros${suffixe ? ` ${suffixe}` : ''} (${euros(n)}${suffixe ? ` ${suffixe}` : ''})`;
/* « du preneur », « du cessionnaire », « de l'acquéreur », « du MANDANT » */
const deLautre = (d: Donnees) => { const a = motsDe(d).autreMin; return /^[aeéiouy]/i.test(a) ? `de l’${a}` : `du ${a}`; };
const payeur = (charge: string) => (d: Donnees) => (charge === 'vendeur' ? 'du MANDANT' : deLautre(d));

/* Le montant écrit au mandat jusqu'ici : `montant`, ou déduit du prix d'un
   mandat préparé avant que `montant` existe. */
const montantActuel = (d: Donnees): number | null => num(d, 'montant') ?? argent(d).montant;

/* ── Le mandat tel que l'avenant le laisse ──
   Le montant, qui paie, le taux ou le forfait : les nouveaux s'ils changent,
   ceux du mandat sinon. Les honoraires se calculent sur le montant, dans la
   base du document (HT ou TTC). */
export function mandatApres(d: Donnees): Donnees {
  const h = change(d, 'honoraires');
  return {
    nature: d.nature, baseHono: d.baseHono, tvaHono: d.tvaHono,
    montant: change(d, 'prix') ? num(d, 'nouveauPrix') : montantActuel(d),
    charge: h ? d.charge2 : d.charge, honoMode: h ? d.honoMode2 : d.honoMode,
    taux: h ? d.taux2 : d.taux, forfait: h ? d.forfait2 : d.forfait,
  };
}
export function argentApres(d: Donnees) {
  const x = mandatApres(d);
  const m = num(x, 'montant');
  const forfait = x.honoMode === 'forfait' ? num(x, 'forfait') : null;
  const taux = x.honoMode === 'forfait' ? null : num(x, 'taux');
  const charge: 'acquereur' | 'vendeur' = x.charge === 'vendeur' ? 'vendeur' : 'acquereur';
  const hono = forfait !== null ? Math.round(forfait) : m && taux !== null && taux >= 0 ? Math.round((m * taux) / 100) : null;
  const loc = estLoc(x);
  /* Une cession ou une vente : ce que l'annonce affiche quand l'autre partie
     paie les honoraires en plus, et ce qui revient au mandant quand il les paie. */
  const affiche = !loc && charge === 'acquereur' && m && hono !== null ? m + hono : null;
  const net = !loc && charge === 'vendeur' && m && hono !== null ? m - hono : null;
  return { montant: m, hono, taux, forfait, charge, loc, affiche, net };
}
/* Ce que la fiche de l'affaire reçoit à la signature de l'avenant : le prix
   (au sens de l'affaire) et les honoraires, en HT (pourAffaire). */
export function affaireApresAvenant(d: Donnees): Donnees {
  const a = argentApres(d);
  const x = mandatApres(d);
  /* Le prix au sens de l'affaire, dans la base du document (pourAffaire le
     ramène en HT quand il le faut). */
  const prix = a.montant ? (a.affiche ?? a.montant) : null;
  return pourAffaire({ ...x, prix });
}

/* La mission du mandat, en une phrase : « de rechercher un preneur pour les
   biens situés 12 rue… ». */
function mission(d: Donnees, adresse: string): string {
  const lieu = adresse || '……………';
  switch (natureMandat(d)) {
    case 'cession_bail': return `de rechercher un cessionnaire pour le droit au bail des locaux situés ${lieu}`;
    case 'fonds': return `de rechercher un cessionnaire pour le fonds de commerce exploité ${lieu}`;
    case 'location': return `de rechercher un preneur pour les locaux situés ${lieu}`;
    default: return `de rechercher un acquéreur pour les locaux situés ${lieu}`;
  }
}
/* « Le loyer annuel », « Le prix du droit au bail »… */
const leMontant = (d: Donnees) => (estLoc(d) ? 'Le loyer annuel'
  : natureMandat(d) === 'cession_bail' ? 'Le prix du droit au bail' : natureMandat(d) === 'fonds' ? 'Le prix du fonds' : 'Le prix de vente');
const montantEcrit = (d: Donnees, n: number) => (estLoc(d) ? `${euros(n)} HT HC par an` : euros(n));

/* ══ Les questions ══════════════════════════════════════════════════════ */
const NATURES_OPTIONS = NATURES.map(n => ({ v: n.v, l: n.l, ic: n.ic }));

const ETAPES: Etape[] = [
  {
    id: 'mandat', titre: 'Le mandat', court: 'Le mandat', sous: 'Repris du mandat signé : vérifie, c’est tout.', vers: 'Entre les soussignés', ic: 'doc',
    champs: [
      { t: 'texte', cle: 'mandatNumero', lib: 'N° du mandat', ic: 'livre', requis: true },
      { t: 'date', cle: 'mandatDate', lib: 'Signé le', ic: 'calendrier', requis: true },
      { t: 'choix', cle: 'nature', lib: 'Il porte sur', ic: 'immeuble', requis: true, options: NATURES_OPTIONS },
      { t: 'choix', cle: 'type', lib: 'Mandat', ic: 'cadenas', options: [
        { v: 'simple', l: 'Simple', ic: 'ouvert' }, { v: 'semi', l: 'Semi-exclusif', ic: 'bouclier' }, { v: 'exclusif', l: 'Exclusif', ic: 'cadenas' },
      ] },
      { t: 'nombre', cle: 'avenantNo', lib: 'Avenant n°', ic: 'plume', aide: 'Le premier avenant à ce mandat : 1. Le suivant : 2.' },
    ],
  },
  {
    id: 'parties', titre: 'Le mandant et l’affaire', court: 'Mandant et affaire', sous: 'Repris du mandat : ceux qui signent l’avenant, et où se trouve l’affaire.', vers: 'Entre les soussignés', ic: 'personne',
    champs: [
      { t: 'choix', cle: 'qui', lib: 'Qui a confié l’affaire ?', ic: 'personne', options: [
        { v: 'sci', l: 'Une société', ic: 'immeuble' }, { v: 'personne', l: 'Une personne', ic: 'personne' }, { v: 'indivision', l: 'Plusieurs personnes', ic: 'groupe' },
      ] },
      { t: 'texte', cle: 'sciNom', lib: 'Raison sociale', ic: 'immeuble', si: d => d.qui === 'sci' },
      { t: 'personnes', cle: 'vendeurs', lib: 'Qui signe', ic: 'personne', un: 'Mandant', min: 1, max: 6, complet: false,
        bornes: d => (d.qui === 'indivision' ? { min: 2, max: 6 } : { min: 1, max: 1 }),
        nomCarte: (d, i) => (d.qui === 'sci' ? 'Son représentant, qui signe' : d.qui === 'personne' ? 'Le mandant' : `Mandant ${i + 1}`),
        ajouter: () => 'Ajouter une personne' },
      { t: 'texte', cle: 'sciPouvoir', lib: 'Sa qualité', ic: 'plume', si: d => d.qui === 'sci', exemple: 'gérante' },
      { t: 'titre', cle: 't-b', lib: 'L’affaire', ic: 'immeuble' },
      { t: 'texte', cle: 'adresse', lib: 'Où se trouve-t-elle ?', ic: 'lieu', large: true, requis: true, avec: ['cp', 'ville'] },
      { t: 'texte', cle: 'cp', lib: 'Code postal', ic: 'mail' },
      { t: 'texte', cle: 'ville', lib: 'Ville', ic: 'immeuble', requis: true },
    ],
  },
  {
    id: 'changements', titre: 'Ce qui change', court: 'Ce qui change', sous: 'Coche ce qui change : le reste du mandat ne bouge pas.', vers: 'Il a été convenu ce qui suit', reperesApres: 'autreTexte', ic: 'plume',
    champs: [
      { t: 'cases', cle: 'objets', lib: 'L’avenant modifie', ic: 'plume', options: [
        { v: 'prix', l: 'Le loyer ou le prix', ic: 'etiquette' }, { v: 'honoraires', l: 'Les honoraires', ic: 'euro' },
        { v: 'duree', l: 'La durée', ic: 'calendrier' }, { v: 'bien', l: 'La désignation', ic: 'lots' },
        { v: 'engagements', l: 'Tes actions', ic: 'etoile' }, { v: 'autre', l: 'Autre chose', ic: 'plume' },
      ] },
      { t: 'guide', cle: 'g-av', si: d => change(d, 'autre'), titre: () => 'Un avenant ne change pas tout', points: () => [
        { ic: 'cadenas', x: 'Passer d’un mandat simple à un mandat exclusif (ou semi-exclusif) : signe un nouveau mandat, avec un nouveau numéro de registre.' },
        { ic: 'calendrier', x: 'Un mandat déjà terminé ne se prolonge pas : il faut un nouveau mandat.' },
      ] },
      { t: 'titre', cle: 't-prix', lib: 'Le loyer', ic: 'etiquette', si: d => change(d, 'prix') && estLoc(d) },
      { t: 'titre', cle: 't-prix2', lib: 'Le prix', ic: 'etiquette', si: d => change(d, 'prix') && !estLoc(d) },
      { t: 'euros', cle: 'montant', lib: 'Loyer annuel actuel', ic: 'etiquette', unite: '€ HT HC / an', si: d => change(d, 'prix') && estLoc(d), aide: 'Celui du mandat (ou du dernier avenant).' },
      { t: 'euros', cle: 'nouveauPrix', lib: 'Nouveau loyer annuel', ic: 'etiquette', unite: '€ HT HC / an', requis: true, si: d => change(d, 'prix') && estLoc(d), aide: 'Hors taxes et hors charges.' },
      { t: 'euros', cle: 'montant', lib: 'Prix actuel', ic: 'etiquette', si: d => change(d, 'prix') && !estLoc(d), aide: 'Celui que le mandat écrit (ou le dernier avenant).' },
      { t: 'euros', cle: 'nouveauPrix', lib: 'Nouveau prix', ic: 'etiquette', requis: true, si: d => change(d, 'prix') && !estLoc(d),
        aide: 'Au même sens que le mandat : sans tes honoraires quand l’acquéreur ou le cessionnaire les paie en plus.' },
      { t: 'titre', cle: 't-hono', lib: 'Les honoraires', ic: 'euro', si: d => change(d, 'honoraires') },
      { t: 'choix', cle: 'charge2', lib: 'À la charge', ic: 'euro', si: d => change(d, 'honoraires') && estLoc(d), options: [
        { v: 'acquereur', l: 'Du preneur', ic: 'cle' }, { v: 'vendeur', l: 'Du bailleur', ic: 'immeuble' },
      ] },
      { t: 'choix', cle: 'charge2', lib: 'À la charge', ic: 'euro', si: d => change(d, 'honoraires') && !estLoc(d), options: [
        { v: 'acquereur', l: 'De l’acquéreur ou du cessionnaire', ic: 'cle' }, { v: 'vendeur', l: 'Du mandant', ic: 'immeuble' },
      ] },
      { t: 'choix', cle: 'honoMode2', lib: 'Honoraires', ic: 'euro', si: d => change(d, 'honoraires'), options: HONO_MODES },
      ...champsBaseHono(d => change(d, 'honoraires')),
      ...selonBase({ t: 'nombre', cle: 'taux2', lib: 'Nouveau taux', ic: 'pourcent', si: d => change(d, 'honoraires') && d.honoMode2 !== 'forfait' && estLoc(d) }, b => `% ${b} du loyer annuel`),
      ...selonBase({ t: 'nombre', cle: 'taux2', lib: 'Nouveau taux', ic: 'pourcent', si: d => change(d, 'honoraires') && d.honoMode2 !== 'forfait' && !estLoc(d) }, b => `% ${b} du prix`),
      ...selonBase({ t: 'euros', cle: 'forfait2', lib: 'Nouveau forfait', ic: 'euro', si: d => change(d, 'honoraires') && d.honoMode2 === 'forfait' }, b => `€ ${b}`),
      { t: 'titre', cle: 't-duree', lib: 'La durée', ic: 'calendrier', si: d => change(d, 'duree') },
      { t: 'date', cle: 'finActuelle', lib: 'Il devait finir le', ic: 'calendrier', si: d => change(d, 'duree') },
      { t: 'date', cle: 'finNouvelle', lib: 'Il finira le', ic: 'chrono', requis: true, si: d => change(d, 'duree') },
      { t: 'titre', cle: 't-bien', lib: 'La désignation', ic: 'lots', si: d => change(d, 'bien') },
      { t: 'zone', cle: 'description', lib: 'La désignation', ic: 'doc', large: true, si: d => change(d, 'bien'),
        aide: 'Ce que le mandat dit des locaux (ou du fonds), repris du mandat : corrige-le ou complète-le. Une ligne par paragraphe.' },
      { t: 'choix', cle: 'copro', lib: 'Les biens sont-ils en copropriété ?', ic: 'immeuble', si: d => change(d, 'bien') && estMursN(d), options: ouiNon() },
      { t: 'lignes', cle: 'lots', lib: 'Les lots', ic: 'lots', un: 'Lot', max: 40, large: true, si: d => change(d, 'bien') && estCopro(d), icone: iconeLot, colonnes: [
        { cle: 'numero', lib: 'N° du lot', exemple: '64' },
        { cle: 'nature', lib: 'Ce que c’est', exemple: 'le local, un parking…' },
      ], aide: 'La liste complète après l’avenant (elle remplace celle du mandat).' },
      { t: 'titre', cle: 't-eng', lib: 'Tes actions', ic: 'etoile', si: d => change(d, 'engagements') },
      { t: 'cases', cle: 'actions', lib: 'Ce que tu t’engages à faire désormais', ic: 'etoile', si: d => change(d, 'engagements'), options: ACTIONS.map(a => ({ v: a.v, l: a.l, ic: a.ic })) },
      { t: 'choix', cle: 'rythme', lib: 'Comptes rendus', ic: 'horloge', si: d => change(d, 'engagements'), options: Object.entries(RYTHMES).map(([v, l]) => ({ v, l: l.charAt(0).toUpperCase() + l.slice(1), ic: IC_RYTHME[v] })) },
      { t: 'titre', cle: 't-autre', lib: 'Autre chose', ic: 'plume', si: d => change(d, 'autre') },
      { t: 'zone', cle: 'autreTexte', lib: 'La modification', ic: 'plume', large: true, requis: true, si: d => change(d, 'autre'),
        exemple: 'Le MANDANT autorise désormais la pose d’une vitrophanie « À louer » sur la vitrine.', aide: 'Imprimée telle quelle.' },
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
  const vs = vendeursDe(d);
  const no = num(d, 'avenantNo') || 1;
  const numero = txt(d, 'mandatNumero');
  const adresse = adresseBien(d);
  const loc = estLoc(d);

  const fiches: Fiche[] = d.qui === 'sci'
    ? [{ ic: 'agence', titre: (txt(d, 'sciNom') || 'La société').toUpperCase(), lignes: [
      txt(d, 'sciForme'), txt(d, 'sciSiege') ? `Dont le siège social est situé ${txt(d, 'sciSiege')}` : '', txt(d, 'sciRcs') ? `Immatriculée au ${txt(d, 'sciRcs')}` : '',
      `Représentée par ${nomComplet(vs[0])}${txt(d, 'sciPouvoir') ? `, agissant en qualité de ${txt(d, 'sciPouvoir')}` : ''}.`,
    ].filter(Boolean), pied: 'Ci-après « le MANDANT »' }]
    : vs.map((p, i) => fichePersonne(p, 'personne', i === vs.length - 1 ? (vs.length > 1 ? 'Ci-après ensemble « le MANDANT »' : 'Ci-après « le MANDANT »') : undefined));
  fiches.push(ficheAgence(A, lignesMandataire(A), phraseFonds(A), 'Ci-après « l’Agence » ou « le MANDATAIRE »'));

  const sections: Partie['sections'] = [
    { titre: 'Entre les soussignés', blocs: [{ t: 'fiches', items: fiches }] },
    { titre: 'Il a été convenu ce qui suit', blocs: [
      P(`Par un ${titreMandat(d).charAt(0).toLowerCase()}${titreMandat(d).slice(1)}${numero ? ` n° ${numero}` : ' n° ……'}, signé le ${txt(d, 'mandatDate') ? jourLong(txt(d, 'mandatDate')) : '……………'}, le MANDANT a confié au MANDATAIRE la mission ${mission(d, adresse)}. Les parties conviennent de modifier ce mandat comme suit.`, true),
    ] },
  ];

  const a = argentApres(d);
  const qui = payeur(a.charge)(d);
  const sur = loc ? 'pour ce loyer' : 'à ce prix';
  if (change(d, 'prix')) {
    const ancien = montantActuel(d), nouveau = num(d, 'nouveauPrix');
    const blocs: Bloc[] = [];
    if (nouveau) {
      const verbe = ancien && nouveau < ancien ? 'ramené' : 'porté';
      blocs.push(P(loc
        ? `Le loyer annuel${ancien ? `, fixé jusqu’ici à ${euros(ancien)} HT HC,` : ''} est ${verbe} à ${montantLettres(nouveau, 'HT HC')} par an, soit ${euros(Math.round(nouveau / 12))} HT HC par mois.`
        : `${leMontant(d)}${ancien ? `, fixé jusqu’ici à ${euros(ancien)},` : ''} est ${verbe} à ${montantLettres(nouveau)}${a.charge === 'acquereur' ? `, honoraires du MANDATAIRE non compris : ils sont à la charge ${deLautre(d)}, en plus de ce prix` : ''}.`, true));
      if (!change(d, 'honoraires') && a.hono !== null) blocs.push(P(`Les honoraires du MANDATAIRE, calculés comme prévu au mandat, s’établissent à ${montantHono(d, a.hono)} ${sur}, à la charge ${qui}.`));
      if (a.affiche) blocs.push(Pp(`Soit un montant affiché, honoraires compris, de ${euros(a.affiche)}.`));
      if (a.net !== null) blocs.push(Pp(`Soit un montant revenant au MANDANT, honoraires déduits, de ${euros(a.net)}.`));
      blocs.push(P('Toute indemnité prévue au mandat et égale au montant des honoraires (clauses pénales) est calculée sur les honoraires ainsi recalculés.'));
    } else blocs.push(P(`${loc ? 'Nouveau loyer annuel' : 'Nouveau prix'} : à compléter.`, true));
    sections.push({ titre: loc ? 'Loyer' : motsDe(d).prix, ic: 'etiquette', blocs });
  }
  if (change(d, 'honoraires')) {
    const combien = a.forfait !== null
      ? `un forfait de ${montantHono(d, a.forfait, true)}`
      : a.taux !== null ? `${tauxHono(d, a.taux)} ${loc ? 'du loyer annuel HT HC' : 'du prix'}${a.hono !== null ? `, soit ${montantHonoCourt(d, a.hono)} ${sur}` : ''}` : 'à préciser';
    sections.push({ titre: 'Honoraires', ic: 'euro', blocs: [
      P(`Les honoraires du MANDATAIRE sont désormais de ${combien}, à la charge ${qui}.`, true),
      ...(a.affiche && !change(d, 'prix') ? [Pp(`Soit un montant affiché, honoraires compris, de ${euros(a.affiche)}.`)] : []),
      P(`Ils restent dus dans les conditions prévues au mandat, à la conclusion effective ${loc ? 'du bail' : 'de l’opération'} : aucune somme n’est due, ni ne peut être versée au MANDATAIRE, avant (article 6 de la loi du 2 janvier 1970). Le taux de TVA appliqué est celui en vigueur à la date de leur exigibilité.`),
    ] });
  }
  if (change(d, 'duree')) {
    const fin = txt(d, 'finNouvelle');
    sections.push({ titre: 'Durée', ic: 'calendrier', blocs: [
      P(`Le mandat est prolongé : il prendra fin le ${fin ? jourLong(fin) : '……………'}${txt(d, 'finActuelle') ? `, au lieu du ${jourLong(txt(d, 'finActuelle'))}` : ''}.`, true),
      P('Il est rappelé que, passé un délai de trois mois à compter de sa signature, le mandat peut être dénoncé à tout moment par chacune des parties, avec un préavis de quinze jours, par lettre recommandée avec demande d’avis de réception (article 78 du décret du 20 juillet 1972).'),
    ] });
  }
  if (change(d, 'bien')) {
    const lots = estCopro(d) ? lignes(d, 'lots') : [];
    const quoi = natureMandat(d) === 'fonds' ? 'du fonds' : natureMandat(d) === 'cession_bail' ? 'des locaux' : 'des biens';
    sections.push({ titre: 'Désignation', ic: 'agence', blocs: [
      P(`La désignation ${quoi} est désormais la suivante :`, true),
      ...(txt(d, 'description') ? paragraphes(txt(d, 'description')) : [P('À compléter.')]),
      ...(lots.length ? [
        P(`Les biens sont compris dans un ensemble immobilier soumis à la loi du 10 juillet 1965 fixant le statut de la copropriété, dont ils constituent ${lots.length > 1 ? 'les lots suivants, qui remplacent' : 'le lot suivant, qui remplace'} ceux désignés au mandat :`),
        { t: 'l' as const, items: lots.map(l => `Lot n° ${l.numero || '…'}${l.nature ? ` : ${l.nature}` : ''}.`) },
      ] : []),
    ] });
  }
  if (change(d, 'engagements')) {
    const acts = ACTIONS.filter(x => liste(d, 'actions').includes(x.v));
    sections.push({ titre: 'Actions commerciales', ic: 'etoile', blocs: [
      P('Les actions commerciales prévues au mandat sont remplacées par les suivantes, que le MANDATAIRE réalise à ses frais :', true),
      ...(acts.length ? [{ t: 'coches' as const, items: acts.map(x => x.x) }] : [P('Les actions de communication qu’il jugera utiles.')]),
      P(`Le MANDATAIRE tient le MANDANT informé de ses actions et lui adresse ${RYTHMES[String(d.rythme)] || RYTHMES.visite} un compte rendu écrit, avec les observations éventuelles des personnes qui ont visité.`),
    ] });
  }
  if (change(d, 'autre')) sections.push({ titre: 'Autre modification', ic: 'plume', blocs: paragraphes(txt(d, 'autreTexte')).length ? paragraphes(txt(d, 'autreTexte')) : [P('À compléter.')] });
  sections.push({ titre: 'Le reste du mandat', ic: 'doc', blocs: [
    P(`Toutes les autres clauses du mandat demeurent inchangées. Le présent avenant en fait partie intégrante et se rattache à son numéro d’inscription au registre des mandats du MANDATAIRE${numero ? ` (n° ${numero})` : ''}.`),
  ] });
  sections.push({ titre: 'Informations', ic: 'info', blocs: [
    blocDonnees(A),
    Pp('Textes applicables : loi n° 70-9 du 2 janvier 1970 (dite loi Hoguet) et décret n° 72-678 du 20 juillet 1972. Le présent avenant est soumis à la loi française.'),
  ] });
  const nbEx = (d.qui === 'sci' ? 1 : vs.length) + 1;
  sections.push({ titre: 'Date et signatures', ic: 'plume', blocs: blocsSignature(d, {
    papier: `Fait à ${txt(d, 'faitA') || '……………'}, le ${txt(d, 'date') ? jourLong(txt(d, 'date')) : '……………'}, en ${nbLettres(nbEx)} exemplaires originaux, dont un remis à chaque partie.`,
    mention: 'Chaque signataire date et signe, précédé de la mention manuscrite « Lu et approuvé ».',
    cases: casesVente(d, A),
  }) });

  return [{
    titre: `Avenant n° ${no} au mandat${numero ? ` n° ${numero}` : ''}`,
    court: 'L’avenant',
    sous: `Au ${titreMandat(d).charAt(0).toLowerCase()}${titreMandat(d).slice(1)}${txt(d, 'mandatDate') ? ` du ${jourLong(txt(d, 'mandatDate'))}` : ''}`,
    ic: 'doc',
    sections,
  }];
}

/* « Loyer : 42 000 € HT HC par an · Fin : 30 juin 2027 » */
function changements(d: Donnees): string[] {
  const a = argentApres(d);
  const out: string[] = [];
  if (change(d, 'prix')) out.push(`${estLoc(d) ? 'Loyer' : 'Prix'} : ${num(d, 'nouveauPrix') ? montantEcrit(d, num(d, 'nouveauPrix') || 0) : '…'}`);
  if (change(d, 'honoraires')) out.push(`Honoraires : ${a.forfait !== null ? `${euros(a.forfait)} ${motBase(d)}` : a.taux !== null ? tauxHono(d, a.taux) : '…'}`);
  if (change(d, 'duree')) out.push(`Fin : ${txt(d, 'finNouvelle') ? jourLong(txt(d, 'finNouvelle')) : '…'}`);
  if (change(d, 'bien')) out.push('La désignation');
  if (change(d, 'engagements')) out.push('Les actions de l’agence');
  if (change(d, 'autre')) out.push('Autre modification');
  return out;
}

function resume(d: Donnees): Resume {
  const ch = changements(d);
  const nat = NATURES.find(n => n.v === natureDe(d));
  return [
    { titre: 'Le mandat', valeur: txt(d, 'mandatNumero') ? `N° ${txt(d, 'mandatNumero')}` : 'À compléter', detail: `${TYPES[typeDe(d)].nom}${nat ? ` · ${nat.l.toLowerCase()}` : ''}${txt(d, 'mandatDate') ? `, signé le ${jourLong(txt(d, 'mandatDate'))}` : ''}` },
    { titre: 'L’affaire', valeur: txt(d, 'adresse') || 'À compléter', detail: txt(d, 'ville') || '—' },
    { titre: 'Ce qui change', valeur: ch[0] || 'À compléter', detail: ch.slice(1).join(' · ') || '—' },
    { titre: 'Le reste', valeur: 'Inchangé', detail: 'toutes les autres clauses du mandat' },
  ];
}

function reperes(d: Donnees, etape: string): Repere[] {
  const out: Repere[] = [];
  if (etape !== 'changements') return out;
  const a = argentApres(d);
  if ((change(d, 'prix') || change(d, 'honoraires')) && a.montant) {
    out.push({ l: estLoc(d) ? 'Loyer annuel' : 'Prix écrit au mandat', v: montantEcrit(d, a.montant) });
    if (estLoc(d)) out.push({ l: 'Soit par mois', v: `${euros(Math.round(a.montant / 12))} HT HC` });
    if (a.hono !== null) out.push({ l: a.forfait !== null ? 'Honoraires (forfait)' : `Honoraires (${tauxHono(d, a.taux || 0)})`, v: montantHonoCourt(d, a.hono) });
    if (a.affiche) out.push({ l: 'Affiché dans l’annonce, honoraires compris', v: euros(a.affiche), ton: 'ok' });
    if (a.net !== null) out.push({ l: 'Net pour le mandant', v: euros(a.net), ton: 'ok' });
  }
  if (change(d, 'honoraires') && a.taux !== null && a.taux > 30) out.push({ l: 'Taux très élevé', v: 'Au-dessus de 30 % : vérifie la saisie.', ton: 'alerte' });
  if (change(d, 'duree') && txt(d, 'finNouvelle') && txt(d, 'finActuelle') && txt(d, 'finNouvelle') <= txt(d, 'finActuelle')) {
    out.push({ l: 'Durée', v: 'La nouvelle fin doit venir après l’ancienne.', ton: 'alerte' });
  }
  if (!liste(d, 'objets').length) out.push({ l: 'Rien à modifier', v: 'Coche au moins une modification.', ton: 'alerte' });
  return out;
}

function manques(d: Donnees): string[] {
  const out: string[] = [];
  if (!txt(d, 'mandatNumero') || !txt(d, 'mandatDate')) out.push('Le numéro et la date du mandat');
  /* Parti d'un mandat seulement finalisé : il se modifie avant signature. */
  if (d.mandatSigne === false) out.push('Un mandat signé : celui-ci ne l’est pas encore, il se modifie avant signature');
  if (!natureDe(d)) out.push('Ce que le mandat confie (location, droit au bail, fonds, murs)');
  const vs = vendeursDe(d);
  vs.forEach((p, i) => { if (!p.nom || !p.prenom) out.push(`Le nom ${vs.length > 1 ? `du mandant ${i + 1}` : d.qui === 'sci' ? 'de celui qui signe pour la société' : 'du mandant'}`); });
  if (d.qui === 'sci' && !txt(d, 'sciNom')) out.push('Le nom de la société');
  if (!txt(d, 'adresse') || !txt(d, 'ville')) out.push('L’adresse de l’affaire');
  if (!liste(d, 'objets').length) out.push('Ce que l’avenant modifie');
  if (change(d, 'prix') && !num(d, 'nouveauPrix')) out.push(estLoc(d) ? 'Le nouveau loyer' : 'Le nouveau prix');
  else if (change(d, 'prix') && num(d, 'nouveauPrix') === montantActuel(d)) out.push(estLoc(d) ? 'Un nouveau loyer différent de l’actuel' : 'Un nouveau prix différent de l’actuel');
  if (change(d, 'honoraires') && (d.honoMode2 === 'forfait' ? !num(d, 'forfait2') : num(d, 'taux2') === null)) out.push('Les nouveaux honoraires');
  if (change(d, 'duree') && !txt(d, 'finNouvelle')) out.push('La nouvelle date de fin');
  if (change(d, 'autre') && !txt(d, 'autreTexte')) out.push('La modification à écrire');
  if (change(d, 'bien') && !txt(d, 'description')) out.push('La désignation');
  if (change(d, 'engagements') && typeDe(d) === 'exclusif' && !liste(d, 'actions').length) out.push('Au moins une action (obligatoire pour un mandat exclusif)');
  if (txt(d, 'finActuelle') && txt(d, 'date') && txt(d, 'date') >= txt(d, 'finActuelle')) out.push(`Un mandat en cours : celui-ci a pris fin le ${jourLong(txt(d, 'finActuelle'))}, il faut en signer un nouveau`);
  if (!txt(d, 'faitA') || !txt(d, 'date')) out.push('Le lieu et la date de signature');
  /* Pas de « lieu » dans l'avenant : un ancien choix ne bloque rien. */
  out.push(...manquesSignature({ ...d, lieu: '' }, casesVente(d)));
  return out;
}

function defaut(c: Contexte): Donnees {
  const cl = c.client;
  const b = c.bien;
  return {
    mandatNumero: '', mandatDate: '', type: 'simple', avenantNo: 1, nature: '',
    qui: 'sci', vendeurs: [{ civilite: '', prenom: cl?.prenom || '', nom: cl?.nom || '', nomNaissance: '', naissanceDate: '', naissanceLieu: '', adresse: cl?.adresse || '', email: cl?.emails?.[0] || '', telephone: cl?.telephones?.[0] || '' }],
    adresse: b?.adresse || '', cp: b?.code_postal || '', ville: b?.ville || '',
    charge: 'acquereur', honoMode: 'taux', taux: null, prix: b?.prix_acquereur || null, montant: null,
    objets: ['prix'], nouveauPrix: null, charge2: 'acquereur', honoMode2: 'taux', taux2: null, forfait2: null,
    finActuelle: '', finNouvelle: '', autreTexte: '',
    signature: 'en_ligne', faitA: c.identite.ville, date: aujourdhui(),
  };
}

/* Depuis le mandat : tout ce qu'il savait, son montant et sa date de fin actuelle. */
function deriver(src: Source): Donnees {
  const s = src.donnees || {};
  const out: Donnees = {};
  for (const k of REPRIS) if (k in s) out[k] = s[k];
  /* Le jour de la signature à l'heure de Paris (signé en ligne entre minuit
     et 2 h, l'heure universelle donnait la veille). */
  const jour = src.signe_le ? jourParis(src.signe_le) : String(s.date || '').slice(0, 10);
  const total = s.dureeMode === 'prorogation' ? (num(s, 'dureeMax') ?? 6) : (num(s, 'duree') ?? 3);
  return {
    ...out,
    montant: num(s, 'montant') ?? argent(s).montant,
    mandatNumero: src.numero || txt(s, 'numero'), mandatDate: jour, mandatSigne: !!src.signe_le,
    nouveauPrix: null, charge2: s.charge || 'acquereur', honoMode2: s.honoMode || 'taux', taux2: s.taux ?? null, forfait2: s.forfait ?? null,
    finActuelle: /^\d{4}-\d{2}-\d{2}$/.test(jour) ? plusMois(jour, total) : '',
    finNouvelle: /^\d{4}-\d{2}-\d{2}$/.test(jour) ? plusMois(jour, total + 3) : '',
  };
}

/* Un avenant déjà signé à ce mandat : son montant, ses honoraires, sa date
   de fin deviennent la situation actuelle du suivant. */
function enchainer(d: Donnees, a: Donnees): Donnees {
  const x: Donnees = { ...d };
  const ch = (k: string) => liste(a, 'objets').includes(k);
  if (ch('prix') && num(a, 'nouveauPrix')) x.montant = num(a, 'nouveauPrix');
  if (ch('honoraires')) {
    x.charge = a.charge2; x.honoMode = a.honoMode2; x.taux = a.taux2; x.forfait = a.forfait2;
    x.charge2 = a.charge2; x.honoMode2 = a.honoMode2; x.taux2 = a.taux2; x.forfait2 = a.forfait2;
    if (a.baseHono) x.baseHono = a.baseHono;
    if (a.tvaHono !== undefined) x.tvaHono = a.tvaHono;
  }
  if (ch('duree') && txt(a, 'finNouvelle')) { x.finActuelle = txt(a, 'finNouvelle'); x.finNouvelle = plusMois(txt(a, 'finNouvelle'), 3); }
  if (ch('bien')) { x.description = a.description; x.lots = a.lots; x.copro = a.copro; }
  if (ch('engagements')) { x.actions = a.actions; x.rythme = a.rythme; }
  return x;
}

export const AVENANT_VENTE: Modele = {
  id: 'avenant_vente',
  categorie: 'mandats_vente',
  titre: 'Avenant au mandat de commercialisation',
  description: 'Loyer ou prix, honoraires, prolongation : il reprend le mandat signé et ne change que ce que tu coches.',
  ic: 'plume',
  signataires: 'Les mêmes signataires que le mandat',
  etapes: ETAPES,
  defaut,
  titreDoc: d => `Avenant n° ${num(d, 'avenantNo') || 1} · ${nomMandant(d)}`,
  sousTitre: d => couper([txt(d, 'adresse'), txt(d, 'ville')].filter(Boolean).join(', ') + (changements(d).length ? ` · ${changements(d).join(' · ')}` : ''), 120),
  pour: nomMandant,
  rediger,
  resume,
  garde: d => ({
    titre: 'Avenant',
    sous: `au ${titreMandat(d).charAt(0).toLowerCase()}${titreMandat(d).slice(1)}`,
    etiquette: `AVENANT N° ${num(d, 'avenantNo') || 1}${txt(d, 'mandatNumero') ? ` · MANDAT N° ${txt(d, 'mandatNumero')}` : ''}`,
    pour: 'ÉTABLI POUR',
    ics: ['doc', 'agence', 'plume', 'check'],
  }),
  entete: d => `Avenant n° ${num(d, 'avenantNo') || 1} au mandat${txt(d, 'mandatNumero') ? ` n° ${txt(d, 'mandatNumero')}` : ''}`,
  manques,
  badge: () => 'Avenant',
  reperes,
  lien: 'mandat',
  deriver: { de: ['mandat_vente'], fn: deriver },
  enchainer,
  cases: casesVente,
  accepter: () => 'J’ai lu l’avenant en entier et je l’accepte.',
};
