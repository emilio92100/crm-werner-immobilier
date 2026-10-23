/**
 * Le point automatique — « Où en est votre recherche ? »
 *
 * Quand un dossier ne bouge plus depuis un certain temps (45 jours par
 * défaut), un mail part tout seul au client. Il lui rappelle sa recherche et
 * lui propose cinq réponses : je cherche toujours, mes critères ont changé,
 * j'ai trouvé, j'ai mis en pause ou arrêté, je souhaite être rappelé. Sa
 * réponse arrive dans le CRM comme n'importe quelle réaction du client.
 *
 * ── Pour qui (23 octobre 2026, réglage `point_auto_pour`) ──
 *   'espace'     les demandeurs « Actif » qui ont leur espace : chaque bouton
 *                ouvre l'espace sur la bonne fenêtre (comme avant) ;
 *   'recherche'  tous ceux qui ont une recherche en cours, prospects compris.
 *                Ceux qui ont un espace répondent toujours depuis l'espace ;
 *                les autres, sur une petite page sans compte, /point/<jeton>
 *                (src/app/point), qui écrit par /api/point/repondre. Le jeton
 *                est tiré à chaque envoi et rangé dans le metadata de la ligne
 *                « point_auto » du suivi : c'est elle qui dit à qui il parle.
 *
 * Ce fichier ne dépend ni du navigateur ni du serveur : on lui passe un
 * client Supabase. La route d'envoi quotidienne (/api/point-auto/envoi) et
 * celle du CRM (/api/point-auto) s'en servent toutes les deux, pour que
 * « qui recevrait le mail » et « qui le reçoit » soient calculés pareil.
 *
 * ── Ce qui compte comme un mouvement ──
 *   ✓ tout ce qui s'écrit dans le suivi du client (journal) : un appel, une
 *     note, un mail, un changement de critères, un bien ajouté, une visite,
 *     un changement de statut… et les réactions du client lui-même (avis
 *     sur un bien, message, demande de rappel, réponse à ce mail) ;
 *   ✓ un bien envoyé (biens.envoye_le) et l'avis du client sur un bien
 *     (biens.retour_le) ;
 *   ✗ le client qui ouvre simplement son espace : ça s'écrit dans
 *     espace_evenements, pas dans le journal — et c'est voulu. Quelqu'un qui
 *     ouvre son espace et n'y trouve rien doit quand même recevoir le mail.
 *   ✗ le mail automatique lui-même (type « point_auto »), sinon il se
 *     remettrait à zéro tout seul.
 *
 * ── Quand le mail part ──
 *   Échéance = la plus récente de ces trois dates + le délai :
 *   dernier mouvement, dernier mail automatique, création du dossier.
 *   Donc : un mail 45 jours après le dernier mouvement ; sans réponse, le
 *   suivant 45 jours plus tard ; au moindre mouvement, le compteur repart.
 *
 * ── Les réglages (table `parametres`, couples clé / valeur) ──
 *   point_auto_actif   'oui' | 'non'   — 'non' tant qu'Alexandre ne l'a pas allumé
 *   point_auto_delai   '30' | '45' | '60'
 *   point_auto_exclus  liste JSON d'identifiants de clients à ne jamais relancer
 *   point_auto_pour    'espace' | 'recherche'  — 'espace' tant que rien n'est choisi
 *   Rien de nouveau dans la base : aucune migration à lancer.
 */

import { lienEspace } from '@/lib/jeton';
import { acheteurEnCours, colonneContactAbsente, estAcheteur, estArchive, reventePossible } from '@/lib/contacts';
import { LIEN_POLICE_MAIL, LOGO_BLANC_MAIL, LOGO_MAIL } from '@/lib/mail-charte';
import { EMPLACEMENTS, nomEquipement } from '@/lib/affaires';
import { coordonneesDe, type Coordonnees } from '@/lib/agence';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Base = any;

export const CLE_ACTIF = 'point_auto_actif';
export const CLE_DELAI = 'point_auto_delai';
export const CLE_EXCLUS = 'point_auto_exclus';
export const CLE_POUR = 'point_auto_pour';

/** À qui le mail part : les demandeurs avec un espace, ou tous ceux qui ont une recherche en cours. */
export type Pour = 'espace' | 'recherche';
export const POURS: readonly Pour[] = ['espace', 'recherche'];
/** Les statuts d'un dossier en cours, pour chaque choix. */
const STATUTS_DE: Record<Pour, string[]> = { espace: ['actif'], recherche: ['actif', 'prospect'] };
/** Une réponse par la page sans espace se donne jusqu'à ce délai après l'envoi. */
export const JOURS_REPONSE = 90;

export const DELAIS = [30, 45, 60] as const;
export const DELAI_DEFAUT = 45;

/** Le mail envoyé : écrit dans le journal, il ne compte pas comme un mouvement. */
export const TYPE_ENVOI = 'point_auto';
/** « Je cherche toujours » : une réaction du client, elle compte. */
export const TYPE_REPONSE = 'point_auto_reponse';

/** Les réponses du client qui disent qu'il a réagi à un mail automatique. */
const TYPES_REACTION = [
  TYPE_REPONSE, 'retour_client', 'message_client', 'demande_rappel',
  'criteres_modifies', 'fin_recherche', 'partage_client',
];

/** Au-delà, on s'arrête pour la journée : un réglage raté ne doit pas écrire à toute la base. */
export const PLAFOND_PAR_JOUR = 30;

export type Reglages = { actif: boolean; delai: number; exclus: string[]; pour: Pour };

