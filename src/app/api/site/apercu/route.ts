import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_APERCU, jetonApercu } from '@/lib/apercu-site';

/* L'accès avant-première au nouveau site (src/lib/apercu-site.ts).
   POST { code } → { ok } et le cookie, valable 90 jours. Public (src/proxy.ts) :
   le code est la serrure. Un petit délai freine les essais à la chaîne. */
export async function POST(req: NextRequest) {
  let code = '';
  try { code = String(((await req.json()) as { code?: unknown }).code ?? '').slice(0, 40); } catch { /* corps illisible */ }
  const jeton = await jetonApercu(code);
  if (!jeton) {
    await new Promise(r => setTimeout(r, 900));
    return NextResponse.json({ ok: false, erreur: 'Code incorrect.' }, { status: 401 });
  }
  const r = NextResponse.json({ ok: true });
  r.cookies.set(COOKIE_APERCU, jeton, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90 });
  return r;
}
