'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BLOCS, CHAMPS, CLE_HISTORIQUE, CLE_IDENTITE, HISTORIQUE_MAX, IDENTITE_DEFAUT, LIB_FONDS, PREVENIR_JOURS,
  aRevoir, clesMiroir, coordonneesDe, ecarts, etatCarte, formeCourte, lignesMandataire, lireHistorique, lireIdentite, phraseFonds,
  type Bloc, type Champ, type Fonds, type IdentiteAgence, type Modif,
} from '@/lib/agence';
import { BAREME, HONORAIRES_TAUX, tauxTexte } from '@/lib/mandat';
import Aide from '@/components/shared/Aide';
import FenetreSignatureAgence from '@/components/shared/FenetreSignatureAgence';
import { Carte, Hero, Ico, Interrupteur, Note, styles as p } from './ParamUI';
import { oublierCoordonnees } from '@/lib/coordonnees-client';

/* ═══ Paramètres · Agence ═════════════════════════════════════════════════
   L'identité de l'agence que les documents impriment (src/lib/agence.ts).
   Elle s'enregistre ici, avec son propre bouton : le bouton « Enregistrer »
   des autres rubriques n'y touche pas. Chaque modification entre dans
   l'historique, datée, avec l'ancienne et la nouvelle valeur.

   23 octobre 2026 — le nouveau dessin (Alexandre : « des jolies cases, de
   beaux rectangles, des explications ») : la même logique, des cartes à
   icônes dessinées (plus d'émoji), l'aperçu comme une feuille, l'argent des
   clients en deux grandes cases, l'approbation du mandat type en
   interrupteur. Les styles : Parametres.module.css. */

const SIGNATURE = 'agence/signature.png';
/* L'approbation du mandat de recherche type (la même clé que MandatEnLigne). */
const CLE_APPROBATION = 'mandat_modele_approuve_le';
const OR = '#f08c42';

/* L'icône dessinée de chaque bloc (les émoji de src/lib/agence.ts ne servent plus ici). */
const IC_BLOC: Record<Bloc, string> = {
  identite: 'agence', carte: 'carte', fonds: 'euro', assurance: 'bouclier', mediateur: 'balance',
  signataire: 'plume', coordonnees: 'pin', autres: 'trombone',
};

const jourLong = (ymd: string) => new Date(ymd.slice(0, 10) + 'T12:00:00Z')
  .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
/* Une valeur de l'historique : une date se lit « 12 mai 2027 ». */
const lisible = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? jourLong(v) : v);
const quand = (iso: string) => new Date(iso).toLocaleString('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
}).replace(':', ' h ');

/* ── Une case d'état, en haut ── */
type Ton = 'vert' | 'or' | 'rouge' | 'gris';
const TON_ETAT: Record<Ton, string> = { vert: p.etatVert, or: p.etatOr, rouge: p.etatRouge, gris: p.etatGris };
function Etat({ ton, ic, titre, texte }: { ton: Ton; ic: string; titre: string; texte: string }) {
  return (
    <div className={`${p.etat} ${TON_ETAT[ton]}`}>
      <span className={p.etatIc}><Ico n={ic} t={17} /></span>
      <div style={{ minWidth: 0 }}><small>{titre}</small><b>{texte}</b></div>
    </div>
  );
}

/* ── Un champ (déclaré ici, hors du composant : sinon il perd le focus à
   chaque lettre, AGENTS.md §2.4) ── */
