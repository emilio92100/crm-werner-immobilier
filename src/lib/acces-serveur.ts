/* ═══ Le premier accès et le mot de passe oublié (22 octobre 2026) ═══════════
   Alexandre : « qu'il puisse créer sa première connexion, son mot de passe,
   et s'il fait mot de passe oublié, un joli mail pour le réinitialiser ».

   Les inscriptions Supabase restent FERMÉES (AGENTS.md §3.4 : le RLS donne
   tout à tout compte connecté). Le seul compte qu'on peut créer d'ici est
   celui de l'adresse attribuée à Werner (`WERNER_MAIL_COMPTE`, par défaut
   contact@wernerimmobilier.com), et seulement :
     · tant qu'aucun compte n'existe à cette adresse ;
     · avec le code à six chiffres envoyé à cette adresse (preuve que c'est
       bien lui qui lit cette boîte), valable 15 minutes, 5 essais.

   Le mot de passe oublié ne passe pas par les mails de Supabase (réservés à
   l'équipe du projet, et en anglais) : le serveur fabrique le jeton de
   récupération (`auth.admin.generateLink`) et l'envoie par Mailjet, avec le
   gabarit de Werner. La page /mot-de-passe le vérifie (`verifyOtp`) au moment
   où le nouveau mot de passe est enregistré, pas à l'ouverture : les
   antivirus de messagerie qui ouvrent les liens ne le consomment pas.

   L'état (le code, les envois récents) vit dans `parametres`, écrit avec la
   clé de service ; le code n'y est que sous forme d'empreinte signée. */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { envoyerMail, gabarit, echappe, CRM } from '@/lib/mandat-serveur';
import { MAIL } from '@/lib/mail-charte';

export const MAIL_COMPTE = () => (process.env.WERNER_MAIL_COMPTE || 'contact@wernerimmobilier.com').trim().toLowerCase();
export const MDP_MIN = 8;

const CLE_CODE = 'acces_premier_code';
const CLE_ENVOIS = 'acces_envois';
const DUREE_CODE = 15 * 60 * 1000;
const ESSAIS = 5;
const HEURE = 3600 * 1000;
/* Combien de mails par adresse et par heure (codes et liens confondus). */
const ENVOIS_PAR_HEURE = 4;

export function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  return createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function lire<T>(sb: SupabaseClient, cle: string): Promise<T | null> {
  const { data, error } = await sb.from('parametres').select('valeur').eq('cle', cle).maybeSingle();
  if (error) throw new Error(`lecture de ${cle} : ${error.message}`);
  try { return data?.valeur ? JSON.parse(String(data.valeur)) as T : null; } catch { return null; }
}
async function ecrire(sb: SupabaseClient, cle: string, v: unknown): Promise<void> {
  const { error } = await sb.from('parametres').upsert({ cle, valeur: v === null ? '' : JSON.stringify(v), updated_at: new Date().toISOString() }, { onConflict: 'cle' });
  if (error) throw new Error(`écriture de ${cle} : ${error.message}`);
}

/* Un compte existe-t-il à cette adresse ? (Peu de comptes : une page suffit.) */
export async function compteExiste(sb: SupabaseClient, mail: string): Promise<boolean> {
  const m = mail.trim().toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`lecture des comptes : ${error.message}`);
    const l = data?.users || [];
    if (l.some(u => (u.email || '').toLowerCase() === m)) return true;
    if (l.length < 200) return false;
  }
  return false;
}

