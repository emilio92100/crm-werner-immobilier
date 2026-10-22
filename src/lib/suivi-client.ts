/* ═══ Ce que le client voit de ton suivi avec l'agence (V3.193) ═══════════
   Alexandre : « que le client voie que je travaille dessus : un bien où
   j'attends une réponse, un retour, une messagerie du collègue ». Maquettes
   (canvas « Son suivi visible par le client ») : il a pris A + B — les
   ÉTAPES, déduites de tes appels notés, et un MOT de toi quand tu le
   décides. Jamais ce qui a été dit, ni l'agence, ni son numéro, ni
   l'adresse : l'agence s'appelle « le vendeur », et les notes rapides
   restent à toi.

   Chaque appel noté porte `montrer` (la case « Lui montrer l'étape ») et
   `mot_client` (« Un mot pour … ») — outils/sql/suivis-agence-client.sql.

   Pur : rien n'est lu ni écrit ici. La même phrase sert à l'aperçu dans
   « Noter un appel » (CRM) et à l'espace du client (le serveur). */

export type CreneauC = { date: string; heure: string; fin?: string };
export type AppelVisible = {
  id?: string; genre?: string | null; reponse?: string | null; dispo?: string | null;
  creneaux?: CreneauC[] | null; ensuite?: string | null; rappel_le?: string | null;
  mot_client?: string | null; montrer?: boolean | null; created_at?: string | null;
};
/** `ancien` : un appel d'avant les trois derniers — replié chez le client,
    « Voir les N échanges plus anciens » le déplie (V3.194). */
export type EtapeClient = { t: string; sous?: string; le?: string; etat: 'fait' | 'encours' | 'avenir'; mot?: string; ancien?: boolean };
/** V3.221 — un créneau que le client peut choisir. `heures` : les heures de
    début qu'il peut prendre (une seule pour un créneau précis ; pour une
    plage, de demi-heure en demi-heure, sans celles déjà trop proches). */
export type CreneauChoix = { date: string; heure: string; fin?: string; heures: string[] };
/** `ligne` : l'appel qui les a donnés (suivis_agence.id) — le serveur
    revérifie que c'est toujours le bon au moment où il choisit. */
export type ChoixCreneaux = { ligne: string; creneaux: CreneauChoix[] };
/** `revisite` (V3.222) : le suivi d'une 2e visite (« Vous voulez le revoir » → « La 2e visite est calée »). */
export type SuiviClient = { etapes: EtapeClient[]; calee: boolean; choix?: ChoixCreneaux | null; revisite?: boolean };

/** Les appels visibles d'emblée ; les plus anciens se déplient. */
export const APPELS_VISIBLES = 3;

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** « 2026-10-17 » → « sam. 17 oct. » */
function jour(cle: string): string {
  const [y, m, j] = String(cle || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !j) return '';
  const d = new Date(y, m - 1, j);
  return `${JOURS[d.getDay()]} ${j} ${MOIS[m - 1]}`;
}
const heure = (h?: string | null) => {
  const [a, b] = String(h || '').split(':');
  if (!a) return '';
  return `${Number(a)} h${b && b !== '00' ? ` ${b.slice(0, 2)}` : ''}`;
};
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** La phrase d'un appel, telle que le client la lit. `null` : rien à lui
    montrer (un bien vendu passe par « Plus disponible », pas par ici). */
export function phraseAppel(l: AppelVisible): { t: string; sous: string } | null {
  if (l.dispo === 'vendu') return null;
  const creneaux = (l.creneaux || []).filter(c => c && c.date >= aujourdhui());
  if (l.reponse === 'message') return { t: 'Werner a laissé un message au propriétaire', sous: 'Il attend son retour.' };
  if (l.reponse === 'sans_reponse') return { t: 'Werner a appelé le propriétaire', sous: 'Pas de réponse pour l’instant : il le rappelle.' };
  if (creneaux.length) return { t: 'Le propriétaire a proposé des créneaux', sous: 'Werner organise la visite.' };
  if (l.ensuite === 'rappeler' && l.rappel_le) {
    const j = jour(l.rappel_le);
    return { t: 'Werner a parlé au propriétaire', sous: j ? `Il le rappelle ${j.replace(/\.$/, '')}.` : 'Il le rappelle.' };
  }
  if (l.ensuite === 'attente') return { t: 'Werner a parlé au propriétaire', sous: 'Il attend son retour.' };
  if (l.dispo === 'disponible') return { t: 'Werner a parlé au propriétaire', sous: 'Le local est toujours disponible.' };
  return { t: 'Werner a parlé au propriétaire', sous: '' };
}

/** Les appels que le client voit : montrés et avec une phrase, du plus
    ancien au plus récent. Tous, depuis la V3.194 (les plus anciens repliés
    chez lui). Le CRM s'en sert pour marquer « Visible par … ». */