export function reglagesDepuis(lignes: { cle: string; valeur: string | null }[] | null | undefined): Reglages {
  const p: Record<string, string> = {};
  (lignes || []).forEach((l) => { p[l.cle] = l.valeur || ''; });
  const d = parseInt(p[CLE_DELAI] || '', 10);
  let exclus: string[] = [];
  try {
    const brut = JSON.parse(p[CLE_EXCLUS] || '[]');
    if (Array.isArray(brut)) exclus = brut.filter((x) => typeof x === 'string');
  } catch { exclus = []; }
  return {
    actif: p[CLE_ACTIF] === 'oui',
    delai: (DELAIS as readonly number[]).includes(d) ? d : DELAI_DEFAUT,
    exclus,
    pour: p[CLE_POUR] === 'recherche' ? 'recherche' : 'espace',
  };
}

export async function lireReglages(sb: Base): Promise<Reglages> {
  const { data, error } = await sb.from('parametres').select('cle, valeur')
    .in('cle', [CLE_ACTIF, CLE_DELAI, CLE_EXCLUS, CLE_POUR]);
  if (error) throw new Error('Lecture des réglages impossible : ' + error.message);
  return reglagesDepuis(data);
}

/** La date à partir de laquelle le mail part, si rien ne bouge d'ici là. */
export function echeance(o: { dernierMouvement?: string | null; dernierEnvoi?: string | null; creeLe?: string | null; delai: number }): Date {
  const t = [o.dernierMouvement, o.dernierEnvoi, o.creeLe]
    .filter(Boolean)
    .map((x) => new Date(String(x)).getTime())
    .filter((x) => !Number.isNaN(x));
  const ref = t.length ? Math.max(...t) : Date.now();
  return new Date(ref + o.delai * 86_400_000);
}

const plusRecent = (a: string | null, b: string | null) =>
  !a ? b : !b ? a : (new Date(a) > new Date(b) ? a : b);

export type Envoi = { le: string; reponse: string | null; reponduLe: string | null };

export type Candidat = {
  clientId: string;
  prenom: string;
  nom: string;
  email: string | null;
  statut: string;
  revente: boolean;
  tokenClient: string | null;
  /** Il répond depuis son espace (sinon : la page sans compte, /point/<jeton>). */
  viaEspace: boolean;
  recherche: any | null;
  dernierMouvement: string | null;
  dernierEnvoi: string | null;
  echeance: string;
  /** Rien ne bloque et l'échéance est passée : le mail partira au prochain envoi. */
  du: boolean;
  /** Pourquoi le mail ne part pas pour ce client (vide s'il peut partir). */
  empechement: string | null;
  /** Werner a choisi de ne jamais lui envoyer ce mail. */
  exclu: boolean;
  historique: Envoi[];
  /** V3.240 — La création du dossier : ce qui fait l'échéance quand rien
      d'autre ne bouge, pour qu'un écran la recalcule tout de suite avec un
      autre délai. */
  creeLe: string | null;
  /** Calcul en paquets : rien dans le suivi depuis FENETRE_JOURS jours (et un
      dossier plus vieux que ça). On dit « plus de deux mois », sans date. */
  ancien: boolean;
};

/* Ce que le client a répondu après un envoi : sa première réaction dans les
   trente jours qui suivent. Au-delà, ce n'est plus une réponse au mail. */
function libelleReaction(type: string, titre: string, metadata?: any): string {
  if (type === TYPE_REPONSE) return metadata?.reponse === 'criteres' ? '« Mes critères ont changé »' : '« Je cherche toujours »';
  if (type === 'criteres_modifies') return 'critères modifiés';
  if (type === 'demande_rappel') return 'demande de rappel';
  if (type === 'message_client') return 'message';
  if (type === 'retour_client') return 'avis sur un local';
  if (type === 'fin_recherche') {
    if (/trouvé son (bien|local) avec nous/.test(titre)) return '« J’ai trouvé, grâce à vous »';
    if (/trouvé son (bien|local)/.test(titre)) return '« J’ai trouvé par un autre biais »';
    if (/pause/.test(titre)) return '« Je mets ma recherche en pause »';
    if (/arrête/.test(titre)) return '« J’arrête ma recherche »';
    return 'fin de recherche';
  }
  if (type === 'partage_client') return 'a partagé un local';
  return 'réaction';
}

/* ── Le calcul pour un client, à partir de ce qu'on a lu ── */
/* Avec un espace (activé, et son lien créé), il y répond : on ne lui parle
   que d'une recherche que l'espace montre. Sans, la page de réponse ne
   dépend pas de l'espace : une recherche en cours suffit. */
