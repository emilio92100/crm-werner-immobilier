'use client';

/* ══ La page de réponse au point automatique (/point/<jeton>) ═══════════════

   Pour un demandeur sans espace (23 octobre 2026). Les boutons du mail « Où en
   est votre recherche ? » ouvrent cette page sur le bouton choisi ; il précise
   s'il le faut (ce qui a changé, avec qui il a trouvé, quand le rappeler) et
   c'est lui qui envoie. La réponse va par /api/point/repondre dans le suivi
   de son dossier, et en relance chez Werner.

   Règles de l'espace client (AGENTS.md §5) : aucun mot de métier, aucun mot
   du résidentiel, des icônes dessinées. Et le piège de l'espace perdue
   (§2.1) : les phrases sont sur une ligne ou dans une chaîne.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import type { Reponse, Resume } from '@/lib/point-auto';
import s from './ReponsePoint.module.css';

export type DonneesPoint = {
  jeton: string;
  etat: 'ouvert' | 'exemple' | 'introuvable' | 'expire' | 'indisponible';
  /** Le bouton du mail sur lequel il a appuyé. */
  choix: Reponse | null;
  prenom: string;
  resume: Resume | null;
  /** Sa dernière réponse à ce mail, s'il en a déjà donné une. */
  derniere: { reponse: Reponse; motif: string | null; le: string } | null;
  co: { agence: string; tel: string; telLien: string; mail: string };
};

const TRACES: Record<string, string> = {
  check: 'M5 12.5l4.2 4.2L19 7',
  loupe: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  crayon: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  cle: 'M14.5 9.5a4 4 0 1 0-1.2 2.8L20 19v-3h-2v-2h-2l-1.2-1.2M8.5 9.5h.01',
  pause: 'M9 6v12M15 6v12',
  tel: 'M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z',
  mail: 'M3.5 6.5h17v11h-17zM4 7l8 6 8-6',
  chevron: 'M6 9l6 6 6-6',
  fleche: 'M5 12h13M13 6l6 6-6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
};
function Ic({ n, t = 20 }: { n: string; t?: number }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', flex: '0 0 auto' }}>
      <path d={TRACES[n]} />
    </svg>
  );
}

const REPONSES: { r: Reponse; ic: string; titre: string; sous: string }[] = [
  { r: 'toujours', ic: 'loupe', titre: 'Je cherche toujours', sous: 'Sur les mêmes critères' },
  { r: 'criteres', ic: 'crayon', titre: 'Mes critères ont changé', sous: 'Dites-nous ce qui a bougé' },
  { r: 'trouve', ic: 'cle', titre: 'J’ai trouvé mon local', sous: 'Avec nous, ou par un autre biais' },
  { r: 'pause', ic: 'pause', titre: 'J’ai mis ma recherche en pause ou arrêtée', sous: 'Pour un temps, ou pour de bon' },
  { r: 'rappel', ic: 'tel', titre: 'Je souhaite être rappelé', sous: 'Pour en parler de vive voix' },
];
const CRENEAUX: [string, string, string][] = [
  ['matin', 'Le matin', '8 h – 12 h'],
  ['apres_midi', 'L’après-midi', '12 h – 18 h'],
  ['soir', 'En fin de journée', '18 h – 20 h'],
];
const QUAND: Record<string, string> = { matin: 'le matin', apres_midi: 'l’après-midi', soir: 'en fin de journée' };

/* Ce qu'il a déjà répondu, dit avec ses mots. */
function dejaDit(d: NonNullable<DonneesPoint['derniere']>): string {
  if (d.reponse === 'trouve') return d.motif === 'trouve_ailleurs' ? 'j’ai trouvé par un autre biais' : 'j’ai trouvé mon local avec vous';
  if (d.reponse === 'pause') return d.motif === 'abandon' ? 'j’arrête ma recherche' : 'je mets ma recherche en pause';
  if (d.reponse === 'criteres') return 'mes critères ont changé';
  if (d.reponse === 'rappel') return 'je souhaite être rappelé';
  return 'je cherche toujours';
}
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

type Fait = { titre: string; texte: string; gris?: boolean };

