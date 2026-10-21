import { createClient } from '@supabase/supabase-js';
import { lirePhotos, mentionsAnnonce, type BienVente } from '@/lib/biens-vente';
import { lireDiffusion, diffuseSur } from '@/lib/diffusion';
import {
  EMPLACEMENTS, EQUIPEMENTS, NATURES, TYPES_LOCAL, loyerM2, montantAffaire, natureDe, proDuBien,
  type NatureAffaire,
} from '@/lib/affaires';
import type { Donnees } from '@/lib/actes';

/* ═══ Les annonces du site wernerimmobilier.com (21 octobre 2026) ═══════════
   Le site (dépôt emilio92100/werner-immobilier-site) lit GET /api/site/annonces.
   Ce fichier choisit les affaires à montrer et ce qu'on en dit, sans rien de
   privé : ni l'adresse exacte, ni le mandant, ni les notes, ni les chiffres
   d'un fonds. La clé de service lit la base (la route est publique).

   Une affaire paraît sur le site :
     · non archivée, à l'étape « disponible », « sous offre » ou « en signature » ;
     · si sa diffusion n'est pas encore réglée (les 63 affaires reprises de
       SeLoger le 20 octobre), ou si « Mon site » y est coché.
   « Signé récemment » : les affaires conclues avec au moins une photo, les
   plus récentes d'abord, sans montant. */

export type AnnonceSite = {
  id: string;
  ref: string | null;
  titre: string;
  nature: NatureAffaire | null;
  natureLib: string;
  natureCourt: string;
  type: string | null;
  typeLib: string;
  ville: string;
  cp: string;
  lieu: string;            // « Paris 11e », « Boulogne-Billancourt »
  quartier: string;
  surface: number | null;
  montant: number | null;
  montantLib: string;      // « Loyer annuel HT HC », « Prix du droit au bail »…
  montantTexte: string;    // « 48 000 € HT HC / an »
  loyerM2: string;
  loyerBail: number | null; // le loyer du bail en cours (cession, murs occupés)
  statut: 'disponible' | 'sous_offre' | 'en_signature';
  exclusif: boolean;
  photos: string[];
  description: string;
  mentions: string;
  points: string[];
  date: string;
};

export type SigneeSite = {
  id: string; titre: string; lieu: string; natureCourt: string; typeLib: string;
  surface: number | null; photo: string; date: string | null;
};

const base = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ETAPES_SITE = ['mandat', 'offre', 'compromis'];

/* Paris : « 75011 » → « Paris 11e », « 75001 » → « Paris 1er ». Ailleurs, la ville. */
export function lieuDe(ville: string, cp: string): string {
  const c = cp.replace(/\s/g, '');
  const m = /^75(\d{3})$/.exec(c);
  if (m && /paris/i.test(ville || 'Paris')) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 20) return `Paris ${n === 1 ? '1er' : `${n}e`}`;
    if (n === 116) return 'Paris 16e';
  }
  return ville || cp;
}

const txt = (d: Donnees, k: string) => (typeof d[k] === 'string' ? String(d[k]).trim() : '');
const nb = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/\s/g, '').replace(',', '.')) : NaN;
  return Number.isFinite(x) && x > 0 ? x : null;
};

function visible(b: BienVente): boolean {
  if (b.archive || !ETAPES_SITE.includes(b.etape)) return false;
  const r = lireDiffusion(b.donnees);
  return !r || diffuseSur(b, 'site');
}

