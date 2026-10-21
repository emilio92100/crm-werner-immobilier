'use client';
/* ═══ Le rappel du secteur (V3.226) ═══════════════════════════════════════
   Alexandre : « quand on crée un bien, avant de le valider, un petit message
   de rappel : n'oubliez pas d'indiquer le secteur, c'est important pour le
   rapprochement. Pas obligatoire, mais un rappel avant d'enregistrer. Et
   pareil dans les critères de recherche d'un client. »

   Une petite fenêtre, jamais bloquante : le bouton principal mène là où
   l'on complète (ou, pour un bien, choisit directement un des quartiers
   connus de sa ville), l'autre enregistre quand même. Échap ou un clic à
   côté la referment sans rien faire. La fenêtre s'anime toute seule
   (src/lib/mouvement.ts) : elle se démonte simplement. */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Ic } from '@/components/documents/ApercuActe';
import r from './RappelSecteur.module.css';

export default function RappelSecteur({ titre, texte, choix, onChoisir, principal, onPrincipal, secondaire, onSecondaire, onFermer }: {
  titre: string;
  texte: string;
  /* Des quartiers connus, à choisir d'un clic (un bien de Boulogne : Silly-Gallieni…). */
  choix?: string[];
  onChoisir?: (q: string) => void;
  principal: string;
  onPrincipal: () => void;
  secondaire: string;
  onSecondaire: () => void;
  onFermer: () => void;
}) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onFermer(); } };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [onFermer]);
  const fen = (
    <div className={r.voile} onMouseDown={e => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className={r.fen} role="dialog" aria-modal="true" aria-labelledby="rappel-secteur-titre">
        <div className={r.tete}>
          <span className={r.ic}><Ic n="lieu" t={20} e={2} /></span>
          <h2 id="rappel-secteur-titre">{titre}</h2>
        </div>
        <p className={r.texte}>{texte}</p>
        {choix && choix.length > 0 && onChoisir && (
          <div className={r.choix}>
            <span className={r.choixT}>{'Choisis-le\u00a0:'}</span>
            <div className={r.puces}>
              {choix.map(q => <button key={q} type="button" className={r.puce} onClick={() => onChoisir(q)}>{q}</button>)}
            </div>
          </div>
        )}
        <div className={r.pied}>
          <button type="button" className={r.secondaire} onClick={onSecondaire}>{secondaire}</button>
          <button type="button" className={r.principal} onClick={onPrincipal}>{principal}</button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(fen, document.body);
}
