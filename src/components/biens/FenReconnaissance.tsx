'use client';
import { useEffect, useMemo, useState } from 'react';
import AvatarContact, { personneDe } from '@/components/contacts/AvatarContact';
import { PERSONNE_VIDE } from '@/lib/actes';
import type { ModeAdresse } from '@/lib/actes/reconnaissance';
import type { BienVente } from '@/lib/biens-vente';
import { Ic } from '@/components/documents/ApercuActe';
import { lireClients } from './ChampsBien';
import { Ch, Erreur, Fenetre, Option, Pills, Section, sansAccent, type OptionAcheteur } from './FenetresBien';
import { doublonsContact, nomClient, type ClientMini, type DocLie } from './outils';
import {
  descriptionLocal, faireReconnaissance, honorairesReconnaissance, lieuReconnaissance, montantReconnaissance, societeDe,
  type ModeReco, type NouveauDestinataire, type ResultatReconnaissance,
} from './reconnaissance';
import s from '@/components/documents/Documents.module.css';
import b from './Biens.module.css';

/* ═══ « Reconnaissance » : avant de donner l'adresse d'un local ═══════════
   Werner : « un bouton, ça ouvre un pop-up, il met le mail du client, le
   client signe avec une signature électronique, et moi je reçois la
   notification et le document signé ». Quatre questions, chacune avec ce
   qu'elle change : pour qui (un contact, ou une fiche créée ici), comment il
   signe, ce que le document dit de l'adresse, combien de temps il s'engage.
   Le reste (le local, le montant, les honoraires) vient de l'affaire, et se
   lit dans l'aperçu avant d'envoyer. La suite : reconnaissance.ts. */

const VIDE: NouveauDestinataire = { prenom: '', nom: '', societe: '', email: '', telephone: '' };
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/* Ce que le CRM a déjà pour ce client sur cette affaire. */
function phraseDeja(x: DocLie): string {
  if (x.statut === 'signe') return `Il a déjà signé une reconnaissance pour ce local, le ${dateCourte(x.signe_le || x.updated_at)} : inutile d’en refaire une.`;
  if (x.statut === 'pret' && x.signature) return `Une reconnaissance lui a déjà été envoyée le ${dateCourte(x.signature.lance_le || x.updated_at)} : il ne l’a pas encore signée.`;
  return `Une reconnaissance est déjà en préparation pour lui, depuis le ${dateCourte(x.created_at)}.`;
}