function viaEspaceDe(c: any, reglages: Reglages): boolean {
  return reglages.pour === 'espace' || (c.espace_client === true && !!c.token_espace);
}
function choisirRecherche(rechs: any[], viaEspace: boolean): any | null {
  const visible = (r: any) => r.espace_actif !== false;
  return rechs.find((r: any) => r.active && visible(r))
    || (viaEspace ? null : rechs.find((r: any) => r.active))
    || rechs.find(visible) || null;
}
function emailDe(c: any): string | null {
  return (Array.isArray(c.emails) ? c.emails : []).map((e: string) => String(e || '').trim()).find((e: string) => /.+@.+\..+/.test(e)) || null;
}
function empechementDe(c: any, reglages: Reglages, email: string | null, recherche: any): string | null {
  if (!STATUTS_DE[reglages.pour].includes(c.statut)) {
    return c.statut === 'prospect'
      ? 'En recherche : le mail ne part qu’aux Accompagnés. Pour l’envoyer aussi à ceux en recherche : Paramètres › Point automatique › Pour qui.'
      : c.statut === 'suspendu' ? 'En pause : le mail ne part pas. Il repartira quand sa recherche reprendra.'
        : c.statut === 'bien_trouve' || c.statut === 'perdu' ? 'Sa recherche est terminée : le mail ne part pas.'
          : `Le mail ne part que pour les recherches en cours (${reglages.pour === 'recherche' ? 'Accompagnés ou En recherche' : 'Accompagnés'}).`;
  }
  if (!estAcheteur(c)) return 'Ce contact n’est plus demandeur : le mail ne part pas.';
  if (estArchive(c)) return 'Ce contact est archivé : le mail ne part pas.';
  if (reglages.exclus.includes(c.id)) return 'Tu as choisi de ne jamais lui envoyer ce mail.';
  if (!email) return 'Pas d’adresse mail sur sa fiche.';
  if (!recherche) return 'Pas de recherche en cours.';
  if (reglages.pour === 'espace' && !c.token_espace) return 'Son espace n’a pas encore de lien : ouvre sa fiche une fois pour le créer.';
  /* Werner : réservé aux espaces, le mail ne part pas sans espace activé. */
  if (reglages.pour === 'espace' && c.espace_client !== true) return 'Pas d’espace client : le mail est réservé aux Accompagnés qui ont leur espace. Pour l’envoyer aussi sans espace : Paramètres › Point automatique › Pour qui.';
  return null;
}
function candidat(c: any, reglages: Reglages, maintenant: Date, x: {
  rechs: any[]; dernierMouvement: string | null; dernierEnvoi: string | null; ancien: boolean; historique: Envoi[];
}): Candidat {
  const email = emailDe(c);
  const viaEspace = viaEspaceDe(c, reglages);
  const recherche = choisirRecherche(x.rechs, viaEspace);
  const empechement = empechementDe(c, reglages, email, recherche);
  const ech = echeance({ dernierMouvement: x.dernierMouvement, dernierEnvoi: x.dernierEnvoi, creeLe: c.created_at, delai: reglages.delai });
  return {
    clientId: c.id, prenom: c.prenom || '', nom: c.nom || '', email, statut: c.statut,
    revente: reventePossible(c), tokenClient: c.token_espace || null, viaEspace,
    recherche, dernierMouvement: x.dernierMouvement, dernierEnvoi: x.dernierEnvoi,
    echeance: ech.toISOString(),
    du: !empechement && ech.getTime() <= maintenant.getTime(),
    empechement, exclu: reglages.exclus.includes(c.id), historique: x.historique,
    creeLe: c.created_at || null, ancien: x.ancien,
  };
}

