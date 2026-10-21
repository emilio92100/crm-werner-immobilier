import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { communActif, etatCommun, inscrireServeur, observerServeur, prochainServeur } from '@/lib/registre-commun';
import type { Entree, Observation } from '@/lib/registre';

/* ═══ Le registre, depuis le navigateur (22 octobre 2026) ══════════════════
   Inscrire un mandat, noter une observation, annoncer le prochain numéro :
   le serveur le fait, avec le registre commun d'Alexandre quand il est
   branché (src/lib/registre-commun.ts : sa clé ne quitte pas le serveur).
   Route du CRM : src/proxy.ts exige le badge.

     { action: 'etat' }          → { commun, prochain, depuis? } ;
     { action: 'prochain' }      → { prochain } ;
     { action: 'inscrire', e }   → { ligne } ;
     { action: 'observer', o }   → {} ou une erreur. */

export const dynamic = 'force-dynamic';
const ko = (erreur: string, status = 400) => NextResponse.json({ ok: false, erreur }, { status });
const NATURES = ['vente', 'recherche'];
const SOURCES = ['document', 'espace', 'main'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const action = String(body?.action || '');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    if (action === 'etat') {
      if (!communActif()) return NextResponse.json({ ok: true, commun: false, prochain: await prochainServeur(sb).catch(() => null) });
      try {
        const e = await etatCommun();
        return NextResponse.json({ ok: true, commun: true, prochain: e.prochain, depart: e.depart });
      } catch (e) {
        return NextResponse.json({ ok: true, commun: true, prochain: null, erreur: (e as Error).message });
      }
    }
    if (action === 'prochain') return NextResponse.json({ ok: true, prochain: await prochainServeur(sb) });

    if (action === 'inscrire') {
      const e = (body?.e && typeof body.e === 'object' ? body.e : null) as Entree | null;
      if (!e || !NATURES.includes(String(e.nature)) || (e.source && !SOURCES.includes(e.source))) return ko('Le mandat à inscrire est incomplet.');
      try {
        return NextResponse.json({ ok: true, ligne: await inscrireServeur(sb, e) });
      } catch (x) { return ko((x as Error).message, 500); }
    }

    if (action === 'observer') {
      const o = (body?.o && typeof body.o === 'object' ? body.o : null) as Observation | null;
      if (!o || !o.type || !o.texte) return ko('Observation incomplète.');
      const pb = await observerServeur(sb, o);
      return pb ? ko(pb, 500) : NextResponse.json({ ok: true });
    }

    return ko('action');
  } catch (e) {
    console.error('[registre/action]', e);
    return ko('Erreur : ' + ((e as Error)?.message || 'inconnue'), 500);
  }
}