export function appelsMontres(appels: AppelVisible[]): { a: AppelVisible; p: { t: string; sous: string } }[] {
  return appels
    .filter(a => (a.genre || 'appel') === 'appel' && a.montrer !== false)
    .map(a => ({ a, p: phraseAppel(a) }))
    .filter((x): x is { a: AppelVisible; p: { t: string; sous: string } } => !!x.p)
    .sort((x, y) => String(x.a.created_at || '').localeCompare(String(y.a.created_at || '')));
}

/* ═══ V3.221 : le client choisit lui-même son créneau ═════════════════════
   Alexandre : « un créneau proposé par l'agence : est-ce qu'il peut le
   valider dans son espace ? Et s'il le valide, ça crée directement la visite
   dans mon agenda ». Les créneaux à choisir sont ceux que le CRM montre en
   « Valider ce créneau » (creneauxOuverts, src/lib/suivi-agence.ts) : le
   dernier appel qui en a donné, s'il est montré au client. Une seule
   fonction pour l'espace (ce qu'il voit) et pour le serveur (ce qu'il
   accepte) : les deux ne peuvent pas se contredire. */

/** « 9:30 », « 09:30:00 » → « 09:30 » ; '' si ce n'est pas une heure. */
const hNette = (h: unknown) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || ''));
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};
const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hDe = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** Le pas d'une plage (« entre 14 h et 17 h » → 14 h, 14 h 30… 16 h 30). */
export const PAS_PLAGE = 30;
/** Pas de rendez-vous à moins d'une heure : Alexandre doit pouvoir prévenir l'agence. */
export const DELAI_MIN = 60;
/** « 2026-10-21 15:40 » + n minutes, sans passer par un fuseau. */
function plus(maintenant: string, n: number): string {
  const [d, h] = maintenant.split(' ');
  const [y, mo, j] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, j, Number(h.slice(0, 2)), Number(h.slice(3, 5)) + n));
  const z = (x: number) => String(x).padStart(2, '0');
  return `${t.getUTCFullYear()}-${z(t.getUTCMonth() + 1)}-${z(t.getUTCDate())} ${z(t.getUTCHours())}:${z(t.getUTCMinutes())}`;
}

/** Les créneaux qu'il peut encore choisir. `maintenant` : l'heure de Paris
    (« 2026-10-21 15:40 », maintenantParis dans src/lib/visites.ts). `null` :
    rien à choisir (pas de créneau, appel pas montré, bien vendu). */
