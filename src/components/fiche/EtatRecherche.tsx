'use client';

/* ═══ Où en est la recherche : la fenêtre, et le voile du bloc ═══════════
   V3.240 chez Werner : repris du CRM d'Emilio (V3.237), avec les mots de
   Werner (« En recherche », « Accompagné » = son espace client et
   l'accompagnement sur mesure, « Local trouvé avec moi », « Recherche
   arrêtée ») et une case de plus : l'espace client, qui va avec
   « Accompagné ». Ce qui suit est l'histoire d'origine, chez Emilio.

   Alexandre (23 octobre 2026) : « à côté de "Veille en pause", un petit
   bouton, comme ça on n'est pas obligé d'aller tout en haut […] un pop-up
   avec les différentes informations, il clique et ça revient comme s'il le
   faisait à partir du haut, avec des petites explications ». Et : « quand on
   met sur suspendu, que la recherche soit grisée, avec un petit message au
   centre […] la possibilité de réactiver, ou sinon de supprimer ».

   · FenetreEtatRecherche : les choix, rangés par ce qui se passe (il cherche,
     il fait une pause, c'est terminé), chacun avec ce qu'il fait tourner.
     Elle ne fait rien elle-même : elle rend le choix à la fiche, qui passe
     par les mêmes chemins que le menu d'état du haut (changeStatut, la
     fenêtre de pause et sa date, la fenêtre de clôture et son motif).
   · VoileRecherche : la carte posée par-dessus le bloc grisé, au centre (en
     pause, acheté avec moi, recherche arrêtée), avec ses deux ou trois
     gestes. Alexandre a choisi cette place (« par-dessus ») plutôt qu'une
     carte glissée sous le bandeau.

   Les mots viennent de src/lib/etats-acheteur.ts.

   Le point automatique part aux Accompagnés, et aussi à ceux « En
   recherche » si Werner l'a réglé (Paramètres › Point automatique › Pour
   qui). La fenêtre lit ce réglage : sa case dit ce qui est vrai aujourd'hui,
   « sous réserve » de ce réglage quand il n'est pas fait. */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ic } from '@/components/documents/ApercuActe';
import { supabase } from '@/lib/supabase';
import { etatDe, MOTIFS_CLOTURE, type EtatAcheteur, type Pronom } from '@/lib/etats-acheteur';
import s from './EtatRecherche.module.css';

export type ChoixEtat = 'prospect' | 'actif' | 'suspendu' | 'trouve_avec_moi' | 'trouve_ailleurs' | 'renonce';

type Option = { k: ChoixEtat; titre: string; aide: string; etat: EtatAcheteur; ic: string };
/* Les choix, avec le bon pronom (« Elle a acheté ailleurs », « Ils font une pause »). */
function groupes(p: Pronom): { titre: string; options: Option[] }[] {
  const pl = p === 'Ils';
  const il = p.toLowerCase();
  const v = (sing: string, plur: string) => (pl ? plur : sing);
  const lui = pl ? 'eux' : il === 'elle' ? 'elle' : 'lui';
  return [
    {
      titre: `${p} ${v('cherche', 'cherchent')}`,
      options: [
        { k: 'prospect', etat: 'prospect', ic: 'loupe', titre: 'En recherche', aide: `${p} ${v('cherche', 'cherchent')} un local. ${p} ${v('est', 'sont')} dans tes rapprochements quand un local ${pl ? 'leur' : 'lui'} correspond ; les locaux que tu ${pl ? 'leur' : 'lui'} envoies mènent à leur fiche publique.` },
        { k: 'actif', etat: 'actif', ic: 'cible', titre: 'Accompagné', aide: `Pour ${pl ? 'ceux' : il === 'elle' ? 'celle' : 'celui'} à qui tu offres un accompagnement sur mesure : ${pl ? 'leur' : 'son'} espace client, la veille qui cherche pour ${lui} chaque jour, le point automatique.` },
      ],
    },
    {
      titre: `${p} ${v('fait', 'font')} une pause`,
      options: [
        { k: 'suspendu', etat: 'suspendu', ic: 'pause', titre: 'En pause', aide: `${p} ${v('reprendra', 'reprendront')} plus tard, avec ou sans date. ${p} ${v('reste', 'restent')} dans tes rapprochements, marqué${p === 'Elle' ? 'e' : pl ? 's' : ''} «\u00a0En pause\u00a0».` },
      ],
    },
    {
      titre: 'C’est terminé',
      options: [
        { k: 'trouve_avec_moi', etat: 'bien_trouve', ic: 'check', titre: `${p} ${v('a', 'ont')} trouvé avec moi`, aide: 'Bail ou acte signé grâce à toi. Une transaction en cours passe «\u00a0Bail ou acte signé\u00a0».' },
        { k: 'trouve_ailleurs', etat: 'perdu', ic: 'drapeau', titre: `${p} ${v('a', 'ont')} trouvé ailleurs`, aide: `Avec une autre agence, ou ${pl ? 'tout seuls' : p === 'Elle' ? 'toute seule' : 'tout seul'}.` },
        { k: 'renonce', etat: 'perdu', ic: 'croix', titre: `${p} ${v('a', 'ont')} abandonné ${pl ? 'leur' : 'son'} projet`, aide: 'Reporté, plus de budget, plus de nouvelles…' },
      ],
    },
  ];
}

