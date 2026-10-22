/* ═══ L'offre d'achat ═════════════════════════════════════════════════════
   L'acquéreur propose un prix, pour un temps donné. Ce que la loi encadre,
   et que le texte dit en clair :
     · aucune somme ne peut être versée à l'occasion d'une offre (article
       1589-1 du Code civil) ;
     · une offre assortie d'un délai ne se retire pas avant ce délai
       (article 1116 du Code civil) ;
     · acceptée, elle forme l'accord sur le bien et le prix, que les parties
       constatent ensuite dans un avant-contrat chez le notaire ;
     · l'acquéreur non professionnel a alors dix jours pour se rétracter
       (article L271-1 du Code de la construction et de l'habitation) ;
     · s'il finance par un prêt, l'avant-contrat le prévoit comme condition
       suspensive (article L313-41 du Code de la consommation).
   La dernière partie laisse au vendeur la place de répondre : il accepte,
   refuse, ou fait une contre-proposition, et signe.

   V3.145 — les honoraires d'Alexandre (son mandat de recherche) ne sont
   plus écrits dans l'offre : elle part à l'agence ou au vendeur, qui n'ont
   pas à les voir. Le client, lui, les voit au moment de signer (« Pour vous,
   frais d'agence compris », voir `rappel`) et dans le mail de confirmation.
   Ils viennent du bien (avec inter : aucun ; sans inter ou particulier : son
   taux ou son forfait), et ne peuvent pas dépasser le mandat signé.

   Werner (23 octobre 2026) : une offre pour un LOCAL, selon ce qui est
   proposé (`nature`, src/lib/affaires.ts) :
     · une location : l'offre de prise à bail — le loyer annuel HT HC, le bail
       (commercial, professionnel, dérogatoire), l'entrée dans les lieux, la
       franchise, le dépôt de garantie, l'activité ; ses honoraires ne
       s'ajoutent pas au loyer (ni « total », ni arrondi au millier) ;
     · une cession de droit au bail ou de fonds : le prix de cession, l'accord
       du bailleur, le transfert d'une licence, le séquestre du prix d'un
       fonds ;
     · des murs : l'offre d'achat, sans ce qui ne vaut que pour un logement
       (le délai de rétractation de l'article L271-1 du Code de la
       construction, l'article L313-41 du Code de la consommation).
   Elle peut être faite au nom d'une société (`qui` : 'sci', les mêmes cases
   que le mandat, retrouvées dans le registre national). Ses honoraires se
   disent HT ou TTC, au choix de Werner (`baseHono`, commun.ts). Les clés
   d'avant restent : l'espace du client et le suivi des offres les lisent.

   ⚠️ Texte à faire relire par l'avocat de Werner avant le premier usage. */

import { euros, type Partie, type Bloc, type Fiche, type Resume } from '@/lib/mandat';
import { NATURES, TYPES_BAIL } from '@/lib/affaires';
import { prixDuBien, honorairesDuMandat, plafondMandat, type HonoMandat } from '@/lib/honoraires-bien';
import { lignesMandataire, type IdentiteAgence } from '@/lib/agence';
import {
  P, Pp, eurosLettres, nbLettres, pourcent, jourLong, aujourdhui, txt, num, liste, vrai, couper,
  lirePersonnes, nomComplet, nomsCourts, fichePersonne, blocDonnees, ficheAgence,
  PERSONNE_VIDE, blocsSignature, manquesSignature, electronique, CHAMP_SIGNATURE,
  baseHono, champsBaseHono, motBase, selonBase, tvaDe,
  type Donnees, type Modele, type Etape, type Contexte, type Personne, type Repere, type CaseSignature, type ChampSimple,
} from './commun';

/* ── Ce qui est proposé, et les mots qui vont avec ── */
type Sorte = 'location' | 'cession' | 'achat';
const sorteDe = (d: Donnees): Sorte => (d.nature === 'location' ? 'location' : d.nature === 'cession_bail' || d.nature === 'fonds' ? 'cession' : 'achat');
/** Une offre de location : un loyer annuel, des honoraires à part. */
export const offreLocation = (d: Donnees | null | undefined) => !!d && d.nature === 'location';
const enLocation = (d: Donnees) => d.nature === 'location';
const horsLocation = (d: Donnees) => d.nature !== 'location';
const pourCession = (d: Donnees) => sorteDe(d) === 'cession';
const pourAchat = (d: Donnees) => sorteDe(d) === 'achat';

/* Qui fait l'offre (« le PRENEUR »), à qui (« le BAILLEUR »), et quoi. */
function mots(d: Donnees, pl = false) {
  const n = d.nature;
  if (n === 'location') return { qui: pl ? 'les PRENEURS' : 'le PRENEUR', Qui: pl ? 'Les PRENEURS' : 'Le PRENEUR', pour: 'PRENEUR', un: 'Le preneur', dest: 'le BAILLEUR', Dest: 'Le BAILLEUR', destMaj: 'BAILLEUR', titre: 'Offre de location', sous: 'ferme, de prise à bail d’un local', objet: 'prendre ce local à bail', proprio: 'propriétaire du local', le: 'le bail' };
  if (n === 'cession_bail') return { qui: pl ? 'les CESSIONNAIRES' : 'le CESSIONNAIRE', Qui: pl ? 'Les CESSIONNAIRES' : 'Le CESSIONNAIRE', pour: 'CESSIONNAIRE', un: 'Le cessionnaire', dest: 'le CÉDANT', Dest: 'Le CÉDANT', destMaj: 'CÉDANT', titre: 'Offre de reprise du droit au bail', sous: 'ferme, de reprise d’un droit au bail', objet: 'acquérir le droit au bail de ce local', proprio: 'titulaire du bail', le: 'l’acte de cession' };
  if (n === 'fonds') return { qui: pl ? 'les CESSIONNAIRES' : 'le CESSIONNAIRE', Qui: pl ? 'Les CESSIONNAIRES' : 'Le CESSIONNAIRE', pour: 'CESSIONNAIRE', un: 'Le cessionnaire', dest: 'le CÉDANT', Dest: 'Le CÉDANT', destMaj: 'CÉDANT', titre: 'Offre d’achat du fonds de commerce', sous: 'ferme, d’achat d’un fonds de commerce', objet: 'acquérir ce fonds de commerce', proprio: 'propriétaire du fonds', le: 'l’acte de cession' };
  return { qui: pl ? 'les ACQUÉREURS' : 'l’ACQUÉREUR', Qui: pl ? 'Les ACQUÉREURS' : 'L’ACQUÉREUR', pour: 'ACQUÉREUR', un: 'L’acquéreur', dest: 'le VENDEUR', Dest: 'Le VENDEUR', destMaj: 'VENDEUR', titre: n === 'murs' || n === 'murs_occupes' ? 'Offre d’achat des murs' : 'Offre d’achat', sous: n === 'murs' || n === 'murs_occupes' ? 'ferme, d’achat des murs d’un local' : 'ferme, d’un local', objet: 'acheter ces murs', proprio: 'propriétaire des murs', le: 'l’avant-contrat' };
}
/* « d'acquérir », « de prendre » ; « du CESSIONNAIRE », « des PRENEURS », « de l'ACQUÉREUR ». */
const de = (x: string) => (/^[aeiouyéèêàâh]/i.test(x) ? `d’${x}` : `de ${x}`);
const deQui = (q: string) => (q.startsWith('le ') ? `du ${q.slice(3)}` : q.startsWith('les ') ? `des ${q.slice(4)}` : `de ${q}`);

/* Le bail proposé, en une phrase. */
const BAUX: Record<string, string> = {
  commercial: 'un bail commercial de neuf années, soumis aux articles L145-1 et suivants du Code de commerce, le preneur pouvant y mettre fin à l’expiration de chaque période triennale',
  professionnel: 'un bail professionnel de six années au moins, soumis à l’article 57 A de la loi n° 86-1290 du 23 décembre 1986',
  derogatoire: 'un bail dérogatoire au statut des baux commerciaux, d’une durée de trois ans au plus (article L145-5 du Code de commerce)',
  precaire: 'une convention d’occupation précaire, hors du statut des baux commerciaux',
  civil: 'un bail de droit commun, soumis aux articles 1709 et suivants du Code civil',
};
/* Des honoraires connus en HT (la fiche d'une affaire compte en HT), dits
   dans la base choisie : « 7 200 € HT (8 640 € TTC) » ou l'inverse. */
function honoEnClair(d: Donnees, ht: number): string {
  const ttc = Math.round(ht * (1 + tvaDe(d) / 100));
  return baseHono(d) === 'ttc' ? `${euros(ttc)} TTC (${euros(ht)} HT)` : `${euros(ht)} HT (${euros(ttc)} TTC)`;
}
/* Les questions d'un taux ou d'un forfait de recherche, dans la base choisie. */
const champsHonoRecherche = (): ChampSimple[] => [
  ...selonBase({ t: 'nombre', cle: 'honoTaux', lib: 'Taux', ic: 'pourcent', si: d => d.honoMode === 'taux' && enLocation(d) } as ChampSimple, b => `% ${b} du loyer annuel`),
  ...selonBase({ t: 'nombre', cle: 'honoTaux', lib: 'Taux', ic: 'pourcent', si: d => d.honoMode === 'taux' && horsLocation(d) } as ChampSimple, b => `% ${b} du prix proposé`),
  ...selonBase({ t: 'euros', cle: 'honoForfait', lib: 'Forfait', ic: 'euro', si: d => d.honoMode === 'forfait' } as ChampSimple, b => `€ ${b}`),
];

