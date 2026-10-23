'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Curseur from '@/components/shared/Curseur';
import s from './PeriodeVisites.module.css';

/* ═══ La période des visites (V3.241) ══════════════════════════════════════
   Alexandre (23 octobre 2026) : « effectuées, imaginons il y a 100 visites
   […] si on peut classer les visites par les 7 derniers jours, sur le mois,
   sur les 6 derniers mois, sur l'année, si on peut sélectionner les dates
   nous-mêmes […] bien joli, bien moderne, type SaaS ». Une barre de
   pastilles (la pastille glisse : Curseur) et « Dates… », qui ouvre un
   calendrier : un jour, puis un autre, et la période est faite. Les jours
   qui ont eu des visites portent un point. Rien n'est enregistré en base :
   la période vit avec la page (et revient au retour d'un bon de visite).

   Les dates sont des « AAAA-MM-JJ », comme `visites.date_visite`, comparées
   telles quelles (l'ordre des chaînes est celui des jours). */

export type CleP = 'tout' | '7j' | 'mois' | '6m' | 'annee' | 'dates';
export type Periode = { k: CleP; du?: string; au?: string };
export const PERIODE_TOUT: Periode = { k: 'tout' };
export type Bornes = { du: string; au: string };

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const jourDe = (k: string) => { const [a, m, j] = k.split('-').map(Number); return new Date(a, (m || 1) - 1, j || 1, 12); };
const decale = (k: string, jours: number, mois = 0) => { const d = jourDe(k); return ymd(new Date(d.getFullYear(), d.getMonth() + mois, d.getDate() + jours, 12)); };

