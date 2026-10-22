'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AvatarContact, { personneDe } from '@/components/contacts/AvatarContact';
import { PERSONNE_VIDE } from '@/lib/actes';
import type { BienVente } from '@/lib/biens-vente';
import { Ic } from '@/components/documents/ApercuActe';
import { lireClients } from './ChampsBien';
import { titreBien } from '@/lib/biens-vente';
import SaisieAdresse from '@/components/shared/SaisieAdresse';
import { Ch, ChG, Erreur, Fenetre, Option, Pills, Section, Suite, sansAccent, type OptionAcheteur } from './FenetresBien';
import { creerFicheAcheteur, doublonsContact, nomClient, type ClientMini, type DocLie } from './outils';
import {
  COORD_VIDE, coordManquantes, descriptionLocal, faireReconnaissance, honorairesReconnaissance, lieuReconnaissance, montantReconnaissance, societeDe,
  type ModeReco, type NouveauDestinataire, type ResultatReconnaissance,
} from './reconnaissance';
import s from '@/components/documents/Documents.module.css';
import b from './Biens.module.css';

/* ═══ « Reconnaissance » : avant de donner l'adresse d'un local ═══════════
   Werner : « un bouton, ça ouvre un pop-up, il met le mail du client, le
   client signe avec une signature électronique, et moi je reçois la
   notification et le document signé ». Quatre questions, chacune avec ce
   qu'elle change : pour qui (un contact, ou une fiche créée ici), comment il
   signe, ce que devient l'adresse une fois signé (elle part toute seule,
   d'office), combien de temps il s'engage. Le reste (le local, son secteur —
   jamais l'adresse —, le montant, les honoraires) vient de l'affaire, et se
   lit dans l'aperçu avant d'envoyer. La suite : reconnaissance.ts.

   23 octobre 2026 — Alexandre : « l'obliger à mettre ces éléments pour que
   la reconnaissance parte, et comme ça le contact a un peu plus d'info :
   civilité, nom, prénom, numéro, mail ; l'adresse s'il y en a, et la société
   s'il veut faire l'affaire au nom d'une société ». Un seul formulaire, qu'il
   choisisse un contact (rempli depuis sa fiche) ou qu'il en crée un : ce qui y
   est tapé va dans le document, et ce qui manquait sur la fiche s'y ajoute. */

/* Une liste lisible : « sa civilité, son téléphone et son e-mail ». */
const enListe = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : l[0] || '');
/* Les coordonnées d'une fiche, pour remplir le formulaire. */
const coordDe = (c: ClientMini): NouveauDestinataire => ({
  civilite: c.civilite === 'Madame' || c.civilite === 'Monsieur' ? c.civilite : '',
  prenom: c.prenom || '', nom: c.nom || '', societe: societeDe(c),
  email: (c.emails || []).find(Boolean) || '', telephone: (c.telephones || []).find(Boolean) || '', adresse: c.adresse || '',
});
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/* Ce que le CRM a déjà pour ce client sur cette affaire. */
function phraseDeja(x: DocLie): string {
  if (x.statut === 'signe') return `Il a déjà signé une reconnaissance pour ce local, le ${dateCourte(x.signe_le || x.updated_at)} : inutile d’en refaire une.`;
  if (x.statut === 'pret' && x.signature) return `Une reconnaissance lui a déjà été envoyée le ${dateCourte(x.signature.lance_le || x.updated_at)} : il ne l’a pas encore signée.`;
  return `Une reconnaissance est déjà en préparation pour lui, depuis le ${dateCourte(x.created_at)}.`;
}

