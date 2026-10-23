'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import AvatarContact, { teinteDe } from '@/components/contacts/AvatarContact';
import EnteteRubrique from '@/components/shared/EnteteRubrique';
import { Croix, Ic } from '@/components/documents/ApercuActe';
import { identiteDuJour } from '@/components/documents/outils';
import { supabase } from '@/lib/supabase';
import { toutLire } from '@/lib/registre';
import { signalerEchec } from '@/lib/ecritures';
import { EVT_NOUVEAU_MAIL, signalerMaj } from '@/lib/intentions';
import { CLES_MAIL, conseillerDe, signatureDe } from '@/lib/mail-variables';
import { conjointDe, groupesAdresses, pourAdresses } from '@/lib/foyer';
import { estArchive, typeDe, typesDe } from '@/lib/contacts';
import { IDENTITE_DEFAUT, type IdentiteAgence } from '@/lib/agence';
import {
  STYLES_MAIL, habillageDe, htmlVide, lienPropre, mailLibreHtml, nettoyerHtml, personnaliserHtml, personnaliserObjet, pourGroupe, texteVersHtml,
  type StyleMail,
} from '@/lib/mail-libre';
import s from './PageMail.module.css';
import Curseur from '@/components/shared/Curseur';

/* ═══ Nouveau mail (V3.41) ════════════════════════════════════════════════
   Un mail écrit à la main, à des contacts du CRM ou à n'importe quelle
   adresse. Il part de arogelet@emilio-immo.com, un mail par personne, et se
   range dans le Suivi de chaque contact du CRM (/api/mail).

   · À qui : on cherche un contact (tous les types : acheteur, vendeur,
     notaire, confrère…) ou on tape une adresse, puis Entrée.
   · Le style : « Simple » (le mail tel qu'on l'écrit dans sa messagerie) ou
     « Avec l'en-tête Emilio » (bandeau au logo, nom et téléphone en pied).
   · Le texte : gras, italique, souligné, listes, liens ; {{prénom}} se
     remplace pour chacun. Un collage arrive en texte seul.
   · Les pièces jointes : déposées tout de suite dans le stockage privé ;
     jusqu'à 10 Mo en pièces jointes, au-delà en liens de 7 jours.
   · L'aperçu : le mail exact, fabriqué par les mêmes fonctions que l'envoi
     (src/lib/mail-libre.ts), pour chaque destinataire.
   · V3.234 — « Cc Cci », au bout de la ligne « À » : deux lignes de plus,
     les mêmes pastilles. Dès qu'il y a une copie, le mail part en un seul
     exemplaire, comme depuis une messagerie (« À » et « Cc » visibles de
     tous, « Cci » de personne) ; sans copie, un mail par personne. */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://crm-werner-immobilier.vercel.app';
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FICHIER = 25_000_000;
const MAX_JOINTS = 10_000_000;
const EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'doc', 'docx', 'xls', 'xlsx', 'txt'];
const TYPES: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain',
};
const tailleFr = (o: number) => (o >= 1_000_000 ? `${String(Math.round(o / 100_000) / 10).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1000))} ko`);

type Contact = { id: string; prenom: string | null; nom: string | null; reference: string | null; emails: string[] | null; types?: string[] | null; archive?: boolean | null; [k: string]: unknown };
/* V3.235 : `choisis`, les adresses d'un contact qui reçoivent le mail (une
   seule par défaut ; toutes avant, notaire du dossier compris). */
type Dest = { cle: string; contact: Contact | null; email: string; choisis?: string[] };
type Piece = { id: string; nom: string; taille: number; etat: 'envoi' | 'ok' | 'ko'; chemin?: string; erreur?: string };
/* V3.234 : `role`, la ligne où la personne était (« À », Cc ou Cci). */
type Role = 'a' | 'cc' | 'cci';
type Resultat = { envoyes: { nom: string; a: string[]; clientId: string | null; role?: Role }[]; echecs: string[]; avertissements: string[]; mode: 'pj' | 'liens'; incertains?: string[] };
/* V3.50 : le serveur n'a pas pu dire ce qui est parti (délai dépassé, coupure,
   Mailjet muet). Avant : « Erreur 504 », alors que des mails étaient partis,
   et un deuxième envoi faisait des doubles. */
const PEUT_ETRE = 'L’envoi a peut-être été fait en partie : vérifie le Suivi des contacts avant de renvoyer.';

const nomDe = (c: Contact) => `${c.prenom || ''} ${c.nom || ''}`.trim() || c.reference || 'Contact';
/* V3.236 : toutes les adresses de la fiche, rangées (personne 1, personne 2,
   autres adresses du dossier : src/lib/foyer.ts). La première est celle de
   la personne 1 : c'est elle qui part par défaut. */
const mailsDe = (c: Contact) => groupesAdresses(c).flatMap(g => g.emails);
const sansAccent = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/* Ce que {{prénom}}, {{nom}}… deviennent pour une personne (rien hors CRM). */
const pourDe = (d: Dest) => (d.contact ? pourAdresses(d.contact, adressesDe(d)) : { prenom: '', nom: '', reference: '' });
/* Les adresses qui reçoivent le mail : celles cochées pour un contact (V3.235). */
const adressesDe = (d: Dest) => (d.contact ? (d.choisis?.length ? d.choisis : mailsDe(d.contact).slice(0, 1)) : [d.email]);
const choixDe = (l: Dest[]) => Object.fromEntries(l.filter(d => d.contact).map(d => [d.contact!.id, adressesDe(d)]));
/* V3.236 : à qui part vraiment le mail. Les adresses choisies sont toutes à
   la personne 2 → elle ; toutes du dossier → l'étiquette (le notaire…) ;
   sinon la personne 1. */
type Vers = { genre: 'libre' | 'p1' | 'p2' | 'dossier'; nom: string; prenom: string; etiquette: string };
function versDe(d: Dest): Vers {
  if (!d.contact) return { genre: 'libre', nom: d.email, prenom: '', etiquette: '' };
  const l = adressesDe(d).map(e => e.toLowerCase());
  const g = groupesAdresses(d.contact);
  const dans = (qui: string) => g.filter(x => x.qui === qui).flatMap(x => x.emails.map(e => e.toLowerCase()));
  const j = conjointDe(d.contact.conjoint);
  if (j && l.length && l.every(e => dans('p2').includes(e))) return { genre: 'p2', nom: `${j.prenom || ''} ${j.nom || ''}`.trim() || 'Personne 2', prenom: j.prenom || '', etiquette: '' };
  if (l.length && l.every(e => dans('dossier').includes(e))) {
    const etiquette = g.find(x => x.qui === 'dossier' && x.emails.some(e => l.includes(e.toLowerCase())))?.lib || 'Autre';
    return { genre: 'dossier', nom: `${etiquette} · ${nomDe(d.contact)}`, prenom: '', etiquette };
  }
  return { genre: 'p1', nom: nomDe(d.contact), prenom: d.contact.prenom || '', etiquette: '' };
}
const quiDest = (d: Dest) => versDe(d).nom;
/* « Envoyer à Maxime », « Envoyer au notaire », « Envoyer à l'avocat »… */
const AU: Record<string, string> = { Notaire: 'au notaire', Avocat: 'à l’avocat', 'Expert-comptable': 'à l’expert-comptable', Syndic: 'au syndic', Banque: 'à la banque' };
function aQui(d: Dest): string {
  const v = versDe(d);
  if (v.genre === 'dossier') return AU[v.etiquette] || 'à cette adresse';
  return `à ${v.prenom || v.nom}`;
}
const libDest = (x: Dest) => (x.contact ? `${quiDest(x)} · ${adressesDe(x).join(', ')}` : x.email);

