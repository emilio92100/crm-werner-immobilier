/* ═══ La correspondance d'un bien avec une recherche ═══════════════════
   Une seule règle pour tout le monde : l'espace acheteur l'affiche au client
   (« 96 % de vos critères »), le CRM s'en sert pour les biens en vente
   (« Acheteurs qui correspondent »). Déplacée telle quelle depuis
   EspaceClient.tsx le 27 septembre 2026 : ne pas la dupliquer ailleurs.

   Isomorphe : aucune dépendance serveur. */

import type { Arret } from '@/lib/arrets';
import { communeDeVille, lireCommune, nomsProches, quartierCouvre } from '@/lib/quartiers';
import { EMPLACEMENTS, EQUIPEMENTS, NATURES, type ProBien } from '@/lib/affaires';

/* Ce que la note lit d'un bien : le sous-ensemble du `Bien` de l'espace. */
export type BienCorr = {
  prix: number | null; ville?: string | null; quartier?: string | null;
  trajet?: { minutes: number; arret: string | null } | null;
  surface: number | null; pieces: number | null; chambres: number | null; sejour?: number | null;
  /* V3.226 : le code postal dit l'arrondissement d'une adresse à Paris, Lyon,
     Marseille (« Paris » + 75008 = Paris 8e). */
  code_postal?: string | null;
  etage: number | null; etageTotal: number | null; expo: string | null; dpe: string | null; annee: number | null;
  terrasse?: boolean; balcon?: boolean; jardin?: boolean; parking?: boolean; ascenseur?: boolean; cave?: boolean; gardien?: boolean;
  exterieur?: number | null; surfaceTerrasse?: number | null; surfaceBalcon?: number | null;
  /* V3.45 : la fiche dit-elle ses annexes, son immeuble ? Sinon un équipement
     « non annoncé » n'écarte personne (src/lib/ecart-acheteur.ts). */
  equipConnus?: { annexes: boolean; immeuble: boolean };
  /* V3.128 : un de vos mandats — son quartier est écrit avec les vôtres, pas
     découpé par un portail. Hors des quartiers demandés, le secteur passe en
     « presque » (src/lib/biens-vente.ts, versCorrespondance). */
  quartierSur?: boolean;
  /* Werner : la nature, le loyer, la vitrine, les équipements (src/lib/affaires.ts). */
  pro?: ProBien;
};
/* Ce que la note lit d'une recherche : le sous-ensemble des `Criteres` de l'espace. */
export type CriteresCorr = {
  budgetMax: number | null; secteurs: string[];
  surfaceMin: number | null; surfaceSejourMin: number | null; piecesMin: number | null; chambresMin: number | null;
  anneeMin: number | null; etageMin: number | null; etageMax: number | null;
  rdcExclu: boolean; dernierEtage: boolean; etageMaxSansAscenseur: number | null;
  exposition: string; equip: string[]; exigences: Record<string, string>;
  exterieurSurfaceMin: number | null; dpeMax: string | null;
  transportMinutes: number | null; transportArrets: Arret[];
  /* Werner : ce qu'un demandeur cherche en plus (recherches.criteres_pro) —
     la nature (location, droit au bail, fonds, murs), le loyer annuel, la
     vitrine, l'emplacement. */
  natures?: string[]; loyerMin?: number | null; loyerMax?: number | null;
  vitrineMin?: number | null; postesMin?: number | null; emplacements?: string[];
};
/* Les critères de l'immobilier d'entreprise (recherches.criteres_pro). */
export type CriteresPro = {
  natures: string[]; activite: string; loyerMin: number | null; loyerMax: number | null;
  vitrineMin: number | null; postesMin: number | null; emplacements: string[];
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lireCriteresPro(x: any): CriteresPro {
  const o = x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  const n = (v: unknown) => { const y = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/\s/g, '').replace(',', '.')) : NaN; return Number.isFinite(y) && y > 0 ? y : null; };
  const l = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && !!s) : []);
  return {
    natures: l(o.natures), activite: typeof o.activite === 'string' ? o.activite : '',
    loyerMin: n(o.loyerMin), loyerMax: n(o.loyerMax), vitrineMin: n(o.vitrineMin), postesMin: n(o.postesMin), emplacements: l(o.emplacements),
  };
}

