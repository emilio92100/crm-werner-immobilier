/* ═══ La signature manuscrite de l'agence (22 octobre 2026) ════════════════
   Une image PNG, encre sur fond transparent, rangée dans le dossier privé
   des mandats (`mandats/agence/signature.png`). Elle se pose dans la case de
   l'agence sur tout ce qui se signe depuis le CRM : mandats et bons de
   visite signés en ligne ou sur place (src/lib/signature-documents.ts), et
   mandats de recherche que les demandeurs signent seuls depuis leur espace
   (/api/espace/mandat). Sans elle, ces documents partent avec une case
   agence vide.

   Elle se dépose dans Paramètres › Agence (une image) ou se dessine au
   doigt (FenetreSignatureAgence) ; à la première connexion, le CRM la
   demande tant qu'elle manque (SignatureBienvenue). Chaque dépôt entre
   dans l'historique de l'identité de l'agence, comme un champ. */

import { supabase } from '@/lib/supabase';
import { CLE_HISTORIQUE, HISTORIQUE_MAX, lireHistorique, type Modif } from '@/lib/agence';

export const BUCKET_SIGNATURE = 'mandats';
export const CHEMIN_SIGNATURE = 'agence/signature.png';

/** true : elle est là ; false : pas encore ; null : on ne sait pas (lecture ratée). */
export async function signatureDeposee(): Promise<boolean | null> {
  const l = await supabase.storage.from(BUCKET_SIGNATURE).list('agence');
  if (l.error) return null;
  return !!l.data?.some(x => x.name === 'signature.png');
}

/** Son adresse, valable dix minutes, pour l'afficher ; null sans signature. */
export async function urlSignature(): Promise<string | null> {
  if (!(await signatureDeposee())) return null;
  const u = await supabase.storage.from(BUCKET_SIGNATURE).createSignedUrl(CHEMIN_SIGNATURE, 600);
  return u.error ? null : u.data.signedUrl;
}

/** Déposer (ou remplacer) la signature, puis la noter dans l'historique.
    Rend null si tout est enregistré, sinon ce qui a échoué. `comment` :
    « dessinée dans le CRM » ou « déposée (image) ». */
export async function deposerSignatureAgence(png: Blob, avant: boolean, comment: string): Promise<{ erreur: string | null; histoire: string | null }> {
  const { error } = await supabase.storage.from(BUCKET_SIGNATURE).upload(CHEMIN_SIGNATURE, png, { upsert: true, contentType: 'image/png' });
  if (error) return { erreur: error.message, histoire: null };
  const le = new Date().toISOString();
  const { data, error: eL } = await supabase.from('parametres').select('valeur').eq('cle', CLE_HISTORIQUE).maybeSingle();
  if (eL) return { erreur: null, histoire: eL.message };
  const ligne: Modif = { le, cle: 'signature', lib: 'Signataire · Signature manuscrite', avant: avant ? 'une signature' : 'aucune', apres: `nouvelle signature ${comment}` };
  const histo = [ligne, ...lireHistorique(data?.valeur ?? null)].slice(0, HISTORIQUE_MAX);
  const { error: eH } = await supabase.from('parametres').upsert({ cle: CLE_HISTORIQUE, valeur: JSON.stringify(histo), updated_at: le }, { onConflict: 'cle' });
  return { erreur: null, histoire: eH ? eH.message : null };
}
