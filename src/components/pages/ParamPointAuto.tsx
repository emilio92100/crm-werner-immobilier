'use client';
import { useEffect, useMemo, useState } from 'react';
import Curseur from '@/components/shared/Curseur';
import { Carte, Enregistre, Etapes, Hero, Ico, Interrupteur, Note, Pastille, fr, initiales, styles as p } from './ParamUI';

/* ═══ Paramètres · Point automatique ══════════════════════════════════════
   Le réglage général du mail « Où en est votre recherche ? » (la règle est
   dans src/lib/point-auto.ts). Chaque changement s'enregistre tout de suite,
   par /api/point-auto : pas besoin du bouton « Enregistrer » de la page, et
   ce bouton-là ne touche pas à ces réglages (voir PageParametres).

   23 octobre 2026, deuxième dessin : l'interrupteur, pour qui, après combien
   de jours ; « Comment ça marche » avec les cinq réponses du mail ; et le
   mail aussi pour les demandeurs sans espace.
   V3.240 (Alexandre : « ça met très longtemps à charger […] quand on clique,
   ça met très longtemps à s'activer […] et je vois tous les clients
   s'afficher ») :
     · les réglages arrivent seuls, tout de suite (mode « lire ») ; la liste se
       calcule à côté (mode « etat », en paquets côté serveur), et dès
       l'ouverture de Paramètres (`prechargerPointAuto`), avant le clic ;
     · un clic change l'écran tout de suite et s'enregistre derrière : la
       liste arrive avec ce qui fait l'échéance de chacun (dates brutes) et
       s'il a son espace, et l'écran recalcule lui-même avec un autre délai
       ou un autre « Pour qui » ;
     · « Qui le recevrait » ne déroule plus tout le monde : trois chiffres,
       les prochains mails, et la liste entière seulement si on la demande,
       avec une recherche par nom. */

type Pour = 'espace' | 'recherche';
type Reglages = { actif: boolean; delai: number; exclus: string[]; pour?: Pour };
type Branche = { cron: boolean; mailjet: boolean };
type Candidat = {
  clientId: string; prenom: string; nom: string; statut: string;
  empechement: string | null; exclu: boolean;
  dernierMouvement: string | null; dernierEnvoi: string | null; creeLe: string | null; ancien: boolean;
  /* Il a son espace (activé, et son lien créé) : il y répond. */
  viaEspace: boolean;
  rechercheNom: string | null;
};
type Lu = { ok: boolean; error?: string; reglages: Reglages; branche: Branche };
type Liste = { ok: boolean; error?: string; candidats: Candidat[]; maintenant: string };

const DELAIS = [30, 45, 60];
/* Le plafond de l'envoi du matin (PLAFOND_PAR_JOUR, src/lib/point-auto.ts). */
const PLAFOND = 30;
const JOUR = 86_400_000;
const PAR_PAGE = 40;
const STATUTS: Record<Pour, string[]> = { espace: ['actif'], recherche: ['actif', 'prospect'] };
const jour = (ms: number | string) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
const normer = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const POUR: { v: Pour; titre: string; sous: string }[] = [
  /* V3.240 (Alexandre : « je comprends pas le truc ») : les mots des états du dossier. */
  { v: 'espace', titre: 'Les Accompagnés', sous: 'Ceux à qui tu offres l’accompagnement sur mesure : ils répondent depuis leur espace client, ouvert sur la bonne question.' },
  { v: 'recherche', titre: 'Les Accompagnés et ceux En recherche', sous: 'Tous ceux qui cherchent un local. Sans espace, ils répondent sur une petite page à eux : ni compte, ni mot de passe.' },
];

