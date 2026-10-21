'use client';
import type { Ecart } from '@/lib/controle-montants';
import e from './EcartsAnnonce.module.css';

/* ═══ Les montants à vérifier dans l'annonce (22 octobre 2026) ═════════════
   Le texte de l'annonce et la fiche ne disent pas le même montant
   (src/lib/controle-montants.ts) : la carte de l'annonce, la fenêtre
   « Modifier l'annonce » et la fenêtre de diffusion le montrent, avec de
   quoi corriger. Rien n'est bloqué. */

const Triangle = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4.2" /><path d="M12 17.2h.01" />
  </svg>
);

export default function EcartsAnnonce({ ecarts, avant, onCorriger, libelle = 'Modifier l’annonce' }: {
  ecarts: Ecart[];
  /* « avant de diffuser » : la phrase du haut le dit. */
  avant?: boolean;
  onCorriger?: () => void; libelle?: string;
}) {
  if (!ecarts.length) return null;
  const n = ecarts.length;
  return (
    <div className={e.cadre} role="status">
      <div className={e.tete}>
        <span className={e.ic}><Triangle /></span>
        <span className={e.teteT}>
          <b>{n > 1 ? `${n} montants à vérifier${avant ? ' avant de diffuser' : ''}` : `Un montant à vérifier${avant ? ' avant de diffuser' : ''}`}</b>
          <small>{'Le texte de l’annonce et la fiche ne disent pas la même chose. Le site montre les deux : un preneur verrait l’écart.'}</small>
        </span>
        {onCorriger && <button type="button" className={e.btn} onClick={onCorriger}>{libelle}</button>}
      </div>
      <ul className={e.liste}>
        {ecarts.map(x => <li key={x.titre}><b>{x.titre}</b><span>{x.texte}</span></li>)}
      </ul>
    </div>
  );
}
