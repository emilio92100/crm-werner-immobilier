/* ═══ Le registre commun avec le CRM d'Emilio (22 octobre 2026) ═══════════
   Alexandre : « comme il travaille avec ma carte T, quand il fait un mandat,
   il faut que ça arrive dans mon registre, en numéro, comme si moi je
   l'avais fait ; quand moi je fais un mandat, et lui juste après, le numéro
   d'après ».

   Le registre des mandats de RT CONSEILS est tenu dans le CRM d'Emilio
   Immobilier (dépôt emilio92100/emilio-immo-chasseimmo). Quand il est
   branché (`REGISTRE_COMMUN_CLE`, la même clé dans les deux projets Vercel),
   un mandat de Werner prend son numéro LÀ-BAS (/api/registre/commun, sous
   le même verrou que ceux d'Alexandre), puis s'inscrit ICI avec ce même
   numéro : la copie locale (outils/sql/registre-commun.sql) garde tout ce
   que le CRM de Werner lit déjà (Documents, l'espace, la page Registre). Ce
   qui arrive ensuite (signé, annulé…) s'écrit ici, puis là-bas.

   Sans clé : le registre de Werner marche comme avant, seul (et tant qu'il
   n'est pas démarré, le numéro se saisit à la main).

   Côté serveur seulement : la clé ne quitte jamais le serveur. Le navigateur
   passe par /api/registre/action (src/lib/registre.ts). */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entree, LigneRegistre, Observation } from './registre';

const URL_COMMUN = () => (process.env.REGISTRE_COMMUN_URL || 'https://crm.emilio-immo.com').replace(/\/+$/, '');
const CLE = () => process.env.REGISTRE_COMMUN_CLE || '';
/** Le registre commun est-il branché ? */
export const communActif = () => CLE().length >= 32;

const CODES_ABSENT = ['PGRST202', 'PGRST205', '42P01', '42883'];
const absent = (e: { message: string; code?: string }) => CODES_ABSENT.includes(e.code || '') || /does not exist|in the schema cache|Could not find the (function|table)/i.test(e.message);
const FINS = ['signe', 'sans_suite', 'retracte', 'annule', 'fin'];