/* Toutes les lignes d'une requête, page après page (Supabase en rend 1 000 au plus). */
async function toutLire(quoi: string, fabrique: (de: number, a: number) => any): Promise<any[]> {
  const tout: any[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await fabrique(de, de + PAGE - 1);
    if (error) throw new Error(`Lecture ${quoi} impossible : ${error.message}`);
    tout.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return tout;
}

/**
 * Pour chaque client visé : son dernier mouvement, son dernier mail, la date
 * du prochain, et ce qui empêcherait l'envoi.
 *
 * Sans `clientId`, on prend tous les dossiers en cours (actifs, et les
 * prospects quand le mail est « pour tous ceux qui ont une recherche ») :
 * c'est ce que fait l'envoi quotidien, en paquets, sans l'historique des
 * envois. Avec, on calcule pour ce seul client, quel que soit son statut,
 * historique compris — c'est ce qu'affiche sa fiche.
 */
export async function calculerCandidats(sb: Base, reglages: Reglages, opts: { clientId?: string; maintenant?: Date } = {}): Promise<Candidat[]> {
  const maintenant = opts.maintenant || new Date();

  /* V3.50 : avec les types et l'archive. Un contact qui n'est plus acheteur
     (le type retiré) ou qui est archivé gardait son statut « actif » et
     recevait encore « Où en est votre recherche ? ». Avant le SQL des types,
     les colonnes manquent : on relit sans elles (tout le monde est acheteur). */
  const COLS = 'id, prenom, nom, emails, statut, created_at, statut_occupation, bien_actuel_a_vendre, token_espace';
  /* V3.240 : les dossiers peuvent dépasser le millier que Supabase rend d'un
     coup : lus par pages. */
  const lire = async (cols: string): Promise<{ data: any[] | null; error: any }> => {
    if (opts.clientId) return sb.from('clients').select(cols).eq('id', opts.clientId);
    try {
      return { data: await toutLire('des clients', (de, a) => sb.from('clients').select(cols).in('statut', STATUTS_DE[reglages.pour])
        .order('id', { ascending: true }).range(de, a)), error: null };
    } catch (e) { return { data: null, error: { message: e instanceof Error ? e.message : String(e) } }; }
  };
  /* Werner : `espace_client` en plus, quand son SQL est passé. */
  let { data: clients, error } = await lire(`${COLS}, types, archive, espace_client`);
  if (error && /espace_client/.test(error.message)) ({ data: clients, error } = await lire(`${COLS}, types, archive`));
  if (error && colonneContactAbsente(error.message)) ({ data: clients, error } = await lire(COLS));
  if (error) throw new Error('Lecture des clients impossible : ' + error.message);
  /* L'envoi quotidien : seulement les vrais acheteurs. Pour une fiche
     précise, on calcule quand même, et on dit pourquoi rien ne part. */
  if (!opts.clientId) clients = (clients || []).filter((c: any) => acheteurEnCours(c));
  if (!clients?.length) return [];
  return opts.clientId ? [await pourUnClient(sb, reglages, clients[0], maintenant)] : enPaquets(sb, reglages, clients, maintenant);
}

/* ── Un seul client (sa fiche) : tout son suivi, et l'historique des envois ── */
async function pourUnClient(sb: Base, reglages: Reglages, c: any, maintenant: Date): Promise<Candidat> {
  const [mv, env, bi, re] = await Promise.all([
    sb.from('journal').select('created_at').eq('client_id', c.id).neq('type', TYPE_ENVOI)
      .order('created_at', { ascending: false }).limit(1),
    sb.from('journal').select('created_at').eq('client_id', c.id).eq('type', TYPE_ENVOI)
      .order('created_at', { ascending: false }).limit(6),
    sb.from('biens').select('envoye_le, retour_le').eq('client_id', c.id),
    sb.from('recherches').select('*').eq('client_id', c.id).order('created_at', { ascending: true }),
  ]);
  if (mv.error) throw new Error('Lecture du suivi impossible : ' + mv.error.message);
  if (env.error) throw new Error('Lecture des envois impossible : ' + env.error.message);
  if (bi.error) throw new Error('Lecture des biens impossible : ' + bi.error.message);
  if (re.error) throw new Error('Lecture des recherches impossible : ' + re.error.message);

  let dernierMouvement: string | null = mv.data?.[0]?.created_at || null;
  for (const b of (bi.data || []) as any[]) {
    dernierMouvement = plusRecent(dernierMouvement, b.envoye_le || null);
    dernierMouvement = plusRecent(dernierMouvement, b.retour_le || null);
  }
  const envois: string[] = (env.data || []).map((e: any) => e.created_at);

  /* L'historique des envois, avec la première réaction qui a suivi chacun. */
  const historique: Envoi[] = [];
  for (let i = 0; i < envois.length; i++) {
    const le = envois[i];
    const jusqua = new Date(Math.min(new Date(le).getTime() + 30 * 86_400_000,
      i > 0 ? new Date(envois[i - 1]).getTime() : Number.MAX_SAFE_INTEGER)).toISOString();
    const { data: rep } = await sb.from('journal').select('type, titre, metadata, created_at')
      .eq('client_id', c.id).in('type', TYPES_REACTION)
      .gt('created_at', le).lt('created_at', jusqua)
      .order('created_at', { ascending: true }).limit(1);
    const r = rep?.[0];
    historique.push({ le, reponse: r ? libelleReaction(r.type, r.titre || '', r.metadata) : null, reponduLe: r?.created_at || null });
  }
  return candidat(c, reglages, maintenant, {
    rechs: (re.data || []) as any[], dernierMouvement, dernierEnvoi: envois[0] || null, ancien: false, historique,
  });
}

/* ── Tous les dossiers visés (l'envoi du matin, Paramètres) : en paquets ──
   V3.240 (Alexandre : « ça met très longtemps à charger […] c'est pareil sur
   Werner ») : trois lectures par client, une par une, c'était des centaines
   d'allers-retours. Ici, une poignée par paquet de 100 clients, et seulement
   le suivi des FENETRE_JOURS derniers jours : le délai le plus long est de
   60 jours, donc un dossier sans rien de plus récent est dû de toute façon
   (la seule chose perdue est la date exacte de son dernier mouvement :
   « plus de deux mois »). */
async function enPaquets(sb: Base, reglages: Reglages, clients: any[], maintenant: Date): Promise<Candidat[]> {
  const fenetre = new Date(maintenant.getTime() - FENETRE_JOURS * 86_400_000).toISOString();
  const ids: string[] = clients.map((c: any) => c.id);
  const paquets: string[][] = [];
  for (let k = 0; k < ids.length; k += PAQUET_IDS) paquets.push(ids.slice(k, k + PAQUET_IDS));

  const recherches = new Map<string, any[]>();
  const mouvement = new Map<string, string>();
  const envoi = new Map<string, string>();
  const noter = (m: Map<string, string>, id: string, d: string | null | undefined) => {
    const r = plusRecent(m.get(id) || null, d || null); if (r) m.set(id, r);
  };
  const unPaquet = async (p: string[]) => {
    const [re, jo, en, rt] = await Promise.all([
      toutLire('des recherches', (de, a) => sb.from('recherches').select('*').in('client_id', p).order('created_at', { ascending: true }).range(de, a)),
      toutLire('du suivi', (de, a) => sb.from('journal').select('client_id, created_at, type').in('client_id', p).gte('created_at', fenetre)
        .order('created_at', { ascending: false }).range(de, a)),
      toutLire('des biens', (de, a) => sb.from('biens').select('client_id, envoye_le').in('client_id', p).gte('envoye_le', fenetre).order('id', { ascending: true }).range(de, a)),
      toutLire('des biens', (de, a) => sb.from('biens').select('client_id, retour_le').in('client_id', p).gte('retour_le', fenetre).order('id', { ascending: true }).range(de, a)),
    ]);
    for (const r of re) { const l = recherches.get(r.client_id) || []; l.push(r); recherches.set(r.client_id, l); }
    for (const j of jo) noter(j.type === TYPE_ENVOI ? envoi : mouvement, j.client_id, j.created_at);
    for (const b of en) noter(mouvement, b.client_id, b.envoye_le);
    for (const b of rt) noter(mouvement, b.client_id, b.retour_le);
  };
  /* Quelques paquets à la fois. */
  let suivant = 0;
  const ouvrier = async () => { while (suivant < paquets.length) { const k = suivant++; await unPaquet(paquets[k]); } };
  await Promise.all(Array.from({ length: Math.min(PAQUETS_EN_MEME_TEMPS, paquets.length) }, ouvrier));

  return clients.map((c: any) => {
    const dernierMouvement = mouvement.get(c.id) || null;
    return candidat(c, reglages, maintenant, {
      rechs: recherches.get(c.id) || [], dernierMouvement, dernierEnvoi: envoi.get(c.id) || null,
      ancien: !dernierMouvement && String(c.created_at || '') < fenetre, historique: [],
    });
  });
}

const PAGE = 1000;
const PAQUET_IDS = 100;
const PAQUETS_EN_MEME_TEMPS = 4;
/** Le suivi lu par le calcul en paquets : un jour de plus que le délai le plus long. */
export const FENETRE_JOURS = Math.max(...DELAIS) + 1;

/* ══ Le mail ════════════════════════════════════════════════════════════ */

/* Les couleurs de Werner (src/lib/mail-charte.ts) : BLEU est l'anthracite,
   DORE l'orange (les noms d'origine sont restés). */
const BLEU = '#2e3034';
const DORE = '#f08c42';
const ENCRE = '#232528';
const DORE_TEXTE = '#c2621c';
const DORE_CLAIR = '#f7b07a';

const echappe = (t: unknown) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const euros = (n: number) => n.toLocaleString('fr-FR').replace(/ /g, ' ') + ' €';

const ETATS: Record<string, string> = {
  a_renover: 'à rénover', travaux_legers: 'travaux légers', bon_etat: 'bon état', refait_neuf: 'refait à neuf',
};
/* Werner : les exigences d'un demandeur ont les clés des équipements d'une
   affaire (src/lib/affaires.ts, EQUIPEMENTS), plus « rdc ». Les anciennes clés
   du logement (cave, balcon, jardin, gardien…) ne s'écrivent plus. */
const exigence = (k: string) => (k === 'rdc' ? 'Rez-de-chaussée' : nomEquipement(k));

/* Ce que le demandeur cherche (recherches.criteres_pro), en mots simples. */
const PROJETS: Record<string, string> = {
  location: 'louer un local', cession_bail: 'reprendre un bail', fonds: 'racheter un fonds de commerce',
  murs: 'acheter des murs', murs_occupes: 'investir dans des murs loués',
};
/* Ce que le prix maximum paie, selon le projet. */
const PRIX_DE: Record<string, string> = {
  cession_bail: 'droit au bail', fonds: 'fonds de commerce', murs: 'achat des murs', murs_occupes: 'achat des murs',
};
type CriteresPro = { natures: string[]; activite: string; loyerMin: number; loyerMax: number; vitrineMin: number; postesMin: number; emplacements: string[] };
function criteresPro(x: unknown): CriteresPro {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const n = (v: unknown) => { const y = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(y) && y > 0 ? y : 0; };
  const l = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && !!s) : []);
  return {
    natures: l(o.natures), activite: typeof o.activite === 'string' ? o.activite.trim() : '',
    loyerMin: n(o.loyerMin), loyerMax: n(o.loyerMax), vitrineMin: n(o.vitrineMin), postesMin: n(o.postesMin), emplacements: l(o.emplacements),
  };
}