/* Les messages pré-rédigés : le texte, et un objet proposé si le champ est vide. */
const messagesPre = (sig: string) => [
  { ic: 'calendrier', lib: 'Proposition de visite', objet: 'Proposition de visite', corps: `Bonjour {{prénom}},\n\nSuite à notre échange, je souhaiterais vous proposer la visite d’un local qui correspond à vos critères.\n\nSeriez-vous disponible prochainement ? Je reste à votre disposition pour organiser cela dans les meilleurs délais.\n\n${sig}` },
  { ic: 'boucle', lib: 'Suivi de recherche', objet: 'Point sur votre recherche', corps: `Bonjour {{prénom}},\n\nJe vous contacte pour faire un point sur votre recherche de local. J'ai plusieurs locaux en cours d'analyse qui pourraient correspondre à vos critères.\n\nPuis-je vous appeler dans la semaine pour en discuter ?\n\n${sig}` },
  { ic: 'liste', lib: 'Compte-rendu d’activité', objet: 'Le point sur nos recherches', corps: `Bonjour {{prénom}},\n\nJe souhaitais vous faire un bilan de nos recherches en cours. Nous avons analysé plusieurs locaux sur vos secteurs prioritaires et je travaille activement à vous trouver le bon emplacement.\n\nN'hésitez pas à me faire part de vos remarques ou nouvelles priorités.\n\n${sig}` },
  { ic: 'check', lib: 'Confirmation de rendez-vous', objet: 'Confirmation de notre rendez-vous', corps: `Bonjour {{prénom}},\n\nJe vous confirme notre rendez-vous. N'oubliez pas de vous munir de vos documents (pièce d'identité, Kbis, derniers bilans) si vous souhaitez avancer rapidement sur un local.\n\nÀ très bientôt !\n\n${sig}` },
  { ic: 'plume', lib: 'Message libre', objet: '', corps: `Bonjour {{prénom}},\n\n${sig}` },
];
/* Le message de départ : le bonjour, une ligne pour écrire (le curseur s'y
   pose au premier clic), la signature des Paramètres. */
const accueil = (sig: string, salut = 'Bonjour {{prénom}},') => texteVersHtml(`${salut}\n\n\n\n${sig}`);
const LIGNE_A_ECRIRE = 2;

/* ── Les destinataires : des pastilles, et une recherche dessous ──
   V3.235 — Alexandre : « quand je mets un nom connu ou juste un mail, ça
   reprend le contact enregistré à ce mail, mais ça met tous les mails qu'il y
   a dans son contact […] il faudrait que je puisse sélectionner quel mail
   envoyer ». Un contact n'envoie plus qu'à UNE adresse par défaut : celle
   qu'on a tapée (si la recherche passe par son adresse), sinon la première de
   sa fiche. S'il en a plusieurs, la petite fenêtre « Ses adresses » s'ouvre à
   l'ajout pour cocher les autres ; la pastille dit « 1 sur 5 » et la rouvre. */
