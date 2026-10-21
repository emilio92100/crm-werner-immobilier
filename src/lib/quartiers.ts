/* ═══ Les quartiers de référence (V3.227) ═════════════════════════════════
   Alexandre (21 octobre 2026) : « vois tous les quartiers de Paris, récupère
   les références : quand on complète un bien, que le quartier soit
   présélectionné, et pareil dans la recherche d'un client ; il peut toujours
   l'ajouter lui-même. Il faut que tout soit pris en compte. »

   Paris : les 80 quartiers administratifs (4 par arrondissement, la
   référence de la Ville de Paris), et sous chacun les noms que les agents
   emploient vraiment quand on est sûr qu'ils sont dedans (Trocadéro dans
   Chaillot, Passy dans la Muette). Les noms qui chevauchent plusieurs
   quartiers (Marais, Victor Hugo, Sentier…) vont dans « autres » : ils se
   choisissent, mais ne sont rattachés à aucun.

   Les noms déjà en usage dans le CRM gardent leur écriture (« Plaine de
   Monceau », « Porte Dauphine ») : des recherches les portent déjà.

   Le rapprochement s'en sert (quartierCouvre) : un client qui a choisi
   Chaillot correspond à un bien noté Trocadéro. L'inverse reste « en
   partie » : un bien noté Chaillot n'est pas forcément au Trocadéro.

   Ce fichier n'importe rien : correspondance.ts et secteurs.ts le lisent. */

export type QuartierRef = { nom: string; lieux?: string[] };
export type CommuneRef = { ville: string; quartiers: QuartierRef[]; autres?: string[] };

