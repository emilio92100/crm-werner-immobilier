// Données et helpers partagés pour la sélection de secteurs de recherche.
// Utilisé par le formulaire de création (Clients.tsx) et d'édition (FicheClient.tsx).
import { useEffect, useState } from 'react';
import { normVille } from '@/lib/correspondance';
import { QUARTIERS_REF, nomsDe } from '@/lib/quartiers';

/* V3.227 : la liste vient des quartiers de référence (src/lib/quartiers.ts) :
   tout Paris, quartier par quartier, avec les noms d'usage. Ici, une liste à
   plat (référence, puis lieux, puis autres noms) pour ceux qui la lisent ainsi. */
export const QUARTIERS: Record<string, { ville: string; quartiers: string[] }> = Object.fromEntries(
  Object.entries(QUARTIERS_REF).map(([cp, c]) => [cp, { ville: c.ville, quartiers: nomsDe(c) }]),
);

export type CpSuggestion = { cp: string; ville: string };

/* ── V3.207 : un secteur vient toujours d'une ville ──
   Alexandre : « dans tous les cas, ça vient d'une ville, le secteur ». Un
   quartier s'écrit « Quartier (Ville) ». Avant, le champ « Secteur libre,
   sans commune » laissait écrire un quartier tout seul (« Place Marquis »),
   que la fiche affichait comme une ville. Le champ a disparu ; ceux déjà
   écrits se reconnaissent ici : une entrée sans ville entre parenthèses qui
   n'est pas une commune. Vérifié une fois par nom (geo.api.gouv.fr, comme la
   recherche de ville) ; sans réponse, on la croit commune : rien ne bouge. */
const communes = new Map<string, boolean>();
const enCours = new Map<string, Promise<boolean>>();
const villeConnue = (k: string) =>
  /^paris/.test(k) || Object.values(QUARTIERS).some(v => normVille(v.ville) === k);
/* La réponse déjà connue, sans attendre : vrai, faux, ou undefined (pas encore lue). */
export function communeSure(nom: string): boolean | undefined {
  const k = normVille(nom);
  if (!k || villeConnue(k)) return true;
  return communes.get(k);
}
export function estUneCommune(nom: string): Promise<boolean> {
  const k = normVille(nom);
  const sur = communeSure(nom);
  if (sur !== undefined) return Promise.resolve(sur);
  let p = enCours.get(k);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(nom.trim())}&fields=nom&limit=10&format=json`);
        if (!res.ok) return true;
        const data: unknown = await res.json();
        const oui = !Array.isArray(data) || data.some(d => normVille(String((d as { nom?: unknown })?.nom || '')) === k);
        communes.set(k, oui);
        return oui;
      } catch { return true; }
    })();
    enCours.set(k, p);
  }
  return p;
}
/* Les entrées d'une liste de secteurs écrites sans leur ville. */
export const lireLibelle = (s: string) => {
  const m = s.match(/^(.+?)\s*\((.+?)\)$/);
  return m ? { quartier: m[1].trim(), ville: m[2].trim() } : { quartier: null as string | null, ville: s.trim() };
};
export function useSansVille(secteurs: string[]): string[] {
  const seuls = secteurs.filter(s => !lireLibelle(s).quartier);
  const [, setLu] = useState(0);
  const cle = seuls.join('|');
  useEffect(() => {
    let vivant = true;
    const aLire = seuls.filter(s => communeSure(s) === undefined);
    if (!aLire.length) return;
    Promise.all(aLire.map(estUneCommune)).then(() => { if (vivant) setLu(n => n + 1); });
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return seuls.filter(s => communeSure(s) === false);
}

// Recherche un code postal ou une ville : d'abord dans QUARTIERS (local),
// sinon via l'API officielle geo.api.gouv.fr.
export async function searchCommune(q: string): Promise<CpSuggestion[]> {
  if (q.trim().length < 2) return [];
  const local = Object.entries(QUARTIERS)
    .filter(([cp, info]) => cp.includes(q) || info.ville.toLowerCase().includes(q.toLowerCase()))
    .map(([cp, info]) => ({ cp, ville: info.ville }));
  if (local.length > 0) return local.slice(0, 6);

  try {
    const isCP = /^\d+$/.test(q.trim());
    const url = isCP
      ? `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(q.trim())}&fields=nom,codesPostaux&format=json`
      : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q.trim())}&fields=nom,codesPostaux&boost=population&limit=6&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    return data
      .flatMap((d: any) => (d.codesPostaux || []).map((cp: string) => ({ cp, ville: d.nom })))
      .slice(0, 6);
  } catch {
    return [];
  }
}