const ETAPES: Etape[] = [
  {
    id: 'qui', titre: 'Qui fait l’offre', court: 'Qui', sous: 'Lui, ou sa société : son identité complète.', vers: 'Entre les soussignés', ic: 'personne',
    champs: [
      { t: 'choix', cle: 'qui', lib: 'Il fait l’offre…', ic: 'personne', tuiles: true, options: [
        { v: 'personne', l: 'En son nom', aide: 'Lui-même, ou plusieurs personnes', ic: 'personne' },
        { v: 'sci', l: 'Pour une société', aide: 'Sa société, ou une société à créer', ic: 'immeuble' },
      ] },
      { t: 'titre', cle: 't-sci', lib: 'La société', ic: 'immeuble', si: d => d.qui === 'sci' },
      { t: 'texte', cle: 'sciNom', lib: 'Raison sociale', ic: 'immeuble', requis: true, si: d => d.qui === 'sci', exemple: 'SARL Le Comptoir, en cours de création' },
      { t: 'texte', cle: 'sciForme', lib: 'Forme et capital', ic: 'doc', large: true, si: d => d.qui === 'sci', exemple: 'Société à responsabilité limitée au capital de 10 000 €',
        question: 'Préciser sa forme, son siège et son immatriculation ?', avec: ['sciSiege', 'sciRcs'] },
      { t: 'texte', cle: 'sciSiege', lib: 'Siège social', ic: 'lieu', large: true, si: d => d.qui === 'sci' },
      { t: 'texte', cle: 'sciRcs', lib: 'Immatriculation', ic: 'livre', si: d => d.qui === 'sci', exemple: 'RCS de Paris n° 123 456 789' },
      { t: 'personnes', cle: 'acquereurs', lib: 'Qui signe', ic: 'personne', un: 'Signataire', min: 1, max: 4, complet: d => d.qui !== 'sci',
        nomCarte: (d, i) => (d.qui === 'sci' ? 'Son représentant, qui signe' : `Signataire ${i + 1}`) },
      { t: 'texte', cle: 'sciPouvoir', lib: 'Sa qualité', ic: 'plume', si: d => d.qui === 'sci', exemple: 'gérant' },
    ],
  },
  {
    id: 'bien', titre: 'Le local', court: 'Le local', sous: 'Ce qui est proposé, son propriétaire, son montant annoncé.', vers: 'Le local', ic: 'agence',
    champs: [
      { t: 'choix', cle: 'nature', lib: 'Ce qui est proposé', ic: 'cle', requis: true, options: NATURES.map(n => ({ v: n.v, l: n.l, aide: n.aide, ic: n.ic })) },
      { t: 'titre', cle: 't-bien', lib: 'Le local', ic: 'agence' },
      { t: 'texte', cle: 'adresse', lib: 'Adresse du local', ic: 'lieu', large: true, requis: true, avec: ['ville'] },
      { t: 'texte', cle: 'ville', lib: 'Ville', ic: 'immeuble', requis: true },
      { t: 'zone', cle: 'description', lib: 'La désignation du local', ic: 'doc', large: true, exemple: 'une boutique de 60 m² en rez-de-chaussée, avec 6 m de vitrine et une réserve' },
      /* Alexandre (23 octobre 2026) : jamais le nom du propriétaire dans
         l'offre — Werner est l'intermédiaire ; l'offre lui est transmise par
         l'agence, avec le local et les conditions, rien d'autre. */
      { t: 'texte', cle: 'agenceVendeur', lib: 'L’agence qui le propose', ic: 'agence', exemple: 'Agence du Parc, Paris 17e', question: 'Le local est-il proposé par une autre agence ?', aide: 'C’est elle qui transmet l’offre au propriétaire. Sinon, c’est toi.' },
      { t: 'euros', cle: 'prixAffiche', lib: 'Loyer annoncé', ic: 'etiquette', unite: '€ HT HC / an', si: enLocation },
      { t: 'euros', cle: 'prixAffiche', lib: 'Prix annoncé', ic: 'etiquette', si: horsLocation },
    ],
  },
  {
    id: 'prix', titre: 'L’offre', court: 'L’offre', sous: 'Ce qu’il propose, et à quelles conditions.', vers: d => (enLocation(d) ? 'Le loyer proposé' : 'Le prix offert'), reperesApres: 'g-hono', ic: 'euro',
    champs: [
      /* ── Une location : le loyer, le bail ── */
      { t: 'choix', cle: 'auPrix', lib: 'Son offre', ic: 'etiquette', si: d => enLocation(d) && !!num(d, 'prixAffiche'), options: [
        { v: 'oui', l: 'Au loyer annoncé', ic: 'etiquette' }, { v: 'non', l: 'Un autre loyer', ic: 'euro' },
      ] },
      { t: 'euros', cle: 'prix', lib: 'Loyer annuel proposé', ic: 'euro', unite: '€ HT HC / an', requis: true, si: enLocation },
      { t: 'euros', cle: 'chargesAn', lib: 'Provision pour charges', ic: 'euro', unite: '€ HT / an', si: enLocation, question: 'Préciser la provision pour charges ?' },
      { t: 'titre', cle: 't-bail', lib: 'Le bail', ic: 'bail', si: enLocation },
      { t: 'choix', cle: 'bailType', lib: 'Le bail demandé', ic: 'bail', si: enLocation, options: TYPES_BAIL },
      { t: 'date', cle: 'prise', lib: 'Entrée dans les lieux souhaitée', ic: 'calendrier', si: enLocation },
      { t: 'texte', cle: 'activite', lib: 'Son activité dans les lieux', ic: 'sac', large: true, si: d => enLocation(d) || pourCession(d), exemple: 'restauration traditionnelle, avec extraction' },
      { t: 'nombre', cle: 'franchise', lib: 'Franchise de loyer', ic: 'chrono', unite: 'mois', si: enLocation, question: 'Demande-t-il une franchise de loyer ?', rapides: [1, 2, 3, 6] },
      { t: 'nombre', cle: 'depotMois', lib: 'Dépôt de garantie', ic: 'banque', unite: 'mois de loyer HT HC', si: enLocation, rapides: [3, 6] },
      { t: 'choix', cle: 'garantie', lib: 'La garantie qu’il propose', ic: 'bouclier', si: enLocation, options: [
        { v: 'aucune', l: 'Le dépôt de garantie seul', ic: 'banque' },
        { v: 'caution', l: 'La caution de son dirigeant', ic: 'personne' },
        { v: 'gapd', l: 'Une garantie bancaire à première demande', ic: 'bouclier' },
      ] },
      { t: 'zone', cle: 'travaux', lib: 'Les travaux', ic: 'outil', large: true, si: enLocation, question: 'Des travaux à prévoir (à sa charge ou à celle du bailleur) ?', exemple: 'mise en conformité de l’extraction à la charge du bailleur avant l’entrée dans les lieux' },
      /* ── Une cession ou un achat : le prix, son total frais d'agence compris ── */
      { t: 'choix', cle: 'auPrix', lib: 'Son offre', ic: 'etiquette', si: d => horsLocation(d) && !!num(d, 'prixAffiche'), options: [
        { v: 'oui', l: 'Au prix demandé', ic: 'etiquette' }, { v: 'non', l: 'Un autre montant', ic: 'euro' },
      ] },
      { t: 'euros', cle: 'total', lib: 'Son offre, frais d’agence compris', ic: 'euro', requis: true, si: horsLocation,
        aide: 'Ce qu’il veut mettre en tout, hors frais d’acte. Le prix proposé s’en déduit, arrondi au millier.' },
      { t: 'euros', cle: 'prix', lib: 'Proposé au propriétaire', ic: 'agence', si: horsLocation,
        aide: 'Ou tape directement le prix proposé : son total, frais d’agence compris, se calcule.' },
      { t: 'choix', cle: 'forme', lib: 'Ce prix s’entend…', ic: 'etiquette', si: horsLocation, options: [
        { v: 'fai', l: 'Honoraires de l’agence compris', ic: 'agence' }, { v: 'net', l: 'Net pour le propriétaire (sans agence de son côté)', ic: 'personne' },
      ] },
      { t: 'euros', cle: 'honoVendeur', lib: 'Dont honoraires de l’agence', ic: 'agence', unite: '€ HT', si: d => horsLocation(d) && d.forme === 'fai' },
      /* ── Tes honoraires de recherche (jamais écrits dans l'offre) ── */
      { t: 'titre', cle: 't-hono', lib: 'Tes honoraires de recherche', ic: 'loupe' },
      { t: 'choix', cle: 'honoMode', lib: 'Sur ce local', ic: 'loupe', options: [
        { v: 'aucun', l: 'Aucun', aide: 'Ton affaire, ou partagés avec l’agence du local', ic: 'accord' }, { v: 'taux', l: 'Un pourcentage', ic: 'pourcent' }, { v: 'forfait', l: 'Un forfait', ic: 'euro' },
      ] },
      ...champsBaseHono(d => d.honoMode === 'taux' || d.honoMode === 'forfait'),
      ...champsHonoRecherche(),
      { t: 'guide', cle: 'g-hono', titre: d => {
        const prix = num(d, 'prix'), h = honorairesOffre(d);
        if (enLocation(d)) return prix ? `Loyer proposé : ${euros(prix)} HT HC par an${h > 0 ? ` · pour toi : ${euros(h)} ${motBase(d)}` : ''}` : 'Le loyer proposé';
        return prix ? `Pour le propriétaire : ${euros(prix)}${h > 0 ? ` · pour toi : ${euros(h)} ${motBase(d)}` : ''}` : 'Le prix proposé';
      }, points: d => {
        const prix = num(d, 'prix'), h = honorairesOffre(d);
        if (enLocation(d)) return [
          prix
            ? h > 0 ? { ic: 'euro', x: `Tes honoraires : ${euros(h)} ${motBase(d)}, payés à la signature du bail. Ils ne s’ajoutent pas au loyer.` }
              : { ic: 'euro', x: 'Aucun honoraire de recherche sur ce local.' }
            : { ic: 'euro', x: 'Tape le loyer annuel qu’il propose, hors taxes et hors charges.' },
          { ic: 'cadenas', x: 'Tes honoraires de recherche ne sont pas écrits dans l’offre : le bailleur et son agence ne les voient pas.' },
          { ic: 'plume', x: 'Ton client les voit au moment de signer, et les retrouve dans le mail de confirmation.' },
        ];
        return [
          prix
            ? h > 0
              ? d.saisi === 'prix'
                ? { ic: 'euro', x: `Tes honoraires : ${euros(h)} ${motBase(d)}, calculés sur ce prix. Son total, frais d’agence compris : ${euros(prix + h)}.` }
                : { ic: 'euro', x: `Tes honoraires : ${euros(h)} ${motBase(d)}, le reste de son total. Le prix est arrondi au millier au-dessus : un chiffre rond, et tu restes sous ton mandat.` }
              : { ic: 'euro', x: 'Aucun honoraire de recherche : tout son total va au propriétaire.' }
            : { ic: 'euro', x: 'Tape son offre, frais d’agence compris, ou le prix proposé : l’autre se calcule.' },
          { ic: 'cadenas', x: 'Tes honoraires de recherche ne sont pas écrits dans l’offre : le propriétaire et son agence ne les voient pas.' },
          { ic: 'plume', x: 'Ton client les voit au moment de signer, avec son total, et les retrouve dans le mail de confirmation.' },
        ];
      } },
      /* ── Le financement (une cession, un achat) ── */
      { t: 'titre', cle: 't-fin', lib: 'Le financement', ic: 'banque', si: horsLocation },
      { t: 'euros', cle: 'apport', lib: 'Apport personnel', ic: 'euro', si: horsLocation },
      { t: 'choix', cle: 'pret', lib: 'Un prêt ?', ic: 'banque', si: horsLocation, options: [{ v: 'oui', l: 'Oui', ic: 'banque' }, { v: 'non', l: 'Non, sans prêt', ic: 'euro' }] },
      { t: 'euros', cle: 'pretMontant', lib: 'Montant du prêt', ic: 'banque', si: d => horsLocation(d) && d.pret === 'oui' },
      { t: 'nombre', cle: 'pretDuree', lib: 'Durée', ic: 'chrono', unite: 'ans', si: d => horsLocation(d) && d.pret === 'oui' },
      { t: 'nombre', cle: 'pretTaux', lib: 'Taux maximum', ic: 'pourcent', unite: '% hors assurance', si: d => horsLocation(d) && d.pret === 'oui' },
      /* ── Les conditions ── */
      { t: 'titre', cle: 't-cond', lib: 'Les conditions', ic: 'check' },
      { t: 'cases', cle: 'conditions', lib: 'Sous condition de…', ic: 'check', si: enLocation, options: [
        { v: 'autorisations', l: 'Les autorisations pour son activité', aide: 'Urbanisme, enseigne, établissement recevant du public', ic: 'doc' },
        { v: 'financement', l: 'Le financement de ses travaux', ic: 'banque' },
        { v: 'autre', l: 'Une autre condition', ic: 'plus' },
      ] },
      { t: 'cases', cle: 'conditions', lib: 'Sous condition de…', ic: 'check', si: pourCession, options: [
        { v: 'bailleur', l: 'L’accord du bailleur sur la cession', ic: 'bail' },
        { v: 'destination', l: 'L’accord du bailleur sur son activité', aide: 'Si le bail ne la permet pas : une déspécialisation', ic: 'sac' },
        { v: 'licence', l: 'Le transfert de la licence', ic: 'doc' },
        { v: 'autre', l: 'Une autre condition', ic: 'plus' },
      ] },
      { t: 'cases', cle: 'conditions', lib: 'Sous condition de…', ic: 'check', si: pourAchat, options: [
        { v: 'autre', l: 'Une autre condition', ic: 'plus' },
      ] },
      { t: 'zone', cle: 'conditionAutre', lib: 'L’autre condition', ic: 'plume', large: true, si: d => liste(d, 'conditions').includes('autre') },
    ],
  },
  {
    id: 'delais', titre: 'Les délais', court: 'Délais', sous: 'Combien de temps l’offre tient, et la suite.', vers: 'Ce que l’offre engage', ic: 'calendrier',
    champs: [
      { t: 'guide', cle: 'g-offre', titre: () => 'Ce que l’offre engage', points: d => [
        { ic: 'euro', x: 'Aucune somme n’est versée avec l’offre.' },
        { ic: 'calendrier', x: 'Jusqu’à la date de validité, il ne peut pas la retirer. Sans réponse à temps, elle tombe d’elle-même.' },
        { ic: 'retour', x: enLocation(d) ? 'Acceptée, elle mène à la signature du bail, qui en reprend les conditions.'
          : pourCession(d) ? 'Acceptée, elle mène à l’acte de cession, rédigé par un avocat ou un notaire.'
            : 'Acceptée, elle mène à l’avant-contrat, signé chez le notaire.' },
      ] },
      { t: 'date', cle: 'validite', lib: 'Offre valable jusqu’au', ic: 'calendrier', requis: true },
      { t: 'heure', cle: 'validiteHeure', lib: 'À', ic: 'horloge' },
      { t: 'texte', cle: 'notaire', lib: 'Son notaire ou son avocat', ic: 'balance', large: true, exemple: 'Me Leroy, avocat à Paris', question: 'Veux-tu préciser son notaire ou son avocat ?' },
      { t: 'zone', cle: 'note', lib: 'Une précision', ic: 'plume', large: true, question: 'Une précision à ajouter ?' },
    ],
  },
  {
    id: 'signature', titre: 'La signature', court: 'Signature', sous: 'Comment, où et quand elle sera signée.', vers: 'Date et signatures', ic: 'plume',
    champs: [
      CHAMP_SIGNATURE,
      { t: 'texte', cle: 'faitA', lib: 'Fait à', ic: 'lieu', requis: true },
      { t: 'date', cle: 'date', lib: 'Le', ic: 'calendrier', requis: true },
    ],
  },
];