const EUR = (n?: number | null) =>
  n == null ? '—' : n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' €';
export const normVille = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const lireSecteur = (label: string) => {
  const m = label.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  return m ? { quartier: m[1].trim(), ville: m[2].trim() } : { quartier: null as string | null, ville: label.trim() };
};
/* ── La même commune ? (V3.226) ─────────────────────────────────────────
   Alexandre (21 octobre 2026) : « il faut que le rapprochement soit précis ».
   Une adresse tapée à Paris donne la ville « Paris » (le code postal dit
   l'arrondissement) ; les clients, eux, choisissent « Paris 8ème ». Comparées
   lettre à lettre, « Paris » n'était pas « Paris 8ème » — ni même « Paris
   8e » : le bien sortait « autre secteur » pour TOUS ceux qui cherchent un
   arrondissement. Ici Paris, Lyon et Marseille se lisent avec leur
   arrondissement, quelle que soit l'écriture (8, 8e, 8ème, 8e
   arrondissement) ou, à défaut, avec le code postal. Une ville entière, côté
   recherche, comprend tous ses arrondissements ; un bien dont on ne sait pas
   l'arrondissement est « presque » dans celui demandé. */
/* V3.227 : la lecture d'une commune vit dans src/lib/quartiers.ts, avec les
   quartiers de référence. */
/** La ville d'une recherche face à celle d'un bien : « oui », « presque »
    (la bonne ville, arrondissement du bien inconnu) ou null (autre ville). */
export function memeCommune(villeRecherche: string, villeBien: string, cpBien?: string | null): 'oui' | 'presque' | null {
  const r = lireCommune(villeRecherche), b = lireCommune(villeBien, cpBien);
  if (!r.base || r.base !== b.base) return null;
  if (r.n === null || r.n === b.n) return 'oui';
  return b.n === null ? 'presque' : null;
}

export const grouperSecteurs = (liste: string[]) => {
  const villes: { ville: string; quartiers: string[] }[] = [];
  for (const s of liste) {
    const { ville, quartier } = lireSecteur(s);
    let v = villes.find(x => normVille(x.ville) === normVille(ville));
    if (!v) { v = { ville, quartiers: [] }; villes.push(v); }
    if (quartier && !v.quartiers.some(q => normVille(q) === normVille(quartier))) v.quartiers.push(quartier);
  }
  return villes;
};

/* Les critères d'une ligne de `recherches`, lus comme l'espace les lit
   (src/app/espace/[token]/page.tsx, prop `criteres`) : garder les deux pareils. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function criteresDepuisRecherche(r: Record<string, any>): CriteresCorr {
  return {
    budgetMax: r.budget_max ?? null, secteurs: r.secteurs || [],
    surfaceMin: r.surface_min ?? null, surfaceSejourMin: r.surface_sejour_min ?? null,
    piecesMin: r.nb_pieces_min ?? null, chambresMin: r.chambres_min ?? null,
    anneeMin: r.annee_construction_min ?? null,
    etageMin: r.etage_min ?? null, etageMax: r.etage_max ?? null,
    rdcExclu: !!r.rdc_exclu, dernierEtage: !!r.dernier_etage,
    etageMaxSansAscenseur: r.etage_max_sans_ascenseur ?? null,
    exposition: r.exposition_souhaitee || '',
    exigences: r.exigences || {},
    exterieurSurfaceMin: r.exterieur_surface_min ?? null,
    dpeMax: r.dpe_max ?? null,
    transportMinutes: r.transport_minutes ?? null,
    transportArrets: r.transport_arrets || [],
    ...(() => { const p = lireCriteresPro(r.criteres_pro); return { natures: p.natures, loyerMin: p.loyerMin, loyerMax: p.loyerMax, vitrineMin: p.vitrineMin, postesMin: p.postesMin, emplacements: p.emplacements }; })(),
    equip: [
      r.terrasse && 'Terrasse', r.balcon && 'Espace extérieur', r.jardin && 'Cour',
      r.parking && 'Parking', r.ascenseur && 'Ascenseur', r.cave && 'Cave',
      r.gardien && 'Gardien',
    ].filter(Boolean) as string[],
  };
}

/* Une note sur 100 et son détail, critère par critère : ce que le client a
   demandé, face à ce que le bien a. Elle se calcule à l'écran, avec ce
   que le client voit déjà : ses critères et la fiche du bien. Rien d'autre
   n'entre dans le calcul — ni le marché, ni les autres biens, ni les notes
   de travail du conseiller.

   Chaque critère que le client a posé compte. Un « indispensable » pèse
   trois fois plus ; le budget, le secteur, le trajet, la surface et les
   chambres deux fois. Un critère presque atteint compte pour moitié. Ce que
   l'annonce ne dit pas ne se juge pas, sauf un équipement demandé : il est
   dit « non annoncé ». En dessous de trois critères vérifiables, pas de
   note : elle ne voudrait rien dire. */
