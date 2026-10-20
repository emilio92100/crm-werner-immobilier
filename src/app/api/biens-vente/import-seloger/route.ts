import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ecritServeur } from '@/lib/ecritures';
import { colonnesBien, lirePhotos, referenceSuivante } from '@/lib/biens-vente';
import { affaireDepuisSeLoger } from '@/lib/import-seloger';
import { copierPhotosPortail } from '@/lib/photos-portail';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* ═══ Reprendre une annonce SeLoger Bureaux & Commerces (Werner, oct. 2026) ═══
   Une annonce par appel : sa fiche détaillée (`detailClassified`) et sa carte
   de la page de résultats (`resume`). Le serveur en fait une affaire « en
   cours » (étape `mandat`), sans mandant, et recopie ses photos dans le
   bucket public `photos-vente` (lib/photos-portail.ts).

   Une annonce déjà reprise (même identifiant SeLoger, `donnees.portail.id`)
   n'est pas reprise deux fois : la route rend l'affaire existante.

   Protégée par le code d'accès, comme le reste du CRM (src/proxy.ts).
     POST { annonce, resume? }  →  { ok, id, reference, deja, photos } */

const ko = (erreur: string, status = 400) => NextResponse.json({ ok: false, erreur }, { status });

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return ko('Variables Supabase manquantes', 500);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return ko('Requête illisible'); }
  const annonce = body.annonce && typeof body.annonce === 'object' ? body.annonce as Record<string, unknown> : null;
  const resume = body.resume && typeof body.resume === 'object' ? body.resume as Record<string, unknown> : {};
  if (!annonce) return ko('Annonce manquante');
  const a = affaireDepuisSeLoger(annonce, resume);
  if (!a.idPortail || !/^\d+$/.test(a.idPortail)) return ko('Identifiant SeLoger illisible');
  const sb = createClient(url, cle, { auth: { persistSession: false } });

  /* Déjà reprise ? */
  const { data: deja, error: eD } = await sb.from('biens_vente').select('id, reference').eq('donnees->portail->>id', a.idPortail).limit(1);
  if (eD) return ko(`Les affaires n’ont pas pu être lues : ${eD.message}`, 500);
  if (deja?.length) return NextResponse.json({ ok: true, id: deja[0].id, reference: deja[0].reference, deja: true, photos: 0 });

  const { data: refs, error: eR } = await sb.from('biens_vente').select('reference');
  if (eR) return ko(`Les références n’ont pas pu être lues : ${eR.message}`, 500);
  const maintenant = new Date().toISOString();
  const { data: cree, error: eC } = await sb.from('biens_vente').insert({
    reference: referenceSuivante((refs || []).map(r => r.reference as string | null)),
    etape: 'mandat', etape_le: maintenant, en_vente_le: a.publieLe || maintenant,
    ...colonnesBien(a.donnees), donnees: a.donnees,
  }).select('id, reference').single();
  if (eC || !cree) return ko(`L’affaire n’a pas pu être créée : ${eC?.message || 'réponse vide'}`, 500);
  const avertissements: string[] = [];
  await ecritServeur('L’historique de l’affaire', sb.from('biens_vente_suivi').insert({
    bien_id: cree.id, type: 'etape', statut: 'mandat',
    donnees: { de: 'creation', depuis: 'seloger', annonce: a.url, reference: a.reference },
  }), avertissements);

  /* Les photos, dans l'ordre de l'annonce (20 au plus). */
  const copies = (await copierPhotosPortail(sb, cree.id, a.photos.slice(0, 20))).filter((p): p is { url: string; chemin: string } => !!p);
  if (copies.length) {
    const photos = copies.map(p => ({ url: p.url, chemin: p.chemin, legende: '' }));
    const donnees = { ...a.donnees, photos };
    await ecritServeur('Les photos de l’affaire', sb.from('biens_vente').update({ donnees, photo: lirePhotos(photos)[0]?.url || null }).eq('id', cree.id), avertissements);
  }
  return NextResponse.json({ ok: true, id: cree.id, reference: cree.reference, deja: false, photos: copies.length, sur: a.photos.length, avertissements });
}
