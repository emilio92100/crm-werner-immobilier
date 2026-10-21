/* ═══ La reconnaissance d'information (la « dénonciation ») ═══════════════
   Werner, 21 octobre 2026 : avant de donner l'adresse d'un local à un
   prospect, il lui fait reconnaître, par écrit, que c'est l'Agence qui le lui
   a présenté en premier, et s'engager à ne pas traiter en direct avec le
   propriétaire (ou le locataire qui cède) ni par une autre agence. Dans les
   boutiques, le propriétaire ou le locataire est souvent sur place : sans
   cette trace, on peut vite être contourné.

   Ce n'est pas un mandat : pas de numéro du registre, pas d'honoraires dus
   par le signataire au titre de ce document. S'il contourne l'Agence, il lui
   doit des dommages et intérêts, chiffrés d'avance au montant des honoraires
   dont elle serait privée (une clause pénale, que le juge peut modérer :
   article 1231-5 du Code civil).

   Il se prépare et s'envoie depuis la fiche d'une affaire (« Reconnaissance »,
   FenReconnaissance) : le client choisi ou créé, signé en ligne avec son code,
   ou sur place. Rangé avec les bons de visite (catégorie `bons_visite`).

   ⚠️ À faire relire par l'avocat d'Alexandre avant le premier usage. */

import { type Partie, type Bloc, type Fiche, type Resume } from '@/lib/mandat';
import { lignesMandataire, type IdentiteAgence } from '@/lib/agence';
import {
  P, Pp, nbLettres, jourLong, aujourdhui, txt, num, paragraphes,
  lirePersonnes, nomComplet, nomsCourts, fichePersonne, blocDonnees, ficheAgence,
  PERSONNE_VIDE, blocsSignature, manquesSignature, CHAMP_SIGNATURE_VISITE,
  type Donnees, type Modele, type Etape, type Contexte, type Personne, type CaseSignature,
} from './commun';

/* Ce que le document dit du lieu : le secteur seulement, jamais l'adresse.
   Alexandre (21 octobre 2026) : « quand il signe la reconnaissance, il ne
   faut pas qu'il y ait l'adresse du bien ». Il la lit avant de signer : s'il
   ne signait pas, il l'aurait quand même. L'adresse reste dans les réponses
   (elle donne l'arrondissement), elle n'est jamais imprimée ; Werner la
   donne une fois le document signé. */
/* « Paris 8e », « Boulogne-Billancourt » */
function villeCourte(cp: string, ville: string): string {
  const m = /^75(\d{3})$/.exec(cp.replace(/\s/g, ''));
  if (m && /paris/i.test(ville)) {
    const n = Number(m[1]) % 100 || Number(m[1]);
    return `Paris ${n}${n === 1 ? 'er' : 'e'}`;
  }
  return ville;
}
export function lieuDe(d: Donnees): string {
  const cp = txt(d, 'cp'), ville = txt(d, 'ville'), quartier = txt(d, 'quartier');
  return [villeCourte(cp, ville), quartier ? `quartier ${quartier}` : ''].filter(Boolean).join(', ') || 'secteur à préciser';
}

/* Celui qui a le local en main, selon l'affaire. */
const quiDetient = (d: Donnees) => (d.nature === 'cession_bail' || d.nature === 'fonds'
  ? 'son titulaire (le locataire qui cède)'
  : d.nature === 'location' ? 'son propriétaire (le bailleur)' : 'son propriétaire');

const destinatairesDe = (d: Donnees): Personne[] => {
  const l = lirePersonnes(d.destinataires);
  return l.length ? l : [{ ...PERSONNE_VIDE }];
};

