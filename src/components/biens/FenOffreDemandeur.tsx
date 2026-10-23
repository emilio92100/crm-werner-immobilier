'use client';
/* ═══ « Préparer une offre » : pour quel demandeur ? (23 octobre 2026) ══════
   Alexandre : une offre préparée depuis l'affaire sans demandeur ne se
   rangeait nulle part (ni sur sa fiche, ni dans son historique). D'abord
   « Pour quel demandeur ? » : ses demandeurs sur cette affaire, la recherche
   dans les contacts, ou un nouveau contact en quatre champs. L'offre est
   alors rattachée à sa fiche (et au local de son dossier s'il l'a) : signée,
   elle va dans son historique, dans ses documents, et dans les offres de
   l'affaire. « Sans fiche » garde l'ancien chemin. */
import { useEffect, useMemo, useState } from 'react';
import AvatarContact, { personneDe } from '@/components/contacts/AvatarContact';
import { PERSONNE_VIDE } from '@/lib/actes';
import type { BienVente } from '@/lib/biens-vente';
import { supabase } from '@/lib/supabase';
import { Ic } from '@/components/documents/ApercuActe';
import { lireClients } from './ChampsBien';
import { Ch, ChG, Erreur, Fenetre, Pills, sansAccent, type OptionAcheteur } from './FenetresBien';
import { creerFicheAcheteur, doublonsContact, nomClient, type ClientMini } from './outils';
import { societeDe } from './reconnaissance';
import s from '@/components/documents/Documents.module.css';
import b from './Biens.module.css';

export type ChoixOffre = { clientId: string | null; rechercheId: string | null; bienId: string | null; client: ClientMini | null };

type Nouveau = { civilite: '' | 'Madame' | 'Monsieur'; prenom: string; nom: string; societe: string; telephone: string; email: string };
const VIDE: Nouveau = { civilite: '', prenom: '', nom: '', societe: '', telephone: '', email: '' };