/* Les cinq réponses du mail, comme le client les voit, et ce que chacune fait. */
const EFFETS: { bouton: string; style: string; effet: string }[] = [
  { bouton: 'Je cherche toujours', style: 'effetFonce', effet: 'Une ligne dans son suivi, et le compteur repart. Pas de relance : il n’y a rien à faire (sauf s’il laisse un mot).' },
  { bouton: 'Mes critères ont changé', style: '', effet: 'Une relance du jour, avec ce qu’il a écrit. Avec un espace, il peut aussi corriger ses critères lui-même.' },
  { bouton: 'J’ai trouvé mon local', style: 'effetOr', effet: 'Le dossier passe « Local trouvé avec moi » (avec toi) ou « Recherche arrêtée » (ailleurs), et une relance « à rappeler pour confirmer ». S’il était Accompagné, sa veille s’arrête.' },
  { bouton: 'J’ai mis ma recherche en pause ou arrêtée', style: 'effetGris', effet: 'Le dossier passe « En pause » ou « Recherche arrêtée », et une relance pour savoir quand reprendre. S’il était Accompagné, sa veille s’arrête.' },
  { bouton: 'Je souhaite être rappelé', style: 'effetDoux', effet: 'Une relance du jour, avec le moment qu’il a choisi : le matin, l’après-midi ou en fin de journée.' },
];

/* ── Le préchargement : lancé dès l'ouverture de Paramètres ──
   Une minute de validité : revenir sur la rubrique ne recalcule rien. */
