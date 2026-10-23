'use client';
/* ═══ Les acheteurs d'un bien (V3.29) ═══════════════════════════════════════
   Les morceaux communs : l'avatar, la note en anneau, l'état d'un acheteur
   (« Présenté le… »), la carte « Les acheteurs » de la Vue d'ensemble, et la
   fenêtre « Envoyer… » (dans sa sélection, dans son espace, par mail).
   L'onglet lui-même, « Rapprochement », est dans RapprochementBien.tsx
   (V3.112 : il remplace la liste d'ici). */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ic } from '@/components/documents/ApercuActe';
import { dateCourte, lirePhotos, specsBien, titreBien, versCorrespondance, villeAffichee, type BienVente } from '@/lib/biens-vente';
import { prixCarte } from './CarteBien';
import { demanderOuvertureFiche } from '@/lib/intentions';
import {
  SEUIL_CORRESPOND, SEUIL_LISTE, envoyerDansEspace, fiable, mettreEnSelection, nomClient,
  type Acheteur, type Copie,
} from './outils';
import a from './AcheteursBien.module.css';
import AvatarContact from '@/components/contacts/AvatarContact';

export type ModeAcheteurs = 'vente' | 'avant' | 'pause' | 'fini';
export const modeAcheteurs = (etape: string): ModeAcheteurs =>
  etape === 'a_suivre' || etape === 'estimation' ? 'avant'
    : etape === 'suspendu' ? 'pause'
      : etape === 'vendu' || etape === 'retire' ? 'fini' : 'vente';

/* ── Petits morceaux ── */
const C = 113.1; // périmètre du cercle de la note (r = 18)
export function Note({ n, t = 48, gris }: { n: number; t?: number; gris?: boolean }) {
  const coul = gris ? '#cbd5e1' : n >= 85 ? '#16a34a' : n >= SEUIL_CORRESPOND ? '#f08c42' : '#94a3b8';
  return (
    <svg className={a.note} width={t} height={t} viewBox="0 0 48 48" role="img" aria-label={`${n} pour cent`}>
      <circle cx="24" cy="24" r="18" fill="none" stroke="#f2f2f2" strokeWidth="4.5" />
      <circle cx="24" cy="24" r="18" fill="none" stroke={coul} strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={`${(C * n / 100).toFixed(1)} ${C}`} transform="rotate(-90 24 24)" />
      <text x="24" y="28.5" textAnchor="middle" fill={gris ? '#94a3b8' : '#25272b'} style={{ font: "800 12.5px 'Plus Jakarta Sans', sans-serif" }}>{n}</text>
    </svg>
  );
}

/* Une couleur douce par personne, toujours la même. */
const TEINTES = [
  { f: '#dcfce7', t: '#166534' }, { f: '#e0e7ff', t: '#3730a3' }, { f: '#fef3c7', t: '#92400e' },
  { f: '#fce7f3', t: '#9d174d' }, { f: '#e0f2fe', t: '#075985' }, { f: '#ede9fe', t: '#5b21b6' },
];
export function teinte(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TEINTES[h % TEINTES.length];
}
export function Avatar({ acheteur, petit }: { acheteur: Acheteur; petit?: boolean }) {
  const c = teinte(acheteur.client.id);
  return <AvatarContact c={acheteur.client} teinte={{ bg: c.f, fg: c.t }} className={petit ? a.avPetit : a.av} libre />;
}

/* Ce qui ne colle pas, en une ligne ; sinon « Tout correspond ».
   V3.99 : une recherche sans budget ou sans secteur le dit d'abord. */