const joindre = (l: string[], dernier = ' ou ') =>
  l.length <= 1 ? (l[0] || '') : `${l.slice(0, -1).join(', ')}${dernier}${l[l.length - 1]}`;
/* « Restaurant ou local commercial » : la majuscule au premier seulement. */
const enPhrase = (l: string[]) => l.map((t, i) => (i ? t.charAt(0).toLowerCase() + t.slice(1) : t));

export type Ligne = { cle: string; valeur: string; sous?: string };
export type Resume = { lignes: Ligne[]; points: { texte: string; fort: boolean }[]; depuis: string | null };

/** La recherche, en quatre lignes et quelques pastilles : de quoi s'y retrouver, pas tout le dossier. */
export function resumeRecherche(r: any): Resume {
  const lignes: Ligne[] = [];
  const pro = criteresPro(r?.criteres_pro);

  // Son projet : louer, reprendre un bail, racheter un fonds… et son activité
  const projets = pro.natures.map((k) => PROJETS[k]).filter(Boolean);
  if (projets.length) {
    const p = joindre(projets);
    lignes.push({ cle: 'Votre projet', valeur: p.charAt(0).toUpperCase() + p.slice(1), sous: pro.activite || undefined });
  }

  // Le local
  const types = String(r?.type_bien || '').split(',').map((x) => x.trim()).filter(Boolean);
  const tete: string[] = [];
  if (types.length) tete.push(joindre(enPhrase(types)));
  if (r?.nb_pieces_min && r?.nb_pieces_max && r.nb_pieces_min !== r.nb_pieces_max) tete.push(`${r.nb_pieces_min} à ${r.nb_pieces_max} espaces`);
  else if (r?.nb_pieces_min) tete.push(`${r.nb_pieces_min} espace${r.nb_pieces_min > 1 ? 's' : ''}`);
  let bien = tete.join(' · ');
  if (r?.chambres_min) bien += `${bien ? ' dont ' : ''}${r.chambres_min} bureau${r.chambres_min > 1 ? 'x fermés' : ' fermé'}${bien ? '' : ' minimum'}`;
  if (pro.postesMin) bien += `${bien ? ' · ' : ''}${pro.postesMin} postes de travail${bien ? '' : ' minimum'}`;
  const sousBien: string[] = [];
  if (r?.surface_min && r?.surface_max) sousBien.push(`${r.surface_min} à ${r.surface_max} m²`);
  else if (r?.surface_min) sousBien.push(`${r.surface_min} m² minimum`);
  else if (r?.surface_max) sousBien.push(`jusqu'à ${r.surface_max} m²`);
  const etats = String(r?.etat_souhaite || '').split(',').map((x) => ETATS[x.trim()]).filter(Boolean);
  if (etats.length) sousBien.push(`état : ${joindre(etats)}`);
  if (bien || sousBien.length) lignes.push({ cle: 'Le local', valeur: bien || sousBien.shift() || '', sous: sousBien.join(' · ') || undefined });

  // Où
  const secteurs: string[] = Array.isArray(r?.secteurs) ? r.secteurs : [];
  if (secteurs.length) {
    const villes: string[] = []; const quartiers: string[] = [];
    secteurs.forEach((s) => {
      const m = String(s).match(/^(.+?)\s*\((.+?)\)$/);
      const ville = m ? m[2].trim() : String(s).trim();
      if (!villes.includes(ville)) villes.push(ville);
      if (m) quartiers.push(m[1].trim());
    });
    lignes.push({ cle: 'Où', valeur: villes.join(' · '), sous: quartiers.length ? quartiers.join(' · ') : undefined });
  }

  /* Les montants (Werner) : le loyer annuel HT HC d'une location ou d'un bail
     repris, et le prix d'une cession ou d'un achat, chacun avec son nom.
     Comme la fenêtre des critères (CriteresRecherche) : un projet de seule
     location n'a pas de prix, un achat de murs pas de loyer. Sans projet
     indiqué, le budget reste « Budget ». */
  const avecLoyer = !pro.natures.length || pro.natures.some((k) => ['location', 'cession_bail', 'fonds'].includes(k));
  const avecPrix = !pro.natures.length || pro.natures.some((k) => k !== 'location');
  const fourchette = (min: number, max: number, unite = '') =>
    min && max ? `De ${euros(min)} à ${euros(max)}${unite}` : max ? `Jusqu'à ${euros(max)}${unite}` : `À partir de ${euros(min)}${unite}`;
  if (avecLoyer && (pro.loyerMin || pro.loyerMax)) lignes.push({ cle: 'Loyer', valeur: fourchette(pro.loyerMin, pro.loyerMax, '\u00a0HT\u00a0HC\u00a0/\u00a0an') });
  const bMin = Number(r?.budget_min) || 0, bMax = Number(r?.budget_max) || 0;
  if (avecPrix && (bMin || bMax)) {
    const pour = [...new Set(pro.natures.map((k) => PRIX_DE[k]).filter(Boolean))];
    lignes.push({ cle: pour.length ? 'Prix' : 'Budget', valeur: fourchette(bMin, bMax), sous: pour.length ? joindre(pour) : undefined });
  }

  // Ce qui compte
  const points: { texte: string; fort: boolean }[] = [];
  const ex: Record<string, string> = (r?.exigences && typeof r.exigences === 'object') ? r.exigences : {};
  Object.entries(ex).filter(([, n]) => n === 'indispensable').forEach(([k]) => {
    if (exigence(k)) points.push({ texte: `${exigence(k)} indispensable`, fort: true });
  });
  if (pro.vitrineMin) points.push({ texte: `Vitrine de ${String(pro.vitrineMin).replace('.', ',')} m au moins`, fort: false });
  const empl = pro.emplacements.map((k) => EMPLACEMENTS.find((e) => e.v === k)?.l || '').filter(Boolean);
  /* « n° 1 bis » ne se coupe pas. */
  if (empl.length) points.push({ texte: `Emplacement : ${joindre(empl.map((e) => (e.charAt(0).toLowerCase() + e.slice(1)).replace(/^(n°) (\d+)( bis)?/, (_, n, c, b) => `${n}\u00a0${c}${b ? `\u00a0bis` : ''}`)))}`, fort: false });
  Object.entries(ex).filter(([, n]) => n === 'souhaite').forEach(([k]) => {
    /* « Vitrine de 5 m au moins » dit déjà la vitrine. */
    if (exigence(k) && !(k === 'vitrineEq' && pro.vitrineMin)) points.push({ texte: exigence(k), fort: false });
  });
  if (r?.annee_construction_min) points.push({ texte: `Immeuble après ${r.annee_construction_min}`, fort: false });
  if (r?.rdc_exclu) points.push({ texte: 'Pas de rez-de-chaussée', fort: false });
  if (r?.dernier_etage) points.push({ texte: 'Dernier étage', fort: false });
  if (r?.dpe_max) points.push({ texte: `DPE jusqu'à ${r.dpe_max}`, fort: false });

  const depuis = r?.created_at
    ? new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
    : null;
  return { lignes, points: points.slice(0, 7), depuis };
}

