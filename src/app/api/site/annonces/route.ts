import { NextResponse } from 'next/server';
import { lireAnnoncesSite } from '@/lib/annonces-site';

/* ═══ Les annonces de wernerimmobilier.com (21 octobre 2026) ═══════════════
   GET /api/site/annonces → { annonces, signees, maj }
   Publique (src/proxy.ts) : ne rend que ce que src/lib/annonces-site.ts laisse
   sortir. Le site la lit côté serveur ; deux minutes de cache chez Vercel,
   dix de plus pendant qu'il recharge. */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function GET() {
  try {
    const { annonces, signees } = await lireAnnoncesSite();
    return NextResponse.json({ annonces, signees, maj: new Date().toISOString() }, {
      headers: { ...CORS, 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (e) {
    console.error('[site/annonces]', (e as Error).message);
    return NextResponse.json({ erreur: 'Les annonces n’ont pas pu être lues.' }, { status: 500, headers: CORS });
  }
}