const ETAPES: Etape[] = [
  {
    id: 'qui', titre: 'Le destinataire', court: 'Destinataire', sous: 'Celui à qui tu présentes le local, et qui signe.', vers: 'Entre les soussignés', ic: 'personne',
    champs: [
      { t: 'personnes', cle: 'destinataires', lib: 'Qui signe', ic: 'personne', un: 'Destinataire', min: 1, max: 3,
        nomCarte: (_d, i) => (i === 0 ? 'Le destinataire' : `Destinataire ${i + 1}`), ajouter: () => 'Ajouter une personne' },
      { t: 'texte', cle: 'societe', lib: 'Sa société', ic: 'immeuble', large: true, exemple: 'SARL Le Comptoir, en cours de création',
        question: 'Signe-t-il pour une société ?', aide: 'L’engagement vaut alors pour lui et pour sa société.' },
    ],
  },
  {
    id: 'affaire', titre: 'Le local présenté', court: 'Le local', sous: 'Ce que tu lui présentes, et ce que le document en dit.', vers: 'Le local présenté', ic: 'immeuble',
    champs: [
      { t: 'texte', cle: 'description', lib: 'Le local', ic: 'doc', large: true, requis: true, exemple: 'Boutique de 55 m² à louer' },
      { t: 'texte', cle: 'cp', lib: 'Code postal', ic: 'mail', aide: 'Il donne l’arrondissement écrit dans le document (« Paris 11e »).' },
      { t: 'texte', cle: 'ville', lib: 'Ville', ic: 'immeuble', requis: true },
      { t: 'texte', cle: 'quartier', lib: 'Quartier', ic: 'cible', exemple: 'Oberkampf', question: 'Préciser le quartier ?',
        aide: 'Le document dit le secteur seulement, jamais l’adresse : il la lit avant de signer. Tu la lui donnes une fois signé.' },
      { t: 'texte', cle: 'montant', lib: 'Le montant annoncé', ic: 'etiquette', large: true, exemple: '1 650 € HT / poste / mois' },
      { t: 'texte', cle: 'reference', lib: 'Référence', ic: 'liste' },
    ],
  },
  {
    id: 'engagement', titre: 'Son engagement', court: 'Engagement', sous: 'Combien de temps, et ce qu’il devrait s’il passait outre.', vers: 'Ses engagements', ic: 'bouclier',
    champs: [
      { t: 'nombre', cle: 'duree', lib: 'Pas de traité en direct pendant', ic: 'chrono', unite: 'mois', requis: true, rapides: [6, 12, 18, 24],
        aide: 'À compter de la signature. Douze mois, comme dans tes mandats.' },
      { t: 'texte', cle: 'honoraires', lib: 'Tes honoraires sur cette affaire', ic: 'euro', large: true, exemple: '15 % HT du loyer annuel, à la charge du preneur',
        question: 'Rappeler tes honoraires ?', aide: 'L’indemnité, s’il passait outre, en est le montant : le dire évite toute discussion.' },
      { t: 'zone', cle: 'note', lib: 'Une précision', ic: 'plume', large: true, question: 'Une précision à ajouter ?' },
    ],
  },
  {
    id: 'signature', titre: 'La signature', court: 'Signature', sous: 'En ligne avec son code, ou sur place.', vers: 'Date et signatures', ic: 'plume',
    champs: [
      CHAMP_SIGNATURE_VISITE,
      { t: 'texte', cle: 'faitA', lib: 'Fait à', ic: 'lieu', requis: true },
      { t: 'date', cle: 'date', lib: 'Le', ic: 'calendrier', requis: true },
    ],
  },
];

