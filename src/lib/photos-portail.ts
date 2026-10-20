import type { SupabaseClient } from '@supabase/supabase-js';

/* ═══ Copier chez nous une photo d'annonce SeLoger (Werner, octobre 2026) ═══
   L'import des annonces de Werner (/api/biens-vente/import-seloger) : le
   serveur télécharge chaque photo et la dépose dans le bucket public
   `photos-vente`, sous `<id de l'affaire>/`, comme une photo ajoutée à la
   main. La fiche les garde même quand l'annonce disparaît de SeLoger.

   Même prudence que lib/photos-immofacile.ts : https seulement, les hôtes
   d'images de SeLoger seulement, une vraie image (reconnue à ses premiers
   octets), 15 Mo au plus, aucune redirection suivie. Serveur seulement. */

const BUCKET = 'photos-vente';
const HOTES = new Set(['v.seloger.com', 'mms.seloger.com', 'pix.seloger.com']);
const MAX_OCTETS = 15 * 1024 * 1024;

function adresse(u: unknown): URL | null {
  if (typeof u !== 'string') return null;
  let x: URL;
  try { x = new URL(u); } catch { return null; }
  if (x.protocol !== 'https:' || !HOTES.has(x.hostname) || x.username || x.password || x.port) return null;
  if (!/^\/[\w/.-]+\.(jpe?g|png|webp)$/i.test(x.pathname) || x.pathname.includes('..')) return null;
  /* La plus grande taille que SeLoger sert : « /s/height/800/ » devient « /s/width/1600/ »
     quand c'est possible ; sinon l'adresse telle quelle. */
  return new URL(`https://${x.hostname}${x.pathname.replace(/^\/s\/(height|width)\/\d+\//, '/s/width/1600/')}`);
}

function typeImage(o: Uint8Array): { type: string; ext: string } | null {
  if (o.length < 12) return null;
  if (o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47) return { type: 'image/png', ext: 'png' };
  const txt = (de: number, n: number) => String.fromCharCode(...Array.from(o.slice(de, de + n)));
  if (txt(0, 4) === 'RIFF' && txt(8, 4) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  return null;
}

async function lireAuPlus(res: Response, max: number): Promise<Uint8Array | null> {
  if (Number(res.headers.get('content-length') || 0) > max || !res.body) return null;
  const lecteur = res.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { try { await lecteur.cancel(); } catch { /* rien */ } return null; }
    morceaux.push(value);
  }
  const out = new Uint8Array(total);
  let i = 0;
  for (const m of morceaux) { out.set(m, i); i += m.byteLength; }
  return out;
}

async function telecharger(u: URL): Promise<Uint8Array | null> {
  const r = await fetch(u.toString(), { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { Accept: 'image/*', 'User-Agent': 'Mozilla/5.0 (compatible; WernerImmoCRM/1.0)' } });
  if (!r.ok) return null;
  return lireAuPlus(r, MAX_OCTETS);
}

export type PhotoCopiee = { url: string; chemin: string };

export async function copierPhotoPortail(sb: SupabaseClient, id: string, u: unknown, rang: number): Promise<PhotoCopiee | null> {
  const grande = adresse(u);
  if (!grande) return null;
  try {
    /* La grande taille d'abord ; si SeLoger ne la sert pas, celle de l'annonce. */
    let octets = await telecharger(grande);
    if (!octets || !typeImage(octets)) octets = await telecharger(new URL(String(u)));
    const img = octets ? typeImage(octets) : null;
    if (!octets || !img) return null;
    const chemin = `${id}/sl-${Date.now()}-${rang}-${Math.random().toString(36).slice(2, 6)}.${img.ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(chemin, octets, { contentType: img.type, upsert: false });
    if (error) { console.error('[photos-portail]', error.message); return null; }
    return { url: sb.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl, chemin };
  } catch (e) { console.error('[photos-portail]', (e as Error).message); return null; }
}

/* Trois à la fois, une sortie par entrée, dans l'ordre. */
export async function copierPhotosPortail(sb: SupabaseClient, id: string, urls: unknown[]): Promise<(PhotoCopiee | null)[]> {
  const photos: (PhotoCopiee | null)[] = new Array(urls.length).fill(null);
  for (let i = 0; i < urls.length; i += 3) {
    const lot = await Promise.all(urls.slice(i, i + 3).map((u, k) => copierPhotoPortail(sb, id, u, i + k)));
    lot.forEach((p, k) => { photos[i + k] = p; });
  }
  return photos;
}