export type Reponse = 'toujours' | 'criteres' | 'trouve' | 'pause' | 'rappel';
export const REPONSES: readonly Reponse[] = ['toujours', 'criteres', 'trouve', 'pause', 'rappel'];

/* Les liens n'agissent pas au simple clic : ils ouvrent l'espace sur la bonne
   question, et c'est le client qui répond. Les messageries et les antivirus
   ouvrent les liens des mails pour les vérifier — un lien qui enregistrerait
   « je cherche toujours » en arrivant répondrait à la place du client. */
export function lienReponse(tokenClient: string, rechercheId: string, reponse: Reponse, site: string): string {
  return `${lienEspace(tokenClient, site)}?r=${encodeURIComponent(rechercheId)}&point=${reponse}`;
}

/* Sans espace : la page de réponse de cet envoi (même principe : elle pose
   la question, c'est le client qui répond). `jeton` : celui de l'envoi. */
export function lienPage(jeton: string, reponse: Reponse, base: string): string {
  return `${base.replace(/\/+$/, '')}/point/${encodeURIComponent(jeton)}?r=${reponse}`;
}

/** Le jeton d'un envoi sans espace : 24 caractères tirés au hasard, impossibles à deviner. */
export function nouveauJeton(): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const o = new Uint8Array(24);
  crypto.getRandomValues(o);
  return Array.from(o, (b) => A[b & 63]).join('');
}

/** La page de démonstration : celle des exemples envoyés à Werner. Rien ne s'y enregistre. */
export const JETON_EXEMPLE = 'exemple';
/** Un jeton d'envoi bien formé (ou « exemple », la page de démonstration). */
export const jetonValide = (j: string) => j === JETON_EXEMPLE || /^[A-Za-z0-9_-]{24}$/.test(j);