function ChampAgence({ c, valeur, erreur, change, onChange }: {
  c: Champ; valeur: string; erreur?: string; change: boolean; onChange: (v: string) => void;
}) {
  return (
    <div className={`${p.champ} ${c.large ? p.champLarge : ''}`} data-champ={c.cle}>
      <label htmlFor={`ag-${c.cle}`} style={{ fontSize: 12.5, fontWeight: 700, color: '#3f3f46' }}>
        {c.lib}
        {!c.requis && <span style={{ fontWeight: 500, color: '#a1a1aa' }}>{' · facultatif'}</span>}
      </label>
      <input id={`ag-${c.cle}`} className={p.input} type={c.type === 'date' ? 'date' : c.type === 'email' ? 'email' : 'text'}
        value={valeur} maxLength={c.max} placeholder={c.exemple ? `Ex : ${c.exemple}` : undefined}
        onChange={e => onChange(e.target.value)}
        style={{ borderColor: erreur ? '#f87171' : change ? OR : undefined, background: change && !erreur ? '#fff9f5' : undefined }} />
      {erreur
        ? <span className={p.aideChamp} style={{ color: '#b91c1c' }}>{erreur}</span>
        : change ? <span className={p.aideChamp} style={{ color: '#c2621c' }}>{'Modifié, pas encore enregistré'}</span>
        : c.aide ? <span className={p.aideChamp}>{c.aide}</span> : null}
    </div>
  );
}

/* Les guillemets et les deux-points ne se séparent pas de leur mot en bout
   de ligne (à l'écran seulement : le texte du mandat, lui, ne change pas). */
const fr = (t: string) => t.replace(/« /g, '« ').replace(/ »/g, ' »').replace(/ ([:;?!])/g, ' $1').replace(/n° /g, 'n° ');

/* ── Ce que lit le client : la fiche « le mandataire » du mandat, en direct ── */
function Apercu({ id }: { id: IdentiteAgence }) {
  return (
    <div className={p.feuille}>
      <div className={p.feuilleTag}>Le mandataire</div>
      <div className={p.feuilleNom}>{id.nom.toUpperCase()}</div>
      {lignesMandataire(id).map((l, i) => <p key={i}>{fr(l)}</p>)}
      <p style={{ marginTop: 8 }}><span className={p.feuilleFonds}>{fr(phraseFonds(id))}</span></p>
      <div className={p.feuillePied}>
        <div>{`Médiateur : ${id.mediateurNom}, ${id.mediateurAdresse}, ${id.mediateurSite}.`}</div>
        <div style={{ marginTop: 3 }}>{`Fait à ${id.ville} · pied de page : ${id.nom} · ${id.societe}, ${formeCourte(id)} · carte professionnelle ${id.carte}`}</div>
      </div>
    </div>
  );
}

