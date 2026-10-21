import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TABLE_DEMANDES, type CategorieDemande } from '@/lib/demandes-site';
import { annoncerDemandes } from '@/lib/demandes-annonce';

/* ═══ Les formulaires de wernerimmobilier.com (21 octobre 2026) ════════════
   POST /api/site/demande — le site (dépôt werner-immobilier-site) y envoie
   chaque formulaire, depuis son serveur. La demande est déposée dans
   `contact_submissions` avec la clé de service (la base reste fermée à la clé
   publique), dans sa catégorie, puis annoncée par mail comme les autres
   (src/lib/demandes-annonce.ts). Publique (src/proxy.ts) : tout est vérifié
   ici, longueurs comprises.

   Les réponses arrivent en « Clé : valeur », une par ligne, dans le message :
   c'est ce que la rubrique « Demandes Internet » sait ranger en rubriques
   (src/lib/demandes-site.ts, presenter). */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CATEGORIES_SITE: CategorieDemande[] = ['estimation', 'mandat_recherche', 'rappel_bien', 'contact', 'investisseur', 'apporteur'];
const COLONNES = ['budget', 'property_type', 'desired_location', 'desired_surface', 'timeline', 'property_ref', 'property_title'] as const;

const ORIGINES = ['https://wernerimmobilier.com', 'https://www.wernerimmobilier.com'];
const cors = (origine: string | null) => ({
  'Access-Control-Allow-Origin': origine && (ORIGINES.includes(origine) || /^https:\/\/werner-immobilier-site[-a-z0-9]*\.vercel\.app$/.test(origine)) ? origine : ORIGINES[1],
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

export function OPTIONS(req: Request) {
  return new NextResponse(null, { headers: cors(req.headers.get('origin')) });
}

const ligne = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
const bloc = (v: unknown, max: number) => String(v ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

export async function POST(req: Request) {
  const h = cors(req.headers.get('origin'));
  const refus = (erreur: string, status = 400) => NextResponse.json({ ok: false, erreur }, { status, headers: h });

  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return refus('Demande illisible.'); }
  if (!corps || typeof corps !== 'object') return refus('Demande illisible.');

  /* Le piège à robots : un champ caché qu'un humain ne remplit jamais. On
     répond « reçu » sans rien déposer. */
  if (ligne(corps.piege, 200)) return NextResponse.json({ ok: true }, { headers: h });

  const categorie = String(corps.categorie || '') as CategorieDemande;
  if (!CATEGORIES_SITE.includes(categorie)) return refus('Formulaire inconnu.');
  const nom = ligne(corps.nom, 200);
  const email = ligne(corps.email, 320).toLowerCase();
  const tel = ligne(corps.telephone, 50);
  if (!nom) return refus('Le nom manque.');
  if (!email && !tel) return refus('Il faut un téléphone ou un e-mail pour vous répondre.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return refus('L’adresse e-mail ne semble pas valide.');
  if (tel && (tel.replace(/\D/g, '').length < 9)) return refus('Le numéro de téléphone semble incomplet.');

  /* Les réponses, « Clé : valeur ». */
  const reponses = (Array.isArray(corps.reponses) ? corps.reponses : []).slice(0, 30)
    .map(r => (r && typeof r === 'object' ? r as Record<string, unknown> : {}))
    .map(r => ({ l: ligne(r.l, 40).replace(/:/g, ''), v: ligne(r.v, 500) }))
    .filter(r => r.l && r.v);
  const libre = bloc(corps.message, 4000);
  const message = [
    reponses.map(r => `${r.l} : ${r.v}`).join('\n'),
    libre,
  ].filter(Boolean).join('\n\n');

  const col = (corps.colonnes && typeof corps.colonnes === 'object' ? corps.colonnes : {}) as Record<string, unknown>;
  const colonnes: Record<string, string | null> = {};
  for (const k of COLONNES) {
    const v = ligne(col[k], k === 'desired_location' || k === 'property_title' ? 500 : 200);
    colonnes[k] = v || null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return refus('Le serveur n’est pas configuré.', 500);
  const sb = createClient(url, cle, { auth: { persistSession: false } });

  /* Un même contact qui renvoie sans cesse : au-delà de cinq demandes en dix
     minutes, on refuse poliment (un robot, ou un double clic qui s'emballe). */
  const depuis = new Date(Date.now() - 10 * 60_000).toISOString();
  const guillemets = (v: string) => `"${v.replace(/"/g, '')}"`;
  const qui = [email ? `email.eq.${guillemets(email)}` : '', tel ? `phone.eq.${guillemets(tel)}` : ''].filter(Boolean).join(',');
  const { count, error: eCompte } = await sb.from(TABLE_DEMANDES).select('id', { count: 'exact', head: true })
    .gte('created_at', depuis).or(qui);
  if (eCompte) console.error('[site/demande] comptage', eCompte.message);
  else if ((count || 0) >= 5) return refus('Votre demande a déjà été reçue. Werner vous répond rapidement.', 429);

  const { data, error } = await sb.from(TABLE_DEMANDES).insert({
    form_type: categorie, name: nom, email, phone: tel || null, message: message || null, ...colonnes,
  }).select('id').single();
  if (error || !data) {
    console.error('[site/demande] dépôt', error?.message);
    return refus('La demande n’a pas pu être enregistrée. Appelez-nous au 01 87 66 06 00.', 500);
  }

  /* Le mail à Werner : un échec n'empêche pas la demande d'être dans le CRM
     (elle sera annoncée au prochain appel). */
  try {
    const b = await annoncerDemandes();
    if (!b.ok) console.error('[site/demande] annonce', b.erreurs.join(' ; '));
  } catch (e) {
    console.error('[site/demande] annonce', (e as Error).message);
  }
  return NextResponse.json({ ok: true, id: (data as { id: string }).id }, { headers: h });
}