function acquereursDe(d: Donnees): Personne[] {
  const l = lirePersonnes(d.acquereurs);
  return l.length ? l : [{ ...PERSONNE_VIDE }];
}

/* ── Ses honoraires sur ce bien (V3.145) ──
   Au prix offert : aucun (inter-cabinet), un pourcentage, ou un forfait.
   Une offre d'avant gardait un montant tout fait (`honoRecherche`). */
export function honorairesOffre(d: Donnees): number {
  const prix = num(d, 'prix') || 0, total = num(d, 'total');
  if (d.honoMode === 'aucun') return 0;
  /* Depuis son total : le reste, une fois le prix arrondi (voir decomposer). */
  if ((d.honoMode === 'taux' || d.honoMode === 'forfait') && total && prix) return Math.max(0, total - prix);
  if (d.honoMode === 'taux') { const t = num(d, 'honoTaux'); return t && prix ? Math.round((prix * t) / 100) : 0; }
  if (d.honoMode === 'forfait') return num(d, 'honoForfait') || 0;
  return num(d, 'honoRecherche') || 0;
}

/* V3.189 — La validité par défaut d'une offre : dix jours (Alexandre ;
   avant, cinq). Elle se change dans l'éditeur, et dans l'espace du client. */
export const VALIDITE_JOURS = 10;

/* Ses honoraires sur un prix pour le vendeur donné, à son taux ou son
   forfait entier (une offre tapée « pour le vendeur », une contre-
   proposition) : 470 000 € à 2,5 % → 11 750 €. */