/** Les bornes d'une période, aujourd'hui (`auj`, à Paris) ; null : toutes les dates. */
export function bornesDe(p: Periode, auj: string): Bornes | null {
  const d = jourDe(auj);
  switch (p.k) {
    case '7j': return { du: decale(auj, -6), au: auj };
    case 'mois': return { du: ymd(new Date(d.getFullYear(), d.getMonth(), 1, 12)), au: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)) };
    case '6m': return { du: decale(auj, 1, -6), au: auj };
    case 'annee': return { du: `${auj.slice(0, 4)}-01-01`, au: `${auj.slice(0, 4)}-12-31` };
    case 'dates': return p.du ? { du: p.du, au: p.au && p.au >= p.du ? p.au : p.du } : null;
    default: return null;
  }
}
/** Une date de visite dans la période (sans période : toujours ; sans date : jamais). */
export const dansBornes = (date: string | null | undefined, b: Bornes | null) => {
  if (!b) return true;
  const k = String(date || '').slice(0, 10);
  return !!k && k >= b.du && k <= b.au;
};

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** « 16 → 23 oct. », « 3 sept. → 12 oct. », « 12 déc. 2025 → 4 janv. » */
export function texteBornes(b: Bornes, auj: string): string {
  const [a1, m1, j1] = b.du.split('-').map(Number);
  const [a2, m2, j2] = b.au.split('-').map(Number);
  const an = (a: number) => (String(a) !== auj.slice(0, 4) ? ` ${a}` : '');
  if (b.du === b.au) return `${j1} ${MOIS_C[m1 - 1]}${an(a1)}`;
  if (a1 === a2 && m1 === m2) return `${j1} → ${j2} ${MOIS_C[m2 - 1]}${an(a2)}`;
  return `${j1} ${MOIS_C[m1 - 1]}${a1 !== a2 ? an(a1) || ` ${a1}` : ''} → ${j2} ${MOIS_C[m2 - 1]}${an(a2)}`;
}
/** Le mois d'une visite, pour les intercalaires : « Octobre 2026 ». */
export function moisDe(date: string | null | undefined): string {
  const k = String(date || '');
  if (!/^\d{4}-\d{2}/.test(k)) return 'Sans date';
  const m = MOIS[Number(k.slice(5, 7)) - 1] || '';
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${k.slice(0, 4)}`;
}

const CHOIX: { k: Exclude<CleP, 'dates'>; l: string }[] = [
  { k: '7j', l: '7 jours' },
  { k: 'mois', l: 'Ce mois' },
  { k: '6m', l: '6 mois' },
  { k: 'annee', l: 'Cette année' },
  { k: 'tout', l: 'Tout' },
];

function Cal({ t = 15 }: { t?: number }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function Fl({ g }: { g?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={g ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
    </svg>
  );
}

/** La barre : les pastilles, « Dates… », et ce qu'elle montre. */
export default function BarrePeriode({ valeur, onChange, auj, jours, compter, n, quoi }: {
  valeur: Periode; onChange: (p: Periode) => void;
  /** aujourd'hui, à Paris (« AAAA-MM-JJ ») */
  auj: string;
  /** le nombre de visites par jour, pour les points du calendrier */
  jours: Record<string, number>;
  /** combien de visites une période montrerait (le bouton du calendrier) */
  compter: (b: Bornes | null) => number;
  /** combien la page en montre, et de quoi (« visite effectuée ») */
  n: number; quoi: [string, string];
}) {
  const [ouvert, setOuvert] = useState(false);
  const b = bornesDe(valeur, auj);
  return (
    <div className={s.barre}>
      <div className={s.puces} role="group" aria-label="Période" data-defile="">
        <Curseur cle={valeur.k} />
        {CHOIX.map(c => (
          <button key={c.k} type="button" className={s.puce} aria-pressed={valeur.k === c.k} onClick={() => onChange({ k: c.k })}>{c.l}</button>
        ))}
      </div>
      {/* À part des pastilles : au téléphone, il reste en vue (à droite du compte). */}
      <button type="button" className={s.pDates} aria-pressed={valeur.k === 'dates'} onClick={() => setOuvert(true)}>
        <Cal t={14} /><span>{valeur.k === 'dates' && b ? texteBornes(b, auj) : 'Dates…'}</span>
      </button>
      <div className={s.resume} aria-live="polite">
        <b className={s.n} key={n}>{n}</b>
        <span>{n > 1 ? quoi[1] : quoi[0]}</span>
        {b && <span className={s.quand}>{texteBornes(b, auj)}</span>}
        {valeur.k !== 'tout' && <button type="button" className={s.effacer} onClick={() => onChange(PERIODE_TOUT)}>Tout voir</button>}
      </div>
      {ouvert && (
        <Calendrier auj={auj} jours={jours} compter={compter} depart={valeur.k === 'dates' ? b : null}
          onFermer={() => setOuvert(false)} onValider={x => { setOuvert(false); onChange(x ? { k: 'dates', du: x.du, au: x.au } : PERIODE_TOUT); }} />
      )}
    </div>
  );
}

/* ── Le calendrier « du … au … » ──
   Un jour, puis un autre : la période est faite (dans le désordre aussi). Un
   troisième appui recommence. Sur ordinateur, deux mois côte à côte, et la
   période se dessine sous la souris avant le second appui. */
function Calendrier({ auj, jours, compter, depart, onFermer, onValider }: {
  auj: string; jours: Record<string, number>; compter: (b: Bornes | null) => number;
  depart: Bornes | null; onFermer: () => void; onValider: (b: Bornes | null) => void;
}) {
  const [pret, setPret] = useState(false);
  const [du, setDu] = useState<string | null>(depart?.du || null);
  const [au, setAu] = useState<string | null>(depart?.au || null);
  const [survol, setSurvol] = useState<string | null>(null);
  /* Deux mois côte à côte sur ordinateur : ce mois-ci à droite. */
  const [large, setLarge] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches);
  const [mois, setMois] = useState(() => {
    const d = jourDe(depart?.du || auj);
    return new Date(d.getFullYear(), d.getMonth() - (!depart && large ? 1 : 0), 1, 12);
  });
  /* Le sens du dernier changement de mois : la grille glisse de ce côté. */
  const [sens, setSens] = useState(0);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    setPret(true);
    const mq = window.matchMedia('(min-width: 720px)');
    const lire = () => setLarge(mq.matches);
    lire(); mq.addEventListener?.('change', lire);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer.current(); };
    window.addEventListener('keydown', esc);
    return () => { mq.removeEventListener?.('change', lire); window.removeEventListener('keydown', esc); };
  }, []);
  if (!pret) return null;

  const appui = (k: string) => {
    if (!du || au) { setDu(k); setAu(null); return; }
    if (k < du) { setAu(du); setDu(k); } else setAu(k);
  };
  /* La période dessinée : choisie, ou en cours de choix sous la souris. */
  const fin = au || (du && survol ? survol : null);
  const [a, z] = du && fin ? (fin < du ? [fin, du] : [du, fin]) : [du, du];
  const choisie: Bornes | null = du ? { du: a || du, au: z || du } : null;
  const nb = compter(choisie);
  const raccourcis: { l: string; b: Bornes }[] = (() => {
    const d = jourDe(auj);
    const m = (n: number) => ({ du: ymd(new Date(d.getFullYear(), d.getMonth() + n, 1, 12)), au: ymd(new Date(d.getFullYear(), d.getMonth() + n + 1, 0, 12)) });
    const an = d.getFullYear();
    return [
      { l: '30 derniers jours', b: { du: decale(auj, -29), au: auj } },
      { l: 'Le mois dernier', b: m(-1) },
      { l: '3 derniers mois', b: { du: decale(auj, 1, -3), au: auj } },
      { l: 'L’an dernier', b: { du: `${an - 1}-01-01`, au: `${an - 1}-12-31` } },
    ];
  })();
  const moisAffiches = large ? [mois, new Date(mois.getFullYear(), mois.getMonth() + 1, 1, 12)] : [mois];
  const changer = (n: number) => { setSens(n); setMois(m => new Date(m.getFullYear(), m.getMonth() + n, 1, 12)); };
  const champ = (v: string | null, lib: string, actif: boolean) => (
    <span className={s.champ} data-actif={actif ? 'oui' : undefined}>
      <small>{lib}</small>
      <b key={v || 'vide'} className={s.champVal}>{v ? jourDe(v).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: v.slice(0, 4) !== auj.slice(0, 4) ? 'numeric' : undefined }) : '—'}</b>
    </span>
  );

  return createPortal(
    <div className={s.voile} onMouseDown={e => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className={s.fen} role="dialog" aria-modal="true" aria-label="Choisir les dates">
        <header className={s.tete}>
          <span className={s.teteIc}><Cal t={18} /></span>
          <span className={s.teteTx}><b>Choisir les dates</b><small>{du && !au ? 'Puis le dernier jour.' : 'Touchez le premier jour, puis le dernier.'}</small></span>
          <button type="button" className={s.fermer} onClick={onFermer} aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        {/* Ce qui sera choisi : sous la souris, l'aperçu ; sinon les deux bouts. */}
        <div className={s.champs}>
          {champ(choisie ? choisie.du : null, 'Du', !du || !!au)}
          <span className={s.vers} aria-hidden="true"><Fl /></span>
          {champ(choisie && (au || (survol && survol !== du)) ? choisie.au : null, 'Au', !!du && !au)}
        </div>

        <div className={s.raccourcis} data-defile="">
          {raccourcis.map(r => {
            const on = !!du && !!au && du === r.b.du && au === r.b.au;
            return (
              <button key={r.l} type="button" className={s.racc} aria-pressed={on}
                onClick={() => {
                  const cible = new Date(jourDe(r.b.du).getFullYear(), jourDe(r.b.du).getMonth(), 1, 12);
                  setSens(cible < mois ? -1 : cible > mois ? 1 : 0);
                  setDu(r.b.du); setAu(r.b.au); setMois(cible);
                }}>{r.l}</button>
            );
          })}
        </div>

        <div className={s.mois} onMouseLeave={() => setSurvol(null)}>
          {moisAffiches.map((m, i) => {
            const decalage = (m.getDay() + 6) % 7;
            const nbJ = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
            const cases: (string | null)[] = [...Array(decalage).fill(null), ...Array.from({ length: nbJ }, (_, j) => ymd(new Date(m.getFullYear(), m.getMonth(), j + 1, 12)))];
            return (
              <div key={`${m.getFullYear()}-${m.getMonth()}`} className={s.unMois}>
                <div className={s.moisTete}>
                  {i === 0 ? <button type="button" className={s.nav} onClick={() => changer(-1)} aria-label="Mois précédent"><Fl g /></button> : <span className={s.navVide} />}
                  <b>{`${MOIS[m.getMonth()].charAt(0).toUpperCase()}${MOIS[m.getMonth()].slice(1)} ${m.getFullYear()}`}</b>
                  {i === moisAffiches.length - 1 ? <button type="button" className={s.nav} onClick={() => changer(1)} aria-label="Mois suivant"><Fl /></button> : <span className={s.navVide} />}
                </div>
                <div className={s.grille} key={`g${m.getFullYear()}-${m.getMonth()}`} data-sens={sens > 0 ? 'av' : sens < 0 ? 'ar' : undefined}>
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, x) => <span key={x} className={s.js}>{j}</span>)}
                  {cases.map((k, x) => {
                    if (!k) return <span key={`v${x}`} />;
                    const dedans = !!choisie && k >= choisie.du && k <= choisie.au;
                    const bout = !!choisie && (k === choisie.du || k === choisie.au);
                    const nbV = jours[k] || 0;
                    return (
                      <button key={k} type="button" className={s.jour} onClick={() => appui(k)} onMouseEnter={() => setSurvol(k)}
                        data-dans={dedans ? 'oui' : undefined} data-bout={bout ? (k === choisie?.du ? (k === choisie?.au ? 'seul' : 'debut') : 'fin') : undefined}
                        data-auj={k === auj ? 'oui' : undefined}
                        aria-label={`${jourDe(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${nbV ? `, ${nbV} visite${nbV > 1 ? 's' : ''}` : ''}`}>
                        <span>{Number(k.slice(8))}</span>
                        {nbV > 0 && <i aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className={s.legende}><i aria-hidden="true" /><span>un jour avec des visites</span></div>

        <footer className={s.pied}>
          <button type="button" className={s.btn} onClick={() => onValider(null)}>Toutes les dates</button>
          <button type="button" className={`${s.btn} ${s.btnPlein}`} disabled={!du} onClick={() => onValider(choisie)}>
            {du ? (nb ? `Voir ${nb > 1 ? `les ${nb} visites` : 'la visite'}` : 'Aucune visite, voir quand même') : 'Choisissez un jour'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
