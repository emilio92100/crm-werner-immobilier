'use client';
/* ═══ Le rapprochement, depuis la fiche d'un acheteur (V3.29) ═══════════
   Trois temps, dans une seule fenêtre :
   1. où chercher (mes mandats, les veilles des autres clients, les deux ;
      pour les veilles, depuis quand) ;
   2. ça cherche (une petite animation, le temps de comparer) ;
   3. les biens trouvés, à 50 % et plus, avec leur note. Un aperçu simple
      pour chacun ; on coche, puis « Mettre en sélection » ou « Envoyer par
      mail » (le mail d'envoi habituel de la fiche, rien de nouveau).
   Le calcul est dans src/lib/rapprochement.ts.

   V3.112 (Alexandre : « la vue acheteur, je n'arrive pas à comprendre… dès
   que j'arrive dans Rapprochement, qu'on comprenne bien avec une petite
   explication ») :
   · l'onglet montre GuideRapprochement (en bas de ce fichier) : ce que fait
     le rapprochement, les trois temps, « Où chercher ? » (deux cases à
     cocher, mandats et veilles, avec leur nombre), le dernier rapprochement,
     « Seulement les nouveautés » ou « Tout revoir », puis « Lancer » — la
     fenêtre s'ouvre directement sur la recherche ;
   · « Seulement les nouveautés » : les biens déjà montrés par un rapprochement
     précédent (`vus`, notés au Suivi) sont repliés à part, « Déjà vus » ;
   · le pied dit ce que fait chaque bouton : « Le mettre dans sa sélection »
     (rien ne part), « Le mettre dans son espace » (V3.116 : présenté sans
     mail) ou « Le lui envoyer par mail » (il passe dans Présentés).

   V3.125 (Alexandre : « le même procédé… depuis la fiche d'un acheteur dans
   rapprochement ») : « Lancer » fait le premier tri PUIS la relecture de ses
   biens en vente (RapprochementIA.tsx), les étapes à l'écran ; les résultats
   n'arrivent qu'ensuite. Tes biens en vente sont rangés par avis — Oui, À
   voir, puis Non replié — avec leur note de potentiel, leurs plus et leurs
   moins ; les annonces des veilles (déjà lues par la veille) suivent, à
   part, avec leur note de critères. Rien n'est coché d'office : « Cocher
   les oui ». */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './ParcoursBien';
import {
  compterSources, rapprocher, poserEnSelection, presenterDansEspace, noterRapprochement, PERIODES,
  type EtatDossier, type LigneRappro, type SourceRappro, type PeriodeVeille, type Trouve, type VuDepuisBien,
} from '@/lib/rapprochement';
import AideRapprochement, { BoutonAideRappro } from '@/components/shared/AideRapprochement';
import { modeAcheteurs } from '@/components/biens/AcheteursBien';
import { etapeDe, lirePhotos, titreBien } from '@/lib/biens-vente';
import { SEUIL_CORRESPOND, suiteEnvoi } from '@/components/biens/outils';
import { supabase } from '@/lib/supabase';
import { AvisDetail, IconeAvis, MOT_IA, Progression, analyserIA, compareIA, dateRappro, type AvisIA, type AvisParBien } from '@/components/biens/RapprochementIA';
import s from './Rapprochement.module.css';
import Curseur from '@/components/shared/Curseur';
import Cascade from '@/components/shared/Cascade';
import Aide from '@/components/shared/Aide';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ligne = Record<string, any>;

const EUR = (n: number | null | undefined) => (n ? `${n.toLocaleString('fr-FR')} €` : '');
const C = 113.1; // périmètre du cercle de la note (r = 18)

/* Ce qui ne colle pas, en une ligne ; sinon « Tout correspond ». */
function ecart(t: Trouve): { texte: string; ok: boolean } {
  const l = t.corr.lignes.find(x => x.etat === 'non') || t.corr.lignes.find(x => x.etat === 'presque');
  if (!l) return { texte: `Tout correspond : ${t.corr.lignes.slice(0, 4).map(x => x.lib.toLowerCase()).join(', ')}`, ok: true };
  return { texte: `${l.lib} : ${l.valeur}, demandé ${l.demande}`, ok: false };
}
/* « 92 m² » ne se coupe pas en fin de ligne (V3.228). */
const insec = (x: string) => x.replace(/(\d) (m²|pièces?|ch\.)/g, '$1\u00a0$2');
const ancien = (t: Trouve) => !!t.le && Date.now() - new Date(t.le).getTime() > 60 * 86400000;
const jourCourt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '');

function Note({ n }: { n: number }) {
  const coul = n >= 85 ? '#16a34a' : n >= SEUIL_CORRESPOND ? '#f08c42' : '#94a3b8';
  return (
    <svg className={s.note} width="48" height="48" viewBox="0 0 48 48" role="img" aria-label={`${n} pour cent`}>
      <circle cx="24" cy="24" r="18" fill="none" stroke="#f2f2f2" strokeWidth="4.5" />
      <circle cx="24" cy="24" r="18" fill="none" stroke={coul} strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={`${(C * n / 100).toFixed(1)} ${C}`} transform="rotate(-90 24 24)" />
      <text x="24" y="28.5" textAnchor="middle" fill="#25272b" style={{ font: "800 12.5px 'Plus Jakarta Sans', sans-serif" }}>{n}</text>
    </svg>
  );
}

function Photo({ src, grande }: { src?: string | null; grande?: boolean }) {
  const [ko, setKo] = useState(false);
  return (
    <span className={grande ? s.photoG : s.photo}>
      {src && !ko
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" onError={() => setKo(true)} />
        : <Icone nom="maison" taille={grande ? 34 : 22} epaisseur={1.8} />}
    </span>
  );
}

/* V3.228 — La photo de l'affaire, sa note posée juste dessous (comme l'avatar
   d'un acheteur, côté bien) et ce qu'elle mesure : son potentiel quand le
   bien a été relu, sinon la part de ses critères. */
function PhotoNote({ photo, n, v, legende }: { photo?: string | null; n: number | null; v: AvisIA['v'] | null; legende: 'potentiel' | 'critères' }) {
  const x = n === null ? null : Math.max(0, Math.min(100, Math.round(n)));
  return (
    <span className={s.pn} data-v={v || 'aucun'} title={x === null ? undefined : `${legende === 'potentiel' ? 'Potentiel' : 'Ses critères'} : ${x} sur 100`}>
      <Photo src={photo} />
      {x !== null && <span className={s.pnNote}><b>{x}</b><small>{'/100'}</small></span>}
      {x !== null && <small className={s.pnLeg}>{legende}</small>}
    </span>
  );
}

/* Un bien pas relu (une annonce de veille) : ce qui ne colle pas, ou « tout correspond ». */
function Ecart({ t }: { t: Trouve }) {
  const e = ecart(t);
  return <span className={e.ok ? s.ecOk : s.ecKo}><Icone nom={e.ok ? 'coche' : 'alerte'} taille={14} epaisseur={2.4} /><span>{e.texte}</span></span>;
}

function Source({ t }: { t: Trouve }) {
  if (t.avant) return <span className={`${s.src} ${s.srcEstim}`} title="Pas encore proposée : elle partira sans montant"><Icone nom="etiquette" taille={12} epaisseur={2.2} />Ton estimation</span>;
  return t.source === 'mandat'
    ? <span className={`${s.src} ${s.srcMandat}`}><Icone nom="etiquette" taille={12} epaisseur={2.2} />Ton affaire</span>
    : <span className={`${s.src} ${s.srcVeille}`} title={t.pour ? `Trouvé par la veille de ${t.pour}` : undefined}>
      <Icone nom="loupe" taille={12} epaisseur={2.2} />{`Veille${t.pour ? ` · ${t.pour.split(' ')[0]}` : ''}${t.le ? ` · ${jourCourt(t.le)}` : ''}`}
    </span>;
}

export type DepartRappro = { source: SourceRappro; cocher?: string[]; periode?: PeriodeVeille; nouveautes?: boolean; estimations?: boolean; ventes?: boolean };