const appeler = async (corps: Record<string, unknown>) => {
  const r = await fetch('/api/point-auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  return r.json();
};
let CACHE: { lire: Promise<Lu>; etat: Promise<Liste>; le: number } | null = null;
export function prechargerPointAuto(): { lire: Promise<Lu>; etat: Promise<Liste> } {
  if (CACHE && Date.now() - CACHE.le < 60_000) return CACHE;
  const lire = appeler({ mode: 'lire' }) as Promise<Lu>;
  const etat = appeler({ mode: 'etat' }) as Promise<Liste>;
  /* Pas d'erreur « non attrapée » si personne n'ouvre la rubrique. */
  lire.catch(() => {}); etat.catch(() => {});
  CACHE = { lire, etat, le: Date.now() };
  return CACHE;
}

type Ligne = Candidat & { vise: boolean; ech: number; du: boolean; bloque: string | null };
type Filtre = 'du' | 'plusTard' | 'jamais';

/* Réservé aux espaces : sans espace, il ne le reçoit pas. La liste arrive
   calculée pour « tous ceux qui ont une recherche » ; le reste se déduit ici. */
const SANS_ESPACE = 'Pas d’espace client : le mail est réservé aux Accompagnés qui ont leur espace. Pour l’envoyer aussi sans espace : « Pour qui », plus haut.';
const bloqueDe = (c: Candidat, pour: Pour) => c.empechement || (pour === 'espace' && !c.viaEspace ? SANS_ESPACE : null);

const nomDe = (c: Candidat) => `${c.prenom} ${c.nom}`.trim() || 'Sans nom';
const quand = (c: Ligne) => (c.bloque ? c.bloque.replace('Paramètres › Point automatique › Pour qui', '« Pour qui », plus haut')
  : c.du ? (c.dernierMouvement ? `rien depuis le ${jour(c.dernierMouvement)}` : c.ancien ? 'rien depuis plus de deux mois' : 'rien depuis la création')
    : `le ${jour(c.ech)}`);

/* Une personne de la liste (déclarée au niveau du module : AGENTS.md §2.4). */
function Personne({ c, pour }: { c: Ligne; pour: Pour }) {
  const gris = !!c.bloque;
  const marque = [c.statut === 'prospect' ? 'En recherche' : '', pour === 'recherche' && !c.viaEspace && !gris ? 'sans espace' : ''].filter(Boolean).join(' · ');
  return (
    <div className={`${p.personne} ${c.du ? p.personneDue : ''}`} style={gris ? { alignItems: 'flex-start' } : undefined}>
      <span className={p.avatar} style={gris ? { background: '#e4e4e7', color: '#52525b' } : undefined}>{initiales(nomDe(c))}</span>
      <span className={p.personneNom}>
        <b style={gris ? { color: '#52525b' } : undefined}>{nomDe(c)}</b>
        {marque && <span className={p.sansEspace}>{marque}</span>}
      </span>
      <small style={gris ? { whiteSpace: 'normal' } : undefined}>{fr(quand(c))}</small>
    </div>
  );
}

export default function ParamPointAuto() {
  const [lu, setLu] = useState<{ reglages: Reglages; branche: Branche } | null>(null);
  const [liste, setListe] = useState<Liste | null>(null);
  const [erreur, setErreur] = useState('');
  const [erreurListe, setErreurListe] = useState('');
  const [erreurReglage, setErreurReglage] = useState('');
  const [note, setNote] = useState(0);
  const [exemple, setExemple] = useState<'' | 'espace' | 'page' | { ok: boolean; t: string }>('');
  const [voirTout, setVoirTout] = useState<Filtre | null>(null);
  const [cherche, setCherche] = useState('');
  const [nb, setNb] = useState(PAR_PAGE);

  useEffect(() => {
    let vivant = true;
    const c = prechargerPointAuto();
    c.lire.then(j => { if (!vivant) return; if (!j.ok) { setErreur(j.error || 'Lecture impossible'); return; } setLu({ reglages: j.reglages, branche: j.branche }); })
      .catch(() => { if (vivant) setErreur('Lecture impossible'); });
    c.etat.then(j => { if (!vivant) return; if (!j.ok) { setErreurListe(j.error || 'Calcul impossible'); return; } setListe(j); })
      .catch(() => { if (vivant) setErreurListe('Calcul impossible'); });
    return () => { vivant = false; };
  }, []);

  const reglages = lu?.reglages;
  const pour: Pour = reglages?.pour === 'recherche' ? 'recherche' : 'espace';
  const d = reglages?.delai || 45;

  /* Le calcul de chacun, avec le délai et le « Pour qui » de l'écran. */
  const lignes: Ligne[] = useMemo(() => {
    if (!liste) return [];
    const maint = Date.now();
    return liste.candidats.map(c => {
      const t = [c.dernierMouvement, c.dernierEnvoi, c.creeLe].filter(Boolean).map(x => Date.parse(String(x))).filter(x => !Number.isNaN(x));
      const ech = (t.length ? Math.max(...t) : maint) + d * JOUR;
      const bloque = bloqueDe(c, pour);
      return { ...c, vise: STATUTS[pour].includes(c.statut), ech, bloque, du: !bloque && ech <= maint };
    });
  }, [liste, d, pour]);

  /* Un réglage : l'écran change tout de suite, l'enregistrement suit. */
  async function regler(corps: { actif?: boolean; delai?: number; pour?: Pour }) {
    if (!lu) return;
    const avant = lu;
    setErreurReglage('');
    setLu({ ...lu, reglages: { ...lu.reglages, ...corps } });
    try {
      const j = await appeler({ mode: 'reglages', ...corps });
      if (!j.ok) throw new Error(j.error || 'erreur');
      CACHE = null;
      const n = Date.now(); setNote(n); setTimeout(() => setNote(x => (x === n ? 0 : x)), 2200);
    } catch (e) {
      setLu(avant);
      setErreurReglage(`Le réglage n’a pas pu être enregistré (${e instanceof Error ? e.message : 'réseau'}). Rien n’a changé : réessaie dans un instant.`);
    }
  }

  async function envoyerExemple(via: 'espace' | 'page') {
    setExemple(via);
    const j = await appeler({ mode: 'exemple', via }).catch(() => ({ ok: false }));
    setExemple(j.ok
      ? { ok: true, t: `Envoyé à ${j.a}, avec le dossier de ${j.client}${j.via === 'page' ? ' (version sans espace : ses boutons ouvrent une page d’exemple, rien ne s’enregistre)' : ''}.` }
      : { ok: false, t: `Pas parti : ${j.error || 'erreur'}` });
  }

  const hero = (droite?: React.ReactNode) => (
    <Hero ic="avion" titre="Point automatique"
      texte={fr('Le mail « Où en est votre recherche ? », envoyé tout seul quand un dossier ne bouge plus. Le client répond en un clic, et sa réponse arrive dans tes Relances et dans son suivi.')}
      droite={droite} />
  );
  if (erreur) return <div className={p.rubrique}>{hero()}<Note ton="erreur">{`Le point automatique n’a pas pu être lu : ${erreur}`}</Note></div>;
  if (!lu || !reglages) return <div className={p.rubrique}>{hero()}<Carte><div className={p.squelette}><i /><i /><i /></div></Carte></div>;
  const { branche } = lu;

  const vises = lignes.filter(c => c.vise);
  const dus = vises.filter(c => c.du).sort((a, b) => a.ech - b.ech);
  const aVenir = vises.filter(c => !c.du && !c.bloque).sort((a, b) => a.ech - b.ech);
  const bloques = vises.filter(c => c.bloque);
  const chiffreDe = (x: Pour) => {
    const l = lignes.filter(c => STATUTS[x].includes(c.statut) && !bloqueDe(c, x));
    const n = l.filter(c => c.ech <= Date.now()).length;
    return `${l.length} dossier${l.length > 1 ? 's' : ''}${n ? ` · ${n} au prochain envoi` : ''}`;
  };

  /* L'état, en une pastille. */
  const pret = branche.cron && branche.mailjet;
  const pastille = !pret ? <Pastille ton="or">{reglages.actif ? 'Allumé, en attente' : 'En attente'}</Pastille>
    : reglages.actif ? <Pastille ton="vert">Activé</Pastille> : <Pastille ton="gris">Désactivé</Pastille>;

  /* La liste entière, à la demande : un filtre, une recherche, par pages. */
  const source = voirTout === 'du' ? dus : voirTout === 'plusTard' ? aVenir : voirTout === 'jamais' ? bloques : [];
  const q = normer(cherche.trim());
  const trouves = q ? source.filter(c => normer(nomDe(c)).includes(q)) : source;
  const prochains = [...dus, ...aVenir].slice(0, 6);
  const ouvrir = (f: Filtre) => { setVoirTout(v => (v === f ? null : f)); setNb(PAR_PAGE); };

  return (
    <div className={p.rubrique}>
      {hero(note ? <Enregistre /> : pastille)}

      {/* 1. Les réglages : allumé ou non, pour qui, après combien de jours */}
      <Carte ic="reglage" titre="Réglages" sous={fr('Chaque choix s’enregistre tout de suite.')}>
        <div className={`${p.ligne} ${reglages.actif ? '' : p.ligneOff}`} style={{ margin: 0 }}>
          <span className={p.ligneIc}><Ico n={reglages.actif ? 'avion' : 'pause'} t={18} /></span>
          <div className={p.ligneCorps}>
            <div className={p.ligneTitre}>{reglages.actif ? 'L’envoi automatique est activé' : 'L’envoi automatique est éteint'}</div>
            <div className={p.ligneTx}>
              {fr(reglages.actif
                ? (pret ? 'Chaque matin, le CRM regarde qui est dû et lui envoie le mail. Tu peux l’éteindre quand tu veux.' : 'Il est allumé : les mails partiront dès que le branchement du serveur sera fait (voir dessous).')
                : 'Aucun mail ne part. Regarde plus bas qui le recevrait avant de l’allumer.')}
            </div>
          </div>
          <Interrupteur on={reglages.actif} onClick={() => { void regler({ actif: !reglages.actif }); }}
            label={reglages.actif ? 'Éteindre l’envoi automatique' : 'Allumer l’envoi automatique'} />
        </div>
        {!branche.cron && (
          <div style={{ marginTop: 12 }}>
            <Note ton="attention">
              <b>{'Le branchement du serveur n’est pas encore fait. '}</b>
              {fr('C’est un réglage technique, posé une seule fois (l’envoi de chaque matin). Tant qu’il manque, aucun mail ne part, même allumé. Une fois fait, tout se décide ici.')}
            </Note>
          </div>
        )}
        {branche.cron && !branche.mailjet && (
          <div style={{ marginTop: 12 }}>
            <Note ton="erreur">{fr('L’envoi des mails n’est pas configuré sur le serveur : aucun mail ne peut partir pour l’instant.')}</Note>
          </div>
        )}

        <div className={p.sousTitre} style={{ marginTop: 20 }}>Pour qui</div>
        <div className={p.cases} role="group" aria-label="Pour qui">
          {POUR.map(o => (
            <button key={o.v} type="button" className={p.case} aria-pressed={pour === o.v}
              onClick={() => { if (o.v !== pour) void regler({ pour: o.v }); }}>
              <span className={p.caseRond} />
              <span>
                <b>{o.titre}</b>
                <small>{fr(o.sous)}</small>
                <em className={p.caseChiffre}>{liste ? chiffreDe(o.v) : 'Calcul…'}</em>
              </span>
            </button>
          ))}
        </div>
        <div className={p.aideChamp} style={{ marginTop: 8 }}>
          {fr('Jamais ceux qui sont en pause, ni les dossiers clos (local trouvé avec moi, recherche arrêtée), ni les contacts archivés.')}
        </div>

        <div className={p.sousTitre} style={{ marginTop: 20 }}>Après combien de jours sans mouvement</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className={p.choix} role="group" aria-label="Délai">
            <Curseur cle={d} />
            {DELAIS.map(x => (
              <button key={x} type="button" aria-pressed={x === d} onClick={() => { if (x !== d) void regler({ delai: x }); }}>{`${x} jours`}</button>
            ))}
          </span>
          <span className={p.aideChamp} style={{ flex: '1 1 260px', margin: 0 }}>
            {fr('45 jours conviennent à la plupart des recherches. Un mouvement, c’est tout ce qui s’écrit dans son suivi (note, appel, mail, visite, critères), un local envoyé ou une réaction du client ; ouvrir son espace ne compte pas. Au moindre mouvement, le compteur repart de zéro.')}
          </span>
        </div>
        {erreurReglage && <div style={{ marginTop: 12 }}><Note ton="erreur">{erreurReglage}</Note></div>}
      </Carte>

      {/* 2. Qui le recevrait : trois chiffres, les prochains mails, la liste à la demande */}
      <Carte ic="personne" titre="Aperçu : qui le recevrait"
        sous={fr(`Rien à régler ici : c’est ce qui se passerait avec tes réglages (${d} jours, ${pour === 'espace' ? 'les Accompagnés' : 'les Accompagnés et ceux En recherche'}). Clique sur un chiffre pour voir les noms.`)}>
        {erreurListe ? <Note ton="erreur">{`La liste n’a pas pu être calculée : ${erreurListe}`}</Note>
          : !liste ? <div className={p.squelette}><i /><i /><i /></div>
            : <>
              {!reglages.actif && (
                <div style={{ marginBottom: 12 }}>
                  <Note ton="info">{fr('L’envoi est éteint : rien ne part tant que tu ne l’allumes pas. Voici ce qui se passerait.')}</Note>
                </div>
              )}
              <div className={p.trois}>
                {([
                  { f: 'du' as Filtre, n: dus.length, t: 'Au prochain envoi', s: dus.length > PLAFOND ? `${PLAFOND} par matin, sur ${Math.ceil(dus.length / PLAFOND)} matins` : 'le matin', ton: 'or' },
                  { f: 'plusTard' as Filtre, n: aVenir.length, t: 'Plus tard', s: 'si rien ne bouge d’ici là', ton: 'bleu' },
                  { f: 'jamais' as Filtre, n: bloques.length, t: 'Ne le recevront pas', s: pour === 'espace' ? 'sans espace, pas de mail, archivé…' : 'pas de mail, pas de recherche, archivé…', ton: 'gris' },
                ]).map(x => (
                  <button key={x.f} type="button" className={p.chiffreBtn} data-ton={x.ton} aria-pressed={voirTout === x.f} onClick={() => ouvrir(x.f)}>
                    <b>{x.n}</b><span>{x.t}</span><small>{fr(x.s)}</small>
                  </button>
                ))}
              </div>

              {!voirTout && (prochains.length > 0 ? <>
                <div className={p.sousTitre} style={{ marginTop: 18 }}>Les prochains mails</div>
                <div className={p.liste}>{prochains.map(c => <Personne key={c.clientId} c={c} pour={pour} />)}</div>
              </> : <div className={p.aideChamp} style={{ marginTop: 14, color: '#71717a' }}>{fr('Personne pour l’instant : tous ont bougé récemment.')}</div>)}

              {voirTout && (
                <div className={p.toutVoir}>
                  <div className={p.toutVoirTete}>
                    <b>{voirTout === 'du' ? 'Au prochain envoi' : voirTout === 'plusTard' ? 'Plus tard, si rien ne bouge' : 'Ne le recevront pas'}</b>
                    <label className={p.cherche}>
                      <Ico n="loupe" t={15} />
                      <input value={cherche} onChange={e => { setCherche(e.target.value); setNb(PAR_PAGE); }} placeholder="Chercher un nom" />
                    </label>
                    <button type="button" className={p.lien} onClick={() => setVoirTout(null)}>Fermer</button>
                  </div>
                  {trouves.length === 0
                    ? <div className={p.aideChamp} style={{ color: '#71717a' }}>{cherche ? 'Personne à ce nom ici.' : 'Personne ici.'}</div>
                    : <div className={p.liste}>{trouves.slice(0, nb).map(c => <Personne key={c.clientId} c={c} pour={pour} />)}</div>}
                  {trouves.length > nb && (
                    <button type="button" className={p.btn} style={{ marginTop: 10 }} onClick={() => setNb(n => n + PAR_PAGE)}>
                      {`Voir les ${Math.min(PAR_PAGE, trouves.length - nb)} suivants · ${trouves.length - nb} restants`}
                    </button>
                  )}
                </div>
              )}
              {dus.length > PLAFOND && !voirTout && (
                <div style={{ marginTop: 12 }}>
                  <Note ton="info">{fr(`${PLAFOND} mails au plus par matin : les ${dus.length - PLAFOND} autres partiront les matins suivants. C’est voulu, pour ne jamais écrire à toute la base d’un coup.`)}</Note>
                </div>
              )}
            </>}
      </Carte>

      {/* 3. Comment ça marche, et ce que fait chaque réponse */}
      <Carte ic="info" titre="Comment ça marche">
        <Etapes items={[
          { ic: 'horloge', titre: 'Le dossier ne bouge plus', texte: `Rien de nouveau depuis ${d} jours : ni note, ni envoi, ni visite.` },
          { ic: 'avion', titre: 'Le mail part, le matin', texte: 'Un seul, avec le rappel de sa recherche et cinq réponses en un clic.' },
          { ic: 'message', titre: 'Il répond', texte: pour === 'espace' ? 'Depuis son espace, ouvert sur la bonne question.' : 'Depuis son espace s’il en a un ; sinon, sur une page à lui.' },
          { ic: 'relance', titre: 'Sa réponse arrive chez toi', texte: `Dans Relances et dans son suivi. Sans réponse, un nouveau mail ${d} jours plus tard.` },
        ]} />

        <div className={p.sousTitre} style={{ marginTop: 22 }}>Les cinq réponses du mail, et ce qu’elles font</div>
        <div className={p.effets}>
          {EFFETS.map(e => (
            <div key={e.bouton} className={p.effet}>
              <span className={`${p.effetBtn} ${e.style ? p[e.style] : ''}`}>{e.bouton}</span>
              <span className={p.effetTx}>{fr(e.effet)}</span>
            </div>
          ))}
        </div>
        <div className={p.aideChamp} style={{ marginTop: 10 }}>
          {fr('Chaque réponse s’inscrit dans son suivi, juste sous la ligne « Mail envoyé automatiquement » : tu vois s’il a répondu, et quoi. Un lien du mail ne répond jamais tout seul : c’est le client qui confirme, sur la page qui s’ouvre.')}
        </div>

        <div className={p.actions} style={{ marginTop: 16 }}>
          {pour === 'recherche' ? <>
            <button type="button" className={`${p.btn} ${p.btnFonce}`} onClick={() => { void envoyerExemple('espace'); }} disabled={exemple === 'espace' || exemple === 'page'}>
              <Ico n="avion" t={15} />{exemple === 'espace' ? 'Envoi…' : 'Exemple avec espace'}
            </button>
            <button type="button" className={p.btn} onClick={() => { void envoyerExemple('page'); }} disabled={exemple === 'espace' || exemple === 'page'}>
              <Ico n="avion" t={15} />{exemple === 'page' ? 'Envoi…' : 'Exemple sans espace'}
            </button>
          </> : (
            <button type="button" className={`${p.btn} ${p.btnFonce}`} onClick={() => { void envoyerExemple('espace'); }} disabled={exemple === 'espace'}>
              <Ico n="avion" t={15} />{exemple === 'espace' ? 'Envoi…' : 'M’envoyer un exemple'}
            </button>
          )}
          {pour === 'recherche' && <a className={p.lien} href="/point/exemple" target="_blank" rel="noreferrer">{'Voir la page sans espace'}</a>}
        </div>
        {exemple && typeof exemple === 'object' && (
          <div style={{ fontSize: 13, marginTop: 8, color: exemple.ok ? '#166534' : '#991b1b' }}>{exemple.t}</div>
        )}
        <div className={p.aideChamp} style={{ marginTop: 8 }}>{fr('L’exemple arrive à ton adresse, avec le dossier d’un de tes demandeurs. Rien ne part au client.')}</div>
      </Carte>
    </div>
  );
}