export default function FenOffreDemandeur({ bien, suggestions = [], onFermer, onChoisi }: {
  bien: BienVente;
  suggestions?: OptionAcheteur[];
  onFermer: () => void;
  /* Le demandeur choisi (ou aucun) : l'offre se crée et s'ouvre. */
  onChoisi: (x: ChoixOffre) => Promise<void>;
}) {
  const [clients, setClients] = useState<ClientMini[] | null>(null);
  const [q, setQ] = useState('');
  const [nouveau, setNouveau] = useState<Nouveau | null>(null);
  const [doublons, setDoublons] = useState<ClientMini[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    let vivant = true;
    lireClients().then(l => { if (vivant) setClients(l); }).catch(e => { if (vivant) { setClients([]); setErreur((e as Error).message); } });
    return () => { vivant = false; };
  }, []);
  const t = sansAccent(q.trim());
  const trouves = t.length >= 2 ? (clients || []).filter(c => sansAccent(`${c.prenom || ''} ${c.nom || ''} ${societeDe(c)} ${(c.telephones || []).join(' ')} ${(c.emails || []).join(' ')}`).includes(t)).slice(0, 6) : [];
  const proches = useMemo(() => {
    if (!clients) return [];
    const vus = new Set<string>();
    const out: { c: ClientMini; sous: string }[] = [];
    for (const o of suggestions) {
      if (vus.has(o.clientId)) continue;
      const c = clients.find(x => x.id === o.clientId);
      if (c) { vus.add(c.id); out.push({ c, sous: o.sous }); }
      if (out.length >= 5) break;
    }
    return out;
  }, [clients, suggestions]);

  /* Le local de cette affaire dans son dossier (s'il lui a été présenté) :
     l'offre s'y relie, comme depuis sa fiche. */
  async function choisir(c: ClientMini) {
    setOccupe(true); setErreur('');
    try {
      const { data, error } = await supabase.from('biens').select('id, recherche_id').eq('client_id', c.id).eq('bien_vente_id', bien.id).limit(1);
      if (error) throw new Error('Son dossier n’a pas pu être lu : ' + error.message);
      const copie = ((data || []) as { id: string; recherche_id: string | null }[])[0] || null;
      await onChoisi({ clientId: c.id, rechercheId: copie?.recherche_id || null, bienId: copie?.id || null, client: c });
    } catch (e) {
      setErreur((e as Error).message);
      setOccupe(false);
    }
  }
  async function creer(quandMeme = false) {
    if (!nouveau) return;
    if (!(nouveau.nom.trim() || nouveau.prenom.trim())) { setErreur('Son nom ?'); return; }
    const p = { ...PERSONNE_VIDE, civilite: nouveau.civilite, prenom: nouveau.prenom.trim(), nom: nouveau.nom.trim(), email: nouveau.email.trim().toLowerCase(), telephone: nouveau.telephone.trim() };
    const soc = nouveau.societe.trim();
    if (!quandMeme) {
      const l = doublonsContact(clients || [], p).concat(soc ? (clients || []).filter(c => sansAccent(societeDe(c)) === sansAccent(soc)) : []);
      const u = l.filter((c, i) => l.findIndex(x => x.id === c.id) === i);
      if (u.length) { setDoublons(u); return; }
    }
    setOccupe(true); setErreur('');
    try {
      const c = await creerFicheAcheteur(p, soc ? { denomination: soc } : null);
      await onChoisi({ clientId: c.id, rechercheId: null, bienId: null, client: c });
    } catch (e) {
      setErreur((e as Error).message);
      setOccupe(false);
    }
  }
  const champ = (k: Exclude<keyof Nouveau, 'civilite'>, lib: string, o: { mode?: 'tel' | 'email'; large?: boolean; auto?: boolean } = {}) => (
    <Ch lib={lib} large={o.large}>
      <input className={s.input} value={nouveau ? nouveau[k] : ''} autoFocus={o.auto} inputMode={o.mode} autoComplete="off" disabled={occupe}
        onChange={e => { if (nouveau) setNouveau({ ...nouveau, [k]: e.target.value }); setDoublons([]); setErreur(''); }} />
    </Ch>
  );
  const ligne = (c: ClientMini, sous: string) => (
    <button key={c.id} type="button" className={b.quiL} disabled={occupe} onClick={() => { void choisir(c); }}>
      <AvatarContact c={personneDe(nomClient(c) || societeDe(c))} teinte={{ bg: '', fg: '#f4bc92' }} className={`${b.avatar} ${b.avatarPetit}`} libre />
      <div><b>{[societeDe(c), nomClient(c)].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ')}</b><small>{sous}</small></div>
      <Ic n="droite" t={15} e={2.4} />
    </button>
  );

  return (
    <Fenetre sur="Préparer une offre" titre="Pour quel demandeur ?" occupe={occupe} onFermer={onFermer}
      sous="L’offre se remplit avec lui et ce local. Signée, elle se range dans son historique, dans ses documents, et dans les offres de l’affaire."
      pied={nouveau ? <>
        <button type="button" className={s.btn} disabled={occupe} onClick={() => { setNouveau(null); setDoublons([]); setErreur(''); }}>Retour</button>
        <button type="button" className={`${s.btn} ${s.btnNavy}`} disabled={occupe} onClick={() => { void creer(doublons.length > 0); }}>
          <Ic n="check" t={14} e={2.4} />{occupe ? 'Préparation…' : doublons.length ? 'Créer sa fiche quand même' : 'Créer sa fiche et préparer l’offre'}
        </button>
      </> : <>
        <button type="button" className={s.btnLien} disabled={occupe} onClick={() => { setOccupe(true); void onChoisi({ clientId: null, rechercheId: null, bienId: null, client: null }).catch(e => { setErreur((e as Error).message); setOccupe(false); }); }}>
          Sans fiche : je l’écrirai dans l’offre
        </button>
        <button type="button" className={s.btn} disabled={occupe} onClick={onFermer}>Annuler</button>
      </>}>
      {nouveau ? (
        <>
          <ChG lib="Civilité">
            <Pills options={[{ v: 'Monsieur' as const, l: 'Monsieur' }, { v: 'Madame' as const, l: 'Madame' }]} v={nouveau.civilite} onChange={v => setNouveau({ ...nouveau, civilite: v })} />
          </ChG>
          <div className={b.g2}>
            {champ('prenom', 'Prénom', { auto: true })}
            {champ('nom', 'Nom')}
            {champ('telephone', 'Téléphone', { mode: 'tel' })}
            {champ('email', 'E-mail', { mode: 'email' })}
            {champ('societe', 'Sa société (s’il fait l’offre pour elle)', { large: true })}
          </div>
          <div className={s.chAide}>{'Sa fiche se crée dans tes contacts, en demandeur « non filtré ». L’offre s’ouvre ensuite, remplie avec lui ; le reste se complète dans l’éditeur.'}</div>
          {doublons.length > 0 && (
            <div className={`${b.ventile} ${b.ventileManque}`}>
              <Ic n="info" t={15} />
              <span>
                <b>{doublons.length > 1 ? 'Ces contacts existent peut-être déjà :' : 'Ce contact existe peut-être déjà :'}</b>
                {doublons.map(c => (
                  <span key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span>{[societeDe(c), nomClient(c), c.telephones?.[0], c.emails?.[0]].filter(Boolean).join(' · ')}</span>
                    <button type="button" className={b.lien} disabled={occupe} onClick={() => { void choisir(c); }}>Utiliser cette fiche</button>
                  </span>
                ))}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          {proches.length > 0 && !t && (
            <>
              <div className={s.chAide}>{'Ses demandeurs sur cette affaire :'}</div>
              <div className={b.qui}>{proches.map(({ c, sous }) => ligne(c, sous))}</div>
            </>
          )}
          <input className={s.cherche} value={q} autoFocus={!proches.length} onChange={e => setQ(e.target.value)} disabled={occupe}
            placeholder={clients === null ? 'Chargement des contacts…' : 'Un nom, une société, un e-mail, un téléphone…'} aria-label="Chercher dans les contacts" />
          {trouves.length > 0 && <div className={b.qui}>{trouves.map(c => ligne(c, [c.telephones?.[0], c.emails?.[0]].filter(Boolean).join(' · ') || 'Fiche du CRM'))}</div>}
          {t.length >= 2 && clients && !trouves.length && <div className={b.vide}>{`Personne ne correspond à « ${q.trim()} » : crée sa fiche juste dessous.`}</div>}
          <button type="button" className={b.notaireAjout} disabled={occupe} onClick={() => {
            const mots = q.trim().split(/\s+/).filter(Boolean);
            setNouveau({ ...VIDE, prenom: mots.length > 1 ? mots[0] : '', nom: mots.length > 1 ? mots.slice(1).join(' ') : mots[0] || '' });
            setErreur('');
          }}><Ic n="plus" t={13} e={2.6} />Un nouveau contact</button>
        </>
      )}
      <Erreur t={erreur} />
    </Fenetre>
  );
}