function rediger(d: Donnees, A: IdentiteAgence): Partie[] {
  const ds = destinatairesDe(d);
  const pl = ds.length > 1;
  const duree = num(d, 'duree') ?? 12;
  const societe = txt(d, 'societe');
  const date = txt(d, 'date') ? jourLong(txt(d, 'date')) : '……………';
  const LE = pl ? 'les DESTINATAIRES' : 'le DESTINATAIRE';
  const Le = pl ? 'Les DESTINATAIRES' : 'Le DESTINATAIRE';

  const fiches: Fiche[] = ds.map((p, i) => fichePersonne(p, 'personne', i === ds.length - 1 ? `Ci-après ${pl ? 'ensemble « les DESTINATAIRES »' : '« le DESTINATAIRE »'}` : undefined));
  if (societe && fiches[0]) fiches[0] = { ...fiches[0], lignes: [...fiches[0].lignes.filter(l => !/à compléter/.test(l)), `Agissant tant en son nom personnel que pour ${societe}.`] };
  fiches.push(ficheAgence(A, lignesMandataire(A), undefined, 'Ci-après « l’Agence »'));

  const local: Bloc[] = [
    P(`${txt(d, 'description') || 'Un local'}${/[.!?]$/.test(txt(d, 'description')) ? '' : '.'}`, true),
    P(`Situé : ${lieuDe(d)}.`),
    ...(txt(d, 'montant') ? [P(`Montant annoncé : ${txt(d, 'montant')}.`)] : []),
    ...(txt(d, 'reference') ? [Pp(`Référence de l’Agence : ${txt(d, 'reference')}.`)] : []),
    Pp('L’adresse exacte sera communiquée par l’Agence après la signature du présent document ; elle est couverte par les mêmes engagements.'),
  ];

  const reconnait: Bloc[] = [
    P(`${Le} ${pl ? 'reconnaissent' : 'reconnaît'} que l’Agence, mandatée pour cette affaire, ${pl ? 'leur' : 'lui'} a indiqué et présenté le local désigné ci-dessus le ${date}, et ${pl ? 'leur' : 'lui'} en a communiqué les caractéristiques.`, true),
    P(`${pl ? 'Ils déclarent' : 'Il déclare'} n’en avoir pas eu connaissance auparavant, ni directement, ni par un autre intermédiaire.`),
  ];

  const engage: Bloc[] = [
    P(`En contrepartie des informations reçues, ${LE} ${pl ? 's’engagent' : 's’engage'}, pendant ${nbLettres(duree)} mois à compter de la signature du présent document :`),
    { t: 'l', items: [
      `à ne pas traiter, directement ou indirectement, avec ${quiDetient(d)} pour ce local, ni par une personne interposée, une société qu’${pl ? 'ils contrôlent' : 'il contrôle'} ou à laquelle ${pl ? 'ils sont liés' : 'il est lié'}, ni par un autre intermédiaire ;`,
      `à passer par l’Agence pour toute visite, toute demande et toute proposition sur ce local ;`,
      `à garder confidentielles les informations reçues (l’adresse, l’identité du mandant, les conditions), et à ne les communiquer qu’à ${pl ? 'leurs' : 'ses'} conseils, tenus au même secret.`,
    ] },
    P(`S’${pl ? 'ils manquaient' : 'il manquait'} à ces engagements, ${LE} ${pl ? 'devraient' : 'devrait'} à l’Agence, à titre de dommages et intérêts, une indemnité égale au montant des honoraires dont elle aurait été privée${txt(d, 'honoraires') ? ` (${txt(d, 'honoraires')})` : ''}, sans préjudice de tout autre recours.`, true),
    Pp('Le juge peut modérer ou augmenter une indemnité manifestement excessive ou dérisoire (article 1231-5 du Code civil).'),
    ...paragraphes(txt(d, 'note'), 'Précision : '),
  ];

  return [{
    titre: 'Reconnaissance d’information',
    court: 'La reconnaissance',
    sous: 'Et engagement de ne pas traiter en direct',
    ic: 'bouclier',
    sections: [
      { titre: 'Entre les soussignés', blocs: [{ t: 'fiches', items: fiches }] },
      { titre: 'Le local présenté', ic: 'agence', blocs: local },
      { titre: 'Ce que reconnaît le destinataire', ic: 'check', blocs: reconnait },
      { titre: 'Ses engagements', ic: 'bouclier', blocs: engage },
      { titre: 'Informations', ic: 'info', blocs: [blocDonnees(A)] },
      { titre: 'Date et signatures', ic: 'plume', blocs: blocsSignature(d, {
        papier: `Fait à ${txt(d, 'faitA') || '……………'}, le ${date}, en ${nbLettres(2)} exemplaires.`,
        mention: 'Chaque signataire date et signe, précédé de la mention manuscrite « Lu et approuvé ».',
        cases: casesReconnaissance(d, A), sansCode: true,
      }) },
    ],
  }];
}