export default function FenReconnaissance({ bien, suggestions = [], deja = [], onFermer, onFait, onVoir }: {
  bien: BienVente;
  /* Les demandeurs de cette affaire (visites, présentations, rapprochements). */
  suggestions?: OptionAcheteur[];
  /* Les reconnaissances de cette affaire déjà faites (pas annulées). */
  deja?: DocLie[];
  onFermer: () => void;
  onFait: (r: ResultatReconnaissance) => void;
  onVoir: (id: string) => void;
}) {
  const [clients, setClients] = useState<ClientMini[] | null>(null);
  const [q, setQ] = useState('');
  const [choisi, setChoisi] = useState<ClientMini | null>(null);
  const [nouveau, setNouveau] = useState<NouveauDestinataire | null>(null);
  const [doublons, setDoublons] = useState<ClientMini[]>([]);
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<ModeReco>('en_ligne');
  /* Par e-mail, il lit le document avant de signer : le secteur seulement,
     d'office. Sur place, il est devant le local : l'adresse exacte. Tant
     que Werner n'a pas choisi lui-même, le choix suit la façon de signer. */
  const [adresse, setAdresse] = useState<ModeAdresse>('secteur');
  const [adresseChoisie, setAdresseChoisie] = useState(false);
  const [duree, setDuree] = useState('12');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let vivant = true;
    lireClients().then(l => { if (vivant) setClients(l); }).catch(e => { if (vivant) { setClients([]); setErreur((e as Error).message); } });
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
    setChoisi(c); setNouveau(null); setDoublons([]); setErreur(''); setQ('');
    setEmail(c?.emails?.find(Boolean) || '');
  };
  const changerMode = (m: ModeReco) => {
    setMode(m); setErreur('');
    if (!adresseChoisie) setAdresse(m === 'sur_place' ? 'complete' : 'secteur');
  };
  const dejaPourLui = choisi ? deja.filter(x => x.client_id === choisi.id) : [];
  const n = Number(duree) || 12;

  async function valider(relire: boolean, quandMeme = false) {
    setErreur('');
    if (!choisi && !nouveau) { setErreur('Pour qui ? Choisis un contact, ou crée sa fiche.'); return; }
    if (nouveau && !(nouveau.nom.trim() || nouveau.prenom.trim() || nouveau.societe.trim())) { setErreur('Son nom, ou celui de sa société ?'); return; }
    const mail = (nouveau ? nouveau.email : email).trim();
    if (mode === 'en_ligne' && !relire && !emailOk(mail)) { setErreur('Son adresse e-mail ? C’est là que partent le lien de signature et son code.'); return; }
    if (mail && !emailOk(mail)) { setErreur(`« ${mail} » n’est pas une adresse e-mail valide.`); return; }
    if (nouveau && !quandMeme) {
      const p = { ...PERSONNE_VIDE, prenom: nouveau.prenom, nom: nouveau.nom, email: mail, telephone: nouveau.telephone };
      const soc = nouveau.societe.trim();
      const l = doublonsContact(clients || [], p).concat(soc ? (clients || []).filter(c => sansAccent(societeDe(c)) === sansAccent(soc)) : []);
      const uniques = l.filter((c, i) => l.findIndex(x => x.id === c.id) === i);
      if (uniques.length) { setDoublons(uniques); return; }
    }
    setOccupe(true);
    try {
      const r = await faireReconnaissance({ bien, client: choisi, nouveau, email: mail, duree: n, adresseMode: adresse, signature: mode, relire });
      onFait(r);
    } catch (e) {
      setErreur((e as Error).message);
      setOccupe(false);
    }
  }

  const champ = (k: keyof NouveauDestinataire, lib: string, o: { auto?: boolean; mode?: 'tel' | 'email'; large?: boolean; exemple?: string } = {}) => (
    <Ch lib={lib} large={o.large}>
      <input className={s.input} value={nouveau ? nouveau[k] : ''} autoFocus={o.auto} inputMode={o.mode} autoComplete="off" placeholder={o.exemple}
        onChange={e => { if (nouveau) setNouveau({ ...nouveau, [k]: e.target.value }); setDoublons([]); setErreur(''); }} />
    </Ch>
  );
  const honoraires = honorairesReconnaissance(bien);
  const montant = montantReconnaissance(bien);
  const pret = !!choisi || !!nouveau;
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

      <Section ic="personne" c="#2e3034" f="#f4f4f5" titre="1. Pour qui ?">
        {choisi ? (
          <div className={b.qui}>
            <div className={`${b.quiL} ${b.quiOn}`}>
              <AvatarContact c={personneDe(nomClient(choisi) || societeDe(choisi))} teinte={{ bg: '', fg: '#f4bc92' }} className={`${b.avatar} ${b.avatarPetit}`} libre />
              <div><b>{[societeDe(choisi), nomClient(choisi)].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ')}</b><small>{[choisi.telephones?.[0], choisi.emails?.[0]].filter(Boolean).join(' · ') || 'Fiche du CRM'}</small></div>
              <button type="button" className={b.notaireChanger} disabled={occupe} onClick={() => choisir(null)}>Changer</button>
            </div>
          </div>
        ) : nouveau ? (
          <>
            <div className={b.g2}>
              {champ('prenom', 'Prénom', { auto: true })}
              {champ('nom', 'Nom')}
              {champ('societe', 'Sa société (s’il y en a une)', { large: true, exemple: 'Ex : SARL Le Comptoir' })}
              {champ('email', mode === 'en_ligne' ? 'E-mail (pour signer)' : 'E-mail (facultatif)', { mode: 'email' })}
              {champ('telephone', 'Téléphone', { mode: 'tel' })}
            </div>
            <div className={s.chAide}>{'Sa fiche se crée dans tes contacts, en demandeur « non filtré » : sa recherche (surface, budget, secteurs) se complète plus tard, depuis sa fiche.'}</div>
            <button type="button" className={b.lien} disabled={occupe} onClick={() => { setNouveau(null); setDoublons([]); setErreur(''); }}>Chercher plutôt dans mes contacts</button>
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
              setNouveau({ ...VIDE, email: mail, prenom: mots.length > 1 ? mots[0] : '', nom: mots.length > 1 ? mots.slice(1).join(' ') : mots[0] || '' });
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

      <Section ic="plume" c="#c2621c" f="#fdf3ec" titre="2. Comment signe-t-il ?">
        <Option nom="reco-mode" on={mode === 'en_ligne'} onChange={() => changerMode('en_ligne')} ic="mail" c="#c2621c" f="#fdf3ec"
          t="Par e-mail, sur son téléphone" s="Il reçoit un lien, puis un code pour signer. Tu reçois le document signé par e-mail, et il est rangé dans ses documents." />
        <Option nom="reco-mode" on={mode === 'sur_place'} onChange={() => changerMode('sur_place')} ic="tablette" c="#2e3034" f="#f4f4f5"
          t="Sur place, sur ton écran" s="Devant le local : il signe au doigt sur ton téléphone ou ta tablette, sans code. Documents s’ouvre, prêt à signer." />
        {choisi && (
          <Ch lib={mode === 'en_ligne' ? 'Son adresse e-mail' : 'Son adresse e-mail (facultative)'}>
            <input className={s.input} value={email} inputMode="email" autoComplete="off" list="reco-emails" placeholder="adresse@exemple.fr"
              onChange={e => { setEmail(e.target.value); setErreur(''); }} />
            {(choisi.emails || []).length > 1 && <datalist id="reco-emails">{(choisi.emails || []).map(x => <option key={x} value={x} />)}</datalist>}
          </Ch>
        )}
        {choisi && <div className={s.chAide}>{mode === 'en_ligne'
          ? 'Le lien de signature et son code y partent, puis son exemplaire signé. Une adresse nouvelle s’ajoute à sa fiche.'
          : 'Elle sert seulement à lui envoyer son exemplaire signé. Sans adresse, tu le gardes dans le CRM.'}</div>}
      </Section>

      <Section ic="lieu" c="#0f766e" f="#effaf8" titre="3. Dans le document, l’adresse">
        <Pills<ModeAdresse> options={[
          { v: 'secteur', l: 'Le secteur seulement', ic: 'cible' },
          { v: 'rue', l: 'La rue, sans le numéro', ic: 'carte' },
          { v: 'complete', l: 'L’adresse exacte', ic: 'lieu' },
        ]} v={adresse} onChange={x => { setAdresse(x); setAdresseChoisie(true); }} />
        <div className={s.chAide}>
          {`Le document dira : « ${lieuReconnaissance(bien, adresse)} ».`}
          {adresse !== 'complete' ? ' Il précise que l’adresse exacte lui est donnée après sa signature, et qu’elle est couverte par le même engagement.' : ' Il la lit avant de signer : à choisir quand il est déjà devant le local.'}
        </div>
      </Section>

      <Section ic="bouclier" c="#475569" f="#f8fafc" titre="4. Combien de temps s’engage-t-il ?">
        <Pills options={['6', '12', '18', '24'].map(v => ({ v, l: `${v} mois` }))} v={duree} onChange={setDuree} />
        <div className={s.chAide}>{`Pendant ${n} mois à compter de sa signature, il ne traite pas ce local en direct avec ${bien.donnees?.nature === 'cession_bail' || bien.donnees?.nature === 'fonds' ? 'le locataire qui cède' : 'le propriétaire'}, ni par une société à lui, ni par une autre agence. 12 mois, c’est la durée de tes mandats.`}</div>
      </Section>

      <div className={b.groupe}>
        <div className={b.groupeT}><Ic n="oeil" t={14} />Ce que le document dira aussi</div>
        <div className={b.reste} style={{ background: '#fff', borderColor: '#eeeeed' }}>
          <div style={{ color: '#334155' }}><Ic n="doc" t={14} /><span>{`Le local : ${descriptionLocal(bien)}${bien.reference ? ` (réf. ${bien.reference})` : ''}.`}</span></div>
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