/* Les envois récents d'une adresse : refuse au-delà de ENVOIS_PAR_HEURE. */
async function compterEnvoi(sb: SupabaseClient, mail: string): Promise<boolean> {
  const tous = (await lire<Record<string, number[]>>(sb, CLE_ENVOIS)) || {};
  const maintenant = Date.now();
  const propres: Record<string, number[]> = {};
  for (const [k, l] of Object.entries(tous)) {
    const r = (Array.isArray(l) ? l : []).filter(t => typeof t === 'number' && maintenant - t < HEURE);
    if (r.length) propres[k] = r;
  }
  const m = mail.toLowerCase();
  if ((propres[m] || []).length >= ENVOIS_PAR_HEURE) { await ecrire(sb, CLE_ENVOIS, propres); return false; }
  propres[m] = [...(propres[m] || []), maintenant];
  await ecrire(sb, CLE_ENVOIS, propres);
  return true;
}

const secret = () => `acces|${process.env.WERNER_ACCESS_CODE || process.env.EMILIO_ACCESS_CODE || ''}|${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`;
const empreinte = (code: string) => createHmac('sha256', secret()).update(code).digest('hex');
const pareil = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

type EtatCode = { mail: string; empreinte: string; expire: number; essais: number };

/* Un bouton orange, en tableau (Gmail retire beaucoup de styles). */
function bouton(lien: string, texte: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px;"><tr><td style="background:${MAIL.or};border-radius:12px;">
  <a href="${echappe(lien)}" style="display:inline-block;padding:13px 22px;color:#232528;font-weight:800;font-size:15px;text-decoration:none;">${echappe(texte)}</a>
</td></tr></table>`;
}

/* ── Les deux mails, à part : le banc d'essai les regarde tels quels ── */
export function mailCode(prenom: string, code: string): { sujet: string; html: string; texte: string } {
  const p = prenom.trim();
  const lisible = `${code.slice(0, 3)} ${code.slice(3)}`;
  const html = gabarit('Votre code pour créer votre accès', `
    <p style="margin:0 0 12px;">Bonjour${p ? ` ${echappe(p)}` : ''},</p>
    <p style="margin:0 0 12px;">Voici le code pour créer votre accès au CRM de Werner Immobilier :</p>
    <div style="margin:16px 0;padding:16px;border-radius:14px;background:${MAIL.orFond};border:1px solid ${MAIL.orTrait};text-align:center;font-size:30px;font-weight:800;letter-spacing:6px;color:${MAIL.encre};">${lisible}</div>
    <p style="margin:0 0 8px;">Il est valable 15 minutes. Tapez-le sur la page ouverte, puis choisissez votre mot de passe.</p>
    <p style="margin:0;color:${MAIL.plume};font-size:13px;">Vous n’avez rien demandé ? Ignorez ce mail : sans ce code, personne ne peut créer l’accès.</p>`);
  const texte = `Bonjour${p ? ` ${p}` : ''},\n\nVoici le code pour créer votre accès au CRM de Werner Immobilier : ${lisible}\nIl est valable 15 minutes.\n\nVous n’avez rien demandé ? Ignorez ce mail : sans ce code, personne ne peut créer l’accès.`;
  return { sujet: `Votre code d’accès : ${lisible}`, html, texte };
}
export function mailOubli(prenom: string, lien: string): { sujet: string; html: string; texte: string } {
  const html = gabarit('Réinitialiser votre mot de passe', `
    <p style="margin:0 0 12px;">Bonjour${prenom ? ` ${echappe(prenom)}` : ''},</p>
    <p style="margin:0 0 4px;">Vous avez demandé à changer le mot de passe de votre CRM Werner Immobilier. Cliquez sur le bouton, puis choisissez le nouveau :</p>
    ${bouton(lien, 'Choisir un nouveau mot de passe')}
    <p style="margin:10px 0 8px;font-size:13px;color:${MAIL.plume};">Le lien est valable une heure, et ne sert qu’une fois. S’il ne s’ouvre pas, copiez cette adresse dans votre navigateur :<br /><span style="word-break:break-all;color:${MAIL.orTexte};">${echappe(lien)}</span></p>
    <p style="margin:0;color:${MAIL.plume};font-size:13px;">Vous n’avez rien demandé ? Ignorez ce mail : votre mot de passe actuel reste valable.</p>`);
  const texte = `Bonjour${prenom ? ` ${prenom}` : ''},\n\nVous avez demandé à changer le mot de passe de votre CRM Werner Immobilier. Ouvrez ce lien, puis choisissez le nouveau :\n${lien}\n\nLe lien est valable une heure, et ne sert qu’une fois.\nVous n’avez rien demandé ? Ignorez ce mail : votre mot de passe actuel reste valable.`;
  return { sujet: 'Réinitialiser votre mot de passe', html, texte };
}

/* ── Premier accès : l'état, le code, la création ── */

export async function etatPremierAcces(sb: SupabaseClient): Promise<{ ouvert: boolean; mail: string }> {
  const mail = MAIL_COMPTE();
  return { ouvert: !(await compteExiste(sb, mail)), mail };
}

export type Reponse = { ok: true; [k: string]: unknown } | { ok: false; error: string; code?: string };

export async function envoyerCodePremierAcces(sb: SupabaseClient, prenom: string): Promise<Reponse> {
  const mail = MAIL_COMPTE();
  if (await compteExiste(sb, mail)) return { ok: false, code: 'existe', error: 'Votre accès est déjà créé : connectez-vous avec votre mot de passe, ou utilisez « Mot de passe oublié ».' };
  if (!(await compterEnvoi(sb, mail))) return { ok: false, error: 'Plusieurs codes sont déjà partis cette heure-ci : regardez dans votre boîte (et dans les courriers indésirables), ou réessayez dans une heure.' };
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const etat: EtatCode = { mail, empreinte: empreinte(code), expire: Date.now() + DUREE_CODE, essais: 0 };
  await ecrire(sb, CLE_CODE, etat);
  const m = mailCode(prenom, code);
  const err = await envoyerMail({ a: mail, sujet: m.sujet, texte: m.texte, html: m.html, deLaPartDe: 'agence' });
  if (err) return { ok: false, error: err === 'Mailjet non configuré' ? 'L’envoi des mails n’est pas encore branché sur le serveur : demandez à Alexandre de créer votre accès.' : `Le code n’a pas pu partir (${err}). Réessayez dans un instant.` };
  return { ok: true, mail };
}

/* Vérifie le code ; un essai raté compte. `consommer` : l'effacer (création faite). */
export async function verifierCode(sb: SupabaseClient, code: string): Promise<Reponse> {
  const etat = await lire<EtatCode>(sb, CLE_CODE);
  const propre = String(code || '').replace(/\D/g, '');
  if (!etat || !etat.empreinte || etat.mail !== MAIL_COMPTE()) return { ok: false, code: 'aucun', error: 'Aucun code en cours : demandez-en un nouveau.' };
  if (Date.now() > etat.expire) return { ok: false, code: 'expire', error: 'Ce code a expiré (15 minutes) : demandez-en un nouveau.' };
  if (etat.essais >= ESSAIS) return { ok: false, code: 'bloque', error: 'Trop d’essais avec ce code : demandez-en un nouveau.' };
  if (propre.length !== 6 || !pareil(empreinte(propre), etat.empreinte)) {
    await ecrire(sb, CLE_CODE, { ...etat, essais: etat.essais + 1 });
    const reste = ESSAIS - etat.essais - 1;
    return { ok: false, code: 'faux', error: reste > 0 ? `Ce n’est pas le bon code. Encore ${reste} essai${reste > 1 ? 's' : ''}.` : 'Ce n’est pas le bon code, et c’était le dernier essai : demandez-en un nouveau.' };
  }
  return { ok: true };
}

export async function creerCompte(sb: SupabaseClient, o: { code: string; motDePasse: string; prenom: string; nom: string }): Promise<Reponse> {
  const mail = MAIL_COMPTE();
  if (String(o.motDePasse || '').length < MDP_MIN) return { ok: false, error: `Le mot de passe doit faire ${MDP_MIN} caractères au moins.` };
  const v = await verifierCode(sb, o.code);
  if (!v.ok) return v;
  if (await compteExiste(sb, mail)) return { ok: false, code: 'existe', error: 'Votre accès est déjà créé : connectez-vous avec votre mot de passe.' };
  const prenom = o.prenom.trim().slice(0, 60), nom = o.nom.trim().slice(0, 80);
  const { error } = await sb.auth.admin.createUser({ email: mail, password: o.motDePasse, email_confirm: true, user_metadata: { prenom, nom } });
  if (error) {
    const m = error.message || '';
    return { ok: false, error: /weak|short|characters|password/i.test(m) ? `Ce mot de passe est refusé, trop simple : allongez-le, mélangez lettres et chiffres. (${m})` : `Le compte n’a pas pu être créé : ${m}.` };
  }
  await ecrire(sb, CLE_CODE, null);
  /* Ses prénom et nom signent ses mails, s'ils n'y sont pas encore
     (Paramètres › Templates email). Un échec ici ne défait pas le compte. */
  try {
    const { data } = await sb.from('parametres').select('cle, valeur').in('cle', ['conseiller_prenom', 'conseiller_nom']);
    const deja = new Map((data || []).map((r: { cle: string; valeur: string | null }) => [r.cle, (r.valeur || '').trim()]));
    const a = [['conseiller_prenom', prenom], ['conseiller_nom', nom]].filter(([k, x]) => x && !deja.get(k));
    if (a.length) await sb.from('parametres').upsert(a.map(([cle, valeur]) => ({ cle, valeur, updated_at: new Date().toISOString() })), { onConflict: 'cle' });
  } catch { /* le compte est créé : c'est l'essentiel */ }
  return { ok: true, mail };
}

/* ── Mot de passe oublié ──
   Répond toujours la même chose (on ne dit pas si une adresse a un compte). */
export async function envoyerLienOubli(sb: SupabaseClient, mailBrut: string, base: string): Promise<Reponse> {
  const mail = mailBrut.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { ok: false, error: 'Cette adresse mail n’est pas valide.' };
  if (!(await compteExiste(sb, mail))) return { ok: true };
  if (!(await compterEnvoi(sb, mail))) return { ok: false, error: 'Plusieurs liens sont déjà partis cette heure-ci : regardez dans votre boîte (et dans les courriers indésirables), ou réessayez dans une heure.' };
  const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email: mail });
  const jeton = data?.properties?.hashed_token;
  if (error || !jeton) return { ok: false, error: `Le lien n’a pas pu être préparé (${error?.message || 'rien n’est revenu'}). Réessayez dans un instant.` };
  const prenom = String((data.user?.user_metadata as { prenom?: unknown } | undefined)?.prenom || '').trim();
  const lien = `${base}/mot-de-passe?jeton=${encodeURIComponent(jeton)}`;
  const m = mailOubli(prenom, lien);
  const err = await envoyerMail({ a: mail, sujet: m.sujet, texte: m.texte, html: m.html, deLaPartDe: 'agence' });
  if (err) return { ok: false, error: err === 'Mailjet non configuré' ? 'L’envoi des mails n’est pas encore branché sur le serveur : prévenez Alexandre.' : `Le mail n’a pas pu partir (${err}). Réessayez dans un instant.` };
  return { ok: true };
}

/* L'adresse du CRM pour les liens envoyés : celle de la demande si c'est une
   adresse connue du CRM (jamais un nom d'hôte inventé par un tiers), sinon
   l'adresse réglée. */
export function baseLiens(hote: string | null): string {
  const h = (hote || '').toLowerCase().split(':')[0];
  const connus = ['crm.wernerimmobilier.com', 'crm-werner-immobilier.vercel.app'];
  return connus.includes(h) ? `https://${h}` : CRM().replace(/\/+$/, '');
}
