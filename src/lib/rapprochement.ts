/* ═══ Le rapprochement (V3.29) ═══════════════════════════════════════════
   Depuis la fiche d'un acheteur : trouver, parmi les mandats de l'agence et
   les biens que les veilles ont trouvés pour les autres clients, ceux qui
   répondent à SA recherche. Une seule règle de note, celle de l'espace
   (src/lib/correspondance.ts) : 70 % et plus « correspondent », 50 à 69 %
   « en partie », en dessous on ne montre rien.

   Ce qui est déjà dans son dossier (sélection, présentés) est mis de côté.
   Le bien choisi entre dans son dossier à l'étape « selection », avec son
   `recherche_id` (AGENTS.md §3.1) : il apparaît dans l'onglet Sélection, et
   le mail d'envoi habituel le fait passer « Présenté ». */

import { supabase } from '@/lib/supabase';
import { correspondance, criteresDepuisRecherche, type BienCorr, type Correspondance } from '@/lib/correspondance';
import { raisonEcart } from '@/lib/ecart-acheteur';
import { versCorrespondance, typeCompatible, versBienAcheteur, titreBien, lirePhotos, type BienVente } from '@/lib/biens-vente';
import { SEUIL_LISTE } from '@/components/biens/outils';
import { signalerEchec } from '@/lib/ecritures';
import { champsChauffage } from '@/lib/chauffage';

