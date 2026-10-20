import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_BADGE, badgeValide } from '@/lib/badge';
import { codesSeLoger, deposerSeLoger, environnementSeLoger, lireEtatSeLoger, preparerSeLoger, statutsSeLoger } from '@/lib/seloger-serveur';

/* ═══ Envoyer les annonces aux portails (V3.98 : SeLoger ; Jinka retiré pour Werner) ══
   POST (le CRM, derrière le badge) → { jinka, seloger }
     Le CRM l'appelle quand quelque chose change (components/layout/
     EnvoiPortails.tsx) : Jinka ne reçoit un nouveau fichier que s'il a
     changé ; SeLoger ne reçoit que les annonces qui ont changé.
     { forcer: true } renvoie tout, même sans changement.
   GET avec l'en-tête du cron de Vercel (CRON_SECRET) → la nuit, par
     sécurité : le fichier complet chez Jinka, et les écarts chez SeLoger.
   GET derrière le badge → l'état des deux, et ce que contiendrait le
     prochain envoi ;
       `?fichier=csv`      Annonces.csv de Jinka, à télécharger ;
       `?seloger=annonces` les annonces SeLoger telles qu'envoyées (JSON) ;
       `?seloger=statuts`  où en est chaque annonce chez SeLoger.

   Publique dans src/proxy.ts (le cron de Vercel n'a pas le cookie du CRM) :
   la serrure est ici, le badge ou CRON_SECRET. */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const parCron = (req: NextRequest) => {
  const s = process.env.CRON_SECRET;
  return !!s && req.headers.get('authorization') === `Bearer ${s}`;
};
const parBadge = (req: NextRequest) => badgeValide(req.cookies.get(COOKIE_BADGE)?.value);

/* Werner : SeLoger seulement (Jinka était propre au CRM d'origine). Sans les
   codes SeLoger sur Vercel, rien ne part : le CRM ne doit surtout pas
   republier les annonces que Werner a déjà en ligne (voir context.md §7). */
async function envoyer(forcerSeLoger: boolean) {
  if (!codesSeLoger()) return { ok: true, seloger: { ok: true, envoi: 'non branché' } };
  const seloger = await deposerSeLoger({ forcer: forcerSeLoger }).catch(e => ({ ok: false, erreur: (e as Error).message, env: environnementSeLoger(), annonces: 0, crees: 0, modifies: 0, retires: 0, erreurs: [], avertissements: [] }));
  if (!seloger.ok) console.error('[portails] SeLoger :', 'erreur' in seloger ? seloger.erreur : 'échec');
  return { ok: seloger.ok, seloger };
}

export async function POST(req: NextRequest) {
  if (!(await parBadge(req))) return NextResponse.json({ ok: false, erreur: 'non_autorise' }, { status: 401 });
  let forcer = false;
  try { forcer = !!((await req.json()) as { forcer?: unknown }).forcer; } catch { /* corps vide */ }
  return NextResponse.json(await envoyer(forcer));
}

export async function GET(req: NextRequest) {
  /* La nuit : SeLoger, seulement ce qui a changé — le renvoyer en entier
     chaque nuit ne servirait à rien. */
  if (parCron(req)) return NextResponse.json(await envoyer(false));
  if (!(await parBadge(req))) return NextResponse.json({ ok: false, erreur: 'non_autorise' }, { status: 401 });

  const q = req.nextUrl.searchParams;
  if (q.get('seloger') === 'annonces') {
    const lot = await preparerSeLoger();
    return NextResponse.json({ ok: true, env: environnementSeLoger(), annonces: lot.annonces, avertissements: lot.avertissements });
  }
  if (q.get('seloger') === 'statuts') return NextResponse.json(await statutsSeLoger());

  const [lot, etatSL] = await Promise.all([preparerSeLoger(), lireEtatSeLoger()]);
  return NextResponse.json({
    ok: true,
    seloger: {
      codes: codesSeLoger(), env: environnementSeLoger(),
      annonces: lot.annonces.length,
      aEnvoyer: lot.annonces.filter(x => etatSL.annonces[x.id]?.empreinte !== lot.empreintes.get(x.id)).length,
      enLigne: Object.keys(etatSL.annonces).length,
      avertissements: lot.avertissements,
      biens: lot.annonces.map(x => ({ id: x.bienId, reference: x.reference, seloger: x.id, portails: x.portails, classifiedId: etatSL.annonces[x.id]?.classifiedId || null })),
      dernier: etatSL.dernier || null,
    },
  });
}