/* Le choix qui correspond à l'état d'aujourd'hui (un dossier clos : son motif). */
function choixActuel(statut: string, raison: string | null | undefined): ChoixEtat | null {
  if (statut === 'prospect' || statut === 'actif' || statut === 'suspendu') return statut;
  if (statut === 'bien_trouve') return 'trouve_avec_moi';
  if (statut === 'perdu') {
    const r = String(raison || '').toLowerCase();
    if (/ailleurs/.test(r)) return 'trouve_ailleurs';
    if (/renonc|abandon/.test(r)) return 'renonce';
  }
  return null;
}

function Fait({ oui, children }: { oui: boolean; children: string }) {
  return (
    <span className={s.fait} data-oui={oui ? 'oui' : 'non'}>
      <Ic n={oui ? 'check' : 'croix'} t={11} e={2.6} /><span>{children}</span>
    </span>
  );
}

/* V3.239 — Le réglage du point automatique (table `parametres`, comme
   src/lib/point-auto.ts) : allumé ou non, et pour qui. */
type ReglagePoint = { allume: boolean; pour: 'espace' | 'recherche' };
function useReglagePoint(): ReglagePoint | null {
  const [r, setR] = useState<ReglagePoint | null>(null);
  useEffect(() => {
    let vivant = true;
    void supabase.from('parametres').select('cle, valeur').in('cle', ['point_auto_actif', 'point_auto_pour'])
      .then(({ data, error }) => {
        if (!vivant || error) return;
        const v = (k: string) => (data || []).find((x: { cle: string }) => x.cle === k)?.valeur;
        setR({ allume: v('point_auto_actif') === 'oui', pour: v('point_auto_pour') === 'recherche' ? 'recherche' : 'espace' });
      });
    return () => { vivant = false; };
  }, []);
  return r;
}

/* La case « Point automatique » d'un état qui cherche encore : vraie, fausse,
   ou « selon tes Paramètres » quand le réglage la décide. */
function FaitPoint({ etat, reglage }: { etat: EtatAcheteur; reglage: ReglagePoint | null }) {
  if (etat !== 'actif' && etat !== 'prospect') return <Fait oui={false}>Point automatique</Fait>;
  if (!reglage) return <Fait oui={etat === 'actif'}>Point automatique</Fait>;
  const vise = etat === 'actif' || reglage.pour === 'recherche';
  if (vise && reglage.allume) return <Fait oui>Point automatique</Fait>;
  return (
    <span className={s.fait} data-oui="reglage" title="Paramètres › Point automatique">
      <Ic n="info" t={11} e={2.4} />
      <span>{vise ? 'Point automatique : éteint dans Paramètres' : 'Point automatique : si tu l’actives dans Paramètres'}</span>
    </span>
  );
}

