import { NextRequest, NextResponse } from 'next/server';
import { admin, baseLiens, creerCompte, envoyerCodePremierAcces, envoyerLienOubli, etatPremierAcces, verifierCode } from '@/lib/acces-serveur';

/* ═══ /api/acces/… — le premier accès et le mot de passe oublié ═══════════════
   Route publique (src/proxy.ts, PUBLIC_PREFIXES) : on y vient sans être
   connecté. Tout ce qu'elle permet est décrit et borné dans
   src/lib/acces-serveur.ts : ne créer que le compte de l'adresse attribuée,
   une fois, avec le code reçu à cette adresse ; envoyer un lien de
   récupération à une adresse qui a déjà un compte, quelques fois par heure.

   GET  etat      → { ouvert, mail } : le premier accès est-il encore possible ?
   POST code      { prenom }                       → envoie le code
   POST verifier  { code }                         → le code est-il bon ?
   POST creer     { code, motDePasse, prenom, nom } → crée le compte
   POST oubli     { mail }                         → envoie le lien */

export const dynamic = 'force-dynamic';

const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });

/* Une demande venue d'une autre page que le CRM est refusée. */
function autreOrigine(req: NextRequest): boolean {
  const o = req.headers.get('origin');
  if (!o) return false;
  try { return new URL(o).host.toLowerCase() !== (req.headers.get('host') || '').toLowerCase(); } catch { return true; }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== 'etat') return json({ ok: false, error: 'Inconnu.' }, 404);
  const sb = admin();
  if (!sb) return json({ ok: true, ouvert: false, mail: '' });
  try {
    return json({ ok: true, ...(await etatPremierAcces(sb)) });
  } catch {
    return json({ ok: true, ouvert: false, mail: '' });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (autreOrigine(req)) return json({ ok: false, error: 'Origine refusée.' }, 403);
  const sb = admin();
  if (!sb) return json({ ok: false, error: 'La connexion n’est pas encore configurée sur le serveur (clés Supabase sur Vercel).' }, 500);
  let corps: Record<string, unknown> = {};
  try { corps = (await req.json()) || {}; } catch { return json({ ok: false, error: 'Requête invalide.' }, 400); }
  const t = (k: string) => (typeof corps[k] === 'string' ? String(corps[k]) : '');
  try {
    if (action === 'code') {
      const r = await envoyerCodePremierAcces(sb, t('prenom'));
      return json(r, r.ok ? 200 : r.code === 'existe' ? 409 : 400);
    }
    if (action === 'verifier') {
      const r = await verifierCode(sb, t('code'));
      return json(r, r.ok ? 200 : 400);
    }
    if (action === 'creer') {
      if (!t('prenom').trim() || !t('nom').trim()) return json({ ok: false, error: 'Votre prénom et votre nom, s’il vous plaît.' }, 400);
      const r = await creerCompte(sb, { code: t('code'), motDePasse: t('motDePasse'), prenom: t('prenom'), nom: t('nom') });
      return json(r, r.ok ? 200 : r.code === 'existe' ? 409 : 400);
    }
    if (action === 'oubli') {
      const r = await envoyerLienOubli(sb, t('mail'), baseLiens(req.headers.get('host')));
      return json(r, r.ok ? 200 : 400);
    }
    return json({ ok: false, error: 'Inconnu.' }, 404);
  } catch (e) {
    return json({ ok: false, error: `Le serveur n’a pas pu répondre (${e instanceof Error ? e.message : 'erreur'}). Réessayez dans un instant.` }, 500);
  }
}
