import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { envoyerAdresseReco, type DocReco } from '@/lib/reconnaissance-serveur';

/* ═══ « Lui envoyer l'adresse » (Werner, 21 octobre 2026) ══════════════════
   Une reconnaissance d'information signée, quand Werner a choisi de donner
   l'adresse lui-même : un clic sur la fiche de l'affaire, et elle part par
   e-mail au client qui a signé (src/lib/reconnaissance-serveur.ts). Seulement
   une fois la reconnaissance signée. Route du CRM : src/proxy.ts exige le
   badge (elle n'est pas dans les chemins publics). */

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ko = (erreur: string, status = 400) => NextResponse.json({ ok: false, erreur }, { status });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    if (!UUID.test(id)) return ko('Document introuvable.');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await sb.from('documents').select('id, modele, statut, titre, client_id, donnees').eq('id', id).maybeSingle();
    if (error) return ko('Le document n’a pas pu être lu : ' + error.message, 500);
    const doc = data as DocReco | null;
    if (!doc) return ko('Document introuvable.', 404);
    if (doc.modele !== 'reconnaissance') return ko('Ce document n’est pas une reconnaissance d’information.');
    if (doc.statut !== 'signe') return ko('La reconnaissance n’est pas encore signée : l’adresse part une fois qu’il l’a signée.', 409);
    const pb = await envoyerAdresseReco(sb, doc, { auto: false });
    /* Parti mais pas noté : on le dit, sans faire croire que rien n'est parti. */
    if (pb && pb.startsWith('l’adresse est partie')) return NextResponse.json({ ok: true, avertissement: pb.charAt(0).toUpperCase() + pb.slice(1) });
    if (pb) return ko(pb.charAt(0).toUpperCase() + pb.slice(1), 502);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[documents/adresse]', e);
    return ko('Erreur : ' + ((e as Error)?.message || 'inconnue'), 500);
  }
}