export function FenetreEtatRecherche({ prenom, pronom = 'Il', statut, raison, onChoix, onFermer }: {
  prenom: string; pronom?: Pronom; statut: string; raison?: string | null;
  onChoix: (c: ChoixEtat) => void; onFermer: () => void;
}) {
  const [pret, setPret] = useState(false);
  useEffect(() => { setPret(true); }, []);
  const reglage = useReglagePoint();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFermer]);
  if (!pret) return null;
  const actuel = choixActuel(statut, raison);
  const e0 = etatDe(statut);
  const qui = prenom.trim() || 'ce client';

  return createPortal(
    <div className={s.voileFen} onMouseDown={e => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className={s.fen} role="dialog" aria-modal="true" aria-label="Mettre à jour la recherche">
        <header className={s.fenTete}>
          <span className={s.fenTitre}>
            <b>{`Où en est la recherche de ${qui} ?`}</b>
            {e0 && (
              <small>
                <span>Aujourd’hui :</span>
                <i className={s.point} style={{ background: e0.point }} />
                <strong>{e0.nom}</strong>
              </small>
            )}
          </span>
          <button type="button" className={s.fermer} aria-label="Fermer" onClick={onFermer}><Ic n="croix" t={15} e={2.3} /></button>
        </header>
        <div className={s.fenCorps}>
          {groupes(pronom).map(g => (
            <section key={g.titre} className={s.groupe}>
              <span className={s.groupeT}>{g.titre}</span>
              {g.options.map(o => {
                const e = etatDe(o.etat)!;
                const ici = actuel === o.k;
                return (
                  <button key={o.k} type="button" className={s.option} data-ici={ici ? 'oui' : undefined}
                    style={{ ['--c' as string]: e.point } as React.CSSProperties}
                    onClick={() => (ici ? onFermer() : onChoix(o.k))}>
                    <span className={s.optIc}><Ic n={o.ic} t={17} e={2.1} /></span>
                    <span className={s.optTx}>
                      <span className={s.optTete}>
                        <b>{o.titre}</b>
                        {o.etat === 'perdu' && <em className={s.etiq}>{e.nom}</em>}
                        {ici && <em className={s.ici}>Aujourd’hui</em>}
                      </span>
                      <small>{o.aide}</small>
                      <span className={s.faits}>
                        {e.clos ? (
                          <span className={s.fait} data-oui="clos"><Ic n="archive" t={11} e={2.2} /><span>Dossier clos, réversible</span></span>
                        ) : (
                          <>
                            <Fait oui={e.fait.rappro}>Rapprochements</Fait>
                            <Fait oui={e.fait.espace}>Espace client</Fait>
                            <Fait oui={e.fait.veille}>Veille chaque jour</Fait>
                            <FaitPoint etat={o.etat} reglage={reglage} />
                          </>
                        )}
                      </span>
                    </span>
                    <span className={s.optFleche}><Ic n="droite" t={15} e={2.2} /></span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
        <footer className={s.fenPied}>
          <Ic n="info" t={14} e={2} />
          <span>{'C’est l’état du dossier, le même qu’en haut de la fiche. «\u00a0En pause\u00a0» demande une date de reprise, «\u00a0C’est terminé\u00a0» un motif\u00a0: la fenêtre suivante les propose.'}</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/* La carte au centre du bloc grisé. */
export function VoileRecherche({ statut, prenom, reprise, repriseEn, raison, occupe, onReprendre, onDate, onSupprimer }: {
  statut: 'suspendu' | 'bien_trouve' | 'perdu';
  prenom: string;
  /* « le 12 janvier » : la reprise prévue d'une pause. */
  reprise?: string | null;
  /* V3.240 : l'état que la reprise rendra (« Accompagné », « En recherche »). */
  repriseEn?: string | null;
  /* Le motif d'un dossier clos (`raison_perte`). */
  raison?: string | null;
  occupe?: boolean;
  onReprendre: (statut: 'actif' | 'prospect') => void;
  onDate?: () => void;
  onSupprimer?: () => void;
}) {
  const qui = prenom.trim();
  const pause = statut === 'suspendu';
  const titre = pause
    ? `La recherche${qui ? ` de ${qui}` : ''} est en pause`
    : statut === 'bien_trouve' ? 'Local trouvé avec moi' : 'Recherche arrêtée';
  const brut = !pause && raison ? raison.replace(/^Recherche arrêtée\s*[—-]\s*/, '') : '';
  /* « Local trouvé avec moi » sous « Local trouvé avec moi » : on ne garde que la note. */
  const motif = brut === titre ? '' : brut.startsWith(`${titre} — `) ? brut.slice(titre.length + 3) : brut;
  const sous = pause
    ? `${reprise ? `Elle reprend toute seule ${reprise}${repriseEn ? `, en «\u00a0${repriseEn}\u00a0»` : ''}.` : 'Sans date de reprise.'} Ni veille, ni point automatique ; elle reste dans tes rapprochements.`
    : 'Ni veille, ni rapprochements, ni point automatique. Ses locaux, ses visites et son suivi restent là.';
  const motifCloture = MOTIFS_CLOTURE.find(m => motif.startsWith(m.nom));
  return (
    <div className={s.voile} data-etat={statut}>
      <div className={s.carte} role="status">
        <span className={s.carteIc}><Ic n={pause ? 'pause' : statut === 'bien_trouve' ? 'check' : 'drapeau'} t={20} e={2.2} /></span>
        <b className={s.carteTitre}>{titre}</b>
        {motif && <span className={s.carteMotif}>{motifCloture ? motif : `« ${motif} »`}</span>}
        <span className={s.carteSous}>{sous}</span>
        <span className={s.carteQuestion}>{pause ? 'La reprendre ?' : 'La réactiver ?'}</span>
        <span className={s.carteGestes}>
          <button type="button" className={`${s.geste} ${s.gestePlein}`} disabled={occupe} onClick={() => onReprendre('actif')}
            title="Accompagnement sur mesure : son espace client, la veille chaque jour, le point automatique">
            <Ic n="cible" t={15} e={2.2} /><span>Accompagné</span>
          </button>
          <button type="button" className={s.geste} disabled={occupe} onClick={() => onReprendre('prospect')}
            title="Dans tes rapprochements, sans espace client ni veille">
            <Ic n="loupe" t={15} e={2.2} /><span>En recherche</span>
          </button>
        </span>
        {(pause ? onDate : onSupprimer) && (
          <button type="button" className={`${s.lien} ${pause ? '' : s.lienDanger}`} disabled={occupe} onClick={pause ? onDate : onSupprimer}>
            <Ic n={pause ? 'horloge' : 'corbeille'} t={13} e={2.2} />
            <span>{pause ? (reprise ? 'Changer la date de reprise' : 'Choisir une date de reprise') : 'Supprimer cette recherche'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