export function creneauxAChoisir(appels: AppelVisible[], maintenant: string): ChoixCreneaux | null {
  const tri = appels.filter(a => (a.genre || 'appel') === 'appel')
    .slice().sort((x, y) => String(y.created_at || '').localeCompare(String(x.created_at || '')));
  /* Le dernier appel dit le bien vendu : plus rien à caler. */
  if (!tri.length || tri[0].dispo === 'vendu') return null;
  const l = tri.find(a => Array.isArray(a.creneaux) && a.creneaux.length > 0);
  if (!l || !l.id || l.montrer === false || l.dispo === 'vendu') return null;
  const limite = plus(maintenant, DELAI_MIN);
  const creneaux: CreneauChoix[] = [];
  for (const c of l.creneaux || []) {
    const date = String(c?.date || '');
    const h = hNette(c?.heure);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !h) continue;
    const f = hNette(c?.fin);
    const fin = f && minutes(f) > minutes(h) ? f : '';
    const debuts: string[] = [];
    if (fin) for (let m = minutes(h); m + PAS_PLAGE <= minutes(fin); m += PAS_PLAGE) debuts.push(hDe(m));
    if (!debuts.length) debuts.push(h);
    const heures = debuts.filter(x => `${date} ${x}` > limite);
    if (heures.length) creneaux.push({ date, heure: h, ...(fin ? { fin } : {}), heures });
  }
  creneaux.sort((a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`));
  return creneaux.length ? { ligne: l.id, creneaux } : null;
}

/** Les étapes d'un bien, pour son espace. `null` : rien à montrer (aucun
    appel montré). `maintenant` (V3.221) : l'heure de Paris, pour les
    créneaux qu'il peut encore choisir ; sans elle, il n'en a aucun.
    `revisite` (V3.222) : une 2e visite — `appels` ne porte alors que ceux
    d'après la première (page.tsx). */
export function suiviPourClient(appels: AppelVisible[], o: {
  avis?: string | null; retourLe?: string | null; visite?: { date: string; heure?: string | null } | null;
  maintenant?: string; revisite?: boolean;
  /** V3.232 : l'imprévu qu'il a signalé sur la visite calée (décaler ou annuler, et quand). */
  imprevu?: { quoi: 'decaler' | 'annuler'; le: string } | null;
}): SuiviClient | null {
  const tous = appelsMontres(appels);
  /* Sans appel montré, rien : une visite calée a déjà son bloc sur la fiche. */
  if (!tous.length) return null;
  /* V3.232 (repris du CRM d'Emilio) : après un imprévu, les appels d'après lui viennent après la
     visite calée ; s'il veut la décaler, leurs créneaux se choisissent à
     nouveau (la route /api/espace/creneau déplace alors la visite). */
  const imp = o.visite && o.imprevu ? o.imprevu : null;
  const vus = imp ? tous.filter(x => String(x.a.created_at || '') <= imp.le) : tous;
  const apres = imp ? tous.filter(x => String(x.a.created_at || '') > imp.le) : [];
  const choix = !o.visite && o.maintenant ? creneauxAChoisir(appels, o.maintenant)
    : imp && imp.quoi === 'decaler' && o.maintenant ? creneauxAChoisir(appels.filter(a => String(a.created_at || '') > imp.le), o.maintenant) : null;
  const etapes: EtapeClient[] = [];
  if (o.revisite) { if (o.avis === 'revoir') etapes.push({ t: 'Vous voulez le revoir', le: o.retourLe || undefined, etat: 'fait' }); }
  else if (o.avis === 'souhaite_visiter') etapes.push({ t: 'Vous voulez le visiter', le: o.retourLe || undefined, etat: 'fait' });
  else if (o.avis === 'interesse') etapes.push({ t: 'Ce local vous plaît', le: o.retourLe || undefined, etat: 'fait' });
  vus.forEach(({ a, p }, i) => {
    const dernier = i === vus.length - 1 && !o.visite;
    const mot = String(a.mot_client || '').trim();
    const ancien = i < vus.length - APPELS_VISIBLES;
    /* Des créneaux à choisir : c'est à lui, plus à Alexandre (V3.221). */
    const sous = dernier && choix && a.id === choix.ligne
      ? (choix.creneaux.length > 1 ? 'Choisissez celui qui vous convient.' : 'Dites-nous s’il vous convient.')
      : dernier ? p.sous || undefined : undefined;
    etapes.push({ t: p.t, sous, le: a.created_at || undefined, etat: dernier ? 'encours' : 'fait', ...(mot ? { mot } : {}), ...(ancien ? { ancien } : {}) });
  });
  const rv = !!o.revisite;
  if (o.visite) {
    etapes.push(etapeCalee(o.visite, rv));
    if (imp) {
      etapes.push({ t: imp.quoi === 'decaler' ? 'Vous avez demandé à la décaler' : 'Vous avez demandé à l’annuler', le: imp.le,
        etat: apres.length ? 'fait' : 'encours', sous: apres.length ? undefined : 'Werner prévient le propriétaire.' });
      apres.forEach(({ a, p }, i) => {
        const dernier = i === apres.length - 1;
        const mot = String(a.mot_client || '').trim();
        const sous = dernier && choix && a.id === choix.ligne
          ? (choix.creneaux.length > 1 ? 'Choisissez celui qui vous convient.' : 'Dites-nous s’il vous convient.')
          : dernier ? p.sous || undefined : undefined;
        etapes.push({ t: p.t, sous, le: a.created_at || undefined, etat: dernier ? 'encours' : 'fait', ...(mot ? { mot } : {}) });
      });
    }
  } else {
    etapes.push({ t: rv ? 'La 2e visite est calée' : 'La visite est calée', sous: 'Elle s’ajoutera ici et dans « Vos visites ».', etat: 'avenir' });
  }
  return { etapes, calee: !!o.visite && !choix, ...(choix ? { choix } : {}), ...(rv ? { revisite: true } : {}) };
}
function etapeCalee(v: { date: string; heure?: string | null }, revisite = false): EtapeClient {
  const quand = [jour(v.date), v.heure ? `à ${heure(v.heure)}` : ''].filter(Boolean).join(' ');
  return { t: revisite ? 'La 2e visite est calée' : 'La visite est calée', sous: quand ? `${quand.charAt(0).toUpperCase()}${quand.slice(1)}.` : undefined, etat: 'fait' };
}
/** V3.221 — le même suivi, une fois qu'il a choisi son créneau : l'étape en
    cours est faite, la visite est calée, plus rien à choisir. L'espace
    l'affiche tout de suite, sans attendre un rechargement. */
export function suiviCale(s: SuiviClient, v: { date: string; heure?: string | null }): SuiviClient {
  const etapes = s.etapes.filter(e => e.etat !== 'avenir')
    .map(e => (e.etat === 'encours' ? { ...e, etat: 'fait' as const, sous: undefined } : e));
  etapes.push(etapeCalee(v, !!s.revisite));
  return { etapes, calee: true, choix: null, ...(s.revisite ? { revisite: true } : {}) };
}
