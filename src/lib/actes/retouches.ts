/* ═══ Les retouches du texte d'un document (23 octobre 2026) ════════════════
   Alexandre, pour Werner : « il faut qu'il ait la main : modifier, supprimer
   des catégories, rajouter du texte, que ce soit sur ce document ou d'autres
   documents ». Le texte reste rédigé à partir des réponses (`rediger`) ; les
   retouches s'appliquent par-dessus, partout où un document se lit :
   l'aperçu de l'éditeur, le PDF, la page de signature, l'espace du client
   (src/lib/actes/index.ts enveloppe chaque modèle).

   Dans les réponses du document, sous `retouches` :
     · `phrases` : une phrase réécrite, retrouvée par son texte d'origine
       (`avant`) — `apres` vide la retire. Si la phrase d'origine change avec
       les réponses, la retouche ne s'applique plus : l'éditeur le dit ;
     · `retirees` : les parties retirées (leur clé, `cleSection`) ;
     · `ajouts` : ses paragraphes à la fin d'une partie ;
     · `parties` : ses parties à lui, avant les signatures ;
     · `responsable_le` : quand il a déverrouillé le texte (« J'ai compris »).
   Un texte retouché peut porter du gras (<b>…</b>) et de l'italique
   (<i>…</i>), seulement ces deux balises ; un retour à la ligne commence un
   nouveau paragraphe ; une taille (petit, normal, grand) vaut pour le
   paragraphe. La police est celle du document.
   Les signatures et la rétractation ne se retouchent pas : la loi les exige
   telles quelles, et chaque signataire signe dans son cadre. Un document en
   signature ou signé ne bouge plus (l'éditeur est figé). */

import type { Bloc, Icone, Partie, Section } from '@/lib/mandat';
import type { Donnees } from './commun';

export type Taille = 'petit' | 'normal' | 'grand';
export type PhraseRetouchee = { avant: string; apres: string; taille?: Taille };
export type Paragraphe = { id: string; texte: string; taille?: Taille };
export type PartieLibre = { id: string; titre: string; paras: Paragraphe[] };
export type Retouches = {
  retirees: string[]; phrases: PhraseRetouchee[]; ajouts: Record<string, Paragraphe[]>; parties: PartieLibre[];
  responsable_le?: string;
};
export const RETOUCHES_VIDES: Retouches = { retirees: [], phrases: [], ajouts: {}, parties: [] };

const chaine = (x: unknown) => (typeof x === 'string' ? x : '');
const objet = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null);
const taille = (x: unknown): Taille | undefined => (x === 'petit' || x === 'grand' ? x : undefined);
/* Des paragraphes : une liste, ou (avant) un texte d'un seul tenant. */
function paras(x: unknown, id: string): Paragraphe[] {
  if (typeof x === 'string') return x.trim() ? [{ id: `${id}-0`, texte: x }] : [];
  return (Array.isArray(x) ? x : []).map(objet).filter((y): y is Record<string, unknown> => !!y)
    .map((y, i) => ({ id: chaine(y.id) || `${id}-${i}`, texte: chaine(y.texte), ...(taille(y.taille) ? { taille: taille(y.taille) } : {}) }));
}

export function lireRetouches(d: Donnees | null | undefined): Retouches {
  const o = objet(d?.retouches) || {};
  const ajouts: Record<string, Paragraphe[]> = {};
  for (const [k, v] of Object.entries(objet(o.ajouts) || {})) { const l = paras(v, k); if (l.length) ajouts[k] = l; }
  return {
    retirees: Array.isArray(o.retirees) ? o.retirees.filter((x): x is string => typeof x === 'string') : [],
    phrases: (Array.isArray(o.phrases) ? o.phrases : []).map(objet).filter((x): x is Record<string, unknown> => !!x && typeof x.avant === 'string' && !!x.avant)
      .map(x => ({ avant: String(x.avant), apres: chaine(x.apres), ...(taille(x.taille) ? { taille: taille(x.taille) } : {}) })),
    ajouts,
    parties: (Array.isArray(o.parties) ? o.parties : []).map(objet).filter((x): x is Record<string, unknown> => !!x)
      .map((x, i) => { const id = chaine(x.id) || `p${i}`; return { id, titre: chaine(x.titre), paras: paras(x.paras ?? x.texte, id) }; }),
    ...(chaine(o.responsable_le) ? { responsable_le: chaine(o.responsable_le) } : {}),
  };
}

/** Le nombre de changements (« Texte retouché · 3 changements »). */
export function nbRetouches(r: Retouches): number {
  return r.retirees.length + r.phrases.length + Object.values(r.ajouts).reduce((n, l) => n + l.filter(x => x.texte.trim()).length, 0)
    + r.parties.filter(x => x.titre.trim() || x.paras.some(y => y.texte.trim())).length;
}

/** La clé d'une partie : son rang dans le document, et son titre. */
export const cleSection = (pi: number, si: number, sec: Section) => `${pi}:${sec.titre ? sec.titre : `#${si}`}`;

/** Ce qui ne se retouche pas : les signatures, la rétractation. */
export const sectionFixe = (p: Partie, sec: Section) =>
  sec.titre === 'Date et signatures' || /rétractation/i.test(sec.titre || '') || /rétractation/i.test(p.titre)
  || sec.blocs.some(b => b.t === 'sigs' || b.t === 'sig');

