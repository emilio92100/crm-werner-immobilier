import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { coordonneesAgence, coordonneesDe, type Coordonnees } from '@/lib/agence';

/* ═══ Les coordonnées de l'agence, côté serveur (23 octobre 2026) ══════════
   La source unique : Paramètres › Agence (src/lib/agence.ts, « Les
   coordonnées de l'agence »). Les routes, les mails automatiques et les
   pages publiques les lisent ici.

   Lues avec la clé de service (la base est fermée : AGENTS.md §3.4), et
   gardées 30 secondes en mémoire : un lot de mails ne relit pas la base à
   chaque message, et un changement fait dans Agence s'applique en moins
   d'une minute. Si la lecture échoue, les coordonnées d'origine : un mail
   ne doit jamais rester bloqué pour ça. */

let memo: { t: number; c: Coordonnees } | null = null;
const DUREE = 30_000;
/* Les dernières lues : pour les gabarits de mails écrits en fonctions
   simples (sans `await`). La route qui envoie appelle d'abord
   `await coordonnees()`, puis le gabarit lit `coordonneesConnues()`. */
let connues: Coordonnees = coordonneesDe(null);

/** Les coordonnées lues en dernier (celles d'origine avant la première lecture). */
export const coordonneesConnues = (): Coordonnees => connues;

function service(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && cle ? createClient(url, cle, { auth: { persistSession: false } }) : null;
}

/** Les coordonnées du jour. `sb` : un client déjà ouvert par la route (facultatif). */
export async function coordonnees(sb?: SupabaseClient | null): Promise<Coordonnees> {
  if (memo && Date.now() - memo.t < DUREE) return memo.c;
  const client = sb || service();
  if (!client) return coordonneesDe(null);
  const c = await coordonneesAgence(client);
  memo = { t: Date.now(), c };
  connues = c;
  return c;
}

/** « Répondre à » le mail de l'agence, quand il n'est pas déjà l'expéditeur. */
export const reponseAgence = (expediteur: string, co: Coordonnees): { ReplyTo?: { Email: string } } =>
  co.mail && co.mail.toLowerCase() !== String(expediteur || '').toLowerCase() ? { ReplyTo: { Email: co.mail } } : {};