export default function FenReconnaissance({ bien, pour, suggestions = [], deja = [], onRetour, onFermer, onFait, onVoir, onCompleterAdresse }: {
  bien: BienVente;
  /* Venu de la fiche d'un contact : il est choisi d'avance (l'id de sa fiche). */
  pour?: string;
  /* Venu de la fiche d'un contact : revenir au choix de l'affaire. */
  onRetour?: () => void;
  /* Les demandeurs de cette affaire (visites, présentations, rapprochements). */
  suggestions?: OptionAcheteur[];
  /* Les reconnaissances de cette affaire déjà faites (pas annulées). */
  deja?: DocLie[];
  onFermer: () => void;
  onFait: (r: ResultatReconnaissance) => void;
  onVoir: (id: string) => void;
  /* L'affaire n'a pas d'adresse exacte : la compléter (fiche de l'affaire). */
  onCompleterAdresse?: () => void;
}) {
  const [clients, setClients] = useState<ClientMini[] | null>(null);
  const [q, setQ] = useState('');
  const [choisi, setChoisi] = useState<ClientMini | null>(null);
  /* Un contact à créer : le formulaire, sans fiche derrière. */
  const [nouveau, setNouveau] = useState(false);
  const [coord, setCoord] = useState<NouveauDestinataire>(COORD_VIDE);
  /* Une fois qu'il a tenté d'envoyer, ce qui manque se colore. */
  const [essaye, setEssaye] = useState(false);
  const [doublons, setDoublons] = useState<ClientMini[]>([]);
  const [mode, setMode] = useState<ModeReco>('en_ligne');
  /* Alexandre : « est-ce que tout peut être autonome ? ». Oui, d'office :
     l'adresse part toute seule dès sa signature. */
  const [auto, setAuto] = useState(true);
  const [duree, setDuree] = useState('12');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  /* Alexandre (23 octobre 2026) : « ajouter le contact s'il n'est pas créé,
     un truc rapide, enregistré, contact enregistré ». */
  const [enregistre, setEnregistre] = useState('');

  /* Relues fraîches : une fiche complétée par une reconnaissance précédente
     doit se montrer complète. Le contact venu de sa fiche est choisi d'emblée. */
  const pourId = useRef(pour);
  /* Le formulaire : ce qui manque y est montré (défilé jusqu'au premier champ). */
  const refQui = useRef<HTMLDivElement>(null);
  const montrerManque = () => requestAnimationFrame(() => {
    const el = refQui.current?.querySelector<HTMLElement>('[data-manque], [aria-invalid="true"]');
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const champ = el.matches('input') ? el : el.querySelector<HTMLElement>('button');
    champ?.focus({ preventScroll: true });
  });
  useEffect(() => {
    let vivant = true;
    lireClients(true).then(l => {
      if (!vivant) return;
      setClients(l);
      const c = pourId.current ? l.find(x => x.id === pourId.current) : null;
      if (c) { setChoisi(c); setCoord(coordDe(c)); }
    }).catch(e => { if (vivant) { setClients([]); setErreur((e as Error).message); } });
    return () => { vivant = false; };
  }, []);

  const t = sansAccent(q.trim());
  const trouves = t.length >= 2 ? (clients || []).filter(c => sansAccent(`${c.prenom || ''} ${c.nom || ''} ${societeDe(c)} ${(c.telephones || []).join(' ')} ${(c.emails || []).join(' ')}`).includes(t)).slice(0, 5) : [];
  /* Ses demandeurs sur cette affaire, en raccourci (quatre au plus). */
  const proches = useMemo(() => {
    if (!clients) return [];
    const vus = new Set<string>();
    const out: { c: ClientMini; sous: string }[] = [];
    for (const o of suggestions) {
      if (vus.has(o.clientId)) continue;
      const c = clients.find(x => x.id === o.clientId);
      if (c) { vus.add(c.id); out.push({ c, sous: o.sous }); }
      if (out.length >= 4) break;
    }
    return out;
  }, [clients, suggestions]);

  const choisir = (c: ClientMini | null) => {
    setChoisi(c); setNouveau(false); setDoublons([]); setErreur(''); setQ(''); setEnregistre(''); setEssaye(false);
    setCoord(c ? coordDe(c) : COORD_VIDE);
  };
  const manque = coordManquantes(coord);
  /* Ce que sa fiche n'a pas encore, et qui s'y ajoutera. */
  const aCompleter = choisi ? coordManquantes(coordDe(choisi)) : [];
  const changerMode = (m: ModeReco) => { setMode(m); setErreur(''); };
  const dejaPourLui = choisi ? deja.filter(x => x.client_id === choisi.id) : [];
  const n = Number(duree) || 12;

  /* Les doublons possibles d'un contact à créer (nom, téléphone, e-mail, société). */
  const doublonsDe = (k: NouveauDestinataire) => {
    const p = { ...PERSONNE_VIDE, prenom: k.prenom.trim(), nom: k.nom.trim(), email: k.email.trim(), telephone: k.telephone.trim() };
    const soc = k.societe.trim();
    const l = doublonsContact(clients || [], p).concat(soc ? (clients || []).filter(c => sansAccent(societeDe(c)) === sansAccent(soc)) : []);
    return l.filter((c, i) => l.findIndex(x => x.id === c.id) === i);
  };
  /* Ce qui empêche de partir, dit en clair (ou rien). */
  const bloque = (): string => {
    if (manque.length) return `Pour que la reconnaissance parte, il manque ${enListe(manque)}.`;
    if (!emailOk(coord.email)) return `« ${coord.email.trim()} » n’est pas une adresse e-mail valide.`;
    return '';
  };

  /* Enregistrer le nouveau contact tout de suite, sans attendre l'envoi :
     sa fiche existe, la reconnaissance s'y rangera. Les doublons d'abord. */
  async function enregistrerContact(quandMeme = false) {
    if (!nouveau) return;
    setErreur('');
    const motif = bloque();
    if (motif) { setEssaye(true); setErreur(motif); montrerManque(); return; }
    if (!quandMeme) {
      const d = doublonsDe(coord);
      if (d.length) { setDoublons(d); return; }
    }
    setOccupe(true);
    try {
      const soc = coord.societe.trim();
      const p = { ...PERSONNE_VIDE, civilite: coord.civilite, prenom: coord.prenom.trim(), nom: coord.nom.trim(), email: coord.email.trim().toLowerCase(), telephone: coord.telephone.trim(), adresse: coord.adresse.trim() };
      const c = await creerFicheAcheteur(p, soc ? { denomination: soc } : null);
      setClients(l => [c, ...(l || [])]);
      const garde = coord;
      choisir(c);
      setCoord(garde);
      setEnregistre('Contact enregistré dans tes contacts, en demandeur « non filtré » : sa recherche se complète plus tard, depuis sa fiche.');
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  async function valider(relire: boolean, quandMeme = false) {
    setErreur('');
    if (!choisi && !nouveau) { setErreur('Pour qui ? Choisis un contact, ou crée sa fiche.'); return; }
    const motif = bloque();
    if (motif) { setEssaye(true); setErreur(motif); montrerManque(); return; }
    if (nouveau && !quandMeme) {
      const d = doublonsDe(coord);
      if (d.length) { setDoublons(d); return; }
    }
    setOccupe(true);
    try {
      const r = await faireReconnaissance({ bien, client: choisi, coord, duree: n, signature: mode, adresseApres: auto ? 'auto' : 'main', relire });
      onFait(r);
    } catch (e) {
      setErreur((e as Error).message);
      setOccupe(false);
    }
  }

  /* Un champ du formulaire (une fonction, pas un composant : le champ garde
     son curseur à chaque lettre, AGENTS.md §2.4). */
  const champ = (k: Exclude<keyof NouveauDestinataire, 'civilite'>, lib: string, o: { auto?: boolean; mode?: 'tel' | 'email'; large?: boolean; exemple?: string; liste?: string[]; requis?: boolean } = {}) => {
    const vide = o.requis && essaye && (k === 'email' ? !emailOk(coord.email) : k === 'telephone' ? coord.telephone.replace(/\D/g, '').length < 9 : !coord[k].trim());
    const idListe = o.liste && o.liste.length > 1 ? `reco-${k}` : undefined;
    return (
      <Ch lib={lib} large={o.large}>
        <input className={`${s.input} ${vide ? s.inputManque : ''}`} value={coord[k]} autoFocus={o.auto} inputMode={o.mode} autoComplete="off" placeholder={o.exemple} list={idListe}
          aria-invalid={vide || undefined}
          onChange={e => { setCoord(x => ({ ...x, [k]: e.target.value })); setDoublons([]); setErreur(''); }} />
        {idListe && <datalist id={idListe}>{(o.liste || []).map(x => <option key={x} value={x} />)}</datalist>}
      </Ch>
    );
  };
  /* Le formulaire des coordonnées : le même pour un contact choisi et pour un nouveau. */
  const formulaire = (
    <>
      <ChG lib={essaye && !coord.civilite ? 'Civilité : à choisir' : 'Civilité'}>
        <div className={essaye && !coord.civilite ? b.recoManque : undefined} data-manque={essaye && !coord.civilite ? '' : undefined}>
          <Pills options={[{ v: 'Monsieur' as const, l: 'Monsieur' }, { v: 'Madame' as const, l: 'Madame' }]} v={coord.civilite}
            onChange={v => { setCoord(x => ({ ...x, civilite: v })); setErreur(''); }} />
        </div>
      </ChG>
      <div className={b.g2}>
        {champ('prenom', 'Prénom', { auto: nouveau && !coord.prenom, requis: true })}
        {champ('nom', 'Nom', { requis: true })}
        {champ('telephone', 'Téléphone', { mode: 'tel', requis: true, exemple: '06 12 34 56 78', liste: choisi?.telephones?.filter(Boolean) })}
        {champ('email', 'E-mail', { mode: 'email', requis: true, exemple: 'adresse@exemple.fr', liste: choisi?.emails?.filter(Boolean) })}
        {/* Alexandre : « pour l'adresse, il faut que ça fasse l'API, comme
            partout » : la base adresse nationale, proposée pendant la frappe. */}
        <div className={b.chF} style={{ gridColumn: '1 / -1' }}>
          <span>Son adresse (s’il en a une)</span>
          <SaisieAdresse v={coord.adresse} classeChamp={s.input} etiquette="Son adresse" placeholder="Tape le début : 12 rue de Rivoli…"
            onChange={x => { setCoord(c => ({ ...c, adresse: x })); setErreur(''); }} />
        </div>
        {champ('societe', 'Sa société (s’il fait l’affaire au nom d’une société)', { large: true, exemple: 'Ex : SARL Le Comptoir' })}
      </div>
    </>
  );
  const honoraires = honorairesReconnaissance(bien);
  /* Sans le numéro et la rue sur l'affaire, l'adresse ne peut pas partir. */
  const sansAdresse = !(typeof bien.donnees?.adresse === 'string' && bien.donnees.adresse.trim());
  const montant = montantReconnaissance(bien);
  const pret = !!choisi || nouveau;
  const principal = mode === 'en_ligne' ? 'Envoyer pour signature' : 'Faire signer sur place';

  return (
    <Fenetre sur="Avant de donner l’adresse" titre="Reconnaissance d’information" vive large
      sous="Il reconnaît que c’est toi qui lui as présenté ce local, et s’engage à ne pas traiter en direct, ni par une autre agence. Une fois signée, tu peux lui donner l’adresse."
      occupe={occupe} onFermer={onFermer}
      pied={<>
        <button type="button" className={s.btn} disabled={occupe} onClick={onFermer}>Annuler</button>
        <button type="button" className={s.btn} disabled={occupe || !pret} onClick={() => { void valider(true, doublons.length > 0); }} title="Le document s’ouvre dans Documents, à relire et à compléter avant de l’envoyer">
          <Ic n="crayon" t={14} />Relire d’abord
        </button>
        <button type="button" className={`${s.btn} ${s.btnNavy}`} disabled={occupe || !pret} onClick={() => { void valider(false, doublons.length > 0); }}>
          <Ic n={mode === 'en_ligne' ? 'mail' : 'tablette'} t={15} />{occupe ? 'Préparation…' : doublons.length ? 'Créer sa fiche quand même' : principal}
        </button>
      </>}>

      {/* Alexandre (23 octobre 2026) : « un petit message qui explique comment ça se passe ». */}
      <div className={b.groupe}>
        <div className={b.groupeT}><Ic n="info" t={14} />Comment ça se passe</div>
        <div className={b.reste} style={{ background: '#fff', borderColor: '#eeeeed' }}>
          <div style={{ color: '#334155' }}><Ic n="personne" t={14} /><span>{'Tu choisis le demandeur dans tes contacts, ou tu l’enregistres ici en quelques secondes.'}</span></div>
          <div style={{ color: '#334155' }}><Ic n="plume" t={14} /><span>{'Il signe : sur son téléphone, avec un lien et un code reçus par e-mail, ou sur ton écran, devant le local. Le document ne dit jamais l’adresse, seulement le secteur.'}</span></div>
          <div style={{ color: '#334155' }}><Ic n="mail" t={14} /><span>{'Dès sa signature, il reçoit l’adresse et la fiche du local ; toi, le document signé, et une relance pour l’appeler et caler la visite. Tout est rangé sur sa fiche et sur l’affaire.'}</span></div>
        </div>
      </div>

      {onRetour && (
        <div className={b.recoAff} data-fige="">
          {bien.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={bien.photo} alt="" />
            : <span className={b.recoAffIc}><Ic n="agence" t={18} /></span>}
          <span className={b.recoAffTx}>
            <b>{bien.titre || titreBien(bien.donnees || {})}</b>
            <small>{[bien.adresse || (typeof bien.donnees?.adresse === 'string' ? bien.donnees.adresse : ''), bien.ville].filter(Boolean).join(', ') || 'L’affaire choisie'}</small>
          </span>
          <button type="button" className={b.notaireChanger} disabled={occupe} onClick={onRetour}>Changer</button>
        </div>
      )}

      <div ref={refQui} style={{ display: 'contents' }}>
      <Section ic="personne" c="#2e3034" f="#f4f4f5" titre="1. Pour qui ?">
        {choisi || nouveau ? (
          <>
            {choisi ? (
              <div className={b.qui}>
                <div className={`${b.quiL} ${b.quiOn}`}>
                  <AvatarContact c={personneDe(nomClient(choisi) || societeDe(choisi))} teinte={{ bg: '', fg: '#f4bc92' }} className={`${b.avatar} ${b.avatarPetit}`} libre />
                  <div><b>{[societeDe(choisi), nomClient(choisi)].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ')}</b><small>{[choisi.telephones?.[0], choisi.emails?.[0]].filter(Boolean).join(' · ') || 'Fiche du CRM'}</small></div>
                  <button type="button" className={b.notaireChanger} disabled={occupe} onClick={() => choisir(null)}>Changer</button>
                </div>
              </div>
            ) : (
              <div className={b.recoNouveau}>
                <Ic n="plus" t={13} e={2.6} /><span>{'Un nouveau contact'}</span>
                <button type="button" className={b.lien} disabled={occupe} onClick={() => { setNouveau(false); setCoord(COORD_VIDE); setDoublons([]); setErreur(''); setEssaye(false); }}>Chercher plutôt dans mes contacts</button>
              </div>
            )}
            {enregistre && <div className={b.ventile} role="status"><Ic n="check" t={15} /><span>{enregistre}</span></div>}
            {choisi && aCompleter.length > 0 && !enregistre && (
              <div className={`${b.ventile} ${b.ventileManque}`}>
                <Ic n="info" t={15} />
                <span>{`Sur sa fiche, il manque ${enListe(aCompleter)}. Complète ici : c’est obligatoire pour que la reconnaissance parte, et ça s’ajoutera à sa fiche.`}</span>
              </div>
            )}
            {formulaire}
            <div className={s.chAide}>{choisi
              ? 'Repris de sa fiche. Ce que tu tapes ici est écrit dans le document ; ce qui manquait sur sa fiche s’y ajoute, sans rien y remplacer.'
              : 'Civilité, prénom, nom, téléphone et e-mail sont obligatoires : ils sont écrits dans le document, et sa fiche se crée avec, en demandeur « non filtré ». Sa recherche (surface, budget, secteurs) se complète plus tard, depuis sa fiche.'}</div>
            {nouveau && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <button type="button" className={b.notaireAjout} disabled={occupe} onClick={() => { void enregistrerContact(doublons.length > 0); }}>
                  <Ic n="check" t={13} e={2.6} />{occupe ? 'Enregistrement…' : doublons.length ? 'L’enregistrer quand même' : 'Enregistrer le contact'}
                </button>
                <span className={s.chAide} style={{ margin: 0 }}>{'Ou envoie directement : sa fiche se crée à l’envoi.'}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {proches.length > 0 && !t && (
              <>
                <div className={s.chAide}>{'Ses demandeurs sur cette affaire :'}</div>
                <div className={b.qui}>
                  {proches.map(({ c, sous }) => (
                    <button key={c.id} type="button" className={b.quiL} onClick={() => choisir(c)}>
                      <AvatarContact c={personneDe(nomClient(c) || societeDe(c))} teinte={{ bg: '', fg: '#f4bc92' }} className={`${b.avatar} ${b.avatarPetit}`} libre />
                      <div><b>{[societeDe(c), nomClient(c)].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ')}</b><small>{sous}</small></div>
                      <Ic n="droite" t={15} e={2.4} />
                    </button>
                  ))}
                </div>
              </>
            )}
            <input className={s.cherche} value={q} onChange={e => setQ(e.target.value)} placeholder={clients === null ? 'Chargement des contacts…' : 'Un nom, une société, un e-mail…'} aria-label="Chercher dans les contacts" />
            {trouves.length > 0 && (
              <div className={b.qui}>
                {trouves.map(c => (
                  <button key={c.id} type="button" className={b.quiL} onClick={() => choisir(c)}>
                    <AvatarContact c={personneDe(nomClient(c) || societeDe(c))} teinte={{ bg: '', fg: '#f4bc92' }} className={`${b.avatar} ${b.avatarPetit}`} libre />
                    <div><b>{[societeDe(c), nomClient(c)].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ')}</b><small>{[c.telephones?.[0], c.emails?.[0]].filter(Boolean).join(' · ') || 'Fiche du CRM'}</small></div>
                    <Ic n="droite" t={15} e={2.4} />
                  </button>
                ))}
              </div>
            )}
            {t.length >= 2 && clients && !trouves.length && <div className={b.vide}>{`Personne ne correspond à « ${q.trim()} » dans tes contacts : crée sa fiche juste dessous.`}</div>}
            <button type="button" className={b.notaireAjout} onClick={() => {
              const brut = q.trim();
              const mail = emailOk(brut) ? brut : '';
              const mots = mail ? [] : brut.split(/\s+/).filter(Boolean);
              setNouveau(true); setEssaye(false);
              setCoord({ ...COORD_VIDE, email: mail, prenom: mots.length > 1 ? mots[0] : '', nom: mots.length > 1 ? mots.slice(1).join(' ') : mots[0] || '' });
              setErreur('');
            }}><Ic n="plus" t={13} e={2.6} />Un nouveau contact</button>
            <div className={s.chAide}>{'Pas encore dans le CRM ? Sa fiche se crée ici, en demandeur.'}</div>
          </>
        )}
        {dejaPourLui.length > 0 && (
          <div className={`${b.ventile} ${b.ventileManque}`}>
            <Ic n="info" t={15} />
            <span>
              {phraseDeja(dejaPourLui[0])}
              {' '}<button type="button" className={b.lien} onClick={() => onVoir(dejaPourLui[0].id)}>La voir</button>
            </span>
          </div>
        )}
        {doublons.length > 0 && (
          <div className={`${b.ventile} ${b.ventileManque}`}>
            <Ic n="info" t={15} />
            <span>
              <b>{doublons.length > 1 ? 'Ces contacts existent peut-être déjà :' : 'Ce contact existe peut-être déjà :'}</b>
              {doublons.map(c => (
                <span key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span>{[societeDe(c), nomClient(c), c.telephones?.[0], c.emails?.[0]].filter(Boolean).join(' · ')}</span>
                  <button type="button" className={b.lien} disabled={occupe} onClick={() => choisir(c)}>Utiliser cette fiche</button>
                </span>
              ))}
            </span>
          </div>
        )}
      </Section>
      </div>

      <Section ic="plume" c="#c2621c" f="#fdf3ec" titre="2. Comment signe-t-il ?">
        <Option nom="reco-mode" on={mode === 'en_ligne'} onChange={() => changerMode('en_ligne')} ic="mail" c="#c2621c" f="#fdf3ec"
          t="Par e-mail, sur son téléphone" s="Il reçoit un lien, puis un code pour signer. Tu reçois le document signé par e-mail, et il est rangé dans ses documents." />
        <Option nom="reco-mode" on={mode === 'sur_place'} onChange={() => changerMode('sur_place')} ic="tablette" c="#2e3034" f="#f4f4f5"
          t="Sur place, sur ton écran" s="Devant le local : il signe au doigt sur ton téléphone ou ta tablette, sans code. Documents s’ouvre, prêt à signer." />
        <div className={s.chAide}>{mode === 'en_ligne'
          ? `Le lien de signature et son code partent à ${emailOk(coord.email) ? coord.email.trim() : 'son e-mail (ci-dessus)'}, puis son exemplaire signé.`
          : 'Son e-mail sert ensuite à lui envoyer son exemplaire signé, et l’adresse du local.'}</div>
      </Section>

      <Section ic="lieu" c="#0f766e" f="#effaf8" titre="3. Une fois signée, l’adresse">
        <Suite on={auto} onChange={setAuto} ic="mail" c="#0f766e" f="#effaf8"
          t="Lui envoyer l’adresse tout seul, dès qu’il a signé"
          s="Il reçoit par e-mail l’adresse exacte, la photo et les informations du local, le lien de sa fiche et tes coordonnées. Toi, tu reçois un mail à l’envoi, puis « Signé par tous » avec le PDF, et une relance du jour pour l’appeler." />
        {sansAdresse && (
          <div className={`${b.ventile} ${b.ventileManque}`}>
            <Ic n="info" t={15} />
            <span>
              <b>{'Cette affaire n’a pas encore d’adresse exacte (le numéro et la rue).'}</b>
              {' Sans elle, rien ne peut lui partir une fois signé. Complète-la maintenant, ou plus tard : « Lui envoyer l’adresse » t’attendra sur la fiche de l’affaire.'}
              {onCompleterAdresse && <>{' '}<button type="button" className={b.lien} onClick={onCompleterAdresse}>Compléter l’adresse</button></>}
            </span>
          </div>
        )}
        <div className={s.chAide}>{!auto
          ? 'Décoché, c’est toi qui la lui envoies, quand tu veux, une fois qu’il a signé. « Lui envoyer l’adresse du local » t’attend à deux endroits : dans l’historique de l’affaire, sur la ligne « Reconnaissance signée », et sur sa fiche, onglet Documents. Un aperçu du mail, puis un clic : la date de l’envoi s’affiche ensuite au même endroit.'
          : 'Le document, lui, ne dit jamais l’adresse : seulement le secteur.'}</div>
      </Section>

      <Section ic="bouclier" c="#475569" f="#f8fafc" titre="4. Combien de temps s’engage-t-il ?">
        <Pills options={['6', '12', '18', '24'].map(v => ({ v, l: `${v} mois` }))} v={duree} onChange={setDuree} />
        <div className={s.chAide}>{`Pendant ${n} mois à compter de sa signature, il ne traite pas ce local en direct avec ${bien.donnees?.nature === 'cession_bail' || bien.donnees?.nature === 'fonds' ? 'le locataire qui cède' : 'le propriétaire'}, ni par une société à lui, ni par une autre agence. 12 mois, c’est la durée de tes mandats.`}</div>
      </Section>

      <div className={b.groupe}>
        <div className={b.groupeT}><Ic n="oeil" t={14} />Ce que le document dira</div>
        <div className={b.reste} style={{ background: '#fff', borderColor: '#eeeeed' }}>
          <div style={{ color: '#334155' }}><Ic n="doc" t={14} /><span>{`Le local : ${descriptionLocal(bien)}${bien.reference ? ` (réf. ${bien.reference})` : ''}.`}</span></div>
          <div style={{ color: '#334155' }}><Ic n="lieu" t={14} /><span>{`Où : ${lieuReconnaissance(bien)}. Jamais l’adresse : le document dit qu’elle lui est donnée après sa signature, et qu’elle est couverte par le même engagement.`}</span></div>
          <div style={{ color: '#334155' }}><Ic n="etiquette" t={14} /><span>{montant ? `Montant annoncé : ${montant}.` : 'Pas de montant : l’affaire n’en a pas encore.'}</span></div>
          <div style={{ color: '#334155' }}><Ic n="euro" t={14} /><span>{honoraires
            ? `S’il passait outre, il te devrait le montant de tes honoraires : ${honoraires}.`
            : 'S’il passait outre, il te devrait le montant de tes honoraires (non chiffrés sur l’affaire : le document ne dit pas de chiffre).'}</span></div>
        </div>
        <div className={s.chAide}>{'Pour changer une phrase, ajouter une précision ou un second signataire : « Relire d’abord ». Le document s’ouvre dans Documents, à envoyer de là.'}</div>
      </div>
      <Erreur t={erreur} />
    </Fenetre>
  );
}