/* ── Le gras et l'italique ── */
const BALISE = /<\/?[bi]>/g;
export const aDesBalises = (x: string) => /<\/?[bi]>/.test(x);
export const sansBalises = (x: string) => x.replace(BALISE, '');
/** Un texte en morceaux : [texte, gras, italique]. Seules <b> et <i> comptent. */
export function morceaux(x: string): { t: string; g: boolean; i: boolean }[] {
  const out: { t: string; g: boolean; i: boolean }[] = [];
  let g = false, i = false;
  for (const tok of x.split(/(<\/?[bi]>)/)) {
    if (tok === '<b>') g = true; else if (tok === '</b>') g = false;
    else if (tok === '<i>') i = true; else if (tok === '</i>') i = false;
    else if (tok) out.push({ t: tok, g, i });
  }
  return out;
}

/** Un texte retouché, en paragraphes : un retour à la ligne en commence un. */
export function blocsDe(texte: string, t?: Taille, base: { g?: boolean; petit?: boolean } = {}): Bloc[] {
  return texte.replace(/\r\n?/g, '\n').split('\n').map(l => l.trim()).filter(l => sansBalises(l).trim()).map((l): Bloc => {
    /* Un encadré (une phrase qui engage) reste en gras d'un bout à l'autre. */
    if (base.g) return { t: 'p', x: sansBalises(l), g: true };
    const petit = t ? t === 'petit' : !!base.petit;
    return { t: 'p', x: l, ...(aDesBalises(l) ? { riche: true } : {}), ...(petit ? { petit: true } : {}), ...(t === 'grand' ? { grand: true } : {}) };
  });
}

/** Les phrases d'un document qu'on peut réécrire (pour retrouver les retouches qui ne s'appliquent plus). */
export function phrasesDe(parties: Partie[]): Set<string> {
  const l = new Set<string>();
  for (const p of parties) for (const sec of p.sections) {
    if (sectionFixe(p, sec)) continue;
    for (const b of sec.blocs) {
      if (b.t === 'p' || b.t === 'case') l.add(b.x);
      else if (b.t === 'l' || b.t === 'coches') b.items.forEach(x => l.add(x));
      else if (b.t === 'etapes') b.items.forEach(x => l.add(x.x));
    }
  }
  return l;
}

/** Où vont ses parties à lui : juste avant les signatures (la partie qui les porte). */
export function placePartiesLibres(parties: Partie[]): { pi: number; si: number } {
  const pi = parties.findIndex(p => p.sections.some(s => s.titre === 'Date et signatures'));
  const k = pi >= 0 ? pi : parties.length - 1;
  const i = k >= 0 ? parties[k].sections.findIndex(s => s.titre === 'Date et signatures') : -1;
  return { pi: k, si: i >= 0 ? i : (parties[k]?.sections.length ?? 0) };
}

export const sectionLibre = (x: PartieLibre): Section => ({
  titre: x.titre.trim() || 'Précisions', ic: 'plume' as Icone, blocs: x.paras.flatMap(y => blocsDe(y.texte, y.taille)),
});

export function appliquerRetouches(parties: Partie[], d: Donnees): Partie[] {
  const r = lireRetouches(d);
  if (!nbRetouches(r)) return parties;
  const remplace = new Map(r.phrases.map(p => [p.avant, p]));
  const plat = (x: string) => { const p = remplace.get(x); return p ? sansBalises(p.apres).replace(/\s*\n\s*/g, ' ') : x; };
  const out: Partie[] = parties.map((p, pi) => ({
    ...p,
    sections: p.sections.flatMap((sec, si): Section[] => {
      if (sectionFixe(p, sec)) return [sec];
      const cle = cleSection(pi, si, sec);
      if (r.retirees.includes(cle)) return [];
      const blocs = sec.blocs.flatMap((b): Bloc[] => {
        if (b.t === 'p') { const x = remplace.get(b.x); return x ? blocsDe(x.apres, x.taille, { g: b.g, petit: b.petit }) : [b]; }
        if (b.t === 'case') { const x = plat(b.x); return x.trim() ? [{ ...b, x }] : []; }
        if (b.t === 'l' || b.t === 'coches') { const items = b.items.map(plat).filter(x => x.trim()); return items.length ? [{ ...b, items }] : []; }
        if (b.t === 'etapes') { const items = b.items.map(x => ({ ...x, x: plat(x.x) })).filter(x => x.x.trim()); return items.length ? [{ ...b, items }] : []; }
        return [b];
      });
      const tout = [...blocs, ...(r.ajouts[cle] || []).flatMap(x => blocsDe(x.texte, x.taille))];
      return tout.length ? [{ ...sec, blocs: tout }] : [];
    }),
  }));
  /* Ses parties à lui : juste avant les signatures. */
  const libres = r.parties.filter(x => x.titre.trim() || x.paras.some(y => y.texte.trim())).map(sectionLibre);
  if (libres.length && out.length) {
    const { pi } = placePartiesLibres(out);
    const secs = out[pi].sections;
    const i = secs.findIndex(s => s.titre === 'Date et signatures');
    out[pi] = { ...out[pi], sections: i >= 0 ? [...secs.slice(0, i), ...libres, ...secs.slice(i)] : [...secs, ...libres] };
  }
  return out;
}