const MANQUE: Record<string, string> = { budget: 'pas de budget', secteur: 'pas de secteur' };
export function ecart(x: Acheteur): { t: string; ok: boolean } {
  if (x.manque.length) return { t: `Recherche à compléter : ${x.manque.map(k => MANQUE[k] || k).join(', ')}`, ok: false };
  const pb = x.corr.lignes.filter(l => l.etat !== 'oui');
  if (!pb.length) return { t: `Tout correspond : ${x.corr.lignes.map(l => l.lib.toLowerCase()).slice(0, 4).join(', ')}`, ok: true };
  const l = pb.find(y => y.etat === 'non') || pb[0];
  return { t: `${l.lib} : ${l.valeur}, demandé ${l.demande}`, ok: false };
}

const BADGES: Record<string, string> = {
  interesse: 'ça lui plaît', souhaite_visiter: 'veut visiter', visite: 'a visité', offre_faite: 'a fait une offre', refuse: 'pas pour lui',
};
const joursDepuis = (iso: unknown) => {
  const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
};
/* Une recherche ouverte depuis moins d'une semaine, et le bien pas encore dans son dossier. */
export const estNouveau = (x: Acheteur) => !x.copie && (joursDepuis(x.recherche.created_at) ?? 99) <= 7;
const enSelection = (c: Copie | null) => !!c && c.etape === 'selection';
const presente = (c: Copie | null) => !!c && c.etape !== 'selection';

export function etat(x: Acheteur): { t: string; ton: 'nouveau' | 'dossier' } | null {
  const c = x.copie;
  if (c && enSelection(c)) return { t: `Dans sa sélection depuis le ${dateCourte(c.created_at)} · pas encore envoyé`, ton: 'dossier' };
  if (c) {
    return {
      t: [`Présenté le ${dateCourte(c.envoye_le || c.created_at)}`, c.vu_le ? 'l’a ouvert' : '', c.badge_retour && BADGES[c.badge_retour] ? BADGES[c.badge_retour] : ''].filter(Boolean).join(' · '),
      ton: 'dossier',
    };
  }
  if (estNouveau(x)) {
    const j = joursDepuis(x.recherche.created_at) ?? 0;
    return { t: `Nouveau : recherche ouverte ${j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : `il y a ${j} jours`}`, ton: 'nouveau' };
  }
  return null;
}

export const telDe = (x: Acheteur) => (x.client.telephones || []).find(Boolean) || '';
export const mailDe = (x: Acheteur) => (x.client.emails || []).find(Boolean) || '';
export const sansEspaces = (t: string) => t.replace(/[\s.]+/g, '');

/* L'illustration de l'en-tête : trois acheteurs qui flottent. */
export function Illu() {
  return (
    <svg className={a.illu} width="116" height="72" viewBox="0 0 116 72" aria-hidden="true">
      <g className={a.f1}><circle cx="26" cy="38" r="20" fill="#dcfce7" stroke="#fff" strokeWidth="3" /><circle cx="26" cy="32" r="6" fill="#16a34a" /><path d="M15 50c2-7 20-7 22 0" fill="#16a34a" /></g>
      <g className={a.f2}><circle cx="58" cy="30" r="22" fill="#e0e7ff" stroke="#fff" strokeWidth="3" /><circle cx="58" cy="24" r="7" fill="#4f46e5" /><path d="M46 43c2-8 22-8 24 0" fill="#4f46e5" /></g>
      <g className={a.f3}><circle cx="90" cy="40" r="19" fill="#fef3c7" stroke="#fff" strokeWidth="3" /><circle cx="90" cy="34" r="6" fill="#c05d12" /><path d="M80 51c2-7 18-7 20 0" fill="#c05d12" /></g>
    </svg>
  );
}

/* ══ LA CARTE DE LA VUE D'ENSEMBLE ═══════════════════════════════════════
   21 octobre 2026 (repris du CRM d'Emilio, V3.224-225) — Alexandre : « ça
   affiche 99 en gros : on a l'impression qu'il y a 99 acheteurs pour ce bien.
   Il faut prendre plus de recul… et que l'explication soit simple, quand il a
   un local ou une affaire ». Le chiffre se lit pour ce qu'il est : des pistes
   à vérifier, « À confirmer » à côté, à peine plus gros que le texte. Dessous,
   le premier tri en clair, puis où en est la vérification : le dernier
   rapprochement (« Vérifié le … : 4 oui · 3 à voir ») ou « Pas encore
   vérifié ». Le « ? » ouvre « Comment lire ce chiffre » ; le lien mène au
   rapprochement. */