function ChampDestinataires({ contacts, dests, onAjout, onRetrait, onAdresses, exclus, invite, libelle = 'Ajouter un destinataire' }: {
  contacts: Contact[] | null; dests: Dest[]; onAjout: (d: Dest) => void; onRetrait: (cle: string) => void;
  /* V3.235 : les adresses cochées d'un contact. */
  onAdresses: (cle: string, choisis: string[]) => void;
  /* V3.234 : les personnes déjà sur une autre ligne (À, Cc, Cci). */
  exclus?: Dest[];
  invite?: string; libelle?: string;
}) {
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  /* V3.235 : la pastille dont on choisit les adresses. */
  const [adresses, setAdresses] = useState<string | null>(null);
  const refAdresses = useRef<HTMLDivElement | null>(null);
  const saisie = q.trim().toLowerCase();
  const pris = useMemo(() => new Set([...dests, ...(exclus || [])].map(d => d.cle)), [dests, exclus]);
  const resultats = useMemo(() => {
    if (!contacts || saisie.length < 1) return [] as Contact[];
    const x = sansAccent(saisie);
    /* V3.236 : aussi par la personne 2 et par toutes les adresses de la fiche. */
    const j2 = (c: Contact) => { const j = conjointDe(c.conjoint); return j ? `${j.prenom || ''} ${j.nom || ''}` : ''; };
    return contacts.filter(c => !pris.has(`c-${c.id}`) && sansAccent(`${c.prenom || ''} ${c.nom || ''} ${c.reference || ''} ${j2(c)} ${mailsDe(c).join(' ')}`).includes(x)).slice(0, 8);
  }, [contacts, saisie, pris]);
  const adresseLibre = MAIL.test(saisie) && !pris.has(`a-${saisie}`) && !resultats.some(c => mailsDe(c).map(e => e.toLowerCase()).includes(saisie));
  type Choix = { k: string; contact: Contact | null; email: string; off: boolean };
  /* L'adresse proposée pour un contact : trouvé par son nom, la première de
     sa fiche ; trouvé par une de ses adresses, celle-là. */
  const trouvee = (c: Contact) => {
    const x = sansAccent(saisie);
    const parNom = sansAccent(`${c.prenom || ''} ${c.nom || ''} ${c.reference || ''}`).includes(x);
    /* Trouvé par le nom de la personne 2 (V3.236) : sa première adresse. */
    const j = conjointDe(c.conjoint);
    const p2 = !parNom && j && sansAccent(`${j.prenom || ''} ${j.nom || ''}`).includes(x) ? groupesAdresses(c).find(g => g.qui === 'p2')?.emails[0] : undefined;
    return p2 || (!parNom && mailsDe(c).find(e => sansAccent(e).includes(x))) || mailsDe(c)[0] || '';
  };
  const choix: Choix[] = [
    ...resultats.map(c => ({ k: `c-${c.id}`, contact: c, email: trouvee(c), off: !mailsDe(c).length })),
    ...(adresseLibre ? [{ k: `a-${saisie}`, contact: null, email: saisie, off: false }] : []),
  ];

  /* La fenêtre « Ses adresses » se ferme d'un clic à côté ou avec Échap. */
  useEffect(() => {
    if (!adresses) return;
    const dehors = (e: MouseEvent) => { if (refAdresses.current && !refAdresses.current.contains(e.target as Node)) setAdresses(null); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAdresses(null); } };
    document.addEventListener('mousedown', dehors);
    window.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', dehors); window.removeEventListener('keydown', esc, true); };
  }, [adresses]);

  function prendre(c: Choix | undefined) {
    if (!c || c.off) return;
    onAjout({ cle: c.k, contact: c.contact, email: c.email, ...(c.contact ? { choisis: [c.email] } : {}) });
    setQ(''); setActif(0);
    if (c.contact && mailsDe(c.contact).length > 1) { setOuvert(false); setAdresses(c.k); }
  }
  function touche(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif(a => Math.min(a + 1, Math.max(0, choix.length - 1))); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActif(a => Math.max(0, a - 1)); return; }
    if (e.key === 'Enter' || ((e.key === ',' || e.key === ';' || e.key === ' ') && MAIL.test(saisie))) {
      if (!choix.length) return;
      e.preventDefault();
      prendre(choix[Math.min(actif, choix.length - 1)].off ? choix.find(c => !c.off) : choix[Math.min(actif, choix.length - 1)]);
      return;
    }
    if (e.key === 'Backspace' && !q && dests.length) onRetrait(dests[dests.length - 1].cle);
  }

  const enChoix = adresses ? dests.find(d => d.cle === adresses && d.contact) : undefined;
  return (
    <div className={s.dests}>
      <div className={s.destsChamp} onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
        {dests.map(d => {
          const toutes = d.contact ? mailsDe(d.contact) : [];
          return (
            <span key={d.cle} className={`${s.pastille} ${d.contact ? '' : s.pastilleLibre}`} title={adressesDe(d).join(', ')}>
              {d.contact
                ? <AvatarContact c={d.contact as never} teinte={teinteDe(d.contact as never)} taille={22} />
                : <span className={s.pastilleIc}><Ic n="mail" t={13} /></span>}
              <span>{d.contact ? quiDest(d) : d.email}</span>
              {d.contact && toutes.length > 1 && (
                <button type="button" className={s.pastilleNb} aria-expanded={adresses === d.cle}
                  aria-label={`Choisir les adresses de ${nomDe(d.contact)} : ${adressesDe(d).length} sur ${toutes.length}`}
                  onClick={e => { e.stopPropagation(); setOuvert(false); setAdresses(a => (a === d.cle ? null : d.cle)); }}>
                  {`${adressesDe(d).length} sur ${toutes.length}`}<Ic n="bas" t={11} />
                </button>
              )}
              <button type="button" aria-label={`Retirer ${d.contact ? nomDe(d.contact) : d.email}`} onClick={e => { e.stopPropagation(); onRetrait(d.cle); }}><Croix t={12} /></button>
            </span>
          );
        })}
        <input value={q} onChange={e => { setQ(e.target.value); setOuvert(true); setActif(0); setAdresses(null); }} onKeyDown={touche}
          onFocus={() => setOuvert(true)} onBlur={() => setTimeout(() => setOuvert(false), 150)}
          placeholder={dests.length ? 'Ajouter quelqu’un…' : invite || 'Un contact ou une adresse e-mail'}
          aria-label={libelle} autoComplete="off" inputMode="email" />
      </div>
      {ouvert && saisie && (
        <div className={s.liste} role="listbox">
          {contacts === null && <div className={s.listeVide}>Chargement des contacts…</div>}
          {contacts !== null && !choix.length && <div className={s.listeVide}>{'Aucun contact ne correspond. Tape l’adresse e-mail en entier pour l’ajouter.'}</div>}
          {choix.map((c, i) => (
            <button key={c.k} type="button" role="option" aria-selected={i === actif} disabled={c.off}
              className={`${s.choix} ${i === actif ? s.choixOn : ''}`} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActif(i)} onClick={() => prendre(c)}>
              {c.contact
                ? <AvatarContact c={c.contact as never} teinte={teinteDe(c.contact as never)} taille={32} />
                : <span className={s.choixIc}><Ic n="mail" t={16} /></span>}
              <span className={s.choixTx}>
                <b>{c.contact ? nomDe(c.contact) : `Envoyer à ${c.email}`}</b>
                <small>{c.contact
                  ? [typesDe(c.contact).map(t => typeDe(t).lib).join(', '), c.email || 'pas d’adresse e-mail', mailsDe(c.contact).length > 1 ? `+ ${mailsDe(c.contact).length - 1} autre${mailsDe(c.contact).length > 2 ? 's' : ''} adresse${mailsDe(c.contact).length > 2 ? 's' : ''}` : ''].filter(Boolean).join(' · ')
                  : 'Adresse hors CRM : rien ne sera noté dans un Suivi'}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {enChoix?.contact && (() => {
        const c = enChoix.contact;
        const toutes = mailsDe(c);
        const coche = adressesDe(enChoix);
        const basculer = (e: string) => {
          const l = coche.includes(e) ? coche.filter(x => x !== e) : [...coche, e];
          /* Au moins une : décocher la dernière ne fait rien. */
          if (l.length) onAdresses(enChoix.cle, toutes.filter(x => l.includes(x)));
        };
        /* V3.236 : rangées par personne, puis les autres adresses du dossier sous leur étiquette. */
        const groupes = groupesAdresses(c);
        const dossier = groupes.filter(g => g.qui === 'dossier');
        const ligne = (e: string, etiq?: string) => (
          <label key={e} className={s.adresse}>
            <input type="checkbox" checked={coche.includes(e)} onChange={() => basculer(e)} />
            {etiq && <em className={s.adresseEtiq}>{etiq}</em>}
            <span>{e}</span>
          </label>
        );
        return (
          <div ref={refAdresses} className={s.adresses} role="dialog" aria-label={`Les adresses de ${nomDe(c)}`}>
            <p className={s.adressesTitre}>
              <b>{`${toutes.length} adresses sur la fiche de ${nomDe(c)}`}</b>
              <span>{'Coche celles qui doivent recevoir ce mail.'}</span>
            </p>
            <div className={s.adressesListe}>
              {groupes.filter(g => g.qui !== 'dossier').map(g => (
                <div key={g.qui} className={s.adressesGroupe}>
                  {(groupes.length > 1) && <span className={s.adressesQui}>{g.qui === 'p2' ? `${g.lib} · personne 2` : g.lib}</span>}
                  {g.emails.map(e => ligne(e))}
                </div>
              ))}
              {dossier.length > 0 && (
                <div className={s.adressesGroupe}>
                  <span className={s.adressesQui}>Autres adresses du dossier</span>
                  {dossier.map(g => g.emails.map(e => ligne(e, g.lib)))}
                </div>
              )}
            </div>
            <div className={s.adressesPied}>
              <button type="button" className={`${s.btn} ${s.btnPetit}`} onClick={() => onAdresses(enChoix.cle, toutes)}>Toutes</button>
              <button type="button" className={`${s.btn} ${s.btnPetit} ${s.btnMarine}`} onClick={() => setAdresses(null)}><Ic n="check" t={14} />{'C’est bon'}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── L'éditeur : un texte mis en forme, sans rien d'autre ── */
type Etats = { b: boolean; i: boolean; u: boolean; ul: boolean; ol: boolean; a: boolean };
const ETATS_VIDES: Etats = { b: false, i: false, u: false, ul: false, ol: false, a: false };

function Outil({ lib, on, onClick, children }: { lib: string; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`${s.outil} ${on ? s.outilOn : ''}`} title={lib} aria-label={lib} aria-pressed={on}
      onMouseDown={e => e.preventDefault()} onClick={onClick}>{children}</button>
  );
}
const PictoLien = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" /><path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4L5 12.7a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></svg>;
const PictoNum = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 5h1.5v4M4 9h3" /><path d="M4 15h2.5a.8.8 0 0 1 0 1.8L4 19h3" /></svg>;
const PictoPuces = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10" /><circle cx="5" cy="6" r="1.2" fill="currentColor" /><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="5" cy="18" r="1.2" fill="currentColor" /></svg>;

function Editeur({ refEd, onChange, messages, onMessage, onFocus }: {
  refEd: React.RefObject<HTMLDivElement | null>; onChange: (html: string) => void;
  messages: ReturnType<typeof messagesPre>; onMessage: (i: number) => void; onFocus: () => void;
}) {
  const [etats, setEtats] = useState<Etats>(ETATS_VIDES);
  const [lien, setLien] = useState<string | null>(null);
  const [erreurLien, setErreurLien] = useState('');
  const [menu, setMenu] = useState(false);
  const plage = useRef<Range | null>(null);

  const lire = useCallback(() => {
    const ed = refEd.current, sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!ed || !sel || !sel.rangeCount || !ed.contains(sel.anchorNode)) return;
    let n: Node | null = sel.anchorNode, a = false;
    while (n && n !== ed) { if ((n as HTMLElement).tagName === 'A') a = true; n = n.parentNode; }
    try {
      setEtats({
        b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), u: document.queryCommandState('underline'),
        ul: document.queryCommandState('insertUnorderedList'), ol: document.queryCommandState('insertOrderedList'), a,
      });
    } catch { /* un navigateur sans queryCommandState : les boutons restent neutres */ }
  }, [refEd]);
  useEffect(() => {
    document.addEventListener('selectionchange', lire);
    return () => document.removeEventListener('selectionchange', lire);
  }, [lire]);

  const faire = (cmd: string, v?: string) => {
    refEd.current?.focus();
    document.execCommand(cmd, false, v);
    onChange(refEd.current?.innerHTML || '');
    lire();
  };
  function ouvrirLien() {
    const sel = window.getSelection();
    if (etats.a) { faire('unlink'); return; }
    plage.current = sel && sel.rangeCount && refEd.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setErreurLien(''); setLien('');
  }
  function poserLien() {
    const u = lienPropre(lien || '');
    if (!u) { setErreurLien('Cette adresse ne semble pas complète (ex. www.wernerimmobilier.com).'); return; }
    const ed = refEd.current;
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (sel && plage.current) { sel.removeAllRanges(); sel.addRange(plage.current); }
    if (!plage.current || plage.current.collapsed) {
      const affiche = u.replace(/^mailto:/i, '').replace(/^tel:/i, '');
      document.execCommand('insertHTML', false, `<a href="${u.replace(/"/g, '&quot;')}">${affiche.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a>&nbsp;`);
    } else document.execCommand('createLink', false, u);
    onChange(ed.innerHTML);
    setLien(null); plage.current = null;
  }
  /* Un collage arrive en texte seul : rien de Word ni d'une page web. */
  function coller(e: ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const t = e.clipboardData.getData('text/plain');
    if (t) document.execCommand('insertText', false, t);
    onChange(refEd.current?.innerHTML || '');
  }
  function touche(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ouvrirLien(); }
  }

  return (
    <div className={s.editeur}>
      <div className={s.outils} role="toolbar" aria-label="Mise en forme" data-defile="fondu">
        <Outil lib="Gras (Ctrl + B)" on={etats.b} onClick={() => faire('bold')}><b>B</b></Outil>
        <Outil lib="Italique (Ctrl + I)" on={etats.i} onClick={() => faire('italic')}><i className={s.lettreI}>I</i></Outil>
        <Outil lib="Souligné (Ctrl + U)" on={etats.u} onClick={() => faire('underline')}><u>U</u></Outil>
        <span className={s.sep} />
        <Outil lib="Liste à puces" on={etats.ul} onClick={() => faire('insertUnorderedList')}>{PictoPuces}</Outil>
        <Outil lib="Liste numérotée" on={etats.ol} onClick={() => faire('insertOrderedList')}>{PictoNum}</Outil>
        <span className={s.sep} />
        <Outil lib={etats.a ? 'Retirer le lien' : 'Ajouter un lien (Ctrl + K)'} on={etats.a} onClick={ouvrirLien}>{PictoLien}</Outil>
        <button type="button" className={s.outilTexte} onMouseDown={e => e.preventDefault()} onClick={() => faire('insertText', '{{prénom}}')} title="Insérer {{prénom}} : remplacé par le prénom de chacun" aria-label="Insérer le prénom">
          <Ic n="personne" t={14} /><span className={s.cacheTel}>Prénom</span>
        </button>
        <div className={s.outilsFin}>
          <button type="button" className={s.outilTexte} aria-expanded={menu} aria-label="Messages pré-rédigés" title="Messages pré-rédigés" onMouseDown={e => e.preventDefault()} onClick={() => setMenu(m => !m)}>
            <Ic n="bulle" t={14} /><span className={s.cacheTel}>Messages pré-rédigés</span><Ic n="bas" t={12} />
          </button>
          {menu && (
            <div className={s.menu} role="menu" onMouseLeave={() => setMenu(false)}>
              {messages.map((m, i) => (
                <button key={m.lib} type="button" role="menuitem" onClick={() => { setMenu(false); onMessage(i); }}>
                  <span className={s.menuIc}><Ic n={m.ic} t={15} /></span><span>{m.lib}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {lien !== null && (
        <div className={s.lien}>
          <span className={s.lienIc}>{PictoLien}</span>
          <input autoFocus value={lien} placeholder="Adresse du lien : www.…, https://…, ou une adresse e-mail" aria-label="Adresse du lien"
            onChange={e => { setLien(e.target.value); setErreurLien(''); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); poserLien(); } if (e.key === 'Escape') setLien(null); }} />
          <button type="button" className={`${s.btn} ${s.btnPetit} ${s.btnMarine}`} onClick={poserLien}>Ajouter</button>
          <button type="button" className={`${s.btn} ${s.btnPetit}`} onClick={() => setLien(null)}>Annuler</button>
          {erreurLien && <i className={s.lienErreur}>{erreurLien}</i>}
        </div>
      )}
      <div ref={refEd} className={s.texte} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Message"
        spellCheck onInput={() => onChange(refEd.current?.innerHTML || '')} onPaste={coller} onKeyDown={touche} onKeyUp={lire} onMouseUp={lire} onFocus={onFocus} />
    </div>
  );
}

/* ── L'aperçu : le mail tel qu'il arrivera, destinataire par destinataire ── */
function FenetreApercu({ dests, cc, cci, objet, corps, style, h, conseiller, pieces, envoi, onFermer, onEnvoyer, libEnvoyer, manque }: {
  dests: Dest[]; cc: Dest[]; cci: Dest[]; objet: string; corps: string; style: StyleMail; h: ReturnType<typeof habillageDe>; conseiller: string;
  pieces: Piece[]; envoi: boolean; onFermer: () => void; onEnvoyer: () => void; libEnvoyer: string;
  /* Ce qui manque encore pour envoyer (vide : tout est prêt). */
  manque: string;
}) {
  const [qui, setQui] = useState(0);
  const [ecran, setEcran] = useState<'ordi' | 'tel'>(() => (typeof window !== 'undefined' && window.innerWidth < 760 ? 'tel' : 'ordi'));
  /* V3.234 : avec une copie, un seul mail, le même pour tous. */
  const groupe = cc.length + cci.length > 0;
  const d = dests[Math.min(qui, dests.length - 1)];
  const pour = groupe ? pourGroupe(dests.map(pourDe)) : d ? pourDe(d) : { prenom: '', nom: '', reference: '' };
  const html = mailLibreHtml({ style, corps: personnaliserHtml(corps, pour, conseiller), h });
  const sujet = personnaliserObjet(objet, pour, conseiller) || objet;
  const lourd = pieces.reduce((t, p) => t + p.taille, 0) > MAX_JOINTS;
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !envoi) onFermer(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [envoi, onFermer]);

  const fen = (
    <div className={s.voile} onMouseDown={e => { if (e.target === e.currentTarget && !envoi) onFermer(); }}>
      <div className={s.fen} role="dialog" aria-modal="true" aria-label="Aperçu du mail">
        <div className={s.fenTete}>
          <span className={s.fenIc}><Ic n="oeil" t={20} /></span>
          <div className={s.fenTx}>
            <h2>Aperçu du mail</h2>
            <p>{groupe ? 'Un seul mail, le même pour tous : tel que le recevront tes destinataires.' : dests.length > 1 ? `Tel que le recevra chaque destinataire : choisis-en un pour voir son prénom à la place de {{prénom}}.` : 'Tel que le recevra ton destinataire.'}</p>
          </div>
          <button type="button" className={s.fermer} aria-label="Fermer" disabled={envoi} onClick={onFermer}><Croix /></button>
        </div>
        <div className={s.fenCorps}>
          <dl className={s.entete}>
            <dt>De</dt><dd>{'Werner Immobilier · contact@wernerimmobilier.com'}</dd>
            <dt>À</dt>
            <dd>{!dests.length ? <span className={s.manque}>{'Personne pour l’instant'}</span> : groupe ? dests.map(libDest).join(', ') : dests.length > 1
              ? <select className={s.select} value={qui} onChange={e => setQui(Number(e.target.value))} aria-label="Voir le mail de">
                  {dests.map((x, i) => <option key={x.cle} value={i}>{libDest(x)}</option>)}
                </select>
              : d ? libDest(d) : ''}</dd>
            {cc.length > 0 && <><dt>Cc</dt><dd>{cc.map(libDest).join(', ')}</dd></>}
            {cci.length > 0 && <><dt>Cci</dt><dd>{`${cci.map(libDest).join(', ')} — ${cci.length > 1 ? 'invisibles' : 'invisible'} pour les autres`}</dd></>}
            <dt>Objet</dt><dd><b>{sujet || '(sans objet)'}</b></dd>
            {pieces.length > 0 && <><dt>{lourd ? 'Liens' : 'Pièces'}</dt><dd>{`${pieces.map(p => p.nom).join(', ')}${lourd ? ' — trop lourdes pour être jointes : le mail portera des liens de téléchargement, valables 7 jours.' : ''}`}</dd></>}
          </dl>
          <div className={s.ecrans} role="group" aria-label="Taille de l’écran">
            <Curseur cle={ecran} />
            <button type="button" aria-pressed={ecran === 'ordi'} onClick={() => setEcran('ordi')}><Ic n="ecran" t={14} /><span>Ordinateur</span></button>
            <button type="button" aria-pressed={ecran === 'tel'} onClick={() => setEcran('tel')}><Ic n="tablette" t={14} /><span>Téléphone</span></button>
          </div>
          <div className={s.cadreApercu} data-ecran={ecran}>
            <iframe title="Aperçu du mail" sandbox="" srcDoc={html} className={s.iframe} />
          </div>
        </div>
        <div className={s.fenPied}>
          {manque && <span className={s.fenManque}>{manque}</span>}
          <button type="button" className={s.btn} disabled={envoi} onClick={onFermer}><Ic n="crayon" t={15} />Modifier</button>
          <button type="button" className={`${s.btn} ${s.btnOr}`} disabled={envoi || !!manque} onClick={onEnvoyer}><Ic n="envoyer" t={15} />{envoi ? 'Envoi…' : libEnvoyer}</button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(fen, document.body);
}

/* Le petit dessin de chaque style, pour choisir d'un coup d'œil. */
function Vignette({ k }: { k: StyleMail }) {
  return (
    <span className={s.vignette} data-style={k} aria-hidden="true">
      {k === 'emilio' && <i className={s.vTete} />}
      <i className={s.vLigne} style={{ width: '46%' }} /><i className={s.vLigne} /><i className={s.vLigne} style={{ width: '82%' }} /><i className={s.vLigne} style={{ width: '64%' }} />
      {k === 'emilio' && <i className={s.vPied} />}
    </span>
  );
}

/* ── Le mail, depuis la page « Nouveau mail » ou depuis la fiche d'un contact ──
   V3.51 : Alexandre, sur la fiche d'un contact : « un petit bouton envoyer un
   mail […] ça affiche la trame de Nouveau mail, mais en restant sur la fiche,
   comme ça je n'ai pas à remettre le nom ». `pour` : le contact déjà en
   destinataire (et la recherche affichée, pour le Suivi d'un acheteur). */
export type ContactMail = Contact;
type PourMail = { contact: Contact; rechercheId?: string | null };
/* V3.131 (Alexandre, dans une demande Internet : « quand on clique sur
   Écrire, un pop-up de nouveau mail qui reprend le mail ») : une adresse hors
   du CRM, son prénom pour le bonjour, l'objet proposé. */
export type AdresseMail = { email: string; prenom?: string; objet?: string };
const destDe = (c: Contact): Dest[] => (mailsDe(c).length ? [{ cle: `c-${c.id}`, contact: c, email: mailsDe(c)[0], choisis: [mailsDe(c)[0]] }] : []);

function Redaction({ pour = null, pourPlusieurs = null, adresse = null, objet0 = '', enFenetre = false, onNavigate, onFermer, onEnvoye, refSale }: {
  pour?: PourMail | null;
  adresse?: AdresseMail | null;
  /* L'objet proposé au départ (une demande Internet : « Votre demande… »). */
  objet0?: string;
  /* V3.88 : les contacts cochés dans la liste, tous en destinataires. */
  pourPlusieurs?: Contact[] | null;
  enFenetre?: boolean;
  onNavigate?: (page: string, data?: unknown) => void;
  onFermer?: () => void; onEnvoye?: () => void;
  /* Vrai dès que quelque chose est écrit : la fenêtre demande avant de fermer. */
  refSale?: React.MutableRefObject<boolean>;
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const destsDepart = (): Dest[] => (pour ? destDe(pour.contact) : pourPlusieurs ? pourPlusieurs.flatMap(destDe) : adresse ? [{ cle: `a-${adresse.email}`, contact: null, email: adresse.email }] : []);
  const [dests, setDests] = useState<Dest[]>(destsDepart);
  /* V3.234 : les copies, et les deux lignes qui les portent (cachées au départ). */
  const [cc, setCc] = useState<Dest[]>([]);
  const [cci, setCci] = useState<Dest[]>([]);
  const [copies, setCopies] = useState(false);
  const groupe = cc.length + cci.length > 0;
  const horsA = useMemo(() => [...cc, ...cci], [cc, cci]);
  const horsCc = useMemo(() => [...dests, ...cci], [dests, cci]);
  const horsCci = useMemo(() => [...dests, ...cc], [dests, cc]);
  const [objet, setObjet] = useState(objet0 || adresse?.objet || '');
  /* Hors du CRM, {{prénom}} ne se remplace pas : le bonjour porte le prénom. */
  const salut = adresse?.prenom ? `Bonjour ${adresse.prenom},` : undefined;
  const acc = (sig: string) => accueil(sig, salut);
  const [style, setStyle] = useState<StyleMail>('simple');
  const [html, setHtml] = useState('');
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [identite, setIdentite] = useState<IdentiteAgence>(IDENTITE_DEFAUT);
  const [apercu, setApercu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [depose, setDepose] = useState(false);
  const refEd = useRef<HTMLDivElement | null>(null);
  const refFichier = useRef<HTMLInputElement | null>(null);
  const place = useRef(false);

  const signature = signatureDe(params);
  const messages = messagesPre(signature);
  const conseiller = conseillerDe(params);
  const h = useMemo(() => habillageDe(params, identite, SITE), [params, identite]);

  const remplir = useCallback((x: string) => {
    if (refEd.current) refEd.current.innerHTML = x;
    setHtml(x);
  }, []);

  /* Les contacts (tous, sauf les archivés), la signature et l'identité de l'agence. */
  useEffect(() => {
    let vivant = true;
    remplir(acc(signatureDe({})));
    /* Par pages de 1 000 (V3.43) : au-delà, les derniers contacts manquaient. */
    toutLire<Contact>((de, a) => supabase.from('clients').select('*').order('nom').order('id').range(de, a)).then(({ data, erreur: error }) => {
      if (!vivant) return;
      if (error) { setErreur(`Les contacts n’ont pas pu être lus : ${error}`); setContacts([]); return; }
      setContacts(((data || []) as Contact[]).filter(c => !estArchive(c as never)));
    });
    supabase.from('parametres').select('cle, valeur').in('cle', CLES_MAIL).then(({ data }) => {
      if (!vivant || !data) return;
      const p = Object.fromEntries(data.map((r: { cle: string; valeur: string | null }) => [r.cle, r.valeur || '']));
      setParams(p);
      /* Le message encore vierge prend la bonne signature ; un texte déjà commencé n'est pas touché. */
      if (refEd.current && refEd.current.innerHTML === acc(signatureDe({}))) remplir(acc(signatureDe(p)));
    });
    identiteDuJour().then(x => { if (vivant) setIdentite(x); }).catch(() => { /* l'identité par défaut suffit pour le pied */ });
    return () => { vivant = false; };
  }, [remplir]);

  /* Au premier clic dans le message de départ, le curseur se pose sur la
     ligne à écrire, entre le bonjour et la signature. */
  function premierFocus() {
    if (place.current) return;
    place.current = true;
    setTimeout(() => {
      const ed = refEd.current;
      const ligne = ed?.children[LIGNE_A_ECRIRE];
      if (!ed || !ligne || ed.innerHTML !== acc(signature)) return;
      const r = document.createRange();
      r.setStart(ligne, 0); r.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges(); sel?.addRange(r);
    }, 0);
  }

  function choisirMessage(i: number) {
    const m = messages[i];
    const vierge = !refEd.current || htmlVide(html) || refEd.current.innerHTML === acc(signature);
    if (!vierge && !confirm('Remplacer le message déjà écrit par ce message pré-rédigé ?')) return;
    remplir(texteVersHtml(m.corps));
    if (!objet.trim() && m.objet) setObjet(m.objet);
  }

  /* ── Les pièces jointes : déposées tout de suite ── */
  async function ajouterFichiers(liste: FileList | File[]) {
    for (const f of Array.from(liste)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!EXTS.includes(ext)) { setPieces(l => [...l, { id, nom: f.name, taille: f.size, etat: 'ko', erreur: 'format refusé (PDF, image, Word, Excel, texte)' }]); continue; }
      if (f.size > MAX_FICHIER) { setPieces(l => [...l, { id, nom: f.name, taille: f.size, etat: 'ko', erreur: 'plus de 25 Mo' }]); continue; }
      setPieces(l => [...l, { id, nom: f.name, taille: f.size, etat: 'envoi' }]);
      try {
        const r = await fetch('/api/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'depot', ext }) });
        const j = await r.json().catch(() => null) as { ok?: boolean; erreur?: string; chemin?: string; jeton?: string } | null;
        if (!r.ok || !j?.ok || !j.chemin || !j.jeton) throw new Error(j?.erreur || `Erreur ${r.status}`);
        const { error } = await supabase.storage.from('mandats').uploadToSignedUrl(j.chemin, j.jeton, f, { contentType: TYPES[ext] || f.type || 'application/octet-stream' });
        if (error) throw new Error(error.message);
        setPieces(l => l.map(p => (p.id === id ? { ...p, etat: 'ok', chemin: j.chemin } : p)));
      } catch (e) {
        setPieces(l => l.map(p => (p.id === id ? { ...p, etat: 'ko', erreur: (e as Error).message } : p)));
      }
    }
  }
  function deposer(e: DragEvent<HTMLElement>) {
    e.preventDefault(); setDepose(false);
    if (e.dataTransfer.files?.length) void ajouterFichiers(e.dataTransfer.files);
  }

  const piecesOk = pieces.filter(p => p.etat === 'ok');
  const poids = piecesOk.reduce((t, p) => t + p.taille, 0);
  const enCours = pieces.some(p => p.etat === 'envoi');
  const corps = nettoyerHtml(html);
  const sale = !resultat && ((!!objet.trim() && objet.trim() !== (objet0 || adresse?.objet || '').trim()) || pieces.length > 0 || (!!html && !htmlVide(corps) && html !== acc(signature) && html !== acc(signatureDe({}))));
  useEffect(() => { if (refSale) refSale.current = sale; }, [refSale, sale]);
  const nbPersonnes = dests.length;
  const libA = nbPersonnes === 1
    ? `Envoyer ${aQui(dests[0])}`
    : nbPersonnes > 1 ? `Envoyer à ${nbPersonnes} personnes` : 'Envoyer';
  const libEnvoyer = groupe && nbPersonnes ? `${libA} + ${cc.length + cci.length} en copie` : libA;

  function controler(): string {
    if (!dests.length) return groupe ? 'Ajoute au moins une personne en « À ».' : 'Ajoute au moins un destinataire.';
    if (!objet.trim()) return 'L’objet est vide.';
    if (htmlVide(corps)) return 'Le message est vide.';
    if (enCours) return 'Une pièce jointe est encore en cours d’envoi : attends qu’elle soit prête.';
    return '';
  }
  /* L'aperçu s'ouvre dès qu'il y a un message ; l'envoi, lui, attend que
     tout soit prêt (la fenêtre dit ce qui manque). */
  function ouvrirApercu() {
    if (htmlVide(corps)) { setErreur('Le message est vide.'); return; }
    setErreur(''); setApercu(true);
  }

  async function envoyer() {
    const pb = controler();
    if (pb) { setErreur(pb); setApercu(false); return; }
    setEnvoi(true); setErreur('');
    try {
      let r: Response;
      try {
        r = await fetch('/api/mail', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'envoyer', objet: objet.trim(), html: corps, style,
            contacts: dests.filter(d => d.contact).map(d => d.contact!.id),
            adresses: dests.filter(d => !d.contact).map(d => d.email),
            /* V3.235 : pour chaque contact, les adresses cochées (sinon le serveur les prendrait toutes). */
            choix: choixDe(dests),
            /* V3.234 : les copies ; avec elles, un seul mail pour tous. */
            ...(cc.length ? { cc: { contacts: cc.filter(d => d.contact).map(d => d.contact!.id), adresses: cc.filter(d => !d.contact).map(d => d.email), choix: choixDe(cc) } } : {}),
            ...(cci.length ? { cci: { contacts: cci.filter(d => d.contact).map(d => d.contact!.id), adresses: cci.filter(d => !d.contact).map(d => d.email), choix: choixDe(cci) } } : {}),
            /* Depuis la fiche d'un acheteur : son Suivi, dans la recherche affichée. */
            ...(pour?.rechercheId ? { recherches: { [pour.contact.id]: pour.rechercheId } } : {}),
            pieces: piecesOk.map(p => ({ chemin: p.chemin, nom: p.nom })),
          }),
        });
      } catch {
        /* La connexion a lâché en route : la demande est peut-être arrivée. */
        throw new Error(PEUT_ETRE);
      }
      const j = await r.json().catch(() => null) as (Resultat & { ok?: boolean; erreur?: string; incertain?: boolean }) | null;
      /* Pas de réponse lisible (la page « 504 » de Vercel), ou le serveur dit
         lui-même qu'il ne sait pas : peut-être parti. */
      if (!j || j.incertain) throw new Error(j?.erreur || PEUT_ETRE);
      if (!r.ok || !j.ok) throw new Error(j.erreur || (r.status >= 500 ? PEUT_ETRE : `Erreur ${r.status}`));
      if (j.avertissements?.length) signalerEchec('Le mail est parti, mais son suivi', j.avertissements.join(' ; '));
      setResultat({ envoyes: j.envoyes, echecs: j.echecs || [], avertissements: j.avertissements || [], mode: j.mode, incertains: j.incertains || [] });
      setApercu(false);
      onEnvoye?.();
    } catch (e) {
      setErreur((e as Error).message);
      setApercu(false);
    }
    setEnvoi(false);
  }

  function recommencer() {
    setResultat(null); setDests(destsDepart()); setCc([]); setCci([]); setCopies(false); setObjet(objet0 || adresse?.objet || ''); setPieces([]); setErreur(''); setStyle('simple'); place.current = false;
    setTimeout(() => remplir(acc(signature)), 0);
  }

  if (resultat) {
    const dansCrm = resultat.envoyes.filter(x => x.clientId);
    const horsCrm = resultat.envoyes.filter(x => !x.clientId);
    /* V3.234 : un mail avec des copies — qui était en « À », en Cc, en Cci. */
    const deRole = (r: Role) => resultat.envoyes.filter(x => (x.role || 'a') === r).map(x => x.nom || x.a[0]);
    const avecCopies = resultat.envoyes.some(x => x.role && x.role !== 'a');
    const qui = avecCopies
      ? [`À : ${deRole('a').join(', ')}`, deRole('cc').length ? `Cc : ${deRole('cc').join(', ')}` : '', deRole('cci').length ? `Cci : ${deRole('cci').join(', ')}` : ''].filter(Boolean).join(' · ')
      : resultat.envoyes.map(x => x.nom || x.a[0]).join(', ');
    return (
      <div className={`${s.carte} ${enFenetre ? s.carteFen : ''}`}>
        <div className={s.fait}>
          <span className={s.faitIc}><Ic n="check" t={26} e={2.6} /></span>
          <h2>{avecCopies ? 'Mail envoyé, avec tes copies' : resultat.envoyes.length > 1 ? `Mail envoyé à ${resultat.envoyes.length} personnes` : 'Mail envoyé'}</h2>
          <p>{qui}</p>
          <ul className={s.faitListe}>
            {dansCrm.length > 0 && <li><Ic n="historique" t={15} /><span>{`Noté dans le Suivi de ${dansCrm.map(x => x.nom || x.a[0]).join(', ')}.`}</span></li>}
            {horsCrm.length > 0 && <li><Ic n="info" t={15} /><span>{`${horsCrm.map(x => x.a[0]).join(', ')} : hors CRM, rien n’est noté.`}</span></li>}
            {resultat.mode === 'liens' && <li><Ic n="trombone" t={15} /><span>{'Les pièces étaient trop lourdes : elles sont parties en liens de téléchargement, valables 7 jours.'}</span></li>}
            {resultat.echecs.map(e => <li key={e} className={s.faitKo}><Croix t={14} /><span>{`Pas parti : ${e}`}</span></li>)}
            {(resultat.incertains || []).length > 0 && <li className={s.faitKo}><Ic n="info" t={15} /><span>{`Peut-être parti : ${(resultat.incertains || []).join(', ')}. Mailjet n’a pas répondu à temps : vérifie leur Suivi avant de renvoyer.`}</span></li>}
          </ul>
          <div className={s.faitBoutons}>
            {!enFenetre && onNavigate && dansCrm.length === 1 && (
              <button type="button" className={s.btn} onClick={async () => {
                const { data } = await supabase.from('clients').select('*').eq('id', dansCrm[0].clientId!).maybeSingle();
                if (data) onNavigate('fiche', data);
              }}><Ic n="personne" t={15} />{`Ouvrir la fiche de ${dansCrm[0].nom || 'ce contact'}`}</button>
            )}
            <button type="button" className={`${s.btn} ${enFenetre ? '' : s.btnMarine}`} onClick={recommencer}><Ic n="plume" t={15} />Écrire un autre mail</button>
            {enFenetre && onFermer && <button type="button" className={`${s.btn} ${s.btnMarine}`} onClick={onFermer}><Ic n="check" t={15} />Fermer</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`${s.carte} ${enFenetre ? s.carteFen : ''} ${depose ? s.carteDepose : ''}`}
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDepose(true); } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDepose(false); }} onDrop={deposer}>

        {pourPlusieurs && pourPlusieurs.some(c => !mailsDe(c).length) && (() => {
          const sans = pourPlusieurs.filter(c => !mailsDe(c).length).map(nomDe);
          return <div className={s.erreur}>{`${sans.length > 1 ? `${sans.length} contacts n’ont` : '1 contact n’a'} pas d’adresse e-mail sur sa fiche : ${sans.slice(0, 6).join(', ')}${sans.length > 6 ? '…' : ''}. Ils ne recevront rien.`}</div>;
        })()}
        {pour && !mailsDe(pour.contact).length && !dests.length && (
          <div className={s.erreur}>{`${nomDe(pour.contact)} n’a pas d’adresse e-mail sur sa fiche : ajoute-la avec « Modifier », ou tape une adresse ci-dessous.`}</div>
        )}

        {/* ── À qui, l'objet ── */}
        <div className={s.ligne}>
          <span className={s.ligneLib}>À</span>
          <ChampDestinataires contacts={contacts} dests={dests} exclus={horsA} onAdresses={(k, l) => setDests(x => x.map(d => (d.cle === k ? { ...d, choisis: l } : d)))}
            onAjout={d => { setDests(l => [...l, d]); setErreur(''); }} onRetrait={k => setDests(l => l.filter(x => x.cle !== k))} />
          {!copies && (
            <button type="button" className={s.copiesBtn} onClick={() => setCopies(true)} title="Mettre quelqu’un en copie (Cc) ou en copie cachée (Cci)">
              <span>Cc</span><span>Cci</span>
            </button>
          )}
        </div>
        {copies && (
          <>
            <div className={s.ligne}>
              <span className={s.ligneLib}>Cc</span>
              <ChampDestinataires contacts={contacts} dests={cc} exclus={horsCc} onAdresses={(k, l) => setCc(x => x.map(d => (d.cle === k ? { ...d, choisis: l } : d)))} invite="En copie : un contact ou une adresse" libelle="Ajouter une personne en copie"
                onAjout={d => { setCc(l => [...l, d]); setErreur(''); }} onRetrait={k => setCc(l => l.filter(x => x.cle !== k))} />
            </div>
            <div className={s.ligne}>
              <span className={s.ligneLib}>Cci</span>
              <ChampDestinataires contacts={contacts} dests={cci} exclus={horsCci} onAdresses={(k, l) => setCci(x => x.map(d => (d.cle === k ? { ...d, choisis: l } : d)))} invite="Copie invisible pour les autres" libelle="Ajouter une personne en copie cachée"
                onAjout={d => { setCci(l => [...l, d]); setErreur(''); }} onRetrait={k => setCci(l => l.filter(x => x.cle !== k))} />
            </div>
            {groupe && (
              <p className={s.noteCopies}>
                <Ic n="info" t={15} />
                <span>{nbPersonnes > 1
                  ? `Avec une copie, le mail part en un seul exemplaire, comme depuis ta messagerie : les ${nbPersonnes} personnes en « À » et celles en « Cc » voient toutes les adresses. En « Cci », la copie est cachée : les autres ne la voient pas.`
                  : 'Avec une copie, le mail part en un seul exemplaire, comme depuis ta messagerie : chacun voit qui est en « À » et en « Cc ». En « Cci », la copie est cachée : les autres ne la voient pas.'}</span>
              </p>
            )}
          </>
        )}
        <div className={s.ligne}>
          <label className={s.ligneLib} htmlFor="mail-objet">Objet</label>
          <input id="mail-objet" className={s.objet} value={objet} onChange={e => { setObjet(e.target.value); setErreur(''); }} placeholder="L’objet du mail" maxLength={200} />
        </div>

        {/* ── Le style ── */}
        <div className={s.styles} role="radiogroup" aria-label="Style du mail">
          {STYLES_MAIL.map(x => (
            <button key={x.k} type="button" role="radio" aria-checked={style === x.k} className={s.style} onClick={() => setStyle(x.k)}>
              <Vignette k={x.k} />
              <span className={s.styleTx}><b>{x.lib}</b><small>{x.aide}</small></span>
              <span className={s.styleRond} />
            </button>
          ))}
        </div>

        {/* ── Le texte ── */}
        <Editeur refEd={refEd} onChange={x => { setHtml(x); setErreur(''); }} messages={messages} onMessage={choisirMessage} onFocus={premierFocus} />
        <p className={s.aide}>{groupe
          ? '{{prénom}} se remplace par le prénom de la personne en « À » (« Marie et Paul » s’il y en a plusieurs ; les copies ne comptent pas). Un texte collé arrive sans sa mise en forme.'
          : '{{prénom}} se remplace par le prénom de chacun (rien pour une adresse hors CRM : « Bonjour, »). Un texte collé arrive sans sa mise en forme.'}</p>

        {/* ── Les pièces jointes ── */}
        <div className={s.pieces}>
          <input ref={refFichier} type="file" multiple hidden accept={EXTS.map(x => `.${x}`).join(',')}
            onChange={e => { if (e.target.files?.length) void ajouterFichiers(e.target.files); e.target.value = ''; }} />
          <button type="button" className={s.ajouter} onClick={() => refFichier.current?.click()}>
            <Ic n="trombone" t={16} /><span>Joindre des fichiers</span><small>ou glisse-les ici</small>
          </button>
          {pieces.map(p => (
            <span key={p.id} className={s.piece} data-etat={p.etat} title={p.erreur || p.nom}>
              <Ic n="doc" t={15} />
              <span className={s.pieceNom}>{p.nom}</span>
              <small>{p.etat === 'envoi' ? 'envoi…' : p.etat === 'ko' ? p.erreur : tailleFr(p.taille)}</small>
              <button type="button" aria-label={`Retirer ${p.nom}`} onClick={() => setPieces(l => l.filter(x => x.id !== p.id))}><Croix t={12} /></button>
            </span>
          ))}
        </div>
        {piecesOk.length > 0 && (
          <p className={s.aide}>{poids > MAX_JOINTS
            ? `${tailleFr(poids)} en tout : trop lourd pour des pièces jointes. Le mail portera des liens de téléchargement, valables 7 jours.`
            : `${tailleFr(poids)} en tout : jointes au mail (jusqu’à 10 Mo).`}</p>
        )}

        {erreur && <div className={s.erreur}>{erreur}</div>}

        {/* ── Le pied ── */}
        <div className={s.pied}>
          <span className={s.piedNote}>{groupe
            ? 'Tu relis le mail tel qu’il arrivera, puis tu l’envoies. Un seul mail pour tous, avec tes copies : il se range dans le Suivi de chaque contact du CRM.'
            : enFenetre && pour
            ? 'Tu relis le mail tel qu’il arrivera, puis tu l’envoies. Il se range dans son Suivi.'
            : 'Tu relis le mail tel qu’il arrivera, puis tu l’envoies. Un mail par personne : chacun ne voit que son adresse, et l’envoi se range dans le Suivi des contacts du CRM.'}</span>
          <div className={s.piedBoutons}>
            {enFenetre && onFermer && <button type="button" className={s.btn} disabled={envoi} onClick={onFermer}>Annuler</button>}
            <button type="button" className={`${s.btn} ${s.btnOr}`} onClick={ouvrirApercu}><Ic n="oeil" t={16} />Aperçu avant envoi</button>
          </div>
        </div>
      </div>

      {apercu && (
        <FenetreApercu dests={dests} cc={cc} cci={cci} objet={objet} corps={corps} style={style} h={h} conseiller={conseiller} pieces={piecesOk}
          envoi={envoi} onFermer={() => setApercu(false)} onEnvoyer={envoyer} libEnvoyer={libEnvoyer} manque={controler()} />
      )}
    </>
  );
}

export default function PageMail({ onNavigate }: { onNavigate: (page: string, data?: unknown) => void }) {
  return (
    <div className={s.page}>
      <EnteteRubrique titre="Nouveau mail" icone={<Ic n="mail" t={22} />}
        phrase="À un contact du CRM ou à n’importe quelle adresse. Il part de contact@wernerimmobilier.com, à ton nom."
        tuiles={[]} actif="" onChoisir={() => {}} label="" />
      <Redaction onNavigate={onNavigate} />
    </div>
  );
}

/* ── Écrire à un contact sans quitter sa fiche (V3.51) ──
   La même rédaction que « Nouveau mail », dans une fenêtre, le contact déjà
   en destinataire. Ni Échap ni un clic à côté ne la ferment : un mail à
   moitié écrit ne se perd pas par mégarde ; la croix demande avant.
   V3.87 : sans contact, c'est « Envoyer un mail » du haut de l'écran
   (Alexandre : « que ça affiche un pop-up joli, qui reprend tout ce qu'il y
   a dans Nouveau mail, au lieu d'aller sur la page »). */
export function FenetreMail({ contact = null, contacts = null, adresse = null, objet = '', rechercheId = null, onFermer, onEnvoye }: {
  contact?: ContactMail | null;
  /* V3.88 : plusieurs contacts (la sélection de la liste). */
  contacts?: ContactMail[] | null;
  /* V3.131 : une adresse hors du CRM (une demande Internet), et l'objet proposé. */
  adresse?: AdresseMail | null;
  objet?: string;
  rechercheId?: string | null; onFermer: () => void; onEnvoye?: () => void;
}) {
  const sale = useRef(false);
  const fermer = () => {
    if (sale.current && !confirm('Fermer sans envoyer ? Le mail que tu as commencé sera perdu.')) return;
    onFermer();
  };
  const nom = contact ? nomDe(contact) : '';
  const titre = contact ? `Écrire à ${nom}` : adresse ? `Écrire à ${adresse.prenom || adresse.email}` : contacts?.length ? `Envoyer un mail à ${contacts.length > 1 ? `${contacts.length} contacts` : nomDe(contacts[0])}` : 'Envoyer un mail';
  const fen = (
    <div className={s.voile}>
      <div className={`${s.fen} ${s.fenMail}`} role="dialog" aria-modal="true" aria-label={titre}>
        <div className={s.fenTete}>
          <span className={s.fenIc}><Ic n="mail" t={20} /></span>
          <div className={s.fenTx}>
            <h2>{titre}</h2>
            <p>{contact ? 'Le mail part de contact@wernerimmobilier.com, à ton nom.' : adresse ? `À ${adresse.email}. Le mail part de contact@wernerimmobilier.com, à ton nom.` : contacts?.length ? 'Un mail par personne : chacun ne voit que son adresse. Il part de contact@wernerimmobilier.com, à ton nom.' : 'À un contact du CRM ou à n’importe quelle adresse. Il part de contact@wernerimmobilier.com, à ton nom.'}</p>
          </div>
          <button type="button" className={s.fermer} aria-label="Fermer" onClick={fermer}><Croix /></button>
        </div>
        <div className={s.fenCorps}>
          <Redaction pour={contact ? { contact, rechercheId } : null} pourPlusieurs={contacts} adresse={adresse} objet0={objet} enFenetre onFermer={fermer} onEnvoye={onEnvoye} refSale={sale} />
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(fen, document.body);
}

/* « Envoyer un mail », de n'importe quel écran (V3.87) : montée une fois dans
   AppLayout, elle s'ouvre sur EVT_NOUVEAU_MAIL (lib/intentions). */
export function NouveauMailPartout() {
  const [ouvert, setOuvert] = useState(false);
  const [cle, setCle] = useState(0);
  useEffect(() => {
    const ouvrir = () => { setCle(k => k + 1); setOuvert(true); };
    window.addEventListener(EVT_NOUVEAU_MAIL, ouvrir);
    return () => window.removeEventListener(EVT_NOUVEAU_MAIL, ouvrir);
  }, []);
  if (!ouvert) return null;
  return <FenetreMail key={cle} onFermer={() => setOuvert(false)} onEnvoye={() => signalerMaj()} />;
}