export function honorairesSurPrix(d: Donnees, prix: number): number {
  if (!prix || prix <= 0) return 0;
  if (d.honoMode === 'taux') { const t = num(d, 'honoTaux') || 0; return t > 0 ? Math.round((prix * t) / 100) : 0; }
  if (d.honoMode === 'forfait') return num(d, 'honoForfait') || 0;
  if (d.honoMode === 'aucun') return 0;
  return num(d, 'honoRecherche') || 0;
}
/* Son total, frais d'agence compris, pour un prix pour le vendeur. */
export const totalPourPrix = (d: Donnees, prix: number) => prix + honorairesSurPrix(d, prix);

/* Son total, frais d'agence compris → le prix proposé au vendeur.
   Alexandre (9 octobre) : « s'il dit 450, ça s'affiche 450 ». V3.189 : le
   prix est arrondi au MILLIER AU-DESSUS (Alexandre : « 492, 481, mais pas
   de centaines ») — 480 000 € à 2,5 % → 469 000 €, et non 468 293 € (un
   chiffre qui trahirait le calcul) ni 468 300 € ; ses honoraires prennent
   le reste (11 000 €) : un peu moins que le taux, jamais plus — on reste
   sous le mandat. Le total affiché est toujours celui qu'il a dit. */
export function decomposer(d: Donnees): { prix: number | null; hono: number } {
  const total = num(d, 'total');
  if (!total || total <= 0) return { prix: null, hono: 0 };
  /* À l'euro d'abord : 512 500 / 1,025 vaut 499 999,999… en machine, et ne
     doit pas monter à 501 000. */
  const mille = (x: number) => Math.min(total, Math.ceil(Math.round(x) / 1000) * 1000);
  if (d.honoMode === 'taux') {
    const t = num(d, 'honoTaux') || 0;
    if (t > 0) { const prix = mille(total / (1 + t / 100)); return { prix, hono: total - prix }; }
  }
  if (d.honoMode === 'forfait') {
    const f = num(d, 'honoForfait') || 0;
    if (f > 0 && f < total) { const prix = mille(total - f); return { prix, hono: total - prix }; }
  }
  return { prix: total, hono: 0 };
}

/* « Au prix demandé » se coche tout seul quand le prix pour le vendeur est
   celui de l'annonce ; il ne se décoche que s'il a déjà été choisi. */
function auPrixDe(d: Donnees, prix: number | null): unknown {
  const affiche = num(d, 'prixAffiche');
  if (prix && affiche && prix === affiche) return 'oui';
  return d.auPrix ? 'non' : d.auPrix ?? null;
}
/* Le prix pour le vendeur, tapé tel quel : son total s'en calcule. */
function depuisPrix(d: Donnees, prix: number | null): Donnees {
  if (!prix) return { ...d, saisi: 'prix', prix: null, total: null, auPrix: auPrixDe(d, null) };
  return { ...d, saisi: 'prix', prix, total: totalPourPrix(d, prix), auPrix: auPrixDe(d, prix) };
}

/* L'éditeur recalcule à chaque réponse (`cle` : le champ qui vient de
   bouger ; '' à l'ouverture). V3.189 : deux cases liées — son total, frais
   d'agence compris (le prix pour le vendeur s'en déduit, arrondi au
   millier), ou le prix pour le vendeur (son total s'en calcule) ; la
   dernière tapée (`saisi`) commande quand ses honoraires changent. « Au prix
   demandé » met le prix de l'annonce. Une offre d'avant n'avait que son
   prix : son total s'en déduit à l'ouverture. Vider une case vide l'autre
   (sinon le champ se remplirait tout seul pendant qu'on tape). */
/* V3.190 — Un bien de son mandat (`honoVente`, src/lib/offre-agence.ts) :
   ses honoraires du mandat de vente, quand l'acquéreur les paie, suivent le
   prix offert (« soit un prix net revenant au vendeur de… »). */
function avecHonoVente(d: Donnees): Donnees {
  const hv = d.honoVente && typeof d.honoVente === 'object' ? d.honoVente as Record<string, unknown> : null;
  if (!hv) return d;
  const prix = num(d, 'prix');
  const forfait = typeof hv.forfait === 'number' && hv.forfait > 0 ? hv.forfait : null;
  const taux = typeof hv.taux === 'number' && hv.taux > 0 ? hv.taux : null;
  /* Werner : une location, le taux s'applique au loyer annuel, sans rien en retirer. */
  const h = !prix ? null : forfait !== null ? forfait : taux !== null ? (enLocation(d) ? Math.round((prix * taux) / 100) : Math.round(prix - prix / (1 + taux / 100))) : null;
  return h === num(d, 'honoVendeur') ? d : { ...d, honoVendeur: h };
}
function deduire(d0: Donnees, cle: string): Donnees {
  return avecHonoVente(deduirePrix(d0, cle));
}
function deduirePrix(d0: Donnees, cle: string): Donnees {
  /* Une offre d'avant la V3.145 : ses honoraires étaient un montant
     (`honoRecherche`) ; ils deviennent un forfait, ou rien. */
  const d: Donnees = d0.honoMode ? d0 : { ...d0, honoMode: num(d0, 'honoRecherche') ? 'forfait' : 'aucun', honoForfait: num(d0, 'honoRecherche') || null };
  /* Werner : une location — le loyer se tape tel quel ; ses honoraires ne
     s'y ajoutent pas (pas de « total », pas d'arrondi). */
  if (enLocation(d)) {
    const affiche = num(d, 'prixAffiche');
    if (cle === 'auPrix' && d.auPrix === 'oui' && affiche) return { ...d, prix: affiche, total: null, saisi: 'prix' };
    /* Un montant venu comme « total » (l'espace du client) : c'est son loyer. */
    const prix = cle === 'total' && num(d, 'total') ? num(d, 'total') : num(d, 'prix');
    const auPrix = prix && affiche && prix === affiche ? 'oui' : d.auPrix ? 'non' : d.auPrix ?? null;
    return d.total === null && d.saisi === 'prix' && d.auPrix === auPrix && prix === num(d, 'prix') ? d : { ...d, prix, total: null, saisi: 'prix', auPrix };
  }
  if (cle === 'auPrix') {
    const affiche = num(d, 'prixAffiche');
    return d.auPrix === 'oui' && affiche ? depuisPrix(d, affiche) : d;
  }
  if (cle === 'prix') return depuisPrix(d, num(d, 'prix'));
  if (cle === 'total') {
    if (!num(d, 'total')) return { ...d, saisi: 'total', prix: null, auPrix: auPrixDe(d, null) };
    const { prix } = decomposer(d);
    return { ...d, saisi: 'total', prix, auPrix: auPrixDe(d, prix) };
  }
  /* Ses honoraires ont changé (ou l'ouverture) : la case tapée en dernier commande. */
  if (d.saisi === 'prix') {
    const prix = num(d, 'prix');
    if (!prix) return d;
    const total = totalPourPrix(d, prix);
    return total === num(d, 'total') ? d : { ...d, total };
  }
  const total = num(d, 'total');
  if (!total) {
    const prix = num(d, 'prix');
    if (!prix || cle) return d;
    return { ...d, total: totalPourPrix(d, prix) };
  }
  const { prix } = decomposer(d);
  return prix === num(d, 'prix') ? d : { ...d, prix };
}
/* Le mandat de recherche relu à la création de l'offre (texte « 2,5 % TTC »). */
export function mandatDe(d: Donnees): HonoMandat | null {
  const m = d.honoMandat as HonoMandat | null | undefined;
  return m && (m.type === 'pourcentage' || m.type === 'fixe') && Number(m.val) > 0 ? m : null;
}
/* Au-dessus du mandat ? La phrase qui le dit, ou null. */
function depasseMandat(d: Donnees): string | null {
  const m = mandatDe(d), prix = num(d, 'prix') || 0, h = honorairesOffre(d);
  const plafond = plafondMandat(m, prix);
  if (!m || plafond === null || h <= plafond + 1) return null;
  return `${euros(h)}, au-dessus de son mandat (${m.texte}, soit ${euros(plafond)} à ce prix) : tu ne peux pas prendre plus que ce qu’il a signé.`;
}

/* Pour Alexandre seul (le Suivi du client, la fiche de l'offre) : son
   total, ce qui part au vendeur, et ce qu'il touchera. Le client ne lit
   jamais le Suivi. */
export function noteOffre(d: Donnees): string | null {
  const prix = num(d, 'prix');
  if (!prix) return null;
  const loc = enLocation(d);
  const montant = `${euros(prix)}${loc ? ' HT HC par an' : ''}`;
  /* V3.190 : un bien de ton mandat — tes honoraires sont ceux du mandat de vente. */
  if (txt(d, 'bienVenteId')) {
    const hv = num(d, 'honoVendeur');
    return `Son offre : ${montant} · ton affaire${hv ? ` (tes honoraires : ${euros(hv)} HT)` : ''}`;
  }
  const h = honorairesOffre(d);
  if (loc) return `Son offre : ${montant}${h > 0 ? ` · tes honoraires : ${euros(h)} ${motBase(d)}` : ' · sans honoraires de recherche'}`;
  return h > 0
    ? `Son offre : ${euros(prix + h)} frais d’agence compris · proposé au propriétaire : ${euros(prix)} · tes honoraires : ${euros(h)} ${motBase(d)}`
    : `Son offre : ${euros(prix)} · sans honoraires de recherche`;
}

