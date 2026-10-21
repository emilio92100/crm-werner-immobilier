'use client';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

/* ═══ Des rangées de vignettes sans orphelines (22 octobre 2026) ════════════
   Alexandre : « s'il y a un carré ou deux carrés qui sont à la ligne, ça ne
   sert à rien : il faut les mettre côte à côte ». Une grille en `auto-fill`
   remplit sa première ligne et laisse le reste en bas : 7 + 2, 6 + 1.

   `useColonnes` compte les colonnes selon la largeur réelle de la grille :
     · tout tient sur une ligne : rien à changer (le CSS de la grille) ;
     · ça tient en se serrant un peu (`serre`) : une seule ligne ;
     · sinon : des lignes égales (9 → 5 + 4, 7 → 4 + 3, 10 → 5 + 5).
   Au téléphone (moins de 520 px), `minTel` remplace `min`.
   Le style rendu se pose sur la grille ; sans lui (premier rendu, serveur),
   la grille garde son CSS. */
export function useColonnes(n: number, o: { min: number; serre: number; minTel?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState<number | null>(null);
  const { min, serre, minTel } = o;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const calc = () => {
      const w = el.clientWidth;
      if (!w) return;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 8;
      const tel = w < 520;
      const m = tel && minTel ? minTel : min;
      const max = Math.max(1, Math.floor((w + gap) / (m + gap)));
      /* Une ligne presque pleine (6 sur 7) s'étire jusqu'au bout ; une courte
         (Oui, Non) garde des vignettes à leur taille. */
      if (n <= max) { setCols(!tel && n >= Math.ceil(max * 0.6) ? n : null); return; }
      if (!tel && n * (serre + gap) <= w + gap) { setCols(n); return; }
      if (tel) {
        /* Au téléphone, les colonnes suivent le CSS (3 ou 2) ; une vignette
           seule en bas (7 = 3 + 3 + 1) : une colonne de plus si chacune garde
           88 px (4 + 3 sur un grand téléphone) ; plus étroit, les mots ne
           tiennent plus (« Quai de chargement »), la vignette reste seule. */
        const largeur = (k: number) => (w - gap * (k - 1)) / k;
        if (n % max !== 1) { setCols(null); return; }
        if (largeur(max + 1) >= 88 && n % (max + 1) !== 1) { setCols(max + 1); return; }
        /* Sinon, des lignes égales quand elles existent (4 = 2 + 2) ; à
           défaut, le CSS met la vignette seule au milieu. */
        const eq = Math.ceil(n / Math.ceil(n / max));
        setCols(n % eq !== 1 ? eq : null);
        return;
      }
      const rangs = Math.ceil(n / max);
      setCols(Math.ceil(n / rangs));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n, min, serre, minTel]);
  const style: CSSProperties | undefined = cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined;
  /* `cols` : posé en data-cols sur la grille, il dit au CSS que le compte est fait (les règles du téléphone pour une vignette seule ne s'appliquent alors pas). */
  return { ref, style, cols };
}

/* Un mot trop long pour sa vignette (« Recommandation ») se coupait n'importe
   où : « Recommandatio / n ». Un trait d'union discret (U+00AD) est posé dans
   les mots de 14 lettres et plus (les plus courts tiennent sur une ligne de
   vignette), à la française : entre deux consonnes qui se séparent (« man-da »,
   jamais « p-r », « c-h »), sinon devant la consonne entre deux voyelles. Le
   navigateur ne coupe là que si le mot ne tient pas : « Recomman-dation ». */
const VOY = /[aeiouyàâäéèêëîïôöùûü]/i;
const LIEES = /^([bcdfgkptv][rl]|ch|ph|th|gn)$/i;
export function coupable(t: string): string {
  return t.replace(/[A-Za-zÀ-ÿ]{14,}/g, m => {
    const mil = m.length / 2;
    const proche = (i: number, best: number) => best < 0 || Math.abs(i - mil) < Math.abs(best - mil);
    let best = -1;
    for (let i = 3; i < m.length - 3; i++) {
      const a = m[i - 1], c = m[i];
      if (!VOY.test(a) && !VOY.test(c) && !LIEES.test(a + c) && proche(i, best)) best = i;
    }
    if (best < 0) for (let i = 3; i < m.length - 3; i++) if (VOY.test(m[i - 1]) && !VOY.test(m[i]) && VOY.test(m[i + 1]) && proche(i, best)) best = i;
    return best > 0 ? `${m.slice(0, best)}\u00ad${m.slice(best)}` : m;
  });
}

