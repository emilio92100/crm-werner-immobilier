'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EN_COURS, etapeDe, titreBien, villeAffichee, type BienVente } from '@/lib/biens-vente';
import { estLocation, montantAffaire } from '@/lib/affaires';
import { Ic } from '@/components/documents/ApercuActe';
import { Erreur, Fenetre, sansAccent } from './FenetresBien';
import FenReconnaissance from './FenReconnaissance';
import { documentsDuBien, nomClient, type DocLie } from './outils';
import type { ResultatReconnaissance } from './reconnaissance';
import s from '@/components/documents/Documents.module.css';
import b from './Biens.module.css';

/* ═══ La reconnaissance d'information depuis la fiche d'un contact ═══════
   Alexandre (23 octobre 2026) : « il demande pour quelle affaire ; il note
   soit l'adresse, soit le prix ; il faut que rien soit listé. Quand il y a
   marqué pour quelle affaire, il met soit le prix, soit l'adresse, et comme
   ça, il peut cocher ». Puis la même fenêtre que depuis l'affaire, le contact
   déjà choisi. Seules les affaires en cours (disponibles, sous offre, en
   signature) sont cherchées : c'est leur adresse qu'on protège. */

type Etape = 'affaire' | 'reco' | 'fait';

/* « 3 500 » ou « 3.500 » → « 3500 » : un montant se tape comme on veut. */
const chiffresCousus = (t: string) => t.replace(/(\d)[\s  .](?=\d{3}(?!\d))/g, '$1');
const adresseDe = (x: BienVente) => x.adresse || (typeof x.donnees?.adresse === 'string' ? x.donnees.adresse : '');
const prixDe = (x: BienVente) => {
  const v = x.donnees?.prix;
  const n = typeof v === 'number' ? v : Number(v) || 0;
  return n || x.prix || 0;
};

/* Tout ce qui permet de la retrouver : adresse, ville, quartier, code postal,
   référence, titre, et ses montants (à l'année et au mois pour un loyer). */
function botte(x: BienVente): string {
  const d = x.donnees || {};
  const p = prixDe(x);
  const montants = p ? [Math.round(p), ...(estLocation(d) ? [Math.round(p / 12)] : [])].map(String) : [];
  return sansAccent([
    adresseDe(x), x.ville, x.code_postal, x.quartier, typeof d.quartier === 'string' ? d.quartier : '',
    x.reference, x.titre, titreBien(d), ...montants,
  ].filter(Boolean).join(' '));
}