/* V3.189 — Ce que son total représente face au prix de l'annonce : « soit
   20 000 € de moins que le prix affiché (500 000 €) ». Alexandre : c'est ce
   qui le rassure (« il voit qu'il a gagné »). Vide sans prix d'annonce. */
export function ecartPrixAffiche(d: Donnees): string {
  const affiche = num(d, 'prixAffiche'), prix = num(d, 'prix');
  if (!affiche || !prix) return '';
  /* Une location : le loyer face au loyer annoncé. */
  if (enLocation(d)) return affiche - prix >= 1 ? `soit ${euros(affiche - prix)} de moins par an que le loyer annoncé (${euros(affiche)})` : '';
  const total = prix + honorairesOffre(d);
  const diff = affiche - total;
  /* Seulement ce qu'il gagne : la pastille est verte. Au prix ou au-dessus,
     rien — son total et sa décomposition se suffisent. */
  return diff >= 1 ? `soit ${euros(diff)} de moins que le prix affiché (${euros(affiche)})` : '';
}

/* Le rappel montré à l'acquéreur au moment de signer, et repris dans son
   mail de confirmation : jamais dans l'offre elle-même. */
function rappel(d: Donnees): { titre: string; valeur: string; detail: string; ecart?: string } | null {
  const prix = num(d, 'prix');
  if (!prix) return null;
  const h = honorairesOffre(d);
  const ecart = ecartPrixAffiche(d);
  /* Werner : une location — le loyer, et nos honoraires à part, une seule fois. */
  if (enLocation(d)) {
    const hv = txt(d, 'bienVenteId') ? num(d, 'honoVendeur') || 0 : 0;
    const honos = h > 0 ? `${euros(h)} ${motBase(d)}` : hv > 0 ? honoEnClair(d, hv) : '';
    return { titre: 'Votre loyer proposé', valeur: `${euros(prix)} HT HC par an`,
      detail: honos ? `et nos honoraires, ${honos}, une seule fois, à la signature du bail` : 'hors taxes et hors charges', ...(ecart ? { ecart } : {}) };
  }
  return h > 0
    ? { titre: 'Pour vous, frais d’agence compris', valeur: euros(prix + h), detail: `dont ${euros(prix)} proposés au propriétaire et ${euros(h)} ${motBase(d)} de nos honoraires · hors frais d’acte`, ...(ecart ? { ecart } : {}) }
    : { titre: 'Pour vous, frais d’agence compris', valeur: euros(prix), detail: 'rien de plus à payer, hors frais d’acte', ...(ecart ? { ecart } : {}) };
}

/* « jusqu'au 2 novembre 2026 à 18 h 00 » */
const jusquauDe = (d: Donnees) => `${txt(d, 'validite') ? jourLong(txt(d, 'validite')) : '……………'}${txt(d, 'validiteHeure') ? ` à ${txt(d, 'validiteHeure').replace(':', ' h ')}` : ''}`;