export type LigneCorr = { ico: string; lib: string; demande: string; valeur: string; etat: 'oui' | 'presque' | 'non'; poids: number };
export type Correspondance = { note: number; lignes: LigneCorr[] };

const EQUIP_CLE: Record<string, string> = {
  /* Werner : l'espace écrit « Espace extérieur » et « Cour » ; les anciens
     libellés restent reconnus. */
  'Espace extérieur': 'balcon', Extérieur: 'balcon', Cour: 'jardin',
  Terrasse: 'terrasse', Balcon: 'balcon', Jardin: 'jardin', Parking: 'parking',
  Ascenseur: 'ascenseur', Cave: 'cave', Gardien: 'gardien',
};
const EQUIP_NOM: Record<string, string> = {
  terrasse: 'Terrasse', balcon: 'Espace extérieur', jardin: 'Cour', parking: 'Parking',
  ascenseur: 'Ascenseur', cave: 'Cave', gardien: 'Gardien', exterieur: 'Extérieur',
};
const EQUIP_ICO: Record<string, string> = {
  terrasse: 'terrasse', balcon: 'terrasse', jardin: 'jardin', parking: 'parking',
  ascenseur: 'ascenseur', cave: 'cave', gardien: 'gardien', exterieur: 'jardin',
};

export function correspondance(b: BienCorr, c: CriteresCorr | null | undefined): Correspondance | null {
  if (!c) return null;
  const L: LigneCorr[] = [];
  /* V3.226 : le secteur est à vérifier (hors de ses quartiers, ou
     arrondissement inconnu) : la note reste sous 70. */
  let aVerifier = false;
  const ex = c.exigences || {};
  const nb = (v: number) => String(v).replace('.', ',');
  const min = (v: number | string, u = '') => `${v}${u} minimum`;

  /* Werner : ce que le demandeur cherche (louer, reprendre un bail, un
     fonds, acheter des murs) face à ce que l'affaire propose. */
  const p = b.pro;
  if (p?.nature && c.natures?.length) {
    const nom = (v: string) => NATURES.find(x => x.v === v)?.court || v;
    L.push({ ico: 'cle', lib: 'Ce qu’il cherche', demande: c.natures.map(nom).join(', '), valeur: nom(p.nature), etat: c.natures.includes(p.nature) ? 'oui' : 'non', poids: 3 });
  }
  /* Le loyer annuel (une location, un bail repris) et le prix (un droit au
     bail, un fonds, des murs) ont chacun leur plafond. */
  if (p && p.loyerAn && c.loyerMax) {
    const r = p.loyerAn / c.loyerMax;
    L.push({ ico: 'euro', lib: 'Loyer annuel', demande: `jusqu’à ${EUR(c.loyerMax)} HT HC`, valeur: `${EUR(p.loyerAn)} HT HC`, etat: r <= 1 ? 'oui' : r <= 1.1 ? 'presque' : 'non', poids: 2 });
  }
  if (p && p.prix && c.budgetMax) {
    const r = p.prix / c.budgetMax;
    const lib = p.nature === 'cession_bail' ? 'Droit au bail' : p.nature === 'fonds' ? 'Prix du fonds' : 'Prix';
    L.push({ ico: 'euro', lib, demande: `jusqu’à ${EUR(c.budgetMax)}`, valeur: EUR(p.prix), etat: r <= 1 ? 'oui' : r <= 1.1 ? 'presque' : 'non', poids: 2 });
  }
  if (p && c.vitrineMin && p.vitrine) {
    const r = p.vitrine / c.vitrineMin;
    L.push({ ico: 'vitrine', lib: 'Vitrine', demande: `${nb(c.vitrineMin)} m minimum`, valeur: `${nb(p.vitrine)} m`, etat: r >= 1 ? 'oui' : r >= 0.85 ? 'presque' : 'non', poids: 1 });
  }
  if (p && c.emplacements?.length && p.emplacement) {
    const nom = (v: string) => EMPLACEMENTS.find(x => x.v === v)?.l || v;
    L.push({ ico: 'cible', lib: 'Emplacement', demande: c.emplacements.map(nom).join(', '), valeur: nom(p.emplacement), etat: c.emplacements.includes(p.emplacement) ? 'oui' : 'presque', poids: 1 });
  }

  /* Le budget : au-dessus, même d'un euro, ce n'est plus coché — c'est « presque ».
     Une affaire de Werner a ses propres lignes (loyer, prix) juste au-dessus. */
  if (!p && c.budgetMax && b.prix) {
    const r = b.prix / c.budgetMax;
    L.push({ ico: 'euro', lib: 'Budget', demande: `jusqu’à ${EUR(c.budgetMax)}`, valeur: EUR(b.prix),
      etat: r <= 1 ? 'oui' : r <= 1.1 ? 'presque' : 'non', poids: 2 });
  }

  /* Le secteur : la ville du bien parmi celles de la recherche, et son
     quartier quand il fait partie de ceux demandés. On ne dit jamais « hors
     de vos quartiers » : les portails ne découpent pas les villes comme nous. */
  if (c.secteurs?.length && b.ville) {
    const villes = grouperSecteurs(c.secteurs);
    /* V3.226 : la commune comparée avec son arrondissement (memeCommune). */
    const rel = villes.map(x => ({ x, r: memeCommune(x.ville, b.ville as string, b.code_postal) })).filter(y => y.r);
    const exacte = rel.find(y => y.r === 'oui');
    const v = (exacte || rel[0])?.x;
    const arrondInconnu = !exacte && !!v;
    /* V3.227 : un début de nom suffit, et un quartier de référence couvre ses
       lieux (le client a choisi Chaillot, le bien est au Trocadéro). */
    const commune = v ? communeDeVille(v.ville, b.code_postal) : null;
    const q = v && b.quartier ? v.quartiers.find(x => quartierCouvre(x, b.quartier as string, commune)) : null;
    const qVu = q && b.quartier && !nomsProches(q, b.quartier) ? `${b.quartier}, dans ${q}` : q;
    /* « Parchamp-Albert Kahn, Jean-Jaurès-Reine et 3 autres » : le client
       sait combien il en a choisi, au lieu d'un « … » qui ne dit rien. */
    const deuxEtLeReste = (l: string[], mot: string) => `${l.slice(0, 2).join(', ')}${l.length > 2 ? ` et ${l.length - 2} autre${l.length > 3 ? 's' : ''}${mot}` : ''}`;
    const demande = villes.length === 1
      ? (villes[0].quartiers.length ? deuxEtLeReste(villes[0].quartiers, '') : villes[0].ville)
      : deuxEtLeReste(villes.map(x => x.ville), villes.length > 3 ? ' villes' : ' ville');
    /* V3.128 (Alexandre : « ma cliente recherchait Boulogne-Nord… il m'a
       proposé un bien qui n'était pas dans son secteur ») : pour un de vos
       mandats, un quartier renseigné qui n'est pas parmi ceux demandés passe
       le secteur en « presque » — la ville est la bonne, le quartier non. Un
       début de nom suffit (« Silly » pour « Silly-Gallieni »). Les annonces
       des portails gardent la règle d'avant. */
    const horsQuartiers = !!(v && !arrondInconnu && b.quartierSur && b.quartier && v.quartiers.length && !q);
    if (horsQuartiers || arrondInconnu) aVerifier = true;
    L.push({ ico: 'lieu', lib: 'Secteur', demande, valeur: horsQuartiers ? `${b.quartier} · hors de ses quartiers` : arrondInconnu ? `${b.ville} · arrondissement à préciser` : qVu || b.quartier || b.ville, etat: !v ? 'non' : horsQuartiers || arrondInconnu ? 'presque' : 'oui', poids: 2 });
  }

  /* Le trajet : minutes à pied jusqu'à la station, quand l'annonce permet de le dire. */
  if (b.trajet) {
    const arret = b.trajet.arret ? (c.transportArrets || []).find(a => a.nom === b.trajet?.arret) : null;
    const max = (arret?.minutes as number | undefined) || c.transportMinutes || null;
    if (max) {
      const m = b.trajet.minutes;
      L.push({ ico: 'train', lib: 'Trajet à pied', demande: `${max} min maximum${arret ? ` · ${arret.nom}` : ''}`, valeur: `${m} min`,
        etat: m <= max ? 'oui' : m <= max + Math.min(5, Math.max(2, Math.round(max / 2))) ? 'presque' : 'non', poids: 2 });
    }
  }

  if (c.surfaceMin && b.surface) {
    const r = b.surface / c.surfaceMin;
    L.push({ ico: 'regle', lib: 'Surface', demande: min(nb(c.surfaceMin), ' m²'), valeur: `${nb(b.surface)} m²`, etat: r >= 1 ? 'oui' : r >= 0.95 ? 'presque' : 'non', poids: 2 });
  }
  if (c.chambresMin && b.chambres != null) {
    L.push({ ico: 'plan', lib: 'Chambres', demande: min(c.chambresMin), valeur: String(b.chambres), etat: b.chambres >= c.chambresMin ? 'oui' : 'non', poids: 2 });
  }
  if (c.piecesMin && b.pieces != null) {
    L.push({ ico: 'plan', lib: 'Pièces', demande: min(c.piecesMin), valeur: String(b.pieces), etat: b.pieces >= c.piecesMin ? 'oui' : 'non', poids: 1 });
  }
  if (c.surfaceSejourMin && b.sejour) {
    const r = b.sejour / c.surfaceSejourMin;
    L.push({ ico: 'canape', lib: 'Séjour', demande: min(nb(c.surfaceSejourMin), ' m²'), valeur: `${nb(b.sejour)} m²`, etat: r >= 1 ? 'oui' : r >= 0.9 ? 'presque' : 'non', poids: 1 });
  }

  const etageCompte = c.rdcExclu || c.etageMin != null || c.etageMax != null || c.etageMaxSansAscenseur != null || c.dernierEtage;
  if (etageCompte && b.etage != null) {
    const e = b.etage;
    const valeur = e === 0 ? 'RDC' : `${e}e${b.etageTotal ? ` sur ${b.etageTotal}` : ''}`;
    const dem: string[] = [];
    if (c.etageMin != null) dem.push(`à partir du ${c.etageMin}e`);
    else if (c.rdcExclu) dem.push('pas de rez-de-chaussée');
    if (c.etageMax != null) dem.push(`jusqu’au ${c.etageMax}e`);
    if (c.dernierEtage) dem.push('dernier étage');
    if (c.etageMaxSansAscenseur != null && !dem.length) dem.push(`${c.etageMaxSansAscenseur}e max sans ascenseur`);
    let etat: LigneCorr['etat'] = 'oui';
    if (c.rdcExclu && e === 0) etat = 'non';
    else if (c.etageMin != null && e < c.etageMin) etat = 'non';
    else if (c.etageMax != null && e > c.etageMax) etat = 'non';
    else if (c.etageMaxSansAscenseur != null && !b.ascenseur && e > c.etageMaxSansAscenseur) etat = 'non';
    else if (c.dernierEtage && b.etageTotal && e < b.etageTotal) etat = 'non';
    L.push({ ico: 'immeuble', lib: 'Étage', demande: dem.join(', '), valeur, etat, poids: 1 });
  }

  if (c.dpeMax && b.dpe) {
    const o = 'ABCDEFG';
    const i = o.indexOf(String(b.dpe).toUpperCase()[0]), m = o.indexOf(String(c.dpeMax).toUpperCase()[0]);
    if (i >= 0 && m >= 0) L.push({ ico: 'eclair', lib: 'Énergie (DPE)', demande: `${o[m]} au plus`, valeur: o[i], etat: i <= m ? 'oui' : 'non', poids: 1 });
  }
  if (c.anneeMin && b.annee) {
    L.push({ ico: 'calendrier', lib: 'Construction', demande: `${c.anneeMin} ou après`, valeur: String(b.annee), etat: b.annee >= c.anneeMin ? 'oui' : 'non', poids: 1 });
  }

  const vises = String(c.exposition || '').toLowerCase().split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
  if (vises.length && b.expo) {
    const a = String(b.expo).toLowerCase();
    L.push({ ico: 'soleil', lib: 'Exposition', demande: vises.map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(', '), valeur: b.expo,
      etat: vises.some(v => a.includes(v) || v.includes(a)) ? 'oui' : 'non', poids: 1 });
  }

  /* Les équipements : cochés dans la recherche, ou notés « souhaité » / « indispensable ». */
  const voulus = new Set<string>();
  (c.equip || []).forEach(l => { const k = EQUIP_CLE[l]; if (k) voulus.add(k); });
  Object.keys(ex).forEach(k => { if (ex[k] && (EQUIP_NOM[k] || (p && (EQUIPEMENTS.some(e => e.v === k) || k === 'rdc')))) voulus.add(k); });
  const ext = b.exterieur || ((b.surfaceTerrasse || 0) + (b.surfaceBalcon || 0)) || 0;
  voulus.forEach(k => {
    const indis = ex[k] === 'indispensable';
    const poids = indis ? 3 : 1;
    const demande = indis ? 'indispensable' : 'souhaité';
    if (k === 'exterieur') {
      const a = !!(b.balcon || b.terrasse || b.jardin || ext > 0);
      const presque = a && !!c.exterieurSurfaceMin && ext > 0 && ext < c.exterieurSurfaceMin;
      L.push({ ico: EQUIP_ICO[k], lib: 'Extérieur', demande: c.exterieurSurfaceMin ? `${nb(c.exterieurSurfaceMin)} m² minimum, ${demande}` : demande,
        valeur: a ? (ext > 0 ? `${nb(ext)} m²` : 'Oui') : 'Non annoncé', etat: !a ? 'non' : presque ? 'presque' : 'oui', poids });
      return;
    }
    /* Werner : les équipements d'une affaire, clé à clé ; « rdc » : le local est au rez-de-chaussée. */
    if (p && (EQUIPEMENTS.some(e => e.v === k) || k === 'rdc')) {
      const a = k === 'rdc' ? b.etage === 0 : p.equipements.includes(k);
      const lib = k === 'rdc' ? 'Rez-de-chaussée' : EQUIPEMENTS.find(e => e.v === k)?.l || k;
      L.push({ ico: k === 'rdc' ? 'vitrine' : 'check', lib, demande, valeur: a ? 'Oui' : k === 'rdc' && b.etage != null ? `${b.etage}e étage` : 'Non annoncé', etat: a ? 'oui' : 'non', poids });
      return;
    }
    const a = !!(b as unknown as Record<string, unknown>)[k];
    L.push({ ico: EQUIP_ICO[k], lib: EQUIP_NOM[k], demande, valeur: a ? 'Oui' : 'Non annoncé', etat: a ? 'oui' : 'non', poids });
  });

  if (L.length < 3) return null;
  const total = L.reduce((t, x) => t + x.poids, 0);
  const points = L.reduce((t, x) => t + (x.etat === 'oui' ? x.poids : x.etat === 'presque' ? x.poids / 2 : 0), 0);
  const note = Math.round((100 * points) / total);
  /* V3.226 (Alexandre : « s'il n'y a aucun lien… c'est à nous de
     sélectionner ») : hors des quartiers qu'il a choisis, ou sans savoir si
     le bien est dans son arrondissement, un bien ne « correspond » jamais —
     au mieux « en partie », sous 70 %. */
  return { note: aVerifier ? Math.min(note, 69) : note, lignes: L };
}
