'use client';

import { useState } from 'react';
import s from './InterrupteurEspace.module.css';

/* L'interrupteur « Son espace client » (Werner, 21 octobre 2026) : un
   bouton qui glisse, anthracite éteint, orange allumé. Dans le formulaire
   d'un nouveau demandeur. `aria-pressed` : un vrai bouton à bascule pour les
   lecteurs d'écran. Le « ? » à côté déplie l'explication, en mots simples
   (Alexandre : « qu'il comprenne bien ce que c'est, et que c'est pour les
   clients qu'il suit avec un mandat de recherche »). */
const AIDE = [
  'Une page privée, rien qu’à lui, qu’il ouvre avec un lien. Pas de mot de passe, rien à installer.',
  'Il y retrouve tous les locaux que tu lui proposes, avec les photos et la fiche complète.',
  'Il te répond en un clic : « ça m’intéresse », « je souhaite le visiter », ou non avec son motif. Tu vois tout sur sa fiche.',
  'C’est pour les clients que tu suis vraiment, ceux pour qui tu cherches avec un mandat de recherche.',
  'Pour un simple contact ou une demande ponctuelle, laisse sur Non : tu peux quand même lui envoyer des locaux par mail, ils mèneront à leur fiche publique.',
];

export default function InterrupteurEspace({ on, onChange, titre = 'Son espace client', sous, occupe }: {
  on: boolean; onChange: (v: boolean) => void; titre?: string; sous?: string; occupe?: boolean;
}) {
  const [aide, setAide] = useState(false);
  return (
    <div className={s.cadre} data-on={on ? 'oui' : 'non'}>
      <div className={s.ligne}>
        <button type="button" className={s.inter} aria-pressed={on} disabled={occupe} onClick={() => onChange(!on)}>
          <span className={s.piste} aria-hidden="true"><span className={s.bouton} /></span>
          <span className={s.textes}>
            <b>{titre}<i>{on ? 'Oui' : 'Non'}</i></b>
            {sous ? <small>{sous}</small> : null}
          </span>
        </button>
        <button type="button" className={s.question} aria-expanded={aide} aria-label="L’espace client, c’est quoi ?"
          title="L’espace client, c’est quoi ?" onClick={() => setAide(x => !x)}>?</button>
      </div>
      {aide && (
        <div className={s.aide}>
          <b>{'L’espace client, c’est quoi ?'}</b>
          <ul>{AIDE.map(t => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