export type SeanceCarte = { le: string; oui: number; aVoir: number };
export function CarteAcheteurs({ acheteurs, mode, onVoir, bien, seance }: { acheteurs: Acheteur[]; mode: ModeAcheteurs; onVoir: () => void; bien?: BienVente; seance?: SeanceCarte | null }) {
  const liste = acheteurs.filter(x => fiable(x) && x.corr.note >= SEUIL_LISTE);
  const bons = liste.filter(x => x.corr.note >= SEUIL_CORRESPOND);
  const nouveaux = bons.filter(estNouveau).length;
  const avant = mode === 'avant';
  const n = avant ? liste.length : bons.length;
  const tete = (avant ? liste : bons).slice(0, 4);
  const reste = n - tete.length;
  const [aide, setAide] = useState(false);
  return (
    <div className={`${a.kpi} ${a.kpiOr}`}>
      <div className={a.kpiT}>
        <span className={a.kpiIc}><Ic n="groupe" t={17} /></span>
        <span>{avant ? 'Demandeurs potentiels' : 'Les demandeurs'}</span>
        <button type="button" className={a.qBtn} aria-label="Comment lire ce chiffre" title="Comment lire ce chiffre" onClick={() => setAide(true)}>?</button>
      </div>
      {aide && <ExplicationAcheteurs liste={avant ? liste : bons} bons={bons.length} partiels={liste.length - bons.length} avant={avant} bien={bien}
        onFermer={() => setAide(false)} onVoir={() => { setAide(false); onVoir(); }} />}
      <div className={a.kpiN}><b>{n}</b><span>{n > 1 ? 'pistes à vérifier' : 'piste à vérifier'}</span>{n > 0 && <i className={a.kpiConfirmer}>{'À confirmer'}</i>}</div>
      {n > 0 ? (
        <div className={a.pile}>
          {tete.map((x, i) => <span key={x.recherche.id} className={a[`f${(i % 3) + 1}`]}><Avatar acheteur={x} petit /></span>)}
          {reste > 0 && <span className={a.avPetit} style={{ background: '#f2f2f2', color: '#475569' }}>{`+${reste}`}</span>}
          {!avant && nouveaux > 0 && <span className={a.nouveaux}><i className={a.ping} />{nouveaux > 1 ? `${nouveaux} nouveaux` : '1 nouveau'}</span>}
        </div>
      ) : <span className={a.kpiSous}>{avant ? 'Aucune recherche ne correspond encore.' : 'Aucune recherche ne correspond pour l’instant.'}</span>}
      {n > 0 && (
        <span className={a.kpiSous}>{avant
          ? `Premier tri automatique dans tes demandeurs : ${bons.length} correspond${bons.length > 1 ? 'ent' : ''} · ${liste.length - bons.length} en partie.`
          : 'Premier tri automatique dans tes demandeurs.'}</span>
      )}
      {n > 0 && (seance
        ? <span className={a.kpiVerif}><Ic n="check" t={14} e={2.4} /><span>{`Vérifié le ${dateCourte(seance.le)} : ${seance.oui + seance.aVoir ? `${seance.oui} oui · ${seance.aVoir} à voir` : 'personne de vraiment intéressé'}`}</span></span>
        : <span className={a.kpiVerifPas}><Ic n="info" t={14} /><span>{'Pas encore vérifié un par un.'}</span></span>)}
      <button type="button" className={a.kpiLien} onClick={onVoir}>{seance ? 'Voir le rapprochement' : n > 0 ? 'Vérifier avec le rapprochement' : 'Voir les demandeurs'}</button>
    </div>
  );
}