export default function NouvelleReconnaissance({ clientId, prenom, onFermer, onNavigate, onFait }: {
  /* Venu de sa fiche : le contact est choisi d'avance. Sans lui (Documents),
     il se choisit dans la fenêtre. */
  clientId?: string | null;
  prenom?: string | null;
  onFermer: () => void;
  onNavigate: (page: string, data?: unknown) => void;
  /* Une reconnaissance est partie : relire ce qui en dépend (ses documents…). */
  onFait?: () => void;
}) {
  const [etape, setEtape] = useState<Etape>('affaire');
  const [affaires, setAffaires] = useState<BienVente[] | null>(null);
  const [q, setQ] = useState('');
  const [choisie, setChoisie] = useState<BienVente | null>(null);
  const [deja, setDeja] = useState<DocLie[]>([]);
  const [resultat, setResultat] = useState<ResultatReconnaissance | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let vivant = true;
    supabase.from('biens_vente').select('*').in('etape', EN_COURS).eq('archive', false).order('updated_at', { ascending: false }).limit(1000)
      .then(({ data, error }) => {
        if (!vivant) return;
        if (error) { setAffaires([]); setErreur(`Les affaires n’ont pas pu être lues : ${error.message}`); return; }
        setAffaires((data || []) as BienVente[]);
      });
    return () => { vivant = false; };
  }, []);

  const mots = sansAccent(chiffresCousus(q.trim())).split(/\s+/).filter(Boolean);
  const cherche = q.trim().length >= 2;
  const index = useMemo(() => (affaires || []).map(x => ({ x, h: botte(x) })), [affaires]);
  const trouvees = cherche ? index.filter(({ h }) => mots.every(m => h.includes(m))).map(({ x }) => x).slice(0, 8) : [];
  /* L'affaire cochée reste en tête, même si la recherche change. */
  const affichees = choisie && !trouvees.some(x => x.id === choisie.id) ? [choisie, ...trouvees] : trouvees;

  /* Ce que le CRM a déjà pour lui sur cette affaire (pour ne pas la refaire). */
  function continuer() {
    if (!choisie) return;
    setDeja([]);
    setEtape('reco');
    const id = choisie.id;
    documentsDuBien(choisie)
      .then(l => setDeja(l.filter(d => d.modele === 'reconnaissance' && d.statut !== 'annule' && choisie?.id === id)))
      .catch(() => { /* sans cette liste, la fenêtre marche : seul l'avertissement « déjà signée » manquerait */ });
  }

  if (etape === 'reco' && choisie) {
    return (
      <FenReconnaissance bien={choisie} pour={clientId || undefined} deja={deja}
        onRetour={() => setEtape('affaire')}
        onFermer={onFermer}
        onVoir={id => { onFermer(); onNavigate('documents', { ouvrir: id }); }}
        onCompleterAdresse={() => { onFermer(); onNavigate('biens', { bien: choisie.id }); }}
        onFait={r => {
          onFait?.();
          if (r.etat === 'envoye') { setResultat(r); setEtape('fait'); return; }
          onFermer();
          onNavigate('documents', { ouvrir: r.id });
        }} />
    );
  }

  if (etape === 'fait' && resultat && choisie) {
    const qui = nomClient(resultat.client) !== 'Client' ? nomClient(resultat.client) : (prenom || 'Le demandeur');
    return (
      <Fenetre sur="Reconnaissance d’information" titre="C’est parti" onFermer={onFermer}
        pied={<>
          <button type="button" className={s.btn} onClick={() => { onFermer(); onNavigate('biens', { bien: choisie.id }); }}><Ic n="agence" t={14} />Voir l’affaire</button>
          <button type="button" className={`${s.btn} ${s.btnNavy}`} onClick={onFermer}>Fermer</button>
        </>}>
        <div className={b.recoFait}>
          <span className={b.recoFaitRond}><Ic n="check" t={26} e={2.6} /></span>
          <h4>{`Reconnaissance envoyée à ${qui}`}</h4>
          <p>{'Il la signe sur son téléphone, avec un code reçu par e-mail. Tu recevras le document signé par e-mail ; il se range dans Documents, sur l’affaire et sur sa fiche.'}</p>
        </div>
        {resultat.avertissements.length > 0 && (
          <div className={`${b.ventile} ${b.ventileManque}`}><Ic n="info" t={15} /><span>{resultat.avertissements.join(' ')}</span></div>
        )}
      </Fenetre>
    );
  }

  return (
    <Fenetre sur="Avant de donner l’adresse" titre="Reconnaissance d’information"
      sous={`Pour quelle affaire${prenom ? `, pour ${prenom}` : ''} ? Tape son adresse, sa ville, sa référence ou son montant, coche la bonne, puis continue.`}
      onFermer={onFermer}
      pied={<>
        <button type="button" className={s.btn} onClick={onFermer}>Annuler</button>
        <button type="button" className={`${s.btn} ${s.btnNavy}`} disabled={!choisie} onClick={continuer}>Continuer<Ic n="droite" t={14} e={2.4} /></button>
      </>}>
      <input className={s.cherche} value={q} autoFocus autoComplete="off" aria-label="Chercher une affaire"
        placeholder={affaires === null ? 'Chargement des affaires…' : 'Adresse, ville, référence ou montant…'}
        onChange={e => setQ(e.target.value)} />

      {!cherche && !choisie && (
        <div className={b.vide}>{affaires === null
          ? 'Chargement de tes affaires en cours…'
          : affaires.length
            ? `Rien n’est listé tant que tu n’as rien tapé : ${affaires.length} affaire${affaires.length > 1 ? 's' : ''} en cours à chercher (disponibles, sous offre, en signature).`
            : 'Aucune affaire en cours pour l’instant : la reconnaissance se fait sur une affaire disponible, sous offre ou en signature.'}</div>
      )}

      {cherche && affaires && !trouvees.length && !erreur && (
        <div className={b.vide}>{`Aucune affaire en cours ne correspond à « ${q.trim()} ». Essaie le nom de la rue, la ville, ou le montant sans les centimes.`}</div>
      )}

      {affichees.length > 0 && (
        <div className={b.recoListe} role="radiogroup" aria-label="Les affaires trouvées">
          {affichees.map(x => {
            const d = x.donnees || {};
            const on = choisie?.id === x.id;
            const lieu = [adresseDe(x), villeAffichee(x.ville, x.code_postal)].filter(Boolean).join(', ');
            const montant = montantAffaire(prixDe(x), d);
            return (
              <button key={x.id} type="button" role="radio" aria-checked={on} className={`${b.recoAff} ${on ? b.recoAffOn : ''}`}
                onClick={() => setChoisie(on ? null : x)}>
                {x.photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={x.photo} alt="" />
                  : <span className={b.recoAffIc}><Ic n="agence" t={18} /></span>}
                <span className={b.recoAffTx}>
                  <b>{x.titre || titreBien(d)}</b>
                  <small>{lieu || 'Adresse à compléter'}</small>
                  <small><span className={b.recoEtape}>{etapeDe(x.etape).court}</span>{montant ? <em>{montant}</em> : null}{x.reference ? <span style={{ whiteSpace: 'nowrap' }}>{`${montant ? ' · ' : ''}réf. ${x.reference}`}</span> : null}</small>
                </span>
                <span className={b.recoCoche} aria-hidden="true"><Ic n="check" t={13} e={3} /></span>
              </button>
            );
          })}
        </div>
      )}
      {choisie && <div className={s.chAide}>{'Puis : ses coordonnées (reprises de sa fiche, à compléter si besoin), comment il signe, et ce que devient l’adresse une fois signé.'}</div>}
      <Erreur t={erreur} />
    </Fenetre>
  );
}