function casesReconnaissance(d: Donnees, A?: IdentiteAgence): CaseSignature[] {
  const out: CaseSignature[] = destinatairesDe(d).map((p, i) => ({ cle: `d${i}`, qui: 'Le destinataire', nom: nomComplet(p), lignes: i === 0 && txt(d, 'societe') ? [`Pour lui et pour ${txt(d, 'societe')}`] : [], personne: p }));
  if (A) out.push({ cle: 'agence', qui: 'L’agence', nom: A.nom.toUpperCase(), lignes: [`${A.signataireNom}`], agence: true });
  return out;
}

function resume(d: Donnees): Resume {
  return [
    { titre: 'Le local', valeur: txt(d, 'description') || 'À compléter', detail: lieuDe(d) },
    { titre: 'L’engagement', valeur: `${num(d, 'duree') ?? 12} mois`, detail: 'pas de traité en direct, ni par une autre agence' },
  ];
}

function manques(d: Donnees): string[] {
  const out: string[] = [];
  destinatairesDe(d).forEach((p, i) => { if (!p.nom) out.push(`Le nom du destinataire${i ? ` ${i + 1}` : ''}`); });
  if (!txt(d, 'description')) out.push('Le local présenté');
  if (!txt(d, 'ville')) out.push('La ville du local');
  const duree = num(d, 'duree');
  if (!duree || duree < 1 || duree > 36) out.push('La durée de l’engagement : de 1 à 36 mois');
  if (!txt(d, 'faitA') || !txt(d, 'date')) out.push('Le lieu et la date');
  out.push(...manquesSignature(d, casesReconnaissance(d)));
  return out;
}

function defaut(c: Contexte): Donnees {
  const cl = c.client, b = c.bien;
  const p: Personne = { ...PERSONNE_VIDE, prenom: cl?.prenom || '', nom: cl?.nom || '', adresse: cl?.adresse || '', email: cl?.emails?.[0] || '', telephone: cl?.telephones?.[0] || '' };
  return {
    destinataires: [p], societe: '',
    description: b?.titre || '', adresse: b?.adresse || '', cp: b?.code_postal || '', ville: b?.ville || '', quartier: b?.quartier || '',
    montant: '', reference: '',
    duree: 12, honoraires: '', note: '',
    signature: 'en_ligne', faitA: c.identite.ville, date: aujourdhui(),
  };
}

export const RECONNAISSANCE: Modele = {
  id: 'reconnaissance',
  categorie: 'bons_visite',
  titre: 'Reconnaissance d’information',
  description: 'Avant de donner l’adresse : il reconnaît que tu lui as présenté le local, et s’engage à ne pas traiter en direct.',
  ic: 'bouclier',
  signataires: 'Le destinataire, puis l’agence',
  etapes: ETAPES,
  defaut,
  titreDoc: d => `Reconnaissance · ${nomsCourts(destinatairesDe(d))}`,
  sousTitre: d => [txt(d, 'description'), lieuDe(d)].filter(Boolean).join(' · '),
  pour: d => nomsCourts(destinatairesDe(d)),
  rediger,
  resume,
  garde: d => ({
    titre: 'Reconnaissance d’information',
    sous: 'et engagement de ne pas traiter en direct',
    etiquette: `LOCAL PRÉSENTÉ LE ${txt(d, 'date') ? jourLong(txt(d, 'date')).toUpperCase() : '…'}`,
    pour: 'DESTINATAIRE',
    ics: ['agence', 'bouclier', 'calendrier'],
  }),
  entete: d => `Reconnaissance d’information${txt(d, 'date') ? ` du ${jourLong(txt(d, 'date'))}` : ''}`,
  manques,
  cases: casesReconnaissance,
  accepter: () => 'J’ai lu la reconnaissance en entier : l’Agence m’a présenté ce local, et je prends les engagements qu’elle contient.',
};