/* V3.228 (repris du CRM d'Emilio) : une affaire déjà dans son dossier, et ce qui en a été fait. */
const REPONSE: Record<string, string> = {
  interesse: 'intéressé', souhaite_visiter: 'souhaite visiter', visite: 'visité', offre_faite: 'offre faite', refuse: 'il a dit non',
};
export function etatDossier(d?: EtatDossier | null): string {
  if (!d) return '';
  if (d.etape !== 'presente') return 'Dans sa sélection';
  const quand = d.envoye_le ? ` le ${new Date(d.envoye_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : '';
  return `Présentée${quand}${d.badge && REPONSE[d.badge] ? ` · ${REPONSE[d.badge]}` : ' · pas encore de réponse'}`;
}

/* V3.128 — « Fiche du bien », puis retour sur la fiche du client : le
   rapprochement reprend là où il était (Alexandre : « quand je reviens sur la
   fiche, il fallait que je refasse le tout »). La fiche du client se remonte
   à chaque retour ; ce qui a été trouvé, relu et coché est gardé ici, dans la
   mémoire de la page, le temps d'y revenir. Rien en base : la ligne du Suivi
   garde déjà ce qui a été proposé. */
type Garde = {
  le: number; depart: DepartRappro | null; source: SourceRappro; periode: PeriodeVeille; estim?: boolean; ventes?: boolean;
  res: { trouves: Trouve[]; compares: number; dejaLa: number; deja?: Trouve[] }; choisis: string[]; filtre: 'tout' | 'mandat' | 'veille';
  ia: AvisParBien; iaEtat: { fait: number; total: number; erreur: string; info: string; manquent: number; trouves: number; mandats: number };
  voirNon: boolean; voirAnciens: boolean; pasPour: number; apercu: string | null; vus?: string[]; dernierLe?: string | null; voirDeja?: boolean;
};
const gardes = new Map<string, Garde>();
const GARDE_MS = 30 * 60_000; // comme la place de la fiche (src/lib/place-fiche.ts)
function garde(rechercheId: string): Garde | null {
  const g = gardes.get(rechercheId);
  if (g && Date.now() - g.le > GARDE_MS) { gardes.delete(rechercheId); return null; }
  return g || null;
}
/* Un rapprochement attend-il cette recherche ? La fiche du client le rouvre. */
export const rapproAReprendre = (rechercheId: string) => !!garde(String(rechercheId));
export const oublierRappro = (rechercheId: string) => { gardes.delete(String(rechercheId)); };
const jourLong = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '');
const pl = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

export default function Rapprochement({ client, recherche, resume, onFermer, onFini, onFicheBien, depart, vus: vusRecus, dernierLe: dernierRecu }: {
  client: Ligne; recherche: Ligne; resume: string;
  onFermer: () => void;
  /* Les biens sont posés dans son dossier : la fiche recharge, puis ouvre la
     Sélection ou le mail d'envoi habituel sur ces biens-là. */
  onFini: (quoi: 'selection' | 'espace' | 'mail', ids: string[]) => void;
  onFicheBien?: (bienVenteId: string) => void;
  /* Ouvert depuis une alerte (« un acheteur arrive ») : la recherche part
     tout de suite, sur cette source, et ces mandats sont déjà cochés. */
  depart?: DepartRappro | null;
  /* V3.112 : les biens déjà montrés par les rapprochements précédents, et le jour du dernier. */
  vus?: string[]; dernierLe?: string | null;
}) {
  const prenom = client.prenom || 'ce client';
  /* Revenu de « Fiche du bien » (V3.128) : tout reprend où c'était. */
  const [g0] = useState(() => garde(String(recherche.id)));
  const dep = depart ?? g0?.depart ?? null;
  /* Ce qui était « déjà vu » avant CE rapprochement : au retour, la fiche le
     compterait comme vu (il vient d'être noté au Suivi). */
  const vus = g0 ? g0.vus : vusRecus;
  const dernierLe = g0 ? g0.dernierLe : dernierRecu;
  const [etape, setEtape] = useState<'choix' | 'cherche' | 'resultats'>(g0 ? 'resultats' : 'choix');
  const [source, setSource] = useState<SourceRappro>(g0?.source || dep?.source || 'deux');
  const [periode, setPeriode] = useState<PeriodeVeille>(g0?.periode ?? dep?.periode ?? 90);
  /* V3.228 : ses estimations (sur demande) et ses affaires en cours. */
  const [estim, setEstim] = useState<boolean>(g0?.estim ?? !!dep?.estimations);
  const [ventes, setVentes] = useState<boolean>(g0?.ventes ?? dep?.ventes !== false);
  const [voirDeja, setVoirDeja] = useState<boolean>(g0?.voirDeja ?? false);
  const nouveautes = !!dep?.nouveautes && !!vus?.length;
  const vusSet = useMemo(() => new Set(vus || []), [vus]);
  const [voirAnciens, setVoirAnciens] = useState(g0?.voirAnciens ?? false);
  const [comptes, setComptes] = useState<{ mandats: number; estimations?: number; veilles: Record<number, number> } | null>(null);
  const [res, setRes] = useState<{ trouves: Trouve[]; compares: number; dejaLa: number; deja?: Trouve[] } | null>(g0?.res ?? null);
  const [erreur, setErreur] = useState('');
  const [choisis, setChoisis] = useState<Set<string>>(() => new Set(g0?.choisis || []));
  const [filtre, setFiltre] = useState<'tout' | 'mandat' | 'veille'>(g0?.filtre ?? 'tout');
  const [apercu, setApercu] = useState<Trouve | null>(() => (g0?.apercu ? g0.res.trouves.find(x => x.cle === g0.apercu) || null : null));
  const [pose, setPose] = useState<'' | 'selection' | 'espace' | 'mail'>('');
  /* V3.123 → V3.125 — La relecture de ses mandats (les biens des veilles ont
     déjà été lus par la veille), pendant la recherche : les résultats
     n'arrivent qu'une fois relus. */
  const [ia, setIa] = useState<AvisParBien>(g0?.ia ?? {});
  const [phase, setPhase] = useState<'tri' | 'relit' | 'fin'>(g0 ? 'fin' : 'tri');
  const [iaEtat, setIaEtat] = useState<{ fait: number; total: number; erreur: string; info: string; manquent: number; trouves: number; mandats: number }>(g0?.iaEtat ?? { fait: 0, total: 0, erreur: '', info: '', manquent: 0, trouves: 0, mandats: 0 });
  const [voirNon, setVoirNon] = useState(g0?.voirNon ?? false);
  const [pasPour, setPasPour] = useState(g0?.pasPour ?? 0);
  /* La reprise ne sert qu'une fois : fermer la fenêtre l'oublie. */
  useEffect(() => { oublierRappro(String(recherche.id)); }, [recherche.id]);
  /* « Fiche du bien » : on garde tout, puis on y va. */
  const versFiche = (bienId: string) => {
    if (res) gardes.set(String(recherche.id), {
      le: Date.now(), depart: dep, source, periode, estim, ventes, res, choisis: [...choisis], filtre, ia, iaEtat, voirNon, voirAnciens, pasPour, apercu: apercu?.cle || null, vus, dernierLe, voirDeja,
    });
    onFicheBien?.(bienId);
  };
  const avisDe = (t: Trouve) => (t.vente ? ia[t.vente.id]?.[String(recherche.id)] || null : null);
  const [aide, setAide] = useState(false);

  useEffect(() => {
    let vivant = true;
    compterSources(recherche.id, client.id).then(c => { if (vivant) setComptes(c); }).catch(() => { if (vivant) setComptes({ mandats: 0, veilles: {} }); });
    return () => { vivant = false; };
  }, [recherche.id, client.id]);

  /* Échap ferme l'aperçu, puis la fenêtre. */
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (apercu) setApercu(null); else if (!pose) onFermer(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [apercu, pose, onFermer]);

  /* Depuis une alerte : on cherche tout de suite, une seule fois (pas au
     retour d'une fiche de bien : les résultats sont déjà là). */
  const parti = useRef(!!g0);
  useEffect(() => {
    if (!depart || parti.current) return;
    parti.current = true;
    void lancer(depart.source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depart]);

  const nbVeilles = comptes?.veilles[periode] ?? null;
  const nbBiens = comptes ? (ventes ? comptes.mandats : 0) + (estim ? comptes.estimations || 0 : 0) : 0;
  const aComparer = comptes ? (source === 'mandats' ? nbBiens : source === 'veilles' ? (nbVeilles || 0) : nbBiens + (nbVeilles || 0)) : null;

  async function lancer(src: SourceRappro = source) {
    setErreur(''); setEtape('cherche'); setChoisis(new Set()); setFiltre('tout'); setPhase('tri'); setIa({}); setVoirNon(false);
    setIaEtat({ fait: 0, total: 0, erreur: '', info: '', manquent: 0, trouves: 0, mandats: 0 });
    const debut = Date.now();
    try {
      const r0 = await rapprocher(recherche, client.id, src, periode, { ventes, estimations: estim });
      /* V3.126 : les biens où Alexandre l'a écarté (« Pas pour lui », depuis
         la fiche du bien) ne remontent pas. Une lecture qui échoue n'empêche rien. */
      const { data: pas } = await supabase.from('biens_vente_suivi').select('bien_id').eq('recherche_id', String(recherche.id)).eq('type', 'note').contains('donnees', { pasPourLui: true });
      const ecartesB = new Set(((pas || []) as { bien_id: string }[]).map(x => x.bien_id));
      const r = { ...r0, trouves: r0.trouves.filter(t => !(t.vente && ecartesB.has(t.vente.id))) };
      setPasPour(r0.trouves.length - r.trouves.length);
      /* L'animation se voit au moins un instant : un résultat instantané
         laissait croire que rien n'avait été cherché. */
      const reste = 1400 - (Date.now() - debut);
      if (reste > 0) await new Promise(ok => setTimeout(ok, reste));
      /* La relecture de ses mandats parmi les nouveaux résultats, 24 au plus. */
      const neufs = r.trouves.filter(t => !nouveautes || !vusSet.has(t.cle));
      const paires = neufs.filter(t => t.vente).slice(0, 24).map(t => ({ b: t.vente!.id, r: String(recherche.id) }));
      setIaEtat(e => ({ ...e, total: paires.length, trouves: neufs.length, mandats: paires.length }));
      setPhase('relit');
      let lus: AvisParBien = {};
      if (paires.length) {
        const x = await analyserIA(paires, (avis, fait) => { lus = avis; setIa(avis); setIaEtat(e => ({ ...e, fait })); });
        setIaEtat(e => ({ ...e, erreur: x.erreur, info: x.info, manquent: x.manquent }));
      } else await new Promise(ok => setTimeout(ok, 500));
      setPhase('fin');
      await new Promise(ok => setTimeout(ok, 350));
      setRes(r);
      /* V3.125 : rien de coché d'office, sauf les mandats d'une alerte (« un acheteur arrive »). */
      const aCocher = new Set((dep?.cocher || []).map(id => `m-${id}`));
      setChoisis(new Set(r.trouves.filter(t => aCocher.has(t.cle)).map(t => t.cle)));
      setEtape('resultats');
      /* V3.126 : ce qui a été proposé, gardé avec la ligne du Suivi. */
      const lignes: LigneRappro[] = neufs.slice(0, 40).map(t => {
        const a = t.vente ? lus[t.vente.id]?.[String(recherche.id)] : undefined;
        return {
          cle: t.cle, src: t.source, titre: t.titre, lieu: t.lieu || undefined, prix: t.prix, photo: t.photo, n: t.corr.note,
          ...(t.vente ? { bien: t.vente.id } : { url: t.url }),
          ...(a ? { v: a.v, s: a.s, t: a.r, p: a.p || [], m: a.m || [] } : {}),
        };
      });
      noterRapprochement(client.id, recherche.id, r.trouves.length, src, periode, r.trouves.map(t => t.cle), lignes, { ventes, estimations: estim });
    } catch (e) {
      setErreur((e as Error).message);
      setEtape('choix');
    }
  }

  async function poser(quoi: 'selection' | 'espace' | 'mail') {
    if (!res || !choisis.size || pose) return;
    setPose(quoi);
    const ids: string[] = [], erreurs: string[] = [];
    for (const t of res.trouves.filter(x => choisis.has(x.cle))) {
      try { ids.push(await poserEnSelection(t, client.id, recherche.id)); } catch (e) { erreurs.push((e as Error).message); }
    }
    /* V3.116 : dans son espace, sans mail — présentés, une relance, sa notification. */
    if (quoi === 'espace' && ids.length) {
      const r = await presenterDansEspace(ids, String(client.id), String(recherche.id));
      erreurs.push(...r.erreurs);
      if (r.n) await suiteEnvoi(String(client.id), String(recherche.id), r.n);
    }
    setPose('');
    if (erreurs.length) alert(`${erreurs.length} affaire${erreurs.length > 1 ? 's' : ''} n’${erreurs.length > 1 ? 'ont' : 'a'} pas pu être ajoutée${erreurs.length > 1 ? 's' : ''} :\n\n${erreurs.join('\n')}`);
    if (ids.length) onFini(quoi, ids);
  }

  const basculer = (cle: string) => setChoisis(c => { const n = new Set(c); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  /* « Seulement les nouveautés » : ce qui a déjà été montré est replié à part. */
  const nouveaux = useMemo(() => (res?.trouves || []).filter(t => !nouveautes || !vusSet.has(t.cle)), [res, nouveautes, vusSet]);
  const anciens = useMemo(() => (nouveautes ? (res?.trouves || []).filter(t => vusSet.has(t.cle)) : []), [res, nouveautes, vusSet]);
  const liste = useMemo(() => nouveaux.filter(t => filtre === 'tout' || t.source === filtre), [nouveaux, filtre]);
  /* V3.125 : ses mandats relus, rangés par avis (puis la note de potentiel) ;
     ceux qui n'ont pas pu l'être vont avec « À voir ». Les veilles à part. */
  const relus = liste.filter(t => t.source === 'mandat').map((t, k) => ({ t, k, a: avisDe(t) })).sort((p, q) => compareIA(p.a, q.a) || p.k - q.k);
  const groupeDe = (a: AvisIA | null): AvisIA['v'] => (a ? a.v : 'a_voir');
  const veillesL = liste.filter(t => t.source !== 'mandat');
  const ouiPossibles = relus.filter(y => groupeDe(y.a) === 'oui').map(y => y.t.cle);
  const tousOui = ouiPossibles.length > 0 && ouiPossibles.every(k => choisis.has(k));
  const nbM = nouveaux.filter(t => t.source === 'mandat').length;
  const nbV = nouveaux.filter(t => t.source === 'veille').length;

  /* V3.228 — Une affaire trouvée : une carte d'un bord à l'autre (Alexandre : « que
     ça prenne l'entièreté de l'écran, en mode rectangle »). En haut, la photo
     et sa note, le titre, le lieu, le prix ; à droite, le choix et l'œil ; et
     l'avis du rapprochement à côté (ordinateur) ou dessous, sur toute la
     largeur (téléphone). */
  const enTete = (t: Trouve, v: AvisIA['v'] | null, n: number, legende: 'potentiel' | 'critères') => (
    <button type="button" className={s.bcBien} onClick={() => setApercu(t)} title="Voir cette affaire">
      <PhotoNote photo={t.photo} n={n} v={v} legende={legende} />
      <span className={s.bcTx}>
        <b className={s.bcTitre}>{insec(t.titre)}</b>
        {t.lieu && <span className={s.bcLieu}><Icone nom="lieu" taille={13} epaisseur={2.2} /><span>{t.lieu}</span></span>}
        <span className={s.bcPrix}><b>{EUR(t.prix) || 'Montant non indiqué'}</b><Source t={t} /></span>
      </span>
    </button>
  );
  const oeil = (t: Trouve) => (
    <button type="button" className={s.oeil} aria-label="Voir cette affaire" title="Voir cette affaire" onClick={() => setApercu(t)}>
      <Icone nom="oeil" taille={17} epaisseur={2} />
    </button>
  );

  const ligne = (t: Trouve, i: number) => {
    const on = choisis.has(t.cle);
    const av = avisDe(t);
    const note = av && typeof av.s === 'number' ? av.s : null;
    return (
      <article key={t.cle} className={`${s.bc} ${on ? s.bcOn : ''}`} data-v={av?.v || 'aucun'} style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
        {enTete(t, note !== null ? av!.v : null, note ?? t.corr.note, note !== null ? 'potentiel' : 'critères')}
        <div className={s.bcAct}>
          <button type="button" className={`${s.coche} ${on ? s.cocheOn : ''}`} aria-pressed={on} aria-label={on ? 'Retirer cette affaire du choix' : 'Choisir cette affaire'} title={on ? 'Retirer cette affaire du choix' : 'Choisir cette affaire'} onClick={() => basculer(t.cle)}>
            <Icone nom="coche" taille={15} epaisseur={3.2} />
          </button>
          {oeil(t)}
        </div>
        <div className={s.bcAvis}>
          {av ? <AvisDetail avis={av} sansMot deuxCol /> : <Ecart t={t} />}
          {ancien(t) && <span className={s.vieux}><Icone nom="horloge" taille={13} epaisseur={2.2} /><span>{'À vérifier : annonce ancienne'}</span></span>}
        </div>
      </article>
    );
  };

  /* V3.228 : une affaire déjà dans son dossier — rien à cocher, ce qui en a été fait. */
  const ligneDeja = (t: Trouve, i: number) => (
    <article key={`d-${t.cle}`} className={`${s.bc} ${s.bcDeja}`} data-v="aucun" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
      {enTete(t, null, t.corr.note, 'critères')}
      <div className={s.bcAct}>
        <span className={s.dejaIc} title="Déjà dans son dossier"><Icone nom="dossier" taille={14} epaisseur={2.2} /></span>
        {oeil(t)}
      </div>
      <div className={s.bcAvis}>
        <span className={s.dejaEtat}><Icone nom="coche" taille={14} epaisseur={2.8} /><span>{etatDossier(t.dossier)}</span></span>
      </div>
    </article>
  );

  const fenetre = (
    <div className={s.voile} onMouseDown={e => { if (e.target === e.currentTarget && !pose) onFermer(); }}>
      <div className={`${s.fenetre} ${etape === 'resultats' ? s.fenetreLarge : ''}`} role="dialog" aria-modal="true" aria-label={`Rapprochement pour ${prenom}`}>
        <div className={s.tete}>
          <span className={s.teteIc}><Icone nom="etoile" taille={21} epaisseur={2} /></span>
          <div className={s.teteTx}>
            {etape === 'resultats' && res ? (
              <>
                <h2>{nouveautes
                  ? (nouveaux.length ? `${nouveaux.length} ${pl(nouveaux.length, 'nouvelle affaire', 'nouvelles affaires')} pour ${prenom}` : `Rien de nouveau pour ${prenom}`)
                  : (res.trouves.length ? `${res.trouves.length} affaire${res.trouves.length > 1 ? 's' : ''} pour ${prenom}` : `Rien pour ${prenom} cette fois`)}</h2>
                <p>{[
                  nouveautes && dernierLe ? `depuis le ${jourLong(dernierLe)}` : '',
                  source !== 'veilles' ? `${nbM} de tes affaires` : '',
                  source !== 'mandats' ? `${nbV} bien${nbV > 1 ? 's' : ''} de tes veilles` : '',
                  anciens.length ? `${anciens.length} déjà ${pl(anciens.length, 'vu, replié', 'vus, repliés')}` : '',
                  res.dejaLa ? `${res.dejaLa} déjà dans son dossier, ${pl(res.dejaLa, 'rangée', 'rangées')} à part` : '',
                ].filter(Boolean).join(' · ')}</p>
              </>
            ) : (
              <>
                <h2>{`Faire un rapprochement pour ${prenom}`}</h2>
                <p>{resume}</p>
              </>
            )}
          </div>
          {/* V3.228 : l'explication, étape par étape, toujours à portée. */}
          <button type="button" className={s.aideTete} aria-label="Comment marche le rapprochement" title="Comment marche le rapprochement" onClick={() => setAide(true)}><Icone nom="info" taille={17} epaisseur={2.2} /></button>
          {etape === 'resultats' && <button type="button" className={`${s.btnLeger} ${s.refaire}`} aria-label="Refaire le rapprochement" title="Refaire le rapprochement" onClick={() => setEtape('choix')}><Icone nom="remettre" taille={16} epaisseur={2.2} /><span>Refaire</span></button>}
          <button type="button" className={s.fermer} aria-label="Fermer" onClick={onFermer} disabled={!!pose}><Icone nom="fermer" taille={16} epaisseur={2.2} /></button>
        </div>

        {etape === 'choix' && (
          <>
            <div className={s.corps}>
              <span className={s.sur}>Où chercher ?</span>
              <div className={s.choix3}>
                {([
                  { k: 'mandats', ic: 'etiquette', t: 'Mes affaires en cours', d: 'Les affaires que vous proposez.', n: comptes ? `${comptes.mandats} affaire${comptes.mandats > 1 ? 's' : ''}` : '…' },
                  { k: 'veilles', ic: 'loupe', t: 'Les biens de mes veilles', d: 'Ceux trouvés pour vos autres clients.', n: nbVeilles == null ? '…' : `${nbVeilles} bien${nbVeilles > 1 ? 's' : ''}` },
                  { k: 'deux', ic: 'etoile', t: 'Les deux', d: 'Vos affaires d’abord, puis les veilles.', n: aComparer == null ? '…' : `${aComparer} bien${aComparer > 1 ? 's' : ''} à comparer` },
                ] as const).map(c => (
                  <button key={c.k} type="button" className={`${s.choix} ${source === c.k ? s.choixOn : ''}`} aria-pressed={source === c.k} onClick={() => { setSource(c.k); if (c.k !== 'veilles') setVentes(true); }}>
                    {source === c.k && <span className={s.choixCoche}><Icone nom="coche" taille={13} epaisseur={3} /></span>}
                    <span className={s.choixIc}><Icone nom={c.ic} taille={20} epaisseur={2} /></span>
                    <b>{c.t}</b>
                    <span className={s.choixD}>{c.d}</span>
                    <span className={s.choixN}>{c.n}</span>
                  </button>
                ))}
              </div>
              {source !== 'veilles' && (
                <label className={`${s.estim} ${estim ? s.estimOn : ''}`}>
                  <input type="checkbox" checked={estim} onChange={e => setEstim(e.target.checked)} />
                  <span className={s.estimIc}><Icone nom="etiquette" taille={16} epaisseur={2} /></span>
                  <span className={s.estimTx}>
                    <b>{`Ajouter mes estimations${comptes ? ` · ${comptes.estimations || 0}` : ''}`}</b>
                    <small>{'Pas encore proposées (estimation, à suivre). S’il en reçoit une, il la reçoit sans montant, jusqu’à la signature du mandat.'}</small>
                  </span>
                </label>
              )}
              {source !== 'mandats' && (
                <div className={s.periode}>
                  <div>
                    <b>Biens de veille trouvés depuis</b>
                    <p>Plus c’est ancien, plus le local risque d’être déjà pris : vérifiez l’annonce avant de l’envoyer.</p>
                  </div>
                  <div className={s.seg} role="group" aria-label="Période" data-defile="">
                    <Curseur cle={periode} />
                    {PERIODES.map(p => (
                      <button key={p.k} type="button" className={periode === p.k ? s.segOn : ''} aria-pressed={periode === p.k} onClick={() => setPeriode(p.k)}>{p.l}</button>
                    ))}
                  </div>
                </div>
              )}
              <p className={s.info}><Icone nom="info" taille={16} epaisseur={2} /><span>{`Seuls les biens qui respectent au moins la moitié de ses critères sont montrés. Ceux déjà dans son dossier (sélection ou présentés) sont rangés à part, avec ce qui en a été fait.`}</span></p>
              {erreur && <p className={s.erreur}>{erreur}</p>}
            </div>
            <div className={s.pied}>
              <button type="button" className={s.btn} onClick={onFermer}>Annuler</button>
              <button type="button" className={`${s.btn} ${s.btnOr}`} onClick={() => lancer()} disabled={aComparer === 0}>
                <Icone nom="etoile" taille={17} epaisseur={2.2} />Lancer le rapprochement
              </button>
            </div>
          </>
        )}

        {etape === 'cherche' && (
          <div className={s.cherche}>
            <Progression titre={`Rapprochement pour ${prenom}…`} etapes={[
              { t: 'Le premier tri', etat: phase === 'tri' ? 'en' : 'fait',
                d: phase === 'tri'
                  ? (aComparer != null ? `Je compare ${aComparer} bien${aComparer > 1 ? 's' : ''} avec les critères de ${prenom}…` : `Je compare tes biens avec les critères de ${prenom}…`)
                  : `${iaEtat.trouves} bien${iaEtat.trouves > 1 ? 's' : ''} à 50 % et plus, dont ${iaEtat.mandats} de tes affaires${estim ? '' : ' en cours'}.` },
              { t: estim ? 'La relecture de tes affaires' : 'La relecture de tes affaires en cours', etat: phase === 'tri' ? 'attente' : phase === 'relit' && iaEtat.total ? 'en' : 'fait', fait: iaEtat.fait, total: iaEtat.total,
                d: phase === 'tri' ? `Ses indispensables, son parcours, ses comptes rendus de visite, face à chaque fiche.`
                  : !iaEtat.total ? 'Rien à relire : les annonces des veilles ont déjà été lues par la veille.'
                    : phase === 'relit' ? `${Math.min(iaEtat.fait, iaEtat.total)} sur ${iaEtat.total} relu${iaEtat.total > 1 ? 's' : ''}…` : `${iaEtat.total} relu${iaEtat.total > 1 ? 's' : ''}.` },
              { t: 'Le classement', etat: phase === 'fin' ? 'en' : 'attente', d: 'Oui, à voir, non : les meilleures chances d’abord.' },
            ]} />
          </div>
        )}

        {etape === 'resultats' && res && (
          <>
            {nouveaux.length > 0 && (
              <div className={s.filtres} data-defile="">
                <button type="button" className={filtre === 'tout' ? s.puceOn : s.puce} onClick={() => setFiltre('tout')}>Tous <b>{nouveaux.length}</b></button>
                {source !== 'veilles' && <button type="button" className={filtre === 'mandat' ? s.puceOn : s.puce} onClick={() => setFiltre('mandat')}><Icone nom="etiquette" taille={13} epaisseur={2.2} />Mes affaires <b>{nbM}</b></button>}
                {source !== 'mandats' && <button type="button" className={filtre === 'veille' ? s.puceOn : s.puce} onClick={() => setFiltre('veille')}><Icone nom="loupe" taille={13} epaisseur={2.2} />Veilles <b>{nbV}</b></button>}
                {ouiPossibles.length > 0 && (
                  <button type="button" className={s.cocherOui} onClick={() => setChoisis(c => { const n = new Set(c); for (const k of ouiPossibles) { if (tousOui) n.delete(k); else n.add(k); } return n; })}>
                    <Icone nom="coche" taille={13} epaisseur={2.8} />{tousOui ? 'Décocher les oui' : `Cocher les oui (${ouiPossibles.length})`}
                  </button>
                )}
                <span className={s.filtresD}>Rien n’est coché d’office</span>
              </div>
            )}
            <div className={s.liste}>
              {iaEtat.manquent > 0 && (
                <p className={s.alerte}><Icone nom="info" taille={15} epaisseur={2} /><span>{`${iaEtat.manquent} de tes affaires n’${iaEtat.manquent > 1 ? 'ont' : 'a'} pas pu être relue${iaEtat.manquent > 1 ? 's' : ''}${iaEtat.erreur ? ` (${iaEtat.erreur})` : ''} : « Refaire » le relira.`}</span></p>
              )}
              {iaEtat.info && <p className={s.alerte}><Icone nom="info" taille={15} epaisseur={2} /><span>{iaEtat.info}</span></p>}
              {pasPour > 0 && <p className={s.info}><Icone nom="info" taille={16} epaisseur={2} /><span>{`${pasPour > 1 ? `${pasPour} de tes affaires ne remontent pas` : '1 de tes affaires ne remonte pas'} : tu as écarté ${prenom} depuis ${pasPour > 1 ? 'leur fiche' : 'sa fiche'} (« Pas pour lui »).`}</span></p>}
              {nouveaux.length === 0 && anciens.length > 0 ? (
                <div className={s.vide}>
                  <span className={s.videIc}><Icone nom="loupe" taille={26} epaisseur={2} /></span>
                  <b>{`Rien de nouveau depuis le ${jourLong(dernierLe)}.`}</b>
                  <span>{`Les ${anciens.length} ${pl(anciens.length, 'bien déjà vu est replié', 'biens déjà vus sont repliés')} juste en dessous.`}</span>
                </div>
              ) : res.trouves.length === 0 ? (
                <div className={s.vide}>
                  <span className={s.videIc}><Icone nom="loupe" taille={26} epaisseur={2} /></span>
                  <b>{`Aucun bien à 50 % et plus sur ${res.compares} comparé${res.compares > 1 ? 's' : ''}.`}</b>
                  <span>{source === 'mandats' ? 'Essayez aussi les veilles : les biens trouvés pour vos autres clients.' : 'Essayez une période plus longue, ou revenez quand de nouveaux biens seront arrivés.'}</span>
                  <button type="button" className={s.btn} onClick={() => setEtape('choix')}>Changer de recherche</button>
                </div>
              ) : (
                <>
                  {relus.length > 0 && <span className={s.sur}>{`Tes affaires${estim ? '' : ' en cours'} · relues pour ${prenom}`}</span>}
                  {(['oui', 'a_voir', 'non'] as const).map(v => {
                    const l = relus.filter(y => groupeDe(y.a) === v);
                    if (!l.length) return null;
                    const replie = v === 'non' && !voirNon;
                    const tete = (
                      <>
                        <IconeAvis v={v} t={22} />
                        <b>{MOT_IA[v]}</b>
                        <strong>{l.length}</strong>
                        <span>{v === 'oui' ? `Elles peuvent plaire à ${prenom}.` : v === 'a_voir' ? 'Un point à vérifier avec lui.' : 'Le rapprochement les écarte.'}</span>
                      </>
                    );
                    return (
                      <div key={v} className={s.groupe}>
                        {v === 'non'
                          ? <button type="button" className={`${s.groupeT} ${s.groupeBtn}`} aria-expanded={!replie} onClick={() => setVoirNon(o => !o)}>{tete}<em>{replie ? 'Voir pourquoi' : 'Replier'}</em></button>
                          : <div className={s.groupeT}>{tete}</div>}
                        {!replie && l.map((y, i) => ligne(y.t, i))}
                      </div>
                    );
                  })}
                  {veillesL.length > 0 && <span className={s.sur} style={{ marginTop: relus.length ? 12 : 0 }}>{'Les annonces de tes veilles · la note de leurs critères'}</span>}
                  {veillesL.map((t, i) => ligne(t, i))}
                </>
              )}
              {/* V3.228 : ce qui est déjà dans son dossier, avec ce qui en a été fait. */}
              {!!res.deja?.length && (
                <>
                  <button type="button" className={s.anciens} aria-expanded={voirDeja} onClick={() => setVoirDeja(v => !v)}>
                    <span className={voirDeja ? s.chevOuvert : s.chev}><Icone nom="chevron" taille={16} epaisseur={2.2} /></span>
                    <b>{`Déjà dans son dossier · ${res.deja.length}`}</b>
                    <span>{voirDeja ? 'Replier' : 'Elles correspondent toujours, mais il les a déjà : un clic pour voir ce qui en a été fait.'}</span>
                  </button>
                  {voirDeja && res.deja.map((t, i) => ligneDeja(t, i))}
                </>
              )}
              {anciens.length > 0 && (
                <>
                  <button type="button" className={s.anciens} aria-expanded={voirAnciens} onClick={() => setVoirAnciens(v => !v)}>
                    <span className={voirAnciens ? s.chevOuvert : s.chev}><Icone nom="chevron" taille={16} epaisseur={2.2} /></span>
                    <b>{`Déjà ${pl(anciens.length, 'vu', 'vus')}${dernierLe ? ` le ${jourLong(dernierLe)}` : ''}, pas ${pl(anciens.length, 'retenu', 'retenus')} · ${anciens.length}`}</b>
                    <span>{voirAnciens ? 'Replier' : 'Repliés pour ne pas te les remontrer. Un clic pour les revoir.'}</span>
                  </button>
                  {voirAnciens && anciens.map((t, i) => ligne(t, i))}
                </>
              )}
            </div>
            {res.trouves.length > 0 && (
              <div className={s.piedChoix}>
                <div className={s.piedChoixT}>
                  <span className={s.piedN}><b>{choisis.size}</b>{choisis.size > 1 ? ' affaires cochées' : ' affaire cochée'}</span>
                  <span className={s.piedQ}>{`Que faire ${pl(choisis.size, 'de l’affaire cochée', 'des affaires cochées')} ? Dans tous les cas, son Suivi le note.`}</span>
                </div>
                <div className={s.opts}>
                  <button type="button" className={s.opt} onClick={() => poser('selection')} disabled={!choisis.size || !!pose}>
                    <span className={s.optIc}><Icone nom="liste" taille={19} epaisseur={2.1} /></span>
                    <span className={s.optTx}>
                      <b><span className={s.optLong}>{pose === 'selection' ? 'Ajout…' : choisis.size > 1 ? 'Les mettre dans sa sélection' : 'La mettre dans sa sélection'}</span><span className={s.optCourt}>{pose === 'selection' ? 'Ajout…' : 'Sélection'}<i>{'rien ne part'}</i></span></b>
                      <small>{`Onglet Sélection de ${prenom}. Rien ne part : tu l’enverras plus tard, quand tu voudras.`}</small>
                    </span>
                  </button>
                  <button type="button" className={s.opt} onClick={() => poser('espace')} disabled={!choisis.size || !!pose}>
                    <span className={s.optIc}><Icone nom="maison" taille={19} epaisseur={2.1} /></span>
                    <span className={s.optTx}>
                      <b><span className={s.optLong}>{pose === 'espace' ? 'Présentation…' : choisis.size > 1 ? 'Les mettre dans son espace' : 'La mettre dans son espace'}</span><span className={s.optCourt}>{pose === 'espace' ? 'Présentation…' : 'Son espace'}<i>{'sans mail'}</i></span></b>
                      <small>{`Sans mail : l’affaire passe dans Présentés et ${prenom} la voit dans son espace. Son téléphone le prévient s’il a accepté les alertes.`}</small>
                    </span>
                  </button>
                  <button type="button" className={`${s.opt} ${s.optOr}`} onClick={() => poser('mail')} disabled={!choisis.size || !!pose}>
                    <span className={s.optIc}><Icone nom="envoyer" taille={19} epaisseur={2.1} /></span>
                    <span className={s.optTx}>
                      <b><span className={s.optLong}>{pose === 'mail' ? 'Préparation…' : choisis.size > 1 ? 'Les lui envoyer par mail' : 'La lui envoyer par mail'}</span><span className={s.optCourt}>{pose === 'mail' ? 'Préparation…' : 'Par mail'}<i>{'tu le relis'}</i></span></b>
                      <small>{`Le mail habituel s’ouvre, tu le relis, il part. L’affaire passe dans Présentés, et ${prenom} la voit dans son espace.`}</small>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {apercu && (
        <div className={s.voileApercu} onMouseDown={e => { if (e.target === e.currentTarget) setApercu(null); }}>
          <div className={s.apercu} role="dialog" aria-modal="true" aria-label={apercu.titre}>
            <button type="button" className={s.fermerA} aria-label="Fermer l’aperçu" onClick={() => setApercu(null)}><Icone nom="fermer" taille={16} epaisseur={2.2} /></button>
            <Photo src={apercu.photo} grande />
            {apercu.photos.length > 1 && (
              <div className={s.vignettes}>
                {apercu.photos.slice(1, 5).map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u + i} src={u} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ))}
              </div>
            )}
            <div className={s.apercuCorps}>
              <div className={s.apercuTete}>
                <div>
                  <h3>{apercu.titre}</h3>
                  {apercu.lieu && <p>{apercu.lieu}</p>}
                </div>
                <Note n={apercu.corr.note} />
              </div>
              <div className={s.apercuPrix}>
                <b>{EUR(apercu.prix) || 'Prix non indiqué'}</b>
                <Source t={apercu} />
              </div>
              {avisDe(apercu) && (
                <div className={s.apercuAvis}>
                  <span className={s.sur}>{`Ce qu’en dit le rapprochement${typeof avisDe(apercu)!.s === 'number' ? ` · ${avisDe(apercu)!.s} sur 100` : ''}`}</span>
                  <AvisDetail avis={avisDe(apercu)!} />
                </div>
              )}
              <div className={s.faits}>
                {apercu.surface ? <span>{`${apercu.surface} m²`}</span> : null}
                {apercu.pieces ? <span>{`${apercu.pieces} espace${apercu.pieces > 1 ? 's' : ''}`}</span> : null}
                {apercu.chambres ? <span>{`${apercu.chambres} bureau${apercu.chambres > 1 ? 'x fermés' : ' fermé'}`}</span> : null}
              </div>
              <span className={s.sur}>{`Face à ses critères`}</span>
              <div className={s.crit}>
                {apercu.corr.lignes.map((l, i) => (
                  <div key={l.lib + i} className={s.critL} data-etat={l.etat}>
                    <span className={s.critIc}><Icone nom={l.etat === 'oui' ? 'coche' : l.etat === 'presque' ? 'moins' : 'fermer'} taille={12} epaisseur={3} /></span>
                    <span className={s.critLib}>{l.lib}</span>
                    <span className={s.critV}>{l.valeur}</span>
                    <span className={s.critD}>{l.demande}</span>
                  </div>
                ))}
              </div>
              {ancien(apercu) && <p className={s.vieuxA}>{`Trouvé le ${jourCourt(apercu.le)} : le local est peut-être déjà pris. Ouvrez l’annonce avant de l’envoyer.`}</p>}
            </div>
            <div className={s.apercuPied}>
              {apercu.url && <a className={s.btn} href={apercu.url} target="_blank" rel="noopener noreferrer"><Icone nom="lien" taille={15} epaisseur={2.1} />Voir l’annonce</a>}
              {apercu.avant && <span className={s.dejaEtat}>{'Pas encore proposée : elle partira sans montant.'}</span>}
              {apercu.source === 'mandat' && apercu.vente && onFicheBien && (
                <button type="button" className={s.btn} onClick={() => versFiche(apercu.vente!.id)}><Icone nom="maison" taille={15} epaisseur={2.1} />Fiche de l’affaire</button>
              )}
              <span style={{ flexGrow: 1 }} />
              {apercu.dossier
                ? <span className={s.dejaEtat}>{`Déjà dans son dossier · ${etatDossier(apercu.dossier)}`}</span>
                : (
                  <button type="button" className={`${s.btn} ${choisis.has(apercu.cle) ? '' : s.btnOr}`} onClick={() => basculer(apercu.cle)}>
                    <Icone nom={choisis.has(apercu.cle) ? 'fermer' : 'coche'} taille={15} epaisseur={2.4} />{choisis.has(apercu.cle) ? 'Retirer du choix' : 'Choisir cette affaire'}
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(<>{fenetre}{aide && <AideRapprochement depuis="client" onFermer={() => setAide(false)} />}</>, document.body);
}

/* ══ Le guide de l'onglet Rapprochement (V3.231) ══════════════════════════════
   Alexandre : « le où chercher, c'est écrit en gros… des petites cases, plus
   jolies, plus condensées, et pas déplié d'office », puis : « j'aimais bien
   la petite animation, quels biens de ta base pourraient plaire à Fanny ;
   et c'est quand on fait Lancer que ça demande où chercher, quoi montrer…
   tout se déplie en fonction de ce que je choisis ».
   Au repos : l'illustration animée, la question, « Lancer un rapprochement »,
   le dernier rapprochement. Au clic, les réglages se déplient, pas à pas :
   Repris du CRM d'Emilio (sa V3.231), avec les mots de Werner.
   ① Où chercher — trois petites cases, chacune avec son « ? » ; la période
     des veilles n'apparaît que si elles sont cochées.
   ② Quoi montrer — seulement s'il y a déjà eu un rapprochement : les
     nouveautés ou tout revoir, chacun avec son « ? » (FicheClient passe
     `vus`, les clés de tout ce qui est déjà ressorti, à la fenêtre).
   ③ Lancer — combien de biens seront comparés.
   Rien de coché : ② et ③ se replient, il le dit. */
export function GuideRapprochement({ client, recherche, illu, dernier, onLancer, vusBiens }: {
  client: Ligne; recherche: Ligne;
  /* L'illustration de la fiche (l'acheteur et ses biens), animée. */
  illu?: ReactNode;
  dernier: { le: string; n: number } | null;
  onLancer: (o: DepartRappro) => void;
  /* Les biens où il est ressorti depuis leur fiche, pas encore dans son
     dossier (« Depuis tes affaires ») : un rappel, et de quoi y aller. */
  vusBiens?: { n: number; onVoir: () => void } | null;
}) {
  const prenom = client.prenom || 'ce client';
  const [pret, setPret] = useState(false);
  const [mandats, setMandats] = useState(true);
  const [veilles, setVeilles] = useState(true);
  const [estim, setEstim] = useState(false);
  const [periode, setPeriode] = useState<PeriodeVeille>(90);
  const [nouveautes, setNouveautes] = useState(true);
  const [comptes, setComptes] = useState<{ mandats: number; estimations?: number; veilles: Record<number, number> } | null>(null);
  const panneau = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivant = true;
    compterSources(String(recherche.id), String(client.id)).then(c => { if (vivant) setComptes(c); }).catch(() => { if (vivant) setComptes({ mandats: 0, veilles: {} }); });
    return () => { vivant = false; };
  }, [recherche.id, client.id]);
  /* Déplié : les réglages viennent à l'écran (au téléphone, ils sont dessous). */
  useEffect(() => {
    if (!pret) return;
    const t = setTimeout(() => panneau.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    return () => clearTimeout(t);
  }, [pret]);
  const nbV = comptes ? comptes.veilles[periode] ?? 0 : null;
  const biens = mandats || estim;
  const source: SourceRappro = biens && veilles ? 'deux' : biens ? 'mandats' : 'veilles';
  const rien = !mandats && !veilles && !estim;
  const total = comptes ? (mandats ? comptes.mandats : 0) + (estim ? comptes.estimations || 0 : 0) + (veilles ? nbV || 0 : 0) : null;

  const SOURCES = [
    {
      k: 'm', ic: 'maison', nom: 'Mes affaires en cours', d: 'Tes affaires « Disponible »', n: comptes ? comptes.mandats : null, on: mandats, set: setMandats,
      aide: <>
        <span>{'Tes affaires à l’étape « Disponible ». Pas celles sous offre, en signature ou conclues.'}</span>
        <span>{`Jamais une affaire dont ${prenom} est le mandant.`}</span>
        <span>{'Celles qui passent le tri sont relues en détail face à tout son dossier, 24 au plus : un avis, une note de potentiel, ses plus et ses moins.'}</span>
      </>,
    },
    {
      k: 'e', ic: 'etiquette', nom: 'Mes estimations', d: 'Pas encore proposées, sans montant', n: comptes ? comptes.estimations || 0 : null, on: estim, set: setEstim,
      aide: <>
        <span>{'Tes affaires à l’étape « Estimation » ou « À suivre » : pas encore sous mandat. Décoché d’office.'}</span>
        <span>{'Relues comme tes affaires en cours, avec l’étiquette « Ton estimation ».'}</span>
        <span>{`S’il en reçoit une, ${prenom} la reçoit sans montant : le montant arrive chez lui à la signature du mandat.`}</span>
      </>,
    },
    {
      k: 'v', ic: 'loupe', nom: 'Les annonces de mes veilles', d: 'Trouvées pour tes autres clients', n: nbV, on: veilles, set: setVeilles,
      aide: <>
        <span>{'Les annonces que tes veilles ont trouvées pour tes autres clients, sur la période choisie, hors celles que tu as écartées. Une annonce trouvée pour plusieurs clients compte une fois.'}</span>
        <span>{`Celles trouvées pour ${prenom} sont déjà dans sa Veille : elles n’y sont pas.`}</span>
        <span>{'Elles ne sont pas relues (la veille les a déjà lues) : elles gardent leur note de critères. Plus c’est ancien, plus l’annonce risque d’être vendue : vérifie son lien avant de l’envoyer.'}</span>
      </>,
    },
  ];
  const QUOI = [
    {
      k: true, ic: 'etoile', t: 'Seulement les nouveautés', d: `Ce qui n’est jamais ressorti pour ${prenom}`,
      aide: <>
        <span>{'Il cherche partout où tu as coché, comme d’habitude.'}</span>
        <span>{`Puis il met de côté les affaires déjà ressorties pour ${prenom} dans un rapprochement précédent lancé depuis sa fiche, même si elles n’avaient pas été retenues. Elles restent en bas, repliées (« Déjà vus »), un clic pour les revoir.`}</span>
        <span>{'Reste ce qui n’est encore jamais ressorti : une affaire arrivée depuis, ou une affaire qui passe le tri maintenant (loyer ou prix baissé, recherche modifiée). Seules celles-là sont relues en détail.'}</span>
        <span>{'Une affaire déjà dans son dossier (sélection ou présentées) est toujours rangée à part ; une affaire « Pas pour lui » ne revient jamais.'}</span>
      </>,
    },
    {
      k: false, ic: 'remettre', t: 'Tout revoir', d: 'Tout ce qui passe le tri, comme la première fois',
      aide: <>
        <span>{'Tout ce qui passe le tri est montré, même les affaires déjà ressorties les fois d’avant.'}</span>
        <span>{`Tes affaires sont relues, 24 au plus. Un avis déjà donné est repris tel quel si ni la fiche de l’affaire ni le dossier de ${prenom} n’ont changé : c’est rapide, et l’avis reste le même des deux côtés.`}</span>
        <span>{'Utile quand sa recherche a changé, ou pour tout revoir d’un coup.'}</span>
        <span>{'Une affaire déjà dans son dossier est toujours rangée à part ; une affaire « Pas pour lui » ne revient jamais.'}</span>
      </>,
    },
  ];
  const numero = (n: number) => <span className={s.pasN}>{n}</span>;

  return (
    <section className={s.guide} aria-label={`Rapprochement pour ${prenom}`}>
      <div className={s.guideTete}>
        {illu}
        <div className={s.guideTx}>
          <h2>{`Quelles affaires de ta base pourraient plaire à ${prenom} ?`}</h2>
          <p>{'On compare sa recherche avec '}<b>{'tes affaires en cours'}</b>{' (et tes estimations, si tu veux) et avec '}<b>{'les annonces que tes veilles ont trouvées pour tes autres clients'}</b>{'. Puis le rapprochement relit en détail tes affaires face à tout son dossier : pour chacune, un avis, une note de potentiel sur 100, ses plus et ses moins.'}</p>
          <div className={s.guideActions}>
            {!pret && (
              <button type="button" className={`${s.btn} ${s.btnOr} ${s.guideGo}`} onClick={() => setPret(true)}>
                <Icone nom="etoile" taille={17} epaisseur={2.2} />{'Lancer un rapprochement'}
              </button>
            )}
            <BoutonAideRappro depuis="client" />
          </div>
          <div className={s.guideInfos}>
            <span className={s.guideDernier}>
              <Icone nom="horloge" taille={14} epaisseur={2.2} />
              {dernier
                ? <span><b>{`Dernier rapprochement le ${jourLong(dernier.le)}`}</b>{` : ${dernier.n} ${pl(dernier.n, 'bien trouvé', 'biens trouvés')}.`}</span>
                : <span>{`Aucun rapprochement encore pour ${prenom}.`}</span>}
            </span>
            {!!vusBiens?.n && (
              <button type="button" className={s.guideVu} onClick={vusBiens.onVoir}>
                <span className={s.guideVuIc}><Icone nom="maison" taille={13} epaisseur={2.2} /></span>
                <span>{`${vusBiens.n} ${pl(vusBiens.n, 'affaire', 'affaires')} où ${prenom} ressort, depuis ${pl(vusBiens.n, 'sa fiche', 'leur fiche')}`}</span>
                <b>{'Voir'}</b>
              </button>
            )}
          </div>
        </div>
      </div>

      {pret && (
        <div ref={panneau} className={s.lanceur}>
          <div className={s.lanceurT}>
            <span className={s.lanceurIc}><Icone nom="reglages" taille={16} epaisseur={2.2} /></span>
            <b>{'Préparer le rapprochement'}</b>
            <button type="button" className={s.lanceurFermer} onClick={() => setPret(false)}><Icone nom="fermer" taille={13} epaisseur={2.4} /><span>{'Annuler'}</span></button>
          </div>

          {/* ① Où chercher */}
          <Cascade cle="p1" arrivee className={s.pas}>
            {numero(1)}
            <div className={s.pasCorps}>
              <div className={s.pasTete2}><b>{'Où chercher'}</b><span>{'Coche ce que tu veux.'}</span></div>
              <div className={s.srcs}>
                {SOURCES.map(x => (
                  <div key={x.k} className={`${s.srcCase} ${x.on ? s.srcOn : ''}`}>
                    <button type="button" role="checkbox" aria-checked={x.on} className={s.srcHaut} onClick={() => x.set(!x.on)}>
                      <span className={s.srcCoche}><Icone nom="coche" taille={12} epaisseur={3.2} /></span>
                      <span className={s.srcIc}><Icone nom={x.ic} taille={16} epaisseur={2} /></span>
                      <span className={s.srcNom}><b>{x.nom}</b><small>{x.d}</small></span>
                      <strong className={s.srcN}>{x.n ?? '…'}</strong>
                    </button>
                    <span className={s.srcQ}><Aide titre={x.nom}>{x.aide}</Aide></span>
                  </div>
                ))}
                {veilles && (
                  <Cascade cle="per" arrivee className={s.srcPer}>
                    <span><Icone nom="horloge" taille={13} epaisseur={2.2} />{'Annonces des veilles trouvées depuis'}</span>
                    <span className={s.periodes} role="group" aria-label="Trouvées depuis">
                      {PERIODES.map(p => (
                        <button key={p.k} type="button" className={periode === p.k ? s.periodeOn : ''} aria-pressed={periode === p.k}
                          onClick={() => setPeriode(p.k)}>{p.l}</button>
                      ))}
                    </span>
                  </Cascade>
                )}
              </div>
            </div>
          </Cascade>

          {rien && <p className={s.alerte}><Icone nom="info" taille={15} epaisseur={2} /><span>{'Coche au moins un endroit où chercher : la suite se déplie.'}</span></p>}

          {/* ② Quoi montrer : seulement s'il y a déjà eu un rapprochement. */}
          {!rien && dernier && (
            <Cascade cle="p2" arrivee className={s.pas}>
              {numero(2)}
              <div className={s.pasCorps}>
                <div className={s.pasTete2}>
                  <b>{'Quoi montrer'}</b>
                  <span>{`Le dernier : le ${jourLong(dernier.le)}`}</span>
                </div>
                <div className={s.quoi} role="radiogroup" aria-label="Quoi montrer">
                  {QUOI.map(o => (
                    <div key={String(o.k)} className={`${s.quoiCase} ${nouveautes === o.k ? s.quoiOn : ''}`}>
                      <button type="button" role="radio" aria-checked={nouveautes === o.k} className={s.quoiBtn} onClick={() => setNouveautes(o.k)}>
                        <span className={s.quoiRond} aria-hidden="true" />
                        <span className={s.quoiTx}><b><Icone nom={o.ic} taille={14} epaisseur={2.2} /><span>{o.t}</span></b><small>{o.d}</small></span>
                      </button>
                      <span className={s.quoiQ}><Aide titre={o.t}>{o.aide}</Aide></span>
                    </div>
                  ))}
                </div>
              </div>
            </Cascade>
          )}

          {/* ③ Lancer */}
          {!rien && (
            <Cascade cle="p3" arrivee className={`${s.pas} ${s.pasGo}`}>
              {numero(dernier ? 3 : 2)}
              <div className={s.lancerL}>
                <span className={s.lancerTx}>
                  <b>{total == null ? 'Je compte tes affaires…' : `${total} ${pl(total, 'local à comparer', 'locaux à comparer')} avec sa recherche`}</b>
                  <small>{`${dernier && nouveautes ? `D’abord ceux jamais ressortis pour ${prenom}.` : 'Tout ce qui passe le tri sera montré.'} Rien ne part tout seul : tu choisis ensuite.`}</small>
                </span>
                <button type="button" className={`${s.btn} ${s.btnOr}`} onClick={() => onLancer({ source, periode, nouveautes: !!dernier && nouveautes, estimations: estim, ventes: mandats })}>
                  <Icone nom="loupe" taille={17} epaisseur={2.2} />{'Lancer le rapprochement'}
                </button>
              </div>
            </Cascade>
          )}
        </div>
      )}
    </section>
  );
}

/* Les deux historiques, dans la même carte (V3.231) : ceux lancés depuis sa
   fiche, et ceux lancés depuis la fiche d'un bien où il est ressorti. */
export type OngletHisto = 'fiche' | 'biens';
export function OngletsHisto({ onglet, onChange, nFiche, nBiens, prenom }: {
  onglet: OngletHisto; onChange: (o: OngletHisto) => void; nFiche: number; nBiens: number; prenom: string;
}) {
  return (
    <div className={s.histo}>
      <div className={s.histoO} role="tablist" aria-label="Les rapprochements faits">
        <Curseur cle={onglet} />
        <button type="button" role="tab" aria-selected={onglet === 'fiche'} aria-pressed={onglet === 'fiche'} onClick={() => onChange('fiche')}>
          <Icone nom="personne" taille={14} epaisseur={2.2} /><span>{'Depuis sa fiche'}</span><i>{nFiche}</i>
        </button>
        <button type="button" role="tab" aria-selected={onglet === 'biens'} aria-pressed={onglet === 'biens'} onClick={() => onChange('biens')}>
          <Icone nom="maison" taille={14} epaisseur={2.2} /><span>{'Depuis tes affaires'}</span><i>{nBiens}</i>
        </button>
      </div>
      <p className={s.histoD}>{onglet === 'fiche'
        ? `Lancés ici, depuis la fiche de ${prenom}. Le plus récent est déplié ; un clic sur une ligne la déplie ou la replie.`
        : `Lancés depuis la fiche d’une de tes affaires, où ${prenom} est ressorti : le dernier avis par affaire, le même des deux côtés, et où il en est.`}</p>
    </div>
  );
}

/* ══ Les rapprochements faits, datés et dépliables (V3.126) ══════════════════
   Alexandre : « je clique et je vois ce qui a été fait ». Chaque ligne du
   Suivi « Rapprochement » garde ce qui a été proposé ce jour-là
   (`metadata.lignes`, noterRapprochement) : le plus récent est déplié, les
   autres se déplient d'un clic. Les lignes d'avant la V3.126 n'ont que leur
   nombre de biens. */
type LigneJournal = { id: string; created_at: string; description?: string | null; metadata?: Record<string, unknown> | null };
const lignesDe = (j: LigneJournal): LigneRappro[] => (Array.isArray(j.metadata?.lignes) ? (j.metadata!.lignes as LigneRappro[]).filter(l => l && typeof l.cle === 'string') : []);
/* V3.231 : trois d'abord (« pas 40 d'un coup ») ; « Voir les plus anciens » en
   ajoute cinq à chaque fois, « Replier » revient aux trois derniers. */
const PREMIERS = 3, ENCORE = 5;
export function RapprochementsFaits({ liste, prenom, onBien }: { liste: LigneJournal[]; prenom: string; onBien?: (bienVenteId: string) => void }) {
  const [ouverts, setOuverts] = useState<string[] | null>(null);
  const [nb, setNb] = useState(PREMIERS);
  const premier = liste.find(j => lignesDe(j).length)?.id;
  const estOuvert = (id: string) => (ouverts === null ? id === premier : ouverts.includes(id));
  const basculer = (id: string) => setOuverts(o => { const base = o ?? (premier ? [premier] : []); return base.includes(id) ? base.filter(x => x !== id) : [...base, id]; });
  if (!liste.length) return null;
  const ligneBien = (l: LigneRappro) => {
    const corps = (
      <>
        <span className={s.rfNote} data-v={l.v || 'aucun'} title={l.v ? `Potentiel : ${l.s ?? '?'} sur 100` : `${l.n} % de ses critères`}>
          {l.v && typeof l.s === 'number' ? l.s : `${l.n} %`}
        </span>
        <span className={s.rfTx}>
          <b>{l.titre}</b>
          <small>{[l.lieu, l.prix ? EUR(l.prix) : '', l.src === 'veille' ? 'annonce d’une veille' : ''].filter(Boolean).join(' · ')}</small>
          {l.v && l.t ? <AvisDetail avis={{ v: l.v, r: l.t, s: l.s, p: l.p, m: l.m }} compact={true} sansMot={true} /> : null}
        </span>
      </>
    );
    if (l.bien && onBien) return <button key={l.cle} type="button" className={s.rfBien} onClick={() => onBien(l.bien!)}>{corps}</button>;
    if (l.url) return <a key={l.cle} className={s.rfBien} href={l.url} target="_blank" rel="noopener noreferrer">{corps}</a>;
    return <div key={l.cle} className={s.rfBien}>{corps}</div>;
  };
  return (
    <div className={s.rf}>
      {liste.slice(0, nb).map(j => {
        const l = lignesDe(j);
        const n = Number(j.metadata?.n ?? 0);
        const ouvert = l.length > 0 && estOuvert(j.id);
        const relus = l.filter(x => x.v).sort((p, q) => compareIA({ v: p.v!, r: '', s: p.s }, { v: q.v!, r: '', s: q.s }));
        const autres = l.filter(x => !x.v);
        const c = (v: AvisIA['v']) => relus.filter(x => x.v === v).length;
        return (
          <div key={j.id} className={`${s.rfLigne} ${ouvert ? s.rfOuvert : ''}`}>
            <button type="button" className={s.rfT} aria-expanded={ouvert} disabled={!l.length} onClick={() => basculer(j.id)}>
              <span className={s.rfIc}><Icone nom="etoile" taille={14} epaisseur={2} /></span>
              <span className={s.rfTitre}>
                <b>{`Rapprochement du ${dateRappro(j.created_at)}`}</b>
                <small>{[`${n} bien${n > 1 ? 's' : ''} trouvé${n > 1 ? 's' : ''}`, relus.length ? `${c('oui')} oui · ${c('a_voir')} à voir · ${c('non')} non` : '', !l.length ? 'le détail n’était pas encore gardé' : ''].filter(Boolean).join(' · ')}</small>
              </span>
              {l.length > 0 && <span className={s.rfChev}><Icone nom="chevron" taille={15} epaisseur={2.2} /></span>}
            </button>
            {ouvert && (
              <div className={s.rfC}>
                {(['oui', 'a_voir', 'non'] as const).map(v => {
                  const g = relus.filter(x => x.v === v);
                  if (!g.length) return null;
                  return (
                    <div key={v} className={s.rfGroupe}>
                      <span className={s.rfGroupeT}><IconeAvis v={v} t={18} /><b>{MOT_IA[v]}</b><i>{g.length}</i></span>
                      {g.map(ligneBien)}
                    </div>
                  );
                })}
                {autres.length > 0 && (
                  <div className={s.rfGroupe}>
                    <span className={s.rfGroupeT}><b>{relus.length ? 'Les autres biens' : `Les biens proposés à ${prenom}`}</b><i>{autres.length}</i></span>
                    {autres.map(ligneBien)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {liste.length > PREMIERS && (
        <div className={s.plusMoins}>
          {liste.length > nb && (
            <button type="button" onClick={() => setNb(n => n + ENCORE)}>
              <Icone nom="chevron" taille={14} epaisseur={2.4} />{`Voir les plus anciens · ${liste.length - nb}`}
            </button>
          )}
          {nb > PREMIERS && (
            <button type="button" className={s.plusMoinsR} onClick={() => setNb(PREMIERS)}>
              <Icone nom="chevron" taille={14} epaisseur={2.4} />{'Replier'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══ Vu depuis tes biens (V3.228) ═══════════════════════════════════════════
   Alexandre : « si depuis la fiche d'un bien on fait un rapprochement et que
   ça trouve un client, est-ce que sur sa fiche ça l'indique ? » Les
   rapprochements lancés depuis la fiche d'une affaire, où cette recherche est
   ressortie (src/lib/rapprochement.ts, vusDepuisBiens) : le dernier avis par
   bien, le même que sur la fiche du bien. Pour chacun, où il en est : dans
   son dossier (sélection, présenté le…, sa réponse), « Pas pour lui », plus
   en vente — ou « La mettre dans sa sélection ». Oui et À voir d'abord, Non
   replié. */
export function VuDepuisBiens({ liste, prenom, dossier, onBien, onProposer, pose, etroit }: {
  liste: VuDepuisBien[]; prenom: string;
  /* Ses biens déjà dans son dossier, par bien en vente. */
  dossier: Record<string, EtatDossier>;
  onBien: (bienVenteId: string) => void;
  onProposer: (v: VuDepuisBien) => void;
  /* Le bien en cours d'ajout. */
  pose: string | null;
  /* Dans une colonne (l'historique) : la carte s'empile, l'avis dessous. */
  etroit?: boolean;
}) {
  const [voirNon, setVoirNon] = useState(false);
  /* V3.231 : trois par groupe, puis « Voir les N autres ». */
  const [tous, setTous] = useState<string[]>([]);
  const ligne = (v: VuDepuisBien) => {
    const b = v.bien;
    const titre = b ? b.titre || titreBien(b.donnees || {}) : 'Une affaire supprimée';
    const lieu = b ? [b.quartier, b.ville].filter(Boolean).join(' · ') : '';
    const mode = b && !b.archive ? modeAcheteurs(b.etape) : 'fini';
    const d = dossier[v.bienId];
    const etat = d ? etatDossier(d)
      : v.ecarte ? 'Pas pour lui (posé depuis l’affaire)'
        : !b ? 'Cette affaire n’existe plus'
          : b.archive ? 'Affaire archivée'
            : mode === 'fini' ? `${etapeDe(b.etape).lib} : plus proposée`
              : mode === 'pause' ? 'Vente en pause' : '';
    const peut = !d && !v.ecarte && !!b && (mode === 'vente' || mode === 'avant');
    const photo = b ? (lirePhotos((b.donnees || {}).photos).map(p => p.url).filter(Boolean)[0] || b.photo || null) : null;
    const note = typeof v.s === 'number' ? v.s : v.n;
    /* V3.228 : la même carte que dans la fenêtre du rapprochement. */
    return (
      <article key={v.bienId} className={`${s.bc} ${s.bcVu}`} data-v={v.v}>
        <button type="button" className={s.bcBien} disabled={!b} title={b ? 'Ouvrir la fiche de l’affaire' : undefined} onClick={() => onBien(v.bienId)}>
          <PhotoNote photo={photo} n={note} v={typeof v.s === 'number' ? v.v : null} legende={typeof v.s === 'number' ? 'potentiel' : 'critères'} />
          <span className={s.bcTx}>
            <b className={s.bcTitre}>{insec(titre)}</b>
            {lieu && <span className={s.bcLieu}><Icone nom="lieu" taille={13} epaisseur={2.2} /><span>{lieu}</span></span>}
            {(b?.prix || mode === 'avant') && (
              <span className={s.bcPrix}>
                {b?.prix ? <b>{EUR(b.prix)}</b> : null}
                {mode === 'avant' && <span className={`${s.src} ${s.srcEstim}`} title="Pas encore proposée : elle partirait sans montant"><Icone nom="etiquette" taille={12} epaisseur={2.2} />{'Estimation, sans montant pour lui'}</span>}
              </span>
            )}
            <span className={s.bcMeta}><Icone nom="calendrier" taille={13} epaisseur={2.2} /><span>{`Rapprochement du ${jourLong(v.le)}${v.fois > 1 ? ` · ressorti ${v.fois} fois` : ''}`}</span></span>
          </span>
        </button>
        <div className={s.bcAvis}>
          {v.t ? <AvisDetail avis={{ v: v.v, r: v.t, s: v.s ?? undefined, p: v.p, m: v.m }} sansMot={true} deuxCol={true} /> : null}
          {(etat || peut) && (
            <span className={s.vuD}>
              {etat && <span className={d ? s.vuEtatOk : s.vuEtat}>{d && <Icone nom="coche" taille={12} epaisseur={3} />}<span>{etat}</span></span>}
              {peut && (
                <button type="button" className={s.vuBtn} disabled={!!pose} onClick={() => onProposer(v)}>
                  <Icone nom="liste" taille={14} epaisseur={2.2} />{pose === v.bienId ? 'Ajout…' : 'La mettre dans sa sélection'}
                </button>
              )}
            </span>
          )}
        </div>
      </article>
    );
  };
  const groupe = (av: AvisIA['v']) => {
    const l = liste.filter(x => x.v === av);
    if (!l.length) return null;
    const replie = av === 'non' && !voirNon;
    const tete = <><IconeAvis v={av} t={18} /><b>{MOT_IA[av]}</b><i>{l.length}</i></>;
    return (
      <div key={av} className={s.rfGroupe}>
        {av === 'non'
          ? <button type="button" className={`${s.rfGroupeT} ${s.vuNon}`} aria-expanded={!replie} onClick={() => setVoirNon(o => !o)}>{tete}<em>{replie ? 'Voir pourquoi' : 'Replier'}</em></button>
          : <span className={s.rfGroupeT}>{tete}<em>{av === 'oui' ? `Ils peuvent plaire à ${prenom}.` : 'Un point à vérifier avec lui.'}</em></span>}
        {!replie && (tous.includes(av) ? l : l.slice(0, PREMIERS)).map(ligne)}
        {!replie && l.length > PREMIERS && (
          <div className={s.plusMoins}>
            {tous.includes(av)
              ? <button type="button" className={s.plusMoinsR} onClick={() => setTous(x => x.filter(y => y !== av))}><Icone nom="chevron" taille={14} epaisseur={2.4} />{'Replier'}</button>
              : <button type="button" onClick={() => setTous(x => [...x, av])}><Icone nom="chevron" taille={14} epaisseur={2.4} />{`Voir ${pl(l.length - PREMIERS, 'l’autre', `les ${l.length - PREMIERS} autres`)}`}</button>}
          </div>
        )}
      </div>
    );
  };
  return <div className={`${s.vu} ${etroit ? s.vuEtroit : ''}`}>{(['oui', 'a_voir', 'non'] as const).map(groupe)}</div>;
}