export type SourceRappro = 'mandats' | 'veilles' | 'deux';
/* En jours ; 0 = depuis le début. */
export type PeriodeVeille = 30 | 90 | 180 | 0;
export const PERIODES: { k: PeriodeVeille; l: string }[] = [
  { k: 30, l: '1 mois' }, { k: 90, l: '3 mois' }, { k: 180, l: '6 mois' }, { k: 0, l: 'Depuis le début' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ligne = Record<string, any>;

export type Trouve = {
  cle: string;
  source: 'mandat' | 'veille';
  titre: string;
  lieu: string;
  prix: number | null;
  photo: string | null;
  photos: string[];
  url: string | null;
  surface: number | null; pieces: number | null; chambres: number | null;
  corr: Correspondance;
  /* Un mandat : le bien en vente. Une veille : la proposition d'origine. */
  vente?: BienVente;
  prop?: Ligne;
  /* Veille : pour qui elle l'a trouvé, et quand. */
  pour?: string;
  le?: string;
  /* V3.228 : un bien pas encore en vente (estimation, à suivre) : il part
     sans prix (prixCopie). */
  avant?: boolean;
  /* V3.228 : déjà dans son dossier — ce qui en a été fait. */
  dossier?: EtatDossier;
};
/* V3.228 : un bien déjà dans le dossier de l'acheteur, et où il en est. */
export type EtatDossier = { etape: string; envoye_le: string | null; badge: string | null; le: string | null };

/* V3.228 — Alexandre : « depuis un client, est-ce qu'il cherche aussi dans
   mes estimations ? » Les biens pas encore en vente se cherchent sur
   demande (une case, décochée d'office). */
const ETAPES_VENTE_RAPPRO = ['mandat'];
const ETAPES_ESTIMATION = ['estimation', 'a_suivre'];
export type OptionsRappro = { ventes?: boolean; estimations?: boolean };

const nb = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
};
const depuis = (jours: PeriodeVeille) => (jours ? new Date(Date.now() - jours * 86400000).toISOString() : null);

/* Une annonce (proposition de veille ou bien d'un dossier) lue par la note. */
export function corrDepuisAnnonce(p: Ligne): BienCorr {
  return {
    prix: nb(p.prix ?? p.prix_acquereur), ville: p.ville || null, quartier: p.quartier || null,
    surface: nb(p.surface), pieces: nb(p.nb_pieces), chambres: nb(p.nb_chambres), sejour: nb(p.surface_sejour),
    etage: nb(p.etage), etageTotal: nb(p.etage_total), expo: p.exposition || null, dpe: p.dpe || null, annee: nb(p.annee_construction),
    terrasse: !!p.terrasse, balcon: !!p.balcon, jardin: !!p.jardin, parking: !!p.parking,
    ascenseur: !!p.ascenseur, cave: !!p.cave, gardien: !!p.gardien,
    exterieur: nb(p.surface_exterieur),
  };
}

/* Le type d'une annonce (« Appartement », « Maison »…) face à ceux de la
   recherche. Une recherche sans type accepte tout ; une annonce sans type
   n'est pas écartée pour ça. */
function typeAnnonceOk(t: unknown, typesRecherche: string | null | undefined): boolean {
  const l = String(typesRecherche || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const v = String(t || '').trim().toLowerCase();
  if (!l.length || !v) return true;
  if (l.includes(v)) return true;
  return ['duplex', 'loft', 'studio', 'triplex'].includes(v) && l.includes('appartement');
}

/* V3.165 : le numéro de l'agence qui vend. Relevé par la veille dans
   `agence_tel` ; à défaut, celui qu'elle a noté pour cette même agence dans
   ses lignes « diffuseur » (`historique_prix`). Jamais celui d'une autre agence. */
export function telAgence(p: Ligne | null | undefined): string | null {
  if (!p) return null;
  const direct = String(p.agence_tel || '').trim();
  if (direct) return direct;
  const agence = String(p.agence_nom || p.agence || '').trim().toLowerCase();
  if (!agence || !Array.isArray(p.historique_prix)) return null;
  const d = p.historique_prix.find((x: any) => x?.type === 'diffuseur' && x?.tel && String(x.agence || '').trim().toLowerCase() === agence);
  return d ? String(d.tel).trim() || null : null;
}

/* La ligne à poser dans `biens` pour une proposition de veille — exactement
   les colonnes qu'écrit « Retenir » dans l'onglet Veille (OngletVeille). */
export function bienDepuisProposition(p: Ligne, clientId: string, rechercheId: string): Ligne {
  return {
    client_id: clientId, recherche_id: rechercheId, url: p.url || null,
    titre: p.titre, ville: p.ville, code_postal: p.code_postal,
    quartier: p.quartier || null, adresse: p.adresse || p.adresse_probable || null,
    adresse_probable: p.adresse_probable || null, situation: p.situation || null,
    type_bien: p.type_bien, surface: p.surface, nb_pieces: p.nb_pieces, nb_chambres: p.nb_chambres,
    surface_sejour: p.surface_sejour || null, surface_exterieur: p.surface_exterieur || null,
    etage: p.etage, etage_total: p.etage_total, annee_construction: p.annee_construction,
    exposition: p.exposition || null, dpe: p.dpe || null, ges: p.ges || null,
    parking: p.parking || false, nb_parking: p.nb_parking || null,
    balcon: p.balcon || false, terrasse: p.terrasse || false,
    jardin: p.jardin || false, cave: p.cave || false, ascenseur: p.ascenseur || false,
    gardien: p.gardien || false, description: p.description, prix_vendeur: p.prix,
    commission_type: 'pourcentage', commission_val: null, prix_acquereur: p.prix,
    nb_lots: p.nb_lots, photos: p.photos || [],
    charges_trimestrielles: p.charges_trimestrielles ?? null, taxe_fonciere: p.taxe_fonciere ?? null,
    ...(p.charges_comprises ? { charges_comprises: p.charges_comprises } : {}),
    ...champsChauffage(p),
    ...(Array.isArray(p.plans) && p.plans.length ? { plans: p.plans } : {}),
    source_portail: p.portail || 'Veille', agence_nom: p.agence || null, agence_tel: telAgence(p), badge_retour: 'propose',
    etape: 'selection', yanport_id: p.yanport_id || null, est_particulier: p.est_particulier || false,
    date_publication: p.date_publication || p.date_annonce || null, prix_initial: p.prix_initial || null,
    nb_baisses: p.nb_baisses || null, nb_agences: p.nb_agences || null,
    historique_prix: p.historique_prix || [], date_derniere_baisse: p.date_derniere_baisse || null,
    score: p.score ?? null, points_forts: p.points_forts || null, points_attention: p.points_attention || null,
    verdict: p.verdict ?? null, appreciation: p.appreciation ?? null,
    /* Werner : la nature, le loyer, le bail… (biens.pro), pour l'espace du demandeur. */
    ...(p.pro && typeof p.pro === 'object' && Object.keys(p.pro).length ? { pro: p.pro } : {}),
  };
}

/* Combien il y a à comparer : pour les cartes de la fenêtre de choix. */
export async function compterSources(rechercheId: string, clientId: string): Promise<{ mandats: number; estimations: number; veilles: Record<number, number> }> {
  const veilles: Record<number, number> = {};
  const [m, ...v] = await Promise.all([
    supabase.from('biens_vente').select('id, client_id, etape').eq('archive', false).in('etape', [...ETAPES_VENTE_RAPPRO, ...ETAPES_ESTIMATION]),
    ...PERIODES.map(p => {
      let q = supabase.from('veille_propositions').select('id', { count: 'exact', head: true })
        .neq('recherche_id', rechercheId).in('statut', ['nouveau', 'retenu']);
      const d = depuis(p.k);
      if (d) q = q.gte('created_at', d);
      return q;
    }),
  ]);
  PERIODES.forEach((p, i) => { veilles[p.k] = (v[i] as { count: number | null }).count ?? 0; });
  const autres = ((m.data || []) as { client_id: string | null; etape: string }[]).filter(x => x.client_id !== clientId);
  const mandats = autres.filter(x => ETAPES_VENTE_RAPPRO.includes(x.etape)).length;
  const estimations = autres.filter(x => ETAPES_ESTIMATION.includes(x.etape)).length;
  return { mandats, estimations, veilles };
}

/* Les mandats en cours qui lui correspondent (70 % et plus) : pour le
   bandeau de la Vue d'ensemble, sans rien lancer. */
export type MandatOk = { id: string; titre: string; ville: string; note: number };
export async function mandatsPour(recherche: Ligne, clientId: string): Promise<{ n: number; meilleure: number; liste: MandatOk[] }> {
  const { data, error } = await supabase.from('biens_vente').select('*').eq('archive', false).eq('etape', 'mandat');
  if (error || !data) return { n: 0, meilleure: 0, liste: [] };
  const deja = await dejaDansLeDossier(recherche.id);
  const crit = criteresDepuisRecherche(recherche);
  const liste: MandatOk[] = [];
  for (const b of data as BienVente[]) {
    if (b.client_id === clientId || deja.ventes.has(b.id)) continue;
    if (!typeCompatible(b.donnees?.typeBien, recherche.type_bien)) continue;
    const bc = versCorrespondance(b);
    const c = correspondance(bc, crit);
    /* V3.45 : un critère essentiel nettement raté écarte le mandat (src/lib/ecart-acheteur.ts). */
    if (c && c.note >= 70 && !raisonEcart(c, bc, crit)) liste.push({ id: b.id, titre: b.titre || titreBien(b.donnees || {}), ville: b.ville || '', note: c.note });
  }
  liste.sort((a, b) => b.note - a.note);
  return { n: liste.length, meilleure: liste[0]?.note || 0, liste };
}

/* V3.228 : avec ce qui en a été fait (sélection, présenté le…, sa réponse),
   pour le dire au lieu de le cacher. */
async function dejaDansLeDossier(rechercheId: string): Promise<{ urls: Map<string, EtatDossier>; ventes: Map<string, EtatDossier> }> {
  let r: { data: Ligne[] | null; error: { message: string } | null } = await supabase.from('biens').select('id, url, bien_vente_id, etape, envoye_le, badge_retour, created_at').eq('recherche_id', rechercheId);
  if (r.error) r = await supabase.from('biens').select('id, url, bien_vente_id').eq('recherche_id', rechercheId);
  const urls = new Map<string, EtatDossier>(), ventes = new Map<string, EtatDossier>();
  for (const x of (r.data || []) as Ligne[]) {
    const e: EtatDossier = { etape: String(x.etape || 'selection'), envoye_le: x.envoye_le || null, badge: x.badge_retour || null, le: x.created_at || null };
    if (x.url) urls.set(String(x.url), e);
    if (x.bien_vente_id) ventes.set(String(x.bien_vente_id), e);
  }
  return { urls, ventes };
}

export async function rapprocher(recherche: Ligne, clientId: string, source: SourceRappro, periode: PeriodeVeille, o: OptionsRappro = {})
  : Promise<{ trouves: Trouve[]; compares: number; dejaLa: number; deja: Trouve[] }> {
  const crit = criteresDepuisRecherche(recherche);
  const deja = await dejaDansLeDossier(recherche.id);
  const trouves: Trouve[] = [];
  /* V3.228 : ce qui est déjà dans son dossier n'est plus seulement compté :
     il est rendu à part, avec ce qui en a été fait. */
  const dejaL: Trouve[] = [];
  let compares = 0;
  const etapes = [...(o.ventes === false ? [] : ETAPES_VENTE_RAPPRO), ...(o.estimations ? ETAPES_ESTIMATION : [])];

  if (source !== 'veilles' && etapes.length) {
    const { data, error } = await supabase.from('biens_vente').select('*').eq('archive', false).in('etape', etapes);
    if (error) throw new Error(`Les mandats n’ont pas pu être lus : ${error.message}`);
    for (const b of (data || []) as BienVente[]) {
      if (b.client_id === clientId) continue;
      compares++;
      if (!typeCompatible(b.donnees?.typeBien, recherche.type_bien)) continue;
      const bc = versCorrespondance(b);
      const corr = correspondance(bc, crit);
      if (!corr || corr.note < SEUIL_LISTE || raisonEcart(corr, bc, crit)) continue;
      const d = b.donnees || {};
      const photos = lirePhotos(d.photos).map(p => p.url).filter(Boolean);
      const t: Trouve = {
        cle: `m-${b.id}`, source: 'mandat', vente: b,
        titre: b.titre || titreBien(d), lieu: [b.quartier, b.ville].filter(Boolean).join(' · '),
        prix: b.prix, photo: photos[0] || b.photo || null, photos, url: null,
        surface: b.surface, pieces: b.nb_pieces, chambres: b.nb_chambres, corr,
        ...(ETAPES_ESTIMATION.includes(b.etape) ? { avant: true } : {}),
      };
      const dd = deja.ventes.get(b.id);
      if (dd) { dejaL.push({ ...t, dossier: dd }); continue; }
      trouves.push(t);
    }
  }

  if (source !== 'mandats') {
    let q = supabase.from('veille_propositions').select('*')
      .neq('recherche_id', recherche.id).in('statut', ['nouveau', 'retenu'])
      .order('created_at', { ascending: false }).limit(2000);
    const d = depuis(periode);
    if (d) q = q.gte('created_at', d);
    const { data, error } = await q;
    if (error) throw new Error(`Les veilles n’ont pas pu être lues : ${error.message}`);
    const props = (data || []) as Ligne[];
    /* Pour qui chaque veille l'a trouvé : le prénom du client. */
    const rIds = [...new Set(props.map(p => p.recherche_id).filter(Boolean))];
    const rs = rIds.length ? (await supabase.from('recherches').select('id, client_id').in('id', rIds)).data || [] : [];
    const cIds = [...new Set((rs as Ligne[]).map(r => r.client_id).filter(Boolean))];
    const cs = cIds.length ? (await supabase.from('clients').select('id, prenom, nom').in('id', cIds)).data || [] : [];
    const nomDe: Record<string, string> = {};
    for (const r of rs as Ligne[]) {
      const c = (cs as Ligne[]).find(x => x.id === r.client_id);
      if (c) nomDe[r.id] = [c.prenom, c.nom].filter(Boolean).join(' ');
    }
    /* Une même annonce trouvée pour plusieurs clients : une seule fois. */
    const vus = new Set<string>();
    for (const p of props) {
      const cle = String(p.url || p.yanport_id || `${p.titre}|${p.prix}|${p.ville}`);
      if (vus.has(cle)) continue;
      vus.add(cle);
      compares++;
      if (!typeAnnonceOk(p.type_bien, recherche.type_bien)) continue;
      /* V3.111 : la règle qui écarte vaut aussi pour les annonces (budget
         dépassé de plus de 10 %, ville hors de ses secteurs, trop petit, pas
         assez de chambres), comme pour vos mandats. Sans elle, une annonce
         bien trop chère sortait « en partie ». Les équipements d'une annonce
         ne sont pas sûrs (une case vide n'est pas un « non ») : le critère
         « indispensable » ne l'écarte pas. */
      const bcA = corrDepuisAnnonce(p);
      const corr = correspondance(bcA, crit);
      if (!corr || corr.note < SEUIL_LISTE || raisonEcart(corr, bcA, crit)) continue;
      const photos = (Array.isArray(p.photos) ? p.photos : []).filter((x: unknown) => typeof x === 'string' && x);
      const dd = p.url ? deja.urls.get(String(p.url)) : undefined;
      (dd ? dejaL : trouves).push({
        ...(dd ? { dossier: dd } : {}),
        /* V3.112 : une clé qui ne change pas d'une fois sur l'autre (l'adresse
           de l'annonce), pour reconnaître ce qui a déjà été vu. */
        cle: `v-${p.url || p.yanport_id || p.id}`, source: 'veille', prop: p,
        titre: p.titre || [p.type_bien, p.nb_pieces ? `${p.nb_pieces} pièces` : '', p.surface ? `${p.surface} m²` : ''].filter(Boolean).join(' · ') || 'Annonce',
        lieu: [p.quartier, p.ville].filter(Boolean).join(' · '),
        prix: nb(p.prix), photo: photos[0] || null, photos, url: p.url || null,
        surface: nb(p.surface), pieces: nb(p.nb_pieces), chambres: nb(p.nb_chambres), corr,
        pour: nomDe[p.recherche_id] || undefined, le: p.created_at,
      });
    }
  }

  trouves.sort((a, b) => b.corr.note - a.corr.note || (a.source === b.source ? 0 : a.source === 'mandat' ? -1 : 1));
  dejaL.sort((a, b) => String(b.dossier?.envoye_le || b.dossier?.le || '').localeCompare(String(a.dossier?.envoye_le || a.dossier?.le || '')));
  return { trouves, compares, dejaLa: dejaL.length, deja: dejaL };
}

/* Poser un bien trouvé dans le dossier de l'acheteur, à l'étape Sélection.
   Rend l'id de la ligne `biens`. */
export async function poserEnSelection(t: Trouve, clientId: string, rechercheId: string): Promise<string> {
  let ligne: Ligne;
  if (t.source === 'mandat' && t.vente) {
    const { data: ex } = await supabase.from('biens').select('id').eq('bien_vente_id', t.vente.id).eq('recherche_id', rechercheId).limit(1);
    if (ex?.length) return String(ex[0].id);
    ligne = {
      ...versBienAcheteur(t.vente, { clientId, rechercheId, quand: new Date().toISOString() }),
      etape: 'selection', envoye_le: null, canal_envoi: null, badge_retour: 'propose',
    };
  } else if (t.prop) {
    if (t.url) {
      const { data: ex } = await supabase.from('biens').select('id').eq('recherche_id', rechercheId).eq('url', t.url).limit(1);
      if (ex?.length) return String(ex[0].id);
    }
    ligne = bienDepuisProposition(t.prop, clientId, rechercheId);
  } else throw new Error('Bien introuvable');

  let { data, error } = await supabase.from('biens').insert(ligne).select('id').single();
  /* Comme « Retenir » (OngletVeille) : sans les colonnes récentes si la base ne les a pas encore. */
  if (error && /verdict|appreciation/i.test(error.message || '')) {
    delete ligne.verdict; delete ligne.appreciation;
    ({ data, error } = await supabase.from('biens').insert(ligne).select('id').single());
  }
  if (error || !data) throw new Error(`« ${t.titre} » n’a pas pu être ajouté : ${error?.message || 'réponse vide'}`);
  const id = String((data as Ligne).id);
  const { error: eJ } = await supabase.from('journal').insert({
    client_id: clientId, recherche_id: rechercheId, bien_id: id, type: 'rapprochement_bien',
    titre: t.source === 'mandat' ? 'Mis en sélection · un de vos mandats' : 'Mis en sélection · trouvé par une veille',
    description: `${t.titre}${t.prix ? ` · ${t.prix.toLocaleString('fr-FR')} €` : ''} · correspondance ${t.corr.note} %${t.pour ? ` · trouvé pour ${t.pour}` : ''}`,
    metadata: t.vente ? { bien_vente_id: t.vente.id } : { veille_proposition_id: t.prop?.id },
  });
  if (eJ) signalerEchec('Le bien est dans sa sélection, mais l’historique du client', eJ.message);
  return id;
}

/* V3.116 : « Le mettre dans son espace » (fenêtre de la fiche acheteur). Les
   biens que poserEnSelection vient de poser passent « Présentés » sans mail,
   comme « Dans son espace » côté bien (envoyerDansEspace) : il les voit dans
   son espace. Un bien déjà présenté n'est pas touché (son avis reste). La
   relance et la notification (suiteEnvoi) sont posées par l'appelant, une
   seule fois pour tous. */
export async function presenterDansEspace(ids: string[], clientId: string, rechercheId: string): Promise<{ n: number; erreurs: string[] }> {
  const erreurs: string[] = [];
  let n = 0;
  const quand = new Date().toISOString();
  for (const id of ids) {
    const { data, error } = await supabase.from('biens')
      .update({ etape: 'presente', envoye_le: quand, canal_envoi: 'lien', badge_retour: 'propose' })
      .eq('id', id).eq('etape', 'selection').select('id, titre, ville, prix_acquereur, prix_vendeur');
    if (error) { erreurs.push(error.message); continue; }
    if (!data?.length) continue;
    n++;
    const b = data[0] as Ligne;
    const prix = Number(b.prix_acquereur) || Number(b.prix_vendeur) || 0;
    const { error: eJ } = await supabase.from('journal').insert({
      client_id: clientId, recherche_id: rechercheId, bien_id: id, type: 'envoi_bien',
      titre: 'Présenté · dans son espace',
      description: `${String(b.titre || b.ville || 'Bien')}${prix ? ` · ${prix.toLocaleString('fr-FR')} €` : ''}`,
      metadata: {},
    });
    if (eJ) signalerEchec('Le bien est présenté, mais l’historique du client', eJ.message);
  }
  return { n, erreurs };
}

/* Le rapprochement lui-même, noté au Suivi : c'est ce qui permet de dire
   « Dernier rapprochement le 29 septembre » sur la fiche. V3.112 : avec les
   biens montrés (`vus`, leurs clés), pour ne remontrer la fois suivante que
   les nouveautés (« Seulement les nouveautés »). */
/* V3.126 — Ce que le rapprochement a proposé ce jour-là, gardé avec sa
   ligne du Suivi (Alexandre : « je clique et je vois ce qui a été fait ») :
   chaque bien, sa note de critères et, pour un mandat relu, l'avis du
   rapprochement (verdict, note de potentiel, phrase, plus, moins). */
export type LigneRappro = {
  cle: string; src: 'mandat' | 'veille'; titre: string; lieu?: string; prix?: number | null; photo?: string | null;
  bien?: string; url?: string | null; n: number;
  v?: 'oui' | 'a_voir' | 'non'; s?: number; t?: string; p?: string[]; m?: string[];
};
export async function noterRapprochement(clientId: string, rechercheId: string, n: number, source: SourceRappro, periode: PeriodeVeille, vus: string[] = [], lignes: LigneRappro[] = [], o: OptionsRappro = {}): Promise<void> {
  const biens = [o.ventes === false ? '' : 'vos mandats', o.estimations ? 'vos estimations' : ''].filter(Boolean).join(' et ');
  const ou = source === 'mandats' ? biens : source === 'veilles' ? 'les veilles' : `${biens} et les veilles`;
  const p = source === 'mandats' ? '' : ` (${PERIODES.find(x => x.k === periode)?.l.toLowerCase() || ''})`;
  const { error } = await supabase.from('journal').insert({
    client_id: clientId, recherche_id: rechercheId, type: 'rapprochement',
    titre: `Rapprochement · ${n} bien${n > 1 ? 's' : ''} trouvé${n > 1 ? 's' : ''}`,
    description: `Dans ${ou}${p}.`, metadata: { source, periode, n, vus, ...(o.estimations ? { estimations: true } : {}), ...(lignes.length ? { lignes } : {}) },
  });
  if (error) signalerEchec('Le rapprochement est fait, mais son historique', error.message);
}

/* ══ Vu depuis tes biens (V3.228) ═══════════════════════════════════════════
   Alexandre : « si depuis la fiche d'un bien on fait un rapprochement et que
   ça trouve un client, est-ce que sur sa fiche ça indique qu'il y a eu un
   rapprochement sur ce bien ? » Chaque rapprochement lancé depuis un bien
   est gardé dans l'historique du bien (`biens_vente_suivi`, type « note »,
   `donnees.rapprochement`, une ligne par recherche : r, v, s, t, p, m, n —
   RapprochementBien.tsx). On les relit ici, pour UNE recherche : le dernier
   avis par bien (pas de doublon), combien de fois il est ressorti, le bien
   tel qu'il est aujourd'hui, et « Pas pour lui » s'il a été posé.
   `historique` donne une ligne par séance où l'avis a changé : le Suivi du
   client les montre, sans rien écrire en base. */
export type AvisVu = 'oui' | 'a_voir' | 'non';
export type VuDepuisBien = {
  suivi: string; bienId: string; le: string;
  v: AvisVu; s: number | null; t: string; p: string[]; m: string[]; n: number | null;
  fois: number; bien: BienVente | null; ecarte: boolean;
};
export type LigneHistoVu = { id: string; le: string; bienId: string; titre: string; v: AvisVu; s: number | null; t: string };
const AVIS_VU: AvisVu[] = ['oui', 'a_voir', 'non'];
export async function vusDepuisBiens(rechercheId: string): Promise<{ liste: VuDepuisBien[]; historique: LigneHistoVu[]; erreur: string }> {
  const cols = 'id, bien_id, le, donnees';
  /* Les séances où cette recherche figure (jsonb @>) ; sinon toutes, triées ici. */
  let r = await supabase.from('biens_vente_suivi').select(cols).eq('type', 'note')
    .contains('donnees', { rapprochement: true, lignes: [{ r: rechercheId }] }).order('le', { ascending: false }).limit(300);
  if (r.error) r = await supabase.from('biens_vente_suivi').select(cols).eq('type', 'note')
    .contains('donnees', { rapprochement: true }).order('le', { ascending: false }).limit(600);
  if (r.error) return { liste: [], historique: [], erreur: r.error.message };
  type Seance = { id: string; bien_id: string; le: string; donnees: Ligne | null };
  const seances: { s: Seance; l: Ligne }[] = [];
  for (const s of (r.data || []) as Seance[]) {
    const lignes = Array.isArray(s.donnees?.lignes) ? (s.donnees!.lignes as Ligne[]) : [];
    const l = lignes.find(x => x && x.r === rechercheId && AVIS_VU.includes(x.v));
    if (l) seances.push({ s, l });
  }
  if (!seances.length) return { liste: [], historique: [], erreur: '' };
  const ids = [...new Set(seances.map(x => x.s.bien_id))];
  const [b, pas] = await Promise.all([
    supabase.from('biens_vente').select('*').in('id', ids),
    supabase.from('biens_vente_suivi').select('bien_id').eq('recherche_id', rechercheId).eq('type', 'note').contains('donnees', { pasPourLui: true }),
  ]);
  const biens = new Map(((b.data || []) as BienVente[]).map(x => [x.id, x] as const));
  const ecartes = new Set(((pas.data || []) as { bien_id: string }[]).map(x => x.bien_id));
  const parBien = new Map<string, VuDepuisBien>();
  for (const { s, l } of seances) {
    const deja = parBien.get(s.bien_id);
    if (deja) { deja.fois++; continue; }
    parBien.set(s.bien_id, {
      suivi: s.id, bienId: s.bien_id, le: s.le, v: l.v as AvisVu, s: typeof l.s === 'number' ? l.s : null,
      t: String(l.t || ''), p: Array.isArray(l.p) ? l.p.map(String) : [], m: Array.isArray(l.m) ? l.m.map(String) : [],
      n: typeof l.n === 'number' ? l.n : null, fois: 1, bien: biens.get(s.bien_id) || null, ecarte: ecartes.has(s.bien_id),
    });
  }
  /* Le Suivi : une ligne quand l'avis change (ou bouge d'au moins 10 points). */
  const historique: LigneHistoVu[] = [];
  const precedent = new Map<string, { v: string; s: number | null }>();
  for (const { s, l } of [...seances].reverse()) {
    const av = precedent.get(s.bien_id);
    const sc = typeof l.s === 'number' ? l.s : null;
    const change = !av || av.v !== l.v || (sc != null && av.s != null && Math.abs(sc - av.s) >= 10);
    precedent.set(s.bien_id, { v: l.v, s: sc });
    if (!change) continue;
    const bv = biens.get(s.bien_id);
    historique.push({ id: `vu-${s.id}`, le: s.le, bienId: s.bien_id, titre: bv ? bv.titre || titreBien(bv.donnees || {}) : 'Une de tes affaires', v: l.v as AvisVu, s: sc, t: String(l.t || '') });
  }
  const ordre = (v: AvisVu) => AVIS_VU.indexOf(v);
  const liste = [...parBien.values()].sort((a, c) => ordre(a.v) - ordre(c.v) || (c.s ?? 0) - (a.s ?? 0) || c.le.localeCompare(a.le));
  return { liste, historique, erreur: '' };
}

/* « Le mettre dans sa sélection », depuis « Vu depuis tes biens » : la même
   ligne que le rapprochement (poserEnSelection), le même Suivi. */
export async function poserVenteEnSelection(b: BienVente, recherche: Ligne, clientId: string): Promise<string> {
  const bc = versCorrespondance(b);
  const corr = correspondance(bc, criteresDepuisRecherche(recherche)) || { note: 0, lignes: [] };
  const d = b.donnees || {};
  const photos = lirePhotos(d.photos).map(p => p.url).filter(Boolean);
  return poserEnSelection({
    cle: `m-${b.id}`, source: 'mandat', vente: b, titre: b.titre || titreBien(d), lieu: [b.quartier, b.ville].filter(Boolean).join(' · '),
    prix: b.prix, photo: photos[0] || b.photo || null, photos, url: null, surface: b.surface, pieces: b.nb_pieces, chambres: b.nb_chambres, corr,
  }, clientId, String(recherche.id));
}
