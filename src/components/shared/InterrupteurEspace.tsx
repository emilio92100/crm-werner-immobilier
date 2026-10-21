'use client';

import s from './InterrupteurEspace.module.css';

/* L'interrupteur « Son espace client » (Werner, 21 octobre 2026) : un
   bouton qui glisse, anthracite éteint, orange allumé. Dans le formulaire
   d'un nouveau demandeur et sur sa fiche. `aria-pressed` : un vrai bouton à
   bascule pour les lecteurs d'écran. */
export default function InterrupteurEspace({ on, onChange, titre = 'Son espace client', sous, occupe }: {
  on: boolean; onChange: (v: boolean) => void; titre?: string; sous?: string; occupe?: boolean;
}) {
  return (
    <button type="button" className={s.inter} data-on={on ? 'oui' : 'non'} aria-pressed={on} disabled={occupe}
      onClick={() => onChange(!on)}>
      <span className={s.piste} aria-hidden="true"><span className={s.bouton} /></span>
      <span className={s.textes}>
        <b>{titre}<i>{on ? 'Oui' : 'Non'}</i></b>
        {sous ? <small>{sous}</small> : null}
      </span>
    </button>
  );
}