export default function ReponsePoint({ d }: { d: DonneesPoint }) {
  const ouvert = d.etat === 'ouvert' || d.etat === 'exemple';
  const [choix, setChoix] = useState<Reponse | null>(ouvert ? d.choix : null);
  const [recap, setRecap] = useState(!d.choix);
  const [mot, setMot] = useState('');
  const [motif, setMotif] = useState('');
  const [creneau, setCreneau] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [fait, setFait] = useState<Fait | null>(null);
  const [etat, setEtat] = useState(d.etat);
  const detailRef = useRef<HTMLDivElement>(null);

  /* Arrivé d'un bouton du mail : la réponse choisie se montre tout de suite. */
  useEffect(() => {
    if (!d.choix || !ouvert) return;
    const t = setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choisir(r: Reponse) {
    if (r === choix) return;
    setChoix(r); setMotif(''); setCreneau(''); setErreur('');
  }

  const pret = !!choix && (
    choix === 'trouve' || choix === 'pause' ? !!motif
    : choix === 'rappel' ? !!creneau
    : true);

  async function envoyer() {
    if (!choix || !pret || envoi) return;
    setEnvoi(true); setErreur('');
    try {
      const r = await fetch('/api/point/repondre', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jeton: d.jeton, reponse: choix, motif, creneau, mot }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 410) { setEtat('expire'); return; }
      if (r.status === 404) { setEtat('introuvable'); return; }
      if (!j.ok) {
        setErreur(r.status === 429
          ? `Vous nous avez déjà beaucoup répondu aujourd’hui. Pour la suite, le plus simple est d’appeler Werner au ${d.co.tel}.`
          : `Votre réponse n’est pas partie : un souci de connexion, sans doute. Réessayez dans un instant, ou appelez Werner au ${d.co.tel}.`);
        return;
      }
      setFait(j.deja
        ? { titre: 'C’est déjà noté', texte: 'Votre réponse est bien arrivée chez Werner : inutile de la renvoyer.', gris: true }
        : merci(choix, motif, creneau));
      try { document.querySelector(`.${s.page}`)?.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* sans effet */ }
    } catch {
      setErreur(`Votre réponse n’est pas partie : un souci de connexion, sans doute. Réessayez dans un instant, ou appelez Werner au ${d.co.tel}.`);
    } finally { setEnvoi(false); }
  }

  const contact = (
    <div className={s.contact}>
      <div className={s.contactTx}>
        <b>{'Une question ? Werner vous répond'}</b>
        <small>{d.co.agence}</small>
      </div>
      <div className={s.contactBtns}>
        <a className={s.tel} href={`tel:${d.co.telLien}`}><Ic n="tel" t={16} />{d.co.tel}</a>
        <a className={s.mail} href={`mailto:${d.co.mail}`}><Ic n="mail" t={16} />{'Écrire'}</a>
      </div>
    </div>
  );
  const tete = (
    <header className={s.tete}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_high_resolution_white.png" alt={d.co.agence} />
      <span className={s.teteMot}>Votre recherche</span>
    </header>
  );

  /* Un lien qui ne mène à rien, trop ancien, ou une base injoignable. */
  if (etat === 'introuvable' || etat === 'expire' || etat === 'indisponible') {
    const t = etat === 'expire'
      ? { titre: 'Ce lien n’est plus valable', texte: `${d.prenom ? `${d.prenom}, ce` : 'Ce'} lien date de plus de trois mois. Pour nous dire où en est votre recherche, appelez ou écrivez à Werner : il vous répond.` }
      : etat === 'indisponible'
        ? { titre: 'La page ne s’ouvre pas pour l’instant', texte: 'Réessayez dans un instant. Si c’est pressé, appelez ou écrivez à Werner : il vous répond.' }
        : { titre: 'Ce lien ne mène à rien', texte: 'L’adresse a peut-être été coupée en route. Appelez ou écrivez à Werner : il vous répond.' };
    return (
      <div className={s.page}>
        <div className={s.feuille}>
          {tete}
          <div className={`${s.carte} ${s.fait}`}>
            <div className={`${s.faitIc} ${s.faitIcGris}`}><Ic n="info" t={30} /></div>
            <h1 className={s.titre}>{t.titre}</h1>
            <p className={s.intro}>{t.texte}</p>
          </div>
          {contact}
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.feuille}>
        {tete}

        {fait ? (
          <div className={`${s.carte} ${s.fait}`} key="fait">
            {etat === 'exemple' && <div className={s.exemple}>{'Page d’exemple : rien ne s’est enregistré. Un vrai client verrait ce message, et sa réponse arriverait dans ses Relances et son suivi.'}</div>}
            <div className={`${s.faitIc} ${fait.gris ? s.faitIcGris : ''}`}><Ic n="check" t={30} /></div>
            <h1 className={s.titre}>{fait.titre}</h1>
            <p className={s.intro}>{fait.texte}</p>
            <button type="button" className={s.retour} onClick={() => { setFait(null); setChoix(null); setMot(''); setMotif(''); setCreneau(''); }}>
              {'Donner une autre réponse'}
            </button>
          </div>
        ) : (
          <div className={s.carte} key="question">
            {etat === 'exemple' && <div className={s.exemple}>{'Page d’exemple : c’est ce que voit un demandeur sans espace quand il appuie sur un bouton du mail. Rien ne s’enregistre ici.'}</div>}
            <div className={s.bonjour}>{d.prenom ? `Bonjour ${d.prenom},` : 'Bonjour,'}</div>
            <h1 className={s.titre}>{'Où en est votre recherche ?'}</h1>
            <p className={s.intro}>{'Une réponse suffit : elle arrive directement chez Werner, qui s’occupe de la suite.'}</p>

            {d.derniere && (
              <div className={s.deja}>
                <Ic n="check" t={17} />
                <span>{`Votre réponse du ${jour(d.derniere.le)} est bien arrivée : « ${dejaDit(d.derniere)} ». Vous pouvez en donner une autre ci-dessous.`}</span>
              </div>
            )}

            {d.resume && d.resume.lignes.length > 0 && (
              <div className={`${s.recap} ${recap ? s.recapOuvert : ''}`}>
                <button type="button" className={s.recapTete} aria-expanded={recap} onClick={() => setRecap(v => !v)}>
                  <span className={s.recapTx}>
                    <b>{'Votre recherche aujourd’hui'}</b>
                    {d.resume.depuis && <small>{`depuis le ${d.resume.depuis}`}</small>}
                  </span>
                  <span className={s.recapChev}><Ic n="chevron" t={16} /></span>
                </button>
                <div className={`${s.plie} ${recap ? s.deplie : ''}`}>
                  <div>
                    {d.resume.lignes.map(l => (
                      <div key={l.cle} className={s.recapLigne}>
                        <span className={s.recapCle}>{l.cle}</span>
                        <span className={s.recapVal}>{l.valeur}{l.sous ? <small>{l.sous}</small> : null}</span>
                      </div>
                    ))}
                    {d.resume.points.length > 0 && (
                      <div className={s.recapLigne}>
                        <span className={s.recapCle}>{'Ce qui compte'}</span>
                        <span className={s.pastilles}>
                          {d.resume.points.map(p => <span key={p.texte} className={`${s.pastille} ${p.fort ? s.pastilleForte : ''}`}>{p.texte}</span>)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className={s.question}>{'Votre réponse'}</div>
            <div className={s.reponses}>
              {REPONSES.map(o => (
                <div key={o.r}>
                  <button type="button" className={s.reponse} aria-pressed={choix === o.r} onClick={() => choisir(o.r)}>
                    <span className={s.repIc}><Ic n={o.ic} t={19} /></span>
                    <span className={s.repTx}><b>{o.titre}</b><small>{o.sous}</small></span>
                    <span className={s.repCoche}><Ic n="check" t={13} /></span>
                  </button>
                  <div className={`${s.plie} ${choix === o.r ? s.deplie : ''}`}>
                    <div>
                      {choix === o.r && (
                        <div className={s.detail} ref={detailRef}>
                          <div className={s.detailIn}>
                            <Detail r={o.r} agence={d.co.agence} mot={mot} setMot={setMot} motif={motif} setMotif={setMotif} creneau={creneau} setCreneau={setCreneau} />
                            <button type="button" className={s.envoyer} disabled={!pret || envoi} onClick={() => { void envoyer(); }}>
                              {envoi ? 'Envoi…' : o.r === 'rappel' ? 'Demander à être rappelé' : 'Envoyer ma réponse'}
                              {!envoi && <Ic n="fleche" t={17} />}
                            </button>
                            {!pret && <div className={s.aide}>{o.r === 'rappel' ? 'Choisissez d’abord un moment de la journée.' : 'Choisissez d’abord une des deux réponses.'}</div>}
                            {erreur && <div className={s.erreur}>{erreur}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {contact}
        <p className={s.pied}>{`${d.co.agence} · immobilier d’entreprise`}</p>
      </div>
    </div>
  );
}

/* Ce qu'on lui demande en plus, selon sa réponse. Au niveau du module : un
   composant déclaré dans le rendu ferait perdre le focus à chaque lettre
   (AGENTS.md §2.4). */
function Detail({ r, agence, mot, setMot, motif, setMotif, creneau, setCreneau }: {
  r: Reponse; agence: string; mot: string; setMot: (v: string) => void;
  motif: string; setMotif: (v: string) => void;
  creneau: string; setCreneau: (v: string) => void;
}) {
  const zone = (lib: string, facultatif: boolean, place: string) => (
    <>
      <label className={s.lib} htmlFor="point-mot">{lib}{facultatif ? <small>{' (facultatif)'}</small> : null}</label>
      <textarea id="point-mot" className={s.zone} value={mot} maxLength={600} placeholder={place} onChange={e => setMot(e.target.value)} />
    </>
  );
  const deux = (a: [string, string], b: [string, string]) => (
    <div className={s.options}>
      {[a, b].map(([v, l]) => (
        <button key={v} type="button" className={s.option} aria-pressed={motif === v} onClick={() => setMotif(v)}><b>{l}</b></button>
      ))}
    </div>
  );
  const creneaux = (bascule: boolean) => (
    <div className={`${s.options} ${s.options3}`}>
      {CRENEAUX.map(([v, l, h]) => (
        <button key={v} type="button" className={s.option} aria-pressed={creneau === v}
          onClick={() => setCreneau(bascule && creneau === v ? '' : v)}><b>{l}</b><small>{h}</small></button>
      ))}
    </div>
  );

  if (r === 'toujours') return (
    <>
      <p className={s.detailTx}>{'Parfait : nous continuons à chercher pour vous, sur les mêmes critères.'}</p>
      {zone('Un mot à ajouter ?', true, 'Une précision, une question pour Werner…')}
    </>
  );
  if (r === 'criteres') return (
    <>
      {zone('Qu’est-ce qui a changé ?', true, 'Par exemple : un loyer plus élevé, un autre quartier, une surface plus petite…')}
      <span className={s.lib}>{'Vous préférez en parler ? Werner vous rappelle'}<small>{' (facultatif)'}</small></span>
      {creneaux(true)}
    </>
  );
  if (r === 'trouve') return (
    <>
      <span className={s.lib}>{'Bonne nouvelle ! Comment l’avez-vous trouvé ?'}</span>
      {deux(['trouve_avec_vous', `Avec ${agence}`], ['trouve_ailleurs', 'Par un autre biais'])}
      {zone('Un mot à ajouter ?', true, 'L’adresse, la date de signature…')}
    </>
  );
  if (r === 'pause') return (
    <>
      <span className={s.lib}>{'Pour un temps, ou pour de bon ?'}</span>
      {deux(['pause', 'Je la mets en pause'], ['abandon', 'J’arrête ma recherche'])}
      {zone('Un mot à ajouter ?', true, motif === 'pause' ? 'Quand pensez-vous reprendre ?' : 'Ce qui vous fait changer de projet…')}
    </>
  );
  return (
    <>
      <span className={s.lib}>{'À quel moment de la journée ?'}</span>
      {creneaux(false)}
      {zone('À quel sujet ?', true, 'Ce dont vous voulez parler…')}
    </>
  );
}

/* Le merci, selon la réponse : ce qui va se passer maintenant. */
function merci(r: Reponse, motif: string, creneau: string): Fait {
  if (r === 'toujours') return { titre: 'Merci, c’est noté', texte: 'Nous continuons à chercher pour vous, sur les mêmes critères. Les prochains locaux vous arriveront comme d’habitude.' };
  if (r === 'criteres') return { titre: 'Merci, c’est transmis', texte: creneau ? `Werner met votre recherche à jour et vous rappelle ${QUAND[creneau]} pour en parler.` : 'Werner met votre recherche à jour, et vous rappelle s’il lui manque une précision.' };
  if (r === 'trouve') return motif === 'trouve_ailleurs'
    ? { titre: 'Merci de nous avoir prévenus', texte: 'Félicitations pour votre local ! Werner vous rappelle pour faire le point, et nous arrêtons les recherches de notre côté.' }
    : { titre: 'Bonne nouvelle !', texte: 'Werner est prévenu et vous rappelle pour faire le point sur la suite.' };
  if (r === 'pause') return motif === 'abandon'
    ? { titre: 'C’est noté', texte: 'Nous arrêtons les recherches de notre côté. Werner vous rappelle pour en parler.' }
    : { titre: 'C’est noté', texte: 'Votre recherche est en pause. Werner vous rappelle pour savoir quand reprendre.' };
  return { titre: 'C’est noté, il vous rappelle', texte: `Werner est prévenu que vous souhaitez être rappelé ${QUAND[creneau] || 'prochainement'}.` };
}
