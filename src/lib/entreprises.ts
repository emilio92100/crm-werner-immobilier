/* ══ Trouver une société dans le registre public ══════════════════════════

   « J'achète via une société » : le client tape le nom de sa SCI ou son
   SIREN, et choisit dans la liste. On remplit pour lui la dénomination, la
   forme, le SIREN, le siège, le greffe quand on le connaît, et sa fonction
   s'il figure parmi les dirigeants. Tout reste modifiable, et il certifie.

   La source : l'API Recherche d'entreprises de l'État
   (recherche-entreprises.api.gouv.fr) — gratuite, sans clé, ouverte aux
   navigateurs (CORS). Elle réunit l'INSEE (Sirene) et le Registre national
   des entreprises. Appelée depuis le navigateur du client, comme l'adresse
   (api-adresse.data.gouv.fr) à la création d'un client.

   Elle ne donne pas le greffe du RCS : on le déduit du département du
   siège quand il n'y en a qu'un (Île-de-France, hors Seine-et-Marne), sinon
   le client l'écrit.
   ════════════════════════════════════════════════════════════════════════ */

export type SocieteTrouvee = {
  siren: string;
  denomination: string;
  forme: string;              // SCI, SARL, SAS… ou « Autre »
  siege: string;              // « 34 rue Louis Pasteur, 92100 Boulogne-Billancourt »
  commune: string;
  rcsVille: string;           // '' quand on ne sait pas
  dirigeants: { nom: string; prenoms: string; qualite: string }[];
};

const API = 'https://recherche-entreprises.api.gouv.fr/search';

/* La forme, depuis le code de catégorie juridique de l'INSEE. */
export function formeDe(code: string): string {
  const c = String(code || '');
  /* Werner (23 octobre 2026) : les sociétés d'un local d'entreprise sont plus
     variées qu'un mandat de recherche ; on nomme aussi la SA, l'association,
     l'entrepreneur individuel. */
  if (c === '1000') return 'Entreprise individuelle';
  if (c.startsWith('55') || c.startsWith('56')) return 'SA';
  if (c.startsWith('92')) return 'Association';
  if (c.startsWith('654')) return 'SCI';
  if (c === '5498') return 'EURL';
  if (c.startsWith('54')) return 'SARL';
  if (c === '5710') return 'SAS';
  if (c === '5720') return 'SASU';
  if (c.startsWith('520')) return 'SNC';
  return 'Autre';
}

/* Le greffe, quand le département n'en a qu'un. */
const GREFFES: Record<string, string> = {
  '75': 'Paris', '92': 'Nanterre', '93': 'Bobigny', '94': 'Créteil', '95': 'Pontoise', '78': 'Versailles', '91': 'Évry',
};

/* « 34 RUE LOUIS PASTEUR » → « 34 rue Louis Pasteur » ; « BOULOGNE-BILLANCOURT » → « Boulogne-Billancourt ». */
const PETITS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'sur', 'sous', 'en', 'aux', 'au']);
/* `petits` : à partir de quel mot « de », « des », « la »… restent en
   minuscules (0 pour un nom de voie, 1 pour une commune, jamais pour le
   nom d'une société : « SCI Les Tilleuls »). */
function joli(t: string, petits = 1): string {
  return String(t || '').toLowerCase().split(/(\s+|-|')/).map((m, i) => {
    if (!m.trim() || m === '-' || m === "'" || (petits >= 0 && i >= petits && PETITS.has(m))) return m;
    return m.charAt(0).toUpperCase() + m.slice(1);
  }).join('');
}
const VOIES: Record<string, string> = {
  AV: 'avenue', AVENUE: 'avenue', BD: 'boulevard', BOULEVARD: 'boulevard', RUE: 'rue', PL: 'place', PLACE: 'place',
  ALL: 'allée', ALLEE: 'allée', CHE: 'chemin', CHEMIN: 'chemin', IMP: 'impasse', IMPASSE: 'impasse', QU: 'quai', QUAI: 'quai',
  RTE: 'route', ROUTE: 'route', SQ: 'square', SQUARE: 'square', CRS: 'cours', COURS: 'cours', PAS: 'passage', PASSAGE: 'passage',
  VLA: 'villa', VILLA: 'villa', CITE: 'cité', CI: 'cité', RPT: 'rond-point', SEN: 'sentier', RES: 'résidence',
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adresseDe(s: any): string {
  if (!s) return '';
  const voie = [s.numero_voie, s.indice_repetition, s.type_voie ? VOIES[String(s.type_voie).toUpperCase()] || String(s.type_voie).toLowerCase() : '', joli(s.libelle_voie || '', 0)]
    .filter(Boolean).join(' ').trim();
  const ville = [s.code_postal, joli(s.libelle_commune || '')].filter(Boolean).join(' ');
  if (!voie) return joli(s.adresse || '');
  return [voie, ville].filter(Boolean).join(', ');
}

export async function chercherSocietes(q: string, signal?: AbortSignal): Promise<SocieteTrouvee[]> {
  const t = q.trim();
  if (t.replace(/\s/g, '').length < 3) return [];
  const u = `${API}?q=${encodeURIComponent(t)}&per_page=6&etat_administratif=A`;
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error(`recherche ${r.status}`);
  const j = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Array.isArray(j?.results) ? j.results : []).map((x: any): SocieteTrouvee => ({
    siren: String(x.siren || ''),
    denomination: joli(x.nom_raison_sociale || x.nom_complet || '', -1).replace(/\b(Sci|Sarl|Sas|Sasu|Eurl|Snc)\b/g, m => m.toUpperCase()),
    forme: formeDe(x.nature_juridique),
    siege: adresseDe(x.siege),
    commune: joli(x.siege?.libelle_commune || ''),
    rcsVille: GREFFES[String(x.siege?.departement || '')] || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dirigeants: (Array.isArray(x.dirigeants) ? x.dirigeants : []).filter((d: any) => d?.type_dirigeant === 'personne physique').map((d: any) => ({
      nom: String(d.nom || ''), prenoms: String(d.prenoms || ''), qualite: String(d.qualite || ''),
    })),
  })).filter((s: SocieteTrouvee) => /^\d{9}$/.test(s.siren));
}