export default function ParamAgence({ onEnregistree }: { onEnregistree?: (valeur: string) => void } = {}) {
  const [enregistree, setEnregistree] = useState<IdentiteAgence | null>(null);
  const [brouillon, setBrouillon] = useState<IdentiteAgence>(IDENTITE_DEFAUT);
  const [historique, setHistorique] = useState<Modif[]>([]);
  const [jamais, setJamais] = useState(true);
  const [erreurLecture, setErreurLecture] = useState('');
  const [essai, setEssai] = useState(false);          // on montre les erreurs après un premier « Enregistrer »
  const [enCours, setEnCours] = useState('');
  const [note, setNote] = useState<{ t: string; ok: boolean } | null>(null);
  const [voirHisto, setVoirHisto] = useState(false);
  const [signature, setSignature] = useState<string | null | undefined>(undefined);   // url signée, null = aucune
  const [dessin, setDessin] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);
  /* 22 octobre 2026 — le mandat type, réglé ici une fois pour toutes. */
  const [approuveLe, setApprouveLe] = useState<string | null>(null);
  const [approuve, setApprouve] = useState(false);
  const [noteMandat, setNoteMandat] = useState<{ t: string; ok: boolean } | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('parametres').select('cle, valeur').in('cle', [CLE_IDENTITE, CLE_HISTORIQUE, CLE_APPROBATION]);
    if (error) { setErreurLecture(error.message); return; }
    const ap = data?.find(x => x.cle === CLE_APPROBATION)?.valeur || null;
    setApprouveLe(ap); setApprouve(!!ap);
    const brut = data?.find(x => x.cle === CLE_IDENTITE)?.valeur ?? null;
    const id = lireIdentite(brut);
    setJamais(!brut);
    setEnregistree(id); setBrouillon(id);
    setHistorique(lireHistorique(data?.find(x => x.cle === CLE_HISTORIQUE)?.valeur ?? null));
  }, []);

  const chargerSignature = useCallback(async () => {
    const l = await supabase.storage.from('mandats').list('agence');
    if (l.error || !l.data?.some(x => x.name === 'signature.png')) { setSignature(null); return; }
    const u = await supabase.storage.from('mandats').createSignedUrl(SIGNATURE, 600);
    setSignature(u.error ? null : u.data.signedUrl);
  }, []);

  useEffect(() => { void charger(); void chargerSignature(); }, [charger, chargerSignature]);

  const montrer = (t: string, ok = true) => { setNote({ t, ok }); if (ok) setTimeout(() => setNote(n => (n?.t === t ? null : n)), 6000); };

  async function enregistrerApprobation() {
    setEnCours('approbation'); setNoteMandat(null);
    const maintenant = new Date().toISOString();
    const valeur = approuve ? (approuveLe || maintenant) : '';
    const { error } = await supabase.from('parametres').upsert({ cle: CLE_APPROBATION, valeur, updated_at: maintenant }, { onConflict: 'cle' });
    setEnCours('');
    if (error) { setNoteMandat({ t: 'Pas enregistré : ' + error.message, ok: false }); return; }
    setApprouveLe(valeur || null);
    setNoteMandat(approuve
      ? { t: 'Enregistré. Désormais, un demandeur sans mandat signe le mandat de recherche avant que sa demande de visite parte : 2,5 % HT, ou les honoraires mis sur sa fiche. Tes propres affaires se visitent toujours sans mandat. Tu reçois un mail à chaque signature.', ok: true }
      : { t: 'Enregistré. Les demandeurs peuvent de nouveau demander une visite sans mandat ; ceux qui l’ont signé le gardent. Pour en faire signer un, propose-le depuis sa fiche.', ok: true });
  }

  const erreurs = useMemo(() => aRevoir(brouillon), [brouillon]);
  const modifs = useMemo(() => enregistree ? ecarts(enregistree, brouillon) : [], [enregistree, brouillon]);
  const changes = useMemo(() => new Set(modifs.map(m => m.cle)), [modifs]);
  const carte = etatCarte(brouillon);

  const poser = (cle: keyof IdentiteAgence, v: string) => setBrouillon(b => ({ ...b, [cle]: v }));

  async function enregistrer() {
    if (!enregistree || !modifs.length) return;
    setEssai(true);
    if (Object.keys(erreurs).length) {
      const premier = CHAMPS.find(c => erreurs[c.cle]);
      if (premier) document.querySelector(`[data-champ="${premier.cle}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const le = new Date().toISOString();
    /* On range ce qui s'imprimera : lireIdentite nettoie les espaces. */
    const propre = lireIdentite(JSON.stringify(brouillon));
    const lignes = ecarts(enregistree, propre, le);
    const histo = [...lignes, ...historique].slice(0, HISTORIQUE_MAX);
    setEnCours('enregistrer');
    /* Les anciennes clés de « Mails et signature » suivent l'identité : une
       seule source pour le nom, le téléphone, le mail et le site. */
    const miroir = Object.entries(clesMiroir(coordonneesDe(propre))).map(([cle, valeur]) => ({ cle, valeur, updated_at: le }));
    const { error } = await supabase.from('parametres').upsert([
      { cle: CLE_IDENTITE, valeur: JSON.stringify(propre), updated_at: le },
      { cle: CLE_HISTORIQUE, valeur: JSON.stringify(histo), updated_at: le },
      ...miroir,
    ], { onConflict: 'cle' });
    setEnCours('');
    if (error) { montrer(`L’identité de l’agence n’a pas pu être enregistrée : ${error.message}. Rien n’a changé.`, false); return; }
    setEnregistree(propre); setBrouillon(propre); setHistorique(histo); setJamais(false); setEssai(false);
    oublierCoordonnees();
    onEnregistree?.(JSON.stringify(propre));
    montrer(`${lignes.length} modification${lignes.length > 1 ? 's' : ''} enregistrée${lignes.length > 1 ? 's' : ''} : les prochains documents les reprennent.`);
  }

  function annuler() { if (enregistree) { setBrouillon(enregistree); setEssai(false); } }

  async function deposerSignature(f: File | undefined) {
    if (!f) return;
    if (f.type !== 'image/png') { montrer('La signature doit être une image PNG, sur fond transparent.', false); return; }
    if (f.size > 2_000_000) { montrer('Cette image est trop lourde (2 Mo au plus).', false); return; }
    setEnCours('signature');
    const { error } = await supabase.storage.from('mandats').upload(SIGNATURE, f, { upsert: true, contentType: 'image/png' });
    if (error) { setEnCours(''); montrer(`La signature n’a pas pu être déposée : ${error.message}.`, false); return; }
    /* Elle entre dans l'historique, comme un champ. */
    const le = new Date().toISOString();
    const ligne: Modif = { le, cle: 'signature', lib: 'Signataire · Signature manuscrite', avant: signature ? 'une signature' : 'aucune', apres: 'nouvelle signature déposée' };
    const histo = [ligne, ...historique].slice(0, HISTORIQUE_MAX);
    const { error: eH } = await supabase.from('parametres').upsert({ cle: CLE_HISTORIQUE, valeur: JSON.stringify(histo), updated_at: le }, { onConflict: 'cle' });
    setEnCours('');
    if (eH) montrer(`La signature est déposée, mais l’historique n’a pas pu être mis à jour : ${eH.message}.`, false);
    else { setHistorique(histo); montrer('Signature déposée : elle apparaîtra sur les prochains mandats signés.'); }
    await chargerSignature();
  }

  const hero = (
    <Hero ic="agence" titre="Agence"
      texte={fr('Ce que tes documents impriment : le mandat de recherche, les mandats de location ou de vente, les offres. Un document déjà signé ne change jamais ; les suivants prennent l’identité du jour de leur signature.')} />
  );
  if (erreurLecture) return <div className={p.rubrique}>{hero}<Note ton="erreur">{`L’identité de l’agence n’a pas pu être lue : ${erreurLecture}`}</Note></div>;
  if (!enregistree) return <div className={p.rubrique}>{hero}<Carte><div className={p.aideChamp}>Chargement…</div></Carte></div>;

  const carteEtat: { ton: Ton; texte: string } =
    carte.etat === 'expiree' ? { ton: 'rouge', texte: `Expirée depuis le ${jourLong(brouillon.carteFin)} : renouvelle-la avant tout nouveau mandat` }
    : carte.etat === 'bientot' ? { ton: 'or', texte: `À renouveler : expire dans ${carte.jours} jour${carte.jours === 1 ? '' : 's'}, le ${jourLong(brouillon.carteFin)}` }
    : carte.etat === 'ok' ? { ton: 'vert', texte: `Valable jusqu’au ${jourLong(brouillon.carteFin)}` }
    : { ton: 'gris', texte: `Ajoute sa date de fin : le CRM te prévient ${PREVENIR_JOURS} jours avant` };
  const derniere = historique[0];
  const erreurDe = (c: Champ) => (essai ? erreurs[c.cle] : undefined);

  const champsDe = (b: Bloc) => CHAMPS.filter(c => c.bloc === b && (!c.siGarantie || brouillon.fonds === 'garantie'));
  const grille = (b: Bloc) => (
    <div className={p.champs}>
      {champsDe(b).map(c => (
        <ChampAgence key={c.cle} c={c} valeur={String(brouillon[c.cle] || '')} erreur={erreurDe(c)} change={changes.has(c.cle)}
          onChange={v => poser(c.cle, v)} />
      ))}
    </div>
  );
  const nbChanges = (b: Bloc) => champsDe(b).filter(c => changes.has(c.cle)).length + (b === 'fonds' && changes.has('fonds') ? 1 : 0);
  const carteBloc = (id: Bloc, plus?: React.ReactNode, avant?: React.ReactNode) => {
    const b = BLOCS.find(x => x.id === id)!;
    const n = nbChanges(id);
    return (
      <Carte key={id} ic={IC_BLOC[id]} titre={b.titre} sous={fr(b.sert)}
        droite={n ? <span className={p.aideChamp} style={{ color: '#c2621c', fontWeight: 700, whiteSpace: 'nowrap' }}>{`${n} modifié${n > 1 ? 's' : ''}`}</span> : undefined}>
        {avant}
        {champsDe(id).length > 0 && grille(id)}
        {plus}
      </Carte>
    );
  };

  return (
    <div className={p.rubrique}>
      {hero}

      {/* L'état, en un coup d'œil */}
      <div className={p.etats}>
        <Etat ton={carteEtat.ton} ic="carte" titre="Carte professionnelle" texte={carteEtat.texte} />
        <Etat ton={signature ? 'vert' : signature === null ? 'or' : 'gris'} ic="plume" titre="Signature manuscrite"
          texte={signature ? 'Déposée : elle figure sur chaque mandat signé' : signature === null ? 'Pas encore déposée' : '…'} />
        <Etat ton="gris" ic="historique" titre="Dernière modification"
          texte={derniere ? `Le ${quand(derniere.le)}` : jamais ? 'Jamais : c’est l’identité d’origine' : '—'} />
      </div>

      {/* Ce que lit le client */}
      <Carte ic="oeil" titre="Ce que lit ton client" sous={fr('La fiche « le mandataire » de son mandat de recherche, telle qu’elle s’imprimera.')}
        droite={<span className={p.direct}><i />{'En direct'}</span>}>
        <Apercu id={lireIdentite(JSON.stringify(brouillon))} />
      </Carte>

      {carteBloc('identite')}
      {carteBloc('carte')}
      {carteBloc('fonds', undefined, (
        <div className={p.cases} style={{ marginBottom: brouillon.fonds === 'garantie' ? 16 : 0 }}>
          {(['non', 'garantie'] as Fonds[]).map(f => {
            const on = brouillon.fonds === f;
            return (
              <button key={f} type="button" onClick={() => setBrouillon(b => ({ ...b, fonds: f }))} aria-pressed={on}
                className={`${p.case} ${changes.has('fonds') ? p.caseChange : ''}`}>
                <span className={p.caseRond} /><span>{LIB_FONDS[f]}</span>
              </button>
            );
          })}
        </div>
      ))}
      {carteBloc('assurance')}
      {carteBloc('mediateur')}
      {carteBloc('signataire', (
        <div className={p.signature}>
          <div className={`${p.signatureCadre} ${signature ? '' : p.signatureVide}`}>
            {signature
              ? <img src={signature} alt="Ta signature manuscrite" />
              : <span className={p.aideChamp} style={{ padding: 10, textAlign: 'center' }}>{signature === null ? 'Aucune signature' : '…'}</span>}
          </div>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div className={p.ligneTitre}>Signature manuscrite</div>
            <div className={p.ligneTx}>
              {fr('Dessine-la au doigt ou à la souris, ou dépose une image PNG sur fond transparent. Rangée dans un dossier privé, elle se pose dans ta case au moment où le client signe.')}
            </div>
            <input ref={fichier} type="file" accept="image/png" style={{ display: 'none' }}
              onChange={e => { void deposerSignature(e.target.files?.[0]); e.target.value = ''; }} />
            <div className={p.boutons} style={{ marginTop: 12 }}>
              <button type="button" className={`${p.btn} ${p.btnFonce}`} disabled={enCours === 'signature'} onClick={() => setDessin(true)}>
                <Ico n="plume" t={15} />{signature ? 'La redessiner' : 'Dessiner ma signature'}
              </button>
              <button type="button" className={p.btn} disabled={enCours === 'signature'} onClick={() => fichier.current?.click()}>
                {enCours === 'signature' ? 'Envoi…' : 'Déposer une image'}
              </button>
            </div>
            {dessin && (
              <FenetreSignatureAgence nom={brouillon.signataireNom || 'Werner'} onFermer={() => setDessin(false)}
                onEnregistree={() => { void chargerSignature(); void charger(); }} />
            )}
          </div>
        </div>
      ))}
      {carteBloc('coordonnees', undefined, (
        <div style={{ marginBottom: 14 }}>
          <Note ton="info">
            <b>{'Une seule source. '}</b>
            {fr('Change ton téléphone ou ton mail ici, et tout suit : les prochains documents, les mails automatiques, la signature de tes mails, l’espace de tes clients, la page publique d’un local et tes annonces SeLoger. Les documents déjà signés, eux, ne bougent pas.')}
          </Note>
        </div>
      ))}

      {/* Les honoraires : lus ici, réglés client par client */}
      <Carte ic="euro" titre="Honoraires et mandat de recherche" sous={fr('Ce que le mandat de recherche propose d’office, et le mandat type qu’un demandeur peut signer seul.')}>
        <div className={p.chiffres}>
          {[
            ['Mandat de recherche', `${tauxTexte(HONORAIRES_TAUX)} par défaut`, `Du loyer annuel HT HC d’un bail, ou du prix d’une cession ou d’une vente · modifiable pour chaque demandeur, jusqu’à ${tauxTexte(BAREME)}`],
            ['Mandat de commercialisation', 'Dans le document', 'Taux ou forfait, HT ou TTC, choisis en préparant le mandat (Documents)'],
          ].map(([t, v, d]) => (
            <div key={t} className={p.chiffre}><small>{t}</small><b>{v}</b><span>{fr(d)}</span></div>
          ))}
        </div>
        <div className={p.ligneTx} style={{ marginTop: 12 }}>
          {fr('Pour un demandeur, tu changes le taux ou choisis un forfait sur sa fiche : sa recherche › « Mandat de recherche ».')}
          <Aide titre="Changer les honoraires d’un demandeur">
            <span>{'Ouvre sa fiche, puis sa recherche, puis « Mandat de recherche ». Choisis « Pourcentage » (2,5 %, 5 %, 10 %, 15 % ou le taux que tu tapes) ou « Forfait » (un montant en euros HT).'}</span>
            <span>{'« Proposer au client » : il voit aussitôt « Votre mandat est prêt » dans son espace, avec ces honoraires. Déjà proposé ? « Mettre à jour », puis renvoie-lui le mail.'}</span>
            <span>{'Ces honoraires passent avant les 2,5 % par défaut, que le mandat type soit coché ou non. Une fois le mandat signé, ils ne changent plus que par un avenant (Documents › Créer un document).'}</span>
          </Aide>
        </div>

        <div className={p.separe}>
          <div className={`${p.ligne} ${approuve ? '' : p.ligneOff}`} style={{ margin: 0 }}>
            <span className={p.ligneIc}><Ico n="doc" t={18} /></span>
            <div className={p.ligneCorps}>
              <div className={p.ligneTitre} style={{ display: 'flex', alignItems: 'center' }}>
                {'Le mandat type, signé seul par le demandeur'}
                <Aide titre="Ce que change le mandat type">
                  <span><b>{'Éteint (au départ). '}</b>{'Un demandeur peut demander une visite sans signer de mandat : tu reçois sa demande, et tu décides. Seul un demandeur à qui tu as proposé le mandat depuis sa fiche doit le signer avant que sa demande parte.'}</span>
                  <span><b>{'Allumé. '}</b>{'Tout demandeur sans mandat qui clique « Je souhaite le visiter » doit d’abord signer le mandat de recherche : il remplit son identité ou celle de sa société, reçoit un code par mail, signe, et sa demande part juste après. Le numéro vient du registre commun ; tu reçois un mail.'}</span>
                  <span><b>{'Les honoraires restent à toi, client par client. '}</b>{'2,5 % HT n’est que le taux par défaut. Un autre pourcentage ou un forfait mis sur la fiche d’un demandeur passe avant, allumé ou non. Une fois le mandat signé, ils ne changent plus que par un avenant (Documents).'}</span>
                  <span><b>{'Jamais pour tes affaires. '}</b>{'Un local dont tu as le mandat du bailleur ou du cédant se visite toujours sans mandat de recherche.'}</span>
                  <span>{'Ton approbation vaut signature de l’offre au nom de l’agence pour ces mandats-là. Tu peux la retirer quand tu veux : les mandats déjà signés restent valables.'}</span>
                </Aide>
              </div>
              <div className={p.ligneTx}>
                {fr(`J’approuve le mandat de recherche simple type, et je signe l’offre au nom de l’agence pour les mandats que les demandeurs signent seuls.${approuveLe ? ` Approuvé le ${new Date(approuveLe).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}`)}
              </div>
              {approuve !== !!approuveLe && (
                <div className={p.boutons} style={{ marginTop: 12 }}>
                  <button type="button" className={`${p.btn} ${p.btnOr}`} disabled={enCours === 'approbation'} onClick={() => { void enregistrerApprobation(); }}>
                    <Ico n="enregistrer" t={15} />{enCours === 'approbation' ? 'Enregistrement…' : 'Enregistrer ce choix'}
                  </button>
                  <button type="button" className={p.btn} disabled={enCours === 'approbation'} onClick={() => setApprouve(!!approuveLe)}>Annuler</button>
                </div>
              )}
            </div>
            <Interrupteur on={approuve} disabled={enCours === 'approbation'} onClick={() => { setApprouve(a => !a); setNoteMandat(null); }}
              label={approuve ? 'Retirer l’approbation du mandat type' : 'Approuver le mandat type'} />
          </div>
          {noteMandat && <div style={{ marginTop: 10 }}><Note ton={noteMandat.ok ? 'ok' : 'erreur'}>{fr(noteMandat.t)}</Note></div>}
        </div>
      </Carte>

      {carteBloc('autres')}

      {/* L'historique */}
      <Carte className={voirHisto ? p.pliOuvert : ''}>
        <button type="button" className={p.pliTete} onClick={() => setVoirHisto(v => !v)} aria-expanded={voirHisto}>
          <span className={p.carteIc}><Ico n="historique" t={18} /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 15, color: '#232528' }}>
              {`Historique des modifications${historique.length ? ` · ${historique.length}` : ''}`}
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{'Chaque changement, daté, avec l’ancienne et la nouvelle valeur.'}</span>
          </span>
          <span className={p.pliFleche}><Ico n="chevron" t={18} /></span>
        </button>
        {voirHisto && (
          historique.length === 0
            ? <div className={p.ligneTx} style={{ marginTop: 14 }}>{'Aucune modification pour l’instant : tes documents impriment l’identité d’origine.'}</div>
            : (
              <div className={p.histo}>
                {historique.map((m, i) => (
                  <div key={i} className={p.histoLigne}>
                    <div><b>{m.lib}</b><small>{quand(m.le)}</small></div>
                    <div style={{ marginTop: 3, overflowWrap: 'anywhere' }}>
                      <span className={p.histoAvant}>{lisible(m.avant) || 'vide'}</span>
                      <span className={p.histoFleche}>{' → '}</span>
                      <span style={{ color: '#232528' }}>{lisible(m.apres) || 'vide'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
        )}
      </Carte>

      {note && <Note ton={note.ok ? 'ok' : 'erreur'}>{fr(note.t)}</Note>}

      {/* La barre d'enregistrement : seulement quand quelque chose a changé */}
      {modifs.length > 0 && (
        <div className={p.barre}>
          <div className={p.barreTx}>
            <Ico n="enregistrer" t={18} />
            <div>
              <b>{`${modifs.length} modification${modifs.length > 1 ? 's' : ''}`}</b>
              <span>
                {essai && Object.keys(erreurs).length
                  ? ` · ${Object.keys(erreurs).length} champ${Object.keys(erreurs).length > 1 ? 's' : ''} à revoir`
                  : ' · les prochains documents les reprendront'}
              </span>
            </div>
          </div>
          <div className={p.barreBoutons}>
            <button type="button" className={p.barreAnnuler} onClick={annuler} disabled={!!enCours}>Annuler</button>
            <button type="button" className={p.barreOk} onClick={() => { void enregistrer(); }} disabled={!!enCours}>
              {enCours === 'enregistrer' ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