/* Un appel au CRM d'Emilio. Lève une erreur en mots simples. */
async function appel<T>(action: string, corps: Record<string, unknown> = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${URL_COMMUN()}/api/registre/commun`, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-registre-cle': CLE() },
      body: JSON.stringify({ action, ...corps }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new Error(`Le registre d’Alexandre ne répond pas (${(e as Error)?.message || 'réseau'}) : réessaie dans un instant. Aucun numéro n’a été pris.`);
  }
  const j = await r.json().catch(() => null) as (Record<string, unknown> & { ok?: boolean; erreur?: string }) | null;
  if (r.status === 401) throw new Error('Le registre d’Alexandre refuse la clé : REGISTRE_COMMUN_CLE doit être la même dans les deux projets Vercel.');
  if (!r.ok || !j?.ok) throw new Error(`Le registre d’Alexandre : ${j?.erreur || `erreur ${r.status}`}`);
  return j as T;
}

/** Le départ du registre commun et son prochain numéro. */
export async function etatCommun(): Promise<{ depart: { premier_numero: number; demarre_le: string; reprise: string | null } | null; prochain: number | null }> {
  return appel('etat');
}

/* La ligne déjà inscrite ici pour ce mandat (le même ordre que
   registre_inscrire) : on ne redemande pas de numéro. */
async function ligneLocale(sb: SupabaseClient, e: Entree): Promise<LigneRegistre | null> {
  const une = async (col: 'document_id' | 'signature_id', v: string | null | undefined) => {
    if (!v) return null;
    const { data, error } = await sb.from('registre_mandats').select('*').eq(col, v).order('numero').limit(1).maybeSingle();
    if (error) throw new Error('Le registre n’a pas pu être relu : ' + error.message);
    return (data as LigneRegistre | null) || null;
  };
  const l = (await une('document_id', e.document_id)) || (await une('signature_id', e.signature_id));
  if (l) return l;
  if (e.source === 'espace' && e.recherche_id) {
    const { data, error } = await sb.from('registre_mandats').select('*').eq('recherche_id', e.recherche_id).eq('source', 'espace').order('numero', { ascending: false }).limit(5);
    if (error) throw new Error('Le registre n’a pas pu être relu : ' + error.message);
    for (const x of (data || []) as LigneRegistre[]) {
      const { data: o } = await sb.from('registre_observations').select('type').eq('registre_id', x.id).in('type', FINS).limit(1);
      if (!o?.length) return x;
    }
  }
  return null;
}

/** Inscrire, côté serveur : le numéro chez Alexandre, puis la copie ici. */
export async function inscrireServeur(sb: SupabaseClient, e: Entree): Promise<LigneRegistre> {
  if (communActif()) {
    const deja = await ligneLocale(sb, e);
    if (deja) return deja;
    /* La copie doit pouvoir s'écrire AVANT qu'un numéro soit pris là-bas. */
    const { data: dep, error: eDep } = await sb.from('registre_depart').select('id').eq('id', 1).maybeSingle();
    if (eDep || !dep) throw new Error('Le registre de Werner n’est pas encore prêt pour le registre commun (outils/sql/registre-commun.sql). Aucun numéro n’a été pris.');
    const r = await appel<{ ligne: { numero: number } }>('inscrire', { p: { ...e, espace: e.source === 'espace' } });
    const numero = Number(r.ligne?.numero);
    if (!Number.isInteger(numero) || numero < 1) throw new Error('Le registre d’Alexandre n’a pas rendu de numéro.');
    const { data, error } = await sb.rpc('registre_inscrire', { p: { ...e, numero } });
    if (error) throw new Error(`Le n° ${numero} est pris dans le registre d’Alexandre, mais sa copie ici n’a pas pu s’écrire (${error.message}). Réessaie : le même numéro reviendra.`);
    const l = (Array.isArray(data) ? data[0] : data) as LigneRegistre | null;
    if (!l?.numero) throw new Error('Le registre n’a pas pu donner de numéro.');
    return l;
  }
  const { data, error } = await sb.rpc('registre_inscrire', { p: e });
  if (error) throw new Error('Le registre n’a pas pu donner de numéro : ' + error.message);
  const l = (Array.isArray(data) ? data[0] : data) as LigneRegistre | null;
  if (!l?.numero) throw new Error('Le registre n’a pas pu donner de numéro.');
  return l;
}

/** Une observation, côté serveur : ici, puis chez Alexandre (sur la même
    ligne, retrouvée par son numéro). Rend un message d'erreur, ou null. */
export async function observerServeur(sb: SupabaseClient, o: Observation): Promise<string | null> {
  const { numeroSinon, ...reste } = o;
  const p = { ...reste, numero: o.numero === undefined ? undefined : String(o.numero) };
  let { data, error } = await sb.rpc('registre_observer', { p });
  if (error) return absent(error) ? null : 'Le registre des mandats n’a pas pu noter : ' + error.message;
  if (!data && numeroSinon !== undefined && numeroSinon !== null && numeroSinon !== '') {
    ({ data, error } = await sb.rpc('registre_observer', { p: { type: o.type, texte: o.texte, document_id: o.document_id, numero: String(numeroSinon) } }));
    if (error) return absent(error) ? null : 'Le registre des mandats n’a pas pu noter : ' + error.message;
  }
  const obs = (Array.isArray(data) ? data[0] : data) as { registre_id?: string; type?: string; texte?: string; document_id?: string | null } | null;
  if (!obs?.registre_id || !communActif()) return null;
  const { data: l, error: eL } = await sb.from('registre_mandats').select('numero').eq('id', obs.registre_id).maybeSingle();
  if (eL || !l) return 'L’observation est notée ici, mais sa ligne n’a pas pu être relue pour le registre d’Alexandre' + (eL ? ` (${eL.message})` : '') + '.';
  try {
    await appel('observer', { numero: (l as { numero: number }).numero, type: obs.type, texte: obs.texte, document_id: obs.document_id || null });
    return null;
  } catch (e) {
    return `Noté dans le registre de Werner, mais pas dans celui d’Alexandre : ${(e as Error).message}`;
  }
}

/** Le prochain numéro, pour l'annoncer : celui du registre commun s'il est branché. */
export async function prochainServeur(sb: SupabaseClient): Promise<number | null> {
  if (communActif()) return (await etatCommun()).prochain;
  const { data: d } = await sb.from('registre_depart').select('premier_numero').eq('id', 1).maybeSingle();
  if (!d) return null;
  const { data } = await sb.from('registre_mandats').select('numero').order('numero', { ascending: false }).limit(1).maybeSingle();
  return data ? Number((data as { numero: number }).numero) + 1 : Number((d as { premier_numero: number }).premier_numero);
}