function rediger(d: Donnees, A: IdentiteAgence): Partie[] {
  const as = acquereursDe(d);
  const sci = d.qui === 'sci' && !!txt(d, 'sciNom');
  /* Pour une société, elle fait l'offre (au singulier), par son représentant. */
  const pl = !sci && as.length > 1;
  const M = mots(d, pl);
  const sorte = sorteDe(d);
  const adresse = [txt(d, 'adresse'), txt(d, 'ville')].filter(Boolean).join(', ');
  const prix = num(d, 'prix');
  const hv = num(d, 'honoVendeur');
  const conds = liste(d, 'conditions');
  const jusquau = jusquauDe(d);
  const v = (un: string, plusieurs: string) => (pl ? plusieurs : un);

  /* Qui fait l'offre : les personnes, ou la société et son représentant. */
  const pied = pl ? `Ci-après ensemble « ${M.qui} »` : `Ci-après « ${M.qui} »`;
  const qui: Fiche[] = sci
    ? [{ ic: 'agence', titre: txt(d, 'sciNom').toUpperCase(), lignes: [
      txt(d, 'sciForme'), txt(d, 'sciSiege') ? `Siège : ${txt(d, 'sciSiege')}` : '', txt(d, 'sciRcs'),
      `Représentée par ${nomComplet(as[0])}${txt(d, 'sciPouvoir') ? `, ${txt(d, 'sciPouvoir')}` : ''}, dûment habilité${as[0].civilite === 'Madame' ? 'e' : ''}.`,
    ].filter(Boolean), pied }]
    : as.map((p, i) => fichePersonne(p, 'personne', i === as.length - 1 ? pied : undefined));
  /* Jamais son nom : l'offre va au propriétaire par l'intermédiaire de
     l'agence qui propose le local (Werner, ou une autre agence). */
  const par = txt(d, 'agenceVendeur') && txt(d, 'agenceVendeur') !== A.nom ? txt(d, 'agenceVendeur') : 'l’Agence';
  const entre: Bloc[] = [
    { t: 'fiches', items: [...qui, ficheAgence(A, lignesMandataire(A).slice(0, 3), undefined, 'Ci-après « l’Agence », qui transmet l’offre')] },
    P(`${M.Qui} ${v('adresse', 'adressent')} la présente offre au ${M.proprio}, par l’intermédiaire de ${par}, ci-après « ${M.dest} ».`),
  ];

  const nat = NATURES.find(n => n.v === d.nature);
  const local: Bloc[] = [P(`${adresse || 'Adresse à compléter'}${txt(d, 'description') ? ` : ${txt(d, 'description')}` : ''}.`, true)];
  if (nat) local.push(P(`Ce qui est proposé : ${nat.l.toLowerCase()}.`));
  if (num(d, 'prixAffiche')) local.push(P(sorte === 'location' ? `Loyer annoncé : ${euros(num(d, 'prixAffiche') || 0)} hors taxes et hors charges par an.` : `Prix annoncé : ${euros(num(d, 'prixAffiche') || 0)}.`));
  if (d.nature === 'murs_occupes') local.push(P('Les murs sont vendus occupés : le bail en cours se poursuit avec l’acquéreur.'));

  /* ── Une location ── */
  if (sorte === 'location') {
    const charges = num(d, 'chargesAn'), franchise = num(d, 'franchise'), depot = num(d, 'depotMois');
    const loyer: Bloc[] = [
      P(`${M.Qui} ${v('offre', 'offrent')} de prendre ce local à bail moyennant un loyer annuel de ${prix ? eurosLettres(prix) : '……………'}, hors taxes et hors charges${charges ? `, auquel s’ajoute une provision pour charges de ${euros(charges)} hors taxes par an` : ''}.`, true),
      P('Le loyer s’entend hors taxes : la TVA s’y ajoute si le bailleur y est soumis.'),
    ];
    if (franchise) loyer.push(P(`${M.Qui} ${v('demande', 'demandent')} une franchise de loyer de ${nbLettres(franchise)} mois à compter de la prise d’effet du bail.`));
    if (depot) loyer.push(P(`Dépôt de garantie : ${nbLettres(depot)} mois de loyer hors taxes et hors charges${prix ? `, soit ${euros(Math.round((prix * depot) / 12))}` : ''}, versé à la signature du bail.`));
    /* Ton affaire : tes honoraires, à la charge du preneur, se disent. */
    if (txt(d, 'bienVenteId') && hv) loyer.push(P(`Les honoraires de l’Agence, ${honoEnClair(d, hv)}, sont à la charge du PRENEUR et payables à la signature du bail.`));
    const bail: Bloc[] = [P(`Le bail demandé : ${BAUX[String(d.bailType)] || BAUX.commercial}.`, true)];
    bail.push(P(`Prise d’effet souhaitée : ${txt(d, 'prise') ? `le ${jourLong(txt(d, 'prise'))}` : 'à une date à convenir entre les parties'}.`));
    if (txt(d, 'activite')) bail.push(P(`Activité exercée dans les lieux : ${txt(d, 'activite')}. Le bail en fixera la destination.`));
    if (d.garantie === 'caution') bail.push(P(`Garantie : la caution personnelle de son dirigeant, en plus du dépôt de garantie.`));
    if (d.garantie === 'gapd') bail.push(P('Garantie : une garantie bancaire à première demande, en plus du dépôt de garantie.'));
    if (txt(d, 'travaux')) bail.push(P(`Travaux : ${txt(d, 'travaux')}`));

    const lesConds = [
      ...(conds.includes('autorisations') ? [`l’obtention des autorisations nécessaires à son activité dans les lieux (urbanisme, enseigne, établissement recevant du public) ;`] : []),
      ...(conds.includes('financement') ? ['l’obtention du financement de ses travaux d’aménagement ;'] : []),
      ...(conds.includes('autre') && txt(d, 'conditionAutre') ? [`${txt(d, 'conditionAutre')} ;`] : []),
    ];
    const engage: Bloc[] = [
      P(`Cette offre est valable jusqu’au ${jusquau}. Elle ne peut être retirée avant cette date (article 1116 du Code civil). Sans acceptation écrite du BAILLEUR à cette date, elle devient caduque, sans aucune formalité.`, true),
      P('Si le BAILLEUR l’accepte par écrit dans ce délai, les parties s’engagent à signer, dans un délai raisonnable, un bail reprenant les conditions ci-dessus, rédigé par le conseil du BAILLEUR (notaire ou avocat). Les autres clauses du bail se discuteront de bonne foi.'),
      P('Aucune somme n’est versée à l’occasion de la présente offre. Le dépôt de garantie et le premier terme de loyer seront versés à la signature du bail.', true),
    ];
    if (txt(d, 'notaire')) engage.push(P(`Conseil du PRENEUR : ${txt(d, 'notaire')}.`));
    if (txt(d, 'note')) engage.push(P(`Précision : ${txt(d, 'note')}`));
    return [{
      titre: M.titre, court: 'L’offre de location', sous: adresse || 'Offre ferme', ic: 'euro',
      sections: [
        { titre: 'Entre les soussignés', blocs: entre },
        { titre: 'Le local', ic: 'agence', blocs: local },
        { titre: 'Le loyer proposé', ic: 'etiquette', blocs: loyer },
        { titre: 'Le bail', ic: 'doc', blocs: bail },
        { titre: 'Les conditions', ic: 'check', blocs: lesConds.length
          ? [P('La présente offre est faite sous les conditions suivantes :'), { t: 'l', items: lesConds }]
          : [P('La présente offre est faite sans autre condition que la signature du bail aux conditions ci-dessus.')] },
        { titre: 'Ce que l’offre engage', ic: 'balance', blocs: engage },
        { titre: 'Informations', ic: 'info', blocs: [blocDonnees(A)] },
        signatures(d, A, M, pl),
        reponse(d, M, prix ? `au loyer annuel de ${euros(prix)} hors taxes et hors charges` : '', jusquau),
      ],
    }];
  }

  /* ── Une cession (droit au bail, fonds) ou un achat (les murs) ── */
  const prixB: Bloc[] = [
    P(`${M.Qui} ${v('offre', 'offrent')} ${de(M.objet)} au prix de ${prix ? eurosLettres(prix) : '……………'}${d.forme === 'fai' ? ', honoraires de l’agence compris' : `, net pour ${M.dest}`}.`, true),
  ];
  if (d.forme === 'fai' && prix && hv) prixB.push(P(`Soit un prix revenant au ${M.destMaj} de ${euros(prix - hv)} et des honoraires de ${honoEnClair(d, hv)}, à la charge ${deQui(M.qui)}.`));
  prixB.push(P(sorte === 'cession'
    ? `Les frais de l’acte de cession (droits d’enregistrement et honoraires de son rédacteur) sont en sus, à la charge ${deQui(M.qui)}, comme l’usage le veut.`
    : 'Les frais de l’acte (droits de mutation et émoluments du notaire) sont en sus, à la charge de l’acquéreur, comme l’usage le veut.'));
  if (sorte === 'cession' && txt(d, 'activite')) prixB.push(P(`Activité qu’il exercera dans les lieux : ${txt(d, 'activite')}.`));

  const fin: Bloc[] = [];
  const apport = num(d, 'apport');
  if (vrai(d, 'pret')) {
    const m = num(d, 'pretMontant'), n = num(d, 'pretDuree'), t = num(d, 'pretTaux');
    fin.push(P(`${M.Qui} ${v('finance', 'financent')} cette acquisition ${apport ? `par un apport de ${euros(apport)} et ` : ''}par un ou plusieurs prêts${m ? ` d’un montant total de ${euros(m)}` : ''}${n ? `, sur ${nbLettres(n)} ans au plus` : ''}${t !== null && t > 0 ? `, au taux maximum de ${pourcent(t)} hors assurance` : ''}.`, true));
    fin.push(P(`${sorte === 'cession' ? 'L’acte de cession' : 'L’avant-contrat'} sera conclu sous la condition suspensive de l’obtention de ce financement.`));
  } else if (d.pret === 'non') {
    fin.push(P(`${M.Qui} ${v('déclare', 'déclarent')} financer cette acquisition sans recourir à un prêt${apport ? `, au moyen de ${v('ses', 'leurs')} fonds propres (${euros(apport)})` : ''}.`, true));
  } else {
    fin.push(P(`Le financement sera précisé dans ${sorte === 'cession' ? 'l’acte de cession' : 'l’avant-contrat'}.`));
  }

  const conditions: string[] = [
    ...(vrai(d, 'pret') ? ['l’obtention du financement décrit ci-dessus ;'] : []),
    ...(sorte === 'cession' && conds.includes('bailleur') ? ['l’accord du bailleur sur la cession, lorsque le bail l’exige, et son concours à l’acte s’il est prévu ;'] : []),
    ...(sorte === 'cession' && conds.includes('destination') ? [`l’accord du bailleur pour l’exercice de son activité dans les lieux${txt(d, 'activite') ? ` (${txt(d, 'activite')})` : ''} ;`] : []),
    ...(sorte === 'cession' && conds.includes('licence') ? ['le transfert à son profit de la licence attachée à l’exploitation ;'] : []),
    ...(conds.includes('autre') && txt(d, 'conditionAutre') ? [`${txt(d, 'conditionAutre')} ;`] : []),
    ...(sorte === 'achat' ? ['les conditions suspensives d’usage : absence de servitude ou de charge grave, urbanisme compatible avec son usage, purge des droits de préemption, et situation hypothécaire permettant une vente libre.'] : []),
    ...(sorte === 'cession' ? ['la purge des droits de préemption éventuels (commune, bailleur) et l’absence d’inscription faisant obstacle à la cession.'] : []),
  ];

  const engage: Bloc[] = [
    P(`Cette offre est valable jusqu’au ${jusquau}. Elle ne peut être retirée avant cette date (article 1116 du Code civil). Sans acceptation écrite ${M.dest === 'le CÉDANT' ? 'du CÉDANT' : 'du VENDEUR'} à cette date, elle devient caduque, sans aucune formalité.`, true),
    P(sorte === 'cession'
      ? `Si le CÉDANT l’accepte par écrit dans ce délai, l’accord sur la chose et sur le prix est formé. Les parties s’engagent à le constater par un acte de cession, rédigé par un avocat ou un notaire, dans un délai raisonnable, en principe de trente à soixante jours suivant l’acceptation, reprenant les conditions ci-dessus.`
      : 'Si le VENDEUR l’accepte par écrit dans ce délai, l’accord sur le bien et sur le prix est formé. Les parties s’engagent à le constater dans un avant-contrat (compromis ou promesse de vente) signé chez le notaire dans un délai raisonnable, en principe de trente à quarante-cinq jours suivant l’acceptation, reprenant les conditions ci-dessus.'),
  ];
  if (d.nature === 'fonds') engage.push(P('Le prix sera séquestré entre les mains du rédacteur de l’acte le temps des oppositions des créanciers du cédant, comme la loi et l’usage le prévoient.'));
  engage.push(P(sorte === 'achat'
    ? 'Aucune somme n’est versée à l’occasion de la présente offre : la loi l’interdit (article 1589-1 du Code civil). Le dépôt de garantie éventuel sera prévu par l’avant-contrat et versé entre les mains du notaire.'
    : 'Aucune somme n’est versée à l’occasion de la présente offre. Un éventuel acompte sera prévu par l’acte de cession et versé entre les mains de son rédacteur.', true));
  if (txt(d, 'notaire')) engage.push(P(`${sorte === 'cession' ? 'Conseil' : 'Notaire ou avocat'} ${deQui(M.qui)} : ${txt(d, 'notaire')}.`));
  if (txt(d, 'note')) engage.push(P(`Précision : ${txt(d, 'note')}`));

  return [{
    titre: M.titre,
    court: sorte === 'cession' ? 'L’offre de reprise' : 'L’offre d’achat',
    sous: adresse || 'Offre ferme',
    ic: 'euro',
    sections: [
      { titre: 'Entre les soussignés', blocs: entre },
      { titre: 'Le local', ic: 'agence', blocs: local },
      { titre: 'Le prix offert', ic: 'etiquette', blocs: prixB },
      { titre: 'Le financement', ic: 'banque', blocs: fin },
      { titre: 'Les conditions', ic: 'check', blocs: [P(`${sorte === 'cession' ? 'L’acte de cession' : 'L’avant-contrat'} sera conclu sous les conditions suivantes :`), { t: 'l', items: conditions }] },
      { titre: 'Ce que l’offre engage', ic: 'balance', blocs: engage },
      { titre: 'Informations', ic: 'info', blocs: [blocDonnees(A), P(`Lutte contre le blanchiment : ${M.un.charAt(0).toLowerCase()}${M.un.slice(1)} fournira à l’Agence, et au rédacteur de l’acte, les justificatifs d’identité et d’origine des fonds qui lui seront demandés (articles L561-1 et suivants du Code monétaire et financier).`)] },
      signatures(d, A, M, pl),
      reponse(d, M, prix ? `au prix de ${euros(prix)}` : '', jusquau),
    ],
  }];
}