export const QUARTIERS_REF: Record<string, CommuneRef> = {
  '75001': { ville: 'Paris 1er', quartiers: [
    { nom: 'Saint-Germain-l’Auxerrois', lieux: ['Louvre'] }, { nom: 'Les Halles' }, { nom: 'Palais Royal' }, { nom: 'Place Vendôme' },
  ], autres: ['Châtelet', 'Montorgueil', 'Tuileries'] },
  '75002': { ville: 'Paris 2ème', quartiers: [
    { nom: 'Gaillon' }, { nom: 'Vivienne', lieux: ['Bourse'] }, { nom: 'Mail' }, { nom: 'Bonne-Nouvelle' },
  ], autres: ['Sentier', 'Montorgueil', 'Grands Boulevards', 'Opéra'] },
  '75003': { ville: 'Paris 3ème', quartiers: [
    { nom: 'Arts-et-Métiers' }, { nom: 'Enfants-Rouges' }, { nom: 'Archives' }, { nom: 'Sainte-Avoye' },
  ], autres: ['Haut Marais', 'Marais', 'Temple'] },
  '75004': { ville: 'Paris 4ème', quartiers: [
    { nom: 'Saint-Merri', lieux: ['Beaubourg'] }, { nom: 'Saint-Gervais' }, { nom: 'Arsenal' }, { nom: 'Notre-Dame', lieux: ['Île Saint-Louis', 'Île de la Cité'] },
  ], autres: ['Marais', 'Saint-Paul', 'Hôtel de Ville', 'Place des Vosges'] },
  '75005': { ville: 'Paris 5ème', quartiers: [
    { nom: 'Saint-Victor' }, { nom: 'Jardin des Plantes' }, { nom: 'Val-de-Grâce' }, { nom: 'Sorbonne' },
  ], autres: ['Quartier Latin', 'Panthéon', 'Mouffetard', 'Maubert', 'Saint-Michel'] },
  '75006': { ville: 'Paris 6ème', quartiers: [
    { nom: 'Monnaie' }, { nom: 'Odéon' }, { nom: 'Notre-Dame-des-Champs', lieux: ['Vavin'] }, { nom: 'Saint-Germain-des-Prés' },
  ], autres: ['Luxembourg', 'Saint-Sulpice', 'Sèvres-Babylone'] },
  '75007': { ville: 'Paris 7ème', quartiers: [
    { nom: 'Saint-Thomas-d’Aquin' }, { nom: 'Invalides' }, { nom: 'École Militaire' }, { nom: 'Gros-Caillou', lieux: ['Tour Eiffel'] },
  ], autres: ['Champ-de-Mars', 'Faubourg Saint-Germain', 'Sèvres-Babylone'] },
  '75008': { ville: 'Paris 8ème', quartiers: [
    { nom: 'Champs-Élysées', lieux: ['Triangle d’or'] }, { nom: 'Faubourg du Roule' }, { nom: 'Madeleine' }, { nom: 'Europe', lieux: ['Saint-Lazare'] },
  ], autres: ['Monceau', 'Étoile'] },
  '75009': { ville: 'Paris 9ème', quartiers: [
    { nom: 'Saint-Georges', lieux: ['Nouvelle Athènes'] }, { nom: 'Chaussée-d’Antin', lieux: ['Opéra'] }, { nom: 'Faubourg Montmartre' }, { nom: 'Rochechouart' },
  ], autres: ['Pigalle', 'Grands Boulevards', 'Trinité', 'Martyrs'] },
  '75010': { ville: 'Paris 10ème', quartiers: [
    { nom: 'Saint-Vincent-de-Paul', lieux: ['Gare du Nord'] }, { nom: 'Porte Saint-Denis' }, { nom: 'Porte Saint-Martin' }, { nom: 'Hôpital Saint-Louis' },
  ], autres: ['Canal Saint-Martin', 'Gare de l’Est', 'République', 'Faubourg Saint-Denis'] },
  '75011': { ville: 'Paris 11ème', quartiers: [
    { nom: 'Folie-Méricourt' }, { nom: 'Saint-Ambroise' }, { nom: 'Roquette' }, { nom: 'Sainte-Marguerite' },
  ], autres: ['Oberkampf', 'Bastille', 'République', 'Voltaire', 'Nation'] },
  '75012': { ville: 'Paris 12ème', quartiers: [
    { nom: 'Bel-Air' }, { nom: 'Picpus' }, { nom: 'Bercy' }, { nom: 'Quinze-Vingts', lieux: ['Gare de Lyon', 'Aligre'] },
  ], autres: ['Bastille', 'Nation', 'Daumesnil'] },
  '75013': { ville: 'Paris 13ème', quartiers: [
    { nom: 'Salpêtrière' }, { nom: 'Quartier de la Gare', lieux: ['Paris Rive Gauche'] }, { nom: 'Maison-Blanche' }, { nom: 'Croulebarbe' },
  ], autres: ['Butte-aux-Cailles', 'Place d’Italie', 'Gobelins'] },
  '75014': { ville: 'Paris 14ème', quartiers: [
    { nom: 'Montparnasse' }, { nom: 'Parc Montsouris' }, { nom: 'Petit-Montrouge', lieux: ['Mouton-Duvernet'] }, { nom: 'Plaisance', lieux: ['Pernety'] },
  ], autres: ['Denfert-Rochereau', 'Alésia'] },
  '75015': { ville: 'Paris 15ème', quartiers: [
    { nom: 'Saint-Lambert', lieux: ['Brancion'] }, { nom: 'Necker' }, { nom: 'Grenelle', lieux: ['Beaugrenelle', 'Commerce'] }, { nom: 'Javel' },
  ], autres: ['Convention', 'Falguière', 'Vaugirard'] },
  '75016': { ville: 'Paris 16ème', quartiers: [
    { nom: 'Auteuil', lieux: ['Porte de Saint-Cloud', 'Michel-Ange', 'Exelmans'] }, { nom: 'Muette', lieux: ['Passy', 'Ranelagh'] },
    { nom: 'Porte Dauphine', lieux: ['Foch'] }, { nom: 'Chaillot', lieux: ['Trocadéro', 'Iéna'] },
  ], autres: ['Victor Hugo', 'Jasmin', 'Étoile'] },
  '75017': { ville: 'Paris 17ème', quartiers: [
    { nom: 'Ternes' }, { nom: 'Plaine de Monceau' }, { nom: 'Batignolles' }, { nom: 'Épinettes' },
  ], autres: ['Villiers', 'Wagram', 'Pereire', 'Courcelles', 'Clichy-Batignolles'] },
  '75018': { ville: 'Paris 18ème', quartiers: [
    { nom: 'Grandes Carrières' }, { nom: 'Clignancourt' }, { nom: 'Goutte-d’Or' }, { nom: 'La Chapelle' },
  ], autres: ['Montmartre', 'Abbesses', 'Lamarck-Caulaincourt', 'Jules Joffrin', 'Château Rouge'] },
  '75019': { ville: 'Paris 19ème', quartiers: [
    { nom: 'La Villette' }, { nom: 'Pont de Flandre' }, { nom: 'Amérique' }, { nom: 'Combat' },
  ], autres: ['Buttes-Chaumont', 'Bassin de la Villette', 'Jourdain'] },
  '75020': { ville: 'Paris 20ème', quartiers: [
    { nom: 'Belleville' }, { nom: 'Saint-Fargeau' }, { nom: 'Père-Lachaise' }, { nom: 'Charonne' },
  ], autres: ['Gambetta', 'Ménilmontant', 'Jourdain', 'Pyrénées'] },
  /* Les Hauts-de-Seine : les quartiers déjà connus du CRM, tels quels. */
  '92100': { ville: 'Boulogne-Billancourt', quartiers: ['Parchamp-Albert Kahn', 'Silly-Gallieni', 'Renault-Billancourt', 'Point-du-Jour', 'Vaillant-Marcel Sembat', 'Jean-Jaurès-Reine'].map(nom => ({ nom })) },
  '92200': { ville: 'Neuilly-sur-Seine', quartiers: ['Neuilly Centre', 'Bagatelle', 'Roule', 'Pont de Neuilly'].map(nom => ({ nom })) },
  '92300': { ville: 'Levallois-Perret', quartiers: ['Centre Levallois', 'Pont de Levallois', 'Victor Hugo'].map(nom => ({ nom })) },
  '92400': { ville: 'Courbevoie', quartiers: ['Becon', 'La Défense', 'Centre Courbevoie'].map(nom => ({ nom })) },
  '92500': { ville: 'Rueil-Malmaison', quartiers: ['Centre Rueil', 'Jonchères', 'Buzenval'].map(nom => ({ nom })) },
  '92600': { ville: 'Asnières-sur-Seine', quartiers: ['Centre Asnières', 'Bords de Seine'].map(nom => ({ nom })) },
  '92800': { ville: 'Puteaux', quartiers: ['Centre Puteaux', 'La Défense', 'Île de Puteaux'].map(nom => ({ nom })) },
};

