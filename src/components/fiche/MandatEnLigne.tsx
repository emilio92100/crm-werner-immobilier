'use client';

/* ══ Le mandat en ligne, dans la fenêtre « Mandat de recherche » du CRM ═══════

   Trois choses, de haut en bas :

   1. L'ÉTAT de la signature en ligne de cette recherche : signé (avec le PDF),
      en cours (le client a demandé son code), ou rétracté.
   2. « FAIRE SIGNER LE MANDAT » : Werner choisit ses honoraires — un
      pourcentage (2,5 % HT par défaut, du loyer annuel HT HC pour un bail, du
      prix pour une cession ou une vente ; il le change à son gré, jusqu'à
      BAREME) ou un forfait en euros HT —, et propose. Le numéro vient du
      registre commun de RT CONSEILS quand le client demande son code. Son clic vaut signature de
      l'offre pour l'agence (la date est gardée). Le client voit aussitôt
      « Votre mandat est prêt » dans son espace ; « Envoyer par e-mail » lui
      envoie le lien direct (…?mandat=1). « Aperçu » montre le PDF exact,
      filigrané « PROJET · NON SIGNÉ ».
   3. L'APPROBATION DU MANDAT TYPE, pour les demandeurs qui signent seuls au
      clic « Je souhaite le visiter » (la signature de l'agence pour ces
      mandats-là). La réserve de numéros d'avant le registre reste pour un
      registre non démarré. Et la signature manuscrite posée sur les PDF.

   ⚠️ Un seul registre des mandats pour toute la carte de RT CONSEILS : le
   registre commun, tenu dans le CRM d'Emilio (Cass. 1re civ., 10 décembre 2014).
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase, addJournal } from '@/lib/supabase';
import { lienEspace, basePublique } from '@/lib/jeton';
import {
  HONORAIRES_TAUX, BAREME, tauxDe, tauxTexte, prixMaximum, honorairesPour, euros, rechercheDepuis, redigerMandat, resumeMandat, horsMandat,
  forfaitDe, seuilForfait, honorairesCourt, pourcentDe, jourParis, memeNumero,
  type Contenu,
} from '@/lib/mandat';
import { CLE_IDENTITE, lireIdentite } from '@/lib/agence';
import { contenuApresAvenants } from '@/lib/actes/avenant-recherche';
import { signalerEchec } from '@/lib/ecritures';
import Aide from '@/components/shared/Aide';
import { etatLigne, lireDepart, numeroAncien, observer, prochainNumero, type ObsRegistre } from '@/lib/registre';
import { mandatRechercheEnCours, phraseMandat, type MandatEnCours } from '@/lib/coherence';
import { exemplaireManquant, lienFichier, nomFichier, rappelExemplaire, type DocumentRow } from '@/components/documents/outils';
import FenetreSigne from '@/components/documents/FenetreSigne';
import FenetreConfirmer, { type PointConfirmer } from '@/components/documents/FenetreConfirmer';

const CLE_RESERVE = 'mandat_numeros_reserve';
const CLE_APPROBATION = 'mandat_modele_approuve_le';
const SIGNATURE = 'agence/signature.png';

type Sig = {
  id: string; numero: string; statut: string; signe_le: string | null; retracte_le: string | null;
  pdf_chemin: string | null; execution_immediate: boolean | null; code_envoye_le: string | null;
  deroule?: { t: string; x: string }[] | null;
  mandant: { civilite?: string; prenom?: string; nom?: string; email?: string; telephone?: string; adresse?: string } | null;
  contenu?: Contenu | null;
  /* SQL « signature-plusieurs » : la société, son Kbis. */
  societe?: { denomination: string; forme: string; siren: string; rcsVille: string; qualite: string } | null;
  kbis_chemin?: string | null;
};
/* Un co-signataire (conjoint, co-acquéreur) : voir src/lib/cosignature.ts. */
type CoSig = {
  id: string; rang: number; statut: string; jeton: string | null;
  personne: { civilite?: string; prenom?: string; nom?: string; email?: string };
  invite_le: string | null; ouvert_le: string | null; lien_expire_le: string | null; relances: number;
  signe_le: string | null; decline_le: string | null; retracte_le: string | null;
};
const nomCo = (c: CoSig) => `${c.personne?.prenom || ''} ${c.personne?.nom || ''}`.trim();

/* ── Ce que le client a corrigé en signant ──
   Nom, e-mail, téléphone et adresse sont modifiables dans l'espace : une
   faute sur la fiche, un conjoint qui signe, une autre adresse e-mail. On
   compare sans accents, sans majuscules ni ponctuation, et les téléphones
   chiffre à chiffre (+33 6… = 06…). */
type Ecart = { cle: 'nom' | 'email' | 'telephone' | 'adresse'; libelle: string; mandat: string; fiche: string; action: string };
const net = (t: unknown) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z@.0-9]/g, '');
const tel = (t: unknown) => {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('0033')) d = '0' + d.slice(4); else if (d.startsWith('33') && d.length === 11) d = '0' + d.slice(2);
  return d;
};
const liste = (v: unknown): string[] => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ecartsDe(m: Sig['mandant'], client: any): Ecart[] {
  if (!m || !client) return [];
  const e: Ecart[] = [];
  const nm = `${m.prenom || ''} ${m.nom || ''}`.trim();
  const nf = `${client.prenom || ''} ${client.nom || ''}`.trim();
  if (nm && net(nm) !== net(nf)) e.push({ cle: 'nom', libelle: 'Nom', mandat: nm, fiche: nf || '—', action: 'Remplacer sur la fiche' });
  const mails = liste(client.emails);
  if (m.email && !mails.map(net).includes(net(m.email))) {
    e.push({ cle: 'email', libelle: 'E-mail (vérifié par le code)', mandat: m.email, fiche: mails.join(', ') || '—', action: mails.length ? 'Mettre en premier sur la fiche' : 'Ajouter à la fiche' });
  }
  const tels = liste(client.telephones);
  if (tel(m.telephone) && !tels.map(tel).includes(tel(m.telephone))) {
    e.push({ cle: 'telephone', libelle: 'Téléphone', mandat: String(m.telephone), fiche: tels.join(', ') || '—', action: tels.length ? 'Mettre en premier sur la fiche' : 'Ajouter à la fiche' });
  }
  if (m.adresse?.trim() && net(m.adresse) !== net(client.adresse)) {
    e.push({ cle: 'adresse', libelle: 'Adresse', mandat: m.adresse.trim(), fiche: String(client.adresse || '').trim() || '—', action: client.adresse ? 'Remplacer sur la fiche' : 'Ajouter à la fiche' });
  }
  return e;
}

