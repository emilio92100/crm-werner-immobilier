/* ═══ Les montants du texte de l'annonce, contrôlés avant de diffuser ══════
   (22 octobre 2026) — Une annonce reprise de SeLoger (WER-A-2026-051) disait
   « Loyer annuel : 3.000 € HC/HT » alors que la fiche dit 36 000 € HT HC par
   an : 3 000 €, c'était le loyer du mois. Personne ne l'avait vu, et le site
   affichait les deux.

   `ecartsAnnonce` relit le texte : chaque montant qui suit « loyer » ou
   « prix » (le plus proche des deux mots gagne ; « charges », « honoraires »,
   « dépôt »… écartent le montant) est comparé à la fiche, à l'année ou au
   mois selon le mot le plus proche (« annuel », « par an », « mensuel »,
   « /mois »…). Un montant au mètre carré est comparé au loyer au mètre
   carré. Et le loyer de la fiche lui-même est regardé : moins de 40 € le m²
   par an, c'est presque toujours un loyer mensuel saisi à la place de
   l'annuel.

   Rien n'est bloqué : la fiche de l'affaire, la fenêtre « Modifier
   l'annonce » et la fenêtre de diffusion le disent, Werner corrige ou non. */

import type { Donnees } from '@/lib/biens-vente';
import { argentBien } from '@/lib/biens-vente';
import { auPoste, bailEnCours, estActivite, estBureaux, estLocation, estMurs, natureDe, nbPostesDe } from '@/lib/affaires';

export type Ecart = { titre: string; texte: string };