/* Tous les noms d'une commune, dans l'ordre où on les propose : les quartiers
   de référence, leurs lieux, puis les autres noms. Sans doublon. */
export function nomsDe(c: CommuneRef | null | undefined): string[] {
  if (!c) return [];
  const l: string[] = [];
  const mettre = (x: string) => { if (!l.some(y => normQ(y) === normQ(x))) l.push(x); };
  c.quartiers.forEach(q => mettre(q.nom));
  c.quartiers.forEach(q => (q.lieux || []).forEach(mettre));
  (c.autres || []).forEach(mettre);
  return l;
}

/* ── Lire une commune (V3.226, venu de correspondance.ts) ─────────────────
   Paris, Lyon et Marseille avec leur arrondissement, quelle que soit
   l'écriture (8, 8e, 8ème, 8e arrondissement) ou, à défaut, avec le code
   postal (75116 = 16e). */
export const normQ = (x: string) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const ARRONDIS = /^(paris|lyon|marseille)\s*(\d{1,2})\s*(?:er|e|eme|ieme|em)?(?:\s*arr(?:ondissement)?\.?)?$/;
function arrondDuCp(base: string, cp: string | null | undefined): number | null {
  const c = String(cp || '').replace(/\s/g, '');
  if (base === 'paris' && /^75\d{3}$/.test(c)) { const n = c === '75116' ? 16 : Number(c.slice(3)); return n >= 1 && n <= 20 ? n : null; }
  if (base === 'lyon' && /^6900[1-9]$/.test(c)) return Number(c.slice(3));
  if (base === 'marseille' && /^130(0[1-9]|1[0-6])$/.test(c)) return Number(c.slice(3));
  return null;
}
export function lireCommune(v: string, cp?: string | null): { base: string; n: number | null } {
  const s = String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();
  const m = s.match(ARRONDIS);
  if (m) return { base: m[1], n: Number(m[2]) };
  const base = s.replace(/[^a-z0-9]/g, '');
  return { base, n: arrondDuCp(base, cp) };
}

