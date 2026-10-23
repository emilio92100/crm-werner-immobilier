import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { coordonnees } from '@/lib/coordonnees-serveur';
import {
  lireReglages, calculerCandidats, mailPoint, envoyerMailjet, lienPage,
  CLE_ACTIF, CLE_DELAI, CLE_EXCLUS, CLE_POUR, DELAIS, POURS, JETON_EXEMPLE, type Pour,
} from '@/lib/point-auto';
import { basePublique } from '@/lib/jeton';

/**
 * Le point automatique, côté CRM. Protégée par le cookie du CRM (src/proxy.ts) :
 * seul Werner y arrive.
 *
 *   POST { mode: 'etat' }                       réglages + qui recevrait le mail
 *   POST { mode: 'client', client_id }          l'état pour une fiche
 *   POST { mode: 'reglages', actif?, delai?, pour? }   enregistre les réglages généraux
 *   POST { mode: 'exclure', client_id, exclu }  « ne jamais envoyer à ce client »
 *   POST { mode: 'exemple', client_id?, via? }  envoie le mail à Werner, pour voir
 *                                               (via : 'espace' ou 'page', sans espace)
 *
 * L'envoi réel aux clients, lui, ne passe que par /api/point-auto/envoi.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://crm-werner-immobilier.vercel.app';

function base() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function ecrire(sb: ReturnType<typeof base>, cle: string, valeur: string) {
  const { error } = await sb.from('parametres')
    .upsert({ cle, valeur, updated_at: new Date().toISOString() }, { onConflict: 'cle' });
  if (error) throw new Error('Enregistrement impossible : ' + error.message);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = typeof body?.mode === 'string' ? body.mode : '';
    const sb = base();

    if (mode === 'reglages') {
      if (typeof body.actif === 'boolean') await ecrire(sb, CLE_ACTIF, body.actif ? 'oui' : 'non');
      if (body.delai !== undefined) {
        const d = Number(body.delai);
        if (!(DELAIS as readonly number[]).includes(d)) return NextResponse.json({ ok: false, error: 'délai inconnu' }, { status: 400 });
        await ecrire(sb, CLE_DELAI, String(d));
      }
      if (body.pour !== undefined) {
        if (!POURS.includes(body.pour as Pour)) return NextResponse.json({ ok: false, error: 'choix inconnu' }, { status: 400 });
        await ecrire(sb, CLE_POUR, String(body.pour));
      }
      return NextResponse.json({ ok: true, reglages: await lireReglages(sb) });
    }

    if (mode === 'exclure') {
      const id = typeof body.client_id === 'string' ? body.client_id : '';
      if (!id) return NextResponse.json({ ok: false, error: 'client manquant' }, { status: 400 });
      const r = await lireReglages(sb);
      const exclus = body.exclu ? [...new Set([...r.exclus, id])] : r.exclus.filter((x) => x !== id);
      await ecrire(sb, CLE_EXCLUS, JSON.stringify(exclus));
      return NextResponse.json({ ok: true, exclu: !!body.exclu });
    }

    const reglages = await lireReglages(sb);
    const branche = {
      cron: !!process.env.CRON_SECRET,
      mailjet: !!(process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET),
    };

    if (mode === 'etat') {
      const candidats = await calculerCandidats(sb, reglages);
      return NextResponse.json({
        ok: true, reglages, branche,
        /* V3.43 : sans le lien d'espace de chaque client (l'écran ne s'en
           sert pas, et la liste entière n'a pas à circuler). */
        candidats: candidats.map(({ recherche, ...c }) => ({ ...c, tokenClient: null, rechercheNom: recherche?.nom || null })),
      });
    }

    if (mode === 'client') {
      const id = typeof body.client_id === 'string' ? body.client_id : '';
      if (!id) return NextResponse.json({ ok: false, error: 'client manquant' }, { status: 400 });
      const [c] = await calculerCandidats(sb, reglages, { clientId: id });
      if (!c) return NextResponse.json({ ok: false, error: 'client inconnu' }, { status: 404 });
      const { recherche, ...reste } = c;
      return NextResponse.json({ ok: true, reglages: { actif: reglages.actif, delai: reglages.delai, pour: reglages.pour }, branche, client: { ...reste, tokenClient: null, rechercheNom: recherche?.nom || null } });
    }

    if (mode === 'exemple') {
      /* Le mail tel qu'un client le recevrait — mais envoyé à Werner. On
         prend le client demandé, sinon le premier dossier en cours qui a une
         recherche (et un espace, pour l'exemple « avec espace »). L'exemple
         « sans espace » mène à la page de démonstration (/point/exemple) :
         rien ne s'y enregistre. */
      const id = typeof body.client_id === 'string' ? body.client_id : undefined;
      const liste = await calculerCandidats(sb, { ...reglages, exclus: [] }, id ? { clientId: id } : {});
      const via: 'espace' | 'page' = body.via === 'page' || (body.via !== 'espace' && reglages.pour === 'recherche' && !liste.some((x) => x.viaEspace && x.tokenClient))
        ? 'page' : 'espace';
      const c = via === 'espace' ? liste.find((x) => x.recherche && x.viaEspace && x.tokenClient) : liste.find((x) => x.recherche);
      if (!c) return NextResponse.json({ ok: false, error: via === 'espace' ? 'Aucun demandeur avec son espace et une recherche en cours pour construire un exemple.' : 'Aucun dossier en cours avec une recherche pour construire un exemple.' }, { status: 404 });
      const co = await coordonnees(sb);
      const m = via === 'page'
        ? mailPoint({ prenom: c.prenom, recherche: c.recherche, lienDe: (x) => lienPage(JETON_EXEMPLE, x, basePublique()), site: SITE, co })
        : mailPoint({ prenom: c.prenom, recherche: c.recherche, tokenClient: c.tokenClient!, site: SITE, co });
      const a = process.env.ALERTES_EMAIL || process.env.MAILJET_FROM_EMAIL || 'contact@wernerimmobilier.com';
      const r = await envoyerMailjet({ a, sujet: `[Exemple · ${`${c.prenom} ${c.nom}`.trim()}] ${m.sujet}`, html: m.html, texte: m.texte, id: `point-exemple-${Date.now()}` });
      if (!r.ok) return NextResponse.json({ ok: false, error: r.erreur }, { status: 502 });
      return NextResponse.json({ ok: true, a, client: `${c.prenom} ${c.nom}`.trim(), via });
    }

    return NextResponse.json({ ok: false, error: 'mode inconnu' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'erreur' }, { status: 500 });
  }
}