/* ══ « Comment lire ce chiffre » ═════════════════════════════════════════
   La fenêtre du « ? », courte : une phrase qui dit ce que c'est (et ce que ce
   n'est pas encore), les deux chiffres, le tri en trois étapes, le secteur DE
   CETTE AFFAIRE (sa ville, son quartier : renseignés ou non, et ce que ça
   change), ce qui manque encore à sa fiche, puis le rapprochement pour être
   sûr. Le tri : acheteursTries (outils.ts), raisonEcart
   (src/lib/ecart-acheteur.ts), la note de src/lib/correspondance.ts. */
/* Les espaces insécables du français : « … », avant « : » et « ; ». */
const fr = (t: string) => t.replace(/« /g, '« ').replace(/ »/g, ' »').replace(/ ([:;?!])/g, ' $1');
const enMots = (l: string[]) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`);

function ExplicationAcheteurs({ liste, bons, partiels, avant, bien, onFermer, onVoir }: {
  liste: Acheteur[]; bons: number; partiels: number; avant: boolean; bien?: BienVente;
  onFermer: () => void; onVoir: () => void;
}) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onFermer]);
  const n = liste.length;
  const statut = (x: Acheteur) => String((x.client as { statut?: unknown }).statut || '');
  const prospects = liste.filter(x => statut(x) === 'prospect').length;
  const pause = liste.filter(x => statut(x) === 'suspendu').length;
  const actifs = n - prospects - pause;
  const bc = bien ? versCorrespondance(bien) : null;
  const ville = bc?.ville ? villeAffichee(bc.ville, bien?.code_postal) : '';
  const quartier = bc?.quartier || '';
  const pro = bc?.pro;
  const manque = bc ? [
    pro && !pro.nature ? 'sa nature (location, cession, fonds…)' : '',
    pro && !pro.loyerAn && !pro.prix ? 'le loyer ou le prix' : '',
    !bc.surface ? 'la surface' : '',
  ].filter(Boolean) : [];
  const parmi = enMots([
    actifs ? `${actifs} accompagné${actifs > 1 ? 's' : ''}` : '',
    prospects ? `${prospects} en recherche` : '',
    pause ? `${pause} en pause` : '',
  ].filter(Boolean));
  const p = n > 1;
  /* Le secteur de cette affaire : ce qui est comparé, et ce qui ne l'est pas. */
  const secteur = !bc ? null
    : !ville ? { ok: false, t: 'La ville de cette affaire n’est pas renseignée : le secteur n’est pas comparé du tout. Remplis-la dans sa fiche.' }
      : !quartier ? { ok: false, t: `La ville est comparée (${ville}), pas le quartier : il n’est pas renseigné. Un demandeur qui veut un autre quartier de ${ville} est compté quand même. Remplis « Quartier » dans la fiche de l’affaire.` }
        : { ok: true, t: `Ville et quartier comparés (${ville}, ${quartier}). Un demandeur qui n’a choisi que d’autres quartiers de ${ville} passe au mieux « en partie » : à toi de juger.` };

  const fen = (
    <div className={a.voile} onMouseDown={e => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className={`${a.fen} ${a.qFen}`} role="dialog" aria-modal="true" aria-labelledby="q-demandeurs-titre">
        <div className={a.fenTete}>
          <span className={a.fenIc}><Ic n="groupe" t={20} /></span>
          <div className={a.fenTx}>
            <h2 id="q-demandeurs-titre">{fr('Comment lire ce chiffre')}</h2>
          </div>
          <button type="button" className={a.fermer} aria-label="Fermer" onClick={onFermer}><Ic n="croix" t={16} e={2.2} /></button>
        </div>

        <div className={a.qCorps}>
          <p className={a.qLead}>
            <b>{fr(`${n} ${p ? 'recherches' : 'recherche'} de tes demandeurs ${p ? 'collent' : 'colle'} avec cette affaire sur le papier.`)}</b>
            {' '}
            <span>{fr(p ? `Ce ne sont pas encore ${n} demandeurs intéressés : c’est à vérifier.` : 'Ce n’est pas encore un demandeur intéressé : c’est à vérifier.')}</span>
          </p>

          <div className={a.qChiffres}>
            <div className={`${a.qTuile} ${a.qTuileOr}`}><b>{bons}</b><span>{bons > 1 ? 'correspondent' : 'correspond'}</span><small>{fr('70 % de leurs critères ou plus')}</small></div>
            {avant && <div className={a.qTuile}><b>{partiels}</b><span>{fr('en partie')}</span><small>{fr('de 50 à 69 %')}</small></div>}
          </div>
          {parmi && <p className={a.qParmi}>{fr(`Dont ${parmi}.`)}</p>}

          <section className={a.qBloc}>
            <h3>{fr('Le tri, en trois étapes')}</h3>
            <ol className={a.qEtapes}>
              <li><b>{fr('On écarte')}</b><span>{fr(' une autre ville, un autre type de local, ce qu’il ne cherche pas (une location pour qui veut acheter des murs…), un loyer ou un prix dépassé de plus de 10 %, une surface trop petite, un indispensable qui manque.')}</span></li>
              <li><b>{fr('On note les autres')}</b><span>{fr(' : la part de leurs critères que l’affaire remplit. Ce qu’il cherche compte triple ; le loyer, le prix, le secteur et la surface comptent double.')}</span></li>
              <li><b>{fr('On garde')}</b><span>{fr(' ceux à 50 % ou plus.')}</span></li>
            </ol>
          </section>

          {secteur && (
            <section className={`${a.qBloc} ${secteur.ok ? a.qSecteurOk : a.qSecteur}`}>
              <h3><Ic n={secteur.ok ? 'check' : 'info'} t={15} e={secteur.ok ? 2.4 : 1.9} /><span>{fr('Le secteur de cette affaire')}</span></h3>
              <p>{fr(secteur.t)}</p>
              {manque.length > 0 && <p>{fr(`À compléter aussi : ${enMots(manque)}. Ce qui manque n’est pas comparé : le chiffre est plus large que la réalité.`)}</p>}
            </section>
          )}

          <section className={a.qBloc}>
            <h3>{fr('Pour être sûr')}</h3>
            <p>{fr('Lance le rapprochement : chaque dossier est relu un par un (ses indispensables, ses visites, ce qu’il a dit des locaux montrés) et reçoit Oui, À voir ou Non.')}</p>
            <button type="button" className={a.qVoir} onClick={onVoir}><span>{fr('Vérifier avec le rapprochement')}</span><Ic n="droite" t={15} e={2.3} /></button>
          </section>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(fen, document.body);
}

/* ══ SÉLECTION OU ENVOI ══════════════════════════════════════════════════ */
export function FenEnvoiAcheteurs({ bien, choisis, onFermer, onFait, onFiche }: {
  bien: BienVente; choisis: Acheteur[];
  onFermer: () => void;
  onFait: (message: { t: string; ok: boolean }) => void;
  /* Ouvrir la fiche du client (le mail d'envoi s'y ouvre tout seul). */
  onFiche: (clientId: string) => void;
}) {
  const [en, setEn] = useState<'' | 'selection' | 'espace' | 'mail'>('');
  const [erreur, setErreur] = useState('');
  const seul = choisis.length === 1 ? choisis[0] : null;
  const nom = seul ? nomClient(seul.client) : '';
  const pourSelection = choisis.filter(x => !x.copie);
  const pourEspace = choisis.filter(x => !presente(x.copie));
  const titre = titreBien(bien.donnees || {});

  async function selection() {
    setEn('selection'); setErreur('');
    const r = await mettreEnSelection(bien, pourSelection);
    setEn('');
    if (r.erreurs.length && !r.n) { setErreur(r.erreurs.join('\n')); return; }
    onFait(r.erreurs.length
      ? { t: `${r.n} mis en sélection. Erreurs : ${r.erreurs.join(' ; ')}`, ok: false }
      : { t: r.n > 1 ? `Dans la sélection de ${r.n} demandeurs. Rien n’est parti : envoyez-le depuis leur fiche, ou d’ici.` : `Dans la sélection de ${nomClient(pourSelection[0].client)}. Rien n’est parti.`, ok: true });
  }
  async function espace() {
    setEn('espace'); setErreur('');
    const r = await envoyerDansEspace(bien, pourEspace);
    setEn('');
    if (r.erreurs.length && !r.n) { setErreur(r.erreurs.join('\n')); return; }
    onFait(r.erreurs.length
      ? { t: `${r.n} envoi${r.n > 1 ? 's' : ''} fait${r.n > 1 ? 's' : ''}. Erreurs : ${r.erreurs.join(' ; ')}`, ok: false }
      : { t: r.n > 1 ? `Envoyé dans l’espace de ${r.n} demandeurs.` : r.n === 1 ? 'Envoyé dans son espace.' : 'Ils l’avaient déjà.', ok: true });
  }
  /* Le mail habituel part de sa fiche, sur les biens de son dossier : le bien
     y entre d'abord (à l'étape Sélection s'il n'y était pas), puis sa fiche
     s'ouvre sur la fenêtre d'envoi, ce bien déjà choisi. */
  async function mail() {
    if (!seul) return;
    setEn('mail'); setErreur('');
    const r = await mettreEnSelection(bien, [seul]);
    const id = r.ids[seul.recherche.id];
    setEn('');
    if (!id) { setErreur(r.erreurs.join('\n') || 'Le bien n’a pas pu être ajouté à son dossier.'); return; }
    demanderOuvertureFiche({ clientId: seul.client.id, onglet: 'selection', rechercheId: seul.recherche.id, envoi: [id] });
    onFiche(seul.client.id);
  }

  /* V3.121 (Alexandre : « une autre petite présentation, avec la photo du
     bien, pour que ce soit plus joli ») : le bien en tête, avec sa photo,
     puis à qui il part, puis les trois choix — chacun dit en un mot ce qui
     se passe (« Rien ne part », « Tout de suite », « Tu relis avant »). */
  const d = bien.donnees || {};
  const photo = bien.photo || lirePhotos(d.photos)[0]?.url || '';
  const prix = prixCarte(bien);
  const lieu = villeAffichee(bien.ville || String(d.ville || ''), bien.code_postal || String(d.cp || ''));
  /* Ce que le titre ne dit pas déjà (« Appartement 4 pièces · 92 m² »). */
  const bas = titre.toLowerCase();
  const specs = [...specsBien(d).split(' · ').filter(x => x && !bas.includes(x.toLowerCase())), lieu].filter(Boolean).join(' · ');
  const pourQui = seul
    ? (seul.horsListe ? `pas proposé d’office (${seul.horsListe}), tu le lui proposes quand même` : seul.corr.note >= 0 ? `correspond à ${seul.corr.note} % de sa recherche` : 'choisi par toi')
    : '';

  const fen = (
    <div className={a.voile} onMouseDown={e => { if (e.target === e.currentTarget && !en) onFermer(); }}>
      <div className={a.fen} role="dialog" aria-modal="true" aria-label={`Envoyer ${titre}`}>
        <div className={a.bienTete}>
          <span className={a.bienPhoto}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="" /> : <Ic n="photo" t={24} />}
          </span>
          <div className={a.bienTx}>
            <span className={a.bienSur}>{'Envoyer cette affaire'}</span>
            <h2>{titre}</h2>
            {specs && <p>{specs}</p>}
            <b className={prix.vide ? a.bienPrixVide : a.bienPrix}>{prix.t}</b>
          </div>
          <button type="button" className={a.fermer} aria-label="Fermer" disabled={!!en} onClick={onFermer}><Ic n="croix" t={16} e={2.2} /></button>
        </div>

        <div className={a.pour}>
          <span className={a.pourAv}>
            {choisis.slice(0, 3).map(x => <Avatar key={x.recherche.id} acheteur={x} petit />)}
            {choisis.length > 3 && <span className={a.pourPlus}>{`+${choisis.length - 3}`}</span>}
          </span>
          <span className={a.pourTx}>
            <b>{seul ? `Pour ${nom}` : `Pour ${choisis.length} demandeurs`}</b>
            <small>{seul ? pourQui : choisis.map(x => nomClient(x.client)).join(', ')}</small>
          </span>
        </div>

        <div className={a.choix}>
          <button type="button" className={a.option} disabled={!pourSelection.length || !!en} onClick={selection}>
            <span className={a.optIc}><Ic n="liste" t={20} /></span>
            <span className={a.optTx}>
              <span className={a.optL1}><b>{en === 'selection' ? 'Ajout…' : seul ? 'Mettre dans sa sélection' : 'Mettre dans leur sélection'}</b><i className={a.optMot}>{'Rien ne part'}</i></span>
              <small>{!pourSelection.length
                ? (seul ? 'Il est déjà dans son dossier.' : 'Ils l’ont déjà tous dans leur dossier.')
                : `Le bien entre dans ${seul ? 'son' : 'leur'} dossier, à l’étape Sélection. ${seul ? 'Il ne le voit' : 'Ils ne le voient'} pas encore : c’est toi qui ${seul ? 'le lui envoies' : 'le leur envoies'} ensuite, depuis ${seul ? 'sa fiche' : 'leur fiche'}.${!seul && pourSelection.length < choisis.length ? ` ${choisis.length - pourSelection.length} l’ont déjà.` : ''}`}</small>
            </span>
          </button>
          <button type="button" className={`${a.option} ${a.optionOr}`} disabled={!pourEspace.length || !!en} onClick={espace}>
            <span className={a.optIc}><Ic n="envoyer" t={20} /></span>
            <span className={a.optTx}>
              <span className={a.optL1}><b>{en === 'espace' ? 'Envoi…' : seul ? 'Envoyer dans son espace' : 'Envoyer dans leur espace'}</b><i className={`${a.optMot} ${a.optMotOr}`}>{'Tout de suite'}</i></span>
              <small>{!pourEspace.length
                ? 'Déjà dans son espace.'
                : `Il passe dans « Présentés » et y arrive tout de suite, avec la note de correspondance. ${seul ? 'Il est prévenu' : 'Ils sont prévenus'} sur ${seul ? 'son' : 'leur'} téléphone s’${seul ? 'il l’a' : 'ils l’ont'} accepté.${seul && !seul.recherche.bienvenue_envoye_le ? ' Son lien d’espace ne lui a pas encore été envoyé : par mail, il le verra tout de suite.' : ''}`}</small>
            </span>
          </button>
          {seul && (
            <button type="button" className={a.option} disabled={!!en || !mailDe(seul)} onClick={mail}>
              <span className={a.optIc}><Ic n="mail" t={20} /></span>
              <span className={a.optTx}>
                <span className={a.optL1}><b>{en === 'mail' ? 'Ouverture…' : 'Envoyer par mail…'}</b><i className={a.optMot}>{'Tu relis avant'}</i></span>
                <small>{mailDe(seul) ? 'Sa fiche s’ouvre sur le mail d’envoi habituel, ce bien déjà choisi. Tu relis, il part, et le bien passe dans « Présentés ».' : 'Pas d’adresse mail sur sa fiche.'}</small>
              </span>
            </button>
          )}
          {!seul && <p className={a.aide}>{'Pour un mail, un demandeur à la fois : « Envoyer… » sur sa ligne.'}</p>}
          {erreur && <p className={a.erreur}>{erreur}</p>}
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(fen, document.body);
}