/* La date, et les cadres de signature (l'offre). */
function signatures(d: Donnees, A: IdentiteAgence, M: ReturnType<typeof mots>, pl: boolean) {
  void M;
  const quoi = enLocation(d) ? 'Bon pour offre de location au loyer annuel de ______ euros HT HC' : 'Bon pour offre au prix de ______ euros';
  return { titre: 'Date et signatures', ic: 'plume' as const, blocs: blocsSignature(d, {
    papier: `Fait à ${txt(d, 'faitA') || '……………'}, le ${txt(d, 'date') ? jourLong(txt(d, 'date')) : '……………'}.`,
    mention: `${pl ? 'Chaque signataire' : 'Le signataire'} date et signe, précédé de la mention manuscrite « ${quoi} ».`,
    cases: casesOffre(d, A),
  }) };
}

/* La réponse du bailleur, du cédant ou du vendeur. */
function reponse(d: Donnees, M: ReturnType<typeof mots>, montant: string, jusquau: string) {
  const Dest = M.Dest;
  /* Signée en ligne ou sur place, l'offre part en PDF : il répond par écrit. */
  if (electronique(d)) return { titre: `Réponse du ${M.destMaj.toLowerCase()}`, ic: 'accord' as const, blocs: [
    P(`${Dest} adresse sa réponse par écrit à l’Agence avant le ${jusquau} : il accepte la présente offre${montant ? ` ${montant}` : ''}, aux conditions ci-dessus, la refuse, ou fait une contre-proposition. Une contre-proposition vaut refus de la présente offre ; elle n’engage ${M.qui} qu’une fois signée par ${M.qui.startsWith('les ') ? 'eux' : 'lui'}.`),
    Pp(`${M.un} charge l’Agence de recevoir cette réponse : l’acceptation reçue par l’Agence dans le délai forme l’accord. L’Agence la transmet par écrit (un e-mail suffit), le jour même.`),
  ] };
  return { titre: `Réponse du ${M.destMaj.toLowerCase()}`, ic: 'accord' as const, blocs: [
    P(`À remplir par ${M.dest} avant le ${jusquau}, puis à retourner signé à l’Agence.`),
    { t: 'case' as const, coche: false, x: `${Dest} ACCEPTE la présente offre${montant ? ` ${montant}` : ''}, aux conditions ci-dessus.` },
    { t: 'case' as const, coche: false, x: `${Dest} REFUSE la présente offre.` },
    { t: 'case' as const, coche: false, x: `${Dest} fait la contre-proposition suivante : ____________________________ (elle ne vaut acceptation qu’une fois contresignée).` },
    Pp('Mots rayés nuls : ______   ·   Lignes rayées nulles : ______'),
    { t: 'sigs' as const, mention: `Il date et signe, précédé de la mention « Bon pour acceptation » s’il accepte.`, cases: [
      { qui: `Le ${M.destMaj.toLowerCase()}`, nom: '________________', lignes: ['Le __________ à ____ h ____'] },
      { qui: `Le ${M.destMaj.toLowerCase()}`, nom: '________________', lignes: ['Le __________ à ____ h ____'] },
    ] },
    Pp('L’acceptation est portée à la connaissance du signataire de l’offre par l’Agence, par écrit (un e-mail suffit), le jour même.'),
  ] };
}

function resume(d: Donnees): Resume {
  const prix = num(d, 'prix');
  const lieu = { titre: 'Le local', valeur: txt(d, 'adresse') || 'À compléter', detail: couper([txt(d, 'ville'), txt(d, 'description')].filter(Boolean).join(' · '), 90) || '—' };
  const validite = { titre: 'Valable jusqu’au', valeur: txt(d, 'validite') ? jourLong(txt(d, 'validite')) : 'À compléter', detail: txt(d, 'validiteHeure') ? `à ${txt(d, 'validiteHeure').replace(':', ' h ')}` : 'sans retrait possible avant' };
  if (enLocation(d)) {
    const bail = TYPES_BAIL.find(x => x.v === d.bailType);
    return [
      lieu,
      { titre: 'Loyer proposé', valeur: prix ? `${euros(prix)} HT HC / an` : 'À compléter', detail: num(d, 'franchise') ? `franchise de ${num(d, 'franchise')} mois` : 'hors taxes et hors charges' },
      { titre: 'Le bail', valeur: bail?.l || 'Bail commercial 3/6/9', detail: txt(d, 'prise') ? `entrée le ${jourLong(txt(d, 'prise'))}` : 'entrée à convenir' },
      validite,
    ];
  }
  return [
    lieu,
    { titre: 'Prix offert', valeur: prix ? euros(prix) : 'À compléter', detail: d.forme === 'fai' ? 'honoraires de l’agence compris' : 'net pour le propriétaire' },
    { titre: 'Financement', valeur: vrai(d, 'pret') ? `Prêt${num(d, 'pretMontant') ? ` de ${euros(num(d, 'pretMontant') || 0)}` : ''}` : d.pret === 'non' ? 'Sans prêt' : 'À préciser',
      detail: num(d, 'apport') ? `apport de ${euros(num(d, 'apport') || 0)}` : '—' },
    validite,
  ];
}

/* Les cadres de signature : chaque acquéreur, puis l'agence qui transmet. */
function casesOffre(d: Donnees, A?: IdentiteAgence): CaseSignature[] {
  /* Werner : « Le preneur », « Le cessionnaire », « L'acquéreur » ; pour
     une société, son représentant signe pour elle. */
  const sci = d.qui === 'sci' && !!txt(d, 'sciNom');
  const un = mots(d).un;
  const out: CaseSignature[] = acquereursDe(d).map((p, i) => ({ cle: `a${i}`, qui: un, nom: nomComplet(p), lignes: sci && i === 0 ? [`Pour ${txt(d, 'sciNom')}`] : [] as string[], personne: p }));
  if (A) out.push({ cle: 'agence', qui: 'Transmise par', nom: A.nom.toUpperCase(), lignes: [`${A.signataireNom}, ${A.signataireQualite}`], agence: true });
  return out;
}

function manques(d: Donnees): string[] {
  const out: string[] = [];
  const sci = d.qui === 'sci';
  if (sci && !txt(d, 'sciNom')) out.push('Le nom de la société');
  acquereursDe(d).forEach((p, i) => {
    if (!p.nom || !p.prenom) out.push(sci ? 'Le nom de son représentant' : `Le nom du signataire ${i + 1}`);
    else if (!p.adresse && !sci) out.push(`L’adresse de ${nomComplet(p)}`);
  });
  if (!d.nature) out.push('Ce qui est proposé (location, cession, murs)');
  if (!txt(d, 'adresse') || !txt(d, 'ville')) out.push('L’adresse du local');
  if (!num(d, 'prix')) out.push(enLocation(d) ? 'Le loyer proposé' : 'Son offre, frais d’agence compris');
  if (depasseMandat(d)) out.push('Tes honoraires : au-dessus de son mandat de recherche');
  if (horsLocation(d) && !d.pret) out.push('Le financement (avec ou sans prêt)');
  if (!txt(d, 'validite')) out.push('La date de validité de l’offre');
  if (!txt(d, 'faitA') || !txt(d, 'date')) out.push('Le lieu et la date');
  out.push(...manquesSignature(d, casesOffre(d)));
  return out;
}

/* Les repères de l'éditeur : l'écart avec le prix annoncé, et le plan de
   financement qui doit tomber juste. */
function reperes(d: Donnees, etape: string): Repere[] {
  const out: Repere[] = [];
  if (etape !== 'prix') return out;
  const prix = num(d, 'prix'), affiche = num(d, 'prixAffiche');
  const recherche = honorairesOffre(d);
  /* Werner : une location — son loyer face au loyer annoncé ; ses honoraires à part. */
  if (enLocation(d)) {
    if (prix && affiche) {
      const ecart = ((prix - affiche) / affiche) * 100;
      out.push({ l: 'Loyer annoncé', v: `${euros(affiche)} HT HC / an` });
      out.push({ l: 'Son loyer par rapport à l’annonce', v: prix === affiche ? 'au loyer annoncé' : `${ecart > 0 ? '+' : ''}${pourcent(ecart)} (${ecart < 0 ? '−' : '+'}${euros(Math.abs(prix - affiche))} par an)` });
    }
    if (prix && num(d, 'surface')) out.push({ l: 'Au mètre carré', v: `${euros(Math.round(prix / (num(d, 'surface') || 1)))} HT HC / m² / an` });
    const trop = depasseMandat(d);
    if (trop) out.push({ l: 'Tes honoraires', v: trop, ton: 'alerte' });
    else if (recherche && !mandatDe(d)) out.push({ l: 'Tes honoraires', v: 'Vérifie qu’il a un mandat de recherche signé : sans mandat, tu ne peux pas lui demander d’honoraires.', ton: 'alerte' });
    return out;
  }
  /* L'écart se lit en « frais d'agence compris », comme le client pense :
     son total face au prix demandé, ses honoraires au même taux compris. */
  if (prix && affiche) {
    const total = prix + recherche;
    const hDemande = d.honoMode === 'taux' ? Math.round((affiche * (num(d, 'honoTaux') || 0)) / 100) : d.honoMode === 'forfait' ? num(d, 'honoForfait') || 0 : 0;
    const demande = affiche + hDemande;
    const ecart = ((total - demande) / demande) * 100;
    out.push({ l: hDemande ? 'Prix demandé, frais d’agence compris' : 'Prix demandé', v: euros(demande) });
    out.push({ l: 'Son offre par rapport au prix demandé', v: total === demande ? 'au prix demandé' : `${ecart > 0 ? '+' : ''}${pourcent(ecart)} (${ecart < 0 ? '−' : '+'}${euros(Math.abs(total - demande))})` });
  }
  if (prix) {
    const total = prix + recherche;
    const trop = depasseMandat(d);
    if (trop) out.push({ l: 'Tes honoraires', v: trop, ton: 'alerte' });
    else if (recherche && !mandatDe(d)) out.push({ l: 'Tes honoraires', v: 'Vérifie qu’il a un mandat de recherche signé : sans mandat, tu ne peux pas lui demander d’honoraires.', ton: 'alerte' });
    const apport = num(d, 'apport') || 0, pret = d.pret === 'oui' ? num(d, 'pretMontant') || 0 : 0;
    if (apport || pret) {
      const reste = total - apport - pret;
      out.push(reste > 0
        ? { l: 'Financement', v: `Apport et prêt couvrent ${euros(apport + pret)} : il manque ${euros(reste)}, sans compter les frais de notaire.`, ton: 'alerte' }
        : { l: 'Financement', v: `Apport et prêt couvrent le prix${recherche ? ' et tes honoraires' : ''} ; reste à prévoir les frais de notaire.`, ton: 'ok' });
    }
  }
  if (d.forme === 'fai' && prix && num(d, 'honoVendeur') && (num(d, 'honoVendeur') || 0) >= prix) out.push({ l: 'Honoraires', v: 'Les honoraires dépassent le prix offert : vérifie les montants.', ton: 'alerte' });
  return out;
}

