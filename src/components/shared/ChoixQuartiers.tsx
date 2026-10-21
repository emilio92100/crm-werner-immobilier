'use client';
/* ═══ Les quartiers à choisir (V3.227) ═══════════════════════════════════
   Alexandre : « les quartiers de référence, présélectionnés, sur le bien
   comme dans la recherche du client ; il peut toujours en ajouter un
   lui-même ; bien présenté, joli, avec des icônes ».

   Un bloc par quartier de référence (punaise), avec dessous les noms que
   les agents emploient pour ce qui est dedans (Trocadéro sous Chaillot) ;
   puis « Aussi utilisés » : les noms qui chevauchent plusieurs quartiers.
   Un choix porte une coche. Le même composant sert au champ Quartier d'un
   bien (un seul choix), au rappel du secteur et à la recherche d'un client
   (plusieurs choix). La saisie libre reste à côté, chez chacun. */

import { Ic } from '@/components/documents/ApercuActe';
import { memeNom, type CommuneRef } from '@/lib/quartiers';
import q from './ChoixQuartiers.module.css';

function Puce({ nom, petit, choisi, off, onClick }: { nom: string; petit?: boolean; choisi: boolean; off?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={petit ? q.lieu : q.ref} aria-pressed={choisi} disabled={off} onClick={onClick}>
      {choisi ? <Ic n="check" t={petit ? 11 : 13} e={2.6} /> : petit ? null : <Ic n="lieu" t={13} e={2} />}
      <span>{nom}</span>
    </button>
  );
}

export default function ChoixQuartiers({ commune, choisis, onChoisir, titre, off }: {
  commune: CommuneRef;
  /* Ce qui est déjà choisi (une écriture voisine compte : « Epinettes »). */
  choisis: string[];
  onChoisir: (nom: string) => void;
  titre?: string;
  off?: boolean;
}) {
  const est = (n: string) => choisis.some(x => memeNom(x, n));
  const avecLieux = commune.quartiers.some(x => x.lieux?.length);
  return (
    <div className={q.boite}>
      {titre && <div className={q.titre}><Ic n="boussole" t={14} /><span>{titre}</span></div>}
      <div className={avecLieux ? q.grille : q.ligne}>
        {commune.quartiers.map(x => (
          <div key={x.nom} className={q.groupe}>
            <Puce nom={x.nom} choisi={est(x.nom)} off={off} onClick={() => onChoisir(x.nom)} />
            {x.lieux?.length ? (
              <div className={q.lieux}>
                {x.lieux.map(l => <Puce key={l} nom={l} petit choisi={est(l)} off={off} onClick={() => onChoisir(l)} />)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {commune.autres?.length ? (
        <div className={q.autres}>
          <span className={q.autresT}>Aussi utilisés</span>
          <div className={q.lieux}>
            {commune.autres.map(l => <Puce key={l} nom={l} petit choisi={est(l)} off={off} onClick={() => onChoisir(l)} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