/* Ce qui fait vendre un local, en quelques mots : la vitrine, l'extraction… */
function pointsDe(d: Donnees, surface: number | null): string[] {
  const p = proDuBien(d);
  const out: string[] = [];
  if (p.vitrine) out.push(`Vitrine ${String(p.vitrine).replace('.', ',')} m`);
  if (p.extraction === 'oui' || p.equipements.includes('extraction')) out.push('Extraction');
  if (p.emplacement) { const e = EMPLACEMENTS.find(x => x.v === p.emplacement)?.l; if (e) out.push(`Emplacement ${e}`); }
  if (p.divisible) out.push(p.surfDivMin ? `Divisible dès ${p.surfDivMin} m²` : 'Divisible');
  if (p.destinationType === 'tous') out.push('Tous commerces');
  if (p.destinationType === 'restauration') out.push('Restauration possible');
  for (const k of p.equipements) {
    if (k === 'extraction' || out.length >= 6) continue;
    const l = EQUIPEMENTS.find(x => x.v === k)?.l;
    if (l) out.push(l);
  }
  const niveaux = nb(d.niveaux);
  if (niveaux && niveaux > 1) out.unshift(`${niveaux} niveaux`);
  if (surface && !out.length) out.push(`${surface} m²`);
  return out.slice(0, 6);
}

export function annoncePourSite(b: BienVente): AnnonceSite {
  const d = b.donnees || {};
  const nat = natureDe(d);
  const N = NATURES.find(n => n.v === nat);
  const type = typeof d.typeBien === 'string' && d.typeBien ? d.typeBien : b.type_bien;
  const T = TYPES_LOCAL.find(t => t.v === type);
  const ville = b.ville || txt(d, 'ville');
  const cp = b.code_postal || txt(d, 'cp');
  const surface = b.surface ?? nb(d.surface);
  const montant = b.prix ?? nb(d.prix);
  const pro = proDuBien(d);
  const photos = lirePhotos(d.photos).map(p => p.url);
  if (!photos.length && b.photo) photos.push(b.photo);
  return {
    id: b.id,
    ref: b.reference,
    titre: txt(d, 'annonceTitre') || b.titre || [T?.court, surface ? `${surface} m²` : '', lieuDe(ville, cp)].filter(Boolean).join(' · '),
    nature: nat,
    natureLib: N?.l || '',
    natureCourt: N?.court || '',
    type: type || null,
    typeLib: T?.court || '',
    ville, cp,
    lieu: lieuDe(ville, cp),
    quartier: b.quartier || txt(d, 'quartier'),
    surface,
    montant,
    montantLib: N?.prix || 'Prix',
    montantTexte: montant ? montantAffaire(montant, d) : '',
    loyerM2: nat === 'location' ? loyerM2(montant, surface) : '',
    loyerBail: nat && nat !== 'location' ? pro.loyerAn : null,
    statut: b.etape === 'offre' ? 'sous_offre' : b.etape === 'compromis' ? 'en_signature' : 'disponible',
    exclusif: (b.mandat_type || txt(d, 'mandatType')) === 'exclusif',
    photos,
    description: txt(d, 'annonceTexte'),
    mentions: montant ? mentionsAnnonce(d) : '',
    points: pointsDe(d, surface),
    date: (b.en_vente_le || b.created_at || '').slice(0, 10),
  };
}

export async function lireAnnoncesSite(): Promise<{ annonces: AnnonceSite[]; signees: SigneeSite[] }> {
  const sb = base();
  const { data, error } = await sb.from('biens_vente').select('*').eq('archive', false);
  if (error) throw new Error(error.message);
  const tous = (data || []) as BienVente[];
  const annonces = tous.filter(visible).map(annoncePourSite)
    .sort((a, b) => (a.statut === b.statut ? b.date.localeCompare(a.date) : a.statut === 'disponible' ? -1 : 1));
  const signees: SigneeSite[] = tous
    .filter(b => b.etape === 'vendu')
    .map(b => ({ b, a: annoncePourSite(b) }))
    .filter(x => x.a.photos.length)
    .sort((x, y) => (y.b.vendu_le || '').localeCompare(x.b.vendu_le || ''))
    .slice(0, 8)
    .map(({ b, a }) => ({ id: a.id, titre: a.titre, lieu: a.lieu, natureCourt: a.natureCourt, typeLib: a.typeLib, surface: a.surface, photo: a.photos[0], date: b.vendu_le ? b.vendu_le.slice(0, 7) : null }));
  return { annonces, signees };
}
