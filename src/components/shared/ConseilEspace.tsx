'use client';

import s from './ConseilEspace.module.css';

/* ══ Un conseil avant d'ouvrir un espace client (Werner, 22 octobre 2026) ══
   Alexandre : « privilégier cet espace pour les clients qu'il pense suivre de
   façon intensive ; si vous lui proposez l'espace, il attendra que cet espace
   soit mis à jour régulièrement par vous. Un petit message de rappel quand il
   crée le contact, quand il choisit, quand il passe en actif ». Affiché à la
   création d'un demandeur (« Actif » choisi), dans la fenêtre « Passer en
   Actif », sur l'onglet « Son espace » d'un demandeur sans espace, et au
   changement en lot vers « Actif ». `plusieurs` : le même conseil au pluriel. */
export default function ConseilEspace({ plusieurs = false }: { plusieurs?: boolean }) {
  return (
    <div className={s.conseil} role="note">
      <span className={s.ic} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z" />
        </svg>
      </span>
      <span className={s.tx}>
        <b>{'Un conseil'}</b>
        <span>{plusieurs
          ? 'Réserve l’espace aux demandeurs que tu suis de près. Avec leur espace, ils s’attendent à le voir vivre : de nouveaux locaux, tes retours, leurs visites. S’il reste sans nouvelles plusieurs semaines, ils penseront qu’on ne cherche plus pour eux.'
          : 'Réserve l’espace aux demandeurs que tu suis de près. Avec son espace, le client s’attend à le voir vivre : de nouveaux locaux, tes retours, ses visites. S’il reste sans nouvelles plusieurs semaines, il pensera qu’on ne cherche plus pour lui.'}</span>
      </span>
    </div>
  );
}
