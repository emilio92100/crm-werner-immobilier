'use client';
/* ═══ « Comment marche le rapprochement ? » (V3.228) ══════════════════════
   Alexandre : « qu'on ait toujours des explications, étape par étape, avec
   des mots simples… bien présenté, joli, un petit pop-up avec une belle
   animation, des icônes… claires, précises et surtout fiables par rapport
   au code. Comme ça je n'oublie pas : je peux toujours appuyer sur la
   petite partie explication pour me remémorer. »

   Repris du CRM d'Emilio (sa V3.228), avec les mots et les règles de Werner
   (affaire, demandeur, loyer ou prix, « pas ce qu'il cherche »).

   Une fenêtre en quatre étapes (où il cherche, le premier tri, la relecture,
   et après), ouverte par le bouton « Comment ça marche ? » de l'onglet
   Rapprochement d'un bien (RapprochementBien) et de celui d'un client
   (GuideRapprochement), et par le « ? » de sa fenêtre de recherche.

   ⚠️ Chaque phrase dit ce que fait le code. Une règle qui change change ici
   aussi : src/lib/rapprochement.ts (où il cherche, côté client),
   components/biens/outils.ts (triBien, côté bien), src/lib/ecart-acheteur.ts
   (écartés d'office), src/lib/correspondance.ts et src/lib/quartiers.ts (la
   note, le secteur), app/api/rapprochement-ia (la relecture).

   La fenêtre s'anime toute seule en s'ouvrant (src/lib/mouvement.ts) ; le
   passage d'une étape à l'autre glisse (Curseur) et monte en cascade
   (Cascade). Échap, ou un clic à côté, la ferme ; ← → changent d'étape. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Ic } from '@/components/documents/ApercuActe';
import Curseur from '@/components/shared/Curseur';
import Cascade from '@/components/shared/Cascade';
import a from './AideRapprochement.module.css';

export type DepuisAide = 'bien' | 'client';
type Point = { ic: string; t: string; d: ReactNode; ton?: 'non' | 'oui' | 'or' };
type Etape = { ic: string; court: string; titre: string; chapeau: string; points: Point[] };

/* Les mots du CRM de Werner : affaire, demandeur, « Disponible ». */
const ETAPES = (depuis: DepuisAide): Etape[] => [
  {
    ic: 'loupe', court: 'Où il cherche', titre: depuis === 'client' ? 'Où il cherche, depuis la fiche d’un client' : 'Où il cherche, depuis la fiche d’une affaire',
    chapeau: depuis === 'client'
      ? 'Tu choisis où chercher. Il compare sa recherche avec chacune des affaires cochées.'
      : 'Il compare cette affaire avec les recherches de tes demandeurs.',
    points: depuis === 'client' ? [
      { ic: 'maison', t: 'Tes affaires en cours', d: 'Tes affaires à l’étape « Disponible ». Pas celles déjà sous offre ou en signature.' },
      { ic: 'etiquette', t: 'Tes estimations, si tu coches la case', d: 'Les affaires pas encore sous mandat (estimation, à suivre). S’il en reçoit une, il la reçoit sans montant : le montant arrive chez lui à la signature du mandat.', ton: 'or' },
      { ic: 'loupe', t: 'Les annonces de tes veilles', d: 'Trouvées pour tes autres clients, sur la période choisie : 1 mois, 3 mois, 6 mois ou depuis le début. Celles que tu as écartées n’y sont pas. Une annonce trouvée pour plusieurs clients n’apparaît qu’une fois.' },
      { ic: 'cadenas', t: 'Jamais ses propres affaires', d: 'Une affaire dont il est le mandant ne lui est pas proposée.' },
    ] : [
      { ic: 'groupe', t: 'Tes demandeurs suivis', d: 'Leurs recherches ouvertes : accompagnés, en recherche, en pause. Pas ceux qui ont trouvé ou abandonné, ni les contacts archivés.' },
      { ic: 'maison', t: 'Le même type de local', d: 'Des bureaux pour qui cherche des bureaux, un local commercial pour qui cherche un local commercial (un restaurant en est un). Une recherche sans type accepte tout.' },
      { ic: 'cadenas', t: 'Jamais le mandant', d: 'Le mandant de cette affaire n’est pas proposé.' },
      { ic: 'etiquette', t: 'Même avant le mandat', d: 'Une affaire en estimation ou à suivre se rapproche déjà. Présentée, elle part sans montant : il arrive chez le demandeur à la signature du mandat.', ton: 'or' },
    ],
  },
  {
    ic: 'cible', court: 'Le premier tri', titre: 'Le premier tri : les critères',
    chapeau: 'Chaque critère de sa recherche est comparé à la fiche, les plus importants comptent plus. Ça donne une note sur 100.',
    points: [
      { ic: 'croix', t: 'Écartés d’office, quelle que soit la note', ton: 'non', d: (
        <ul className={a.puces}>
          <li>{'un loyer ou un prix dépassé de plus de 10 %'}</li>
          <li>{'pas ce qu’il cherche (une location pour qui veut acheter des murs…)'}</li>
          <li>{'une autre ville, ou à Paris un autre arrondissement'}</li>
          <li>{'une surface sous 90 % de son minimum'}</li>
          <li>{'un indispensable qui manque (seulement si la fiche de l’affaire le renseigne)'}</li>
        </ul>
      ) },
      { ic: 'lieu', t: 'Le quartier', d: 'Un nom contenu dans l’autre suffit (Sentier = Le Sentier), sans compter accents ni petits mots. Un quartier de référence couvre ses lieux : les Champs-Élysées couvrent le Triangle d’or. Un autre quartier que les siens : au mieux « en partie », à toi de juger.' },
      { ic: 'check', t: 'La note', ton: 'oui', d: '70 % et plus : il correspond. De 50 à 69 % : en partie. Sous 50 % : il n’est pas montré.' },
      { ic: 'info', t: 'Une recherche à compléter', d: depuis === 'client'
        ? 'Sans budget ni loyer maximum, ou sans secteur, le tri ne peut pas juger ces critères-là. Plus sa recherche est complète, plus le tri est juste.'
        : 'Sans budget ni loyer maximum, ou sans secteur, elle est quand même relue, mais ne compte pas dans « Demandeurs potentiels » : complète-la.' },
    ],
  },
  {
    ic: 'etincelle', court: 'La relecture', titre: 'La relecture, dossier par dossier',
    chapeau: depuis === 'client'
      ? 'Tes affaires qui passent le tri sont relues face à tout son dossier, 24 au plus. Les annonces des veilles, déjà lues par la veille, gardent leur note de critères.'
      : 'Chaque demandeur qui passe le tri est relu face à toute la fiche de cette affaire.',
    points: [
      { ic: 'oeil', t: 'Ce qui est lu', d: 'Ses indispensables, ses précisions, son parcours, ses comptes rendus de visite, ce qu’il a dit des affaires déjà montrées, face à toute la fiche de l’affaire et à ta visite sur place.' },
      { ic: 'bouclier', t: 'Ce qui n’est jamais lu', d: 'Ni nom, ni téléphone, ni adresse.' },
      { ic: 'etoile', t: 'Ce que tu obtiens', ton: 'oui', d: 'Un avis : Oui, À voir ou Non. Une note de potentiel sur 100 : ses chances d’être intéressé. Une phrase, ses plus et ses moins.' },
      { ic: 'euro', t: 'Le loyer et le prix', d: 'Jusqu’à environ 7 % au-dessus de son loyer maximum ou de son budget, ça se négocie : ce n’est pas une raison de dire non.' },
      { ic: 'historique', t: 'Le même avis des deux côtés', d: 'L’avis est gardé pour chaque affaire et chaque recherche : depuis la fiche de l’affaire ou celle du client, c’est le même. Relancé, il ne relit que ce qui a changé.' },
    ],
  },
  {
    ic: 'envoyer', court: 'Et après', titre: 'Et après : tu choisis',
    chapeau: 'Rien n’est coché, rien ne part tout seul.',
    points: depuis === 'client' ? [
      { ic: 'check', t: 'Tu coches', d: '« Cocher les oui » coche d’un coup tous les Oui ; tu ajoutes ou retires les autres.' },
      { ic: 'liste', t: 'Trois façons de lui donner', d: 'Dans sa sélection (rien ne part), dans son espace (sans mail : elle passe dans Présentés), ou par mail (le mail habituel, tu le relis). Son Suivi le note.' },
      { ic: 'dossier', t: 'Déjà dans son dossier', d: 'Une affaire déjà en sélection ou déjà présentée n’est pas reproposée : elle est rangée à part, avec ce qui en a été fait et sa réponse.' },
      { ic: 'maison', t: 'Vu depuis tes affaires', d: 'Un rapprochement lancé depuis la fiche d’une de tes affaires, où il est ressorti, s’affiche sur sa fiche (onglet Rapprochement) et dans son Suivi, avec le même avis.' },
      { ic: 'croix', t: '« Pas pour lui »', d: 'Posé depuis la fiche d’une affaire : elle ne lui est plus proposée, d’un côté comme de l’autre. Tu peux le remettre depuis l’affaire.' },
    ] : [
      { ic: 'check', t: 'Tu coches', d: '« Cocher les oui » coche d’un coup tous les Oui ; tu ajoutes ou retires les autres.' },
      { ic: 'envoyer', t: 'Envoyer…', d: 'Dans sa sélection, dans son espace ou par mail, comme depuis sa fiche. Son Suivi le note.' },
      { ic: 'dossier', t: 'Déjà présentée', d: 'Sa case est grisée : il l’a déjà. « Renvoyer… » reste possible.' },
      { ic: 'croix', t: '« Pas pour lui »', d: 'Il ne te sera plus proposé sur cette affaire, ni ici ni depuis sa fiche. « Le remettre » l’annule.' },
      { ic: 'historique', t: 'Gardé, daté, des deux côtés', d: 'Chaque rapprochement reste ici avec sa date. Sur la fiche de chaque demandeur ressorti, il apparaît aussi : onglet Rapprochement (« Vu depuis tes affaires ») et Suivi.' },
    ],
  },
];