/* Les liens : `tokenClient` pour un client qui répond depuis son espace,
   `lienDe` pour les autres (la page de réponse de son envoi, lienPage). */
export function mailPoint(o: { prenom: string; recherche: any; tokenClient?: string | null; lienDe?: (x: Reponse) => string; site: string; co?: Coordonnees }): { sujet: string; html: string; texte: string } {
  const { recherche, site } = o;
  /* Le téléphone de l'agence : Paramètres › Agence (la route le passe). */
  const co = o.co || coordonneesDe(null);
  const prenom = echappe(o.prenom || '');
  const res = resumeRecherche(recherche);
  const viaEspace = !o.lienDe;
  const lien = (x: Reponse) => (o.lienDe ? o.lienDe(x) : lienReponse(o.tokenClient || '', recherche.id, x, site));

  const lignesHtml = res.lignes.map((l) => `
            <tr><td style="padding:11px 16px;border-top:1px solid #f6f5f5;vertical-align:top;width:104px;font-size:12px;font-weight:700;color:#aba7a3;">${echappe(l.cle)}</td>
                <td style="padding:11px 16px 11px 0;border-top:1px solid #f6f5f5;vertical-align:top;font-size:14.5px;font-weight:700;color:${BLEU};line-height:1.45;">${echappe(l.valeur)}${l.sous ? `<div style="font-size:12.5px;font-weight:500;color:#5B6B80;margin-top:3px;">${echappe(l.sous)}</div>` : ''}</td></tr>`).join('');
  const pointsHtml = res.points.length ? `
            <tr><td style="padding:11px 16px;border-top:1px solid #f6f5f5;vertical-align:top;width:104px;font-size:12px;font-weight:700;color:#aba7a3;">Ce qui compte</td>
                <td style="padding:9px 16px 7px 0;border-top:1px solid #f6f5f5;vertical-align:top;">${res.points.map((p) => `<span style="display:inline-block;margin:0 5px 5px 0;padding:3px 10px;border-radius:99px;font-size:12.5px;font-weight:700;${p.fort ? `background:#FFF6EC;border:1px solid #f7b07a;color:#c2621c;` : `background:#ffffff;border:1px solid #eeeeed;color:#232528;`}">${echappe(p.texte)}</span>`).join('')}</td></tr>` : '';

  const bouton = (x: Reponse, texte: string, style: string) => `
          <tr><td style="padding:0 0 9px;"><a href="${echappe(lien(x))}" style="display:block;text-align:center;text-decoration:none;border-radius:12px;padding:14px 12px;font-size:15px;font-weight:700;${style}">${texte}</a></td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Où en est votre recherche ?</title>
${LIEN_POLICE_MAIL}
<style>
  @media only screen and (max-width:600px) {
    .sheet { width:100% !important; }
    .cadre { padding:0 !important; }
    .carte { border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .bord  { padding-left:18px !important; padding-right:18px !important; }
    .pied-nom, .pied-tel { display:block !important; width:100% !important; text-align:left !important; }
    .pied-tel { padding-top:12px !important; font-size:17px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#efeeed;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#efeeed;">
    <tr><td align="center" class="cadre" style="padding:26px 12px;">
      <table role="presentation" width="600" class="sheet carte" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e4e3;border-radius:18px;overflow:hidden;">

        <tr><td class="bord" style="background:${BLEU};border-bottom:3px solid ${DORE};padding:14px 28px;">
          <table role="presentation" width="100%"><tr>
            <td><img src="${LOGO_BLANC_MAIL}" alt="Werner Immobilier" height="${LOGO_MAIL.grand}" style="height:${LOGO_MAIL.grand}px;width:auto;display:block;border:0;color:#ffffff;font-weight:800;font-size:16px;" /></td>
            <td align="right" style="font-size:10px;color:${DORE_CLAIR};letter-spacing:2.5px;font-weight:600;">VOTRE RECHERCHE</td>
          </tr></table>
        </td></tr>

        <tr><td class="bord" style="padding:26px 28px 6px;font-size:14.5px;color:#363533;line-height:1.7;">
          <p style="margin:0 0 14px;">Bonjour ${prenom},</p>
          <p style="margin:0 0 18px;">Cela fait quelques semaines que nous n'avons pas fait le point ensemble. Voici la recherche que nous menons pour vous aujourd'hui&nbsp;:</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #eeeeed;border-radius:14px;border-collapse:separate;overflow:hidden;">
            <tr><td colspan="2" style="background:#f6f6f7;padding:11px 16px;">
              <table role="presentation" width="100%"><tr>
                <td style="font-size:11px;font-weight:800;letter-spacing:1px;color:#2e3034;">VOTRE RECHERCHE AUJOURD'HUI</td>
                ${res.depuis ? `<td align="right" style="font-size:11.5px;color:#aba7a3;font-weight:600;">depuis le ${echappe(res.depuis)}</td>` : ''}
              </tr></table>
            </td></tr>${lignesHtml}${pointsHtml}
          </table>

          <p style="margin:20px 0 12px;">Est-ce toujours d'actualité&nbsp;? Un clic suffit pour me le dire&nbsp;:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${
            bouton('toujours', 'Je cherche toujours', `background:${BLEU};color:#ffffff;border:1.5px solid ${BLEU};`)
          }${
            bouton('criteres', 'Mes critères ont changé', `background:#ffffff;color:${BLEU};border:1.5px solid ${BLEU};`)
          }${
            bouton('trouve', 'J’ai trouvé mon local', `background:${DORE};color:${ENCRE};border:1.5px solid ${DORE};`)
          }${
            bouton('pause', 'J’ai mis ma recherche en pause ou arrêtée', `background:#ffffff;color:#5B6B80;border:1.5px solid #e5e4e3;`)
          }
          </table>
          <p style="margin:14px 0 9px;font-size:13.5px;color:#5B6B80;">Vous préférez en parler de vive voix&nbsp;?</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${
            bouton('rappel', 'Je souhaite être rappelé', `background:#f6f6f7;color:${BLEU};border:1.5px solid #f6f6f7;`)
          }
          </table>
          <p style="margin:10px 0 22px;">Bonne journée,<br />Werner</p>
        </td></tr>

        <tr><td class="bord" style="background:${BLEU};padding:20px 28px;">
          <table role="presentation" width="100%"><tr>
            <td class="pied-nom">
              <div style="font-size:14px;font-weight:700;color:#ffffff;">Werner</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:3px;">Immobilier d’entreprise · Paris et l’Ouest parisien</div>
            </td>
            <td align="right" class="pied-tel" style="color:${DORE_CLAIR};font-size:15px;font-weight:700;white-space:nowrap;">${echappe(co.tel)}</td>
          </tr></table>
        </td></tr>
      </table>

      <table role="presentation" width="600" class="sheet" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td class="bord" align="center" style="padding:16px 28px 6px;">
          <div style="font-size:11.5px;color:#aba7a3;line-height:1.7;">
            Vous recevez ce message parce que votre recherche est en cours avec ${echappe(co.agence)}.<br />${viaEspace ? 'Chaque bouton ouvre votre espace personnel, au bon endroit.' : 'Chaque bouton ouvre une courte page pour nous répondre&nbsp;: rien à installer, aucun compte à créer.'}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const texte = [
    `Bonjour ${o.prenom || ''},`,
    '',
    'Cela fait quelques semaines que nous n’avons pas fait le point ensemble. Voici la recherche que nous menons pour vous aujourd’hui :',
    '',
    ...res.lignes.map((l) => `${l.cle} : ${l.valeur}${l.sous ? ` (${l.sous})` : ''}`),
    ...(res.points.length ? [`Ce qui compte : ${res.points.map((p) => p.texte).join(', ')}`] : []),
    '',
    'Est-ce toujours d’actualité ? Un clic suffit pour me le dire :',
    `Je cherche toujours : ${lien('toujours')}`,
    `Mes critères ont changé : ${lien('criteres')}`,
    `J’ai trouvé mon local : ${lien('trouve')}`,
    `J’ai mis ma recherche en pause ou arrêtée : ${lien('pause')}`,
    `Je souhaite être rappelé : ${lien('rappel')}`,
    '',
    'Bonne journée,',
    `Werner · ${co.agence} · ${co.tel}`,
  ].join('\n');

  return { sujet: 'Où en est votre recherche ?', html, texte };
}