const quand = (iso: string) => new Date(iso).toLocaleString('fr-FR', {
  timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).replace(' ', ' à ');
/* « 2026-10-12… » → « 12/10/2026 » : une date, sans heure. */
const jourCourt = (iso: string) => String(iso).slice(0, 10).split('-').reverse().join('/');
const numeros = (v: string) => v.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
/* « 2,5 » → 2.5 ; NaN si ce n'est pas un nombre. */
const lireTaux = (v: string) => { const n = parseFloat(String(v).replace(',', '.').replace('%', '').trim()); return Number.isFinite(n) ? n : NaN; };
const ecrireTaux = (n: number) => String(n).replace('.', ',');
/* « 20 000 » pour la saisie d'un forfait. */
const ecrireEuros = (n: number | null) => (n ? Math.round(n).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') : '');

const boite = (fond: string, trait: string, encre: string): React.CSSProperties => ({
  background: fond, border: `1px solid ${trait}`, color: encre, borderRadius: 12, padding: '12px 14px', fontSize: 13, lineHeight: 1.55,
});
const titreBloc: React.CSSProperties = { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 800, color: '#94a3b8', margin: '4px 0 8px' };
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0',
  background: '#fff', color: 'var(--emilio)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
const btnOr: React.CSSProperties = { ...btn, background: '#f08c42', borderColor: '#f08c42', color: 'var(--emilio)' };
const champ: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', color: 'var(--emilio)',
};

/* Un avenant à ce mandat (Documents), pour la liste et pour les limites. */
type AvenantMini = { id: string; statut: string; signe_le: string | null; donnees: Record<string, unknown> };

/* Le numéro déjà sur la fiche, le registre démarré (voir charger). */
type EtatNumero = 'ancien' | 'ouvert' | 'fini' | null;

/* « Retirer la proposition » (V3.64) : ce que la fenêtre qui explique doit
   savoir, lu au clic. `informe` : pourquoi il a sans doute vu la proposition
   (un mail, un rappel, son espace ouvert depuis, une signature commencée) ;
   null s'il n'en sait rien. */
type Retrait = {
  commence: Sig | null; duRegistre: boolean; seulEncore: boolean; numero: string;
  /* Le numéro vient d'un registre tenu à la main (pas de registre, ou un numéro d'avant
     lui) : c'est là qu'il faut le marquer « clos sans suite ». */
  immoFacile: boolean;
  emails: string[]; informe: string | null;
};

export default function MandatEnLigne({ recherche, client, onMaj, onClient, onAvenant, onOuvrirDocument, onCorrigerSaisie }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recherche: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMaj: (r: any) => void;
  /* La fiche client rechargée, après « Reprendre dans la fiche ». */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClient?: (c: any) => void;
  /* « Préparer un avenant » : la fiche ouvre Documents sur cette recherche. */
  onAvenant?: () => void;
  /* Un mandat signé dans Documents : l'y ouvrir (pour y mettre fin). */
  onOuvrirDocument?: (id: string) => void;
  /* Un mandat noté à la main : rouvrir sa saisie, pour une faute de frappe. */
  onCorrigerSaisie?: () => void;
}) {
  const [avenants, setAvenants] = useState<AvenantMini[]>([]);
  const [sig, setSig] = useState<Sig | null>(null);
  /* Un mandat de recherche préparé dans Documents (V3.32) : tant qu'il est en
     route, on ne propose pas en plus celui de l'espace. */
  const [docMandat, setDocMandat] = useState<MandatEnCours | null>(null);
  /* V3.55 : signé dans Documents, ce mandat-là, relu : où il a été signé (en
     ligne, sur place, sur papier) et son exemplaire signé. */
  const [docSigne, setDocSigne] = useState<DocumentRow | null>(null);
  const [depot, setDepot] = useState(false);
  const [cos, setCos] = useState<CoSig[]>([]);
  const [numero, setNumero] = useState<string>(recherche?.mandat_numero || '');
  const [reserve, setReserve] = useState('');
  const [approuveLe, setApprouveLe] = useState<string | null>(null);
  const [approuve, setApprouve] = useState(false);
  const [aSignature, setASignature] = useState<boolean | null>(null);
  const [travail, setTravail] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [copie, setCopie] = useState(false);
  const [voirReserve, setVoirReserve] = useState(false);
  const [fenRetrait, setFenRetrait] = useState<Retrait | null>(null);
  /* Les honoraires d'un mandat signé : pourquoi ils ne bougent plus, et les
     deux façons de les changer (22 octobre 2026). */
  const [changerHono, setChangerHono] = useState(false);
  const [fenFin, setFenFin] = useState(false);
  /* Le registre des mandats du CRM (V3.18) : démarré, il donne le numéro au
     moment où le client demande son code ; plus de réserve à tenir. */
  const [registre, setRegistre] = useState<{ prochain: number; premier: number; numero: EtatNumero } | null>(null);
  const [taux, setTaux] = useState<string>(ecrireTaux(tauxDe(recherche?.mandat_taux)));
  /* Pourcentage ou forfait : un forfait enregistré l'emporte. */
  const [mode, setMode] = useState<'taux' | 'forfait'>(forfaitDe(recherche?.mandat_forfait) ? 'forfait' : 'taux');
  const [forfait, setForfait] = useState<string>(ecrireEuros(forfaitDe(recherche?.mandat_forfait)));

  const charger = useCallback(async () => {
    if (!recherche?.id) return;
    const [s, p, f, av] = await Promise.all([
      /* Toute la ligne : la société et le Kbis n'existent qu'une fois le SQL
         « signature-plusieurs » lancé. */
      supabase.from('mandats_signatures').select('*')
        .eq('recherche_id', recherche.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('parametres').select('cle, valeur').in('cle', [CLE_RESERVE, CLE_APPROBATION]),
      supabase.storage.from('mandats').list('agence'),
      /* Les avenants à son mandat (la table documents peut manquer : rien
         ne s'affiche alors). */
      supabase.from('documents').select('id, statut, signe_le, donnees')
        .eq('recherche_id', recherche.id).eq('modele', 'avenant_recherche').neq('statut', 'annule').order('created_at'),
    ]);
    setAvenants(!av.error && av.data ? (av.data as AvenantMini[]) : []);
    mandatRechercheEnCours(recherche.id).then(async x => {
      setDocMandat(x?.cle?.startsWith('d-') ? x : null);
      if (x?.cle?.startsWith('d-') && x.etat === 'signe' && x.documentId) {
        const { data } = await supabase.from('documents').select('*').eq('id', x.documentId).maybeSingle();
        setDocSigne((data as DocumentRow) || null);
      } else setDocSigne(null);
    }, () => { setDocMandat(null); setDocSigne(null); });
    const derniere = !s.error && s.data?.length ? (s.data[0] as Sig) : null;
    setSig(derniere);
    /* Ceux qui signent avec lui (la table n'existe qu'après le SQL : sans
       elle, la lecture échoue sans bruit et rien ne s'affiche). */
    if (derniere && derniere.statut !== 'en_cours') {
      const c = await supabase.from('mandats_cosignataires').select('*').eq('signature_id', derniere.id).neq('statut', 'prevu').order('rang');
      setCos(!c.error && c.data ? (c.data as CoSig[]) : []);
    } else setCos([]);
    if (!p.error && p.data) {
      setReserve(numeros(p.data.find(x => x.cle === CLE_RESERVE)?.valeur || '').join(', '));
      const a = p.data.find(x => x.cle === CLE_APPROBATION)?.valeur || null;
      setApprouveLe(a || null); setApprouve(!!a);
    }
    setASignature(f.error ? null : !!f.data?.some(x => x.name === 'signature.png'));
    const reg = await lireDepart(supabase);
    if (!reg.depart) { setRegistre(null); return; }
    /* Le numéro déjà sur la fiche : d'avant le registre (il reste), celui
       d'une signature commencée dans l'espace (le registre le rendra), ou
       celui d'un mandat fini (le registre en donnera un nouveau) — comme le
       fait /api/espace/mandat. */
    const n = String(recherche?.mandat_numero || '').trim();
    let etat: EtatNumero = null;
    if (n && numeroAncien(n, reg.depart.premier_numero)) etat = 'ancien';
    else if (/^\d+$/.test(n)) {
      const { data: l } = await supabase.from('registre_mandats').select('id, source, recherche_id').eq('numero', Number(n)).maybeSingle();
      const ligne = l as { id: string; source: string; recherche_id: string | null } | null;
      if (ligne && ligne.source === 'espace' && ligne.recherche_id === recherche.id) {
        const { data: o } = await supabase.from('registre_observations').select('*').eq('registre_id', ligne.id);
        etat = etatLigne((o || []) as ObsRegistre[]).cle === 'reserve' ? 'ouvert' : 'fini';
      } else etat = 'fini';
    }
    setRegistre({ prochain: await prochainNumero(supabase, reg.depart), premier: reg.depart.premier_numero, numero: etat });
  }, [recherche?.id, recherche?.mandat_numero]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setNumero(recherche?.mandat_numero || ''); }, [recherche?.mandat_numero]);
  useEffect(() => { setTaux(ecrireTaux(tauxDe(recherche?.mandat_taux))); }, [recherche?.mandat_taux]);
  useEffect(() => {
    const f = forfaitDe(recherche?.mandat_forfait);
    setForfait(ecrireEuros(f)); if (f) setMode('forfait');
  }, [recherche?.mandat_forfait]);

  /* Le lien direct : il ouvre l'espace sur CETTE recherche (r=), et le
     mandat par-dessus. */
  /* Werner : sans espace activé (`clients.espace_client`), pas de lien. */
  const lien = client?.token_espace && client?.espace_client === true ? `${lienEspace(client.token_espace)}?r=${encodeURIComponent(recherche.id)}&mandat=1` : '';
  const tauxN = lireTaux(taux);
  const tauxOk = tauxN > 0 && tauxN <= BAREME;
  const budget = typeof recherche?.budget_max === 'number' ? recherche.budget_max : null;
  /* Werner : son loyer annuel maximum HT HC (recherches.criteres_pro). */
  const loyerMax = rechercheDepuis(recherche || {}).loyerMax || null;
  const pmax = tauxOk ? prixMaximum(budget, tauxN) : null;
  /* Le forfait : jamais au-dessus du barème au prix maximum. */
  const forfaitN = forfaitDe(forfait);
  const pmaxF = forfaitN && budget ? Math.floor((budget - forfaitN) / 1000) * 1000 : null;
  const forfaitMax = budget ? Math.floor((budget * BAREME) / (100 + BAREME) / 100) * 100 : null;
  const forfaitOk = !!forfaitN && (!pmaxF || (pmaxF > 0 && forfaitN <= (pmaxF * BAREME) / 100));
  const honoOk = mode === 'forfait' ? forfaitOk : tauxOk;
  /* Ce qui est choisi à l'écran, et ce que le client voit aujourd'hui. */
  const honoChoisi = mode === 'forfait' ? { forfait: forfaitN } : { taux: tauxN };
  const honoEnregistre = { taux: tauxDe(recherche?.mandat_taux), forfait: forfaitDe(recherche?.mandat_forfait) };
  const premierDeLaReserve = numeros(reserve)[0] || '';
  const valide = !!recherche?.mandat_date_signature
    && (!recherche?.mandat_date_expiration || String(recherche.mandat_date_expiration).slice(0, 10) >= jourParis());
  const signeEnLigne = sig?.statut === 'signe' || sig?.statut === 'partiel';
  /* D'où vient le mandat en cours : signé dans l'espace, dans Documents, ou
     noté à la main (signé ailleurs). */
  const sourceSigne: 'ligne' | 'document' | 'saisie' = signeEnLigne && (!String(recherche?.mandat_numero || '').trim() || memeNumero(recherche?.mandat_numero, sig?.numero))
    ? 'ligne' : docSigne ? 'document' : 'saisie';
  const honoSigne = String(recherche?.mandat_honoraires || '').trim() || (sig?.contenu ? honorairesCourt({ taux: sig.contenu.taux, forfait: sig.contenu.forfait }) : '');
  const finSig = sig?.statut === 'termine' ? [...(sig.deroule || [])].reverse().find(x => /^Fin du mandat/.test(x.x))?.t || null : null;
  const ecarts = sig && (sig.statut === 'signe' || sig.statut === 'partiel' || sig.statut === 'en_cours') ? ecartsDe(sig.mandant, client) : [];
  const attendus = cos.filter(c => c.statut === 'invite');
  const nomP = `${sig?.mandant?.prenom || ''} ${sig?.mandant?.nom || ''}`.trim();
  const lienCo = (c: CoSig) => (c.jeton ? `${basePublique()}/signer/${c.jeton}` : '');

  /* ── Les gestes sur un co-signataire (le serveur envoie les mails) ── */
  async function gesteCo(action: 'renvoyer' | 'relancer' | 'clore', c: CoSig) {
    const qui = nomCo(c);
    if (action === 'clore' && !confirm(`Clore l’invitation de ${qui} ?\n\nLe mandat continue au seul nom de ${nomP} (le texte le prévoit). ${nomP.split(' ')[0]} est prévenu par e-mail.`)) return;
    setTravail(`co-${action}-${c.id}`); setMsg(null);
    try {
      const r = await fetch('/api/mandat/cosignataire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, coId: c.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.erreur || `erreur ${r.status}`);
      setMsg({ t: action === 'clore' ? `Invitation close : le mandat continue avec ${nomP}.` : `Lien ${action === 'relancer' ? 'neuf ' : ''}envoyé à ${qui}.`, ok: true });
      await charger();
    } catch (e) {
      setMsg({ t: (e as Error).message, ok: false });
      await charger();
    }
    setTravail('');
  }
  async function copierLienCo(c: CoSig) {
    const l = lienCo(c);
    if (!l) return;
    try { await navigator.clipboard.writeText(l); setMsg({ t: `Lien de ${nomCo(c)} copié : tu peux le lui envoyer par SMS.`, ok: true }); }
    catch { window.prompt('Copie ce lien :', l); }
  }
  async function voirKbis() {
    if (!sig?.kbis_chemin) return;
    const w = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('mandats').createSignedUrl(sig.kbis_chemin, 300);
    if (error || !data?.signedUrl) { w?.close(); setMsg({ t: 'Le Kbis n’a pas pu être ouvert : ' + (error?.message || 'lien indisponible'), ok: false }); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  }
  /* Sa recherche d'aujourd'hui sort-elle de ce qu'il a signé (budget,
     secteurs, type de bien) ? Le client peut changer ses critères depuis
     son espace ; Alexandre reçoit aussi un mail à ce moment-là. */
  /* V3.56 : les avenants d'UN mandat (son numéro) : un avenant à l'ancien
     mandat de la recherche, renouvelé depuis, ne change pas le nouveau.
     Sans numéro à comparer, tous ceux de la recherche, comme avant. */
  const avenantsDu = (n: unknown) => avenants.filter(a => !String(n ?? '').trim() || memeNumero(a.donnees?.mandatNumero, n));
  const avenantsSignes = avenantsDu(sig?.numero).filter(a => a.statut === 'signe');
  /* Un avenant déjà préparé, pas encore signé : le bouton l'ouvre. */
  const avenantEnCours = avenants.some(a => a.statut === 'brouillon' || a.statut === 'pret');
  const depasse = signeEnLigne && sig?.contenu?.recherche
    ? horsMandat(contenuApresAvenants(sig.contenu, avenantsSignes.map(a => a.donnees)), rechercheDepuis(recherche || {}))
    : [];
  /* Les avenants, en une ligne chacun : « Avenant n° 1 · signé le 12/10 ». */
  const lignesAvenants = (n: unknown) => avenantsDu(n).map(a => {
    const no = Number(a.donnees?.avenantNo) || 1;
    return `📝 Avenant n° ${no} · ${a.statut === 'signe' ? `signé le ${a.signe_le ? jourCourt(a.signe_le) : '—'}` : a.statut === 'pret' ? 'à faire signer' : 'brouillon'}`;
  });

  /* ── Reprendre dans la fiche ce que le client a saisi en signant ──
     La nouvelle adresse (ou le nouveau numéro) passe en premier ; les
     autres restent derrière : depuis la V3.89, « Modifier le contact »
     les montre tous, il n'y a plus à en retirer. */
  async function reprendre(cles: Ecart['cle'][]) {
    const m = sig?.mandant;
    if (!m || !client?.id) return;
    const maj: Record<string, unknown> = {};
    const faits: string[] = [];
    if (cles.includes('nom')) {
      maj.prenom = (m.prenom || '').trim(); maj.nom = (m.nom || '').trim();
      faits.push(`Nom : ${`${client.prenom || ''} ${client.nom || ''}`.trim() || '—'} → ${`${maj.prenom} ${maj.nom}`.trim()}`);
    }
    if (cles.includes('email') && m.email) {
      const avant = liste(client.emails);
      const apres = [m.email.trim(), ...avant.filter(x => net(x) !== net(m.email))];
      const sort = avant.filter(x => !apres.map(net).includes(net(x)));
      maj.emails = apres;
      faits.push(`E-mail : ${apres.join(', ')}${sort.length ? ` (retiré : ${sort.join(', ')})` : ''}`);
    }
    if (cles.includes('telephone') && m.telephone) {
      const avant = liste(client.telephones);
      const apres = [String(m.telephone).trim(), ...avant.filter(x => tel(x) !== tel(m.telephone))];
      const sort = avant.filter(x => !apres.map(tel).includes(tel(x)));
      maj.telephones = apres;
      faits.push(`Téléphone : ${apres.join(', ')}${sort.length ? ` (retiré : ${sort.join(', ')})` : ''}`);
    }
    if (cles.includes('adresse') && m.adresse?.trim()) {
      maj.adresse = m.adresse.trim();
      faits.push(`Adresse : ${maj.adresse}`);
    }
    if (!faits.length) return;
    if (!confirm(`Mettre à jour la fiche d’après le mandat ?\n\n${faits.join('\n')}`)) return;
    setTravail('reprendre'); setMsg(null);
    const { data, error } = await supabase.from('clients').update(maj).eq('id', client.id).select().single();
    setTravail('');
    if (error || !data) { setMsg({ t: 'La fiche n’a pas pu être mise à jour : ' + (error?.message || 'aucune ligne modifiée'), ok: false }); return; }
    onClient?.(data);
    await addJournal(client.id, 'mandat', '✏️ Fiche mise à jour d’après le mandat', faits.join('\n'), undefined, { rechercheId: recherche.id });
    setMsg({ t: 'Fiche mise à jour.', ok: true });
  }

  /* ── Proposer le mandat au client ── */
  async function proposer() {
    /* Pas de second mandat (V3.32) : relu au moment du clic. */
    try {
      const x = await mandatRechercheEnCours(recherche.id);
      if (x?.cle?.startsWith('d-')) { setDocMandat(x); setMsg({ t: `${phraseMandat(x)} Il signe celui-là : pour lui proposer celui de l’espace à la place, annule d’abord l’autre dans Documents.`, ok: false }); return; }
    } catch (e) { setMsg({ t: (e as Error).message, ok: false }); return; }
    /* Le registre démarré : on garde un numéro d'avant lui, ou celui d'une
       signature commencée ; sinon, il donnera le suivant. */
    const n = registre ? (registre.numero === 'ancien' || registre.numero === 'ouvert' ? (recherche?.mandat_numero || '').trim() : '') : numero.trim();
    if (!n && !registre) { setMsg({ t: 'Colle d’abord le numéro réservé dans le registre des mandats, ou prends le suivant de ta réserve.', ok: false }); return; }
    if (!honoOk) {
      setMsg({ t: mode === 'forfait'
        ? `Le forfait ne peut pas dépasser ton barème (${ecrireTaux(BAREME)} % du montant maximum).`
        : `Le taux doit être compris entre 0 et ${ecrireTaux(BAREME)} % : ton barème est un maximum.`, ok: false }); return;
    }
    /* Les colonnes du taux et du forfait viennent d'un SQL à lancer une
       fois. Sans elles, on ne peut proposer que le barème. */
    const a = (c: string) => !!recherche && Object.prototype.hasOwnProperty.call(recherche, c);
    const colonne = a('mandat_taux'), colonneF = a('mandat_forfait');
    if ((mode === 'forfait' && !colonneF) || (mode === 'taux' && !colonne && tauxN !== HONORAIRES_TAUX)) {
      setMsg({ t: 'Pour proposer un autre taux ou un forfait, lance d’abord le fichier SQL « mandat-taux.sql » dans Supabase.', ok: false }); return;
    }
    setTravail('proposer'); setMsg(null);
    const le = new Date().toISOString();
    const { data, error } = await supabase.from('recherches')
      .update({
        mandat_numero: n || null, mandat_type: 'simple', mandat_propose_le: le, updated_at: le,
        ...(colonne ? { mandat_taux: mode === 'taux' ? tauxN : null } : {}),
        ...(colonneF ? { mandat_forfait: mode === 'forfait' ? forfaitN : null } : {}),
      })
      .eq('id', recherche.id).select().single();
    if (error) { setTravail(''); setMsg({ t: 'Le mandat n’a pas pu être proposé : ' + error.message, ok: false }); return; }
    /* Un numéro pris dans la réserve en sort : il ne servira jamais deux fois. */
    const liste = numeros(reserve);
    let avertir = '';
    if (n && liste.includes(n)) {
      const reste = liste.filter(x => x !== n);
      const { error: eR } = await supabase.from('parametres')
        .upsert([{ cle: CLE_RESERVE, valeur: reste.join(', '), updated_at: le }], { onConflict: 'cle' });
      if (eR) avertir = ` ⚠️ Le n° ${n} n’a pas pu être retiré de ta réserve (${eR.message}) : retire-le à la main.`;
      else setReserve(reste.join(', '));
    }
    setTravail('');
    onMaj(data);
    await addJournal(client.id, 'mandat', n ? `📋 Mandat proposé à la signature (n° ${n})` : '📋 Mandat proposé à la signature (numéro donné par le registre à sa signature)', `Mandat de recherche simple · honoraires ${honorairesCourt(honoChoisi)} · le client le voit dans son espace`, undefined, { rechercheId: recherche.id });
    setMsg({ t: `C’est prêt : ${client.prenom || 'le client'} voit « Votre mandat est prêt » dans son espace (honoraires : ${honorairesCourt(honoChoisi)}). Envoie-lui le mail pour qu’il le sache.${avertir}`, ok: !avertir });
  }

  /* Le mail « Votre mandat de recherche est prêt », avec le lien direct. */
  async function envoyerMail() {
    const emails: string[] = Array.isArray(client?.emails) ? client.emails.filter((e: string) => e && e.includes('@')) : [];
    if (!emails.length) { setMsg({ t: 'Ce client n’a pas d’adresse e-mail dans sa fiche.', ok: false }); return; }
    if (!confirm(`Envoyer le mandat à signer à ${emails.join(', ')} ?\n\nHonoraires : ${honorairesCourt(honoEnregistre)}`)) return;
    setTravail('mail'); setMsg(null);
    try {
      const r = await fetch('/api/send-mail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'mandat', client_ids: [client.id], recherche_id: recherche.id, objet: 'Votre mandat de recherche est prêt', corps: '' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.error || j?.results?.[0]?.error || `erreur ${r.status}`);
      setMsg({ t: `Mail envoyé à ${emails.join(', ')}.`, ok: true });
      if (j.avertissements?.length) signalerEchec('Le mail est parti, mais son suivi', j.avertissements.join(' ; '));
    } catch (e) {
      setMsg({ t: 'Le mail n’est pas parti : ' + (e as Error).message, ok: false });
    }
    setTravail('');
  }

  /* L'aperçu : le PDF exact que le client signera, au taux saisi, avec le
     filigrane « PROJET · NON SIGNÉ ». Fabriqué ici, dans le navigateur. */
  async function apercu() {
    if (!honoOk) { setMsg({ t: 'Corrige d’abord les honoraires.', ok: false }); return; }
    const w = window.open('', '_blank');
    setTravail('apercu');
    try {
      const { pdfMandat } = await import('@/lib/mandat-pdf');
      /* L'identité de l'agence du jour (Paramètres › Agence) : celle que le
         client lira et signera. */
      const { data: pa, error: ePa } = await supabase.from('parametres').select('valeur').eq('cle', CLE_IDENTITE).maybeSingle();
      if (ePa) throw new Error(ePa.message);
      const identite = lireIdentite(pa?.valeur ?? null);
      const r = rechercheDepuis({ ...recherche, mandat_taux: mode === 'taux' ? tauxN : null, mandat_forfait: mode === 'forfait' ? forfaitN : null });
      const nom = `${client?.prenom || ''} ${client?.nom || ''}`.trim();
      const parties = redigerMandat({ numero: numero.trim() || '…', mandant: null, recherche: r, executionImmediate: null }, identite);
      const octets = await pdfMandat(parties, { numero: numero.trim() || '…', mandantNom: nom, resume: resumeMandat(r), sig: null, projet: true, identite });
      const url = URL.createObjectURL(new Blob([octets as BlobPart], { type: 'application/pdf' }));
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e) {
      w?.close();
      setMsg({ t: 'L’aperçu n’a pas pu être fabriqué : ' + (e as Error).message, ok: false });
    }
    setTravail('');
  }

  /* V3.55 : s'il avait déjà commencé à signer dans son espace (sa ligne « en
     cours », un code demandé), cette signature se ferme aussi : sans ça, il
     pouvait encore redemander un code et signer le mandat retiré. Le statut
     « abandonne » est prévu pour ça (outils/sql/signature-plusieurs.sql) ;
     l'espace ne reprend qu'une ligne « en_cours ».

     V3.64 : plus de fenêtre grise du navigateur. Le clic lit d'abord ce que
     le client a pu voir de la proposition (`demanderRetrait`), puis la
     fenêtre qui explique s'ouvre (FenetreConfirmer) : ce qui va se passer, la
     case « Prévenir … par e-mail », la suite. Une fois la proposition retirée,
     /api/mandat/retrait lui écrit, au nom d'Alexandre. */
  async function demanderRetrait() {
    const commence = sig?.statut === 'en_cours' ? sig : null;
    /* V3.56 : le mandat type approuvé (avec le registre, ou des numéros
       d'avance), son espace continue de lui proposer de signer seul : la
       fenêtre le dit, au lieu de « il ne pourra plus le signer » (voir
       signeSansNumero, src/lib/mandat-serveur.ts). */
    const seulEncore = !!approuveLe && (!!registre || numeros(reserve).length > 0);
    const emails: string[] = [];
    const ajouter = (e: unknown) => {
      const x = String(e || '').trim();
      if (x.includes('@') && !emails.some(y => y.toLowerCase() === x.toLowerCase())) emails.push(x);
    };
    (Array.isArray(client?.emails) ? client.emails : []).forEach(ajouter);
    if (commence) ajouter(commence.mandant?.email);
    /* A-t-il vu la proposition ? Relu au clic : le mail « Votre mandat est
       prêt », un rappel automatique, son espace ouvert depuis. Une lecture
       qui échoue compte comme « peut-être » : on préfère le prévenir. */
    const proposeLe = String(recherche?.mandat_propose_le || '');
    const t0 = Date.parse(proposeLe);
    const depuis = (v: unknown) => typeof v === 'string' && Number.isFinite(t0) && Date.parse(v) >= t0;
    let informe: string | null = null;
    if (commence) informe = `${client.prenom || 'Le client'} avait commencé à le signer${commence.code_envoye_le ? ` (code demandé le ${quand(commence.code_envoye_le)})` : ''}.`;
    else {
      setTravail('retirer');
      const [rr, ev, ra] = await Promise.all([
        supabase.from('recherches').select('espace_ouvert_le').eq('id', recherche.id).maybeSingle(),
        supabase.from('envois').select('created_at').eq('recherche_id', recherche.id).like('corps', 'Mandat de recherche prêt à signer%').order('created_at', { ascending: false }).limit(1),
        supabase.from('journal').select('created_at').eq('client_id', client.id).eq('type', 'mandat').eq('metadata->>rappelMandat', proposeLe).limit(1),
      ]);
      setTravail('');
      const mail = ev.data?.[0]?.created_at, ouvert = (rr.data as { espace_ouvert_le?: string | null } | null)?.espace_ouvert_le;
      if (depuis(mail)) informe = `${client.prenom || 'Le client'} a reçu le mail « Votre mandat est prêt » le ${quand(mail)}.`;
      else if (ra.data?.length) informe = `${client.prenom || 'Le client'} a reçu un rappel automatique pour le signer.`;
      else if (depuis(ouvert)) informe = `${client.prenom || 'Le client'} a ouvert son espace depuis, le ${quand(ouvert!)}.`;
      else if (rr.error || ev.error || ra.error) informe = 'Il a pu voir la proposition dans son espace.';
    }
    setMsg(null);
    setFenRetrait({
      commence, seulEncore, emails, informe,
      duRegistre: !!registre && registre.numero === 'ouvert',
      immoFacile: !registre || registre.numero === 'ancien',
      numero: String(recherche?.mandat_numero || '').trim(),
    });
  }

  async function retirer(f: Retrait, prevenir: boolean) {
    const { commence, duRegistre } = f;
    setTravail('retirer'); setMsg(null);
    const fin = (m: { t: string; ok: boolean }) => { setTravail(''); setFenRetrait(null); setMsg(m); };
    const le = new Date().toISOString();
    if (commence) {
      /* V3.56 : le déroulé relu juste avant d'écrire (celui de la page date
         de son ouverture : un code demandé entre-temps y manquerait). */
      const { data: lu, error: eL } = await supabase.from('mandats_signatures').select('statut, deroule').eq('id', commence.id).maybeSingle();
      if (eL) { fin({ t: 'La signature commencée dans son espace n’a pas pu être relue, la proposition n’est pas retirée : ' + eL.message, ok: false }); return; }
      const deroule = Array.isArray((lu as { deroule?: unknown } | null)?.deroule) ? (lu as { deroule: { t: string; x: string }[] }).deroule : (commence.deroule || []);
      const { data: ferme, error: eF } = await supabase.from('mandats_signatures')
        .update({ statut: 'abandonne', code_hash: null, deroule: [...deroule, { t: le, x: 'Proposition retirée par l’agence avant la signature' }] })
        .eq('id', commence.id).eq('statut', 'en_cours').select('id');
      if (eF) { fin({ t: 'La signature commencée dans son espace n’a pas pu être arrêtée, la proposition n’est pas retirée : ' + eF.message, ok: false }); return; }
      /* Rien de fermé : il a signé entre-temps. On ne retire rien. */
      if (!ferme?.length) { fin({ t: 'Il vient de signer ou d’avancer dans son espace : la proposition n’est pas retirée. Recharge la fiche.', ok: false }); await charger(); return; }
    }
    const { data, error } = await supabase.from('recherches')
      .update({ mandat_numero: null, mandat_propose_le: null, updated_at: le })
      .eq('id', recherche.id).select().single();
    if (error) { fin({ t: `Impossible de retirer la proposition : ${error.message}${commence ? ' (sa signature commencée, elle, est bien arrêtée)' : ''}`, ok: false }); await charger(); return; }
    onMaj(data); setNumero('');
    /* Le client prévenu (V3.64) : le serveur écrit, au nom d'Alexandre. */
    let mailOk: string[] = [], mailKo: string[] = [];
    if (prevenir && f.emails.length) {
      try {
        const r = await fetch('/api/mandat/retrait', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rechercheId: recherche.id, ...(commence ? { signatureId: commence.id } : {}) }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) throw new Error(j?.erreur || `erreur ${r.status}`);
        mailOk = j.prevenus || []; mailKo = j.echecs || [];
      } catch (e) { mailKo = [(e as Error).message]; }
    }
    /* Le registre (V3.18) : le numéro pris pour cette signature n'aura pas de suite. */
    let pbReg: string | null = null;
    const n = f.numero;
    if (duRegistre) pbReg = await observer(supabase, { ...(commence ? { signature_id: commence.id } : {}), numeroSinon: n || null, type: 'sans_suite', texte: `Proposition retirée par l’agence le ${quand(le)}, avant la signature.` });
    const lignes = [
      commence ? 'Sa signature commencée dans son espace est arrêtée.' : '',
      mailOk.length ? `Prévenu par e-mail : ${mailOk.join(', ')}` : '',
      mailKo.length ? `⚠️ E-mail pas parti : ${mailKo.join(' ; ')}` : '',
      !f.emails.length ? 'Pas d’adresse e-mail sur sa fiche : à prévenir par téléphone.' : !prevenir ? 'Pas prévenu par e-mail (case décochée).' : '',
    ].filter(Boolean);
    await addJournal(client.id, 'mandat', '📋 Proposition de mandat retirée', lignes.join('\n') || undefined, undefined, { rechercheId: recherche.id });
    await charger();
    const P = client.prenom || 'le client';
    const quoiMail = mailKo.length
      ? ` ⚠️ Mais le mail n’est pas parti (${mailKo.join(' ; ')}) : préviens ${P} toi-même.`
      : mailOk.length ? ` Un e-mail est parti à ${mailOk.join(', ')}.`
      : !f.emails.length ? ` Pas d’adresse e-mail sur sa fiche : préviens ${P} par téléphone.`
      : ` Aucun e-mail n’est parti : à toi de prévenir ${P}.`;
    fin(pbReg
      ? { t: `Proposition retirée.${quoiMail} ${pbReg} Marque-le « sans suite » dans Documents › Registre des mandats.`, ok: false }
      : { t: `Proposition retirée.${quoiMail}`, ok: !mailKo.length });
  }

  /* Un numéro noté sur la recherche avant le démarrage du registre (réservé
     dans ImmoFacile) reste le sien ; on peut le laisser pour prendre, à la
     signature, le prochain numéro du registre. */
  async function prendreDuRegistre() {
    const n = recherche?.mandat_numero;
    if (!n || !confirm(`Laisser le n° ${n} et prendre le prochain numéro du registre ?\n\nLe n° ${n} ne servira plus : pense à le marquer « sans suite » dans le registre où il a été réservé.`)) return;
    setTravail('registre');
    const { data, error } = await supabase.from('recherches')
      .update({ mandat_numero: null, updated_at: new Date().toISOString() })
      .eq('id', recherche.id).select().single();
    setTravail('');
    if (error || !data) { signalerEchec('Le numéro du mandat', error?.message || 'aucune ligne modifiée'); return; }
    onMaj(data);
    await addJournal(client.id, 'mandat', `📋 N° ${n} laissé : le numéro sera pris dans le registre des mandats`, undefined, undefined, { rechercheId: recherche.id });
    setMsg({ t: `Le n° ${n} est laissé : le registre donnera le numéro quand ${client.prenom || 'le client'} demandera son code.`, ok: true });
  }

  async function copier() {
    try { await navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 1800); }
    catch { window.prompt('Copie ce lien :', lien); }
  }

  /* Où le mandat noté sur la recherche a été signé (V3.55). */
  const modeDoc = docSigne?.signature?.mode;
  const ouSigne = !docSigne ? 'hors du CRM'
    : modeDoc === 'en_ligne' ? 'en ligne (Documents)'
    : modeDoc === 'sur_place' ? 'sur place (Documents)'
    : 'sur papier (Documents)';
  async function voirExemplaire() {
    if (!docSigne?.signe_chemin) return;
    const w = window.open('', '_blank');
    setTravail('exemplaire');
    try {
      const url = await lienFichier(docSigne.signe_chemin, nomFichier(docSigne, docSigne.signature ? '-signe' : ''));
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e) {
      w?.close();
      setMsg({ t: 'Le mandat signé n’a pas pu être ouvert : ' + (e as Error).message, ok: false });
    }
    setTravail('');
  }

  async function voirPdf() {
    if (!sig?.pdf_chemin) return;
    const w = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('mandats').createSignedUrl(sig.pdf_chemin, 300);
    if (error || !data?.signedUrl) { w?.close(); setMsg({ t: 'Le PDF n’a pas pu être ouvert : ' + (error?.message || 'lien indisponible'), ok: false }); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  }

  /* ── La réserve de numéros et l'approbation du mandat type ── */
  async function enregistrerReserve() {
    setTravail('reserve'); setMsg(null);
    const liste = numeros(reserve);
    const maintenant = new Date().toISOString();
    const nouvelleApprobation = approuve ? (approuveLe || maintenant) : '';
    const { error } = await supabase.from('parametres').upsert([
      { cle: CLE_RESERVE, valeur: liste.join(', '), updated_at: maintenant },
      { cle: CLE_APPROBATION, valeur: nouvelleApprobation, updated_at: maintenant },
    ], { onConflict: 'cle' });
    setTravail('');
    if (error) { setMsg({ t: 'La réserve n’a pas pu être enregistrée : ' + error.message, ok: false }); return; }
    setApprouveLe(nouvelleApprobation || null);
    setReserve(liste.join(', '));
    setMsg({ t: approuve
      ? (registre ? 'Enregistré : les clients peuvent signer seuls, le registre donne les numéros.' : `Réserve enregistrée : ${liste.length} numéro${liste.length > 1 ? 's' : ''} d’avance.`)
      : 'Enregistré, mais sans ton approbation du mandat type : les clients ne pourront pas signer seuls.', ok: approuve });
  }

  /* ── Mettre fin au mandat signé en ligne (22 octobre 2026) ──
     Alexandre : « si le mandat est signé et qu'il veut changer lui-même les
     honoraires, dire que ce n'est pas possible : soit annuler le mandat, ce
     qui forcera à en renvoyer un nouveau, soit un avenant ». La ligne de
     signature passe « termine » (comme « abandonne », sans contrainte en
     base : l'espace ne reprend qu'une ligne en cours, signée ou partielle),
     le bloc Mandat de la recherche se vide, le registre note la fin. Le PDF
     signé reste dans Documents. Un nouveau mandat prendra un nouveau numéro. */
  async function terminer() {
    if (!sig || !recherche?.id) return;
    setTravail('fin'); setMsg(null);
    const fin = (m: { t: string; ok: boolean }) => { setTravail(''); setFenFin(false); setChangerHono(false); setMsg(m); };
    const le = new Date().toISOString();
    const { data: lu, error: eL } = await supabase.from('mandats_signatures').select('statut, deroule').eq('id', sig.id).maybeSingle();
    if (eL || !lu) { fin({ t: 'Le mandat n’a pas pu être relu, rien n’a changé : ' + (eL?.message || 'introuvable'), ok: false }); return; }
    const deroule = Array.isArray((lu as { deroule?: unknown }).deroule) ? (lu as { deroule: { t: string; x: string }[] }).deroule : (sig.deroule || []);
    const { data: ferme, error: eF } = await supabase.from('mandats_signatures')
      .update({ statut: 'termine', deroule: [...deroule, { t: le, x: 'Fin du mandat d’un commun accord, notée par l’agence' }] })
      .eq('id', sig.id).in('statut', ['signe', 'partiel']).select('id');
    if (eF) { fin({ t: 'Le mandat n’a pas pu être terminé : ' + eF.message, ok: false }); return; }
    if (!ferme?.length) { fin({ t: 'Le mandat a changé entre-temps (rétracté, ou déjà terminé) : rien n’a été fait. Recharge la fiche.', ok: false }); await charger(); return; }
    const { data, error } = await supabase.from('recherches').update({
      mandat_date_signature: null, mandat_duree: null, mandat_honoraires: null, mandat_date_expiration: null,
      sans_mandat: true, mandat_numero: null, mandat_propose_le: null, updated_at: le,
    }).eq('id', recherche.id).select().single();
    if (error) { fin({ t: `Le mandat est terminé, mais le bloc Mandat de sa recherche n’a pas pu être vidé (${error.message}) : clique « Supprimer le mandat », en bas de cette fenêtre.`, ok: false }); await charger(); return; }
    onMaj(data); setNumero('');
    const n = sig.numero;
    await addJournal(client.id, 'mandat', `🏁 Fin du mandat de recherche n° ${n}`,
      `Terminé d’un commun accord, noté le ${quand(le)}${honoSigne ? ` · honoraires signés : ${honoSigne}` : ''}. Un nouveau mandat peut lui être proposé.`,
      { signature_id: sig.id, numero: n }, { rechercheId: recherche.id });
    const pbReg = await observer(supabase, { signature_id: sig.id, numeroSinon: n || null, type: 'fin', texte: `Fin du mandat d’un commun accord, notée dans le CRM le ${quand(le)}.` });
    await charger();
    fin({
      t: `Mandat n° ${n} terminé. ${pbReg ? `Le registre des mandats n’a pas pu le noter (${pbReg}) : note-le à la main. ` : 'C’est noté dans le registre des mandats. '}Choisis maintenant ses nouveaux honoraires ci-dessous, puis « Proposer au client » : il aura un nouveau mandat à signer, avec un nouveau numéro.`,
      ok: !pbReg,
    });
  }

  async function deposerSignature(f: File | undefined) {
    if (!f) return;
    if (f.type !== 'image/png') { setMsg({ t: 'La signature doit être une image PNG (fond transparent).', ok: false }); return; }
    setTravail('signature');
    const { error } = await supabase.storage.from('mandats').upload(SIGNATURE, f, { upsert: true, contentType: 'image/png' });
    setTravail('');
    if (error) { setMsg({ t: 'La signature n’a pas pu être déposée : ' + error.message, ok: false }); return; }
    setASignature(true);
    setMsg({ t: 'Signature déposée : elle apparaîtra sur les prochains mandats signés.', ok: true });
  }

  const reste = numeros(reserve).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1 — L'état de la signature en ligne */}
      {signeEnLigne && sig && !attendus.length && (
        <div style={boite('#f0fdf4', '#bbf7d0', '#166534')}>
          <b>{`✍️ Signé en ligne par ${[nomP, ...cos.filter(c => c.statut === 'signe').map(nomCo)].join(' et ')}`}</b>
          <div>{`N° ${sig.numero} · le ${sig.signe_le ? quand(sig.signe_le) : '—'}`}</div>
          <div style={{ color: '#15803d' }}>{sig.execution_immediate ? 'Il a demandé que la recherche commence tout de suite.' : 'Il préfère attendre la fin de ses 14 jours de rétractation.'}</div>
          {cos.filter(c => c.statut !== 'signe').map(c => (
            <div key={c.id} style={{ color: '#15803d', marginTop: 4 }}>{c.statut === 'decline'
              ? `🙅 ${nomCo(c)} a indiqué ne pas être concerné${c.personne?.civilite === 'Madame' ? 'e' : ''}${c.decline_le ? ` (le ${quand(c.decline_le)})` : ''} : le mandat continue sans ${c.personne?.civilite === 'Madame' ? 'elle' : 'lui'}.`
              : c.statut === 'retracte' ? `↩️ ${nomCo(c)} a renoncé au mandat${c.retracte_le ? ` le ${quand(c.retracte_le)}` : ''}.`
              : `🔒 Invitation de ${nomCo(c)} close : le mandat continue sans sa signature.`}</div>
          ))}
          {sig.societe && <div style={{ marginTop: 6 }}>{`🏢 Pour la société ${sig.societe.denomination} (${sig.societe.forme}, SIREN ${sig.societe.siren}, RCS ${sig.societe.rcsVille}) · ${sig.societe.qualite.toLowerCase()}`}</div>}
          {lignesAvenants(sig.numero).map(l => <div key={l} style={{ marginTop: 4 }}>{l}</div>)}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" style={btn} onClick={voirPdf}>📄 Voir le mandat signé</button>
            {sig.kbis_chemin && <button type="button" style={btn} onClick={voirKbis}>📎 Voir le Kbis</button>}
            {onAvenant && !sig.retracte_le && <button type="button" style={btn} onClick={onAvenant}>{avenantEnCours ? '📝 Ouvrir l’avenant en cours' : '📝 Préparer un avenant'}</button>}
          </div>
        </div>
      )}
      {sig?.statut === 'partiel' && attendus.length > 0 && (
        <div style={boite('#fffbeb', '#fde68a', '#92400e')}>
          <b>{`⏳ Signé par ${nomP} · en attente de ${attendus.map(nomCo).join(' et ')}`}</b>
          <div>{`N° ${sig.numero} · ${sig.mandant?.prenom || 'il'} a signé le ${sig.signe_le ? quand(sig.signe_le) : '—'}${sig.execution_immediate ? ' et a demandé que la recherche commence tout de suite' : ' et préfère attendre la fin des 14 jours'}. Le mandat l’engage déjà.`}</div>
          {cos.map(c => {
            const expire = !!c.lien_expire_le && Date.parse(c.lien_expire_le) < Date.now();
            const occupe = travail.startsWith('co-') && travail.endsWith(c.id);
            return (
              <div key={c.id} style={{ borderTop: '1px solid #fde68a', marginTop: 9, paddingTop: 8 }}>
                <div style={{ fontWeight: 700, color: 'var(--emilio)' }}>{`${nomCo(c)} · ${c.personne?.email || ''}`}</div>
                {c.statut === 'invite' ? (
                  <>
                    <div>{`Lien envoyé le ${c.invite_le ? quand(c.invite_le) : '—'} · ${c.ouvert_le ? `ouvert le ${quand(c.ouvert_le)}` : 'pas encore ouvert'} · pas encore signé.`}</div>
                    <div style={{ color: expire ? '#b91c1c' : '#a16207', fontSize: 12.5, marginTop: 2 }}>{expire
                      ? `Lien expiré le ${quand(c.lien_expire_le!)} sans signature : envoie-lui un lien neuf, ou clos l’invitation.`
                      : `${c.relances ? `${c.relances} rappel${c.relances > 1 ? 's' : ''} parti${c.relances > 1 ? 's' : ''}` : 'Rappels automatiques à 2 et 7 jours'} · lien valable jusqu’au ${c.lien_expire_le ? quand(c.lien_expire_le) : '—'}.`}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <button type="button" style={btn} disabled={occupe} onClick={() => gesteCo(expire ? 'relancer' : 'renvoyer', c)}>{expire ? '✉️ Envoyer un lien neuf' : `✉️ Renvoyer le lien à ${c.personne?.prenom || ''}`}</button>
                      {!expire && <button type="button" style={btn} onClick={() => copierLienCo(c)}>🔗 Copier son lien</button>}
                      <button type="button" style={{ ...btn, color: '#b91c1c' }} disabled={occupe} onClick={() => gesteCo('clore', c)}>Clore l’invitation</button>
                    </div>
                  </>
                ) : (
                  <div>{c.statut === 'signe' ? `✓ A signé le ${c.signe_le ? quand(c.signe_le) : '—'}.`
                    : c.statut === 'decline' ? '🙅 A indiqué ne pas être concerné par cette recherche.'
                    : c.statut === 'retracte' ? '↩️ A renoncé au mandat.' : '🔒 Invitation close.'}</div>
                )}
              </div>
            );
          })}
          <button type="button" style={{ ...btn, marginTop: 10 }} onClick={voirPdf}>📄 Voir le mandat (tel qu’il est signé aujourd’hui)</button>
        </div>
      )}
      {cos.length > 0 && client?.couple && (
        <div style={boite('#eff6ff', '#bfdbfe', '#1e3a8a')}>
          <b>👥 Fiche à deux personnes</b>
          <div>{`${sig?.mandant?.prenom || 'Le client'} a indiqué ${cos.map(nomCo).join(' et ')} en signant son mandat${sig?.signe_le ? `, le ${quand(sig.signe_le)}` : ''}.`}</div>
        </div>
      )}
      {depasse.length > 0 && (
        <div style={boite('#fff7ed', '#fed7aa', '#7c2d12')}>
          <b>⚠️ Sa recherche dépasse son mandat signé</b>
          {depasse.map(e => <div key={e} style={{ marginTop: 4 }}>{`· ${e}`}</div>)}
          <div style={{ fontSize: 12.5, color: '#9a3412', marginTop: 6 }}>{'Une affaire hors de ces limites sortirait du mandat. Appelle-le : s’il vise vraiment plus haut ou ailleurs, prépare-lui un avenant. Ce qui a changé y est déjà coché.'}</div>
          {onAvenant && <button type="button" style={{ ...btnOr, marginTop: 10 }} onClick={onAvenant}>{avenantEnCours ? '📝 Ouvrir l’avenant en cours' : '📝 Préparer l’avenant'}</button>}
        </div>
      )}
      {valide && !signeEnLigne && (
        <div style={boite('#f8fafc', '#e2e8f0', 'var(--emilio)')}>
          {/* V3.55 : où il a été signé. Un mandat de Documents signé en ligne
              s'affichait « hors ligne ». */}
          <b>{`📋 Mandat signé${recherche?.mandat_numero ? ` n° ${recherche.mandat_numero}` : ''}, ${ouSigne}`}</b>
          <div>{`Signé le ${jourCourt(recherche.mandat_date_signature)}${recherche?.mandat_date_expiration ? `, valable jusqu’au ${jourCourt(recherche.mandat_date_expiration)}` : ''}.`}</div>
          {lignesAvenants(recherche?.mandat_numero).map(l => <div key={l} style={{ marginTop: 4 }}>{l}</div>)}
          {/* V3.55 : signé sur papier, son exemplaire pas encore déposé. */}
          {docSigne && exemplaireManquant(docSigne) && (
            <div style={{ ...boite('#fffbeb', '#fde68a', '#92400e'), marginTop: 10, padding: '9px 12px' }}>{rappelExemplaire(docSigne)}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {docSigne?.signe_chemin && <button type="button" style={btn} disabled={travail === 'exemplaire'} onClick={voirExemplaire}>{travail === 'exemplaire' ? 'Ouverture…' : '📄 Voir le mandat signé'}</button>}
            {docSigne && exemplaireManquant(docSigne) && <button type="button" style={btnOr} onClick={() => setDepot(true)}>📎 Déposer l’exemplaire signé</button>}
            {onAvenant && <button type="button" style={btn} onClick={onAvenant}>{avenantEnCours ? '📝 Ouvrir l’avenant en cours' : '📝 Préparer un avenant'}</button>}
          </div>
        </div>
      )}
      {/* Les honoraires d'un mandat signé : ils ne se changent plus ici. */}
      {valide && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <div style={{ ...titreBloc, display: 'flex', alignItems: 'center' }}>
            Honoraires du mandat signé
            <Aide titre="Changer les honoraires d’un mandat signé">
              <span>{'Un mandat signé engage le client et l’agence tel qu’il a été signé. Changer le taux sur la fiche ne changerait rien à ce qu’il a signé : c’est pour ça que les honoraires sont fermés ici.'}</span>
              <span><b>{'Un avenant (conseillé). '}</b>{'Il reprend son identité, sa société, sa recherche et le numéro du mandat. Tu indiques les nouveaux honoraires, il signe l’avenant, et le mandat continue avec eux.'}</span>
              <span><b>{'Mettre fin au mandat. '}</b>{'Le mandat s’arrête d’un commun accord (noté dans le registre). Tu choisis ensuite les nouveaux honoraires et tu lui proposes un nouveau mandat, avec un nouveau numéro, qu’il signe de nouveau.'}</span>
            </Aide>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--emilio)', flex: '1 1 160px', minWidth: 0 }}>{honoSigne || 'Non précisés sur la fiche'}</span>
            <button type="button" style={btn} aria-expanded={changerHono} onClick={() => setChangerHono(v => !v)}>{changerHono ? 'Fermer' : '✏️ Changer les honoraires'}</button>
          </div>
          {changerHono && (
            <div style={{ ...boite('#fff7ed', '#fed7aa', '#7c2d12'), marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <b>{`🔒 Pas possible ici : le mandat${recherche?.mandat_numero ? ` n° ${recherche.mandat_numero}` : ''} est signé`}</b>
                <div style={{ marginTop: 2 }}>{`Il engage ${client?.prenom || 'le client'} et l’agence avec ces honoraires. Pour les changer, deux façons :`}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', color: 'var(--emilio)' }}>
                <b>{'1. Un avenant'}</b><small style={{ color: '#15803d', fontWeight: 800, marginLeft: 6 }}>{'conseillé'}</small>
                <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>{'Il reprend son identité, sa société, sa recherche et le numéro du mandat : tu indiques les nouveaux honoraires, il signe l’avenant (en ligne ou sur place). Le mandat continue.'}</div>
                {onAvenant
                  ? <button type="button" style={{ ...btnOr, marginTop: 8 }} onClick={onAvenant}>{avenantEnCours ? '📝 Ouvrir l’avenant en cours' : '📝 Préparer l’avenant'}</button>
                  : <div style={{ fontSize: 12.5, marginTop: 6 }}>{'Documents › Créer un document › Avenant au mandat de recherche.'}</div>}
              </div>
              <div style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', color: 'var(--emilio)' }}>
                <b>{'2. Mettre fin au mandat, puis en signer un nouveau'}</b>
                <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>{'Le mandat s’arrête d’un commun accord, c’est noté dans le registre. Tu choisis ensuite les nouveaux honoraires et tu lui proposes un nouveau mandat, qu’il signe de nouveau. Préviens-le avant.'}</div>
                {sourceSigne === 'ligne' && (attendus.length
                  ? <div style={{ fontSize: 12.5, marginTop: 6 }}>{`Pas tant que ${attendus.map(nomCo).join(' et ')} n’a pas signé ou que son invitation n’est pas close (plus haut).`}</div>
                  : <button type="button" style={{ ...btn, marginTop: 8, color: '#b91c1c', borderColor: '#fecaca' }} disabled={travail === 'fin'} onClick={() => setFenFin(true)}>{'Mettre fin au mandat…'}</button>)}
                {sourceSigne === 'document' && docSigne && (
                  <>
                    <div style={{ fontSize: 12.5, marginTop: 6 }}>{'Il a été signé dans Documents : ouvre-le, puis « Marquer annulé » › « Fin du mandat ».'}</div>
                    {onOuvrirDocument && <button type="button" style={{ ...btn, marginTop: 8 }} onClick={() => onOuvrirDocument(docSigne.id)}>{'📄 Ouvrir le mandat dans Documents'}</button>}
                  </>
                )}
                {sourceSigne === 'saisie' && <div style={{ fontSize: 12.5, marginTop: 6 }}>{'Il a été noté à la main : « Supprimer le mandat », en bas de cette fenêtre, le retire de la fiche.'}</div>}
              </div>
              {sourceSigne === 'saisie' && onCorrigerSaisie && (
                <button type="button" onClick={() => { setChangerHono(false); onCorrigerSaisie(); }}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: '#c2621c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit' }}>
                  {'Une faute de frappe dans ce que tu as noté ? Corriger la saisie'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {fenFin && sig && (
        <FenetreConfirmer ic="croix" ton="danger" titre={`Mettre fin au mandat n°\u00a0${sig.numero}\u00a0?`} bouton="Mettre fin au mandat"
          intro={`Mandat de recherche signé en ligne${sig.signe_le ? ` le ${quand(sig.signe_le)}` : ''}${honoSigne ? ` · ${honoSigne}` : ''}`}
          points={[
            { ic: 'croix', ton: 'alerte', t: `Le mandat s’arrête aujourd’hui, d’un commun accord : ces honoraires n’engagent plus ${client?.prenom || 'le client'}.` },
            { ic: 'doc', t: 'C’est noté dans le registre des mandats (« Fin du mandat »). Le mandat signé reste dans Documents.' },
            { ic: 'mail', ton: 'alerte', t: `Aucun e-mail ne part : préviens ${client?.prenom || 'le client'} toi-même avant.` },
            { ic: 'check', t: 'Le reste ne bouge pas : sa recherche, ses locaux et ses visites continuent.' },
          ]}
          ensuite={[
            { ic: 'euro', t: 'Choisis les nouveaux honoraires dans « Faire signer le mandat », qui revient ici.' },
            { ic: 'mail', t: '« Proposer au client », puis « Envoyer par e-mail » : il signe le nouveau mandat, avec un nouveau numéro.' },
          ]}
          conseil="Tu veux seulement changer les honoraires et garder le mandat ? Un avenant suffit : rien ne s’arrête."
          onFermer={() => setFenFin(false)} onConfirmer={() => terminer()} />
      )}
      {depot && docSigne && typeof document !== 'undefined' && createPortal(
        <FenetreSigne doc={docSigne} onFermer={() => setDepot(false)} onFait={r => { setDepot(false); setDocSigne(r); setMsg({ t: 'Exemplaire signé déposé : il le retrouve dans son espace.', ok: true }); }} />,
        document.body)}
      {/* V3.64 : « Retirer la proposition », la fenêtre qui explique. */}
      {fenRetrait && (() => {
        const f = fenRetrait;
        const P = client.prenom || 'Le client', p = client.prenom || 'le client';
        const n = f.numero;
        const points = (coche: boolean): PointConfirmer[] => [
          { ic: 'croix', t: `${P} ne voit plus « Votre mandat est prêt » dans son espace, et les rappels automatiques s’arrêtent.` },
          ...(f.commence ? [{ ic: 'pause', ton: 'alerte' as const, t: `${P} avait commencé à le signer : cette signature s’arrête, son code ne fonctionne plus.` }] : []),
          ...(f.seulEncore ? [{ ic: 'info', t: `Ton mandat type est approuvé : s’il demande une visite, son espace lui proposera quand même de signer un mandat${f.commence ? ' (une signature toute neuve)' : ''}.` }] : []),
          ...(f.duRegistre ? [{ ic: 'doc', t: `Le n° ${n} est noté « sans suite » dans le registre des mandats.` }]
            : n && f.immoFacile ? [{ ic: 'doc', ton: 'alerte' as const, t: `Le n° ${n} est libéré sur cette fiche : pense à le marquer « clos sans suite » dans le registre où il a été réservé.` }] : []),
          f.emails.length
            ? (coche
              ? { ic: 'mail', ton: 'ok' as const, t: `${P} reçoit un e-mail simple, à ton nom : la proposition est retirée, rien à faire de son côté.` }
              : { ic: 'mail', ton: 'alerte' as const, t: `Aucun e-mail ne part : à toi de prévenir ${p}.` })
            : { ic: 'mail', ton: 'alerte' as const, t: `Pas d’adresse e-mail sur sa fiche : préviens ${p} par téléphone.` },
          { ic: 'check', t: 'Le reste ne bouge pas : sa recherche, ses biens et ses visites continuent.' },
        ];
        const raison = f.informe || `Ni mail, ni rappel, et son espace n’a pas été ouvert depuis la proposition : ${p} ne l’a sans doute pas vue. Coche pour lui écrire quand même.`;
        return (
          <FenetreConfirmer ic="croix" ton="danger" titre="Retirer la proposition de mandat ?" bouton="Retirer la proposition"
            intro={`Mandat de recherche${n ? ` n° ${n}` : ''}${recherche?.mandat_propose_le ? ` · proposé le ${quand(recherche.mandat_propose_le)}` : ''}`}
            option={f.emails.length ? { libelle: `Prévenir ${p} par e-mail`, aide: `À : ${f.emails.join(', ')} — ${raison}`, defaut: !!f.informe } : undefined}
            points={points}
            ensuite={[
              { ic: 'euro', t: 'Pour lui proposer un autre mandat : règle les honoraires ici, puis « Proposer au client », et envoie-lui le mail.' },
              { ic: 'doc', t: 'Pour un mandat à signer sur place ou sur papier : prépare-le dans Documents.' },
            ]}
            conseil={f.commence
              ? `${P} est en train de signer : un coup de fil avant de retirer évite la surprise.`
              : 'Tu veux seulement changer les honoraires ? Ne retire pas : modifie-les ici, clique « Mettre à jour », puis renvoie-lui le mail.'}
            onFermer={() => setFenRetrait(null)} onConfirmer={coche => retirer(f, coche)} />
        );
      })()}
      {sig?.statut === 'retracte' && (
        <div style={boite('#fef2f2', '#fecaca', '#991b1b')}>
          <b>{`↩️ Mandat n° ${sig.numero} rétracté`}</b>
          <div>{`Le client a renoncé en ligne le ${sig.retracte_le ? quand(sig.retracte_le) : '—'}. ${registre && Number(sig.numero) >= registre.premier ? 'C’est noté tout seul dans le registre des mandats.' : 'Note-le dans le registre où ce numéro a été réservé.'}`}</div>
          {sig.pdf_chemin && <button type="button" style={{ ...btn, marginTop: 10 }} onClick={voirPdf}>📄 Voir le mandat signé</button>}
        </div>
      )}
      {sig?.statut === 'termine' && (
        <div style={boite('#f8fafc', '#e2e8f0', '#475569')}>
          <b style={{ color: 'var(--emilio)' }}>{`🏁 Mandat n° ${sig.numero} terminé`}</b>
          <div>{`Signé en ligne le ${sig.signe_le ? quand(sig.signe_le) : '—'}, terminé d’un commun accord le ${finSig ? quand(finSig) : '—'}. C’est noté dans le registre des mandats.`}</div>
          {sig.pdf_chemin && <button type="button" style={{ ...btn, marginTop: 10 }} onClick={voirPdf}>📄 Voir le mandat signé</button>}
        </div>
      )}
      {sig?.statut === 'en_cours' && !valide && (
        <div style={boite('#fffbeb', '#fde68a', '#92400e')}>
          <b>{`⏳ Signature en cours · n° ${sig.numero}`}</b>
          <div>{sig.code_envoye_le ? `Code envoyé le ${quand(sig.code_envoye_le)} à ${sig.mandant?.email || 'son adresse'}. Il n’a pas encore signé.` : 'Il a commencé mais n’a pas encore signé.'}</div>
        </div>
      )}

      {/* Ce que le client a saisi autrement que sur la fiche */}
      {ecarts.length > 0 && (
        <div style={{ ...boite('#fff7ed', '#fed7aa', '#7c2d12'), padding: '12px 14px 10px' }}>
          <b>{sig?.statut === 'signe' ? '⚠️ Le mandat signé diffère de ta fiche' : '⚠️ Saisi pour la signature, différent de ta fiche'}</b>
          <div style={{ fontSize: 12.5, color: '#9a3412', marginTop: 2 }}>{'Le client a modifié ses informations avant de signer. À toi de voir : une faute sur la fiche, un associé qui signe, une autre adresse… Si c’est normal, laisse la fiche telle quelle.'}</div>
          {ecarts.map(e => (
            <div key={e.cle} style={{ borderTop: '1px solid #fed7aa', marginTop: 9, paddingTop: 8 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 800, color: '#c2410c' }}>{e.libelle}</div>
              <div style={{ color: 'var(--emilio)', wordBreak: 'break-word' }}>{'Sur le mandat : '}<b>{e.mandat}</b></div>
              <div style={{ color: '#9a3412', wordBreak: 'break-word' }}>{`Sur ta fiche : ${e.fiche}`}</div>
              <button type="button" disabled={travail === 'reprendre'} onClick={() => reprendre([e.cle])}
                style={{ background: 'none', border: 'none', padding: '3px 0 0', color: '#c2621c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit' }}>
                {e.action}
              </button>
            </div>
          ))}
          {ecarts.length > 1 && (
            <button type="button" style={{ ...btn, marginTop: 10 }} disabled={travail === 'reprendre'} onClick={() => reprendre(ecarts.map(e => e.cle))}>
              {travail === 'reprendre' ? '…' : 'Tout reprendre dans la fiche'}
            </button>
          )}
        </div>
      )}

      {/* 2 — Faire signer le mandat */}
      {!valide && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <div style={{ ...titreBloc, display: 'flex', alignItems: 'center' }}>
            Faire signer le mandat
            <Aide titre="Faire signer le mandat, en 3 temps">
              <span>{'1. Choisis les honoraires juste en dessous (2,5 % par défaut).'}</span>
              <span>{'2. « Proposer au client » : le mandat se génère avec ces honoraires et sa recherche, et apparaît aussitôt dans son espace (« Votre mandat est prêt »). « Aperçu » te montre le PDF exact avant.'}</span>
              <span>{'3. « Envoyer par e-mail » lui donne le lien. Il relit, remplit son identité ou celle de sa société, reçoit un code et signe. Tu reçois un mail, le mandat signé arrive ici et dans Documents.'}</span>
              <span>{'Une fois proposé, il doit le signer avant que sa demande de visite parte. Sans proposition, et sans le mandat type coché dans Paramètres › Agence, il peut demander une visite sans signer.'}</span>
            </Aide>
          </div>
          {docMandat && (
            <div style={{ ...boite('#fffbeb', '#fde68a', '#92400e'), marginBottom: 12 }}>
              <b>📄 Un mandat de recherche est déjà en route dans Documents</b>
              <div>{`${phraseMandat(docMandat)} Il signe celui-là : pas de second mandat. Pour lui proposer celui de l’espace à la place, annule d’abord l’autre dans Documents.`}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <span style={{ ...btn, borderColor: '#f08c42', background: '#fdf6f1', cursor: 'default' }}>✓ Simple</span>
            <span style={{ ...btn, color: '#94a3b8', cursor: 'not-allowed' }} title="Bientôt : il faut d’abord reprendre ton modèle exclusif">Exclusif · bientôt</span>
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center' }}>
            Honoraires (HT, à la charge du demandeur)
            <Aide titre="Les honoraires">
              <span>{'Pourcentage : 2,5 % par défaut. Il s’applique au loyer annuel HT HC de la première année pour un bail, ou au prix pour une cession de droit au bail, un fonds ou des murs. Tape un autre taux si besoin.'}</span>
              <span>{'Forfait : un montant fixe en euros HT, quel que soit le loyer ou le prix.'}</span>
              <span>{'Rien n’est dû si le local est proposé par une autre agence qui partage ses honoraires ; sinon, ils sont payés à la signature du bail ou de l’acte, jamais avant.'}</span>
              <span>{'Ce que tu choisis ici passe avant les 2,5 % par défaut, y compris quand il signe seul le mandat type.'}</span>
              <span>{'Déjà proposé ? Change ici, « Mettre à jour », puis renvoie-lui le mail : il relira la nouvelle version avant de signer.'}</span>
              <span>{'Une fois signé, les honoraires ne changent plus que par un avenant (Documents).'}</span>
            </Aide>
          </label>
          <div style={{ display: 'flex', width: 'fit-content', marginTop: 5, border: '1px solid #e2e8f0', borderRadius: 10, padding: 3, gap: 3, background: '#f8fafc' }}>
            {([['taux', 'Pourcentage'], ['forfait', 'Forfait']] as const).map(([m, l]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{ border: 'none', borderRadius: 8, padding: '6px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  background: mode === m ? '#fff' : 'transparent', color: mode === m ? 'var(--emilio)' : '#64748b', boxShadow: mode === m ? '0 1px 3px rgba(15,23,42,.12)' : 'none' }}>
                {l}
              </button>
            ))}
          </div>
          {mode === 'taux' ? (
            <>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 96 }}>
                  <input style={{ ...champ, boxSizing: 'border-box', paddingRight: 26, border: `1px solid ${tauxOk ? '#e2e8f0' : '#fca5a5'}` }} value={taux} inputMode="decimal"
                    onChange={e => setTaux(e.target.value)} aria-label="Taux des honoraires" />
                  <span style={{ position: 'absolute', right: 10, top: 9, color: '#94a3b8', fontWeight: 700 }}>%</span>
                </div>
                {[2.5, 5, 10, 15].map(t => (
                  <button key={t} type="button" onClick={() => setTaux(ecrireTaux(t))}
                    style={{ ...btn, padding: '7px 11px', border: `1px solid ${tauxN === t ? '#f08c42' : '#e2e8f0'}`, background: tauxN === t ? '#fdf6f1' : '#fff' }}>
                    {`${ecrireTaux(t)} %${t === HONORAIRES_TAUX ? ' · par défaut' : ''}`}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: tauxOk ? '#475569' : '#b91c1c', marginTop: 6, lineHeight: 1.5 }}>
                {!tauxOk
                  ? `Entre 0 et ${ecrireTaux(BAREME)} %.`
                  : [
                    `${tauxTexte(tauxN)} du loyer annuel HT HC d’un bail, ou du prix d’une cession ou d’une vente.`,
                    loyerMax ? `Sur son loyer maximum (${euros(loyerMax)} HT HC / an) : ${euros(Math.round((loyerMax * tauxN) / 100))} HT.` : '',
                    pmax && budget ? `Sur son prix maximum (${euros(pmax)} hors honoraires) : ${euros(honorairesPour(pmax, tauxN) || 0)} HT.` : '',
                  ].filter(Boolean).join(' ')}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 150 }}>
                  <input style={{ ...champ, boxSizing: 'border-box', paddingRight: 52, border: `1px solid ${forfaitOk || !forfait.trim() ? '#e2e8f0' : '#fca5a5'}` }} value={forfait} inputMode="numeric"
                    placeholder="ex. 20 000" onChange={e => setForfait(e.target.value)} onBlur={() => setForfait(ecrireEuros(forfaitDe(forfait)))} aria-label="Forfait des honoraires" />
                  <span style={{ position: 'absolute', right: 10, top: 9, color: '#94a3b8', fontWeight: 700 }}>€ HT</span>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: forfaitOk || !forfait.trim() ? '#475569' : '#b91c1c', marginTop: 6, lineHeight: 1.5 }}>
                {!forfaitN
                  ? `Un montant fixe, en euros HT, quel que soit le loyer ou le prix.${forfaitMax ? ` Au plus ${euros(forfaitMax)} pour son budget de cession ou d’achat.` : ''}`
                  : !forfaitOk
                    ? `Trop haut pour son budget : le forfait ne peut pas dépasser ${forfaitMax ? euros(forfaitMax) : `${ecrireTaux(BAREME)} % du montant`}.`
                    : `${euros(forfaitN)} HT, TVA en sus, dus à la signature du bail ou de l’acte.`}
              </div>
            </>
          )}
          {recherche?.mandat_propose_le && honoOk && honorairesCourt(honoChoisi) !== honorairesCourt(honoEnregistre) && (
            <div style={{ ...boite('#fffbeb', '#fde68a', '#92400e'), marginTop: 8 }}>{`Le client voit encore : ${honorairesCourt(honoEnregistre)}. Clique « Mettre à jour », puis renvoie-lui le mail.`}</div>
          )}
          {registre ? (
            <div style={{ ...boite('#f8f8f7', '#e6e4e3', '#26282c'), marginTop: 12 }}>
              {recherche?.mandat_numero && registre.numero
                ? (registre.numero === 'ouvert'
                  ? `N° ${recherche.mandat_numero} au registre des mandats, réservé pour sa signature en cours.`
                  : registre.numero === 'fini'
                  ? `Le n° ${recherche.mandat_numero} est celui d’un mandat précédent : le registre en donnera un nouveau quand ${client.prenom || 'le client'} demandera son code (le prochain est le ${registre.prochain}).`
                  : <>
                      {`N° ${recherche.mandat_numero}, noté sur cette recherche avant le démarrage du registre : c’est lui qui figurera sur le mandat.`}
                      <button type="button" onClick={prendreDuRegistre} disabled={travail === 'registre'}
                        style={{ display: 'block', background: 'none', border: 'none', padding: '6px 0 0', color: '#c2621c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit' }}>
                        {`Prendre plutôt le prochain numéro du registre (${registre.prochain})`}
                      </button>
                    </>)
                : `Le numéro sera pris dans le registre des mandats quand ${client.prenom || 'le client'} demandera son code de signature (le prochain est le ${registre.prochain}) : il figurera sur son exemplaire avant qu’il signe.`}
              <Aide titre="Le numéro du mandat">
                <span>{'Rien à faire : le numéro vient du registre des mandats de RT CONSEILS, partagé avec Alexandre, au moment où le client demande son code. Il est inscrit sur le mandat avant qu’il signe, et la ligne apparaît dans Documents › Registre des mandats.'}</span>
              </Aide>
            </div>
          ) : (
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginTop: 12 }}>N° réservé dans le registre des mandats</label>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: registre ? 10 : 5, flexWrap: 'wrap' }}>
            {!registre && <input style={{ ...champ, maxWidth: 160 }} value={numero} onChange={e => setNumero(e.target.value)} placeholder="ex. 997" inputMode="numeric" />}
            <button type="button" style={btnOr} disabled={travail === 'proposer' || !honoOk || !!docMandat} onClick={proposer}>
              {travail === 'proposer' ? '…' : recherche?.mandat_propose_le ? 'Mettre à jour' : 'Proposer au client'}
            </button>
          </div>
          {!registre && premierDeLaReserve && premierDeLaReserve !== numero.trim() && !recherche?.mandat_propose_le && (
            <button type="button" onClick={() => setNumero(premierDeLaReserve)}
              style={{ background: 'none', border: 'none', padding: '6px 0 0', color: '#c2621c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit' }}>
              {`Prendre le n° ${premierDeLaReserve} de ma réserve`}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" style={btn} disabled={travail === 'apercu' || !honoOk} onClick={apercu}>
              {travail === 'apercu' ? 'Préparation…' : '👁 Aperçu du mandat (PDF)'}
            </button>
          </div>
          {recherche?.mandat_propose_le && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
              {`Proposé le ${quand(recherche.mandat_propose_le)} — ton clic vaut signature de l’offre pour l’agence.`}
              {lien && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', wordBreak: 'break-all' }}>{lien}</code>
                  <button type="button" style={btn} onClick={copier}>{copie ? '✓ Copié' : '🔗 Copier le lien'}</button>
                  <button type="button" style={btnOr} disabled={travail === 'mail'} onClick={envoyerMail}>{travail === 'mail' ? 'Envoi…' : '✉️ Envoyer par e-mail'}</button>
                </div>
              )}
              {!lien && client?.espace_client !== true && (
                <div style={{ marginTop: 8, color: '#92400e' }}>{'Pas d’espace client : ce mandat se signe dans son espace. Active-le dans l’onglet « Son espace », ou fais-le signer depuis Documents.'}</div>
              )}
              <button type="button" style={{ ...btn, marginTop: 8, color: '#b91c1c', borderColor: '#fecaca' }} disabled={travail === 'retirer'} onClick={() => { void demanderRetrait(); }}>{travail === 'retirer' && !fenRetrait ? '…' : 'Retirer la proposition'}</button>
            </div>
          )}
        </div>
      )}

      {/* 3 — La réserve de numéros, la signature manuscrite */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
        <button type="button" onClick={() => setVoirReserve(v => !v)}
          style={{ ...titreBloc, background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', width: '100%', justifyContent: 'space-between' }}>
          <span>Pour les clients qui signent seuls · aussi dans Paramètres › Agence</span>
          <span style={{ color: (registre || reste > 2) && approuveLe ? '#15803d' : '#c05d12' }}>
            {!approuveLe ? 'non activé' : registre ? 'numéros du registre' : `${reste} numéro${reste > 1 ? 's' : ''} d’avance`} {voirReserve ? '▴' : '▾'}
          </span>
        </button>
        {voirReserve && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {registre ? (
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
                {'Coché, tout demandeur sans mandat qui clique « Je souhaite le visiter » doit d’abord signer le mandat type, aux honoraires de sa fiche (2,5 % sinon) : il prend le numéro suivant du registre commun et signe tout de suite, puis sa demande part. Non coché, il peut demander une visite sans mandat. Tes propres affaires se visitent toujours sans mandat de recherche.'}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
                  Réserve quelques numéros dans le registre des mandats et colle-les ici. Un client qui clique « Je souhaite le visiter » sans mandat préparé prend le premier libre, signe tout de suite, et tu reçois un mail pour reporter le nom dans le registre.
                </div>
                <input style={champ} value={reserve} onChange={e => setReserve(e.target.value)} placeholder="ex. 997, 998, 999" />
              </>
            )}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--emilio)', lineHeight: 1.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={approuve} onChange={e => setApprouve(e.target.checked)} style={{ marginTop: 3 }} />
              <span>{`J’approuve le mandat de recherche simple type et je signe l’offre au nom de Werner Immobilier pour ${registre ? 'les mandats signés seuls' : 'ces numéros'}.${approuveLe ? ` (approuvé le ${quand(approuveLe)})` : ''}`}</span>
            </label>
            <div><button type="button" style={btnOr} disabled={travail === 'reserve'} onClick={enregistrerReserve}>{travail === 'reserve' ? '…' : registre ? 'Enregistrer' : 'Enregistrer la réserve'}</button></div>
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>{aSignature === null ? 'Ta signature manuscrite : état inconnu.' : aSignature ? '✓ Ta signature manuscrite est déposée (dossier privé).' : 'Ta signature manuscrite n’est pas encore déposée.'}</span>
              <label style={{ ...btn, cursor: 'pointer' }}>
                {travail === 'signature' ? '…' : aSignature ? 'Remplacer' : 'Déposer (PNG)'}
                <input type="file" accept="image/png" style={{ display: 'none' }} onChange={e => deposerSignature(e.target.files?.[0])} />
              </label>
            </div>
          </div>
        )}
      </div>

      {msg && <div style={boite(msg.ok ? '#f0fdf4' : '#fef2f2', msg.ok ? '#bbf7d0' : '#fecaca', msg.ok ? '#166534' : '#991b1b')}>{msg.t}</div>}
      {!valide && (
        <div style={{ ...titreBloc, marginTop: 6, display: 'flex', alignItems: 'center' }}>
          Ou saisir un mandat signé ailleurs
          <Aide titre="Un mandat signé ailleurs">
            <span>{'Un mandat signé sur papier ou dans un autre outil : note sa date, sa durée et ses honoraires ici, pour que la fiche et les relances le connaissent.'}</span>
            <span>{'Pour un mandat préparé dans le CRM et signé sur place ou à distance : Documents › Créer un document › Mandat de recherche.'}</span>
          </Aide>
        </div>
      )}
    </div>
  );
}