/* La commune d'un code postal (75116 est le 16e). */
export function communeDuCp(cp: string | null | undefined): (CommuneRef & { cp: string }) | null {
  let c = String(cp || '').replace(/\s/g, '');
  if (c === '75116') c = '75016';
  return QUARTIERS_REF[c] ? { cp: c, ...QUARTIERS_REF[c] } : null;
}
/* La commune d'un nom de ville (« Paris 16ème », « Paris 16e », « Paris » +
   75016, « Boulogne-Billancourt »). */
export function communeDeVille(ville: string | null | undefined, cp?: string | null): (CommuneRef & { cp: string }) | null {
  if (!ville) return communeDuCp(cp);
  const l = lireCommune(ville, cp);
  if (l.base === 'paris' && l.n) return communeDuCp(`750${String(l.n).padStart(2, '0')}`);
  const k = Object.keys(QUARTIERS_REF).find(x => normQ(QUARTIERS_REF[x].ville) === normQ(ville));
  if (k) return { cp: k, ...QUARTIERS_REF[k] };
  const parCp = communeDuCp(cp);
  return parCp && lireCommune(parCp.ville).base === l.base ? parCp : null;
}

/* Deux noms qui se recouvrent : l'un contient l'autre, sans tenir compte des
   majuscules, des accents ni des tirets (« Gallieni » et « Silly-Gallieni »). */
/* Pour comparer deux noms : sans les petits mots (« Plaine de Monceau » =
   « Plaine Monceau », « Le Sentier » = « Sentier »), « St » = « Saint ». */
const PETITS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et']);
const cleQ = (v: string) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/[^a-z0-9]+/).filter(m => m && !PETITS.has(m)).map(m => (m === 'st' ? 'saint' : m === 'ste' ? 'sainte' : m)).join('');
export function nomsProches(a: string, b: string): boolean {
  const x = cleQ(a), y = cleQ(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const court = x.length <= y.length ? x : y;
  return court.length >= 3 && (x.includes(y) || y.includes(x));
}

/** Le quartier choisi dans une recherche couvre-t-il le quartier d'un bien ?
    Le même nom (ou un début de nom), ou un quartier de référence qui contient
    le lieu du bien (Chaillot couvre Trocadéro). */
export function quartierCouvre(choisi: string, duBien: string, c?: CommuneRef | null): boolean {
  if (nomsProches(choisi, duBien)) return true;
  if (!c) return false;
  const ref = c.quartiers.find(q => cleQ(q.nom) === cleQ(choisi)) || c.quartiers.find(q => nomsProches(q.nom, choisi));
  return !!ref?.lieux?.some(l => nomsProches(l, duBien));
}

/* Le même nom, écrit autrement (« Epinettes » et « Épinettes »). */
export const memeNom = (a: string, b: string) => !!a && !!b && cleQ(a) === cleQ(b);

/* « Les quartiers du 16e », « … de Boulogne-Billancourt », « … d’Asnières ». */
export function titreQuartiers(ville: string): string {
  const l = lireCommune(ville);
  if (l.base === 'paris' && l.n) return `Les quartiers du ${l.n === 1 ? '1er' : `${l.n}e`}`;
  return `Les quartiers ${/^[aeiouyàâéèêîôûh]/i.test(ville) ? 'd’' : 'de '}${ville}`;
}