function defaut(c: Contexte): Donnees {
  const cl = c.client, b = c.bien;
  /* V3.145 : le prix de l'annonce, et ses honoraires tels que fixés sur le
     bien (avec inter : aucun) ; à défaut de taux sur le bien, celui du mandat. */
  const pb = prixDuBien(b);
  const mandat = honorairesDuMandat(c.recherche || null);
  const surBien = b && !pb.agence && pb.hono > 0 && Number(b.commission_val) > 0
    ? { mode: b.commission_type === 'fixe' ? 'forfait' : 'taux', val: Number(b.commission_val) } : null;
  const p: Personne = { ...PERSONNE_VIDE, prenom: cl?.prenom || '', nom: cl?.nom || '', adresse: cl?.adresse || '', email: cl?.emails?.[0] || '', telephone: cl?.telephones?.[0] || '' };
  /* Werner : « local commercial, 60 m², rez-de-chaussée » (plus de pièces). */
  const desc = b ? [b.type_bien, b.surface ? `${b.surface} m²` : '', b.etage != null ? (b.etage === 0 ? 'rez-de-chaussée' : `${b.etage}e étage`) : ''].filter(Boolean).join(', ').toLowerCase() : '';
  const dans = (j: number) => new Date(Date.now() + j * 86_400_000).toISOString().slice(0, 10);
  /* Ce qui est proposé : celui de l'affaire, ou de sa copie chez le demandeur ; une location sinon (le plus courant). */
  const proNature = b?.pro && typeof b.pro === 'object' ? (b.pro as { nature?: unknown }).nature : null;
  const nature = typeof b?.nature === 'string' && b.nature ? b.nature : typeof proNature === 'string' && proNature ? proNature : 'location';
  const loc = nature === 'location';
  return {
    qui: 'personne', sciNom: '', sciForme: '', sciSiege: '', sciRcs: '', sciPouvoir: '',
    nature, surface: b?.surface ?? null,
    bailType: 'commercial', prise: '', activite: '', franchise: null, depotMois: null, garantie: '', travaux: '', chargesAn: null,
    baseHono: 'ht', tvaHono: 20,
    acquereurs: [p],
    adresse: b?.adresse || '', ville: b?.ville || '', description: desc, vendeurNom: '',
    /* V3.189 — Alexandre : le nom de l'agence du vendeur n'a pas d'intérêt
       dans l'offre (Emilio la transmet, le vendeur répond à Emilio), et
       l'espace du client ne montre jamais le nom d'un confrère. La question
       reste dans l'éditeur, vide. */
    agenceVendeur: '',
    prixAffiche: pb.demande, total: null, prix: null, forme: b?.est_particulier ? 'net' : 'fai', honoVendeur: null,
    honoMode: surBien ? surBien.mode : 'aucun',
    honoTaux: surBien?.mode === 'taux' ? surBien.val : mandat?.type === 'pourcentage' ? mandat.val : null,
    honoForfait: surBien?.mode === 'forfait' ? surBien.val : mandat?.type === 'fixe' ? mandat.val : null,
    honoMandat: mandat,
    apport: null, pret: loc ? null : 'oui', pretMontant: null, pretDuree: nature === 'murs' || nature === 'murs_occupes' ? 15 : 7, pretTaux: null, conditions: [],
    validite: dans(VALIDITE_JOURS), validiteHeure: '18:00', notaire: '', saisi: loc ? 'prix' : 'total', auPrix: null, note: '', signature: 'en_ligne', faitA: c.identite.ville, date: aujourdhui(),
  };
}

/* Le nom de qui fait l'offre : sa société, ou les personnes. */
const noms = (d: Donnees) => (d.qui === 'sci' && txt(d, 'sciNom') ? txt(d, 'sciNom') : nomsCourts(acquereursDe(d)));

export const OFFRE_ACHAT: Modele = {
  id: 'offre_achat',
  categorie: 'offres',
  titre: 'Offre',
  description: 'Une offre ferme pour un local : prise à bail, reprise d’un droit au bail ou d’un fonds, achat des murs. Avec la place pour la réponse.',
  ic: 'euro',
  signataires: 'Celui qui fait l’offre, puis le propriétaire pour répondre',
  etapes: ETAPES,
  defaut,
  titreDoc: d => `${mots(d).titre} · ${noms(d)}`,
  sousTitre: d => [txt(d, 'adresse'), txt(d, 'ville')].filter(Boolean).join(', '),
  pour: d => noms(d),
  rediger,
  resume,
  garde: d => {
    const prix = num(d, 'prix');
    const M = mots(d);
    return {
      titre: M.titre,
      sous: M.sous,
      etiquette: `${prix ? `${euros(prix).toUpperCase()}${enLocation(d) ? ' HT HC / AN' : ''} · ` : ''}VALABLE JUSQU’AU ${txt(d, 'validite') ? jourLong(txt(d, 'validite')).toUpperCase() : '…'}`,
      pour: M.pour,
      ics: ['agence', 'etiquette', 'euro', 'calendrier'],
    };
  },
  entete: d => `${mots(d).titre}${txt(d, 'adresse') ? ` · ${txt(d, 'adresse')}` : ''}`,
  manques,
  reperes,
  cases: casesOffre,
  rappel,
  deduire,
  accepter: d => {
    const prix = num(d, 'prix');
    const jusquau = jusquauDe(d);
    if (enLocation(d)) return `J’ai lu cette offre en entier et je m’engage à prendre ce local à bail${prix ? ` au loyer annuel de ${eurosLettres(prix)} hors taxes et hors charges` : ''}, aux conditions ci-dessus. Mon offre tient jusqu’au ${jusquau} : bon pour offre de location.`;
    const M = mots(d);
    return `J’ai lu cette offre en entier et je m’engage à ${M.objet}${prix ? ` au prix de ${eurosLettres(prix)}${d.forme === 'fai' ? ', honoraires de l’agence compris' : `, net pour ${M.dest}`}` : ''}, aux conditions ci-dessus. Mon offre tient jusqu’au ${jusquau} : bon pour offre.`;
  },
};

/* V3.50 : l'instant où l'offre cesse de valoir — sa date de validité, à
   l'heure dite (sinon à 23 h 59), à l'heure de Paris. Avant, rien ne la
   lisait : le lien de signature valait 15 jours, le dernier rappel partait
   au 7e jour, et une offre se signait encore après sa date. Null : pas de
   date lisible. Navigateur et serveur. */
export function finValiditeOffre(d: Donnees): Date | null {
  const jour = txt(d, 'validite');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return null;
  const heure = /^\d{2}:\d{2}$/.test(txt(d, 'validiteHeure')) ? txt(d, 'validiteHeure') : '23:59';
  const t = new Date(`${jour}T${heure}:${heure === '23:59' ? '59' : '00'}${decalageParis(jour)}`);
  return Number.isFinite(t.getTime()) ? t : null;
}
/* Le décalage de Paris sur l'heure universelle, ce jour-là (« +02:00 »). */
function decalageParis(ymd: string): string {
  try {
    const t = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' })
      .formatToParts(new Date(`${ymd}T12:00:00Z`)).find(x => x.type === 'timeZoneName')?.value || '';
    const m = /GMT([+-]\d{2}):?(\d{2})/.exec(t);
    return m ? `${m[1]}:${m[2]}` : '+01:00';
  } catch { return '+01:00'; }
}
