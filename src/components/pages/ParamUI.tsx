'use client';
/* ═══ Paramètres : les pièces communes (23 octobre 2026) ════════════════════
   Les icônes dessinées (pas d'émoji : AGENTS.md §5), la tête d'une rubrique,
   la carte, l'interrupteur, les pastilles d'état, les étapes « Comment ça
   marche », les notes. Les styles : Parametres.module.css.
   Tout est déclaré au niveau du module (AGENTS.md §2.4). */
import type { ReactNode } from 'react';
import p from './Parametres.module.css';

const TRACES: Record<string, string[]> = {
  agence: ['M4 21V6.5L12 3l8 3.5V21', 'M2.5 21h19', 'M9.5 21v-5h5v5', 'M8.5 9h1.5', 'M14 9h1.5', 'M8.5 12.5h1.5', 'M14 12.5h1.5'],
  mail: ['M4 6h16v12H4z', 'M4 7l8 6 8-6'],
  cloche: ['M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z', 'M10 20.5a2 2 0 0 0 4 0'],
  avion: ['M21 3 10.5 13.5', 'M21 3l-6.5 18-4-7.5L3 9.5z'],
  cadenas: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3', 'M12 15v2.5'],
  relance: ['M4 12a8 8 0 0 1 14-5.3', 'M18 3v4h-4', 'M20 12a8 8 0 0 1-14 5.3', 'M6 21v-4h4'],
  reglage: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  check: ['M5 12.5l4.2 4.2L19 7'],
  croix: ['M6 6l12 12', 'M18 6L6 18'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 7.5v.5'],
  attention: ['M12 3.5 2.5 20h19z', 'M12 10v4.5', 'M12 17.5v.5'],
  horloge: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  personne: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20.5a7.5 7.5 0 0 1 15 0'],
  groupe: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.3a3.5 3.5 0 0 1 0 6.4', 'M18.5 14a6.5 6.5 0 0 1 3 6'],
  cle: ['M8.5 15.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8z', 'M11.5 11.5H21', 'M18 11.5V15', 'M15 11.5V14'],
  oeil: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  oeilBarre: ['M3 3l18 18', 'M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4', 'M6.6 6.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4.4-1.1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  bouclier: ['M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6z', 'M8.8 12.2l2.2 2.2 4.4-4.6'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
  serveur: ['M4 4h16v6H4z', 'M4 14h16v6H4z', 'M7.5 7h.5', 'M7.5 17h.5'],
  doc: ['M7 3h7l4 4v14H7z', 'M14 3v4h4', 'M9.5 12h5', 'M9.5 15.5h5'],
  plume: ['M4 20l4-1 10-10-3-3L5 16z', 'M13.5 7.5l3 3'],
  calendrier: ['M4 6h16v15H4z', 'M4 10h16', 'M8.5 3v4', 'M15.5 3v4'],
  carte: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  euro: ['M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5', 'M4.5 10.5h9', 'M4.5 13.5h9'],
  balance: ['M12 4v16', 'M7 20h10', 'M5 8h14', 'M5 8l-2.5 6a2.5 2.5 0 0 0 5 0z', 'M19 8l-2.5 6a2.5 2.5 0 0 0 5 0z'],
  tel: ['M6.2 3h3.1l1.5 3.9-2 1.3a13.6 13.6 0 0 0 7 7l1.3-2 3.9 1.5v3.1a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.2 5.2 2 2 0 0 1 6.2 3z'],
  historique: ['M3.5 12a8.5 8.5 0 1 0 2.5-6', 'M3 4v4h4', 'M12 8v4.5l3 2'],
  etincelle: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M6 6l2.5 2.5', 'M15.5 15.5 18 18', 'M18 6l-2.5 2.5', 'M8.5 15.5 6 18'],
  envoi: ['M4 12h12', 'M12 6l6 6-6 6', 'M20 5v14'],
  fleche: ['M5 12h14', 'M13 6l6 6-6 6'],
  ecran: ['M3 5h18v11H3z', 'M8 20h8', 'M12 16v4'],
  message: ['M4 5h16v11H9l-5 4z'],
  pause: ['M8 5v14', 'M16 5v14'],
  ouvrir: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
  pinceau: ['M16 3.5 20.5 8 11 17.5l-4.5-4.5z', 'M6.5 13 4 20l7-2.5'],
  pin: ['M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z', 'M12 12.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  trombone: ['M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1L13 4.3a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4L14.6 7.3'],
  chevron: ['M9 6l6 6-6 6'],
  enregistrer: ['M5 4h11l3 3v13H5z', 'M8 4v5h7V4', 'M8 20v-6h8v6'],
};

export function Ico({ n, t = 18, e = 1.9 }: { n: string; t?: number; e?: number }) {
  const traces = TRACES[n] || TRACES.info;
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={e} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {traces.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/** La tête d'une rubrique : son icône (qui respire), son titre, ce qu'elle règle. */
export function Hero({ ic, titre, texte, droite }: { ic: string; titre: string; texte: ReactNode; droite?: ReactNode }) {
  return (
    <div className={p.hero}>
      <span className={p.heroIc}><Ico n={ic} t={24} /></span>
      <div className={p.heroTx}>
        <h2>{titre}</h2>
        <p>{texte}</p>
      </div>
      {droite && <div className={p.heroDroite}>{droite}</div>}
    </div>
  );
}

export function Carte({ ic, titre, sous, droite, children, className }: {
  ic?: string; titre?: string; sous?: ReactNode; droite?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <section className={`${p.carte} ${className || ''}`}>
      {titre && (
        <div className={p.carteTete}>
          {ic && <span className={p.carteIc}><Ico n={ic} t={18} /></span>}
          <div className={p.carteTeteTx}>
            <h3>{titre}</h3>
            {sous && <p>{sous}</p>}
          </div>
          {droite && <div className={p.carteTeteDroite}>{droite}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** L'interrupteur : il glisse, et sa coche apparaît. */
export function Interrupteur({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={p.inter} onClick={onClick} disabled={disabled}>
      <span className={p.interRond}><Ico n="check" t={13} e={3} /></span>
    </button>
  );
}

export type Ton = 'vert' | 'or' | 'gris' | 'rouge';
const TON_CLASSE: Record<Ton, string> = { vert: p.pVert, or: p.pOr, gris: p.pGris, rouge: p.pRouge };
/** Une pastille d'état ; verte ou orange, son point respire. */
export function Pastille({ ton, children }: { ton: Ton; children: ReactNode }) {
  return <span className={`${p.pastille} ${TON_CLASSE[ton]}`}><i />{children}</span>;
}

export function Enregistre({ t = 'Enregistré' }: { t?: string }) {
  return <span className={p.enregistre} role="status"><Ico n="check" t={13} e={2.6} />{t}</span>;
}

export type TonNote = 'info' | 'ok' | 'attention' | 'erreur';
const NOTE_CLASSE: Record<TonNote, string> = { info: p.noteInfo, ok: p.noteOk, attention: p.noteAttention, erreur: p.noteErreur };
const NOTE_IC: Record<TonNote, string> = { info: 'info', ok: 'check', attention: 'attention', erreur: 'attention' };
export function Note({ ton = 'info', children }: { ton?: TonNote; children: ReactNode }) {
  return <div className={`${p.note} ${NOTE_CLASSE[ton]}`} role={ton === 'erreur' ? 'alert' : undefined}><Ico n={NOTE_IC[ton]} t={17} /><div>{children}</div></div>;
}

/** « Comment ça marche » : quatre étapes, et un point orange qui les parcourt. */
export function Etapes({ items }: { items: { ic: string; titre: string; texte: string }[] }) {
  return (
    <div className={p.etapes}>
      <i className={p.etapesPoint} aria-hidden="true" />
      {items.map(x => (
        <div key={x.titre} className={p.etape}>
          <span className={p.etapeN}><Ico n={x.ic} t={20} /></span>
          <div><b>{x.titre}</b><span>{x.texte}</span></div>
        </div>
      ))}
    </div>
  );
}

/** Des tuiles : une icône, un texte. */
export function Tuiles({ items }: { items: { ic: string; t: ReactNode; ton?: 'oui' | 'non' | 'neutre' }[] }) {
  return (
    <div className={p.tuiles}>
      {items.map((x, i) => (
        <div key={i} className={`${p.tuile} ${x.ton === 'oui' ? p.tuileOui : x.ton === 'non' ? p.tuileNon : p.tuileNeutre}`}>
          <Ico n={x.ic} t={16} e={2.2} /><span>{x.t}</span>
        </div>
      ))}
    </div>
  );
}

/** L'anneau du résumé : « 12 sur 15 ». */
export function Anneau({ n, sur }: { n: number; sur: number }) {
  const r = 31, c = 2 * Math.PI * r, part = sur ? n / sur : 0;
  return (
    <div className={p.anneau}>
      <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true">
        <circle cx="37" cy="37" r={r} fill="none" stroke="#f1f1f0" strokeWidth="7" />
        <circle cx="37" cy="37" r={r} fill="none" stroke="#16a34a" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - part)} />
      </svg>
      <div className={p.anneauTx}><b>{n}</b><small>{`sur ${sur}`}</small></div>
    </div>
  );
}

/* Les guillemets et les deux-points ne se séparent pas de leur mot en bout de ligne. */
export const fr = (t: string) => t.replace(/« /g, '« ').replace(/ »/g, ' »').replace(/ ([:;?!])/g, ' $1');

export const initiales = (t: string) => t.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map(x => x.charAt(0).toUpperCase()).join('') || '·';

export { p as styles };