/* Sa fonction dans la société, s'il figure parmi les dirigeants (même nom de
   famille, même prénom quand le registre le donne). */
export function qualiteDe(s: SocieteTrouvee, prenom: string, nom: string): string | null {
  const n = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, ' ').trim();
  const d = s.dirigeants.find(x => n(x.nom).split(/\s+/).includes(n(nom).split(/\s+/)[0] || '§')
    && (!x.prenoms || n(x.prenoms).split(/\s+/).includes(n(prenom).split(/\s+/)[0] || '§')));
  if (!d) return null;
  const q = d.qualite.toLowerCase();
  if (q.startsWith('g')) return 'Gérant';
  if (q.startsWith('pr')) return 'Président';
  if (q.includes('directeur g')) return 'Directeur général';
  return null;
}

/* ── Ce que le CRM range d'une société retrouvée (23 octobre 2026) ──
   Werner, pour un contact, un propriétaire, un demandeur ou un document :
   « il tape le début du nom de la société, ou son numéro, et il clique ». */
export const sirenAere = (t: string) => String(t || '').replace(/\s/g, '').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
const FORMES_LONGUES: Record<string, string> = {
  SAS: 'Société par actions simplifiée', SASU: 'Société par actions simplifiée unipersonnelle', SARL: 'Société à responsabilité limitée',
  EURL: 'Entreprise unipersonnelle à responsabilité limitée', SCI: 'Société civile immobilière', SNC: 'Société en nom collectif', SA: 'Société anonyme',
};
/* « Société par actions simplifiée (SAS) » : la forme écrite dans un acte (le capital, le registre ne le donne pas). */
export const formeLongue = (x: Pick<SocieteTrouvee, 'forme'>) => (FORMES_LONGUES[x.forme] ? `${FORMES_LONGUES[x.forme]} (${x.forme})` : '');
/* « RCS Paris 732 829 320 » (la fiche d'un contact), ou le SIREN seul quand le greffe n'est pas sûr. */
export const rcsCourt = (x: Pick<SocieteTrouvee, 'siren' | 'rcsVille'>) => (x.rcsVille ? `RCS ${x.rcsVille} ${sirenAere(x.siren)}` : `SIREN ${sirenAere(x.siren)}`);
/* « RCS de Paris n° 732 829 320 » (un document juridique). */
export const immatriculation = (x: Pick<SocieteTrouvee, 'siren' | 'rcsVille'>) => (x.rcsVille ? `RCS de ${x.rcsVille} n° ${sirenAere(x.siren)}` : `SIREN n° ${sirenAere(x.siren)}`);
/* « Gérant », « Président »… : la fonction d'un dirigeant, lisible. */
export function fonctionCourte(q: string): string {
  const t = String(q || '').toLowerCase();
  if (t.startsWith('g')) return 'Gérant';
  if (t.startsWith('pr')) return 'Président';
  if (t.includes('directeur g')) return 'Directeur général';
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}
/* « Jean Dupont » : un dirigeant, prénom d'usage d'abord. */
export const nomDirigeant = (d: SocieteTrouvee['dirigeants'][number]) => {
  const joliNom = (x: string) => x.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase());
  return [joliNom((d.prenoms || '').split(/\s+/)[0] || ''), joliNom(d.nom || '')].filter(Boolean).join(' ');
};