export default function AideRapprochement({ depuis, onFermer, debut = 0 }: { depuis: DepuisAide; onFermer: () => void; debut?: number }) {
  const etapes = ETAPES(depuis);
  const [i, setI] = useState(Math.min(Math.max(debut, 0), etapes.length - 1));
  const e = etapes[i];
  const dernier = i === etapes.length - 1;
  /* Au téléphone, l'étape choisie reste visible dans la barre qui défile. */
  const barre = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barre.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && barre.current) barre.current.scrollTo({ left: el.offsetLeft - (barre.current.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [i]);
  useEffect(() => {
    const touche = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.stopImmediatePropagation(); onFermer(); }
      else if (ev.key === 'ArrowRight') setI(x => Math.min(x + 1, etapes.length - 1));
      else if (ev.key === 'ArrowLeft') setI(x => Math.max(x - 1, 0));
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [onFermer, etapes.length]);

  const fen = (
    <div className={a.voile} onMouseDown={ev => { if (ev.target === ev.currentTarget) onFermer(); }}>
      <div className={a.fen} role="dialog" aria-modal="true" aria-labelledby="aide-rappro-titre">
        <div className={a.tete}>
          <span className={a.teteIc}><Ic n="etoile" t={22} e={2} /></span>
          <div className={a.teteTx}>
            <h2 id="aide-rappro-titre">{'Comment marche le rapprochement'}</h2>
            <span>{depuis === 'client' ? 'Depuis la fiche d’un client' : 'Depuis la fiche d’une affaire'}</span>
          </div>
          <button type="button" className={a.fermer} aria-label="Fermer" onClick={onFermer}><Ic n="croix" t={16} e={2.4} /></button>
        </div>

        <div className={a.etapes} role="tablist" aria-label="Les étapes" data-defile="" ref={barre}>
          <Curseur cle={i} />
          {etapes.map((x, k) => (
            <button key={x.court} type="button" role="tab" aria-selected={k === i} aria-pressed={k === i} className={a.etape} onClick={() => setI(k)}>
              <span className={a.etapeN}>{k + 1}</span><span>{x.court}</span>
            </button>
          ))}
        </div>

        <Cascade cle={i} className={a.corps}>
          <div className={a.titreE}>
            <span className={a.titreIc}><Ic n={e.ic} t={20} e={2} /></span>
            <div>
              <h3>{e.titre}</h3>
              <p>{e.chapeau}</p>
            </div>
          </div>
          {e.points.map(p => (
            <div key={p.t} className={a.point} data-ton={p.ton || ''}>
              <span className={a.pointIc}><Ic n={p.ic} t={17} e={2} /></span>
              <div className={a.pointTx}>
                <b>{p.t}</b>
                {typeof p.d === 'string' ? <p>{p.d}</p> : p.d}
              </div>
            </div>
          ))}
        </Cascade>

        <div className={a.pied}>
          <button type="button" className={a.btnL} disabled={i === 0} onClick={() => setI(x => x - 1)}>
            <Ic n="gauche" t={15} e={2.4} /><span>{'Précédent'}</span>
          </button>
          <span className={a.points} aria-hidden="true">{etapes.map((x, k) => <i key={x.court} data-on={k === i ? 'oui' : ''} />)}</span>
          {dernier
            ? <button type="button" className={a.btnP} onClick={onFermer}><Ic n="check" t={15} e={2.6} /><span>{'J’ai compris'}</span></button>
            : <button type="button" className={a.btnP} onClick={() => setI(x => x + 1)}><span>{'Suivant'}</span><Ic n="droite" t={15} e={2.4} /></button>}
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(fen, document.body);
}

/* Le bouton qui l'ouvre, partout le même. */
export function BoutonAideRappro({ depuis, className, libelle = 'Comment ça marche ?' }: { depuis: DepuisAide; className?: string; libelle?: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" className={`${a.ouvrir} ${className || ''}`} onClick={() => setOuvert(true)}>
        <span className={a.ouvrirIc}><Ic n="info" t={14} e={2.2} /></span><span>{libelle}</span>
      </button>
      {ouvert && <AideRapprochement depuis={depuis} onFermer={() => setOuvert(false)} />}
    </>
  );
}