/* ══ La page de réponse sans espace : retrouver l'envoi d'un jeton ══ */

export type EnvoiPage = { id: string; clientId: string; rechercheId: string | null; le: string; expire: boolean };

/**
 * L'envoi auquel répond un lien /point/<jeton> : la ligne « point_auto » du
 * suivi qui porte ce jeton. Null : aucun envoi n'a ce jeton. Une lecture
 * ratée lève une erreur (la page dit « réessayez », pas « lien inconnu »).
 */
export async function envoiDuJeton(sb: Base, jeton: string): Promise<EnvoiPage | null> {
  const { data, error } = await sb.from('journal').select('id, client_id, recherche_id, created_at')
    .eq('type', TYPE_ENVOI).eq('metadata->>jeton', jeton).limit(1);
  if (error) throw new Error('Lecture du lien impossible : ' + error.message);
  const l = data?.[0];
  if (!l) return null;
  return {
    id: l.id, clientId: l.client_id, rechercheId: l.recherche_id || null, le: l.created_at,
    expire: Date.now() - new Date(l.created_at).getTime() > JOURS_REPONSE * 86_400_000,
  };
}

/** Ce que veut dire chaque créneau de rappel (les mêmes que dans l'espace). */
export const CRENEAUX_RAPPEL: Record<string, string> = {
  matin: 'le matin (8h – 12h)',
  apres_midi: 'l’après-midi (12h – 18h)',
  soir: 'en fin de journée (18h – 20h)',
};

/* ══ L'envoi par Mailjet ══ */

export async function envoyerMailjet(o: { a: string; nom?: string; sujet: string; html: string; texte: string; id: string; deNom?: string; repondre?: string }): Promise<{ ok: boolean; erreur?: string }> {
  const cle = process.env.MAILJET_API_KEY, secret = process.env.MAILJET_API_SECRET;
  if (!cle || !secret) return { ok: false, erreur: 'clés Mailjet absentes' };
  const de = process.env.MAILJET_FROM_EMAIL || 'contact@wernerimmobilier.com';
  const deNom = o.deNom || process.env.MAILJET_FROM_NAME || 'Werner Immobilier';
  const auth = Buffer.from(`${cle}:${secret}`).toString('base64');
  try {
    const r = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        Messages: [{
          From: { Email: de, Name: deNom },
          To: [{ Email: o.a, Name: o.nom || undefined }],
          ...(o.repondre && o.repondre.toLowerCase() !== de.toLowerCase() ? { ReplyTo: { Email: o.repondre } } : {}),
          Subject: o.sujet, TextPart: o.texte, HTMLPart: o.html,
          CustomID: o.id,
          TrackOpens: 'disabled', TrackClicks: 'disabled',
        }],
      }),
    });
    const j = await r.json().catch(() => null);
    const statut = j?.Messages?.[0]?.Status;
    if (!r.ok || statut !== 'success') return { ok: false, erreur: `Mailjet a répondu ${r.status}${statut ? ` (${statut})` : ''}` };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, erreur: e instanceof Error ? e.message : 'erreur réseau' };
  }
}