/* ── Les rangées de pastilles (22 octobre 2026) ──────────────────────────
   Le même souci dans les pastilles qui vont à la ligne (« Type de local » :
   7 + « Parking » seul ; « Ce qu'il lui faut » : 7 + 6 + 2). Pour chaque
   rangée en `flex-wrap` d'au moins 3 pastilles dont la dernière ligne n'en
   garde qu'une ou deux :
     1. on la resserre (`data-serre` : moins d'écart et de marge intérieure,
        globals.css) — souvent, tout tient alors sur une ligne de moins ;
     2. sinon, on rétrécit la rangée jusqu'à la plus petite largeur qui garde
        le même nombre de lignes : des lignes égales (4 + 4, 5 + 5 + 5).
   `useRangees(ref)` le fait pour toutes les rangées sous `ref`, à l'ouverture,
   quand la largeur change et quand des pastilles apparaissent. */
type Ligne = number[];
function lignesDe(kids: HTMLElement[]): Ligne {
  const m = new Map<number, number>();
  for (const k of kids) { const t = Math.round(k.offsetTop); m.set(t, (m.get(t) || 0) + 1); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
const orpheline = (l: Ligne) => l.length > 1 && l[l.length - 1] <= 2 && l[0] >= l[l.length - 1] + 2;

export function equilibrerRangee(el: HTMLElement) {
  /* Seule une largeur posée ici s'enlève : celle d'un style de l'écran reste. */
  if (el.dataset.equi) { el.style.maxWidth = ''; delete el.dataset.equi; }
  const libre = !el.style.maxWidth;
  el.removeAttribute('data-serre');
  const kids = [...el.children].filter((k): k is HTMLElement => k instanceof HTMLElement && k.offsetParent !== null && k.offsetWidth > 0);
  if (kids.length < 3) return;
  if (!orpheline(lignesDe(kids))) return;
  el.setAttribute('data-serre', 'oui');
  const serre = lignesDe(kids);
  if (!orpheline(serre)) return;
  el.removeAttribute('data-serre');
  if (!libre) return;
  const n = lignesDe(kids).length;
  let lo = Math.max(...kids.map(k => k.offsetWidth)), hi = el.clientWidth;
  for (let i = 0; i < 14 && hi - lo > 4; i++) {
    const mid = (lo + hi) / 2;
    el.style.maxWidth = `${mid}px`;
    if (lignesDe(kids).length > n) lo = mid; else hi = mid;
  }
  el.style.maxWidth = `${Math.ceil(hi) + 1}px`;
  el.dataset.equi = '1';
  if (orpheline(lignesDe(kids))) { el.style.maxWidth = ''; delete el.dataset.equi; }
}

export function useRangees(ref: RefObject<HTMLElement | null>, cle?: unknown) {
  useEffect(() => {
    const zone = ref.current;
    if (!zone || typeof ResizeObserver === 'undefined') return;
    let attente = 0;
    let largeur = -1;
    const tout = () => {
      attente = 0;
      zone.querySelectorAll<HTMLElement>('div, span, section').forEach(el => {
        if (el.children.length < 3) return;
        const cs = getComputedStyle(el);
        if (cs.display !== 'flex' || cs.flexWrap !== 'wrap' || cs.flexDirection.startsWith('column')) return;
        equilibrerRangee(el);
      });
    };
    const bientot = () => { if (!attente) attente = window.setTimeout(tout, 120); };
    const ro = new ResizeObserver(() => { const w = zone.clientWidth; if (Math.abs(w - largeur) > 2) { largeur = w; bientot(); } });
    ro.observe(zone);
    const mo = new MutationObserver(bientot);
    mo.observe(zone, { childList: true, subtree: true });
    bientot();
    return () => { ro.disconnect(); mo.disconnect(); if (attente) clearTimeout(attente); };
  }, [ref, cle]);
}