const NB = ' ';
const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/[\s  ]/g, NB)}${NB}€`;
const num = (d: Donnees, k: string): number | null => {
  const v = d[k];
  const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/[\s  ]/g, '').replace(',', '.')) : NaN;
  return Number.isFinite(x) && x > 0 ? x : null;
};
/* À 8 % près : un montant arrondi (« 3 000 € » pour 2 950 €) passe. */
const proche = (a: number, b: number | null | undefined, tol = 0.08) => !!b && Math.abs(a - b) <= tol * b;

/* Les montants d'un morceau de texte : « 3.000 € », « 36 000 € », « 45 k€ ». */
const MONTANT = /(\d{1,3}(?:[ .]\d{3})+|\d+)(?:,(\d{1,2}))?\s*(k\s*€|€|euros?\b|eur\b)/gi;
const LOYER = /loyer|lou[ée]|location/g;
const PRIX = /prix|droit au bail|cession|c[ée]d[ée]|fonds|valeur/g;
const AUTRE = /charges?|provision|d[ée]p[ôo]t|garantie|caution|honoraires|frais|taxe|tva|chiffre d.affaires|\bca\b|\bebe\b|r[ée]sultat|droit d.entr[ée]e|pas[- ]de[- ]porte|travaux|stock|[ée]nergie|d[ée]penses|budget|salaire/g;
const AN = /annuel(?:le)?s?|\/\s*an\b|par an\b|l.an\b|par ann[ée]e|annuellement/g;
const MOIS = /mensuel(?:le)?s?|\/\s*mois\b|par mois\b|mensuellement|le mois\b/g;
const M2 = /^\s*(?:(?:ht|hc|hors\s+\w+|tva|\/|\s)\s*)*(?:\/|par|le)\s*m(?:²|2|\b)/i;

/* La distance du mot le plus proche du montant : en arrière (fin du mot) ou
   en avant (début du mot). */
function distance(re: RegExp, avant: string, apres: string): number {
  let d = Infinity;
  for (const m of avant.matchAll(re)) d = Math.min(d, avant.length - (m.index! + m[0].length));
  for (const m of apres.matchAll(re)) { d = Math.min(d, m.index!); break; }
  return d;
}
const derniere = (re: RegExp, s: string) => { let i = -1; for (const m of s.matchAll(re)) i = m.index! + m[0].length; return i; };

type Lu = { n: number; brut: string; sorte: 'loyer' | 'prix'; periode: 'an' | 'mois' | null; m2: boolean; poste: boolean };

/* Chaque montant du texte qui parle du loyer ou du prix. */
export function montantsDuTexte(texte: string): Lu[] {
  const t = texte.replace(/[  ]/g, ' ');
  /* Un montant se lit dans sa ligne, son tiret ou sa phrase. */
  const morceaux = t.split(/\n|;|\s[-–•·]\s|\.\s/);
  const out: Lu[] = [];
  for (const m0 of morceaux) {
    const bas = m0.toLowerCase();
    for (const m of bas.matchAll(MONTANT)) {
      const entier = m[1];
      let n = parseFloat(entier.replace(/[ .]/g, '') + (m[2] ? '.' + m[2] : ''));
      if (/k/.test(m[3])) n *= 1000;
      if (!Number.isFinite(n) || n <= 0) continue;
      const av = bas.slice(Math.max(0, m.index! - 70), m.index!);
      const ap = bas.slice(m.index! + m[0].length, m.index! + m[0].length + 45);
      /* Le mot le plus proche devant le montant dit de quoi il parle. */
      const iL = derniere(LOYER, av), iP = derniere(PRIX, av), iA = derniere(AUTRE, av);
      const top = Math.max(iL, iP, iA);
      if (top < 0 || top === iA) continue;
      const sorte = top === iL ? 'loyer' : 'prix';
      const dA = distance(AN, av, ap), dM = distance(MOIS, av, ap);
      out.push({
        n, brut: m0.slice(m.index!, m.index! + m[0].length).trim(), sorte,
        periode: dA === Infinity && dM === Infinity ? null : dA <= dM ? 'an' : 'mois',
        m2: M2.test(ap), poste: /^\s*(?:ht\s*|hc\s*)*(?:\/|par|le)\s*poste/.test(ap) || /poste/.test(ap.slice(0, 20)),
      });
    }
  }
  return out;
}

/** Ce qui cloche entre la fiche et le texte de l'annonce. `texte` : celui
    qu'on est en train d'écrire (sinon, celui de la fiche). */
export function ecartsAnnonce(d: Donnees, texte?: string): Ecart[] {
  const out: Ecart[] = [];
  const nat = natureDe(d);
  if (!nat) return out;
  const t = texte ?? (typeof d.annonceTexte === 'string' ? d.annonceTexte : '');
  const a = argentBien(d);
  const surface = num(d, 'surface');
  const poste = auPoste(d);
  const loc = estLocation(d);
  /* Le loyer annuel attendu : celui de la fiche (une location), ou celui du bail en cours. */
  const loyerAn = loc ? a.prix : bailEnCours(d) ? num(d, 'loyerAn') : null;
  const vu = new Set<string>();
  const ajoute = (e: Ecart) => { if (!vu.has(e.titre)) { vu.add(e.titre); out.push(e); } };

  /* 1. Le loyer de la fiche lui-même, au mètre carré. */
  if (loc && a.prix && surface && !poste) {
    const m2an = a.prix / surface;
    if (m2an < 40) {
      ajoute({
        titre: `Loyer très bas : ${eur(m2an)} HT HC le m² par an`,
        texte: `Le loyer de la fiche (${eur(a.prix)} pour ${String(surface).replace('.', ',')}${NB}m²) doit être le loyer ANNUEL. Si ${eur(a.prix)} est le loyer du mois, l’annuel est ${eur(a.prix * 12)}.`,
      });
    } else if ((estBureaux(d) && m2an > 1500) || (estActivite(d) && m2an > 600)) {
      ajoute({
        titre: `Loyer très haut : ${eur(m2an)} HT HC le m² par an`,
        texte: 'Vérifie le loyer annuel et la surface de la fiche : l’un des deux a peut-être un zéro de trop.',
      });
    }
  }
  if (poste && a.prix) {
    const mois = a.prix / 12;
    if (mois < 80 || mois > 3000) ajoute({ titre: `Prix d’un poste : ${eur(mois)} par mois`, texte: 'Vérifie le prix d’un poste dans la fiche : il se saisit à l’année (le prix du mois × 12).' });
  }
  if (estMurs(d) && a.prix && surface && a.prix / surface < 500) {
    ajoute({ titre: `Prix très bas : ${eur(a.prix / surface)} le m²`, texte: 'Vérifie le prix et la surface de la fiche.' });
  }

  /* 2. Les montants écrits dans le texte. */
  if (!t.trim()) return out;
  const nbP = poste ? nbPostesDe(d) : null;
  for (const x of montantsDuTexte(t)) {
    if (x.sorte === 'loyer' && loyerAn) {
      const an = loyerAn, mois = loyerAn / 12;
      /* Au poste : le loyer du bureau entier passe aussi. */
      const autres = nbP ? [an * nbP, mois * nbP] : [];
      if (autres.some(v => proche(x.n, v))) continue;
      if (x.m2) {
        if (!surface || poste) continue;
        /* Au m² : à l'année, au mois, ou sans le dire (l'un ou l'autre). */
        if (x.periode !== 'mois' && proche(x.n, an / surface, 0.15)) continue;
        if (x.periode !== 'an' && proche(x.n, mois / surface, 0.15)) continue;
        ajoute({
          titre: `Le texte donne ${x.brut} le m²`,
          texte: `La fiche fait ${eur(an / surface)} HT HC le m² par an (${eur(an)} pour ${String(surface).replace('.', ',')}${NB}m²).`,
        });
        continue;
      }
      if (x.poste && !poste) continue;
      const fiche = `La fiche dit ${eur(an)} HT HC par an, soit ${eur(mois)} par mois`;
      if (x.periode === 'an') {
        if (proche(x.n, an)) continue;
        ajoute(proche(x.n, mois)
          ? { titre: `Le texte parle d’un loyer annuel de ${x.brut}`, texte: `${fiche} : dans le texte, c’est le loyer du mois. Écris «${NB}${eur(mois)} HT HC par mois${NB}» ou «${NB}${eur(an)} HT HC par an${NB}».` }
          : { titre: `Le texte parle d’un loyer annuel de ${x.brut}`, texte: `${fiche}. L’un des deux est à corriger.` });
      } else if (x.periode === 'mois') {
        if (proche(x.n, mois)) continue;
        ajoute(proche(x.n, an)
          ? { titre: `Le texte parle d’un loyer mensuel de ${x.brut}`, texte: `${fiche} : dans le texte, c’est le loyer de l’année. Écris «${NB}${eur(mois)} HT HC par mois${NB}».` }
          : { titre: `Le texte parle d’un loyer mensuel de ${x.brut}`, texte: `${fiche}. L’un des deux est à corriger.` });
      } else {
        if (proche(x.n, an) || proche(x.n, mois)) continue;
        ajoute({ titre: `Le texte parle d’un loyer de ${x.brut}`, texte: `${fiche}. Précise aussi s’il est annuel ou mensuel.` });
      }
    } else if (x.sorte === 'prix' && !loc && a.prix && !x.m2 && !x.periode) {
      if (proche(x.n, a.prix) || proche(x.n, a.net)) continue;
      ajoute({ titre: `Le texte parle d’un prix de ${x.brut}`, texte: `La fiche dit ${eur(a.prix)}${a.net && a.net !== a.prix ? ` (${eur(a.net)} hors honoraires)` : ''}. L’un des deux est à corriger.` });
    }
  }
  return out;
}
